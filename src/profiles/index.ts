import type { ProfileSpec } from '../domain/profile';
import type { EffortParams, PatientParams, SensorParams } from '../domain/types';
import type { SimulatorInit } from '../engine/simulator';
import { PROFILE } from './r860-es-photo-reference/profile';
import {
  ALARM_LIMIT_RULES,
  DEFAULT_ALARM_LIMITS,
  DEFAULT_VC_SETTINGS,
  EXP_HOLD_RULE,
  INSP_HOLD_RULE,
  VC_ADULT_CROSS_LIMITS,
  VC_ADULT_RULES,
} from './r860-es-photo-reference/settings';

/** Perfil de referencia fotográfica del R860 (adulto, es-CL) como contrato inyectable. */
export const R860_PROFILE: ProfileSpec = {
  profileId: PROFILE.profileId,
  profileVersion: PROFILE.profileVersion,
  banner: PROFILE.banner,
  rules: VC_ADULT_RULES,
  crossLimits: VC_ADULT_CROSS_LIMITS,
  alarmLimitRules: ALARM_LIMIT_RULES,
  holdRules: { inspHold: INSP_HOLD_RULE, expHold: EXP_HOLD_RULE },
  defaults: { settings: DEFAULT_VC_SETTINGS, alarmLimits: DEFAULT_ALARM_LIMITS },
  enabledModes: PROFILE.enabledModes,
  audioPauseMs: PROFILE.audioPauseMs,
  increaseO2Ms: PROFILE.increaseO2Ms,
  increaseO2DeltaFraction: PROFILE.increaseO2DeltaFraction,
  editTimeoutMs: PROFILE.editTimeoutMs,
};

const REGISTRY: Record<string, ProfileSpec> = { [R860_PROFILE.profileId]: R860_PROFILE };
export const DEFAULT_PROFILE = R860_PROFILE;

/** Devuelve el perfil por id; null si no está registrado (la importación de sesiones lo convierte en error legible). */
export function findProfile(id: string | undefined): ProfileSpec | null {
  if (id === undefined) return DEFAULT_PROFILE;
  return REGISTRY[id] ?? null;
}
/** Perfil de una inicialización: el declarado o el de referencia. Lanza si el id no existe. */
export function profileFor(init: Pick<SimulatorInit, 'profileId'>): ProfileSpec {
  const p = findProfile(init.profileId);
  if (!p) throw new Error(`Perfil desconocido: ${String(init.profileId)}`);
  return p;
}

export const DEFAULT_PATIENT: PatientParams = { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 };
export const DEFAULT_EFFORT: EffortParams = { enabled: false, amplitude: 0, ratePerMin: 12, tiS: 0.8, phaseS: 0, shape: 'riseRelax' };
export const DEFAULT_SENSORS: SensorParams = { fio2TauS: 6, fio2Bias: 0 };

/** Inicialización de referencia (banco SC-01) sobre el perfil R860. */
export function defaultInit(overrides: Partial<SimulatorInit> = {}, profile: ProfileSpec = DEFAULT_PROFILE): SimulatorInit {
  return {
    profileId: profile.profileId,
    dtMs: 4,
    startWallTimeMs: Date.UTC(2026, 7, 18, 21, 4, 5) + 4 * 3600_000, // 18-Ago-2026 21:04:05 hora local Chile (UTC-4)
    seed: 1,
    patient: { ...DEFAULT_PATIENT },
    effort: { ...DEFAULT_EFFORT },
    sensors: { ...DEFAULT_SENSORS },
    settings: { ...profile.defaults.settings },
    alarmLimits: { ...profile.defaults.alarmLimits },
    initialV: 'equilibrium',
    startVentilating: true,
    ...overrides,
  };
}
