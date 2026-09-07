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
  /** Volumen de la segunda unidad alveolar (L), si el paciente la declara. */
  v2: number;

  constructor(params: PatientParams, initialV = 0) {
    this.params = { ...params };
    this.v = initialV;
    this.vVisc = initialV; // arranca relajado: Pel(0) = P0
    const sec = params.second;
    // La segunda unidad arranca en equilibrio a la misma presión que la principal.
    this.v2 = sec ? sec.crs * (this.pelStatic(initialV) - params.p0) : 0;
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

  /** Volumen total del pulmón (todas las unidades) sobre el volumen de relajación. */
  get vTotal(): number {
    return this.v + (this.hasSecond ? this.v2 : 0);
  }
  /**
   * Presión que alcanzaría el sistema si se ocluyera hasta equilibrar todas las unidades: la auto-PEEP verdadera.
   * Con una sola unidad es la presión elástica estática; con dos se resuelve por bisección sobre el volumen total.
   */
  equilibratedPressure(v: number = this.v, v2: number = this.v2): number {
    if (!this.hasSecond) return this.pelStatic(v);
    const c2 = this.params.second?.crs ?? 0;
    const total = v + v2;
    const vol = (p: number): number => equilibriumVolumeFor(this.params, p) + c2 * (p - this.params.p0);
    let lo = this.params.p0 - 50,
      hi = this.params.p0 + 200;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (vol(mid) < total) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
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

  get hasSecond(): boolean {
    return !!this.params.second && this.params.second.crs > 0;
  }
  /** Presión elástica de la segunda unidad (lineal: sin sigmoide ni viscoelástico, simplificación declarada). */
  pel2(v2: number = this.v2): number {
    return this.params.p0 + v2 / Math.max(1e-6, this.params.second?.crs ?? 1);
  }
  /** Flujo de la segunda unidad para una presión de nodo dada. */
  branch2Flow(paw: number, pmus: number, v2: number = this.v2): number {
    const sec = this.params.second;
    if (!sec || sec.crs <= 0) return 0;
    const dp = paw + pmus - this.pel2(v2);
    return dp / (dp >= 0 ? sec.rInsp : sec.rExp);
  }

  /** Resolver Q para una Paw impuesta (fuente de presión). Con dos unidades devuelve el flujo TOTAL del nodo. */
  flowForPaw(paw: number, pmus: number, v: number = this.v, rSeries = 0, v2: number = this.v2): number {
    const dp = paw + pmus - this.pel(v);
    const r1 = this.r1For(dp >= 0 ? 1 : -1, v) + rSeries;
    const r2 = this.params.r2;
    const q = r2 <= 0 ? dp / r1 : Math.sign(dp) * ((-r1 + Math.sqrt(r1 * r1 + 4 * r2 * Math.abs(dp))) / (2 * r2));
    if (q >= 0) return q;
    const qMax = this.maxExpiratoryFlow(paw, v);
    const q1 = Number.isFinite(qMax) ? -Math.min(-q, qMax) : q;
    return this.hasSecond ? q1 + this.branch2Flow(paw, pmus, v2) : q1;
  }
  /** Flujo sólo de la unidad principal (la que lleva Rohrer, limitación al flujo y dependencia del volumen). */
  branch1Flow(paw: number, pmus: number, v: number = this.v, rSeries = 0): number {
    const dp = paw + pmus - this.pel(v);
    const r1 = this.r1For(dp >= 0 ? 1 : -1, v) + rSeries;
    const r2 = this.params.r2;
    const q = r2 <= 0 ? dp / r1 : Math.sign(dp) * ((-r1 + Math.sqrt(r1 * r1 + 4 * r2 * Math.abs(dp))) / (2 * r2));
    if (q >= 0) return q;
    const qMax = this.maxExpiratoryFlow(paw, v);
    return Number.isFinite(qMax) ? -Math.min(-q, qMax) : q;
  }
  /**
   * Presión del nodo de la vía aérea que produce un flujo total dado, resuelta por bisección: las ramas pueden ser
   * no lineales (Rohrer, limitación al flujo), pero el flujo total crece de forma monótona con la presión del nodo.
   */
  nodePressureForFlow(qTotal: number, pmus: number, v: number = this.v, v2: number = this.v2): number {
    const f = (py: number): number => this.branch1Flow(py, pmus, v) + this.branch2Flow(py, pmus, v2);
    let lo = Math.min(this.pel(v), this.pel2(v2)) - pmus - 1;
    let hi = Math.max(this.pel(v), this.pel2(v2)) - pmus + 1;
    for (let i = 0; i < 60 && f(lo) > qTotal; i++) lo -= Math.max(1, Math.abs(lo));
    for (let i = 0; i < 60 && f(hi) < qTotal; i++) hi += Math.max(1, Math.abs(hi));
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < qTotal) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /** Paw resultante para un flujo impuesto (fuente de flujo). */
  pawForFlow(q: number, pmus: number, v: number = this.v): number {
    if (this.hasSecond) return this.nodePressureForFlow(q, pmus, v);
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
    const v20 = this.v2;
    let v = v0;
    let v2 = v20;
    let t = t0;
    let q = 0;
    // Con dos unidades cada rama se integra con su propio flujo: comparten el nodo (la Paw impuesta) pero no la mecánica.
    const f1 = (pw: number, pm: number, vv: number): number => {
      const q1 = this.branch1Flow(pw, pm, vv, rSeries);
      return Math.min(maxFlow, nonNegativeFlow ? Math.max(0, q1) : q1);
    };
    for (let i = 0; i < nSub; i++) {
      const vSub = v;
      if (this.hasSecond) {
        const k1a = f1(paw, pmusAt(t), v),
          k1b = this.branch2Flow(paw, pmusAt(t), v2);
        const k2a = f1(paw, pmusAt(t + h), v + h * k1a),
          k2b = this.branch2Flow(paw, pmusAt(t + h), v2 + h * k1b);
        v += (h / 2) * (k1a + k2a);
        v2 += (h / 2) * (k1b + k2b);
        q = k2a + k2b;
      } else {
        const k1 = f(paw, pmusAt(t), v);
        const k2 = f(paw, pmusAt(t + h), v + h * k1);
        v += (h / 2) * (k1 + k2);
        q = k2;
      }
      // El elemento viscoelástico se congela dentro del sub-paso (tauVisc ≫ h) y avanza con el flujo medio del tramo.
      this.relax((v - vSub) / h, h, vSub);
      t += h;
    }
    this.v = v;
    this.v2 = v2;
    const qFree = this.flowForPaw(paw, pmusAt(t), v, rSeries, v2);
    const qEnd = this.hasSecond ? f1(paw, pmusAt(t), v) + this.branch2Flow(paw, pmusAt(t), v2) : f(paw, pmusAt(t), v);
    return { dV: v - v0 + (v2 - v20), qEnd: qEnd || q, clamped: qFree > maxFlow };
  }

  /**
   * Integra un tramo con flujo TOTAL impuesto. Con una sola unidad es exacto (V lineal en t). Con dos unidades el
   * reparto entre ramas cambia dentro del tramo, así que se sub-divide y en cada sub-paso se resuelve la presión
   * del nodo: con q = 0 eso es exactamente el pendelluft (el gas pasa de una unidad a la otra con el circuito cerrado).
   */
  integrateFlowSource(q: number, dt: number): { dV: number } {
    if (!this.hasSecond) {
      const v0 = this.v;
      const dV = q * dt;
      this.v += dV;
      this.relax(q, dt, v0);
      return { dV };
    }
    const sec = this.params.second as { crs: number; rInsp: number; rExp: number };
    const tauMin = Math.min(
      Math.min(this.params.rInsp, this.params.rExp) * Math.max(1e-5, this.compliance()),
      Math.min(sec.rInsp, sec.rExp) * sec.crs,
    );
    const nSub = Math.min(1000, Math.max(1, Math.ceil(dt / (0.2 * Math.max(1e-6, tauMin)))));
    const h = dt / nSub;
    for (let i = 0; i < nSub; i++) {
      const before = this.v;
      const py1 = this.nodePressureForFlow(q, 0, this.v, this.v2);
      const k1a = this.branch1Flow(py1, 0, this.v),
        k1b = this.branch2Flow(py1, 0, this.v2);
      const py2 = this.nodePressureForFlow(q, 0, this.v + h * k1a, this.v2 + h * k1b);
      const k2a = this.branch1Flow(py2, 0, this.v + h * k1a),
        k2b = this.branch2Flow(py2, 0, this.v2 + h * k1b);
      this.v += (h / 2) * (k1a + k2a);
      this.v2 += (h / 2) * (k1b + k2b);
      this.relax((this.v - before) / h, h, before);
    }
    return { dV: q * dt }; // el volumen que entra o sale del pulmón lo fija el flujo impuesto; el reparto entre unidades es interno
  }
}
