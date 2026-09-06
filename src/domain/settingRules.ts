import type { ModeId, PatientType } from './types';

export type SettingUnit = 'L' | 's' | 'cmH2O' | 'fraction' | 'perMin' | 'L/s' | 'ratio' | 'boolean';
export type EvidenceStatus = 'D' | 'O' | 'P' | 'U';
export type ApplyPolicy = 'nextBreath' | 'immediate' | 'standbyOnly' | 'unverified';

/** Tramo numérico con extremos incluidos. Valores en unidad de PRESENTACIÓN del tramo (ver `displayFactor`). */
export interface NumericSegment { min: number; max: number; step: number }

export interface SettingRule {
  key: string;
  label: string;
  unit: SettingUnit;
  /** Unidad mostrada (mL, %, /min, cmH2O, L/min). */
  displayUnit: string;
  /** valorMostrado = valorInterno * displayFactor. */
  displayFactor: number;
  decimals: number;
  allowedPatientTypes: PatientType[];
  allowedModes: ModeId[];
  /** Tramos en unidad mostrada; o `values` discretos en unidad interna. */
  domain: NumericSegment[];
  values?: number[];
  allowOff: boolean;
  dependencies: string[];
  applyPolicy: ApplyPolicy;
  evidence: { sourceId: string; locator: string; status: EvidenceStatus; note?: string };
  policyEvidence: { status: EvidenceStatus; note: string };
}
