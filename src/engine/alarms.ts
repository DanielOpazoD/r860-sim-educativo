import type { AlarmLimits, AlarmPriority, AlarmResponse, AlarmState, BreathRecord, MetricSample } from '../domain/types';
import { fractionToPercent, litersToMl } from '../domain/units';

interface RuleDef {
  id: string;
  priority: AlarmPriority;
  message: string;
  responseAction: AlarmResponse;
  latching: boolean;
  source: string;
}

/**
 * Reglas de alarma de esta etapa. PRIORIDADES, RETARDOS Y ENCLAVAMIENTOS SON PROPUESTAS (P), no tabla GE (U-11).
 * Lo documentado (D, QRG 2020 p.8–9): colores rojo/amarillo/azul, patrones de tonos, banda gris con alarma previa por reconocer,
 * pausa de audio de 2 minutos. Documentado (D, JB79437XX): la condición de Ppico alta se evalúa sobre el valor bruto antes de
 * actualizar la pantalla; Pmáx limita la entrega en modos adaptativos. Fin de inspiración por Pmáx: D vía dossier [04].
 */
export const ALARM_RULES: Record<string, RuleDef> = {
  pmax: {
    id: 'pmax',
    priority: 'high',
    message: 'Pmáx alcanzada (Ppico alta)',
    responseAction: 'endInspiration',
    latching: true,
    source: 'ventilator.paw',
  },
  plimit: {
    id: 'plimit',
    priority: 'medium',
    message: 'Presión limitada por Plimit',
    responseAction: 'none',
    latching: true,
    source: 'ventilator.paw',
  },
  ppeakLow: { id: 'ppeakLow', priority: 'medium', message: 'Ppico baja', responseAction: 'none', latching: true, source: 'ventilator.paw' },
  vteLow: { id: 'vteLow', priority: 'medium', message: 'VTesp bajo', responseAction: 'none', latching: true, source: 'ventilator.flow' },
  vteHigh: { id: 'vteHigh', priority: 'medium', message: 'VTesp alto', responseAction: 'none', latching: true, source: 'ventilator.flow' },
  mveLow: { id: 'mveLow', priority: 'high', message: 'VMesp bajo', responseAction: 'none', latching: true, source: 'ventilator.flow' },
  mveHigh: { id: 'mveHigh', priority: 'medium', message: 'VMesp alto', responseAction: 'none', latching: true, source: 'ventilator.flow' },
  rrLow: { id: 'rrLow', priority: 'medium', message: 'FR baja', responseAction: 'none', latching: true, source: 'ventilator.flow' },
  rrHigh: { id: 'rrHigh', priority: 'medium', message: 'FR alta', responseAction: 'none', latching: true, source: 'ventilator.flow' },
  fio2Low: { id: 'fio2Low', priority: 'medium', message: 'FiO2 baja', responseAction: 'none', latching: true, source: 'ventilator.o2' },
  fio2High: { id: 'fio2High', priority: 'medium', message: 'FiO2 alta', responseAction: 'none', latching: true, source: 'ventilator.o2' },
  peepeLow: { id: 'peepeLow', priority: 'medium', message: 'PEEPe baja', responseAction: 'none', latching: true, source: 'ventilator.paw' },
  peepeHigh: {
    id: 'peepeHigh',
    priority: 'medium',
    message: 'PEEPe alta',
    responseAction: 'none',
    latching: true,
    source: 'ventilator.paw',
  },
};

const PRIORITY_RANK: Record<AlarmPriority, number> = { high: 3, medium: 2, informational: 1 };

export interface AlarmBar {
  color: 'green' | 'red' | 'yellow' | 'blue' | 'grey';
  message: string;
  activeCount: number;
  pendingAckCount: number;
}

export class AlarmEngine {
  limits: AlarmLimits;
  private alarms = new Map<string, AlarmState>();

  constructor(limits: AlarmLimits) {
    this.limits = { ...limits };
    for (const r of Object.values(ALARM_RULES)) {
      this.alarms.set(r.id, {
        id: r.id,
        priority: r.priority,
        priorityEvidence: 'P',
        source: r.source,
        message: r.message,
        conditionActive: false,
        onsetAtMs: null,
        resolvedAtMs: null,
        acknowledgedAtMs: null,
        displayedValueAtOnset: null,
        rawValueAtOnset: null,
        threshold: null,
        conditionReason: '',
        responseAction: r.responseAction,
        latching: r.latching,
      });
    }
  }

  setLimits(changes: Partial<AlarmLimits>): void {
    this.limits = { ...this.limits, ...changes };
  }

  list(): AlarmState[] {
    return [...this.alarms.values()].map((a) => ({ ...a }));
  }

  get(id: string): AlarmState | undefined {
    return this.alarms.get(id);
  }

  private activate(
    id: string,
    simTimeMs: number,
    raw: number | null,
    displayed: number | null,
    threshold: number | null,
    reason: string,
  ): void {
    const a = this.alarms.get(id);
    if (!a) return;
    if (a.conditionActive) {
      a.conditionReason = reason;
      return;
    }
    a.conditionActive = true;
    a.onsetAtMs = simTimeMs;
    a.resolvedAtMs = null;
    a.acknowledgedAtMs = null;
    a.rawValueAtOnset = raw;
    a.displayedValueAtOnset = displayed;
    a.threshold = threshold;
    a.conditionReason = reason;
  }

  private resolve(id: string, simTimeMs: number): void {
    const a = this.alarms.get(id);
    if (!a || !a.conditionActive) return;
    a.conditionActive = false;
    a.resolvedAtMs = simTimeMs;
  }

