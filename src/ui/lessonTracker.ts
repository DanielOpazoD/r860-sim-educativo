/** Estado de la lección (objetivos cumplidos, banderas y marcas de tiempo) y su pintado en el panel docente. */
import type { AppContext, LessonTracker } from './context';
import { $, esc, icon, put } from './dom';
import { nextCompletedTask } from './lesson';

export function createLessonTracker(ctx: AppContext): LessonTracker {
  const done = new Set<string>();
  const flags: Record<string, unknown> = {};
  let lessonStartMs = 0,
    patientChangeMs = -1,
    settingsChangeMs = -1;
  function render(): void {
    const scenario = ctx.scenario;
    const l = scenario.lesson;
    put('#lesson-title', l?.title ?? scenario.name);
    put('#lesson-text', l?.text ?? scenario.description);
    put('#reflection-question', scenario.question ?? '¿Qué observar?');
    put('#reflection-answer', scenario.answer ?? scenario.observe);
    const tasks = l?.tasks ?? [];
    put('#lesson-count', `${done.size} de ${tasks.length} objetivos`);
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
      render();
    },
    render,
    evaluate() {
      const frame = ctx.frame,
        scenario = ctx.scenario;
      if (!frame || !scenario.lesson || ctx.fixtureId) return;
      const task = nextCompletedTask(scenario.lesson.tasks, done, {
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
    },
    noteSettingsChange() {
      settingsChangeMs = ctx.frame?.simTimeMs ?? 0;
    },
    notePatientChange(simTimeMs) {
      patientChangeMs = simTimeMs;
    },
  };
}
