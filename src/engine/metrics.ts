import type { BreathRecord, MetricSample, Quality } from '../domain/types';
import { MS_PER_S, S_PER_MIN, sToMs } from '../domain/units';

/** Número de respiraciones de la ventana móvil de FR y VMesp (P). */
export const BREATH_WINDOW = 8;

export interface MetricContext {
  simTimeMs: number;
  ventilating: boolean;
  fio2Measured: number;
  /** Tiempo de ciclo programado (s) para detectar datos antiguos. */
  tCycleS: number;
}

function sample(
  key: string,
  value: number | null,
  unit: string,
  ctx: {
    simTimeMs: number;
    breathId: string | null;
    quality: Quality;
    reason: string | null;
    windowMs: number | null;
    source?: MetricSample['source'];
  },
): MetricSample {
  const g = guardFiniteness(value, ctx.quality, ctx.reason);
  return {
    key,
    value: g.value,
    unit,
    source: ctx.source ?? 'ventilator',
    simTimeMs: ctx.simTimeMs,
    breathId: ctx.breathId,
    procedureId: null,
    quality: g.quality,
    reason: g.reason,
    windowMs: ctx.windowMs,
  };
}

/**
 * Ningún número no finito puede salir marcado como válido: el contrato de calidad es lo que sostiene todo lo demás.
 * Vive en un solo sitio porque estaba en uno solo: las métricas lo cumplían y los procedimientos no, de modo que una
 * Pplat o una Cstat no finitas habrían salido con calidad «válida» por el otro camino.
 */
export function guardFiniteness(
  value: number | null,
  quality: Quality,
  reason: string | null,
): { value: number | null; quality: Quality; reason: string | null } {
  if (value === null || Number.isFinite(value)) return { value, quality, reason };
  return { value: null, quality: 'invalid', reason: 'valorNoFinito' };
}

/**
 * Motor de métricas (P · dossier §15). Todo estimador publica su ventana y su calidad.
 * - Ppico, PEEPe, Pmedia, VTesp, VTinsp, Fuga %: última respiración completa.
 * - FR y VMesp: ventana de las últimas 8 respiraciones (Σ VTesp / Σ periodo × 60); no VT programado × FR programada.
 * - Pplat de ciclo: sólo con pausa válida; null con motivo.
 * - Espontáneas: las respiraciones de soporte de CPAP/PS. FR espont y VMesp espont se cuentan sobre la MISMA ventana que
 *   FR y VMesp (0 cuando no hay ninguna: conteo real, no dato ausente); VTesp espont es el de la última espontánea.
 *   Las asistidas de A/C no cuentan como espontáneas: el ciclo lo gobierna el ventilador aunque lo dispare el paciente.
 */
export class MetricEngine {
  private records: BreathRecord[] = [];
  private lastEndMs: number | null = null;

  onBreath(record: BreathRecord): void {
    this.records.push(record);
    if (this.records.length > 64) this.records.shift();
    this.lastEndMs = record.endSimTimeMs;
  }

  reset(): void {
    this.records = [];
    this.lastEndMs = null;
  }

  get breathRecords(): readonly BreathRecord[] {
    return this.records;
  }

