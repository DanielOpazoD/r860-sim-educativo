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

export const VENT_MODES = ['AC_VC', 'AC_PC', 'CPAP_PS'] as const;

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
  if (e.shape !== undefined && e.shape !== 'halfSine' && e.shape !== 'riseRelax') r.push('esfuerzo: forma debe ser halfSine o riseRelax');
  if (e.relaxTauS !== undefined && (!Number.isFinite(e.relaxTauS) || e.relaxTauS <= 0 || e.relaxTauS > 2))
    r.push('esfuerzo: tau de relajación fuera de 0–2 s');
  if (e.variability !== undefined) {
    const { amplitudeFrac, periodFrac } = e.variability;
    if (![amplitudeFrac, periodFrac].every((x) => Number.isFinite(x) && x >= 0 && x <= 0.5))
      r.push('esfuerzo: variabilidad fuera de 0–0,5');
  }
  return r;
}

export function validateSensors(sp: SensorParams): string[] {
  const r: string[] = [];
  if (
    sp.flowNoiseFraction !== undefined &&
    (!Number.isFinite(sp.flowNoiseFraction) || sp.flowNoiseFraction < 0 || sp.flowNoiseFraction > 0.1)
  )
    r.push('sensores: variabilidad del volumen fuera de 0–10 %');
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
export function validatePatientParams(p: {
  crs: number;
  rInsp: number;
  rExp: number;
  r2: number;
  p0: number;
  rExpValve?: number;
  expValveOpenMs?: number;
  leakLpmAt10?: number;
  disconnected?: boolean;
  eVisc?: number;
  tauViscS?: number;
  sigmoid?: { b: number; c: number; d: number };
  efl?: { pcrit: number; rusFraction: number };
  rExpVolumeDep?: { gain: number; vRefL: number };
  second?: { crs: number; rInsp: number; rExp: number };
}): string[] {
  const r: string[] = [];
  for (const [k, v] of Object.entries(p))
    if (!['sigmoid', 'efl', 'rExpVolumeDep', 'second', 'disconnected'].includes(k) && (typeof v !== 'number' || !Number.isFinite(v)))
      r.push(`${k}: no numérico`);
  if (p.disconnected !== undefined && typeof p.disconnected !== 'boolean') r.push('disconnected: debe ser booleano');
  if (r.length) return r;
  if (p.rExpValve !== undefined && (p.rExpValve < 0 || p.rExpValve > 6))
    r.push('Resistencia de la rama espiratoria fuera de 0–6 cmH2O·s/L');
  if (p.leakLpmAt10 !== undefined && (p.leakLpmAt10 < 0 || p.leakLpmAt10 > 60)) r.push('Fuga fuera de 0–60 L/min a 10 cmH2O');
  if (p.expValveOpenMs !== undefined && (!Number.isFinite(p.expValveOpenMs) || p.expValveOpenMs < 0 || p.expValveOpenMs > 200))
    r.push('Apertura de la válvula espiratoria fuera de 0–200 ms');
  if (p.crs < 1e-4 || p.crs > 1) r.push('Crs fuera de 0.1–1000 mL/cmH2O');
  if (p.rInsp < 0.1 || p.rInsp > 1000) r.push('Rinsp fuera de 0.1–1000 cmH2O·s/L');
  if (p.rExp < 0.1 || p.rExp > 1000) r.push('Rexp fuera de 0.1–1000 cmH2O·s/L');
  if (p.r2 < 0 || p.r2 > 50) r.push('R2 (Rohrer) fuera de 0–50 cmH2O/(L/s)²');
  if (p.eVisc !== undefined && (!Number.isFinite(p.eVisc) || p.eVisc < 0 || p.eVisc > 40))
    r.push('Elastancia viscoelástica fuera de 0–40 cmH2O/L');
  if (p.tauViscS !== undefined && (!Number.isFinite(p.tauViscS) || p.tauViscS < 0.05 || p.tauViscS > 10))
    r.push('Constante viscoelástica fuera de 0.05–10 s');
  if (p.second !== undefined) {
    const s2 = p.second;
    if (!s2 || typeof s2 !== 'object' || ![s2.crs, s2.rInsp, s2.rExp].every((x) => typeof x === 'number' && Number.isFinite(x)))
      r.push('Segunda unidad inválida');
    else {
      if (s2.crs < 1e-4 || s2.crs > 1) r.push('Compliance de la segunda unidad fuera de 0.1–1000 mL/cmH2O');
      if (s2.rInsp < 0.1 || s2.rInsp > 1000 || s2.rExp < 0.1 || s2.rExp > 1000)
        r.push('Resistencias de la segunda unidad fuera de 0.1–1000 cmH2O·s/L');
    }
  }
  if (p.rExpVolumeDep !== undefined) {
    const d = p.rExpVolumeDep;
    if (!d || typeof d !== 'object' || ![d.gain, d.vRefL].every((x) => typeof x === 'number' && Number.isFinite(x)))
      r.push('Dependencia del volumen inválida');
    else {
      if (d.gain < 0 || d.gain > 10) r.push('Ganancia de estrechamiento fuera de 0–10');
      if (d.vRefL < 0.1 || d.vRefL > 5) r.push('Volumen de referencia del estrechamiento fuera de 0.1–5 L');
    }
  }
  if (p.efl !== undefined) {
    const e = p.efl;
    if (!e || typeof e !== 'object' || ![e.pcrit, e.rusFraction].every((x) => typeof x === 'number' && Number.isFinite(x)))
      r.push('Limitación al flujo inválida');
    else {
      if (e.pcrit < 0 || e.pcrit > 30) r.push('Presión crítica de colapso fuera de 0–30 cmH2O');
      if (e.rusFraction < 0.05 || e.rusFraction > 1) r.push('Fracción de resistencia aguas arriba fuera de 0.05–1');
    }
  }
  if (p.sigmoid !== undefined) {
    const s = p.sigmoid;
    if (!s || typeof s !== 'object' || ![s.b, s.c, s.d].every((x) => typeof x === 'number' && Number.isFinite(x)))
      r.push('Curva sigmoide inválida');
    else {
      if (s.b < 0 || s.b > 5) r.push('Capacidad de la sigmoide fuera de 0–5 L');
      if (s.c < 0 || s.c > 60) r.push('Presión de máxima compliance fuera de 0–60 cmH2O');
      if (s.d < 0.5 || s.d > 20) r.push('Anchura de la sigmoide fuera de 0.5–20 cmH2O');
    }
  }
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
  const peep = s.peep === 'off' ? 0 : s.peep;
  if (s.mode === 'CPAP_PS') {
    // Sin frecuencia programada no hay Ti ni Te que validar: el paciente los decide. Se validan los techos de presión y el respaldo.
    if (peep + s.psupport >= s.pmax) reasons.push(`PEEP + PS (${peep + s.psupport}) debe quedar por debajo de Pmáx (${s.pmax}).`);
    if (peep + s.backupPinsp >= s.pmax)
      reasons.push(`PEEP + Pinsp de respaldo (${peep + s.backupPinsp}) debe quedar por debajo de Pmáx (${s.pmax}).`);
    if (s.riseMs / 1000 > s.backupTinspS)
      reasons.push(`La rampa (${s.riseMs} ms) no puede superar el Tinsp de respaldo (${s.backupTinspS.toFixed(2)} s).`);
    if (s.minRate !== 'off' && 60 / s.minRate < s.backupTinspS + limits.tExpMinS)
      reasons.push(
        `Con frecuencia mínima ${s.minRate}/min el ciclo (${(60 / s.minRate).toFixed(2)} s) no deja ${limits.tExpMinS} s de espiración tras el Tinsp de respaldo (${s.backupTinspS.toFixed(2)} s).`,
      );
    if (s.pmax <= peep) reasons.push(`Pmáx (${s.pmax}) debe ser mayor que PEEP (${peep}).`);
    if (!s.triggerByPressure && s.flowTrigger > s.biasFlow + EPS)
      reasons.push(
        `El disparo por flujo (${lpsToLpm(s.flowTrigger).toFixed(1)} L/min) no puede superar el flujo de base (${lpsToLpm(s.biasFlow).toFixed(1)} L/min).`,
      );
    return { ok: reasons.length === 0, reasons, warnings, derived: d };
  }
  if (d.tInspS < limits.tInspMinS - EPS || d.tInspS > limits.tInspMaxS + EPS) {
    reasons.push(`El tiempo inspiratorio resultante (${d.tInspS.toFixed(2)} s) queda fuera de ${limits.tInspMinS}–${limits.tInspMaxS} s.`);
  }
  if (d.tExpS < limits.tExpMinS - EPS || d.tExpS > limits.tExpMaxS + EPS) {
    reasons.push(`El tiempo espiratorio resultante (${d.tExpS.toFixed(2)} s) queda fuera de ${limits.tExpMinS}–${limits.tExpMaxS} s.`);
  }
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
    // Con Plimit en su máximo (100) no actúa: no se avisa.
    if (s.plimit > s.pmax && s.plimit < 100)
      warnings.push(`Plimit (${s.plimit}) está por encima de Pmáx (${s.pmax}): la inspiración terminará por Pmáx antes de limitarse.`);
  } else {
    if (peep + s.pinsp >= s.pmax) reasons.push(`PEEP + Pinsp (${peep + s.pinsp}) debe quedar por debajo de Pmáx (${s.pmax}).`);
    if (s.riseMs / 1000 > d.tInspS)
      reasons.push(`La rampa (${s.riseMs} ms) no puede superar el tiempo inspiratorio (${d.tInspS.toFixed(2)} s).`);
  }
  if (s.pmax <= peep) reasons.push(`Pmáx (${s.pmax}) debe ser mayor que PEEP (${peep}).`);
  // P (física del modelo): el disparo por flujo detecta el flujo de base desviado por el paciente; no puede exceder el flujo de base.
  if (!s.triggerByPressure && s.flowTrigger > s.biasFlow + EPS)
    reasons.push(
      `El disparo por flujo (${lpsToLpm(s.flowTrigger).toFixed(1)} L/min) no puede superar el flujo de base (${lpsToLpm(s.biasFlow).toFixed(1)} L/min).`,
    );
  return { ok: reasons.length === 0, reasons, warnings, derived: d };
}
