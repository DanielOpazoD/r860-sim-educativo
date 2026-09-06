import type { Command, CommandResult } from '../domain/commands';
import type { Actor, AlarmLimits, SessionEvent, VcSettings, VentilationState } from '../domain/types';
import type { ProfileSpec } from '../domain/profile';
import {
  isOnGrid,
  validateAlarmLimitChanges,
  validateDomains,
  validateEffort,
  validatePatientParams,
  validateSensors,
  validateSettingsKeys,
  validateVcSettings,
} from '../domain/validation';
import type { AlarmEngine } from './alarms';
import type { VcController } from './controller';
import type { EffortGenerator } from './effort';
import type { MetricEngine } from './metrics';
import type { PatientModel } from './patient';
import type { ProcedureManager } from './procedures';
import type { O2Sensor } from './sensors';

/**
 * Lo que un comando puede tocar del simulador. Es la única puerta de mutación: cada manejador valida, aplica y registra.
 * Mantenerlo como interfaz (y no como la clase Simulator) deja explícito el alcance de cada comando y facilita probarlos aislados.
 */
export interface CommandContext {
  readonly profile: ProfileSpec;
  readonly controller: VcController;
  readonly patient: PatientModel;
  readonly effort: EffortGenerator;
  readonly o2: O2Sensor;
  readonly alarms: AlarmEngine;
  readonly procedures: ProcedureManager;
  readonly metrics: MetricEngine;
  readonly simTimeMs: number;
  ventilation(): VentilationState;
  setVentilation(v: VentilationState): void;
  setAudioPauseUntil(ms: number): number;
  logEvent(kind: SessionEvent['kind'], actor: Actor, payload: unknown): void;
  /** Vacía la cola de eventos del controlador (necesario cuando un comando debe ver sus consecuencias antes de seguir). */
  drainController(): void;
}

type Handler<T extends Command['type']> = (ctx: CommandContext, cmd: Extract<Command, { type: T }>, actor: Actor) => CommandResult;
type Handlers = { [T in Command['type']]: Handler<T> };

const ok: CommandResult = { accepted: true };
const reject = (reason: string): CommandResult => ({ accepted: false, reason });

