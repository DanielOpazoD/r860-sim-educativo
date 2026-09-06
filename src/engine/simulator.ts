import type { Command, CommandLogEntry, CommandResult } from '../domain/commands';
import type {
  Actor,
  AlarmLimits,
  AlarmState,
  BreathRecord,
  ControllerPhase,
  EffortParams,
  MetricSample,
  PatientParams,
  ProcedureResult,
  SensorParams,
  SessionEvent,
  VcSettings,
  VentilationState,
} from '../domain/types';
import {
  validateAlarmLimitChanges,
  validateDomains,
  validateEffort,
  validatePatientParams,
  validateSensors,
  validateSettingsKeys,
  validateVcSettings,
} from '../domain/validation';
import { executeCommand, type CommandContext } from './commandHandlers';
import type { ProfileSpec } from '../domain/profile';
import { AlarmEngine, type AlarmBar } from './alarms';
import { SimClock } from './clock';
import { VcController, type ControllerEvent } from './controller';
import { EffortGenerator } from './effort';
import { MetricEngine } from './metrics';
import { PatientModel } from './patient';
import { ProcedureManager, type O2ProcedureState } from './procedures';
import { O2Sensor, SampleRing } from './sensors';
import { ENGINE_VERSION } from './version';

export interface SimulatorInit {
  /** Perfil de equipo; ausente en sesiones anteriores a 0.3.3 (se asume el de referencia). */
  profileId?: string;
  dtMs: number;
  startWallTimeMs: number;
  seed: number;
  patient: PatientParams;
  effort: EffortParams;
  sensors: SensorParams;
  settings: VcSettings;
  alarmLimits: AlarmLimits;
  /** Volumen absoluto inicial (L) o 'equilibrium' (Crs·PEEP). */
  initialV: number | 'equilibrium';
  startVentilating: boolean;
}

export interface LiveSignals {
  paw: number;
  flowLps: number;
  volTidalL: number;
  ppeakCurrent: number | null;
  phase: ControllerPhase;
}

export interface Truth {
  vAbsL: number;
  pel: number;
  pmus: number;
  /** PEEP intrínseca verdadera al fin de la última espiración: Pel(V al inicio de la respiración en curso) − PEEP. */ peepiEndExp: number;
  patient: PatientParams;
  effort: EffortParams;
  sensors: SensorParams;
  fio2Delivered: number;
}

export interface TrendPoint {
  tMs: number;
  ppeak: number;
  peepe: number;
  vte: number;
  vti: number;
  rr: number | null;
  mve: number | null;
  pplatHold: number | null;
  cstatHold: number | null;
  type: string;
}

export interface EngineFrame {
  engineVersion: string;
  profileVersion: string;
  simTimeMs: number;
  wallTimeMs: number;
  ventilation: VentilationState;
  live: LiveSignals;
  settings: VcSettings;
  pending: Partial<VcSettings> | null;
  alarmLimits: AlarmLimits;
  metrics: Record<string, MetricSample>;
  alarms: AlarmState[];
  alarmBar: AlarmBar;
  procedure: {
    current: ProcedureResult | null;
    hold: VcController['holdState'];
    last: ProcedureManager['last'];
    o2: O2ProcedureState | null;
  };
  breathCount: number;
  audioPauseUntilMs: number | null;
  truth: Truth;
  samples: { t: Float64Array; paw: Float32Array; flow: Float32Array; vol: Float32Array; pmus: Float32Array; breath: Float32Array };
  eventsTail: SessionEvent[];
  trends: TrendPoint[];
}

/**
 * Simulador determinista (P · dossier §22): paso fijo, tiempo simulado, sin aleatoriedad en esta etapa (la semilla se
 * reserva para ruido futuro). Ningún componente de pantalla toca el estado físico; los comandos pasan por `command()`.
 */
