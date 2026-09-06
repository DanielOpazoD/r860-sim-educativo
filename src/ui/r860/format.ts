import type { MetricSample, OffOr } from '../../domain/types';

export const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']; // «Ago» observado (O); resto propuesto (P)

export const NA = '---'; // observado en P1: «VTesp espont ---»

/** Formatea una muestra: null → «---» (nunca 0 ni Off); el redondeo es sólo de presentación. */
export function fmtSample(s: MetricSample | undefined, factor: number, decimals: number): string {
  if (!s || s.value === null) return NA;
  return (s.value * factor).toFixed(decimals);
}

export function fmtNumber(v: number | null | undefined, decimals: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return NA;
  return v.toFixed(decimals);
}

export function fmtLimit(v: OffOr<number>, factor: number, decimals: number): string {
  if (v === 'off') return 'Off';
  return (v * factor).toFixed(decimals);
}

/** I:E como en el equipo: 1:1.5 (E ≥ 1) o 2:1 (I > 1). Punto decimal conservado (O). */
export function fmtIE(ratio: number): string {
  if (ratio <= 1 + 1e-9) {
    const e = 1 / ratio;
    return `1:${trim(e)}`;
  }
  return `${trim(ratio)}:1`;
}
function trim(x: number): string {
  const r = Math.round(x * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

export function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS_ES[d.getMonth()]}-${d.getFullYear()}`;
}
export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
export function fmtClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function fmtMmSs(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
