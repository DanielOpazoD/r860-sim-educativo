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
 * Reglas de alarma. PRIORIDADES documentadas (D, URM SW10 2065490-001, «List of alarms - adult and pediatric», 8-8 a
 * 8-25): alta para Ppico alta y baja, apnea, desconexión, VMesp alto y bajo, FR baja, FiO2 alta y baja y PEEPe baja; media
 * para VTesp alto y bajo, FR alta y PEEPe alta. Los RETARDOS y FILTROS también son los del manual (8-25 a 8-27; véanse
 * RETARDOS_S y FILTROS). Los ENCLAVAMIENTOS siguen siendo P (U-11). Lo documentado del QRG 2020 (p.8–9): colores
 * rojo/amarillo/azul, patrones de tonos, banda gris con alarma previa por reconocer, pausa de audio de 2 minutos.
 * Documentado (D, JB79437XX): la condición de Ppico alta se evalúa sobre el valor bruto antes de actualizar la pantalla.
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
  ppeakLow: { id: 'ppeakLow', priority: 'high', message: 'Ppico baja', responseAction: 'none', latching: true, source: 'ventilator.paw' },
  /**
   * Paciente desconectado (D existencia: QRG 2020 p.13 «Patient disconnected, RR low, MVexp low, Vtexp low, Apnea and
   * other alarms may occur»; condición y prioridad P): una respiración sin presión —Ppico bajo 3 cmH2O— y sin volumen espirado.
   */
  disconnect: {
    id: 'disconnect',
    priority: 'high',
    message: 'Paciente desconectado',
    responseAction: 'none',
    latching: true,
    source: 'ventilator.paw',
  },
  /**
   * Respaldo activo: el equipo ventila en su modo de respaldo por apnea o por VMesp bajo, hasta que se confirma un modo
   * («Backup ventilation on», prioridad media, D URM SW10 8-9).
   */
  backup: {
    id: 'backup',
    priority: 'medium',
    message: 'Respaldo activo',
    responseAction: 'none',
    latching: true,
    source: 'ventilator.flow',
  },
  /** Apnea: ninguna respiración en el tiempo programado (D ficha 2014 «Alarma de apnea: 5 a 60 seg»; prioridad alta P). */
  apnea: { id: 'apnea', priority: 'high', message: 'Apnea', responseAction: 'enterBackup', latching: true, source: 'ventilator.flow' },
  vteLow: { id: 'vteLow', priority: 'medium', message: 'VTesp bajo', responseAction: 'none', latching: true, source: 'ventilator.flow' },
  vteHigh: { id: 'vteHigh', priority: 'medium', message: 'VTesp alto', responseAction: 'none', latching: true, source: 'ventilator.flow' },
  mveLow: { id: 'mveLow', priority: 'high', message: 'VMesp bajo', responseAction: 'none', latching: true, source: 'ventilator.flow' },
  mveHigh: { id: 'mveHigh', priority: 'high', message: 'VMesp alto', responseAction: 'none', latching: true, source: 'ventilator.flow' },
  rrLow: { id: 'rrLow', priority: 'high', message: 'FR baja', responseAction: 'none', latching: true, source: 'ventilator.flow' },
  rrHigh: { id: 'rrHigh', priority: 'medium', message: 'FR alta', responseAction: 'none', latching: true, source: 'ventilator.flow' },
  fio2Low: { id: 'fio2Low', priority: 'high', message: 'FiO2 baja', responseAction: 'none', latching: true, source: 'ventilator.o2' },
  fio2High: { id: 'fio2High', priority: 'high', message: 'FiO2 alta', responseAction: 'none', latching: true, source: 'ventilator.o2' },
  peepeLow: { id: 'peepeLow', priority: 'high', message: 'PEEPe baja', responseAction: 'none', latching: true, source: 'ventilator.paw' },
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

/**
 * Retardos del equipo (D, URM SW10 8-26 y 8-27, «Alarm delays»): tras el suceso, estas alarmas no se activan durante
 * el tiempo indicado. Sólo los que tienen equivalente en el simulador (sin módulo de gases ni modos de respaldo por VMesp).
 */
