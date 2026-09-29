import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { defaultInit, R860_PROFILE } from '../../src/profiles';
import { SCENARIOS } from '../../src/scenarios';
import { scenariosHTML } from '../../src/ui/dialogs';
import type { LessonContext } from '../../src/ui/lesson';
import { avisoDeObjetivo, LESSON_TESTS, nextCompletedTask, tareasCumplidasAlAbrir } from '../../src/ui/lesson';

// Cumplir un objetivo pasaba en silencio. Estas pruebas fijan cuándo se anuncia y cuándo no: el aviso tiene que llegar
// cuando el alumno consigue algo, y callar sólo para lo que ya estaba cumplido con el primer cuadro de la lección.

/** Primer cuadro visible de un escenario: el motor adelanta 12 s antes de enseñarlo, y la lección empieza ahí. */
function primerCuadro(id: string): { tasks: { id: string; text: string; test: string }[]; ctx: LessonContext } {
  const e = SCENARIOS.find((s) => s.id === id)!;
  const inicial = defaultInit({});
  const sim = new Simulator(
    defaultInit({
      patient: { ...e.patient },
      effort: { ...e.effort },
      sensors: { ...e.sensors },
      settings: { ...inicial.settings, ...(e.settings ?? {}) },
      initialV: e.initialV ?? 'equilibrium',
    }),
    R860_PROFILE,
  );
  sim.run(12_000);
  const frame = sim.frame();
  return {
    tasks: e.lesson!.tasks,
    ctx: { frame, scenarioId: e.id, lessonStartMs: frame.simTimeMs, patientChangeMs: -1, settingsChangeMs: -1, flags: {} },
  };
}

describe('Catálogo de escenarios', () => {
  it('destaca ocho casos sin ocultar los demás ni mezclar la referencia fotográfica', () => {
    const html = scenariosHTML(SCENARIOS, 'SC-01', () => 'A/C VC');
    const start = html.split('id="scenario-all"')[0]!;
    expect(start.match(/data-scenario="SC-/g)).toHaveLength(8);
    expect(html.match(/data-scenario="SC-/g)).toHaveLength(SCENARIOS.length + 8);
    expect(html).toContain('data-scenario="SC-P"');
    expect(html).toContain('id="scenario-topic"');
    expect(html).toContain('data-scenario-view="all"');
  });
});

describe('LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir', () => {
  const base = { numero: 2, total: 3, cumplidos: 2, texto: 'Duplica la resistencia inspiratoria hasta ≥ 20.' };

  it('dice cuál es y cuántos van', () => {
    expect(avisoDeObjetivo(base)).toBe('Objetivo 2 de 3 cumplido: Duplica la resistencia inspiratoria hasta ≥ 20.');
  });

  it('el último anuncia la secuencia completa y dónde repasarla', () => {
    expect(avisoDeObjetivo({ ...base, numero: 3, cumplidos: 3 })).toMatch(/Secuencia completada.*Resumen de práctica/);
  });

  it('un objetivo de texto largo cabe en un aviso de una línea', () => {
    const aviso = avisoDeObjetivo({ ...base, texto: 'x'.repeat(200) });
    expect(aviso.endsWith('…')).toBe(true);
    expect(aviso.length).toBeLessThan(130);
  });

  it('en SC-01 nada se cumple al abrir: el primer bloqueo se anuncia aunque llegue en el primer segundo', () => {
    // La regla anterior callaba los primeros 5 s de tiempo simulado, y con ella un bloqueo pedido nada más abrir
    // terminaba dentro del silencio. La lista de lo cumplido al abrir no depende del reloj.
    const { tasks, ctx } = primerCuadro('SC-01');
    expect(tareasCumplidasAlAbrir(tasks, ctx).size).toBe(0);
    expect(nextCompletedTask(tasks, new Set(), ctx)).toBeNull();
  });

  it('en SC-13 el primer objetivo ya se cumple con el primer cuadro visible, y sólo ése se calla', () => {
    const { tasks, ctx } = primerCuadro('SC-13');
    const silencio = tareasCumplidasAlAbrir(tasks, ctx);
    expect([...silencio]).toEqual(['vt']);
    // Es exactamente el que el seguimiento marcaría con ese primer cuadro.
    expect(nextCompletedTask(tasks, new Set(), ctx)?.id).toBe('vt');
  });
});

describe('LEC-02 · toda tarea nombra una prueba que existe', () => {
  it('SC-09 no pide deshacer una perturbación automática que no aparece en Eventos', () => {
    const task = SCENARIOS.find((s) => s.id === 'SC-09')!.lesson!.tasks.find((t) => t.id === 'fix')!;
    expect(task.text).toContain('Restablece la mecánica');
    expect(task.text).not.toContain('Deshace');
  });
  it('cada `test` de cada lección está en la tabla de pruebas', () => {
    // La tabla se consulta con `?.`: un nombre mal escrito dejaba un objetivo imposible sin ningún aviso.
    for (const s of SCENARIOS) for (const t of s.lesson?.tasks ?? []) expect(LESSON_TESTS, `${s.id}/${t.id}`).toHaveProperty(t.test);
  });
});
