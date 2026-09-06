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
  return {
    key,
    value,
    unit,
    source: ctx.source ?? 'ventilator',
    simTimeMs: ctx.simTimeMs,
    breathId: ctx.breathId,
    procedureId: null,
    quality: ctx.quality,
    reason: ctx.reason,
    windowMs: ctx.windowMs,
  };
}

/**
 * Motor de métricas (P · dossier §15). Todo estimador publica su ventana y su calidad.
 * - Ppico, PEEPe, Pmedia, VTesp, VTinsp, Fuga %: última respiración completa.
 * - FR y VMesp: ventana de las últimas 8 respiraciones (Σ VTesp / Σ periodo × 60); no VT programado × FR programada.
 * - Pplat de ciclo: sólo con pausa válida; null con motivo.
 * - Espontáneas: no existen en A/C VC; FR espont y VMesp espont son 0 (conteo real), VTesp espont es null.
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
      for (const k of ['ppeak', 'peepe', 'pplatCycle', 'pmean', 'vte', 'vti', 'leakPct', 'mve', 'rr', 'mveSpont', 'rrSpont', 'vteSpont']) {
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
    out.vte = sample('vte', last?.vtExp ?? null, 'L', base);
    out.vti = sample('vti', last?.vtInsp ?? null, 'L', base);
    if (last) {
      const leak = last.vtInsp > 1e-6 ? Math.max(0, (last.vtInsp - last.vtExp) / last.vtInsp) : null;
      out.leakPct = sample('leakPct', leak, 'fraction', { ...base, source: 'derivedModel' });
      if (last.pplatCycle !== null) out.pplatCycle = sample('pplatCycle', last.pplatCycle, 'cmH2O', base);
      else
        out.pplatCycle = sample('pplatCycle', null, 'cmH2O', {
          ...base,
          quality: stale ? 'stale' : 'unavailable',
          reason: last.pplatCycleReason ?? 'noPause',
        });
    } else {
      out.leakPct = sample('leakPct', null, 'fraction', base);
      out.pplatCycle = sample('pplatCycle', null, 'cmH2O', base);
    }
    // Ventana de respiraciones para FR y VMesp.
    const win = this.records.slice(-BREATH_WINDOW);
    const sumPeriodMs = win.reduce((a, r) => a + (r.endSimTimeMs - r.startSimTimeMs), 0);
    if (win.length >= 2 && sumPeriodMs > 0) {
      const sumVte = win.reduce((a, r) => a + r.vtExp, 0);
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
    out.rrSpont = sample('rrSpont', spont.length === 0 ? 0 : null, 'perMin', {
      simTimeMs: t,
      breathId: bid,
      quality: last ? 'valid' : 'inProgress',
      reason: last ? null : 'sinRespiracionCompleta',
      windowMs: null,
    });
    out.mveSpont = sample('mveSpont', spont.length === 0 ? 0 : null, 'L/min', {
      simTimeMs: t,
      breathId: bid,
      quality: last ? 'valid' : 'inProgress',
      reason: last ? null : 'sinRespiracionCompleta',
      windowMs: null,
    });
    out.vteSpont = sample('vteSpont', null, 'L', {
      simTimeMs: t,
      breathId: null,
      quality: 'unavailable',
      reason: 'sinRespiracionesEspontaneas',
      windowMs: null,
    });
    out.fio2 = sample('fio2', ctx.fio2Measured, 'fraction', {
      simTimeMs: t,
      breathId: null,
      quality: 'valid',
      reason: null,
      windowMs: null,
    });
    return out;
  }
}

function unitOf(k: string): string {
  switch (k) {
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
