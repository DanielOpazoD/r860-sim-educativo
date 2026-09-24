import { describe, expect, it } from 'vitest';
import { EffortGenerator } from '../../src/engine/effort';
import { validateEffort } from '../../src/domain/validation';

// Dos formas de pulso de Pmus: 'halfSine' (seno de media onda) y 'riseRelax' (subida al pico en Ti y relajación exponencial).
describe('Pmus · formas del pulso de esfuerzo', () => {
  it('halfSine se conserva: pico a mitad del Ti y cero después', () => {
    const g = new EffortGenerator({ enabled: true, amplitude: 10, ratePerMin: 12, tiS: 1, phaseS: 0 });
    expect(g.pmusAt(0.5)).toBeCloseTo(10, 6);
    expect(g.pmusAt(1.5)).toBe(0);
  });

  it('riseRelax: subida sinusoidal hasta el pico en Ti y relajación exponencial', () => {
    const g = new EffortGenerator({ enabled: true, amplitude: 10, ratePerMin: 12, tiS: 1, phaseS: 0, shape: 'riseRelax' });
    expect(g.pmusAt(1)).toBeCloseTo(10, 6); // pico al final de la inspiración neural
    expect(g.pmusAt(0.5)).toBeCloseTo(10 * Math.sin(Math.PI / 4), 6);
    expect(g.pmusAt(1.15)).toBeCloseTo(10 * Math.exp(-1), 3); // una τ de relajación
    expect(g.pmusAt(4.9)).toBe(0); // cola cortada
    expect(g.pmusAt(1.1)).toBeGreaterThan(g.pmusAt(1.3));
    expect(g.pmusAt(1.3)).toBeGreaterThan(g.pmusAt(1.6));
  });

  it('validateEffort rechaza una forma desconocida y una τ de relajación no positiva', () => {
    const base = { enabled: true, amplitude: 10, ratePerMin: 12, tiS: 1, phaseS: 0 };
    expect(validateEffort({ ...base, shape: 'foo' as never }).length).toBeGreaterThan(0);
    expect(validateEffort({ ...base, relaxTauS: 0 }).length).toBeGreaterThan(0);
    expect(validateEffort({ ...base, shape: 'riseRelax', relaxTauS: 0.2 })).toEqual([]);
  });
});
