import type { PatientParams } from '../domain/types';

/** Constante de tiempo viscoelástica por omisión (s) cuando se activa E2 sin declararla. */
export const DEFAULT_TAU_VISC_S = 1.2;
/** Fracción de la capacidad del sigmoide donde se cambia a extensión lineal tangente (evita presiones infinitas). */
const SIGMOID_GUARD = 0.005;

export interface SigmoidPV {
  b: number;
  c: number;
  d: number;
}
/** Desplazamiento que ancla la sigmoide en V(P0) = 0, la convención de volumen del modelo. */
const sigmoidA = (s: SigmoidPV, p0: number): number => -s.b / (1 + Math.exp(-(p0 - s.c) / s.d));
/** Volumen de equilibrio a una presión dada. */
export function sigmoidVolume(s: SigmoidPV, p0: number, paw: number): number {
  return sigmoidA(s, p0) + s.b / (1 + Math.exp(-(paw - s.c) / s.d));
}
/** Compliance local (pendiente dV/dP) en la fracción u = (V − a)/b de la capacidad. */
const sigmoidSlope = (s: SigmoidPV, u: number): number => (s.b / s.d) * u * (1 - u);
/**
 * Presión elástica de la sigmoide. Fuera del intervalo útil se prolonga con la tangente del borde:
 * el modelo nunca devuelve infinitos aunque el ventilador insista por encima de la capacidad.
 */
export function sigmoidPressure(s: SigmoidPV, p0: number, v: number): number {
  const a = sigmoidA(s, p0);
  const u = (v - a) / s.b;
  const at = (uu: number): number => s.c + s.d * Math.log(uu / (1 - uu));
  if (u <= SIGMOID_GUARD) return at(SIGMOID_GUARD) + (v - (a + SIGMOID_GUARD * s.b)) / sigmoidSlope(s, SIGMOID_GUARD);
  if (u >= 1 - SIGMOID_GUARD) return at(1 - SIGMOID_GUARD) + (v - (a + (1 - SIGMOID_GUARD) * s.b)) / sigmoidSlope(s, 1 - SIGMOID_GUARD);
  return at(u);
}
/** Compliance local del sistema respiratorio a un volumen dado (L/cmH2O). */
export function sigmoidCompliance(s: SigmoidPV, p0: number, v: number): number {
  const u = Math.min(1 - SIGMOID_GUARD, Math.max(SIGMOID_GUARD, (v - sigmoidA(s, p0)) / s.b));
  return sigmoidSlope(s, u);
}
/** Volumen de equilibrio pasivo a una presión dada, con el modelo elástico que declare el paciente. */
export function equilibriumVolumeFor(params: { crs: number; p0: number; sigmoid?: SigmoidPV }, paw: number): number {
  const s = params.sigmoid;
  return s && s.b > 0 ? sigmoidVolume(s, params.p0, paw) : params.crs * (paw - params.p0);
}

/**
 * Modelo mecánico del sistema respiratorio (P · dossier §12):
 *   Paw + Pmus = P0 + Pel(V, Vve) + R(Q)·Q,   Q = dV/dt,   R(Q) = R1 + R2·|Q|
 *
 * Elástico: un compartimento estático (Crs) más un cuerpo de Maxwell opcional (E2 en serie con un amortiguador),
 * el modelo clásico de relajación de esfuerzo (Mount; Bates; D'Angelo):
 *   Pel = P0 + V/Crs + E2·(V − Vve),    dVve/dt = (V − Vve)/tauVisc
 * Con E2 = 0 se reduce exactamente al compartimento único. Con E2 > 0, tras ocluir la presión cae de inmediato
 * lo resistivo (Ppico → P1) y luego decae con tauVisc hasta la meseta estática P2 = P0 + V/Crs.
 * Resistivo: término de Rohrer R2·|Q| sobre la resistencia lineal, distinta en inspiración y espiración.
 *
 * V es el volumen ABSOLUTO sobre el volumen de relajación (V = 0 cuando Pel = P0).
 * No se reinicia al cambiar PEEP, al cambiar de vista ni al empezar una maniobra.
 */