  /** Reconocer no resuelve la condición física; resolver no reconoce. */
  acknowledge(simTimeMs: number, id?: string): void {
    for (const a of this.alarms.values()) {
      if (id && a.id !== id) continue;
      if (a.conditionActive || (a.resolvedAtMs !== null && a.acknowledgedAtMs === null)) a.acknowledgedAtMs = simTimeMs;
    }
  }

  /** Evento de Pmáx sobre el canal bruto (antes de redondear y antes de refrescar pantalla). */
  onPmaxReached(simTimeMs: number, rawPaw: number, displayedPpeak: number | null, pmax: number): void {
    this.activate('pmax', simTimeMs, rawPaw, displayedPpeak, pmax, `Paw ${rawPaw.toFixed(2)} ≥ Pmáx ${pmax}`);
  }

  private check(
    id: string,
    simTimeMs: number,
    value: number | null,
    limit: number | 'off',
    kind: 'low' | 'high',
    displayed: number | null,
  ): void {
    // Off no es cero: la alarma no se evalúa; si estaba activa, se resuelve y se da por reconocida porque el usuario la desactivó (P).
    if (limit === 'off') {
      const a = this.alarms.get(id);
      if (a?.conditionActive) {
        this.resolve(id, simTimeMs);
        a.acknowledgedAtMs = simTimeMs;
      }
      return;
    }
    if (value === null) return; // dato ausente: ni alarma ni valor normal (ALM-07)
    const out = kind === 'low' ? value < limit : value > limit;
    if (out) this.activate(id, simTimeMs, value, displayed, limit, `${kind === 'low' ? '<' : '>'} ${limit}`);
    else this.resolve(id, simTimeMs);
  }

  /** Evaluación por respiración completa y ventana de métricas. */
  onBreath(record: BreathRecord, metrics: Record<string, MetricSample>, simTimeMs: number): void {
    const L = this.limits;
    if (!record.pmaxReached) this.resolve('pmax', simTimeMs);
    // Aviso (P, E-036): la inspiración terminó limitada por Plimit; el VT entregado puede ser menor que el programado.
    if (record.plimitReached)
      this.activate(
        'plimit',
        simTimeMs,
        record.ppeak,
        Math.round(record.ppeak),
        null,
        `inspiración limitada por Plimit; VTi ${Math.round(litersToMl(record.vtInsp))} mL`,
      );
    else this.resolve('plimit', simTimeMs);
    this.check('ppeakLow', simTimeMs, record.ppeak, L.ppeakLow, 'low', Math.round(record.ppeak));
    this.check('vteLow', simTimeMs, record.vtExp, L.vteLow, 'low', Math.round(litersToMl(record.vtExp)));
    this.check('vteHigh', simTimeMs, record.vtExp, L.vteHigh, 'high', Math.round(litersToMl(record.vtExp)));
    this.check('peepeLow', simTimeMs, record.peepe, L.peepeLow, 'low', Math.round(record.peepe));
    this.check('peepeHigh', simTimeMs, record.peepe, L.peepeHigh, 'high', Math.round(record.peepe));
    const mve = metrics.mve?.quality === 'valid' ? metrics.mve.value : null;
    const rr = metrics.rr?.quality === 'valid' ? metrics.rr.value : null;
    this.check('mveLow', simTimeMs, mve, L.mveLow, 'low', mve === null ? null : Math.round(mve * 10) / 10);
    this.check('mveHigh', simTimeMs, mve, L.mveHigh, 'high', mve === null ? null : Math.round(mve * 10) / 10);
    this.check('rrLow', simTimeMs, rr, L.rrLow, 'low', rr === null ? null : Math.round(rr));
    this.check('rrHigh', simTimeMs, rr, L.rrHigh, 'high', rr === null ? null : Math.round(rr));
  }

  onSensor(simTimeMs: number, fio2Measured: number | null): void {
    this.check(
      'fio2Low',
      simTimeMs,
      fio2Measured,
      this.limits.fio2Low,
      'low',
      fio2Measured === null ? null : Math.round(fractionToPercent(fio2Measured)),
    );
    this.check(
      'fio2High',
      simTimeMs,
      fio2Measured,
      this.limits.fio2High,
      'high',
      fio2Measured === null ? null : Math.round(fractionToPercent(fio2Measured)),
    );
  }

  /** En espera se resuelven las condiciones fisiológicas (no hay monitorización, D QRG p.14); las pendientes de reconocer permanecen. */
  onStandby(simTimeMs: number): void {
    for (const a of this.alarms.values()) this.resolve(a.id, simTimeMs);
  }

  /** Estado de la banda (D: verde sin alarmas; color de la prioridad más alta; gris con alarma previa por reconocer). */
  bar(): AlarmBar {
    const active = [...this.alarms.values()].filter((a) => a.conditionActive);
    const pending = [...this.alarms.values()].filter(
      (a) => !a.conditionActive && a.latching && a.resolvedAtMs !== null && a.acknowledgedAtMs === null,
    );
    if (active.length) {
      active.sort((x, y) => PRIORITY_RANK[y.priority] - PRIORITY_RANK[x.priority] || (y.onsetAtMs ?? 0) - (x.onsetAtMs ?? 0));
      const top = active[0] as AlarmState;
      const color = top.priority === 'high' ? 'red' : top.priority === 'medium' ? 'yellow' : 'blue';
      return { color, message: top.message, activeCount: active.length, pendingAckCount: pending.length };
    }
    if (pending.length) return { color: 'grey', message: 'Alarma previa: reconocer (P)', activeCount: 0, pendingAckCount: pending.length };
    return { color: 'green', message: 'Sin alarmas', activeCount: 0, pendingAckCount: 0 };
  }
}
