import type { SensorParams } from '../domain/types';

/** Variabilidad por omisión del canal de volumen (P: ±2,5 % ciclo a ciclo, dentro de la envolvente D de ±10 %). */
export const DEFAULT_FLOW_NOISE = 0.025;

/**
 * Generador pseudoaleatorio determinista (mulberry32). El motor no puede usar Math.random: la reproducción de
 * una sesión debe dar exactamente las mismas lecturas, así que el ruido de sensores nace de la semilla del escenario.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sensor de flujo: el volumen verdadero del modelo y el volumen que el ventilador muestra no son el mismo dato.
 * Cada respiración se lee con una ganancia 1 ± x (uniforme), como la dispersión ciclo a ciclo de un sensor real.
 */
export class FlowSensor {
  private next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  /** Ganancia del canal de volumen para la respiración que termina. */
  gain(fraction: number | undefined): number {
    const n = fraction ?? DEFAULT_FLOW_NOISE;
    const u = this.next(); // se consume siempre, para que la secuencia no dependa del ajuste
    return n <= 0 ? 1 : 1 + (u * 2 - 1) * n;
  }
}

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
  private buf: { t: Float64Array; paw: Float32Array; flow: Float32Array; vol: Float32Array; pmus: Float32Array; breath: Float32Array };
  private head = 0;
  private count = 0;
  private total = 0;
  constructor(capacity: number) {
    this.capacity = capacity;
    this.buf = {
      t: new Float64Array(capacity),
      paw: new Float32Array(capacity),
      flow: new Float32Array(capacity),
      vol: new Float32Array(capacity),
      pmus: new Float32Array(capacity),
      breath: new Float32Array(capacity),
    };
  }
  push(tMs: number, paw: number, flow: number, vol: number, pmus = 0, breath = 0): void {
    const i = this.head;
    this.buf.t[i] = tMs;
    this.buf.paw[i] = paw;
    this.buf.flow[i] = flow;
    this.buf.vol[i] = vol;
    this.buf.pmus[i] = pmus;
    this.buf.breath[i] = breath;
    this.head = (i + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
    this.total += 1;
  }
  get totalPushed(): number {
    return this.total;
  }
  /** Devuelve las últimas `n` muestras en orden temporal (copias). */
  last(n: number): { t: Float64Array; paw: Float32Array; flow: Float32Array; vol: Float32Array; pmus: Float32Array; breath: Float32Array } {
    const m = Math.min(n, this.count);
    const out = {
      t: new Float64Array(m),
      paw: new Float32Array(m),
      flow: new Float32Array(m),
      vol: new Float32Array(m),
      pmus: new Float32Array(m),
      breath: new Float32Array(m),
    };
    for (let k = 0; k < m; k++) {
      const idx = (this.head - m + k + this.capacity) % this.capacity;
      out.t[k] = this.buf.t[idx] as number;
      out.paw[k] = this.buf.paw[idx] as number;
      out.flow[k] = this.buf.flow[idx] as number;
      out.vol[k] = this.buf.vol[idx] as number;
      out.pmus[k] = this.buf.pmus[idx] as number;
      out.breath[k] = this.buf.breath[idx] as number;
    }
    return out;
  }
}
