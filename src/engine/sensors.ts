import type { SensorParams } from '../domain/types';

/** Variabilidad por omisión del canal de volumen (P: ±2,5 % ciclo a ciclo, σ ≈ 1,44 %; dentro de la exactitud D de ±10 % y de la repetibilidad 1σ de ±2 %, URM SW10 13-20, E-122). */
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
 * Mezclador de O2, constante de tiempo (s), P dentro de un D: el manual da para el paso de 21 a 90 % «< 6 breaths or 30
 * seconds, whichever is longer» (URM SW10 13-21). Con 8 s el paso llega al 90 % en 18 s y al 95 % en 24 s. Antes la
 * mezcla entregada saltaba al objetivo.
 */
export const O2_MIXER_TAU_S = 8;
/** Ventana de la media móvil con que el equipo muestra la FiO2 (s): «10 s moving average» (D, URM SW10 13-24). */
export const FIO2_DISPLAY_AVERAGE_S = 10;

/**
 * Capa de sensores virtuales: la mezcla objetivo, la mezcla entregada y el sensor de O2 son estados distintos. La mezcla
 * entregada sigue al objetivo con la constante del mezclador; el sensor la sigue con retardo de primer orden (P) y un
 * sesgo configurable por el instructor (SC-12); lo que se muestra y vigila es la media móvil de 10 s del sensor (D).
 * Presión, flujo y volumen son canales ideales en esta etapa (sin ruido ni retraso), declarados como tales.
 */
export class O2Sensor {
  params: SensorParams;
  /** Fracción que el mezclador quiere entregar (el ajuste). */
  target: number;
  /** Fracción entregada por el mezclador: sigue al objetivo con O2_MIXER_TAU_S. */
  delivered: number;
  /** Lectura instantánea del sensor (fracción). */
  sensor: number;
  /** Media móvil de 10 s del sensor: lo que muestra el equipo y comparan sus alarmas (fracción). */
  measured: number;
  /** Muestras del sensor de los últimos 10 s en un anillo, y su suma (paso fijo: media aritmética). */
  private ventana: Float64Array | null = null;
  private llenas = 0;
  private cabeza = 0;
  private suma = 0;
  constructor(params: SensorParams, initialFraction: number) {
    this.params = { ...params };
    this.target = initialFraction;
    this.delivered = initialFraction;
    this.sensor = initialFraction + params.fio2Bias;
    this.measured = this.sensor;
  }
  setTarget(fraction: number): void {
    this.target = fraction;
  }
  step(dtS: number): void {
    this.delivered += (1 - Math.exp(-dtS / O2_MIXER_TAU_S)) * (this.target - this.delivered);
    const tau = Math.max(1e-3, this.params.fio2TauS);
    const objetivo = this.delivered + this.params.fio2Bias;
    this.sensor += (1 - Math.exp(-dtS / tau)) * (objetivo - this.sensor);
    const n = Math.max(1, Math.round(FIO2_DISPLAY_AVERAGE_S / Math.max(1e-6, dtS)));
    if (!this.ventana || this.ventana.length !== n) {
      this.ventana = new Float64Array(n);
      this.llenas = 0;
      this.cabeza = 0;
      this.suma = 0;
    }
    if (this.llenas === n) this.suma -= this.ventana[this.cabeza] as number;
    else this.llenas += 1;
    this.ventana[this.cabeza] = this.sensor;
    this.suma += this.sensor;
    this.cabeza = (this.cabeza + 1) % n;
    this.measured = this.suma / this.llenas;
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
