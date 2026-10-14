import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { defaultInit, REFERENCE_PROFILE } from '../../src/profiles';

// TMP-01 · la temporización de la respiración cuando algo la interrumpe. Las obligatorias van «at intervals based on the
// set respiratory rate» (URM SW10 5-11 y 5-13; R23: «a una frecuencia respiratoria programada»): si Pmáx acorta la
// inspiración, la siguiente llega igual a su hora y el tiempo no usado va a la espiración (U-26). Tras un bloqueo —cuyo
// efecto en el temporizador no publica ninguna fuente leída (U-21, P)—: el inspiratorio deja después una espiración de
// Texp completo y el espiratorio, al terminar, da paso a la siguiente.

const T_CICLO = 4; // FR 15
function correr(extra: object, bloqueo?: 'inspHold' | 'expHold') {
  const base = defaultInit({});
  const sim = new Simulator(
    defaultInit({
      patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
      settings: { ...base.settings, mode: 'AC_VC', vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 100, pausePct: 0, ...extra },
      initialV: 'equilibrium',
    }),
    REFERENCE_PROFILE,
  );
  let pedido = false;
  while (sim.simTimeMs < 30_000) {
    sim.step();
    if (bloqueo && !pedido && sim.simTimeMs >= 8_100) {
      sim.command({ type: 'requestHold', kind: bloqueo, durationS: 2 });
      pedido = true;
    }
  }
  return sim.breaths.map((b) => b.startSimTimeMs / 1000);
}
const intervalos = (t: number[]): number[] => t.slice(1).map((x, i) => Math.round((x - t[i]!) * 1000) / 1000);

describe('TMP-01 · la respiración siguiente llega a su hora', () => {
  it('Pmáx acorta cada inspiración y las obligatorias siguen cada 60/FR s', () => {
    const t = correr({ pmax: 16 });
    expect(intervalos(t)).toEqual(Array(t.length - 1).fill(T_CICLO));
  });
  it('bloqueo inspiratorio de 2 s: Ti + bloqueo + Texp completo; después, el ritmo de siempre', () => {
    const iv = intervalos(correr({}, 'inspHold'));
    expect(iv).toContain(1 + 2 + 3);
    expect(iv.filter((x) => x !== T_CICLO)).toEqual([6]);
  });
  it('bloqueo espiratorio de 2 s: al terminar empieza la siguiente', () => {
    const iv = intervalos(correr({}, 'expHold'));
    expect(iv.filter((x) => x !== T_CICLO)).toEqual([6]);
  });
});
