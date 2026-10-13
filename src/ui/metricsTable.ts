/** Tabla de mediciones del monitor: especificación, valor mostrado y calidad. Funciones puras sobre el cuadro. */
import type { MetricSample } from '../domain/types';
import type { EngineFrame } from '../engine/simulator';
import { formatNumber } from '../domain/units';
import { clock, wallDate } from './format';
import { humanReason, QUALITY, SOURCE, SOURCE_SHORT } from './humanize';

export interface MetricSpec {
  key: string;
  label: string;
  unit: string;
  factor: number;
  decimals: number;
  source: 'metric' | 'hold';
}
export const METRICS: MetricSpec[] = [
  { key: 'ppeak', label: 'Ppico', unit: 'cmH₂O', factor: 1, decimals: 0, source: 'metric' },
  { key: 'peepe', label: 'PEEPe', unit: 'cmH₂O', factor: 1, decimals: 0, source: 'metric' },
  { key: 'pplat', label: 'Pplat', unit: 'cmH₂O', factor: 1, decimals: 0, source: 'hold' },
  { key: 'pmean', label: 'Pmedia', unit: 'cmH₂O', factor: 1, decimals: 0, source: 'metric' },
  { key: 'mve', label: 'VMesp', unit: 'L/min', factor: 1, decimals: 1, source: 'metric' },
  { key: 'rr', label: 'FR', unit: '/min', factor: 1, decimals: 0, source: 'metric' },
  { key: 'vte', label: 'VTesp', unit: 'mL', factor: 1000, decimals: 0, source: 'metric' },
  { key: 'fio2', label: 'FiO₂', unit: '%', factor: 100, decimals: 0, source: 'metric' },
  { key: 'mveSpont', label: 'VMesp espont', unit: 'L/min', factor: 1, decimals: 2, source: 'metric' },
  { key: 'rrSpont', label: 'FR espont', unit: '/min', factor: 1, decimals: 0, source: 'metric' },
  { key: 'cstat', label: 'Cstat', unit: 'mL/cmH₂O', factor: 1000, decimals: 0, source: 'hold' },
  { key: 'driving', label: 'ΔP estática', unit: 'cmH₂O', factor: 1, decimals: 1, source: 'hold' },
  { key: 'stressIndex', label: 'Índice de estrés', unit: '', factor: 1, decimals: 2, source: 'metric' },
];
// Sólo en la tabla de mediciones, no en la columna numérica del monitor: con quince casillas esa columna montaba las
// etiquetas sobre las unidades. Van primero para quedar junto a Cstat, ΔP e índice de estrés, que es su familia.
export const EXTRA_METRICS: MetricSpec[] = [
  // «Aparente»: la caída pico→meseta incluye relajación tisular y redistribución, no sólo el parámetro de vía aérea.
  { key: 'raw', label: 'Resistencia aparente', unit: 'cmH₂O·s/L', factor: 1, decimals: 1, source: 'hold' },
  { key: 'tauExp', label: 'Constante de tiempo esp.', unit: 's', factor: 1, decimals: 2, source: 'metric' },
  { key: 'mechPower', label: 'Potencia mecánica', unit: 'J/min', factor: 1, decimals: 1, source: 'metric' },
  { key: 'vti', label: 'VT inspirado', unit: 'mL', factor: 1000, decimals: 0, source: 'metric' },
  { key: 'leakPct', label: 'Fuga volumétrica', unit: '%', factor: 100, decimals: 1, source: 'metric' },
  { key: 'pplatCycle', label: 'Pplat de ciclo (pausa)', unit: 'cmH₂O', factor: 1, decimals: 0, source: 'metric' },
  { key: 'vteSpont', label: 'VTesp espontáneo', unit: 'mL', factor: 1000, decimals: 0, source: 'metric' },
];
export const ALL_METRICS: MetricSpec[] = [...METRICS, ...EXTRA_METRICS];
export const DATA_TABLE_GROUPS: { title: string; keys: string[] }[][] = [
  [
    { title: 'Presiones', keys: ['ppeak', 'peepe', 'pmean', 'pplatCycle'] },
    { title: 'Volumen y frecuencia', keys: ['vte', 'vti', 'mve', 'rr', 'fio2', 'leakPct'] },
  ],
  [
    { title: 'Mecánica por bloqueo', keys: ['pplat', 'cstat', 'driving', 'raw'] },
    { title: 'Índices derivados', keys: ['stressIndex', 'tauExp', 'mechPower'] },
    { title: 'Respiración espontánea', keys: ['vteSpont', 'mveSpont', 'rrSpont'] },
  ],
];
/** Las seis casillas de la vista reducida, como en la pantalla del equipo real. */
export const CORE_METRICS: readonly string[] = ['ppeak', 'peepe', 'pplat', 'vte', 'rr', 'fio2'];
/** Seis valores grandes de la vista básica (foto P3). */
export const BIG_METRICS: [string, string, string][] = [
  ['fio2', 'FiO₂', '%'],
  ['peepe', 'PEEPe', 'cmH₂O'],
  ['ppeak', 'Presión pico', 'cmH₂O'],
  ['mve', 'Volumen minuto', 'L/min'],
  ['vte', 'VTesp', 'mL'], // el ajuste se llama «Volumen tidal»: el medido no puede llamarse igual en la misma pantalla
  ['rr', 'Frecuencia resp.', '/min'],
];
export const METRIC_HELP: Record<string, string> = {
  ppeak: 'metric.ppeak',
  peepe: 'metric.peep',
  pplat: 'metric.pplat',
  pmean: 'metric.pmean',
  mve: 'metric.mv',
  rr: 'metric.rr',
  vte: 'metric.vte',
  fio2: 'setting.fio2',
  mveSpont: 'metric.mvSpont',
  rrSpont: 'metric.rrSpont',
  cstat: 'metric.cstat',
  driving: 'metric.driving',
  vti: 'metric.vti',
  leakPct: 'metric.leak',
  pplatCycle: 'metric.pplat',
  vteSpont: 'metric.vte',
  raw: 'metric.rinsp',
  tauExp: 'metric.tauExp',
  mechPower: 'metric.mechPower',
  stressIndex: 'metric.stressIndex',
};
/** Límites de alarma que colorean cada casilla numérica. */
export const ALARM_IDS_BY_METRIC: Record<string, string[]> = {
  vte: ['vteLow', 'vteHigh'],
  mve: ['mveLow', 'mveHigh'],
  rr: ['rrLow', 'rrHigh'],
  peepe: ['peepeLow', 'peepeHigh'],
  ppeak: ['pmax', 'ppeakLow'],
  fio2: ['fio2Low', 'fio2High'],
};