/** Manejadores por tipo de comando. El orden validar → aplicar → registrar es el contrato de cada uno. */
export const COMMAND_HANDLERS: Handlers = {
  confirmSettings: (ctx, cmd, actor) => {
    if (!cmd.changes || typeof cmd.changes !== 'object') return reject('Cambios inválidos');
    const keyErrs = validateSettingsKeys(cmd.changes as Record<string, unknown>, ctx.profile.rules);
    if (keyErrs.length) return reject(keyErrs.join(' '));
    const next: VcSettings = { ...ctx.controller.settings, ...(ctx.controller.pending ?? {}), ...cmd.changes };
    const dom = validateDomains(next, ctx.profile.rules);
    const v = validateVcSettings(next, ctx.profile.crossLimits);
    if (dom.length || !v.ok) return reject([...dom, ...v.reasons].join('; '));
    const old: Partial<VcSettings> = {};
    for (const k of Object.keys(cmd.changes) as (keyof VcSettings)[]) (old as Record<string, unknown>)[k] = ctx.controller.settings[k];
    if ('fio2' in cmd.changes && cmd.changes.fio2 !== undefined && actor === 'learner') ctx.procedures.noteUserFio2Edit();
    ctx.controller.applySettings(cmd.changes);
    ctx.logEvent('setting', actor, { changes: cmd.changes, old, policy: 'nextBreath salvo Pmáx/FiO2 inmediato (P)', derived: v.derived });
    return ok;
  },
  setAlarmLimits: (ctx, cmd, actor) => {
    const v = validateAlarmLimitChanges(
      cmd.changes,
      ctx.profile.alarmLimitRules,
      ctx.alarms.limits as unknown as Record<string, number | 'off'>,
    );
    if (!v.ok) return reject(v.reasons.join(' '));
    ctx.alarms.setLimits(v.clean as Partial<AlarmLimits>);
    ctx.logEvent('alarm', actor, { limits: v.clean });
    return ok;
  },
  enterStandby: (ctx, _cmd, actor) => {
    if (ctx.ventilation() === 'standby') return reject('Ya en espera');
    ctx.procedures.onStandby(ctx.simTimeMs);
    ctx.controller.enterStandby();
    ctx.drainController(); // cerrar bloqueos/ajustes pendientes ANTES de apagar monitorización
    ctx.alarms.onStandby(ctx.simTimeMs);
    ctx.metrics.reset();
    ctx.setVentilation('standby');
    ctx.logEvent('state', actor, { ventilation: 'standby' });
    return ok;
  },
  startVentilation: (ctx, _cmd, actor) => {
    if (ctx.ventilation() === 'ventilating') return reject('Ya ventilando');
    ctx.setVentilation('ventilating');
    ctx.controller.startVentilation();
    ctx.logEvent('state', actor, { ventilation: 'ventilating' });
    return ok;
  },
  requestHold: (ctx, cmd, actor) => {
    if (ctx.ventilation() !== 'ventilating') return reject('En espera: no elegible');
    if (cmd.kind !== 'inspHold' && cmd.kind !== 'expHold') return reject('Tipo de bloqueo desconocido');
    const holdRule = ctx.profile.holdRules[cmd.kind];
    const hd = holdRule.domain[0];
    if (typeof cmd.durationS !== 'number' || !Number.isFinite(cmd.durationS) || !isOnGrid(holdRule, cmd.durationS))
      return reject(`Duración de bloqueo no admitida (${hd?.min}–${hd?.max} s en pasos de ${hd?.step} s)`);
    const r = ctx.procedures.requestHold(cmd.kind, cmd.durationS, ctx.simTimeMs);
    if (r.accepted)
      ctx.logEvent('procedure', actor, { kind: cmd.kind, durationS: cmd.durationS, procedureId: r.procedureId, phase: 'queued' });
    return r;
  },
  cancelProcedure: (ctx, cmd, actor) => {
    const done = ctx.procedures.cancel(cmd.procedureId);
    if (done) ctx.logEvent('procedure', actor, { cancel: cmd.procedureId ?? 'current' });
    return done ? ok : reject('No hay procedimiento que cancelar (idempotente)');
  },
  manualBreath: (ctx, _cmd, actor) => {
    const r = ctx.controller.requestManualBreath();
    if (r.accepted) ctx.logEvent('procedure', actor, { kind: 'manualBreath' });
    return r;
  },
  increaseO2Start: (ctx, cmd, actor) => {
    if (ctx.ventilation() !== 'ventilating') return reject('En espera: no elegible');
    const delta = cmd.deltaFraction ?? ctx.profile.increaseO2DeltaFraction;
    if (typeof delta !== 'number' || !Number.isFinite(delta) || delta < 0.05 || delta > 1)
      return reject('Incremento de O2 inválido (5–100 % sobre el ajuste; D ficha 2014)');
    const r = ctx.procedures.startO2(ctx.simTimeMs, ctx.controller.settings.fio2, delta, ctx.profile.increaseO2Ms);
    if (r.accepted)
      ctx.logEvent('procedure', actor, {
        kind: 'increaseO2',
        phase: 'started',
        target: ctx.controller.settings.fio2,
        deltaFraction: delta,
        durationMs: ctx.profile.increaseO2Ms,
      });
    return r;
  },
  increaseO2Stop: (ctx, _cmd, actor) => {
    const done = ctx.procedures.endO2(ctx.simTimeMs, 'user');
    if (done) ctx.logEvent('procedure', actor, { kind: 'increaseO2', phase: 'stopped' });
    return done ? ok : reject('↑O2 no está en curso');
  },
  acknowledgeAlarms: (ctx, cmd, actor) => {
    ctx.alarms.acknowledge(ctx.simTimeMs, cmd.id);
    ctx.logEvent('alarm', actor, { acknowledge: cmd.id ?? 'all' });
    return ok;
  },
  audioPause: (ctx, _cmd, actor) => {
    const until = ctx.setAudioPauseUntil(ctx.simTimeMs + ctx.profile.audioPauseMs);
    ctx.logEvent('audio', actor, { pauseMs: ctx.profile.audioPauseMs, until, evidence: 'D QRG 2020 p.4' });
    return ok;
  },
  setPatient: (ctx, cmd, actor) => {
    const p = { ...ctx.patient.params, ...cmd.params };
    const pe = validatePatientParams(p);
    if (pe.length) return reject(`Parámetros de paciente inválidos: ${pe.join('; ')}`);
    ctx.patient.params = p;
    ctx.logEvent('scenario', actor, { patient: cmd.params });
    return ok;
  },
  setEffort: (ctx, cmd, actor) => {
    const e = { ...ctx.effort.params, ...cmd.params };
    const ee = validateEffort(e);
    if (ee.length) return reject(ee.join('; '));
    ctx.effort.params = e;
    ctx.logEvent('scenario', actor, { effort: cmd.params });
    return ok;
  },
  setSensors: (ctx, cmd, actor) => {
    const sp = { ...ctx.o2.params, ...cmd.params };
    const se = validateSensors(sp);
    if (se.length) return reject(se.join('; '));
    ctx.o2.params = sp;
    ctx.logEvent('scenario', actor, { sensors: cmd.params });
    return ok;
  },
  setLungVolume: (ctx, cmd, actor) => {
    if (!Number.isFinite(cmd.vAbsL) || cmd.vAbsL < -1 || cmd.vAbsL > 5) return reject('Volumen fuera de rango de ensayo');
    ctx.patient.v = cmd.vAbsL;
    ctx.logEvent('scenario', actor, { vAbsL: cmd.vAbsL });
    return ok;
  },
};

/** Despacha un comando a su manejador; un tipo desconocido (p. ej. de una sesión manipulada) se rechaza sin lanzar. */
export function executeCommand(ctx: CommandContext, cmd: Command, actor: Actor): CommandResult {
  const h = (COMMAND_HANDLERS as Record<string, Handler<Command['type']> | undefined>)[cmd.type];
  if (!h) return reject('Comando desconocido');
  return h(ctx, cmd as never, actor);
}
