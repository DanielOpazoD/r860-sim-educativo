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

// La variabilidad sortea período y amplitud de cada esfuerzo con la semilla de la sesión: realista y reproducible.
describe('Pmus · variabilidad determinista respiración a respiración', () => {
  const base = { enabled: true, amplitude: 10, ratePerMin: 12, tiS: 1, phaseS: 0, shape: 'riseRelax' as const };

  it('sin variability (o con fracciones 0) el pulso queda bit a bit periódico', () => {
    const periodico = new EffortGenerator(base);
    for (const v of [undefined, { amplitudeFrac: 0, periodFrac: 0 }]) {
      const g = new EffortGenerator(v ? { ...base, variability: v } : base, 99);
      for (let t = 0; t <= 10; t += 0.01) expect(g.pmusAt(t)).toBe(periodico.pmusAt(t));
    }
  });

  it('con ±10 % cada pico queda en rango y los períodos no son todos iguales', () => {
    const g = new EffortGenerator(
      {
        enabled: true,
        amplitude: 8,
        ratePerMin: 15,
        tiS: 0.8,
        phaseS: 0,
        shape: 'riseRelax',
        variability: { amplitudeFrac: 0.1, periodFrac: 0.1 },
      },
      7,
    );
    const picos: number[] = [],
      instantes: number[] = [];
    let prev = g.pmusAt(0),
      subiendo = false;
    for (let t = 0.001; t <= 40; t += 0.001) {
      const y = g.pmusAt(t);
      if (y > prev) subiendo = true;
      else if (y < prev && subiendo && prev > 0.5) {
        // máximo local: el punto anterior era el pico del esfuerzo
        picos.push(prev);
        instantes.push(t - 0.001);
        subiendo = false;
      }
      prev = y;
    }
    expect(picos.length).toBeGreaterThanOrEqual(8);
    for (const pk of picos) {
      expect(pk).toBeGreaterThanOrEqual(7.2);
      expect(pk).toBeLessThanOrEqual(8.8);
    }
    const intervalos = instantes.slice(1).map((t, i) => t - instantes[i]!);
    for (const d of intervalos) {
      expect(d).toBeGreaterThanOrEqual(3.6);
      expect(d).toBeLessThanOrEqual(4.4);
    }
    const media = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
    expect(Math.max(...intervalos.map((d) => Math.abs(d - media)))).toBeGreaterThan(1e-3);
  });

  it('la misma semilla repite la serie; otra semilla la cambia', () => {
    const params = { ...base, variability: { amplitudeFrac: 0.2, periodFrac: 0.2 } };
    const a = new EffortGenerator(params, 7),
      b = new EffortGenerator(params, 7),
      c = new EffortGenerator(params, 8);
    let iguales = true,
      distintos = false;
    for (let t = 0; t <= 40; t += 0.02) {
      if (a.pmusAt(t) !== b.pmusAt(t)) iguales = false;
      if (a.pmusAt(t) !== c.pmusAt(t)) distintos = true;
    }
    expect(iguales).toBe(true);
    expect(distintos).toBe(true);
  });
});
