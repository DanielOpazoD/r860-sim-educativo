import type { NumericSegment, SettingRule } from './settingRules';
import type { VcSettings } from './types';
import { lpsToLpm, rrToCycleS } from './units';

const EPS = 1e-9;

/** Comprueba que un valor mostrado está sobre la rejilla de algún tramo (sin redondear en silencio). */
export function isOnGrid(rule: SettingRule, displayValue: number): boolean {
  if (rule.values) {
    return rule.values.some((v) => Math.abs(v * rule.displayFactor - displayValue) < EPS);
  }
  return rule.domain.some((seg) => {
    if (displayValue < seg.min - EPS || displayValue > seg.max + EPS) return false;
    const k = (displayValue - seg.min) / seg.step;
    return Math.abs(k - Math.round(k)) < 1e-6;
  });
}

function segmentFor(rule: SettingRule, displayValue: number): NumericSegment | null {
  for (const seg of rule.domain) {
    if (displayValue >= seg.min - EPS && displayValue <= seg.max + EPS) return seg;
  }
  return null;
}

/**
 * Mueve un valor mostrado un escalón en la dirección dada respetando los tramos.
 * En una frontera compartida (p. ej. 300 mL) sube con el paso del tramo superior y baja con el del inferior.
 * Devuelve el mismo valor si ya está en el extremo del dominio.
 */
export function stepDisplayValue(rule: SettingRule, displayValue: number, direction: 1 | -1): number {
  if (rule.values) {
    const vals = rule.values.map((v) => v * rule.displayFactor).sort((a, b) => a - b);
    let idx = vals.findIndex((v) => Math.abs(v - displayValue) < 1e-6);
    if (idx < 0) {
      // Valor fuera de rejilla: saltar al vecino más próximo en la dirección pedida.
      idx = direction > 0 ? vals.findIndex((v) => v > displayValue) : vals.length - 1 - [...vals].reverse().findIndex((v) => v < displayValue);
      if (idx < 0 || idx >= vals.length) return displayValue;
      return vals[idx] as number;
    }
    const next = idx + direction;
    if (next < 0 || next >= vals.length) return displayValue;
    return vals[next] as number;
  }
  const segs = [...rule.domain].sort((a, b) => a.min - b.min);
  const globalMin = segs[0]?.min ?? displayValue;
  const globalMax = segs[segs.length - 1]?.max ?? displayValue;
  if (direction > 0 && displayValue >= globalMax - EPS) return globalMax;
  if (direction < 0 && displayValue <= globalMin + EPS) return globalMin;
  // Elegir el tramo: al subir, el que contiene el valor con preferencia por el superior en fronteras; al bajar, el inferior.
  let seg: NumericSegment | null = null;
  if (direction > 0) {
    seg = segs.find((s) => displayValue >= s.min - EPS && displayValue < s.max - EPS) ?? segmentFor(rule, displayValue);
  } else {
    seg = [...segs].reverse().find((s) => displayValue > s.min + EPS && displayValue <= s.max + EPS) ?? segmentFor(rule, displayValue);
  }
  if (!seg) {
    // Fuera de dominio: llevar al extremo más cercano.
    return displayValue < globalMin ? globalMin : globalMax;
  }
  const raw = displayValue + direction * seg.step;
  const clamped = Math.min(Math.max(raw, seg.min), seg.max);
  // Normalizar a la rejilla del tramo para evitar acumulación de error flotante.
  const k = Math.round((clamped - seg.min) / seg.step);
  const snapped = seg.min + k * seg.step;
  return Number(snapped.toFixed(6));
}

export interface DerivedTiming {
  tCycleS: number;
  tInspS: number;
  tExpS: number;
  tPauseS: number;
  tFlowS: number;
  /** Flujo objetivo L/s (control de flujo apagado: derivado de VT y Tflow). */
  qTargetLps: number;
}

/** Deriva la temporización de VC declarando qué variable se controla: RR e I:E controlan; Tinsp/Texp/flujo se recalculan (P). */
export function deriveVcTiming(s: Pick<VcSettings, 'rr' | 'ie' | 'vt' | 'pausePct'>): DerivedTiming {
  const tCycleS = rrToCycleS(s.rr);
  const tInspS = (tCycleS * s.ie) / (1 + s.ie);
  const tExpS = tCycleS - tInspS;
  const tPauseS = tInspS * s.pausePct;
  const tFlowS = tInspS - tPauseS;
  const qTargetLps = tFlowS > 0 ? s.vt / tFlowS : Number.POSITIVE_INFINITY;
  return { tCycleS, tInspS, tExpS, tPauseS, tFlowS, qTargetLps };
}

export interface CrossLimits {
  tInspMinS: number; tInspMaxS: number; tExpMinS: number; tExpMaxS: number; flowMinLpm: number; flowMaxLpm: number;
}

export interface ValidationResult { ok: boolean; reasons: string[]; derived: DerivedTiming }

