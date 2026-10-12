/** Estado de la lección (objetivos cumplidos, banderas y marcas de tiempo), su pintado en Aula y sus avisos. */
import type { AppContext, LessonTracker } from './context';
import { $, element, iconNode, put } from './dom';
import { avisoDeObjetivo, nextCompletedTask, tareasCumplidasAlAbrir, updateLessonFlags } from './lesson';

export function createLessonTracker(ctx: AppContext): LessonTracker {
  const done = new Set<string>();
  const flags: Record<string, unknown> = {};
  let lessonStartMs = 0,
    patientChangeMs = -1,
    settingsChangeMs = -1;
  // Una sesión importada no dice de qué escenario es: evaluar contra ella los objetivos del escenario que estaba abierto
  // marcaría —y anunciaría— logros que el alumno no ha conseguido. Hasta que se cargue un escenario, no se evalúa nada.
  let sessionImported = false;
  // Lo que ya estaba cumplido con el primer cuadro de la lección se marca sin aviso: no lo consiguió el alumno.
  let alAbrir = new Set<string>();
  function render(): void {
    const scenario = ctx.scenario;
    const l = scenario.lesson;
    put('#lesson-title', l?.title ?? scenario.name);
    put('#lesson-text', l?.text ?? scenario.description);
    put('#lesson-caution', scenario.caution);
    put('#reflection-question', scenario.question ?? '¿Qué observar?');
    put('#reflection-answer', scenario.answer ?? scenario.observe);
    const tasks = l?.tasks ?? [];
    put('#lesson-count', sessionImported ? 'Sesión importada: sus objetivos no se evalúan' : `${done.size} de ${tasks.length} objetivos`);
    $('#lesson-tasks').replaceChildren(
      ...tasks.map((task, i) =>
        element(
          'div',
          `task ${done.has(task.id) ? 'complete' : ''}`,
          element('span', 'task-check', done.has(task.id) ? iconNode('check') : String(i + 1)),
          element('span', '', task.text),
        ),
      ),
    );
    $('#lesson-feedback').hidden = tasks.length === 0 || done.size !== tasks.length;
  }
  // La primera perturbación programada del escenario fija el «antes» aunque la mecánica todavía no haya cambiado.
  const perturbacionMs = (): number | undefined => {
    const ps = ctx.scenario.perturbations ?? [];
    return ps.length ? Math.min(...ps.map((p) => p.atSimTimeMs)) : undefined;
  };
  return {
    get sessionImported() {
      return sessionImported;
    },
    flags,
    done,
    reset() {
      done.clear();
      for (const k of Object.keys(flags)) delete flags[k];
      lessonStartMs = ctx.frame?.simTimeMs ?? 0;
      patientChangeMs = -1;
      settingsChangeMs = -1;
      const tasks = ctx.scenario.lesson?.tasks ?? [];
      alAbrir = ctx.frame
        ? tareasCumplidasAlAbrir(tasks, {
            frame: ctx.frame,
            scenarioId: ctx.scenario.id,
            lessonStartMs,
            patientChangeMs,
            settingsChangeMs,
            perturbationMs: perturbacionMs(),
            flags,
          })
        : new Set();
      render();
    },
    render,
    evaluate() {
      const frame = ctx.frame,
        scenario = ctx.scenario;
      if (!frame || ctx.fixtureId || sessionImported) return;
      // Un caso clínico no tiene objetivos que anunciar, pero sus criterios leen la historia (reclutamiento, disparos).
      if (!scenario.lesson) {
        if (scenario.clinical) updateLessonFlags(frame, flags);
        return;
      }
      const tasks = scenario.lesson.tasks;
      const task = nextCompletedTask(tasks, done, {
        frame,
        scenarioId: scenario.id,
        lessonStartMs,
        patientChangeMs,
        settingsChangeMs,
        perturbationMs: perturbacionMs(),
        flags,
      });
      if (!task) return;
      done.add(task.id);
      render();
      if (alAbrir.has(task.id)) return;
      ctx.toast(avisoDeObjetivo({ numero: tasks.indexOf(task) + 1, total: tasks.length, cumplidos: done.size, texto: task.text }));
    },
    noteSettingsChange() {
      settingsChangeMs = ctx.frame?.simTimeMs ?? 0;
    },
    notePatientChange(simTimeMs) {
      patientChangeMs = simTimeMs;
    },
    setSessionImported(value) {
      sessionImported = value;
      render();
    },
    context() {
      const frame = ctx.frame;
      if (!frame || ctx.fixtureId || sessionImported) return null;
      return {
        frame,
        scenarioId: ctx.scenario.id,
        lessonStartMs,
        patientChangeMs,
        settingsChangeMs,
        perturbationMs: perturbacionMs(),
        flags,
      };
    },
  };
}
