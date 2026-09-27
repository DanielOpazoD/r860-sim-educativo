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
  assisted: (c) => !!c.flags.assistedSeen,
  anyHold: (c) => {
    const h = c.frame.procedure.last.inspHold;
    return !!h && after(h, c.lessonStartMs);
  },
  alarmSeen: (c) => !!c.flags.alarmSeen,
  acknowledged: (c) => c.frame.alarms.some((a) => a.acknowledgedAtMs !== null),
  alarmCleared: (c) => !!c.flags.alarmSeen && c.frame.alarmBar.color === 'green',
  truthOpen: (c) => !!c.flags.truthOpen,
  /** Ha medido una meseta corta y otra larga, y la larga resultó más baja: es el efecto del pendelluft. */
  plateauDropSeen: (c) => {
    // «Corta» es la más corta que el equipo acepta como meseta válida. Con dos unidades muy dispares, una oclusión de
    // 2 o 3 s se rechaza por inestable —correctamente: la presión sigue cayendo—, así que exigir ≤ 3 s hacía el
    // objetivo imposible por construcción. La comparación docente sigue siendo la misma: corta contra larga.
    const hs = (c.flags.inspHolds as { d: number; p: number }[] | undefined) ?? [];
    const corto = hs.filter((h) => h.d <= 5);
    const largo = hs.filter((h) => h.d >= 10);
    return corto.some((a) => largo.some((b) => b.p < a.p - 0.5));
  },
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
  referenceWave: (c) => !!c.flags.referenceWave,
  snapshot: (c) => !!c.flags.snapshot,
  vtNear430: (c) => c.frame.settings.mode === 'AC_PC' && Math.abs((c.frame.metrics.vte?.value ?? 0) - 0.432) < 0.02,
  vtDropPc: (c) =>
    c.frame.settings.mode === 'AC_PC' &&
    c.frame.simTimeMs > 30_000 &&
    (c.frame.metrics.vte?.value ?? 1) < 0.38 &&
    Math.abs((c.frame.metrics.ppeak?.value ?? 0) - 15) < 0.5,
  ieOne: (c) => c.frame.settings.mode === 'AC_PC' && Math.abs(c.frame.settings.ie - 1) < 1e-6,
  /** CPAP/PS (SC-19): ya hubo respiraciones espontáneas —del paciente, cicladas por flujo—. */
  spontSeen: (c) => c.frame.settings.mode === 'CPAP_PS' && !!c.flags.spontSeen,
  /** PS ≥ 15 y el VT lo acusa: con C 50 y Pmus 8, de ≈ 570 a ≈ 750 mL. */
  psRaised: (c) => c.frame.settings.mode === 'CPAP_PS' && c.frame.settings.psupport >= 15 && (c.frame.metrics.vte?.value ?? 0) > 0.65,
  /** Hubo apnea (alarma vista) y ya se resolvió: el paciente volvió a disparar. */
  apneaRecovered: (c) => !!c.flags.apneaSeen && !c.frame.alarms.some((a) => a.id === 'apnea' && a.conditionActive),
  /** SC-20: la inspiración del ventilador dura claramente más que el esfuerzo (Ti neural). */
  lateCycling: (c) => {
    const ti = ultimoTiEspontaneo(c.frame);
    return c.frame.settings.mode === 'CPAP_PS' && ti !== null && ti >= c.frame.truth.effort.tiS + 0.2;
  },
  ets50: (c) => c.frame.settings.mode === 'CPAP_PS' && c.frame.settings.expTriggerPct >= 0.5,
  /** SC-21: un bloqueo válido de ESTA lección muestra una ΔP estática de 15 o más. */
  dpHigh: (c) => {
    const h = c.frame.procedure.last.inspHold;
    return !!h && h.quality === 'valid' && after(h, c.lessonStartMs) && (h.values.driving?.value ?? 0) >= 15;
  },
  /** Tras cambiar ajustes, un bloqueo válido con ΔP estática por debajo de 15 y el VT ya reducido. */
  dpProtective: (c) => {
    const h = c.frame.procedure.last.inspHold;
    return (
      !!h &&
      h.quality === 'valid' &&
      c.settingsChangeMs >= 0 &&
      (h.completedAtMs ?? 0) > c.settingsChangeMs &&
      (h.values.driving?.value ?? 99) < 15 &&
      c.frame.settings.vt <= 0.4
    );
  },
  /** SC-22: la fuga se ve en la tabla: más del 15 % del VT inspirado no vuelve. */
  leakSeen: (c) => (c.frame.metrics.leakPct?.value ?? 0) >= 0.15,
  /** Disparo por flujo subido a 4 L/min o más: por encima de la fuga a la PEEP, el autodisparo cesa. */
  trigger4: (c) => !c.frame.settings.triggerByPressure && c.frame.settings.flowTrigger >= 4 / 60 - 1e-9,
  /** SC-23: se vio la alarma de desconexión. */
  disconnectSeen: (c) => !!c.flags.disconnectSeen,
  /** Reconectado: la alarma de desconexión se vio y ya no está activa. */
  reconnected: (c) => !!c.flags.disconnectSeen && !c.frame.alarms.some((a) => a.id === 'disconnect' && a.conditionActive),
  /** SC-25: la fracción reclutada del modelo llegó al 90 % (PEEP por encima de la presión de apertura). */
  recruitedFull: (c) => c.frame.truth.recruited >= 0.9,
  /**
   * SC-25: a PEEP baja (≤ 12) hay al menos dos puntos de titulación y el mejor supera en un 30 % al peor. A la
   * misma consigna el pulmón devuelve compliances distintas según el camino recorrido: es la histéresis medida.
   */
  cstatDecremental: (c) => {
    const puntos = (c.flags.titulacion as { peep: number; cstat: number }[] | undefined) ?? [];
    const cs = puntos.filter((p) => p.peep <= 12).map((p) => p.cstat);
    return cs.length >= 2 && Math.max(...cs) >= 1.3 * Math.min(...cs);
  },
  /** La potencia mecánica de la ventana bajó de 15 J/min con el VT reducido. */
  mpBelow: (c) => c.frame.settings.vt <= 0.4 && (c.frame.metrics.mechPower?.value ?? 99) < 15,
  /** Con el ciclaje subido, el Ti mecánico ya no supera al esfuerzo. */
  cyclingFixed: (c) => {
    const ti = ultimoTiEspontaneo(c.frame);
    return (
      c.frame.settings.mode === 'CPAP_PS' && c.frame.settings.expTriggerPct >= 0.5 && ti !== null && ti <= c.frame.truth.effort.tiS + 0.1
    );
  },
};

