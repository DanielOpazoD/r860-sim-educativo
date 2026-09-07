/** Etiquetas, claves de ayuda y utilidades de presentación compartidas por varios rasgos de la interfaz. */
import type { SettingRule } from '../domain/settingRules';
import type { SettingsKey, VcSettings, VentMode } from '../domain/types';
import { ieText } from './format';

export const QUICK_KEYS_BY_MODE: Record<VentMode, SettingsKey[]> = {
  AC_VC: ['fio2', 'vt', 'rr', 'ie', 'peep', 'pmax'],
  AC_PC: ['fio2', 'pinsp', 'rr', 'ie', 'peep', 'pmax'],
};
export const MODE_LABEL: Record<VentMode, string> = { AC_VC: 'A/C VC', AC_PC: 'A/C PC' };
export const modeLabel = (m: string): string => MODE_LABEL[m as VentMode] ?? m;
export const QUICK_LABEL: Record<SettingsKey, string> = {
  fio2: 'FiO₂',
  vt: 'Volumen tidal',
  rr: 'Frecuencia',
  ie: 'I:E',
  peep: 'PEEP',
  pmax: 'Pmáx',
  plimit: 'Plimit',
  pausePct: 'Pausa inspiratoria',
  assistControl: 'Disparo asistido',
  flowTrigger: 'Disparo por flujo',
  biasFlow: 'Flujo de base',
  triggerByPressure: 'Disparo por presión (en vez de flujo)',
  pressureTrigger: 'Umbral de presión',
  pinsp: 'Pinsp',
  riseMs: 'Rampa',
};
export const HELP_KEY: Record<SettingsKey, string> = {
  fio2: 'setting.fio2',
  vt: 'setting.vt',
  rr: 'setting.rr',
  ie: 'setting.ie',
  peep: 'setting.peep',
  pmax: 'setting.pmax',
  plimit: 'setting.plimit',
  pausePct: 'setting.pause',
  assistControl: 'setting.assist',
  flowTrigger: 'setting.trigger',
  biasFlow: 'setting.biasFlow',
  triggerByPressure: 'setting.triggerType',
  pressureTrigger: 'setting.triggerPressure',
  pinsp: 'setting.pinsp',
  riseMs: 'setting.rise',
};
export const isMobile = (): boolean => window.matchMedia('(max-width:700px)').matches;

/** Valor de un ajuste tal como lo muestra la tecla rápida (Off, On, I:E o número con sus decimales). */
export function displaySetting(rules: Record<SettingsKey, SettingRule>, k: SettingsKey, v: VcSettings[SettingsKey]): string {
  if (v === 'off') return 'Off';
  if (typeof v === 'boolean') return v ? 'On' : 'Off';
  if (k === 'ie') return ieText(v as number);
  return ((v as number) * rules[k].displayFactor).toFixed(rules[k].decimals);
}
