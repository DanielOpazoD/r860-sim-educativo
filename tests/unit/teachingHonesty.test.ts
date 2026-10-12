import { expect, it } from 'vitest';
import { findScenario } from '../../src/scenarios';
import { LESSON_TESTS, type LessonContext } from '../../src/ui/lesson';
import { tarjetas, estres } from '../../src/ui/teaching';
import { benchSim, runUntilBreath } from '../helpers';
import { Simulator } from '../../src/engine/simulator';
import { defaultInit, REFERENCE_PROFILE } from '../../src/profiles';

for (const [value, expected] of [
  [14.9, 'dentro'],
  [15, 'fuera'],
  [15.1, 'fuera'],
] as const) {
  it(`ΔP mostrada ${value} respeta el criterio exclusivo <15`, () => {
    const sim = benchSim();
    runUntilBreath(sim, 3);
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    sim.run(5000);
    const frame = sim.frame();
    const h = frame.procedure.last.inspHold!;
    expect(h.quality).toBe('valid');
    h.values.driving!.value = value;
    expect(tarjetas(frame).find((t) => t.id === 'driving')?.estado).toBe(expected);
  });
}
it('b≈1 describe la forma global sin excluir procesos regionales', () => {
  const sim = benchSim();
  runUntilBreath(sim, 3);
  const result = estres(sim.frame());
  expect(result.regimen).toBe('recta');
  expect(result.lectura).toContain('no excluye');
  expect(result.lectura).not.toContain('ni sigue reclutándose ni se sobredistiende');
});

it('SC-04 declara práctica del ajuste, sin certificar un efecto', () => {
  const sim = benchSim();
  const ctx: LessonContext = {
    frame: sim.frame(),
    scenarioId: 'SC-04',
    lessonStartMs: 0,
    patientChangeMs: -1,
    settingsChangeMs: -1,
    flags: {},
  };
  expect(LESSON_TESTS.plimitChanged!(ctx)).toBe(false);
  ctx.flags.plimitChanged = true;
  expect(LESSON_TESTS.plimitChanged!(ctx)).toBe(true);
  const text = findScenario('SC-04')!.lesson!.tasks.find((t) => t.id === 'plimit')!.text;
  expect(text).toContain('Practica');
  expect(text).toMatch(/no su efecto/);
});

it('SC-22: el objetivo del disparo exige que el autodisparo cese, no sólo el ajuste', () => {
  const e = findScenario('SC-22')!;
  const sim = new Simulator(
    defaultInit({ patient: e.patient, effort: e.effort, sensors: e.sensors, settings: { ...defaultInit().settings, ...e.settings } }),
    REFERENCE_PROFILE,
  );
  sim.run(30_000);
  expect(sim.breaths.some((b) => b.type === 'assisted')).toBe(true); // la fuga dispara
  const cambio = sim.simTimeMs;
  sim.command({ type: 'confirmSettings', changes: { flowTrigger: 4 / 60 } });
  const ctx = (): LessonContext => ({
    frame: sim.frame(),
    scenarioId: 'SC-22',
    lessonStartMs: 0,
    patientChangeMs: -1,
    settingsChangeMs: cambio,
    flags: {},
  });
  // Recién ajustado todavía no hay tres ciclos que lo demuestren: el ajuste solo no basta.
  expect(LESSON_TESTS.trigger4!(ctx())).toBe(false);
  sim.run(30_000);
  expect(LESSON_TESTS.trigger4!(ctx())).toBe(true);
  // Con un disparo que la fuga sigue superando no se acredita, aunque pase el mismo tiempo.
  const otro = new Simulator(
    defaultInit({ patient: e.patient, effort: e.effort, sensors: e.sensors, settings: { ...defaultInit().settings, ...e.settings } }),
    REFERENCE_PROFILE,
  );
  otro.run(30_000);
  const t2 = otro.simTimeMs;
  otro.command({ type: 'confirmSettings', changes: { flowTrigger: 4 / 60 } });
  otro.command({ type: 'setPatient', params: { leakLpmAt10: 20 } }, 'instructor');
  otro.run(30_000);
  expect(
    LESSON_TESTS.trigger4!({
      frame: otro.frame(),
      scenarioId: 'SC-22',
      lessonStartMs: 0,
      patientChangeMs: -1,
      settingsChangeMs: t2,
      flags: {},
    }),
  ).toBe(false);
});