  compute(ctx: MetricContext): Record<string, MetricSample> {
    const out: Record<string, MetricSample> = {};
    const last = this.records[this.records.length - 1] ?? null;
    const t = ctx.simTimeMs;
    if (!ctx.ventilating) {
      for (const k of [
        'ppeak',
        'peepe',
        'pplatCycle',
        'pmean',
        'vte',
        'vti',
        'leakPct',
        'mve',
        'rr',
        'mveSpont',
        'rrSpont',
        'vteSpont',
        'stressIndex',
      ]) {
        out[k] = sample(k, null, unitOf(k), { simTimeMs: t, breathId: null, quality: 'unavailable', reason: 'standby', windowMs: null });
      }
      out.fio2 = sample('fio2', null, 'fraction', {
        simTimeMs: t,
        breathId: null,
        quality: 'unavailable',
        reason: 'standby',
        windowMs: null,
      });
      return out;
    }
    const staleMs = Math.max(3 * sToMs(ctx.tCycleS), 10 * MS_PER_S);
    const stale = this.lastEndMs !== null && t - this.lastEndMs > staleMs;
    const q: Quality = last ? (stale ? 'stale' : 'valid') : 'inProgress';
    const reason = last ? (stale ? 'sinRespiracionReciente' : null) : 'sinRespiracionCompleta';
    const bid = last?.breathId ?? null;
    const base = { simTimeMs: t, breathId: bid, quality: q, reason, windowMs: last ? last.endSimTimeMs - last.startSimTimeMs : null };
    out.ppeak = sample('ppeak', last?.ppeak ?? null, 'cmH2O', base);
    out.peepe = sample('peepe', last?.peepe ?? null, 'cmH2O', base);
    out.pmean = sample('pmean', last?.pmean ?? null, 'cmH2O', base);
    // Canales mostrados: lo que mide el sensor de flujo (con su ganancia por ciclo), no el volumen verdadero del modelo.
    out.vte = sample('vte', last ? (last.vtExpMeasured ?? last.vtExp) : null, 'L', base);
    out.vti = sample('vti', last ? (last.vtInspMeasured ?? last.vtInsp) : null, 'L', base);
    if (last) {
      const vtiM = last.vtInspMeasured ?? last.vtInsp;
      const leak = vtiM > 1e-6 ? Math.max(0, (vtiM - (last.vtExpMeasured ?? last.vtExp)) / vtiM) : null;
      out.leakPct = sample('leakPct', leak, 'fraction', { ...base, source: 'derivedModel' });
      if (last.pplatCycle !== null) out.pplatCycle = sample('pplatCycle', last.pplatCycle, 'cmH2O', base);
      else
        out.pplatCycle = sample('pplatCycle', null, 'cmH2O', {
          ...base,
          quality: stale ? 'stale' : 'unavailable',
          reason: last.pplatCycleReason ?? 'noPause',
        });
      // Índice de estrés: sólo significa algo si la rampa a flujo constante es del pulmón y de nadie más. El
      // controlador ya decide cuándo no lo es y dice por qué; aquí sólo se le pone calidad.
      out.stressIndex =
        last.stressIndex === null || last.stressIndex === undefined
          ? sample('stressIndex', null, 'index', { ...base, quality: 'unavailable', reason: last.stressIndexReason ?? 'sinDato' })
          : sample('stressIndex', last.stressIndex, 'index', { ...base, source: 'derivedModel' });
      // Constante de tiempo espiratoria: se lee en la propia rama espiratoria, sin ninguna maniobra. Cuando el
      // vaciamiento no es una sola exponencial el controlador no la publica y dice por qué, que es el dato útil.
      out.tauExp =
        last.tauExpS === null || last.tauExpS === undefined
          ? sample('tauExp', null, 's', { ...base, quality: 'unavailable', reason: last.tauExpReason ?? 'sinDato' })
          : sample('tauExp', last.tauExpS, 's', { ...base, source: 'derivedModel' });
    } else {
      out.leakPct = sample('leakPct', null, 'fraction', base);
      out.pplatCycle = sample('pplatCycle', null, 'cmH2O', base);
      out.stressIndex = sample('stressIndex', null, 'index', base);
      out.tauExp = sample('tauExp', null, 's', base);
    }
    // Ventana de respiraciones para FR y VMesp.
    const win = this.records.slice(-BREATH_WINDOW);
    const sumPeriodMs = win.reduce((a, r) => a + (r.endSimTimeMs - r.startSimTimeMs), 0);
    if (win.length >= 2 && sumPeriodMs > 0) {
      const sumVte = win.reduce((a, r) => a + (r.vtExpMeasured ?? r.vtExp), 0);
      const rr = (win.length * S_PER_MIN * MS_PER_S) / sumPeriodMs;
      const mve = (sumVte * S_PER_MIN * MS_PER_S) / sumPeriodMs;
      const wq: Quality = stale ? 'stale' : 'valid';
      out.rr = sample('rr', rr, 'perMin', {
        simTimeMs: t,
        breathId: bid,
        quality: wq,
        reason: stale ? 'sinRespiracionReciente' : null,
        windowMs: sumPeriodMs,
      });
      out.mve = sample('mve', mve, 'L/min', {
        simTimeMs: t,
        breathId: bid,
        quality: wq,
        reason: stale ? 'sinRespiracionReciente' : null,
        windowMs: sumPeriodMs,
      });
    } else {
      out.rr = sample('rr', null, 'perMin', {
        simTimeMs: t,
        breathId: bid,
        quality: 'inProgress',
        reason: 'ventanaInsuficiente',
        windowMs: null,
      });
      out.mve = sample('mve', null, 'L/min', {
        simTimeMs: t,
        breathId: bid,
        quality: 'inProgress',
        reason: 'ventanaInsuficiente',
        windowMs: null,
      });
    }
    const spont = win.filter((r) => r.type === 'spontaneous');
    const ventana = win.length >= 2 && sumPeriodMs > 0;
    // Sin ventana todavía: «0» es un conteo real cuando no hay ninguna espontánea; con alguna, aún no se puede tasar.
    const meta = ventana
      ? { quality: (stale ? 'stale' : 'valid') as Quality, reason: stale ? 'sinRespiracionReciente' : null, windowMs: sumPeriodMs }
      : spont.length === 0
        ? { quality: (last ? 'valid' : 'inProgress') as Quality, reason: last ? null : 'sinRespiracionCompleta', windowMs: null }
        : { quality: 'inProgress' as Quality, reason: 'ventanaInsuficiente', windowMs: null };
    const rrSpont = ventana ? (spont.length * S_PER_MIN * MS_PER_S) / sumPeriodMs : spont.length === 0 ? 0 : null;
    const mveSpont = ventana
      ? (spont.reduce((a, r) => a + (r.vtExpMeasured ?? r.vtExp), 0) * S_PER_MIN * MS_PER_S) / sumPeriodMs
      : spont.length === 0
        ? 0
        : null;
    out.rrSpont = sample('rrSpont', rrSpont, 'perMin', { simTimeMs: t, breathId: bid, ...meta });
    out.mveSpont = sample('mveSpont', mveSpont, 'L/min', { simTimeMs: t, breathId: bid, ...meta });
    const ultimaEspont = spont.at(-1) ?? null;
    out.vteSpont = ultimaEspont
      ? sample('vteSpont', ultimaEspont.vtExpMeasured ?? ultimaEspont.vtExp, 'L', {
          simTimeMs: t,
          breathId: ultimaEspont.breathId,
          quality: stale ? 'stale' : 'valid',
          reason: stale ? 'sinRespiracionReciente' : null,
          windowMs: ultimaEspont.endSimTimeMs - ultimaEspont.startSimTimeMs,
        })
      : sample('vteSpont', null, 'L', {
          simTimeMs: t,
          breathId: null,
          quality: 'unavailable',
          reason: 'sinRespiracionesEspontaneas',
          windowMs: null,
        });
    const fio2Ok = ctx.fio2Measured !== null && Number.isFinite(ctx.fio2Measured);
    out.fio2 = sample('fio2', fio2Ok ? ctx.fio2Measured : null, 'fraction', {
      simTimeMs: t,
      breathId: null,
      quality: fio2Ok ? 'valid' : 'invalid',
      reason: fio2Ok ? null : 'sensorNoFinito',
      windowMs: null,
    });
    return out;
  }
}

function unitOf(k: string): string {
  switch (k) {
    case 'stressIndex':
      return 'index';
    case 'tauExp':
      return 's';
    case 'ppeak':
    case 'peepe':
    case 'pplatCycle':
    case 'pmean':
      return 'cmH2O';
    case 'vte':
    case 'vti':
    case 'vteSpont':
      return 'L';
    case 'leakPct':
      return 'fraction';
    case 'mve':
    case 'mveSpont':
      return 'L/min';
    case 'rr':
    case 'rrSpont':
      return 'perMin';
    default:
      return '';
  }
}