export const RETARDOS_S = {
  /** «60 seconds after an inspiratory or expiratory hold procedure»: la respiración ocluida alarga la ventana de VMesp y FR. */
  trasBloqueo: { s: 60, ids: ['mveLow', 'rrLow', 'fio2High', 'fio2Low'] },
  /** «60 seconds since last FiO2 setting change»: el sensor de O2 tarda en seguir al mezclador. */
  trasCambioFio2: { s: 60, ids: ['fio2High', 'fio2Low'] },
  /** «60 seconds upon transition to therapy»: al pasar de espera a ventilar. */
  alIniciarTerapia: {
    s: 60,
    ids: ['fio2High', 'fio2Low', 'mveHigh', 'mveLow', 'peepeHigh', 'peepeLow', 'rrLow', 'vteHigh', 'vteLow'],
  },
  /** «10 seconds upon transition to therapy»: Patient disconnect. */
  desconexionAlIniciar: { s: 10, ids: ['disconnect'] },
} as const;
/**
 * Alarmas que no se habilitan mientras dura un bloqueo (D, URM SW10 8-8, notas 1 y 2 de la lista): apnea, VMesp bajo y
 * FR baja en los dos; Ppico baja sólo en el espiratorio.
 */
const NO_HABILITADAS_EN_BLOQUEO: Record<'inspHold' | 'expHold', readonly string[]> = {
  inspHold: ['apnea', 'mveLow', 'rrLow'],
  expHold: ['apnea', 'mveLow', 'rrLow', 'ppeakLow'],
};
/** Filtros del equipo (D, URM SW10 8-25 y 8-26, «Alarm filters»): con la primera activa, las otras salen de la lista. */
export const FILTROS: Record<string, readonly string[]> = {
  apnea: ['vteLow', 'vteHigh', 'mveHigh', 'mveLow', 'rrLow'],
  disconnect: ['apnea', 'ppeakLow', 'vteLow', 'mveLow', 'rrLow', 'fio2Low'],
  pmax: ['ppeakLow'],
};
/** VTesp bajo exige que el volumen haya quedado bajo el límite en 3 respiraciones (D, URM SW10 8-25). */
export const VTE_LOW_BREATHS = 3;
/** Alarmas visibles: activas y no retiradas de la lista por otra. Es lo que muestra la banda y la lista del equipo. */
export const alarmaVisible = (a: AlarmState): boolean => a.conditionActive && !a.filteredBy;
/** Umbrales de la desconexión (P): sin presión de trabajo y sin volumen que vuelva. */
export const DISCONNECT_PPEAK_CMH2O = 3;
export const DISCONNECT_VTE_L = 0.02;

export interface AlarmBar {
  color: 'green' | 'red' | 'yellow' | 'blue' | 'grey';
  message: string;
  activeCount: number;
  pendingAckCount: number;
}

export class AlarmEngine {
  limits: AlarmLimits;
  private alarms = new Map<string, AlarmState>();
  /** Última respiración monitorizada y su ventana de métricas: contra ellas se compara un límite recién cambiado. */
  private lastBreath: { record: BreathRecord; metrics: Record<string, MetricSample> } | null = null;
  private lastFio2: number | null = null;
  /** Hasta cuándo (ms de simulación) cada alarma no puede activarse por un retardo del equipo. */
  private retenidaHasta = new Map<string, number>();
  /** Bloqueo en curso: sus alarmas no habilitadas no se activan. */
  private bloqueo: 'inspHold' | 'expHold' | null = null;
  /** VTesp medido de las últimas respiraciones (L), para la persistencia de VTesp bajo. */
  private vteRecientes: number[] = [];

