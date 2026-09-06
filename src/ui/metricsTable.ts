/** Tabla de mediciones del monitor: especificación, valor mostrado, calidad y pareja de límites. Funciones puras sobre el cuadro. */
import type { MetricSample, OffOr } from '../domain/types';
import type { EngineFrame } from '../engine/simulator';
import { clock, wallDate } from './format';
import { humanReason, QUALITY, SOURCE } from './humanize';

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
];
export const EXTRA_METRICS: MetricSpec[] = [
  { key: 'vti', label: 'VT inspirado', unit: 'mL', factor: 1000, decimals: 0, source: 'metric' },
  { key: 'leakPct', label: 'Fuga volumétrica', unit: '%', factor: 100, decimals: 1, source: 'metric' },
  { key: 'pplatCycle', label: 'Pplat de ciclo (pausa)', unit: 'cmH₂O', factor: 1, decimals: 0, source: 'metric' },
  { key: 'vteSpont', label: 'VTesp espontáneo', unit: 'mL', factor: 1000, decimals: 0, source: 'metric' },
];
export const ALL_METRICS: MetricSpec[] = [...METRICS, ...EXTRA_METRICS];
/** Seis valores grandes de la vista básica (foto P3). */
export const BIG_METRICS: [string, string, string][] = [
  ['fio2', 'FiO₂', '%'],
  ['peepe', 'PEEPe', 'cmH₂O'],
  ['ppeak', 'Presión pico', 'cmH₂O'],
  ['mve', 'Volumen minuto', 'L/min'],
  ['vte', 'Volumen tidal', 'mL'],
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
  if (key === 'pplat' || key === 'cstat' || key === 'driving') {
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
/** Pareja «alto\nbajo» de límites de alarma para la casilla de una medición. */
export function limitPair(fr: EngineFrame, key: string): string {
  const L = fr.alarmLimits;
  const fmt = (v: OffOr<number>, factor: number, d: number): string => (v === 'off' ? 'Off' : (v * factor).toFixed(d));
  switch (key) {
    case 'vte':
      return `${fmt(L.vteHigh, 1000, 0)}\n${fmt(L.vteLow, 1000, 0)}`;
    case 'mve':
      return `${fmt(L.mveHigh, 1, 1)}\n${fmt(L.mveLow, 1, 1)}`;
    case 'rr':
      return `${fmt(L.rrHigh, 1, 0)}\n${fmt(L.rrLow, 1, 0)}`;
    case 'peepe':
      return L.peepeHigh === 'off' && L.peepeLow === 'off' ? 'Off' : `${fmt(L.peepeHigh, 1, 0)}\n${fmt(L.peepeLow, 1, 0)}`;
    case 'ppeak':
      return `${fr.settings.pmax}\n${fmt(L.ppeakLow, 1, 0)}`;
    case 'fio2':
      return `${fmt(L.fio2High, 100, 0)}\n${fmt(L.fio2Low, 100, 0)}`;
    default:
      return '';
  }
}
/** ¿Alguna alarma activa afecta a esta medición? */
export function metricInAlarm(fr: EngineFrame, key: string): boolean {
  const ids = ALARM_IDS_BY_METRIC[key];
  return !!ids && fr.alarms.some((a) => a.conditionActive && ids.includes(a.id));
}