export class PatientModel {
  params: PatientParams;
  /** Volumen absoluto sobre relajación (L). */
  v: number;
  /** Volumen que ya atravesó el amortiguador viscoelástico (L). Sin E2 sigue pegado a `v`. */
  vVisc: number;

  constructor(params: PatientParams, initialV = 0) {
    this.params = { ...params };
    this.v = initialV;
    this.vVisc = initialV; // arranca relajado: Pel(0) = P0
  }

  private get e2(): number {
    const e = this.params.eVisc ?? 0;
    return Number.isFinite(e) && e > 0 ? e : 0;
  }
  private get tauVisc(): number {
    return Math.max(1e-3, this.params.tauViscS ?? DEFAULT_TAU_VISC_S);
  }
  /** Presión que aporta el elemento viscoelástico ahora mismo (cmH2O); 0 sin E2. */
  get pVisc(): number {
    return this.e2 * (this.v - this.vVisc);
  }

  /**
   * Avanza el elemento viscoelástico un tramo con flujo constante. Solución exacta de dVve/dt = (V − Vve)/tau
   * con V(t) = v0 + q·t, así que la relajación durante una oclusión (q = 0) es exacta a cualquier paso.
   */
  private relax(q: number, dt: number, v0: number): void {
    if (this.e2 <= 0) {
      this.vVisc = v0 + q * dt; // sin componente: si el instructor la activa después, no hay salto de presión
      return;
    }
    const tau = this.tauVisc;
    const k = Math.exp(-dt / tau);
    this.vVisc = v0 + q * dt - q * tau + (this.vVisc - v0 + q * tau) * k;
  }

  /** Presión elástica del sistema respiratorio (cmH2O), estática más viscoelástica. */
  pel(v: number = this.v, vVisc: number = this.vVisc): number {
    return this.pelStatic(v) + this.e2 * (v - vVisc);
  }
  /** Presión elástica estática (sin el término viscoelástico): la meseta a la que tiende una oclusión larga. */
  pelStatic(v: number = this.v): number {
    const s = this.params.sigmoid;
    return s && s.b > 0 ? sigmoidPressure(s, this.params.p0, v) : this.params.p0 + v / this.params.crs;
  }

  /** Volumen de equilibrio pasivo bajo una presión de vía aérea constante. */
  equilibriumVolume(paw: number): number {
    return equilibriumVolumeFor(this.params, paw);
  }

  /** Compliance local (pendiente de la curva P-V) al volumen actual: con sigmoide cambia con el volumen. */
  compliance(v: number = this.v): number {
    const s = this.params.sigmoid;
    return s && s.b > 0 ? sigmoidCompliance(s, this.params.p0, v) : this.params.crs;
  }

  /** Resistencia lineal según el sentido del flujo; la espiratoria puede crecer al vaciarse el pulmón. */
  private r1For(q: number, v: number = this.v): number {
    if (q >= 0) return this.params.rInsp;
    const d = this.params.rExpVolumeDep;
    if (!d || d.gain <= 0) return this.params.rExp;
    return this.params.rExp * (1 + d.gain * Math.max(0, 1 - v / Math.max(1e-6, d.vRefL)));
  }
  /** Resistencia espiratoria efectiva al volumen indicado (cmH2O·s/L). */
  expiratoryResistance(v: number = this.v): number {
    return this.r1For(-1, v);
  }

