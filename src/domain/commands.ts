import type { Actor, AlarmLimits, EffortParams, PatientParams, SensorParams, VcSettings } from './types';

/** Órdenes hacia el motor. La UI sólo envía confirmaciones; los borradores viven en la interfaz. */
export type Command =
  | { type: 'confirmSettings'; changes: Partial<VcSettings> }
  | { type: 'setAlarmLimits'; changes: Partial<AlarmLimits> }
  | { type: 'enterStandby' }
  | { type: 'startVentilation' }
  | { type: 'requestHold'; kind: 'inspHold' | 'expHold'; durationS: number }
  | { type: 'cancelProcedure'; procedureId?: string }
  | { type: 'manualBreath' }
  | { type: 'increaseO2Start'; deltaFraction?: number }
  | { type: 'increaseO2Stop' }
  | { type: 'acknowledgeAlarms'; id?: string }
  | { type: 'audioPause' }
  | { type: 'setPatient'; params: Partial<PatientParams> }
  | { type: 'setEffort'; params: Partial<EffortParams> }
  | { type: 'setSensors'; params: Partial<SensorParams> }
  | { type: 'setLungVolume'; vAbsL: number };

export const COMMAND_TYPES: ReadonlySet<string> = new Set([
  'confirmSettings',
  'setAlarmLimits',
  'enterStandby',
  'startVentilation',
  'requestHold',
  'cancelProcedure',
  'manualBreath',
  'increaseO2Start',
  'increaseO2Stop',
  'acknowledgeAlarms',
  'audioPause',
  'setPatient',
  'setEffort',
  'setSensors',
  'setLungVolume',
]);

export interface CommandResult {
  accepted: boolean;
  reason?: string;
}

export interface CommandLogEntry {
  simTimeMs: number;
  actor: Actor;
  command: Command;
  accepted: boolean;
  reason?: string;
}
