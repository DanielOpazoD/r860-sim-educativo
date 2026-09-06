import type { MetricSample, ProcedureKind, ProcedureResult, Quality } from '../domain/types';
import type { ControllerEvent, HoldKind, HoldOutcome, VcController } from './controller';
import { PLATEAU_STABILITY_CMH2O } from './controller';
import { msToS, sToMs } from '../domain/units';

/** Denominador mínimo para Cstat (cmH2O), P. */
export const MIN_CSTAT_DENOMINATOR = 1;

export interface O2ProcedureState {
  procedureId: string;
  active: boolean;
  savedFio2: number;
  targetFio2: number;
  startedAtMs: number;
  endsAtMs: number;
  userEditedDuring: boolean;
  restored: boolean;
  endCause: 'timer' | 'user' | 'standby' | null;
}

function mkSample(key: string, value: number | null, unit: string, ctx: { simTimeMs: number; breathId: string | null; procedureId: string; quality: Quality; reason: string | null; windowMs: number | null }): MetricSample {
  return { key, value, unit, source: 'procedure', simTimeMs: ctx.simTimeMs, breathId: ctx.breathId, procedureId: ctx.procedureId, quality: ctx.quality, reason: ctx.reason, windowMs: ctx.windowMs };
}

/**
 * Gestor de procedimientos (P · dossier §18): elegibilidad, secuencia, cancelación, restauración idempotente
 * y resultado persistente con hora. El último resultado completado de cada tipo se conserva aunque se abra otra vista.
 */
export class ProcedureManager {
  private seq = 0;
  /** Procedimiento en cola o en curso (bloqueo). */
  current: ProcedureResult | null = null;
  /** Último resultado por tipo (persistente; puede ser antiguo: la hora forma parte del dato). */
  last: Record<ProcedureKind, ProcedureResult | null> = { inspHold: null, expHold: null, manualBreath: null, increaseO2: null };
  o2: O2ProcedureState | null = null;

  constructor(private readonly controller: VcController, private readonly wallTimeOf: (simTimeMs: number) => number) {}

  private nextId(): string { this.seq += 1; return `p${this.seq}`; }

  requestHold(kind: HoldKind, durationS: number, simTimeMs: number): { accepted: boolean; reason?: string; procedureId?: string } {
    if (this.current && (this.current.phase === 'queued' || this.current.phase === 'running')) return { accepted: false, reason: 'Otro procedimiento en cola o en curso (PRC-05)' };
    const procedureId = this.nextId();
    const r = this.controller.requestHold({ procedureId, kind, durationS });
    if (!r.accepted) return { accepted: false, reason: r.reason };
    this.current = {
      procedureId, kind, phase: 'queued', requestedAtMs: simTimeMs, startedAtMs: null, completedAtMs: null, wallTimeMs: null,
      requestedDurationS: durationS, actualDurationS: null, breathId: null, quality: 'inProgress', reason: 'enCola', values: {},
    };
    return { accepted: true, procedureId };
  }

  /** Cancela el bloqueo en cola o en curso. Idempotente: sin procedimiento activo devuelve false sin efectos. */
  cancel(procedureId?: string): boolean {
    if (!this.current) return false;
    if (procedureId && this.current.procedureId !== procedureId) return false;
    const wasRunning = this.current.phase === 'running';
    const cancelled = this.controller.cancelHold();
    if (!cancelled) return false;
    if (!wasRunning) this.current = null; // en cola: no hay resultado que conservar; el evento queda en el registro
    // Si estaba en curso, el controlador emite holdEnded(cancelled=true) y se cierra allí.
    return true;
  }

  onControllerEvent(ev: ControllerEvent, simTimeMs: number): void {
    if (ev.type === 'holdStarted' && this.current && this.current.procedureId === ev.procedureId) {
      this.current = { ...this.current, phase: 'running', startedAtMs: simTimeMs, quality: 'inProgress', reason: 'enCurso' };
    } else if (ev.type === 'holdEnded') {
      this.finishHold(ev.outcome, simTimeMs);
    } else if (ev.type === 'rejected' && this.current && ev.what === `hold:${this.current.procedureId}`) {
      this.last[this.current.kind] = this.last[this.current.kind]; // el resultado previo se conserva
      this.current = null;
    }
  }

