import { describe, it, expect } from 'vitest';
import { EffortGenerator } from '../../src/engine/effort';
import type { EffortParams } from '../../src/domain/types';

// EA · esfuerzo espiratorio activo. La contracción es una Pmus NEGATIVA en medio seno que arranca al final de la
// inspiración neural; ausente o 0 el generador es idéntico al de siempre (y la serie del RNG no cambia).
const base: EffortParams = { enabled: true, amplitude: 8, ratePerMin: 12, tiS: 0.8, phaseS: 0.3, shape: 'riseRelax' };
const rejilla = (gen: EffortGenerator): number[] => {
  const out: number[] = [];
  for (let t = 0; t <= 10; t += 0.004) out.push(gen.pmusAt(t));
  return out;
};

describe('EA esfuerzo espiratorio', () => {
  it('sin el campo o en 0 el pmusAt es idéntico (con y sin variabilidad)', () => {
    // Cada par compara el mismo esfuerzo base con y sin el campo: la serie del RNG debe quedar intacta.
    const pares: Array<[Partial<EffortParams>, Partial<EffortParams>]> = [
      [{}, { expAmplitude: 0 }],
      [{}, { expAmplitude: 0, expTiS: 0.9 }],
      [{ variability: { amplitudeFrac: 0.2, periodFrac: 0.1 } }, { variability: { amplitudeFrac: 0.2, periodFrac: 0.1 }, expAmplitude: 0 }],
    ];
    for (const [sin, con] of pares) {
      const a = rejilla(new EffortGenerator({ ...base, ...sin }, 7));
      const b = rejilla(new EffortGenerator({ ...base, ...con }, 7));
      expect(a.length).toBe(b.length);
      a.forEach((v, i) => expect(v).toBe(b[i]));
    }
  });

  it('con expAmplitude la Pmus baja en medio seno negativo y vuelve a 0', () => {
    // halfSine no tiene cola inspiratoria que se solape: el mínimo es exactamente −expAmplitude.
    const g = new EffortGenerator({ ...base, shape: 'halfSine', expAmplitude: 5 }, 1);
    let min = Infinity;
    for (let t = 0; t < 5; t += 0.002) min = Math.min(min, g.pmusAt(t));
    expect(min).toBeCloseTo(-5, 2);
    expect(g.pmusAt(0.3 + 4.9)).toBe(0);
    // riseRelax: la cola de relajación positiva se resta del seno negativo: el mínimo queda entre −5 y ~−4.
    const g2 = new EffortGenerator({ ...base, expAmplitude: 5 }, 1);
    let min2 = Infinity;
    for (let t = 0; t < 5; t += 0.002) min2 = Math.min(min2, g2.pmusAt(t));
    expect(min2).toBeGreaterThanOrEqual(-5 - 1e-9);
    expect(min2).toBeLessThanOrEqual(-3.9);
    expect(min2).toBeGreaterThan(-5);
    expect(g2.pmusAt(0.3 + 4.9)).toBe(0);
  });

  it('la forma es continua: |ΔPmus| entre muestras consecutivas < 1 cmH2O', () => {
    const g = new EffortGenerator({ ...base, expAmplitude: 15 }, 1);
    let prev = g.pmusAt(0),
      maxDelta = 0;
    for (let t = 0.004; t < 5; t += 0.004) {
      const v = g.pmusAt(t);
      maxDelta = Math.max(maxDelta, Math.abs(v - prev));
      prev = v;
    }
    expect(maxDelta).toBeLessThan(1);
  });
});
