import type { PatientParams } from '../domain/types';

/**
 * Modelo mecánico lineal de un compartimento (P · dossier §12):
 *   Paw + Pmus = P0 + V/Crs + R(Q)·Q,   Q = dV/dt,   R(Q) = R1 + R2·|Q|
 * V es el volumen ABSOLUTO sobre el volumen de relajación (V = 0 cuando Pel = P0).
 * No se reinicia al cambiar PEEP, al cambiar de vista ni al empezar una maniobra.
 */
export class PatientModel {
  params: PatientParams;
  /** Volumen absoluto sobre relajación (L). */
  v: number;

  constructor(params: PatientParams, initialV = 0) {
    this.params = { ...params };
    this.v = initialV;
  }

  /** Presión elástica del sistema respiratorio (cmH2O). */
  pel(v: number = this.v): number {
    return this.params.p0 + v / this.params.crs;
  }

  /** Volumen de equilibrio pasivo bajo una presión de vía aérea constante. */
  equilibriumVolume(paw: number): number {
    return this.params.crs * (paw - this.params.p0);
  }

  private r1For(q: number): number {
    return q >= 0 ? this.params.rInsp : this.params.rExp;
  }

  /** Resolver Q para una Paw impuesta (fuente de presión). */
  flowForPaw(paw: number, pmus: number, v: number = this.v): number {
    const dp = paw + pmus - this.pel(v);
    const r1 = dp >= 0 ? this.params.rInsp : this.params.rExp;
    const r2 = this.params.r2;
    if (r2 <= 0) return dp / r1;
    const mag = (-r1 + Math.sqrt(r1 * r1 + 4 * r2 * Math.abs(dp))) / (2 * r2);
    return Math.sign(dp) * mag;
  }

  /** Paw resultante para un flujo impuesto (fuente de flujo). */
  pawForFlow(q: number, pmus: number, v: number = this.v): number {
    const r = this.r1For(q) + this.params.r2 * Math.abs(q);
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
  ): { dV: number; qEnd: number; clamped: boolean } {
    const tauMin = Math.min(this.params.rInsp, this.params.rExp) * this.params.crs;
    const nSub = Math.min(1000, Math.max(1, Math.ceil(dt / (0.2 * Math.max(1e-6, tauMin)))));
    // El tope de flujo (válvula/actuador) se aplica dentro de cada etapa del RK2, no en un paso aparte: así no hay
    // sobreimpulso dependiente de dt cuando el flujo libre cruza el tope a mitad de paso (revisión E24).
    const f = (pw: number, pm: number, vv: number): number => {
      const q = this.flowForPaw(pw, pm, vv);
      return Math.min(maxFlow, nonNegativeFlow ? Math.max(0, q) : q);
    };
    const h = dt / nSub;
    const v0 = this.v;
    let v = v0;
    let t = t0;
    let q = 0;
    for (let i = 0; i < nSub; i++) {
      const k1 = f(paw, pmusAt(t), v);
      const k2 = f(paw, pmusAt(t + h), v + h * k1);
      v += (h / 2) * (k1 + k2);
      t += h;
      q = k2;
    }
    this.v = v;
    const qFree = this.flowForPaw(paw, pmusAt(t), v);
    return { dV: v - v0, qEnd: f(paw, pmusAt(t), v) || q, clamped: qFree > maxFlow };
  }

  /** Integra un tramo con flujo impuesto constante (exacto: V lineal en t). */
  integrateFlowSource(q: number, dt: number): { dV: number } {
    const dV = q * dt;
    this.v += dV;
    return { dV };
  }
}