export class Simulator {
  readonly init: SimulatorInit;
  readonly clock: SimClock;
  readonly patient: PatientModel;
  readonly effort: EffortGenerator;
  readonly controller: VcController;
  readonly o2: O2Sensor;
  readonly metrics = new MetricEngine();
  readonly alarms: AlarmEngine;
  readonly procedures: ProcedureManager;
  readonly ring: SampleRing;
  readonly events: SessionEvent[] = [];
  readonly commandLog: CommandLogEntry[] = [];
  readonly breaths: BreathRecord[] = [];
  /** Tendencias por respiración (1 punto por ciclo completo; últimos 900). */
  readonly trends: TrendPoint[] = [];
  private eventSeq = 0;
  private ventilation: VentilationState = 'standby';
  private lastMetrics: Record<string, MetricSample> = {};
  private samplesSinceFrame = 0;
  private breathVStart = 0;
  /** Pausa de audio (D 120 s) como estado del motor para que el replay la reproduzca; el audio sólo la lee. */
  audioPauseUntilMs: number | null = null;

  constructor(
    init: SimulatorInit,
    readonly profile: ProfileSpec,
  ) {
    if (init.profileId !== undefined && init.profileId !== profile.profileId)
      throw new Error(`Inicialización inválida: perfil ${init.profileId} distinto del inyectado ${profile.profileId}`);
    const errs = [
      ...validateSettingsKeys(init.settings as unknown as Record<string, unknown>, profile.rules),
      ...validateDomains(init.settings, profile.rules),
      ...validateVcSettings(init.settings, profile.crossLimits).reasons,
      ...validatePatientParams(init.patient),
      ...validateEffort(init.effort),
      ...validateSensors(init.sensors),
    ];
    if (!(init.dtMs >= 0.5 && init.dtMs <= 20)) errs.push('dtMs fuera de 0.5–20 ms');
    const al = validateAlarmLimitChanges(init.alarmLimits, profile.alarmLimitRules, {});
    if (!al.ok) errs.push(...al.reasons);
    if (!Number.isFinite(init.startWallTimeMs)) errs.push('startWallTimeMs no finito');
    if (errs.length) throw new Error(`Inicialización inválida: ${errs.join('; ')}`);
    this.init = init;
    this.clock = new SimClock(init.dtMs, init.startWallTimeMs);
    const peep = init.settings.peep === 'off' ? 0 : init.settings.peep;
    const v0 = init.initialV === 'equilibrium' ? init.patient.crs * (peep - init.patient.p0) : init.initialV;
    this.patient = new PatientModel(init.patient, v0);
    this.effort = new EffortGenerator(init.effort);
    this.controller = new VcController(this.patient, this.effort, init.settings);
    this.o2 = new O2Sensor(init.sensors, init.settings.fio2);
    this.alarms = new AlarmEngine(init.alarmLimits);
    this.procedures = new ProcedureManager(this.controller, (ms) => init.startWallTimeMs + ms);
    this.ring = new SampleRing(Math.ceil(30_000 / init.dtMs));
    this.breathVStart = v0;
    if (init.startVentilating) {
      this.ventilation = 'ventilating';
      this.controller.paw = peep; // la vía aérea parte a PEEP en equilibrio
      this.controller.startVentilation();
      this.logEvent('state', 'system', { ventilation: 'ventilating', reason: 'inicio' });
    } else {
      this.logEvent('state', 'system', { ventilation: 'standby', reason: 'inicio' });
    }
    this.drainController();
  }

  get simTimeMs(): number {
    return this.clock.simTimeMs;
  }
  get wallTimeMs(): number {
    return this.clock.wallTimeMs;
  }
  get ventilationState(): VentilationState {
    return this.ventilation;
  }
  get lastMetricsSnapshot(): Record<string, MetricSample> {
    return this.lastMetrics;
  }

  private logEvent(kind: SessionEvent['kind'], actor: Actor, payload: unknown): void {
    this.eventSeq += 1;
    this.events.push({
      sequence: this.eventSeq,
      simTimeMs: this.clock.simTimeMs,
      wallTimeIso: new Date(this.clock.wallTimeMs).toISOString(),
      kind,
      actor,
      payload,
      profileVersion: this.profile.profileVersion,
      engineVersion: ENGINE_VERSION,
    });
    if (this.events.length > 5000) this.events.splice(0, this.events.length - 5000);
  }

