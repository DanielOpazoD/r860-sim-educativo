import { describe, expect, it } from 'vitest';
import { JOULES_PER_CMH2O_L } from '../../src/engine/controller';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// Potencia mecánica: la energía que el ventilador entrega por respiración (∫ Pva·dV) por la frecuencia (Gattinoni 2016).
// El motor integra esa área en cada sub-paso; en un pulmón lineal pasivo tiene solución cerrada y aquí se compara con ella.

describe('POT-01 · VC pasivo: la integral coincide con la solución cerrada y con la fórmula de flujo constante', () => {
  it('banco SC-01: energía = PEEP·VT + R·Q·VT + VT²/(2C) = 7,5 cmH₂O·L → 11,0 J/min', () => {
    const sim = benchSim();
    runUntilBreath(sim, 10);
    const b = sim.breaths.at(-1)!;
    const { peep, vt } = BENCH_SETTINGS as { peep: number; vt: number };
    const q = vt / 1; // Tinsp 1 s, sin pausa
    const cerrada = peep * vt + BENCH_PATIENT.rInsp * q * vt + (vt * vt) / (2 * BENCH_PATIENT.crs); // cmH2O·L
    expect(cerrada).toBeCloseTo(7.5, 6);
    expect(b.energyInspJ! / JOULES_PER_CMH2O_L).toBeCloseTo(cerrada, 1);
    expect(Math.abs(b.energyInspJ! / JOULES_PER_CMH2O_L - cerrada) / cerrada).toBeLessThan(0.01);
    // Fórmula de Gattinoni para flujo constante: 0,098·FR·VT·[Ppico − ½(Pplat − PEEP)], con Ppico 20 y Pplat 15.
    const pm = sim.frame().metrics.mechPower!;
    expect(pm.quality).toBe('valid');
    expect(pm.unit).toBe('J/min');
    const gattinoni = 0.098 * 15 * vt * (20 - 0.5 * (15 - peep));
    expect(Math.abs(pm.value! - gattinoni) / gattinoni).toBeLessThan(0.012);
    expect(pm.value!).toBeCloseTo(11.0, 0);
  });

  it('a igual VT, subir la frecuencia sube la potencia casi en proporción; bajar el VT la baja más que en proporción', () => {
    const pm = (over: Partial<typeof BENCH_SETTINGS>): number => {
      const sim = benchSim({ settings: { ...BENCH_SETTINGS, ...over } });
      runUntilBreath(sim, 12);
      return sim.frame().metrics.mechPower!.value!;
    };
    const base = pm({});
    expect(pm({ rr: 20 }) / base).toBeGreaterThan(1.25); // 20/15 = 1,33 con la parte resistiva algo mayor (más flujo)
    const vtBajo = pm({ vt: 0.35 });
    expect(vtBajo / base).toBeLessThan(0.35 / 0.5); // el término elástico cae con VT²
  });
});

describe('POT-02 · PC pasivo: energía = (PEEP + Pinsp) · VT cuando la presión es constante', () => {
  it('BM-03 PC con rampa 0: (5 + 10) · 0,4323 = 6,48 cmH₂O·L por respiración', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, mode: 'AC_PC', pinsp: 10, riseMs: 0 } });
    runUntilBreath(sim, 10);
    const b = sim.breaths.at(-1)!;
    const esperada = 15 * b.vtInsp;
    expect(Math.abs(b.energyInspJ! / JOULES_PER_CMH2O_L - esperada) / esperada).toBeLessThan(0.01);
  });
});

describe('POT-03 · calidad: en espera no hay dato; antes de dos respiraciones, en curso', () => {
  it('sigue la ventana de FR y VMesp', () => {
    const sim = benchSim();
    runUntilBreath(sim, 1);
    expect(sim.frame().metrics.mechPower!.quality).toBe('inProgress');
    runUntilBreath(sim, 3);
    expect(sim.frame().metrics.mechPower!.quality).toBe('valid');
    sim.command({ type: 'enterStandby' });
    sim.step();
    expect(sim.frame().metrics.mechPower!.quality).toBe('unavailable');
  });
});
