import { describe, expect, it } from 'vitest';
import { MINUTE_WINDOW_MS } from '../../src/engine/metrics';
import { ALL_METRICS, decimalesMostrados, limiteEnAlarma } from '../../src/ui/metricsTable';
import { DEFAULT_ALARM_LIMITS } from '../../src/profiles/adulto-referencia/settings';
import { BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// MON · los números del monitor se filtran y se muestran como en el equipo (URM SW10 2065490-001, 13-22 a 13-24).

describe('MON · FR y VMesp: el último minuto más una respiración', () => {
  it('la ventana cubre un minuto entero y no más de una respiración de sobra, a cualquier FR', () => {
    for (const rr of [10, 15, 30]) {
      const sim = benchSim({ settings: { ...BENCH_SETTINGS, rr } });
      sim.run(120_000);
      const m = sim.frame().metrics;
      const ciclo = 60_000 / rr;
      expect(m.rr!.windowMs!, `FR ${rr}`).toBeGreaterThanOrEqual(MINUTE_WINDOW_MS);
      expect(m.rr!.windowMs!, `FR ${rr}`).toBeLessThan(MINUTE_WINDOW_MS + ciclo + 1);
      expect(m.rr!.value!).toBeCloseTo(rr, 6);
    }
  });

  it('tras bajar el VT, el VMesp tarda un minuto en asentarse: a los 30 s va por la mitad del camino', () => {
    const sim = benchSim();
    sim.run(90_000);
    const antes = sim.frame().metrics.mve!.value!;
    expect(antes).toBeCloseTo(0.5 * 15, 1);
    sim.command({ type: 'confirmSettings', changes: { vt: 0.3 } });
    runUntilBreath(sim, sim.breaths.length + 1);
    const t0 = sim.simTimeMs;
    while (sim.simTimeMs < t0 + 30_000) sim.step();
    const medio = sim.frame().metrics.mve!.value!;
    expect(medio).toBeLessThan(antes - 1);
    expect(medio).toBeGreaterThan(0.3 * 15 + 1);
    while (sim.simTimeMs < t0 + 65_000) sim.step();
    expect(sim.frame().metrics.mve!.value!).toBeCloseTo(0.3 * 15, 1);
  });
});

describe('MON · resolución de pantalla del equipo', () => {
  const spec = (k: string) => ALL_METRICS.find((m) => m.key === k)!;
  it('VMesp en pasos de 0,01 hasta 1 L/min y de 0,1 desde ahí; VT en pasos de 0,1 mL bajo 50', () => {
    expect(decimalesMostrados(spec('mve'), 0.85)).toBe(2);
    expect(decimalesMostrados(spec('mve'), 6.1)).toBe(1);
    expect(decimalesMostrados(spec('mveSpont'), 0)).toBe(2);
    expect(decimalesMostrados(spec('mveSpont'), 5.3)).toBe(1);
    expect(decimalesMostrados(spec('vte'), 45)).toBe(1);
    expect(decimalesMostrados(spec('vte'), 450)).toBe(0);
    expect(decimalesMostrados(spec('ppeak'), 20)).toBe(0);
  });
});

describe('MON · en alarma, el límite violado se muestra junto al valor', () => {
  const spec = (k: string) => ALL_METRICS.find((m) => m.key === k)!;
  it('VTesp bajo el límite de 600 mL: la casilla dice «Mín. 600»; sin alarma, nada', () => {
    const sim = benchSim({ alarmLimits: { ...DEFAULT_ALARM_LIMITS, vteLow: 0.6 } });
    runUntilBreath(sim, 2);
    expect(limiteEnAlarma(sim.frame(), spec('vte'))).toBeNull(); // aún no van tres respiraciones bajo el límite
    runUntilBreath(sim, 4);
    expect(limiteEnAlarma(sim.frame(), spec('vte'))).toBe('Mín. 600');
    expect(limiteEnAlarma(sim.frame(), spec('ppeak'))).toBeNull();
  });
  it('Pmáx alcanzada: la casilla de Ppico dice «Máx.» con el valor de Pmáx', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    sim.command({ type: 'confirmSettings', changes: { pmax: 15 } });
    runUntilBreath(sim, 5);
    expect(limiteEnAlarma(sim.frame(), spec('ppeak'))).toBe('Máx. 15');
  });
});
