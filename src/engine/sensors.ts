import type { SensorParams } from '../domain/types';

/**
 * Capa de sensores virtuales (P): la mezcla objetivo, la mezcla entregada y el sensor de O2 son estados distintos.
 * El sensor sigue a la mezcla con retardo de primer orden y un sesgo configurable por el instructor (SC-12).
 * Presión, flujo y volumen son canales ideales en esta etapa (sin ruido ni retraso), declarados como tales.
 */
export class O2Sensor {
  params: SensorParams;
  /** Fracción entregada por el mezclador (sigue al objetivo de inmediato en esta etapa, P). */
  delivered: number;
  /** Lectura del sensor (fracción). */
  measured: number;
  constructor(params: SensorParams, initialFraction: number) {
    this.params = { ...params };
    this.delivered = initialFraction;
    this.measured = initialFraction + params.fio2Bias;
  }
  setTarget(fraction: number): void {
    this.delivered = fraction;
  }
  step(dtS: number): void {
    const tau = Math.max(1e-3, this.params.fio2TauS);
    const target = this.delivered + this.params.fio2Bias;
    const a = 1 - Math.exp(-dtS / tau);
    this.measured += a * (target - this.measured);
  }
}

/** Anillo de muestras para curvas (Float32) en unidades internas; la UI convierte al dibujar. */
export class SampleRing {
  readonly capacity: number;
  readonly t = new Float64Array(0);
  private buf: { t: Float64Array; paw: Float32Array; flow: Float32Array; vol: Float32Array };
  private head = 0;
  private count = 0;
  private total = 0;
  constructor(capacity: number) {
    this.capacity = capacity;
    this.buf = { t: new Float64Array(capacity), paw: new Float32Array(capacity), flow: new Float32Array(capacity), vol: new Float32Array(capacity) };
  }
  push(tMs: number, paw: number, flow: number, vol: number): void {
    const i = this.head;
    this.buf.t[i] = tMs; this.buf.paw[i] = paw; this.buf.flow[i] = flow; this.buf.vol[i] = vol;
    this.head = (i + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
    this.total += 1;
  }
  get totalPushed(): number { return this.total; }
  /** Devuelve las últimas `n` muestras en orden temporal (copias). */
  last(n: number): { t: Float64Array; paw: Float32Array; flow: Float32Array; vol: Float32Array } {
    const m = Math.min(n, this.count);
    const out = { t: new Float64Array(m), paw: new Float32Array(m), flow: new Float32Array(m), vol: new Float32Array(m) };
    for (let k = 0; k < m; k++) {
      const idx = (this.head - m + k + this.capacity) % this.capacity;
      out.t[k] = this.buf.t[idx] as number; out.paw[k] = this.buf.paw[idx] as number; out.flow[k] = this.buf.flow[idx] as number; out.vol[k] = this.buf.vol[idx] as number;
    }
    return out;
  }
}