  /**
   * Flujo espiratorio máximo por estrangulamiento (resistor de Starling), o infinito si no hay limitación.
   * Depende sólo del retroceso elástico y de la resistencia aguas arriba: por eso es independiente del esfuerzo
   * espiratorio y de cuánto se baje la presión aguas abajo.
   */
  maxExpiratoryFlow(paw: number, v: number = this.v): number {
    const e = this.params.efl;
    if (!e || paw >= e.pcrit) return Number.POSITIVE_INFINITY; // con la vía aérea por encima del punto crítico no colapsa
    const rus = Math.max(1e-3, e.rusFraction * this.expiratoryResistance(v));
    return Math.max(0, (this.pel(v) - e.pcrit) / rus);
  }

  /** Resolver Q para una Paw impuesta (fuente de presión). */
  flowForPaw(paw: number, pmus: number, v: number = this.v, rSeries = 0): number {
    const dp = paw + pmus - this.pel(v);
    const r1 = this.r1For(dp >= 0 ? 1 : -1, v) + rSeries;
    const r2 = this.params.r2;
    const q = r2 <= 0 ? dp / r1 : Math.sign(dp) * ((-r1 + Math.sqrt(r1 * r1 + 4 * r2 * Math.abs(dp))) / (2 * r2));
    if (q >= 0) return q;
    const qMax = this.maxExpiratoryFlow(paw, v);
    return Number.isFinite(qMax) ? -Math.min(-q, qMax) : q;
  }

  /** Paw resultante para un flujo impuesto (fuente de flujo). */
  pawForFlow(q: number, pmus: number, v: number = this.v): number {
    const r = this.r1For(q, v) + this.params.r2 * Math.abs(q);
    return this.pel(v) + r * q - pmus;
  }

  /**
   * Integra un tramo con Paw impuesta constante y Pmus dada por función del tiempo (RK2/Heun, con sub-pasos si dt/tau es grande).
   * Devuelve el cambio de volumen (∫Q dt exacto por definición) y el flujo al final.
   */
  integratePressureSource(
    paw: number,
    pmusAt: (tS: number) => number,
    t0: number,
    dt: number,
    nonNegativeFlow = false,
    maxFlow = Number.POSITIVE_INFINITY,
    rSeries = 0,
  ): { dV: number; qEnd: number; clamped: boolean } {
    const tauMin = Math.min(this.params.rInsp, this.params.rExp) * Math.max(1e-5, this.compliance());
    const nSub = Math.min(1000, Math.max(1, Math.ceil(dt / (0.2 * Math.max(1e-6, tauMin)))));
    // El tope de flujo (válvula/actuador) se aplica dentro de cada etapa del RK2, no en un paso aparte: así no hay
    // sobreimpulso dependiente de dt cuando el flujo libre cruza el tope a mitad de paso (revisión E24).
    const f = (pw: number, pm: number, vv: number): number => {
      const q = this.flowForPaw(pw, pm, vv, rSeries);
      return Math.min(maxFlow, nonNegativeFlow ? Math.max(0, q) : q);
    };
    const h = dt / nSub;
    const v0 = this.v;
    let v = v0;
    let t = t0;
    let q = 0;
    for (let i = 0; i < nSub; i++) {
      const vSub = v;
      const k1 = f(paw, pmusAt(t), v);
      const k2 = f(paw, pmusAt(t + h), v + h * k1);
      v += (h / 2) * (k1 + k2);
      // El elemento viscoelástico se congela dentro del sub-paso (tauVisc ≫ h) y avanza con el flujo medio del tramo.
      this.relax((v - vSub) / h, h, vSub);
      t += h;
      q = k2;
    }
    this.v = v;
    const qFree = this.flowForPaw(paw, pmusAt(t), v, rSeries);
    return { dV: v - v0, qEnd: f(paw, pmusAt(t), v) || q, clamped: qFree > maxFlow };
  }

  /** Integra un tramo con flujo impuesto constante (exacto: V lineal en t). Con q = 0 sólo relaja (oclusión). */
  integrateFlowSource(q: number, dt: number): { dV: number } {
    const v0 = this.v;
    const dV = q * dt;
    this.v += dV;
    this.relax(q, dt, v0);
    return { dV };
  }
}