/** Comprueba cada ajuste contra su regla (rango, rejilla, Off, booleano). Devuelve motivos; no aproxima. */
export function validateDomains(s: VcSettings, rules: Record<Exclude<keyof VcSettings, 'mode'>, SettingRule>): string[] {
  const reasons: string[] = [];
  for (const key of Object.keys(rules) as (Exclude<keyof VcSettings, 'mode'>)[]) {
    const rule = rules[key];
    const v = s[key];
    if (v === 'off') { if (!rule.allowOff) reasons.push(`${rule.label}: Off no permitido`); continue; }
    if (rule.unit === 'boolean') { if (typeof v !== 'boolean') reasons.push(`${rule.label}: debe ser booleano`); continue; }
    if (typeof v !== 'number' || !Number.isFinite(v)) { reasons.push(`${rule.label}: valor no numérico`); continue; }
    if (!isOnGrid(rule, v * rule.displayFactor)) reasons.push(`${rule.label}: ${(v * rule.displayFactor).toFixed(rule.decimals + 1)} ${rule.displayUnit} no es un valor admitido (fuera de rango o de escalón).`);
  }
  return reasons;
}

/** Parámetros de paciente sintético admisibles para el integrador (P): positivos, finitos y con tau = R·C ≥ 1 ms. */
export function validatePatientParams(p: { crs: number; rInsp: number; rExp: number; r2: number; p0: number }): string[] {
  const r: string[] = [];
  for (const [k, v] of Object.entries(p)) if (typeof v !== 'number' || !Number.isFinite(v)) r.push(`${k}: no numérico`);
  if (r.length) return r;
  if (p.crs < 1e-4 || p.crs > 1) r.push('Crs fuera de 0.1–1000 mL/cmH2O');
  if (p.rInsp < 0.1 || p.rInsp > 1000) r.push('Rinsp fuera de 0.1–1000 cmH2O·s/L');
  if (p.rExp < 0.1 || p.rExp > 1000) r.push('Rexp fuera de 0.1–1000 cmH2O·s/L');
  if (p.r2 < 0) r.push('R2 negativo');
  if (Math.min(p.rInsp, p.rExp) * p.crs < 1e-3) r.push('tau = R·C menor que 1 ms');
  return r;
}

/**
 * Valida un juego completo de ajustes VC contra restricciones cruzadas (D rangos ficha 2014; relaciones P).
 * No aproxima: si algo es inválido, devuelve motivos legibles.
 */
/**
 * Valida un juego completo de ajustes contra restricciones cruzadas (rangos D ficha 2014; relaciones P).
 * Los mensajes están escritos para el usuario; la procedencia de cada regla vive en las reglas y en evidence.json.
 */
export function validateVcSettings(s: VcSettings, limits: CrossLimits): ValidationResult {
  const reasons: string[] = [];
  const d = deriveVcTiming(s);
  if (d.tInspS < limits.tInspMinS - EPS || d.tInspS > limits.tInspMaxS + EPS) {
    reasons.push(`El tiempo inspiratorio resultante (${d.tInspS.toFixed(2)} s) queda fuera de ${limits.tInspMinS}–${limits.tInspMaxS} s.`);
  }
  if (d.tExpS < limits.tExpMinS - EPS || d.tExpS > limits.tExpMaxS + EPS) {
    reasons.push(`El tiempo espiratorio resultante (${d.tExpS.toFixed(2)} s) queda fuera de ${limits.tExpMinS}–${limits.tExpMaxS} s.`);
  }
  const peep = s.peep === 'off' ? 0 : s.peep;
  if (s.mode === 'AC_VC') {
    const qLpm = lpsToLpm(d.qTargetLps);
    if (!Number.isFinite(qLpm) || qLpm > limits.flowMaxLpm + EPS) {
      reasons.push(`Ese volumen exige ${Number.isFinite(qLpm) ? qLpm.toFixed(1) : '∞'} L/min, más que el flujo máximo de ${limits.flowMaxLpm} L/min: aumenta el tiempo inspiratorio, reduce la pausa o baja el VT.`);
    }
    if (Number.isFinite(qLpm) && qLpm < limits.flowMinLpm - EPS) {
      reasons.push(`Ese volumen exige sólo ${qLpm.toFixed(1)} L/min, por debajo del flujo mínimo de ${limits.flowMinLpm} L/min.`);
    }
    if (s.plimit <= peep) reasons.push(`Plimit (${s.plimit}) debe ser mayor que PEEP (${peep}).`);
  } else {
    if (peep + s.pinsp >= s.pmax) reasons.push(`PEEP + Pinsp (${peep + s.pinsp}) debe quedar por debajo de Pmáx (${s.pmax}).`);
    if (s.riseMs / 1000 > d.tInspS) reasons.push(`La rampa (${s.riseMs} ms) no puede superar el tiempo inspiratorio (${d.tInspS.toFixed(2)} s).`);
  }
  if (s.pmax <= peep) reasons.push(`Pmáx (${s.pmax}) debe ser mayor que PEEP (${peep}).`);
  return { ok: reasons.length === 0, reasons, derived: d };
}
