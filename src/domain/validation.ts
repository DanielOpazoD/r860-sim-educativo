import type { NumericSegment, SettingRule } from './settingRules';
import type { VcSettings, EffortParams, SensorParams } from './types';
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
      idx =
        direction > 0 ? vals.findIndex((v) => v > displayValue) : vals.length - 1 - [...vals].reverse().findIndex((v) => v < displayValue);
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

/** Lista ordenada de valores mostrados admitidos por una regla (para deslizadores que sólo recorren valores válidos). */
export function gridValues(rule: SettingRule): number[] {
  if (rule.values) return rule.values.map((v) => v * rule.displayFactor).sort((a, b) => a - b);
  const out: number[] = [];
  for (const seg of [...rule.domain].sort((a, b) => a.min - b.min))
    for (let v = seg.min; v <= seg.max + 1e-9; v += seg.step) {
      const r = Number(v.toFixed(6));
      if (!out.length || Math.abs((out[out.length - 1] as number) - r) > 1e-9) out.push(r);
    }
  return out;
}
export function nearestGridValue(rule: SettingRule, displayValue: number): number {
  const vals = gridValues(rule);
  let best = vals[0] as number;
  for (const v of vals) if (Math.abs(v - displayValue) < Math.abs(best - displayValue)) best = v;
  return best;
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
  tInspMinS: number;
  tInspMaxS: number;
  tExpMinS: number;
  tExpMaxS: number;
  flowMinLpm: number;
  flowMaxLpm: number;
}

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
  /** Avisos no bloqueantes en lenguaje de usuario (p. ej. Plimit por encima de Pmáx). */
  warnings: string[];
  derived: DerivedTiming;
}

export const VENT_MODES = ['AC_VC', 'AC_PC'] as const;

/** Claves desconocidas o modo no admitido en un cambio de ajustes (la rejilla y los rangos se validan aparte). */
export function validateSettingsKeys(changes: Record<string, unknown>, rules: Record<string, SettingRule>): string[] {
  const r: string[] = [];
  for (const k of Object.keys(changes)) {
    if (k === 'mode') {
      if (!(VENT_MODES as readonly string[]).includes(String(changes[k]))) r.push(`Modo no admitido: ${String(changes[k])}.`);
    } else if (!(k in rules)) r.push(`Ajuste desconocido: ${k}.`);
  }
  return r;
}

export function validateEffort(e: EffortParams): string[] {
  const r: string[] = [];
  if (typeof e.enabled !== 'boolean') r.push('esfuerzo.enabled debe ser booleano');
  if (![e.amplitude, e.ratePerMin, e.tiS, e.phaseS].every((x) => typeof x === 'number' && Number.isFinite(x)))
    return [...r, 'esfuerzo: amplitud, frecuencia, Ti y desfase deben ser números finitos'];
  if (e.amplitude < 0 || e.amplitude > 50) r.push('esfuerzo: amplitud fuera de 0–50 cmH2O');
  if (e.ratePerMin <= 0 || e.ratePerMin > 120) r.push('esfuerzo: frecuencia fuera de 0–120/min');
  if (e.tiS <= 0 || e.tiS > 5) r.push('esfuerzo: Ti fuera de 0–5 s');
  return r;
}

export function validateSensors(sp: SensorParams): string[] {
  const r: string[] = [];
  if (![sp.fio2TauS, sp.fio2Bias].every((x) => typeof x === 'number' && Number.isFinite(x)))
    return ['sensores: tau y sesgo de FiO2 deben ser números finitos'];
  if (sp.fio2TauS < 0.1 || sp.fio2TauS > 600) r.push('sensores: tau de FiO2 fuera de 0.1–600 s');
  if (Math.abs(sp.fio2Bias) > 0.5) r.push('sensores: sesgo de FiO2 fuera de ±0.5');
  return r;
}

/** Comprueba cada ajuste contra su regla (rango, rejilla, Off, booleano). Devuelve motivos; no aproxima. */
export function validateDomains(s: VcSettings, rules: Record<Exclude<keyof VcSettings, 'mode'>, SettingRule>): string[] {
  const reasons: string[] = [];
  for (const key of Object.keys(rules) as Exclude<keyof VcSettings, 'mode'>[]) {
    const rule = rules[key];
    const v = s[key];
    if (v === 'off') {
      if (!rule.allowOff) reasons.push(`${rule.label}: Off no permitido`);
      continue;
    }
    if (rule.unit === 'boolean') {
      if (typeof v !== 'boolean') reasons.push(`${rule.label}: debe ser booleano`);
      continue;
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      reasons.push(`${rule.label}: valor no numérico`);
      continue;
    }
    if (!isOnGrid(rule, v * rule.displayFactor))
      reasons.push(
        `${rule.label}: ${(v * rule.displayFactor).toFixed(rule.decimals + 1)} ${rule.displayUnit} no es un valor admitido (fuera de rango o de escalón).`,
      );
  }
  return reasons;
}

