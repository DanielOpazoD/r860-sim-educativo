import type { EffortParams } from '../domain/types';

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
  constructor(params: EffortParams) {
    this.params = { ...params };
  }
  pmusAt(tS: number): number {
    const p = this.params;
    if (!p.enabled || p.amplitude <= 0 || p.ratePerMin <= 0) return 0;
    const period = 60 / p.ratePerMin;
    const tau = (((tS - p.phaseS) % period) + period) % period;
    if ((p.shape ?? 'halfSine') === 'halfSine') return tau < p.tiS ? p.amplitude * Math.sin((Math.PI * tau) / p.tiS) : 0;
    const tp = p.tiS;
    if (tau < tp) return p.amplitude * Math.sin((Math.PI * tau) / (2 * tp));
    const tauRel = Math.max(1e-3, p.relaxTauS ?? DEFAULT_RELAX_TAU_S);
    const v = p.amplitude * Math.exp(-(tau - tp) / tauRel);
    return v < 1e-3 * p.amplitude ? 0 : v;
  }
}
