/** Estado de la lección (objetivos cumplidos, banderas y marcas de tiempo), su pintado en el panel docente y sus avisos. */
import type { AppContext, LessonTracker } from './context';
import { $, esc, icon, put } from './dom';
import { avisoDeObjetivo, nextCompletedTask, tareasCumplidasAlAbrir } from './lesson';

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
    put('#reflection-question', scenario.question ?? '¿Qué observar?');
    put('#reflection-answer', scenario.answer ?? scenario.observe);
    const tasks = l?.tasks ?? [];
    put('#lesson-count', sessionImported ? 'Sesión importada: sus objetivos no se evalúan' : `${done.size} de ${tasks.length} objetivos`);
    // La pestaña dice cuánto falta sin tener que abrirla.
    put('[data-instructor="learn"]', tasks.length && !sessionImported ? `Entrenar · ${done.size}/${tasks.length}` : 'Entrenar');
    $('#lesson-tasks').innerHTML = tasks
      .map(
        (task, i) =>
          `<div class="task ${done.has(task.id) ? 'complete' : ''}"><span class="task-check">${done.has(task.id) ? icon('check') : i + 1}</span><span>${esc(task.text)}</span></div>`,
      )
      .join('');
    $('#lesson-feedback').hidden = tasks.length === 0 || done.size !== tasks.length;
  }
  return {
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
            flags,
          })
        : new Set();
      render();
    },
    render,
    evaluate() {
      const frame = ctx.frame,
        scenario = ctx.scenario;
      if (!frame || !scenario.lesson || ctx.fixtureId || sessionImported) return;
      const tasks = scenario.lesson.tasks;
      const task = nextCompletedTask(tasks, done, {
        frame,
        scenarioId: scenario.id,
        lessonStartMs,
        patientChangeMs,
        settingsChangeMs,
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
  };
}
