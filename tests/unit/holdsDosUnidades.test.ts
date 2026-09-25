import { describe, expect, it } from 'vitest';
import { benchSim, runUntilBreath, BENCH_SETTINGS, BENCH_PATIENT } from '../helpers';
import { humanReason } from '../../src/ui/humanize';

// Con dos unidades alveolares en paralelo el equipo mide igual (la Cstat y la resistencia salen de las mismas
// presiones), pero el número no equivale a un solo compartimento: las muestras quedan válidas y lo avisan.
describe('Cstat y resistencia insp. con dos unidades en paralelo: válidas y marcadas «aprox.»', () => {
  it('bloqueo insp válido en un pulmón de dos unidades: cstat y raw traen reason twoCompartments y quality valid', () => {
    const sim = benchSim({
      patient: { ...BENCH_PATIENT, second: { crs: 0.025, rInsp: 200, rExp: 200 } },
      // Meseta que se asienta: la segunda unidad con R alta sigue relajando durante 3 s, así que el bloqueo va largo.
    });
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 5 });
    runUntilBreath(sim, 2);
    const r = sim.procedures.last.inspHold!;
    expect(r.quality).toBe('valid');
    expect(r.values.cstat!.value).toBeGreaterThan(0);
    expect(r.values.cstat!.quality).toBe('valid');
    expect(r.values.cstat!.reason).toMatch(/^twoCompartments;/);
    if (r.values.raw!.value !== null) {
      expect(r.values.raw!.quality).toBe('valid');
      expect(r.values.raw!.reason).toMatch(/^twoCompartments;/);
    }
    expect(humanReason(r.values.cstat!.reason)).toContain('dos unidades en paralelo');
  });

  it('un solo compartimento: mismas muestras sin la marca de aproximación', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS } });
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    runUntilBreath(sim, 2);
    const r = sim.procedures.last.inspHold!;
    expect(r.quality).toBe('valid');
    expect(r.values.cstat!.reason).not.toContain('twoCompartments');
    expect(r.values.raw!.reason).not.toContain('twoCompartments');
  });
});
