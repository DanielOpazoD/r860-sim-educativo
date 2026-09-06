import type { MetricSample } from './types';

/**
 * Comparador de consistencia (DAT-04): antes de combinar muestras en una fórmula, exige misma respiración,
 * mismo procedimiento (si lo hay) y calidad válida. Nunca usa números redondeados.
 */
export type ConsistencyResult = { ok: true; value: number } | { ok: false; reason: string };

export function cstatFromSamples(vt: MetricSample, pplat: MetricSample, peepRef: MetricSample): ConsistencyResult {
  for (const s of [vt, pplat, peepRef]) if (s.quality !== 'valid' || s.value === null) return { ok: false, reason: `${s.key} no válida (${s.quality}${s.reason ? ': ' + s.reason : ''})` };
  if (vt.breathId !== pplat.breathId) return { ok: false, reason: `respiraciones distintas (${vt.breathId} vs ${pplat.breathId})` };
  if (pplat.procedureId && vt.procedureId && pplat.procedureId !== vt.procedureId) return { ok: false, reason: 'procedimientos distintos' };
  if (vt.unit !== 'L' || pplat.unit !== 'cmH2O' || peepRef.unit !== 'cmH2O') return { ok: false, reason: 'unidades incompatibles' };
  const denom = (pplat.value as number) - (peepRef.value as number);
  if (denom < 1) return { ok: false, reason: 'denominador insuficiente' };
  return { ok: true, value: (vt.value as number) / denom };
}
