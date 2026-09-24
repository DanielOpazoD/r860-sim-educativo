import { describe, expect, it } from 'vitest';
import type { VcSettings } from '../../src/domain/types';
import { BENCH_SETTINGS, benchSim } from '../helpers';
import type { Simulator } from '../../src/engine/simulator';

// Rampa de primer orden en PC/PS: riseMs es el tiempo hasta ≈95 % del escalón (τ = riseMs/3).
const PC: VcSettings = { ...BENCH_SETTINGS, mode: 'AC_PC', pinsp: 10, peep: 5, riseMs: 200, pmax: 40 };

/** Paw durante la primera inspiración, por tiempo desde el inicio de la fase inspiratoria. */
function inspiracion(sim: Simulator): { t: number; paw: number }[] {
  const tr: { t: number; paw: number }[] = [];
  let t0: number | null = null;
  while (sim.breaths.length < 1) {
    sim.step();
    if (sim.controller.phase === 'inspPressure') {
      if (t0 === null) t0 = sim.controller.simT - sim.clock.dtMs / 1000;
      tr.push({ t: sim.controller.simT - t0, paw: sim.controller.paw });
    }
  }
  return tr;
}

const cerca = (tr: { t: number; paw: number }[], t: number): number =>
  tr.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a)).paw;

describe('Rampa exponencial en PC', () => {
  it('riseMs 200: ≈95 % del escalón a los 0,2 s, ≈63 % a τ = 0,067 s, sin sobrepasar PEEP + Pinsp', () => {
    const tr = inspiracion(benchSim({ settings: PC }));
    const en02 = cerca(tr, 0.2);
    expect(en02).toBeGreaterThanOrEqual(5 + 0.93 * 10);
    expect(en02).toBeLessThanOrEqual(15.01);
    expect(Math.abs(cerca(tr, 0.067) - (5 + 10 * (1 - Math.exp(-1))))).toBeLessThanOrEqual(0.6);
    expect(Math.max(...tr.map((s) => s.paw))).toBeLessThanOrEqual(15.01);
  });

  it('riseMs 0: el escalón es inmediato, la primera muestra ya es PEEP + Pinsp', () => {
    const tr = inspiracion(benchSim({ settings: { ...PC, riseMs: 0 } }));
    expect(tr[0]!.paw).toBeCloseTo(15, 1);
  });
});