  constructor(limits: AlarmLimits) {
    this.limits = { ...limits };
    for (const r of Object.values(ALARM_RULES)) {
      this.alarms.set(r.id, {
        id: r.id,
        priority: r.priority,
        priorityEvidence: 'D',
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
    this.aplicarFiltros();
    return [...this.alarms.values()].map((a) => ({ ...a }));
  }

  /** Marca las alarmas que otra activa retira de la lista (FILTROS). */
  private aplicarFiltros(): void {
    for (const a of this.alarms.values()) a.filteredBy = null;
    for (const [filtra, ids] of Object.entries(FILTROS)) {
      if (!this.alarms.get(filtra)?.conditionActive) continue;
      for (const id of ids) {
        const a = this.alarms.get(id);
        if (a && a.conditionActive && !a.filteredBy) a.filteredBy = filtra;
      }
    }
  }

  /** Retiene las alarmas dadas hasta `hastaMs`: no se activan antes (RETARDOS_S). Un retardo nunca acorta otro. */
  private retener(ids: readonly string[], hastaMs: number): void {
    for (const id of ids) this.retenidaHasta.set(id, Math.max(this.retenidaHasta.get(id) ?? -Infinity, hastaMs));
  }
  private retenida(id: string, simTimeMs: number): boolean {
    if (this.bloqueo && NO_HABILITADAS_EN_BLOQUEO[this.bloqueo].includes(id)) return true;
    return simTimeMs < (this.retenidaHasta.get(id) ?? -Infinity);
  }

  /** Empieza un bloqueo: sus alarmas no habilitadas quedan fuera mientras dura. */
  onHoldStart(kind: 'inspHold' | 'expHold'): void {
    this.bloqueo = kind;
  }
  /** Termina un bloqueo: VMesp bajo, FR baja y FiO2 esperan 60 s. */
  onHoldEnd(simTimeMs: number): void {
    this.bloqueo = null;
    this.retener(RETARDOS_S.trasBloqueo.ids, simTimeMs + RETARDOS_S.trasBloqueo.s * 1000);
  }
  /** Cambió la FiO2 programada (usuario, ↑O2 o su restauración): las alarmas de FiO2 esperan 60 s. */
  onFio2Changed(simTimeMs: number): void {
    this.retener(RETARDOS_S.trasCambioFio2.ids, simTimeMs + RETARDOS_S.trasCambioFio2.s * 1000);
  }
  /** De espera a ventilar: las alarmas de volumen, FR, PEEPe y FiO2 esperan 60 s; la desconexión, 10. */
  onTherapyStart(simTimeMs: number): void {
    this.retener(RETARDOS_S.alIniciarTerapia.ids, simTimeMs + RETARDOS_S.alIniciarTerapia.s * 1000);
    this.retener(RETARDOS_S.desconexionAlIniciar.ids, simTimeMs + RETARDOS_S.desconexionAlIniciar.s * 1000);
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
    // Retardo del equipo o alarma no habilitada durante un bloqueo: la condición no se anuncia todavía.
    if (this.retenida(id, simTimeMs)) return;
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

  /** El controlador declaró apnea: ninguna respiración en `apneaS` segundos. La condición dura hasta que el paciente vuelve a disparar. */
  onApnea(simTimeMs: number, apneaS: number): void {
    this.activate('apnea', simTimeMs, apneaS, apneaS, apneaS, `sin respiración en ${apneaS} s`);
  }

  /** El equipo entró en su respaldo (por apnea o por VMesp bajo) y sale al confirmar un modo. */
  onBackupStarted(simTimeMs: number, causa: 'apnea' | 'vmesp'): void {
    this.activate('backup', simTimeMs, null, null, null, causa === 'apnea' ? 'apnea detectada' : 'VMesp bajo la mitad del límite bajo');
  }
  onBackupEnded(simTimeMs: number): void {
    this.resolve('backup', simTimeMs);
  }
  /** ¿Está retenida por un retardo del equipo (o deshabilitada por un bloqueo) la alarma dada? */
  alarmaRetenida(id: string, simTimeMs: number): boolean {
    return this.retenida(id, simTimeMs);
  }

  /** Una respiración disparada por el paciente termina la apnea (las de respaldo no: son la respuesta a ella). */
  onPatientBreath(simTimeMs: number): void {
    this.resolve('apnea', simTimeMs);
  }

  /** Evaluación por respiración completa y ventana de métricas. */
  onBreath(record: BreathRecord, metrics: Record<string, MetricSample>, simTimeMs: number): void {
    this.lastBreath = { record, metrics };
    this.vteRecientes.push(record.vtExpMeasured ?? record.vtExp);
    if (this.vteRecientes.length > VTE_LOW_BREATHS) this.vteRecientes.shift();
    if (!record.pmaxReached) this.resolve('pmax', simTimeMs);
    this.checkBreathLimits(simTimeMs);
  }

  /** Compara los límites con la última respiración monitorizada. Sin ninguna, no hay nada que comparar. */
  private checkBreathLimits(simTimeMs: number): void {
    if (!this.lastBreath) return;
    const { record, metrics } = this.lastBreath;
    const L = this.limits;
    // Desconexión: el ventilador no consigue presión ni recupera volumen. Se resuelve sola en cuanto vuelve una respiración normal.
    const vteMedido = record.vtExpMeasured ?? record.vtExp;
    if (record.ppeak < DISCONNECT_PPEAK_CMH2O && vteMedido < DISCONNECT_VTE_L)
      this.activate(
        'disconnect',
        simTimeMs,
        record.ppeak,
        Math.round(record.ppeak),
        DISCONNECT_PPEAK_CMH2O,
        `Ppico ${record.ppeak.toFixed(1)} y VTe ${Math.round(vteMedido * 1000)} mL`,
      );
    else this.resolve('disconnect', simTimeMs);
    this.check('ppeakLow', simTimeMs, record.ppeak, L.ppeakLow, 'low', Math.round(record.ppeak));
    // Las alarmas de volumen comparan el valor MEDIDO, como el equipo real, no el volumen verdadero del modelo.
    const vteM = record.vtExpMeasured ?? record.vtExp;
    // VTesp bajo: las tres últimas respiraciones bajo el límite vigente (con menos, el valor que se compara es el mayor).
    const vteBajo = this.vteRecientes.length >= VTE_LOW_BREATHS ? Math.max(...this.vteRecientes) : null;
    if (vteBajo === null && L.vteLow !== 'off' && vteM >= L.vteLow) this.resolve('vteLow', simTimeMs);
    else this.check('vteLow', simTimeMs, vteBajo, L.vteLow, 'low', Math.round(litersToMl(vteM)));
    this.check('vteHigh', simTimeMs, vteM, L.vteHigh, 'high', Math.round(litersToMl(vteM)));
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
    this.lastFio2 = fio2Measured;
    this.checkFio2Limits(simTimeMs);
  }

  private checkFio2Limits(simTimeMs: number): void {
    const fio2Measured = this.lastFio2;
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

  /**
   * Un límite recién confirmado se compara enseguida con lo último medido, sin esperar a que termine la respiración en
   * curso: a 5 /min esa espera son doce segundos de banda verde con la condición ya incumplida. La hora de inicio es la
   * del cambio, que es cuando la condición pasó a ser cierta.
   */
  onLimitsChanged(simTimeMs: number): void {
    this.checkBreathLimits(simTimeMs);
    this.checkFio2Limits(simTimeMs);
  }

  /** En espera se resuelven las condiciones fisiológicas (no hay monitorización, D QRG p.14); las pendientes de reconocer permanecen. */
  onStandby(simTimeMs: number): void {
    for (const a of this.alarms.values()) this.resolve(a.id, simTimeMs);
    // Sin monitorización no queda medición con la que comparar un límite nuevo: la de antes de la espera ya no vale.
    this.lastBreath = null;
    this.lastFio2 = null;
    this.vteRecientes = [];
    this.bloqueo = null;
  }

  /** Estado de la banda (D: verde sin alarmas; color de la prioridad más alta; gris con alarma previa por reconocer). */
  bar(): AlarmBar {
    this.aplicarFiltros();
    const active = [...this.alarms.values()].filter(alarmaVisible);
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
