import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { R860_PROFILE, defaultInit } from '../../src/profiles';
import { SCENARIOS } from '../../src/scenarios';

// BM-RT · disparo reverso (SC-24): la Pmus evocada queda fase-bloqueada a la insuflación; con latencia larga
// sobrevive al ciclado y dispara respiraciones asistidas apiladas por el mecanismo normal.
function simSC24(): Simulator {
  const e = SCENARIOS.find((s) => s.id === 'SC-24')!;
  const base = defaultInit({});
  return new Simulator(
    defaultInit({
      patient: { ...e.patient },
      effort: { ...e.effort, reverse: e.effort.reverse ? { ...e.effort.reverse } : undefined },
      sensors: { ...e.sensors },
      settings: { ...base.settings, ...(e.settings ?? {}) },
      initialV: e.initialV ?? 'equilibrium',
    }),
    R860_PROFILE,
  );
}

/** Avanza `ms` muestreando Pmus cada paso; devuelve los instantes (s) de máximo de cada respiración terminada. */
function correr(sim: Simulator, ms: number): { t: Float64Array; pmus: number[] } {
  const t = new Float64Array(Math.ceil(ms / sim.clock.dtMs) + 8);
  const pmus: number[] = [];
  const t0 = sim.simTimeMs;
  while (sim.simTimeMs - t0 < ms) {
    sim.step();
    t[pmus.length] = sim.simTimeMs / 1000;
    pmus.push(sim.frame().truth.pmus);
  }
  return { t, pmus };
}

describe('BM-RT · disparo reverso en SC-24', () => {
  it('con latencia 0,5 s la Pmus máxima de cada ciclo cae a inicio+0,5+0,8 ±0,02 s y todas las respiraciones son mandatory', () => {
    const sim = simSC24();
    const { t, pmus } = correr(sim, 30_000);
    const mand = sim.breaths.filter((b) => b.type === 'mandatory').slice(-5);
    expect(mand.length).toBe(5);
    for (const b of mand) {
      // argmax de Pmus dentro de la ventana de la respiración
      let iMax = -1,
        vMax = -1;
      for (let i = 0; i < pmus.length; i++)
        if (t[i]! >= b.startSimTimeMs / 1000 && t[i]! <= b.endSimTimeMs / 1000 && pmus[i]! > vMax) {
          vMax = pmus[i]!;
          iMax = i;
        }
      expect(vMax).toBeCloseTo(8, 1);
      expect(Math.abs(t[iMax]! - (b.startSimTimeMs / 1000 + 0.5 + 0.8))).toBeLessThanOrEqual(0.02);
    }
    expect(sim.breaths.every((b) => b.type === 'mandatory')).toBe(true);
  });

  it('con latencia 1,4 s aparece alguna respiración asistida apilada (< 0,6 s tras el fin de la inspiración previa)', () => {
    const sim = simSC24();
    correr(sim, 5_000); // unas respiraciones mandatory con delay 0,5
    sim.command({ type: 'setEffort', params: { reverse: { amplitude: 8, delayS: 1.4 } } });
    correr(sim, 30_000);
    const asistidas = sim.breaths.filter((b) => b.type === 'assisted');
    expect(asistidas.length).toBeGreaterThanOrEqual(1);
    const a = asistidas[0]!;
    const prev = sim.breaths.filter((b) => b.endSimTimeMs <= a.startSimTimeMs).at(-1)!;
    const finInspPreviaS = (prev.startSimTimeMs + prev.tInspS * 1000) / 1000;
    expect(a.startSimTimeMs / 1000 - finInspPreviaS).toBeLessThan(0.6);
  });

  it('sin `reverse` las trazas de Pva son idénticas a las del esfuerzo apagado sin reverse', () => {
    const con = simSC24(); // reverse {8, 0.5} no toca a un paciente que no evoca…
    con.command({ type: 'setEffort', params: { reverse: undefined } });
    const e = SCENARIOS.find((s) => s.id === 'SC-24')!;
    const base = defaultInit({});
    const sin = new Simulator(
      defaultInit({
        patient: { ...e.patient },
        effort: { ...e.effort, reverse: undefined },
        sensors: { ...e.sensors },
        settings: { ...base.settings, ...(e.settings ?? {}) },
        initialV: e.initialV ?? 'equilibrium',
      }),
      R860_PROFILE,
    );
    const pawA: number[] = [],
      pawB: number[] = [];
    for (let i = 0; i < 5000; i++) {
      con.step();
      sin.step();
      pawA.push(con.frame().live.paw);
      pawB.push(sin.frame().live.paw);
    }
    expect(pawA).toEqual(pawB);
  });
});