export function metricSample(frame: EngineFrame, key: string): MetricSample | null {
  if (key === 'pplat' || key === 'cstat' || key === 'driving' || key === 'raw') {
    const h = frame.procedure.last.inspHold;
    return h?.values[key] ?? null;
  }
  return frame.metrics[key] ?? null;
}
/** Valor en unidades de pantalla o null (en espera, sin dato o no medido). */
export function metricValue(frame: EngineFrame | null, spec: MetricSpec): number | null {
  if (!frame || frame.ventilation === 'standby') return null;
  const s = metricSample(frame, spec.key);
  return s && s.value !== null ? s.value * spec.factor : null;
}

/**
 * Veredicto de una estimación de examen. El porcentaje sobre el valor real informa cuando éste no es casi cero;
 * cerca de cero ese porcentaje miente (contra un 0 real cualquier respuesta daba «error 0 %», auditoría), así que
 * se informa la diferencia absoluta. Caer dentro del medio dígito mostrado cuenta como exacto.
 */
/**
 * Decimales con que el equipo muestra un valor (D, URM SW10 13-23 y 13-24, columna Resolution): VMesp de 0 a 1,0 L/min
 * en pasos de 0,01 y de 1,0 a 99,9 en pasos de 0,1; VT de 5 a 50 mL en pasos de 0,1 y de 50 a 2500 en pasos de 1. El
 * resto, con los decimales fijos de su especificación.
 */