  /** Registro de eventos de sistema/escenario desde el anfitrión (pausas, discontinuidades, carga de escenario). */
  noteEvent(kind: SessionEvent['kind'], actor: Actor, payload: unknown): void {
    this.logEvent(kind, actor, payload);
  }

  command(cmd: Command, actor: Actor = 'learner'): CommandResult {
    const res = this.execute(cmd, actor);
    this.commandLog.push({
      simTimeMs: this.clock.simTimeMs,
      actor,
      command: cmd,
      accepted: res.accepted,
      ...(res.reason ? { reason: res.reason } : {}),
    });
    if (!res.accepted) this.logEvent('rejected', actor, { command: cmd.type, reason: res.reason });
    this.drainController();
    return res;
  }

  /** Vista del simulador que ven los manejadores de comandos (ver commandHandlers.ts). */
  private commandContext(): CommandContext {
    return {
      profile: this.profile,
      controller: this.controller,
      patient: this.patient,
      effort: this.effort,
      o2: this.o2,
      alarms: this.alarms,
      procedures: this.procedures,
      metrics: this.metrics,
      simTimeMs: this.clock.simTimeMs,
      ventilation: () => this.ventilation,
      setVentilation: (v) => {
        this.ventilation = v;
      },
      setAudioPauseUntil: (ms) => {
        this.audioPauseUntilMs = ms;
        return ms;
      },
      logEvent: (k, a, p) => this.logEvent(k, a, p),
      drainController: () => this.drainController(),
    };
  }

  private execute(cmd: Command, actor: Actor): CommandResult {
    return executeCommand(this.commandContext(), cmd, actor);
  }

  private drainController(): void {
    const evs: ControllerEvent[] = this.controller.drainEvents();
    for (const ev of evs) this.handleControllerEvent(ev);
  }

  private handleControllerEvent(ev: ControllerEvent): void {
    const t = this.clock.simTimeMs;
    switch (ev.type) {
      case 'breathStart':
        this.breathVStart = ev.vStartL;
        break;
      case 'stepGuardExhausted':
        this.logEvent('discontinuity', 'system', { reason: 'límite de sub-pasos agotado', phase: ev.phase, simTimeS: ev.simTimeS });
        break;
      case 'breathEnd': {
        this.breaths.push(ev.record);
        if (this.breaths.length > 2000) this.breaths.shift();
        this.metrics.onBreath(ev.record);
        this.lastMetrics = this.metrics.compute(this.metricContext());
        this.trends.push({
          tMs: ev.record.endSimTimeMs,
          ppeak: ev.record.ppeak,
          peepe: ev.record.peepe,
          vte: ev.record.vtExp,
          vti: ev.record.vtInsp,
          rr: this.lastMetrics.rr?.value ?? null,
          mve: this.lastMetrics.mve?.value ?? null,
          pplatHold: this.procedures.last.inspHold?.values.pplat?.value ?? null,
          cstatHold: this.procedures.last.inspHold?.values.cstat?.value ?? null,
          type: ev.record.type,
        });
        if (this.trends.length > 900) this.trends.shift();
        this.alarms.onBreath(ev.record, this.lastMetrics, t);
        this.logEvent('breath', 'controller', {
          breathId: ev.record.breathId,
          type: ev.record.type,
          cause: ev.record.cyclingCause,
          vte: ev.record.vtExp,
          ppeak: ev.record.ppeak,
        });
        break;
      }
      case 'pmaxReached':
        this.alarms.onPmaxReached(
          t,
          ev.paw,
          this.controller.currentPpeak === null ? null : Math.round(this.controller.currentPpeak),
          this.controller.settings.pmax,
        );
        this.logEvent('alarm', 'controller', { pmaxReached: ev.paw, breathId: ev.breathId });
        break;
      case 'plimitReached':
        this.logEvent('breath', 'controller', { plimitReached: ev.paw, breathId: ev.breathId });
        break;
      case 'trigger':
        this.logEvent('breath', 'controller', { trigger: ev.qLps, breathId: ev.breathId });
        break;
      case 'holdStarted':
      case 'holdEnded':
      case 'rejected':
        this.procedures.onControllerEvent(ev, t);
        this.logEvent(
          'procedure',
          'controller',
          ev.type === 'holdEnded'
            ? {
                holdEnded: ev.outcome.procedureId,
                cancelled: ev.outcome.cancelled,
                quality: this.procedures.last[ev.outcome.kind]?.quality,
              }
            : ev,
        );
        break;
      case 'settingsApplied':
        // Única fuente del objetivo del mezclador: todo cambio de FiO2 aplicado (usuario, ↑O2, restauración) llega por aquí.
        if (ev.changes.fio2 !== undefined) this.o2.setTarget(ev.changes.fio2);
        this.logEvent('setting', 'controller', { applied: ev.changes, breathId: ev.breathId });
        break;
      default:
        break;
    }
  }

