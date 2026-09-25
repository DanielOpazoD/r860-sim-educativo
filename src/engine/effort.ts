import type { EffortParams } from '../domain/types';
import { mulberry32 } from './sensors';

/** Constante de tiempo por omisión de la relajación en la forma 'riseRelax' (s), P. */
export const DEFAULT_RELAX_TAU_S = 0.15;

/**
 * Esfuerzo muscular sintético (P): dos formas de pulso de Pmus con amplitud, frecuencia y duración,
 * cuya fase es independiente del reloj del ventilador. 'riseRelax' es la fisiológica (subida hasta el
 * pico al final de la inspiración neural y relajación exponencial del diafragma, P). Pmus > 0 favorece
 * la entrada de gas.
 */
export class EffortGenerator {
  params: EffortParams;
  private rng: () => number;
  private onsetS: number | null = null;
  private periodS = 0;
  private ampFactor = 1;
  constructor(params: EffortParams, seed = 1) {
    this.params = { ...params };
    this.rng = mulberry32(seed);
  }
  /** Forma del pulso: `tau` dentro del esfuerzo, `amp` pico, `ti` instante del pico (riseRelax) o duración (halfSine). */
  private pulse(tau: number, amp: number, ti: number): number {
    const p = this.params;
    if ((p.shape ?? 'halfSine') === 'halfSine') return tau < ti ? amp * Math.sin((Math.PI * tau) / ti) : 0;
    if (tau < ti) return amp * Math.sin((Math.PI * tau) / (2 * ti));
    const tauRel = Math.max(1e-3, p.relaxTauS ?? DEFAULT_RELAX_TAU_S);
    const v = amp * Math.exp(-(tau - ti) / tauRel);
    return v < 1e-3 * amp ? 0 : v;
  }
  /**
   * Contracción espiratoria activa (P): medio seno NEGATIVO que arranca al final de la inspiración neural (τ = ti)
   * y se suma a la cola de relajación, así que la suma puede pasar por cero sin discontinuidad. Duración con tope
   * 0,8·(período − ti) para que el pulso no invada el siguiente esfuerzo.
   */
  private expPulse(tau: number, ti: number, periodS: number, ampFactor: number): number {
    const p = this.params;
    const a = (p.expAmplitude ?? 0) * ampFactor;
    if (!(a > 0) || !(periodS > ti)) return 0;
    const te = Math.min(p.expTiS ?? 0.6, 0.8 * (periodS - ti));
    if (!(te > 0)) return 0;
    const tauE = tau - ti;
    return tauE >= 0 && tauE < te ? -a * Math.sin((Math.PI * tauE) / te) : 0;
  }
  /** Sortea período y amplitud del próximo esfuerzo; dos sorteos en orden fijo para que la serie sea reproducible. */
  private draw(): void {
    const p = this.params,
      v = p.variability;
    this.periodS = (60 / p.ratePerMin) * (1 + (v?.periodFrac ?? 0) * (2 * this.rng() - 1));
    this.ampFactor = 1 + (v?.amplitudeFrac ?? 0) * (2 * this.rng() - 1);
  }
  pmusAt(tS: number): number {
    const p = this.params;
    if (!p.enabled || p.amplitude <= 0 || p.ratePerMin <= 0) return 0;
    const v = p.variability;
    // Sin variabilidad la fórmula periódica pura se conserva bit a bit: mismo resultado que siempre.
    if (!v || (v.amplitudeFrac === 0 && v.periodFrac === 0)) {
      const period = 60 / p.ratePerMin;
      const tau = (((tS - p.phaseS) % period) + period) % period;
      return this.pulse(tau, p.amplitude, p.tiS) + this.expPulse(tau, p.tiS, period, 1);
    }
    // Con variabilidad los esfuerzos se encadenan: cada uno sortea su período y su amplitud (monótono en t).
    if (this.onsetS === null) {
      this.onsetS = p.phaseS;
      this.draw();
    }
    while (tS >= this.onsetS + this.periodS) {
      this.onsetS += this.periodS;
      this.draw();
    }
    if (tS < this.onsetS) return 0;
    const tau = tS - this.onsetS,
      ti = Math.min(p.tiS, 0.8 * this.periodS);
    return this.pulse(tau, p.amplitude * this.ampFactor, ti) + this.expPulse(tau, ti, this.periodS, this.ampFactor);
  }
}