export function decimalesMostrados(m: MetricSpec, valor: number | null): number {
  if (valor === null || !Number.isFinite(valor)) return m.decimals;
  if (m.key === 'mve' || m.key === 'mveSpont') return Math.abs(valor) < 1 ? 2 : 1;
  if (m.key === 'vte' || m.key === 'vti' || m.key === 'vteSpont') return Math.abs(valor) < 50 ? 1 : 0;
  return m.decimals;
}
export function veredictoEstimacion(guess: number, actual: number, decimals: number, unit: string): string {
  const err = guess - actual;
  const paso = Math.pow(10, -decimals) / 2;
  if (Math.abs(err) <= paso) return 'exacto';
  if (Math.abs(actual) > 1e-9) return `error ${Math.abs((err / actual) * 100).toFixed(0)} %`;
  return `diferencia de ${formatNumber(Math.abs(err), decimals)} ${unit}`.trimEnd();
}
/** Frase de calidad y procedencia para el alumno. */
export function metricQuality(frame: EngineFrame | null, spec: MetricSpec): string {
  if (!frame) return '';
  if (frame.ventilation === 'standby') return 'En espera';
  const s = metricSample(frame, spec.key);
  if (!s) return 'Sin dato';
  if (spec.source === 'hold') {
    const h = frame.procedure.last.inspHold;
    if (!h) return 'Requiere un bloqueo inspiratorio válido';
    return `Bloqueo a las ${wallDate(h.wallTimeMs ?? 0).slice(-8)} · hace ${clock(frame.simTimeMs / 1000 - (h.completedAtMs ?? 0) / 1000)}${s.quality !== 'valid' ? ` · ${humanReason(s.reason)}` : ''}`;
  }
  return `${QUALITY[s.quality]}${s.reason ? ' · ' + humanReason(s.reason) : ''} · ${SOURCE[s.source]}${s.breathId ? ' · respiración ' + s.breathId.replace('b', '') : ''}${s.windowMs ? ' · ventana ' + (s.windowMs / 1000).toFixed(1) + ' s' : ''}`;
}
export interface MetricStatus {
  tone: 'ok' | 'warn' | 'off';
  label: string;
  source: string;
  detail: string;
}
export function metricStatus(frame: EngineFrame | null, spec: MetricSpec): MetricStatus {
  const detail = metricQuality(frame, spec);
  const status = (tone: MetricStatus['tone'], label: string, source = ''): MetricStatus => ({
    tone,
    label,
    source,
    detail,
  });
  if (!frame) return status('off', '');
  if (frame.ventilation === 'standby') return status('off', 'En espera');
  if (spec.source === 'hold') {
    const hold = frame.procedure.last.inspHold;
    if (!hold) return status('off', 'Requiere bloqueo');
    const sample = metricSample(frame, spec.key);
    if (!sample) return status('off', 'Sin dato');
    if (hold.quality !== 'valid' || sample.quality !== 'valid') return status('warn', 'Bloqueo no válido');
    return status('ok', `Bloqueo · hace ${clock(frame.simTimeMs / 1000 - (hold.completedAtMs ?? 0) / 1000)}`);
  }
  const sample = metricSample(frame, spec.key);
  if (!sample) return status('off', 'Sin dato');
  const byQuality: Record<MetricSample['quality'], Pick<MetricStatus, 'tone' | 'label'>> = {
    valid: { tone: 'ok', label: 'Válido' },
    stale: { tone: 'warn', label: 'Antiguo' },
    inProgress: { tone: 'warn', label: 'En curso' },
    invalid: { tone: 'warn', label: 'No válido' },
    unavailable: { tone: 'off', label: 'No disponible' },
  };
  const result = byQuality[sample.quality];
  return status(result.tone, result.label, SOURCE_SHORT[sample.source] ?? '');
}
/**
 * Límite que está violando una medición en alarma, en sus unidades de pantalla, o null. El equipo lo muestra junto al
 * valor cuando la alarma ocurre aunque los límites estén ocultos (D, URM SW10 8-6: «The alarm limit always shows when an
 * alarm occurs for the measured data»).
 */
export function limiteEnAlarma(fr: EngineFrame, m: MetricSpec): string | null {
  const ids = ALARM_IDS_BY_METRIC[m.key];
  if (!ids) return null;
  const a = fr.alarms.find((x) => x.conditionActive && !x.filteredBy && ids.includes(x.id) && x.threshold !== null);
  if (!a || a.threshold === null) return null;
  const v = a.threshold * m.factor;
  return `${a.id.endsWith('Low') ? 'Mín.' : 'Máx.'} ${formatNumber(v, decimalesMostrados(m, v))}`;
}
/** ¿Alguna alarma activa afecta a esta medición? */
export function metricInAlarm(fr: EngineFrame, key: string): boolean {
  const ids = ALARM_IDS_BY_METRIC[key];
  return !!ids && fr.alarms.some((a) => a.conditionActive && !a.filteredBy && ids.includes(a.id));
}
