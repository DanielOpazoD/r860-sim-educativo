import type { EffortParams } from '../domain/types';

/**
 * Esfuerzo muscular sintético (P): pulso semisinusoidal de Pmus con amplitud, frecuencia y duración,
 * cuya fase es independiente del reloj del ventilador. Pmus > 0 favorece la entrada de gas.
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
    return tau < p.tiS ? p.amplitude * Math.sin((Math.PI * tau) / p.tiS) : 0;
  }
}