/** Valida cambios de límites de alarma: claves conocidas, Off o número finito en rejilla, bajo < alto (P). */
export function validateAlarmLimitChanges(
  changes: unknown,
  rules: Record<string, SettingRule>,
  current: Record<string, number | 'off'>,
): { ok: boolean; reasons: string[]; clean: Record<string, number | 'off'> } {
  const reasons: string[] = [];
  const clean: Record<string, number | 'off'> = {};
  if (!changes || typeof changes !== 'object' || Array.isArray(changes))
    return { ok: false, reasons: ['Cambios de alarma inválidos.'], clean };
  for (const [k, v] of Object.entries(changes as Record<string, unknown>)) {
    const rule = rules[k];
    if (!rule) {
      reasons.push(`Límite desconocido: ${k}.`);
      continue;
    }
    if (v === 'off') {
      if (!rule.allowOff) reasons.push(`${rule.label}: Off no permitido.`);
      else clean[k] = 'off';
      continue;
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      reasons.push(`${rule.label}: valor no numérico.`);
      continue;
    }
    if (!isOnGrid(rule, v * rule.displayFactor)) {
      reasons.push(`${rule.label}: ${(v * rule.displayFactor).toFixed(rule.decimals + 1)} ${rule.displayUnit} no es un valor admitido.`);
      continue;
    }
    clean[k] = v;
  }
  const merged = { ...current, ...clean };
  for (const base of ['vte', 'mve', 'rr', 'fio2', 'peepe']) {
    const lo = merged[`${base}Low`],
      hi = merged[`${base}High`];
    if (typeof lo === 'number' && typeof hi === 'number' && lo >= hi)
      reasons.push(`${rules[`${base}Low`]?.label ?? base}: el límite bajo debe ser menor que el alto.`);
  }
  return { ok: reasons.length === 0, reasons, clean };
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
 * Valida un juego completo de ajustes contra restricciones cruzadas (rangos D ficha 2014; relaciones P).
 * Los mensajes están escritos para el usuario; la procedencia de cada regla vive en las reglas y en evidence.json.
 */
export function validateVcSettings(s: VcSettings, limits: CrossLimits): ValidationResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
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
      reasons.push(
        `Ese volumen exige ${Number.isFinite(qLpm) ? qLpm.toFixed(1) : '∞'} L/min, más que el flujo máximo de ${limits.flowMaxLpm} L/min: aumenta el tiempo inspiratorio, reduce la pausa o baja el VT.`,
      );
    }
    if (Number.isFinite(qLpm) && qLpm < limits.flowMinLpm - EPS) {
      reasons.push(`Ese volumen exige sólo ${qLpm.toFixed(1)} L/min, por debajo del flujo mínimo de ${limits.flowMinLpm} L/min.`);
    }
    if (s.plimit <= peep) reasons.push(`Plimit (${s.plimit}) debe ser mayor que PEEP (${peep}).`);
    // P (U-34): no se sabe si el equipo prohíbe Plimit > Pmáx; se permite con aviso porque cambia qué límite actúa primero.
    if (s.plimit > s.pmax)
      warnings.push(`Plimit (${s.plimit}) está por encima de Pmáx (${s.pmax}): la inspiración terminará por Pmáx antes de limitarse.`);
  } else {
    if (peep + s.pinsp >= s.pmax) reasons.push(`PEEP + Pinsp (${peep + s.pinsp}) debe quedar por debajo de Pmáx (${s.pmax}).`);
    if (s.riseMs / 1000 > d.tInspS)
      reasons.push(`La rampa (${s.riseMs} ms) no puede superar el tiempo inspiratorio (${d.tInspS.toFixed(2)} s).`);
  }
  if (s.pmax <= peep) reasons.push(`Pmáx (${s.pmax}) debe ser mayor que PEEP (${peep}).`);
  return { ok: reasons.length === 0, reasons, warnings, derived: d };
}
