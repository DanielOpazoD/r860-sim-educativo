/**
 * Evaluación de casos clínicos: funciones puras sobre el cuadro, como las pruebas de lección, pero sobre RESULTADOS
 * (varias soluciones válidas) y con umbrales por caso. La verdad del modelo (esfuerzo, auto-PEEP verdadera, gasometría)
 * puede usarse para evaluar: no se muestra hasta entregar.
 */
import type { ProcedureResult, VcSettings } from '../domain/types';
import type { CaseCriterion, ClinicalCase } from '../scenarios';
import { LESSON_TESTS, type LessonContext } from './lesson';

export type CaseContext = LessonContext;
type Params = Record<string, number>;
type CaseTest = (c: CaseContext, p: Params) => boolean;

/** Ventana con que se juzga la sincronía (s): un minuto de respiraciones posteriores al último ajuste. */
export const SYNC_WINDOW_S = 60;

const despues = (r: ProcedureResult | null, desde: number): boolean => !!r && (r.completedAtMs ?? -1) >= desde;
/** Bloqueo útil como mecánica pasiva, medido después del último ajuste (o del inicio del caso). */
function bloqueo(c: CaseContext, kind: 'inspHold' | 'expHold'): ProcedureResult | null {
  const h = c.frame.procedure.last[kind];
  const desde = Math.max(c.lessonStartMs, c.settingsChangeMs);
  return h && h.quality === 'valid' && h.passiveMechanicsValid !== false && despues(h, desde) ? h : null;
}
/** Respiraciones del último minuto, sólo si todo el minuto es posterior al último ajuste; si no, null. */
function ventana(c: CaseContext): { type: string; tInspS: number }[] | null {
  const ahora = c.frame.simTimeMs;
  const desde = ahora - SYNC_WINDOW_S * 1000;
  if (desde < Math.max(c.lessonStartMs, c.settingsChangeMs)) return null;
  return c.frame.trends.filter((t) => t.tMs > desde);
}
const phEquilibrio = (c: CaseContext): number | null => {
  const g = c.frame.truth.gas;
  return g ? g.phTarget : null;
};

