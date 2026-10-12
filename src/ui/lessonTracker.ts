/** Estado de la sesión docente: banderas e instantes que leen los criterios de los casos, y la reflexión del escenario. */
import type { AppContext, LessonTracker } from './context';
import { put } from './dom';
import { updateLessonFlags } from './lesson';

export function createLessonTracker(ctx: AppContext): LessonTracker {
  const flags: Record<string, unknown> = {};
  let lessonStartMs = 0,
    patientChangeMs = -1,
    settingsChangeMs = -1;
  // Una sesión importada no dice de qué escenario es: evaluar contra ella el caso que estaba abierto juzgaría al alumno
  // por algo que no hizo. Hasta que se cargue un escenario, no se evalúa nada.
  let sessionImported = false;
  function render(): void {
    const scenario = ctx.scenario;
    put('#reflection-question', scenario.question ?? '¿Qué observar?');
    put('#reflection-answer', scenario.answer ?? scenario.observe);
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
    reset() {
      for (const k of Object.keys(flags)) delete flags[k];
      lessonStartMs = ctx.frame?.simTimeMs ?? 0;
      patientChangeMs = -1;
      settingsChangeMs = -1;
      render();
    },
    render,
    evaluate() {
      // Las prácticas guiadas antiguas quedan como datos para futuros casos: no se evalúan ni se anuncian. Sólo se
      // registra la historia que leen los criterios de los casos clínicos (disparos, reclutamiento, alarmas).
      if (ctx.frame && !ctx.fixtureId && !sessionImported) updateLessonFlags(ctx.frame, flags);
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
