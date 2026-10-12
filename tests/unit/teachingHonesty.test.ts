import { expect, it } from 'vitest';
import { findScenario } from '../../src/scenarios';
import { LESSON_TESTS, type LessonContext } from '../../src/ui/lesson';
import { tarjetas, estres } from '../../src/ui/teaching';
import { benchSim, runUntilBreath } from '../helpers';

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

for (const [id, key, taskId] of [
  ['SC-04', 'plimitChanged', 'plimit'],
  ['SC-22', 'trigger4', 'trig'],
] as const) {
  it(`${id} declara práctica del ajuste, sin certificar un efecto`, () => {
    const sim = benchSim();
    const ctx: LessonContext = {
      frame: sim.frame(),
      scenarioId: id,
      lessonStartMs: 0,
      patientChangeMs: -1,
      settingsChangeMs: -1,
      flags: {},
    };
    expect(LESSON_TESTS[key]!(ctx)).toBe(false);
    if (id === 'SC-04') ctx.flags.plimitChanged = true;
    else ctx.frame.settings.flowTrigger = 4 / 60;
    // Aún no hay un solo ciclo ni una ventana para evaluar un efecto: sólo se acredita el ajuste.
    expect(ctx.frame.breathCount).toBe(0);
    expect(LESSON_TESTS[key]!(ctx)).toBe(true);
    const text = findScenario(id)!.lesson!.tasks.find((t) => t.id === taskId)!.text;
    expect(text).toContain('Practica');
    expect(text).toMatch(/no su efecto|no que haya cesado/);
  });
}
