/** Evaluación de objetivos de práctica: tabla de pruebas y banderas de interfaz. Funciones puras sobre el cuadro y el contexto. */
import type { ProcedureResult } from '../domain/types';
import { deriveVcTiming } from '../domain/validation';
import type { EngineFrame } from '../engine/simulator';
import type { LessonTask } from '../scenarios';

export interface LessonContext {
  frame: EngineFrame;
  scenarioId: string;
  lessonStartMs: number;
  patientChangeMs: number;
  settingsChangeMs: number;
  flags: Record<string, unknown>;
}

const after = (r: ProcedureResult | null, since: number): boolean => !!r && (r.completedAtMs ?? -1) >= since;

/** Tabla de pruebas por nombre (`LessonTask.test`). Cada prueba lee el cuadro y las banderas; no muta nada. */
export const LESSON_TESTS: Record<string, (c: LessonContext) => boolean> = {
  validInsp: (c) => {
    const h = c.frame.procedure.last.inspHold;
    return (
      !!h &&
      h.quality === 'valid' &&
      after(h, c.lessonStartMs) &&
      (c.scenarioId !== 'SC-P' || Math.abs((h.requestedDurationS ?? 0) - 3) < 0.02)
    );
  },
  validExp: (c) => {
    const e = c.frame.procedure.last.expHold;
    return !!e && e.quality === 'valid' && after(e, c.lessonStartMs);
  },
  r20: (c) => c.frame.truth.patient.rInsp >= 20,
  holdAfterPatient: (c) => {
    const h = c.frame.procedure.last.inspHold;
    return !!h && h.quality === 'valid' && c.patientChangeMs >= 0 && (h.completedAtMs ?? 0) > c.patientChangeMs;
  },
  holdAfter20: (c) => {
    const h = c.frame.procedure.last.inspHold;
    return !!h && h.quality === 'valid' && (h.completedAtMs ?? 0) > 20_000;
  },
  peepChanged: (c) => c.settingsChangeMs >= 0 && !!c.flags.peepChanged,
  te3: (c) => deriveVcTiming(c.frame.settings).tExpS >= 3,
  expAfterSettings: (c) => {
    const e = c.frame.procedure.last.expHold;
    return !!e && e.quality === 'valid' && c.settingsChangeMs >= 0 && (e.completedAtMs ?? 0) > c.settingsChangeMs;
  },
  vteBelowSet: (c) => (c.frame.metrics.vte?.value ?? 1) < c.frame.settings.vt * 0.9,
  plimitChanged: (c) => !!c.flags.plimitChanged,
  trigger1: (c) => Math.abs(c.frame.settings.flowTrigger * 60 - 1) < 1e-6,
  assisted: (c) => (c.frame.metrics.rr?.value ?? 0) > c.frame.settings.rr + 0.5,
  anyHold: (c) => {
    const h = c.frame.procedure.last.inspHold;
    return !!h && after(h, c.lessonStartMs);
  },
  alarmSeen: (c) => !!c.flags.alarmSeen,
  acknowledged: (c) => c.frame.alarms.some((a) => a.acknowledgedAtMs !== null),
  alarmCleared: (c) => !!c.flags.alarmSeen && c.frame.alarmBar.color === 'green',
  doubleTrigger: (c) => !!c.flags.doubleTrigger,
  peepAtCritical: (c) => {
    const p = c.frame.settings.peep;
    return p !== 'off' && p >= 8;
  },
  cstatOver70: (c) => {
    const h = c.frame.procedure.last.inspHold;
    return !!h && h.quality === 'valid' && (h.values.cstat?.value ?? 0) > 0.07;
  },
  peep18: (c) => {
    const p = c.frame.settings.peep;
    return p !== 'off' && p >= 16 && p <= 20;
  },
  shortHoldInvalid: (c) => {
    const h = c.frame.procedure.last.inspHold;
    return !!h && h.quality === 'invalid' && (h.requestedDurationS ?? 0) <= 2;
  },
  longHoldValid: (c) => {
    const h = c.frame.procedure.last.inspHold;
    return !!h && h.quality === 'valid' && (h.requestedDurationS ?? 0) >= 5;
  },
  invalidHold: (c) => {
    const h = c.frame.procedure.last.inspHold;
    return !!h && h.quality !== 'valid' && after(h, c.lessonStartMs);
  },
  noEffort: (c) => !c.frame.truth.effort.enabled || c.frame.truth.effort.amplitude === 0,
  fio2Gap: (c) => c.frame.settings.fio2 >= 0.99 && (c.frame.metrics.fio2?.value ?? 1) < 0.985,
  fio2Alarm: (c) => c.frame.alarms.some((a) => a.id === 'fio2Low' && a.conditionActive),
  biasZero: (c) => !!c.flags.biasWasSet && c.frame.truth.sensors.fio2Bias === 0,
  basic: (c) => !!c.flags.basic,
  loops: (c) => !!c.flags.loops,
  referenceLoop: (c) => !!c.flags.referenceLoop,
  snapshot: (c) => !!c.flags.snapshot,
  vtNear430: (c) => c.frame.settings.mode === 'AC_PC' && Math.abs((c.frame.metrics.vte?.value ?? 0) - 0.432) < 0.02,
  vtDropPc: (c) =>
    c.frame.settings.mode === 'AC_PC' &&
    c.frame.simTimeMs > 30_000 &&
    (c.frame.metrics.vte?.value ?? 1) < 0.38 &&
    Math.abs((c.frame.metrics.ppeak?.value ?? 0) - 15) < 0.5,
  ieOne: (c) => c.frame.settings.mode === 'AC_PC' && Math.abs(c.frame.settings.ie - 1) < 1e-6,
};

/** Banderas que se activan al observar el cuadro (sesgo del sensor, alarma activa vista). */
export function updateLessonFlags(frame: EngineFrame, flags: Record<string, unknown>): void {
  if (frame.truth.sensors.fio2Bias !== 0) flags.biasWasSet = true;
  if (frame.alarms.some((a) => a.conditionActive)) flags.alarmActiveSeen = true;
}

/**
 * Evalúa SÓLO el primer objetivo pendiente (secuencia guiada) y lo devuelve si acaba de cumplirse.
 * No marca nada: el llamador decide cómo registrar y anunciar.
 */
export function nextCompletedTask(tasks: LessonTask[], done: Set<string>, ctx: LessonContext): LessonTask | null {
  updateLessonFlags(ctx.frame, ctx.flags);
  for (const task of tasks) {
    if (done.has(task.id)) continue;
    return LESSON_TESTS[task.test]?.(ctx) ? task : null;
  }
  return null;
}
