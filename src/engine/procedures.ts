import type { MetricSample, ProcedureKind, ProcedureResult, Quality } from '../domain/types';
import { PLATEAU_REVERSAL_CMH2O, PLATEAU_DRIFT_RATE_CMH2O_S, PLATEAU_DRIFT_RATE_EXP_CMH2O_S } from './breathAnalysis';
import type { ControllerEvent, HoldKind, HoldOutcome } from './controllerTypes';
import type { VcController } from './controller';
import { msToS, sToMs } from '../domain/units';
import { guardFiniteness } from './metrics';

/** Deriva admitida según lo que la maniobra publica: ver `PLATEAU_DRIFT_RATE_EXP_CMH2O_S`. */
const driftLimit = (kind: HoldKind): number => (kind === 'expHold' ? PLATEAU_DRIFT_RATE_EXP_CMH2O_S : PLATEAU_DRIFT_RATE_CMH2O_S);

/** Denominador mínimo para Cstat (cmH2O), P. */
export const MIN_CSTAT_DENOMINATOR = 1;
/**
 * Flujo mínimo para estimar la resistencia (L/s), P. Por debajo, el cociente (Ppico − Pplat)/Q divide una resta
 * pequeña por un número pequeño y devuelve ruido con aspecto de medición. 0,1 L/s son 6 L/min: por debajo de eso
 * ningún ventilador de adultos está entregando una rampa.
 */
export const MIN_FLOW_FOR_RAW_LPS = 0.1;

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