  private metricContext() {
    return {
      simTimeMs: this.clock.simTimeMs,
      ventilating: this.ventilation === 'ventilating',
      fio2Measured: this.o2.measured,
      tCycleS: this.controller.timing.tCycleS,
    };
  }

  /** Un paso fijo del reloj simulado. */
  step(): void {
    const dtS = this.clock.dtMs / 1000;
    this.controller.step(dtS);
    this.clock.tick(); // el reloj representa el FIN del paso cuando se procesan los eventos
    this.o2.step(dtS);
    this.drainController();
    this.alarms.onSensor(this.clock.simTimeMs, this.ventilation === 'ventilating' ? this.o2.measured : null);
    this.procedures.step(this.clock.simTimeMs);
    this.drainController();
    const vol = this.patient.v - this.breathVStart;
    this.ring.push(
      this.clock.simTimeMs,
      this.controller.paw,
      this.controller.q,
      vol,
      this.effort.pmusAt(this.clock.simTimeMs / 1000),
      this.controller.currentBreathSequence,
    );
    this.samplesSinceFrame += 1;
  }

  /** Avanza `ms` de tiempo simulado (múltiplo de dt). */
  run(ms: number): void {
    const n = Math.round(ms / this.clock.dtMs);
    for (let i = 0; i < n; i++) this.step();
  }

  frame(): EngineFrame {
    const t = this.clock.simTimeMs;
    // Las métricas por respiración cambian al cerrar cada ciclo; FiO2 y la calidad «antiguo» dependen del tiempo: se recalculan en cada cuadro.
    this.lastMetrics = this.metrics.compute(this.metricContext());
    const n = this.samplesSinceFrame;
    this.samplesSinceFrame = 0;
    const eventsTail = this.events.slice(-80);
    return {
      engineVersion: ENGINE_VERSION,
      profileVersion: this.profile.profileVersion,
      simTimeMs: t,
      wallTimeMs: this.clock.wallTimeMs,
      ventilation: this.ventilation,
      live: {
        paw: this.controller.paw,
        flowLps: this.controller.q,
        volTidalL: this.patient.v - this.breathVStart,
        ppeakCurrent: this.controller.currentPpeak,
        phase: this.controller.phase,
      },
      settings: { ...this.controller.settings },
      pending: this.controller.pending ? { ...this.controller.pending } : null,
      alarmLimits: { ...this.alarms.limits },
      metrics: this.lastMetrics,
      alarms: this.alarms.list(),
      alarmBar: this.alarms.bar(),
      procedure: {
        current: this.procedures.current,
        hold: this.controller.holdState,
        last: { ...this.procedures.last },
        o2: this.procedures.o2 ? { ...this.procedures.o2 } : null,
      },
      breathCount: this.breaths.length,
      audioPauseUntilMs: this.audioPauseUntilMs,
      truth: {
        vAbsL: this.patient.v,
        pel: this.patient.pel(),
        pmus: this.effort.pmusAt(t / 1000),
        peepiEndExp: Math.max(0, this.patient.pel(this.breathVStart) - this.controller.peepTarget),
        patient: { ...this.patient.params },
        effort: { ...this.effort.params },
        sensors: { ...this.o2.params },
        fio2Delivered: this.o2.delivered,
      },
      samples: this.ring.last(n),
      eventsTail,
      trends: this.trends.slice(-600),
    };
  }
}
