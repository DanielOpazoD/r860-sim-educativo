import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { REFERENCE_PROFILE, defaultInit } from '../../src/profiles';
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
    REFERENCE_PROFILE,
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
  it('el umbral del apilamiento sale de la mecánica: con la rama espiratoria del equipo, latencia entre 0,7 y 0,8 s con Pmus 8–9', () => {
    // Baedorf Kassis 2021 (tabla 2): RT a mitad del ciclo con latencia 0,47 s (0,42–0,52) y Pmus 6,7, sin apilar; con
    // apilamiento, 0,68 s (0,63–0,73) y Pmus 7,4 (5,8–9,0). Mecánica de su mediana: elastancia 29, VT 450, FR 30, PEEP 14.
    const apiladas = (amplitude: number, delayS: number): number => {
      const sim = simSC24();
      sim.command({ type: 'setEffort', params: { reverse: { amplitude, delayS } } });
      correr(sim, 20_000);
      return sim.breaths.filter((b) => b.type === 'assisted').length;
    };
    // Pmus 7 todavía no apila con 0,8 s; 8 y 9 sí (Baedorf Kassis: 7,4, IC 5,8–9,0).
    expect(apiladas(7, 0.8)).toBe(0);
    for (const amplitude of [8, 9]) {
      expect(apiladas(amplitude, 0.7), `Pmus ${amplitude}`).toBe(0);
      expect(apiladas(amplitude, 0.8), `Pmus ${amplitude}`).toBeGreaterThan(3);
    }
  });

  it('con latencia 0,5 s (mitad del ciclo, Baedorf Kassis 0,47) la Pmus máxima cae a inicio+0,5+0,8 ±0,02 s y todas son mandatory', () => {
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

  it('con latencia 0,8 s (apilamiento; Baedorf Kassis 0,68) aparecen asistidas que entran sobre un pulmón sin vaciar', () => {
    const sim = simSC24();
    correr(sim, 5_000); // unas respiraciones mandatory con delay 0,5
    sim.command({ type: 'setEffort', params: { reverse: { amplitude: 8, delayS: 0.8 } } });
    correr(sim, 30_000);
    const asistidas = sim.breaths.filter((b) => b.type === 'assisted');
    expect(asistidas.length).toBeGreaterThanOrEqual(1);
    // Apilada: arranca con ≈ 200 mL más en el pulmón que las mandatorias, que sí alcanzan a vaciarse.
    const mandatoria = sim.breaths.filter((b) => b.type === 'mandatory').at(-1)!;
    for (const a of asistidas.slice(-3)) expect(a.truthVStartL - mandatoria.truthVStartL).toBeGreaterThan(0.1);
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
      REFERENCE_PROFILE,
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
