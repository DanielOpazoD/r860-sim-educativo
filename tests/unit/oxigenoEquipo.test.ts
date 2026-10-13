import { describe, expect, it } from 'vitest';
import { FIO2_DISPLAY_AVERAGE_S, O2_MIXER_TAU_S } from '../../src/engine/sensors';
import { BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// O2-URM · la cadena de O2 como la del equipo (URM SW10 2065490-001, 13-21 y 13-24).

describe('O2-URM · mezclador, sensor y pantalla de FiO2', () => {
  it('el mezclador no salta: de 21 a 90 % llega al 90 % del paso en menos de 30 s, no al instante', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, fio2: 0.21 } });
    runUntilBreath(sim, 2);
    sim.command({ type: 'confirmSettings', changes: { fio2: 0.9 } });
    const t0 = sim.simTimeMs;
    const objetivo = 0.21 + 0.9 * (0.9 - 0.21);
    while (sim.o2.delivered < objetivo && sim.simTimeMs < t0 + 60_000) sim.step();
    const s = (sim.simTimeMs - t0) / 1000;
    // «< 6 breaths or 30 seconds, whichever is longer» (13-21): a 15/min, 6 respiraciones son 24 s.
    expect(s).toBeLessThan(30);
    expect(s).toBeGreaterThan(10);
    expect(O2_MIXER_TAU_S).toBeGreaterThan(0);
  });

  it('la FiO2 mostrada es la media móvil de 10 s del sensor: un salto se ve como una rampa de 10 s', () => {
    // Sensor casi instantáneo para leer sólo la media: un cambio de sesgo de +5 % a mitad de camino va por la mitad.
    const sim = benchSim({ sensors: { fio2TauS: 0.1, fio2Bias: 0, flowNoiseFraction: 0 } });
    sim.run(20_000);
    const base = sim.o2.measured;
    sim.command({ type: 'setSensors', params: { fio2TauS: 0.1, fio2Bias: 0.05 } });
    sim.run((FIO2_DISPLAY_AVERAGE_S / 2) * 1000);
    expect(sim.o2.measured - base).toBeGreaterThan(0.02);
    expect(sim.o2.measured - base).toBeLessThan(0.03);
    sim.run((FIO2_DISPLAY_AVERAGE_S / 2) * 1000 + 500);
    expect(sim.o2.measured - base).toBeCloseTo(0.05, 3);
  });
});
