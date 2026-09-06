import { COMMAND_TYPES, type Command, type CommandLogEntry } from '../domain/commands';
import type { Actor, BreathRecord } from '../domain/types';
import { Simulator, type SimulatorInit } from '../engine/simulator';
import { ACCEPTED_ENGINE_VERSIONS, ENGINE_VERSION, SESSION_SCHEMA_VERSION } from '../engine/version';
import { PROFILE } from '../profiles/r860-es-photo-reference/profile';
import {
  validateDomains,
  validateEffort,
  validatePatientParams,
  validateSensors,
  validateSettingsKeys,
  validateVcSettings,
} from '../domain/validation';
import { VC_ADULT_CROSS_LIMITS, VC_ADULT_RULES } from '../profiles/r860-es-photo-reference/settings';

export interface SessionFile {
  schemaVersion: string;
  engineVersion: string;
  profileId: string;
  profileVersion: string;
  banner: string;
  exportedAtIso: string;
  init: SimulatorInit;
  commands: { simTimeMs: number; actor: Actor; command: Command }[];
  finalSimTimeMs: number;
  breaths: BreathRecord[];
}

export const MAX_SESSION_BYTES = 2 * 1024 * 1024;
export const MAX_COMMANDS = 10_000;
/** Tope de duración reproducible (4 h de tiempo simulado) para que un archivo no pueda bloquear el motor. */
export const MAX_REPLAY_MS = 4 * 3600_000;

export function exportSession(sim: Simulator): SessionFile {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    profileId: PROFILE.profileId,
    profileVersion: PROFILE.profileVersion,
    banner: PROFILE.banner,
    exportedAtIso: new Date(sim.wallTimeMs).toISOString(),
    init: JSON.parse(JSON.stringify(sim.init)) as SimulatorInit,
    commands: sim.commandLog
      .filter((c: CommandLogEntry) => c.accepted)
      .map((c) => ({ simTimeMs: c.simTimeMs, actor: c.actor, command: c.command })),
    finalSimTimeMs: sim.simTimeMs,
    breaths: sim.breaths.map((b) => ({ ...b })),
  };
}

export type ImportResult = { ok: true; session: SessionFile; warnings: string[] } | { ok: false; errors: string[] };

function allFinite(x: unknown, path: string, errors: string[], depth = 0): void {
  if (depth > 12) {
    errors.push(`${path}: anidamiento excesivo`);
    return;
  }
  if (typeof x === 'number') {
    if (!Number.isFinite(x)) errors.push(`${path}: número no finito`);
    return;
  }
  if (typeof x === 'string') {
    if (x.length > 2000) errors.push(`${path}: cadena demasiado larga`);
    return;
  }
  if (typeof x === 'function') {
    errors.push(`${path}: función no permitida`);
    return;
  }
  if (Array.isArray(x)) {
    if (x.length > 20_000) {
      errors.push(`${path}: arreglo demasiado largo`);
      return;
    }
    x.forEach((v, i) => allFinite(v, `${path}[${i}]`, errors, depth + 1));
    return;
  }
  if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) allFinite(v, `${path}.${k}`, errors, depth + 1);
  }
}