  private finishHold(o: HoldOutcome, _clockMs: number): void {
    const cur = this.current && this.current.procedureId === o.procedureId ? this.current : null;
    const simTimeMs = sToMs(o.endSimTimeS); // hora exacta del fin de la maniobra, no la del paso del reloj
    const base = { simTimeMs, breathId: o.breathId, procedureId: o.procedureId, windowMs: sToMs(o.actualDurationS) };
    let quality: Quality = 'valid';
    let reason: string | null = null;
    if (o.cancelled) { quality = 'invalid'; reason = 'canceladoPorUsuario'; }
    else if (o.pmaxHit) { quality = 'invalid'; reason = 'pmaxDuranteBloqueo'; }
    else if (o.actualDurationS < o.requestedDurationS - 1e-6) { quality = 'invalid'; reason = 'duracionInsuficiente'; }
    else if (!Number.isFinite(o.stability) || o.stability > PLATEAU_STABILITY_CMH2O) { quality = 'invalid'; reason = 'mesetaInestable'; }
    const values: Record<string, MetricSample> = {};
    if (o.kind === 'inspHold') {
      const pplat = quality === 'valid' ? o.pawEnd : null;
      values.pplat = mkSample('pplatHold', pplat, 'cmH2O', { ...base, quality, reason });
      const denom = o.pawEnd - o.peepeStart;
      if (quality === 'valid' && denom >= MIN_CSTAT_DENOMINATOR && o.vtInspL > 0) {
        values.cstat = mkSample('cstatHold', o.vtInspL / denom, 'L/cmH2O', { ...base, quality: 'valid', reason: 'denominador=Pplat−PEEPe (sin PEEPtot medida)' });
        values.driving = mkSample('drivingHold', denom, 'cmH2O', { ...base, quality: 'valid', reason: 'Pplat − PEEPe al inicio de esa inspiración (P)' });
        values.vt = mkSample('vtHold', o.vtInspL, 'L', { ...base, quality: 'valid', reason: null });
      } else {
        values.cstat = mkSample('cstatHold', null, 'L/cmH2O', { ...base, quality: 'invalid', reason: quality !== 'valid' ? reason : 'denominadorInsuficiente' });
        values.driving = mkSample('drivingHold', null, 'cmH2O', { ...base, quality: 'invalid', reason: quality !== 'valid' ? reason : 'denominadorInsuficiente' });
      }
    } else {
      const peepTot = quality === 'valid' ? o.pawEnd : null;
      values.peepTot = mkSample('peepTotHold', peepTot, 'cmH2O', { ...base, quality, reason });
      values.peepi = mkSample('peepiHold', peepTot === null ? null : peepTot - o.peepeBeforeOcclusion, 'cmH2O', { ...base, quality, reason });
    }
    const result: ProcedureResult = {
      procedureId: o.procedureId, kind: o.kind, phase: o.cancelled ? 'cancelled' : quality === 'valid' ? 'completed' : 'invalid',
      requestedAtMs: cur?.requestedAtMs ?? simTimeMs, startedAtMs: sToMs(o.startSimTimeS), completedAtMs: simTimeMs,
      wallTimeMs: this.wallTimeOf(simTimeMs), requestedDurationS: o.requestedDurationS, actualDurationS: o.actualDurationS,
      breathId: o.breathId, quality, reason, values,
    };
    // Se conserva como «último» aunque sea inválido: el usuario debe ver el motivo; un resultado válido anterior queda en el historial.
    this.last[o.kind] = result;
    this.current = null;
  }

  /** ↑O2 (D QRG 2020 p.12: 2 min, +100 % adulto; fin por tiempo, Stop, favorito o tecla). Restauración idempotente (P). */
  startO2(simTimeMs: number, currentFio2: number, deltaFraction: number, durationMs: number): { accepted: boolean; reason?: string } {
    if (this.o2?.active) return { accepted: false, reason: '↑O2 ya en curso' };
    const target = Math.min(1, currentFio2 + deltaFraction);
    this.o2 = { procedureId: this.nextId(), active: true, savedFio2: currentFio2, targetFio2: target, startedAtMs: simTimeMs, endsAtMs: simTimeMs + durationMs, userEditedDuring: false, restored: false, endCause: null };
    this.controller.applySettings({ fio2: target });
    return { accepted: true };
  }

  noteUserFio2Edit(): void {
    if (this.o2?.active) this.o2.userEditedDuring = true;
  }

  /** Termina ↑O2 y restaura una sola vez. Si el usuario confirmó otra FiO2 durante el procedimiento, esa edición prevalece (P). */
  endO2(simTimeMs: number, cause: 'timer' | 'user' | 'standby'): boolean {
    const o = this.o2;
    if (!o || !o.active) return false;
    o.active = false;
    o.endCause = cause;
    if (!o.restored) {
      o.restored = true;
      if (!o.userEditedDuring) this.controller.applySettings({ fio2: o.savedFio2 });
    }
    this.last.increaseO2 = {
      procedureId: o.procedureId, kind: 'increaseO2', phase: cause === 'timer' ? 'completed' : 'cancelled', requestedAtMs: o.startedAtMs, startedAtMs: o.startedAtMs,
      completedAtMs: simTimeMs, wallTimeMs: this.wallTimeOf(simTimeMs), requestedDurationS: msToS(o.endsAtMs - o.startedAtMs), actualDurationS: msToS(simTimeMs - o.startedAtMs),
      breathId: null, quality: 'valid', reason: `fin:${cause}${o.userEditedDuring ? ';FiO2EditadaPorUsuario:noRestaurada' : ';restaurada'}`, values: {},
    };
    return true;
  }

  step(simTimeMs: number): void {
    if (this.o2?.active && simTimeMs >= this.o2.endsAtMs) this.endO2(simTimeMs, 'timer');
  }

  /** En espera: el controlador cierra el bloqueo (evento holdEnded cancelado) sin arrancar otra respiración; aquí sólo ↑O2. */
  onStandby(simTimeMs: number): void {
    this.endO2(simTimeMs, 'standby');
  }
}
