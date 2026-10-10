import type { EffortParams, PatientParams } from '../domain/types';
import { findScenario } from '../scenarios';

export const PATIENT_PROFILES: { id: string; label: string; scenarioId: string }[] = [
  { id: 'healthy', label: 'Sano pasivo', scenarioId: 'SC-01' },
  { id: 'stiff', label: 'Pulmón rígido', scenarioId: 'SC-21' },
  { id: 'obstructive', label: 'Obstructivo', scenarioId: 'SC-16' },
  { id: 'recruitable', label: 'Reclutable', scenarioId: 'SC-25' },
  { id: 'spontaneous', label: 'Respira solo', scenarioId: 'SC-19' },
  { id: 'weak', label: 'Esfuerzo débil', scenarioId: 'SC-05' },
];

export type PatientProfile = (typeof PATIENT_PROFILES)[number];

export function profileState(profile: PatientProfile): { patient: PatientParams; effort: EffortParams } {
  const scenario = findScenario(profile.scenarioId);
  if (!scenario) throw new Error(`El perfil ${profile.id} apunta a un escenario inexistente: ${profile.scenarioId}`);
  return { patient: scenario.patient, effort: scenario.effort };
}

function displayNumber(value: number): string {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(value);
}

export function profileHint(profile: PatientProfile): string {
  const { patient, effort } = profileState(profile);
  const drive = effort.enabled && effort.amplitude > 0 ? `Pmus ${displayNumber(effort.amplitude)}` : 'pasivo';
  return `C ${displayNumber(patient.crs * 1000)} · R ${displayNumber(patient.rInsp)}/${displayNumber(patient.rExp)} · ${drive}`;
}

function stableEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9;
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => stableEqual(value, b[index]));
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = Object.keys(a)
    .filter((key) => (a as Record<string, unknown>)[key] !== undefined)
    .sort();
  const right = Object.keys(b)
    .filter((key) => (b as Record<string, unknown>)[key] !== undefined)
    .sort();
  return (
    left.length === right.length &&
    left.every(
      (key, index) => key === right[index] && stableEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}

export function matchesProfile(truthPatient: PatientParams, truthEffort: EffortParams, profile: PatientProfile): boolean {
  const expected = profileState(profile);
  return stableEqual(truthPatient, expected.patient) && stableEqual(truthEffort, expected.effort);
}