/** Importación robusta (SEC-03): tamaño, esquema, tipos, números finitos, comandos permitidos; nunca ejecuta código. */
export function importSession(text: string): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (typeof text !== 'string') return { ok: false, errors: ['Entrada no textual'] };
  if (new TextEncoder().encode(text).length > MAX_SESSION_BYTES)
    return { ok: false, errors: [`Archivo mayor que ${MAX_SESSION_BYTES} bytes`] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['JSON inválido'] };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['El documento raíz debe ser un objeto'] };
  const o = raw as Record<string, unknown>;
  const allowed = new Set([
    'schemaVersion',
    'engineVersion',
    'profileId',
    'profileVersion',
    'banner',
    'exportedAtIso',
    'init',
    'commands',
    'finalSimTimeMs',
    'breaths',
  ]);
  for (const k of Object.keys(o)) if (!allowed.has(k)) errors.push(`Clave desconocida: ${k}`);
  if (o.schemaVersion !== SESSION_SCHEMA_VERSION) errors.push(`schemaVersion no soportada: ${String(o.schemaVersion)}`);
  if (o.profileId !== PROFILE.profileId) errors.push(`profileId distinto: ${String(o.profileId)}`);
  if (typeof o.engineVersion === 'string' && o.engineVersion !== ENGINE_VERSION) {
    if (ACCEPTED_ENGINE_VERSIONS.includes(o.engineVersion))
      warnings.push(`Sesión creada con motor ${o.engineVersion}; la reproducción puede no ser idéntica`);
    else errors.push(`engineVersion no soportada: ${o.engineVersion}`);
  }
  const init = o.init as Record<string, unknown> | undefined;
  if (!init || typeof init !== 'object') errors.push('init ausente');
  else {
    for (const k of ['dtMs', 'startWallTimeMs', 'seed'] as const) if (typeof init[k] !== 'number') errors.push(`init.${k} debe ser número`);
    if (typeof init.dtMs === 'number' && (init.dtMs < 0.5 || init.dtMs > 20)) errors.push('init.dtMs fuera de 0.5–20 ms');
    for (const k of ['patient', 'effort', 'sensors', 'settings', 'alarmLimits'] as const)
      if (!init[k] || typeof init[k] !== 'object') errors.push(`init.${k} ausente`);
    if (init.settings && typeof init.settings === 'object') {
      const st = init.settings as SimulatorInit['settings'];
      const ke = validateSettingsKeys(st as unknown as Record<string, unknown>, VC_ADULT_RULES);
      if (ke.length) errors.push(...ke.map((r) => `init.settings: ${r}`));
      else {
        errors.push(...validateDomains(st, VC_ADULT_RULES).map((r) => `init.settings: ${r}`));
        errors.push(...validateVcSettings(st, VC_ADULT_CROSS_LIMITS).reasons.map((r) => `init.settings: ${r}`));
      }
    }
    if (init.effort && typeof init.effort === 'object')
      errors.push(...validateEffort(init.effort as SimulatorInit['effort']).map((r) => `init.${r}`));
    if (init.sensors && typeof init.sensors === 'object')
      errors.push(...validateSensors(init.sensors as SimulatorInit['sensors']).map((r) => `init.${r}`));
    if (init.patient && typeof init.patient === 'object')
      errors.push(...validatePatientParams(init.patient as SimulatorInit['patient']).map((r) => `init.patient: ${r}`));
    if (!(init.initialV === 'equilibrium' || (typeof init.initialV === 'number' && init.initialV >= -1 && init.initialV <= 5)))
      errors.push('init.initialV inválido');
  }
  if (
    typeof o.finalSimTimeMs !== 'number' ||
    !Number.isFinite(o.finalSimTimeMs) ||
    o.finalSimTimeMs < 0 ||
    o.finalSimTimeMs > MAX_REPLAY_MS
  )
    errors.push(`finalSimTimeMs debe ser un número entre 0 y ${MAX_REPLAY_MS} ms`);
  if (!Array.isArray(o.breaths)) errors.push('breaths debe ser un arreglo');
  const cmds = o.commands;
  if (!Array.isArray(cmds)) errors.push('commands debe ser un arreglo');
  else {
    if (cmds.length > MAX_COMMANDS) errors.push(`Más de ${MAX_COMMANDS} comandos`);
    cmds.forEach((c, i) => {
      const e = c as Record<string, unknown>;
      if (!e || typeof e !== 'object') {
        errors.push(`commands[${i}] inválido`);
        return;
      }
      if (typeof e.simTimeMs !== 'number') errors.push(`commands[${i}].simTimeMs`);
      const cmd = e.command as Record<string, unknown> | undefined;
      if (!cmd || typeof cmd.type !== 'string' || !COMMAND_TYPES.has(cmd.type)) errors.push(`commands[${i}].command.type no permitido`);
      else if (typeof e.simTimeMs === 'number' && (e.simTimeMs < 0 || e.simTimeMs > MAX_REPLAY_MS))
        errors.push(`commands[${i}].simTimeMs fuera de rango`);
      else if (['confirmSettings', 'setAlarmLimits'].includes(cmd.type) && (!cmd.changes || typeof cmd.changes !== 'object'))
        errors.push(`commands[${i}]: changes ausente`);
      else if (['setPatient', 'setEffort', 'setSensors'].includes(cmd.type) && (!cmd.params || typeof cmd.params !== 'object'))
        errors.push(`commands[${i}]: params ausente`);
      else if (cmd.type === 'requestHold' && (typeof cmd.durationS !== 'number' || !['inspHold', 'expHold'].includes(String(cmd.kind))))
        errors.push(`commands[${i}]: bloqueo inválido`);
      if (!['learner', 'instructor', 'scenario', 'system', 'controller'].includes(String(e.actor)))
        errors.push(`commands[${i}].actor inválido`);
    });
  }
  allFinite(o, 'session', errors);
  if (errors.length) return { ok: false, errors };
  return { ok: true, session: o as unknown as SessionFile, warnings };
}

/** Reproduce una sesión: misma inicialización y mismos comandos a los mismos tiempos simulados (TIM-02). */
export function replaySession(session: SessionFile, untilMs = session.finalSimTimeMs): Simulator {
  const sim = new Simulator(JSON.parse(JSON.stringify(session.init)) as SimulatorInit);
  const cmds = [...session.commands].sort((a, b) => a.simTimeMs - b.simTimeMs);
  let i = 0;
  while (sim.simTimeMs < untilMs - 1e-9) {
    while (i < cmds.length && (cmds[i] as { simTimeMs: number }).simTimeMs <= sim.simTimeMs + 1e-9) {
      const c = cmds[i] as { actor: Actor; command: Command };
      sim.command(c.command, c.actor);
      i += 1;
    }
    sim.step();
  }
  while (i < cmds.length) {
    const c = cmds[i] as { actor: Actor; command: Command };
    sim.command(c.command, c.actor);
    i += 1;
  }
  return sim;
}