/** Banderas que se activan al observar el cuadro (sesgo del sensor, alarma activa vista). */
export function updateLessonFlags(frame: EngineFrame, flags: Record<string, unknown>): void {
  if (frame.truth.sensors.fio2Bias !== 0) flags.biasWasSet = true;
  if (frame.alarms.some((a) => a.conditionActive)) flags.alarmActiveSeen = true;
  // Una respiración asistida se cuenta cuando ocurre. Antes se deducía de que la FR MEDIA superara a la programada,
  // que es otra cosa: con la ventana móvil de ocho respiraciones hacen falta muchos disparos seguidos para moverla,
  // así que el objetivo parecía roto aunque el alumno hubiera conseguido lo que se le pedía.
  for (const e of frame.eventsTail) {
    const tipo = e.kind === 'breath' ? (e.payload as { type?: string }).type : undefined;
    if (tipo === 'assisted') flags.assistedSeen = true;
    if (tipo === 'spontaneous') flags.spontSeen = true;
  }
  if (frame.alarms.some((a) => a.id === 'apnea' && a.conditionActive)) flags.apneaSeen = true;
  if (frame.alarms.some((a) => a.id === 'disconnect' && a.conditionActive)) flags.disconnectSeen = true;
}

/** Duración de la última inspiración espontánea registrada (s), o null si no hay ninguna en la cola de eventos. */
function ultimoTiEspontaneo(frame: EngineFrame): number | null {
  for (let i = frame.eventsTail.length - 1; i >= 0; i--) {
    const e = frame.eventsTail[i] as EngineFrame['eventsTail'][number];
    if (e.kind !== 'breath') continue;
    const p = e.payload as { type?: string; tInspS?: number };
    if (p.type === 'spontaneous' && typeof p.tInspS === 'number') return p.tInspS;
  }
  return null;
}

/**
 * Evalúa TODOS los objetivos pendientes y devuelve el primero que acaba de cumplirse.
 * No marca nada: el llamador decide cómo registrar y anunciar.
 *
 * Antes se evaluaba sólo el primer pendiente y se devolvía sin mirar los demás. La lista está numerada y se recorre
 * en orden, pero eso es una sugerencia, no una cerradura: con esa regla un objetivo imposible —o simplemente uno que
 * el alumno resuelve más tarde— dejaba muertos a todos los que venían detrás.
 */
export function nextCompletedTask(tasks: LessonTask[], done: Set<string>, ctx: LessonContext): LessonTask | null {
  updateLessonFlags(ctx.frame, ctx.flags);
  for (const task of tasks) {
    if (done.has(task.id)) continue;
    if (LESSON_TESTS[task.test]?.(ctx)) return task;
  }
  return null;
}

/**
 * Objetivos que ya se cumplen con el primer cuadro de la lección: se marcan, pero no se anuncian.
 *
 * Varios escenarios traen un objetivo que es una observación sobre el estado inicial —«observa VTesp ≈ 430 mL»— y
 * felicitar por él al abrir sería felicitar por no haber hecho nada. Antes se resolvía callando los primeros 5 s de
 * tiempo simulado, y eso también callaba al alumno que hacía su primer bloqueo nada más abrir. La regla correcta no
 * depende del reloj: se calla exactamente lo que ya estaba cumplido antes de que el alumno tocara nada.
 */
export function tareasCumplidasAlAbrir(tasks: LessonTask[], ctx: LessonContext): Set<string> {
  updateLessonFlags(ctx.frame, ctx.flags);
  return new Set(tasks.filter((task) => LESSON_TESTS[task.test]?.(ctx)).map((task) => task.id));
}

/** Qué decirle al alumno cuando cumple un objetivo por sí mismo. */
export function avisoDeObjetivo(p: { numero: number; total: number; cumplidos: number; texto: string }): string {
  if (p.total > 0 && p.cumplidos >= p.total) return 'Secuencia completada: repásala en Sesión › Resumen de práctica.';
  const texto = p.texto.length > 90 ? `${p.texto.slice(0, 89).trimEnd()}…` : p.texto;
  return `Objetivo ${p.numero} de ${p.total} cumplido: ${texto}`;
}
