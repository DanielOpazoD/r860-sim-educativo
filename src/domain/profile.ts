import type { SettingRule } from './settingRules';
import type { CrossLimits } from './validation';
import type { AlarmLimits, SettingsKey, VcSettings, VentMode } from './types';

/**
 * Contrato de un perfil de equipo: todo lo que el motor necesita saber del aparato de referencia
 * (reglas de ajuste, límites cruzados, valores iniciales, tiempos documentados) sin importar el perfil concreto.
 * El motor recibe un ProfileSpec por inyección; los perfiles viven en src/profiles y dependen sólo del dominio.
 */
export interface ProfileSpec {
  profileId: string;
  profileVersion: string;
  /** Marca permanente exigida por el mandato. */
  banner: string;
  rules: Record<SettingsKey, SettingRule>;
  crossLimits: CrossLimits;
  alarmLimitRules: Record<keyof AlarmLimits, SettingRule>;
  holdRules: { inspHold: SettingRule; expHold: SettingRule };
  defaults: { settings: VcSettings; alarmLimits: AlarmLimits };
  enabledModes: readonly VentMode[];
  /** Pausa de audio (ms). */
  audioPauseMs: number;
  /** Duración de ↑O2 (ms). */
  increaseO2Ms: number;
  /** Incremento de FiO2 por defecto en ↑O2 (fracción). */
  increaseO2DeltaFraction: number;
  /** Plazo de cancelación de un borrador de ajuste (ms). */
  editTimeoutMs: number;
}