function mkSample(
  key: string,
  value: number | null,
  unit: string,
  ctx: {
    simTimeMs: number;
    breathId: string | null;
    procedureId: string;
    quality: Quality;
    reason: string | null;
    windowMs: number | null;
  },
): MetricSample {
  const g = guardFiniteness(value, ctx.quality, ctx.reason);
  return {
    key,
    value: g.value,
    unit,
    source: 'procedure',
    simTimeMs: ctx.simTimeMs,
    breathId: ctx.breathId,
    procedureId: ctx.procedureId,
    quality: g.quality,
    reason: g.reason,
    windowMs: ctx.windowMs,
  };
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

  constructor(
    private readonly controller: VcController,
    private readonly wallTimeOf: (simTimeMs: number) => number,
    /** Pulmón con segunda unidad en paralelo: la Cstat y la resistencia medidas no equivalen a un solo compartimento. */
    private readonly hasSecondUnit: () => boolean = () => false,
    /** Firma de la mecánica vigente: con ella un bloqueo espiratorio queda vinculado a su contexto y un
     * bloqueo inspiratorio sabe si la PEEPtot medida sigue siendo de la misma mecánica (o de una anterior). */
    private readonly contextSig: () => string = () => '',
  ) {}

  private nextId(): string {
    this.seq += 1;
    return `p${this.seq}`;
  }

  requestHold(kind: HoldKind, durationS: number, simTimeMs: number): { accepted: boolean; reason?: string; procedureId?: string } {
    if (this.current && (this.current.phase === 'queued' || this.current.phase === 'running'))
      return { accepted: false, reason: 'Otro procedimiento en cola o en curso (PRC-05)' };
    const procedureId = this.nextId();
    const r = this.controller.requestHold({ procedureId, kind, durationS });
    if (!r.accepted) return { accepted: false, reason: r.reason };
    this.current = {
      procedureId,
      kind,
      phase: 'queued',
      requestedAtMs: simTimeMs,
      startedAtMs: null,
      completedAtMs: null,
      wallTimeMs: null,
      requestedDurationS: durationS,
      actualDurationS: null,
      breathId: null,
      quality: 'inProgress',
      reason: 'enCola',
      values: {},
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
      this.finishHold(ev.outcome);
    } else if (ev.type === 'rejected' && this.current && ev.what === `hold:${this.current.procedureId}`) {
      // No elegible (p. ej. inspiración terminada por Pmáx): resultado inválido con motivo y hora, para que la interfaz lo muestre.
      const cur = this.current;
      this.current = null;
      this.last[cur.kind] = {
        ...cur,
        phase: 'invalid',
        completedAtMs: simTimeMs,
        wallTimeMs: this.wallTimeOf(simTimeMs),
        quality: 'invalid',
        reason: ev.reason,
        values: {},
      };
    }
  }

  /** Prefijo «aprox.» de los motivos cuando el pulmón activo son dos unidades en paralelo (el dato es del equipo). */
  private aproximacion(): string {
    return this.hasSecondUnit() ? 'twoCompartments;' : '';
  }

  private finishHold(o: HoldOutcome): void {
    const cur = this.current && this.current.procedureId === o.procedureId ? this.current : null;
    const simTimeMs = sToMs(o.endSimTimeS); // hora exacta del fin de la maniobra, no la del paso del reloj
    const base = { simTimeMs, breathId: o.breathId, procedureId: o.procedureId, windowMs: sToMs(o.actualDurationS) };
    let quality: Quality = 'valid';
    let reason: string | null = null;
    if (o.cancelled) {
      quality = 'invalid';
      reason = o.cancelReason === 'standby' ? 'cancelledByStandby' : 'canceladoPorUsuario';
    } else if (o.pmaxHit) {
      quality = 'invalid';
      reason = 'pmaxDuranteBloqueo';
    } else if (o.actualDurationS < o.requestedDurationS - 1e-6) {
      quality = 'invalid';
      reason = 'duracionInsuficiente';
    } else if (!Number.isFinite(o.reversal) || o.reversal > PLATEAU_REVERSAL_CMH2O) {
      quality = 'invalid';
      reason = 'mesetaPerturbada';
    } else if (!Number.isFinite(o.driftRate) || o.driftRate > driftLimit(o.kind)) {
      quality = 'invalid';
      reason = 'mesetaInestable';
    }
    const values: Record<string, MetricSample> = {};
    if (o.kind === 'inspHold') {
      const pplat = quality === 'valid' ? o.pawEnd : null;
      values.pplat = mkSample('pplatHold', pplat, 'cmH2O', { ...base, quality, reason });
      // Denominador: PEEPtot si hay un bloqueo espiratorio válido medido con la misma PEEP programada Y en la
      // misma mecánica (P, E-035). La PEEPe igual no basta: la autoPEEP depende de toda la mecánica — tras
      // cambiar la resistencia espiratoria la PEEPtot vieja contamina la Cstat nueva (publicaba 118,9 mL/cmH₂O
      // en un pulmón de 50). Si la firma cambió, se cae a PEEPe con el motivo explícito.
      const prevExp = this.last.expHold;
      const peepTotPrev =
        prevExp &&
        prevExp.quality === 'valid' &&
        prevExp.contextSig !== undefined &&
        prevExp.contextSig === this.contextSig() &&
        Math.abs((prevExp.values.peepe?.value ?? Number.NaN) - o.peepeStart) < 1e-9
          ? (prevExp.values.peepTot?.value ?? null)
          : null;
      // Había PEEPtot con la misma PEEPe pero medida bajo otra mecánica: el motivo dice por qué no se combinó.
      const peepTotDeOtraMecanica =
        peepTotPrev === null && prevExp?.quality === 'valid' && Math.abs((prevExp.values.peepe?.value ?? Number.NaN) - o.peepeStart) < 1e-9;
      const denom = o.pawEnd - (peepTotPrev ?? o.peepeStart);
      if (quality === 'valid' && denom >= MIN_CSTAT_DENOMINATOR && o.vtInspL > 0) {
        values.cstat = mkSample('cstatHold', o.vtInspL / denom, 'L/cmH2O', {
          ...base,
          quality: 'valid',
          reason:
            this.aproximacion() +
            (peepTotPrev === null
              ? peepTotDeOtraMecanica
                ? 'denominador=Pplat−PEEPe (la PEEPtot previa es de otra mecánica)'
                : 'denominador=Pplat−PEEPe (sin PEEPtot medida)'
              : 'denominador=Pplat−PEEPtot (bloqueo espiratorio previo)'),
        });
        values.driving = mkSample('drivingHold', denom, 'cmH2O', {
          ...base,
          quality: 'valid',
          // El motivo tiene que decir QUÉ PEEP hay en la resta. Decía siempre «PEEPe» aunque el denominador fuera la
          // PEEP total medida, que es justo la distinción que esta magnitud existe para enseñar.
          reason:
            peepTotPrev === null
              ? peepTotDeOtraMecanica
                ? 'Pplat − PEEPe (la PEEPtot previa es de otra mecánica)'
                : 'Pplat − PEEPe al inicio de esa inspiración (sin PEEPtot medida)'
              : 'Pplat − PEEPtot (bloqueo espiratorio previo)',
        });
        values.vt = mkSample('vtHold', o.vtInspL, 'L', { ...base, quality: 'valid', reason: null });
        // Resistencia inspiratoria APARENTE: la otra mitad de lo que una oclusión enseña. La caída de presión que
        // desaparece al parar el flujo es resistiva, pero si la meseta sigue cayendo durante la oclusión (relajación
        // viscoelástica o redistribución entre unidades) esa caída también entra al numerador: con viscoelast. y
        // Rinsp=10 el número publicado llegó a 15–21. Por eso la tabla la llama «aparente» y no la equipara al
        // parámetro de vía aérea. Ojo con lo que NO es: el vaciamiento no lo gobierna ésta sino la resistencia
        // espiratoria, que en un obstructivo es mucho mayor (SC-03: 10 frente a 30). La constante de tiempo se mide
        // aparte, sobre la rama espiratoria (métrica `tauExp`).
        const rawOk = o.constantFlowInsp && o.qAtFlowEndLps >= MIN_FLOW_FOR_RAW_LPS && o.pawAtFlowEnd > o.pawEnd;
        const raw = rawOk ? (o.pawAtFlowEnd - o.pawEnd) / o.qAtFlowEndLps : null;
        const motivoRaw = o.constantFlowInsp
          ? o.qAtFlowEndLps < MIN_FLOW_FOR_RAW_LPS
            ? 'flujoInsuficienteParaR'
            : o.pawAtFlowEnd <= o.pawEnd
              ? 'sinCaidaResistiva'
              : null
          : 'sinRampaAFlujoConstante';
        values.raw = mkSample('rawHold', raw, 'cmH2O/(L/s)', {
          ...base,
          quality: raw === null ? 'invalid' : 'valid',
          reason: raw === null ? motivoRaw : this.aproximacion() + '(Ppico − Pplat) / flujo inspiratorio al ocluir',
        });
      } else {
        values.cstat = mkSample('cstatHold', null, 'L/cmH2O', {
          ...base,
          quality: 'invalid',
          reason: quality !== 'valid' ? reason : 'denominadorInsuficiente',
        });
        values.driving = mkSample('drivingHold', null, 'cmH2O', {
          ...base,
          quality: 'invalid',
          reason: quality !== 'valid' ? reason : 'denominadorInsuficiente',
        });
        values.raw = mkSample('rawHold', null, 'cmH2O/(L/s)', {
          ...base,
          quality: 'invalid',
          reason: quality !== 'valid' ? reason : 'denominadorInsuficiente',
        });
      }
    } else {
      const peepTot = quality === 'valid' ? o.pawEnd : null;
      values.peepTot = mkSample('peepTotHold', peepTot, 'cmH2O', { ...base, quality, reason });
      values.peepe = mkSample('peepeAtHold', o.peepeBeforeOcclusion, 'cmH2O', { ...base, quality, reason });
      values.peepi = mkSample('peepiHold', peepTot === null ? null : peepTot - o.peepeBeforeOcclusion, 'cmH2O', {
        ...base,
        quality,
        reason,
      });
    }
    const result: ProcedureResult = {
      procedureId: o.procedureId,
      kind: o.kind,
      phase: o.cancelled ? 'cancelled' : quality === 'valid' ? 'completed' : 'invalid',
      requestedAtMs: cur?.requestedAtMs ?? simTimeMs,
      startedAtMs: sToMs(o.startSimTimeS),
      completedAtMs: simTimeMs,
      wallTimeMs: this.wallTimeOf(simTimeMs),
      requestedDurationS: o.requestedDurationS,
      actualDurationS: o.actualDurationS,
      breathId: o.breathId,
      quality,
      reason,
      values,
      // La maniobra queda vinculada a la mecánica que la produjo: sólo las espiratorias válidas la llevan.
      ...(o.kind === 'expHold' && quality === 'valid' ? { contextSig: this.contextSig() } : {}),
    };
    // Se conserva como «último» aunque sea inválido: el usuario debe ver el motivo; un resultado válido anterior queda en el historial.
    this.last[o.kind] = result;
    this.current = null;
  }

  /** ↑O2 (D QRG 2020 p.12: 2 min, +100 % adulto; fin por tiempo, Stop, favorito o tecla). Restauración idempotente (P). */
  startO2(simTimeMs: number, currentFio2: number, deltaFraction: number, durationMs: number): { accepted: boolean; reason?: string } {
    if (this.o2?.active) return { accepted: false, reason: '↑O2 ya en curso' };
    const target = Math.min(1, currentFio2 + deltaFraction);
    this.o2 = {
      procedureId: this.nextId(),
      active: true,
      savedFio2: currentFio2,
      targetFio2: target,
      startedAtMs: simTimeMs,
      endsAtMs: simTimeMs + durationMs,
      userEditedDuring: false,
      restored: false,
      endCause: null,
    };
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
      procedureId: o.procedureId,
      kind: 'increaseO2',
      phase: cause === 'timer' ? 'completed' : 'cancelled',
      requestedAtMs: o.startedAtMs,
      startedAtMs: o.startedAtMs,
      completedAtMs: simTimeMs,
      wallTimeMs: this.wallTimeOf(simTimeMs),
      requestedDurationS: msToS(o.endsAtMs - o.startedAtMs),
      actualDurationS: msToS(simTimeMs - o.startedAtMs),
      breathId: null,
      quality: 'valid',
      reason: `fin:${cause}${o.userEditedDuring ? ';FiO2EditadaPorUsuario:noRestaurada' : ';restaurada'}`,
      values: {},
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