export const CASE_TESTS: Record<string, CaseTest> = {
  /** Midió una meseta válida (bloqueo inspiratorio) tras el último ajuste. */
  inspHold: (c) => bloqueo(c, 'inspHold') !== null,
  /** Midió la PEEP total (bloqueo espiratorio) tras el último ajuste. */
  expHold: (c) => bloqueo(c, 'expHold') !== null,
  /** VT programado ≤ p.mlPerKg × p.pbw (mL). */
  vtMaxPerKg: (c, p) => c.frame.settings.vt * 1000 <= p.mlPerKg! * p.pbw! + 1e-6,
  /** VT espirado ≥ p.mlPerKg × p.pbw (mL): el soporte no se quedó corto. */
  vteMinPerKg: (c, p) => (c.frame.metrics.vte?.value ?? 0) * 1000 >= p.mlPerKg! * p.pbw!,
  /** Pplat del último bloqueo válido ≤ p.max. */
  pplatMax: (c, p) => {
    const v = bloqueo(c, 'inspHold')?.values.pplat?.value;
    return typeof v === 'number' && v <= p.max!;
  },
  /** Presión motriz del último bloqueo válido < p.max. */
  drivingBelow: (c, p) => {
    const v = bloqueo(c, 'inspHold')?.values.driving?.value;
    return typeof v === 'number' && v < p.max!;
  },
  /** Auto-PEEP verdadera del modelo ≤ p.max. */
  autoPeepMax: (c, p) => c.frame.truth.peepiEndExp <= p.max!,
  /**
   * PEEP total medida (último bloqueo espiratorio válido tras el último ajuste) ≤ p.max. Con limitación al flujo la
   * diferencia PEEPtot − PEEP baja con sólo subir la PEEP externa, sin desinflar nada: lo que mide el atrapamiento es la total.
   */
  peepTotMax: (c, p) => {
    const v = bloqueo(c, 'expHold')?.values.peepTot?.value;
    return typeof v === 'number' && v <= p.max!;
  },
  /** pH de equilibrio con la ventilación actual en [p.min, p.max]. */
  phEqRange: (c, p) => {
    const ph = phEquilibrio(c);
    return ph !== null && ph >= p.min! && ph <= p.max!;
  },
  /** PaCO₂ de equilibrio con la ventilación actual en [p.min, p.max]. */
  paco2EqRange: (c, p) => {
    const v = c.frame.truth.gas?.paco2Target ?? null;
    return v !== null && v >= p.min! && v <= p.max!;
  },
  /**
   * Hay una Cstat medida (bloqueo pasivo, anotado en la titulación) antes de la primera apertura completa. Se lee de la
   * historia: al entregar, el último bloqueo ya es el posterior a la apertura.
   */
  cstatBeforeOpening: (c) => {
    const hist = (c.flags.titulacion as { t?: number }[] | undefined) ?? [];
    const tRec = c.flags.recruitedAltaMs as number | undefined;
    return hist.some((p) => p.t !== undefined && p.t >= c.lessonStartMs && (tRec === undefined || p.t < tRec));
  },
  /** PEEP programada ≥ p.min. */
  peepMin: (c, p) => c.frame.settings.peep !== 'off' && c.frame.settings.peep >= p.min!,
  /** Frecuencia programada ≤ p.max. */
  rrMax: (c, p) => c.frame.settings.rr <= p.max!,
  /** En el último minuto disparan al menos p.fraction de los esfuerzos del paciente. */
  effortsTriggered: (c, p) => {
    const w = ventana(c);
    const e = c.frame.truth.effort;
    return !!w && e.enabled && w.length >= p.fraction! * e.ratePerMin;
  },
  /** Ti mecánico medio del último minuto ≤ Ti neural + p.maxS (sin ciclado tardío). */
  cyclingDelayMax: (c, p) => {
    const w = ventana(c);
    if (!w || !w.length) return false;
    const media = w.reduce((s, b) => s + b.tInspS, 0) / w.length;
    return media - c.frame.truth.effort.tiS <= p.maxS!;
  },
  /** Sin autodisparo: las tres últimas respiraciones tras el último ajuste no fueron asistidas (esfuerzo apagado). */
  noAutotrigger: (c) => {
    if (c.settingsChangeMs < 0) return false;
    const ultimas = c.frame.trends.filter((t) => t.tMs > c.settingsChangeMs).slice(-3);
    return ultimas.length === 3 && ultimas.every((t) => t.type !== 'assisted');
  },
  /** Disparo por flujo ≤ p.maxLpm (no se insensibiliza de más). */
  flowTriggerMax: (c, p) => !c.frame.settings.triggerByPressure && c.frame.settings.flowTrigger * 60 <= p.maxLpm! + 1e-9,
};

export interface CriterionResult {
  id: string;
  text: string;
  ok: boolean;
}
export interface CaseResult {
  criteria: CriterionResult[];
  /** Opción elegida y si era correcta (sólo diagnóstico). */
  answer: { id: string; ok: boolean } | null;
  passed: boolean;
  atSimMs: number;
  /** Programación al entregar: el desarrollo la compara con la del inicio y con la solución. */
  settings: VcSettings;
}

function cumple(criterion: CaseCriterion, c: CaseContext): boolean {
  if (criterion.test.startsWith('lesson:')) return LESSON_TESTS[criterion.test.slice(7)]?.(c) ?? false;
  const test = CASE_TESTS[criterion.test];
  if (!test) throw new Error(`Prueba de caso desconocida: ${criterion.test}`);
  return test(c, criterion.params ?? {});
}

export function evaluateCase(spec: ClinicalCase, c: CaseContext, answerId: string | null): CaseResult {
  const criteria = spec.criteria.map((cr) => ({ id: cr.id, text: cr.text, ok: cumple(cr, c) }));
  const option = spec.kind === 'diagnostico' ? spec.options?.find((o) => o.id === answerId) : undefined;
  const answer = option ? { id: option.id, ok: option.correct } : null;
  const passed = criteria.every((x) => x.ok) && (spec.kind === 'ajuste' || !!answer?.ok);
  return { criteria, answer, passed, atSimMs: c.frame.simTimeMs, settings: { ...c.frame.settings } };
}
