import type { EffortParams, PatientParams } from '../domain/types';
import { findScenario } from '../scenarios';

/**
 * Perfiles rápidos: la fisiopatología que define a cada uno está en su nombre y, debajo, en sus números. El pulmón
 * reclutable queda para su escenario (SC-25): sin la maniobra que lo explica, como perfil suelto confundía.
 */
export const PATIENT_PROFILES: {
  id: string;
  label: string;
  scenarioId: string;
  /** Sus esfuerzos disparan: en A/C el paciente debe llevar el ritmo, no competir con la FR programada (E-127). */
  lidera?: true;
}[] = [
  { id: 'healthy', label: 'Sano, sedado', scenarioId: 'SC-01' },
  { id: 'stiff', label: 'Restrictivo', scenarioId: 'SC-21' },
  { id: 'obstructive', label: 'Obstructivo', scenarioId: 'SC-16' },
  { id: 'spontaneous', label: 'Esfuerzo normal', scenarioId: 'SC-19', lidera: true },
  { id: 'weak', label: 'Esfuerzo débil', scenarioId: 'SC-05' },
];

export type PatientProfile = (typeof PATIENT_PROFILES)[number];

/**
 * FR de A/C que deja al paciente disparar cada respiración (E-127), o null si el perfil no la pide.
 *
 * Con la FR programada igual a la del paciente (15 y 15/min ±20 %), cada esfuerzo que llega tarde lo adelanta una
 * respiración mandatoria, y el esfuerzo dispara otra en cuanto termina el refractario: doble disparo y apilamiento,
 * con la curva de volumen bajo la línea de base, en ≈ 7 % de las respiraciones. Es la asincronía real de una FR de
 * respaldo pegada a la del paciente, pero al elegir el perfil no es lo que se quiere ver. La FR que cede es la mayor
 * cuyo ciclo supera el período más largo del paciente: con 4,8 s, 12/min (5 s).
 */
export function frRespaldoQueCede(profile: PatientProfile): number | null {
  if (!profile.lidera) return null;
  const { effort } = profileState(profile);
  const periodoMaxS = (60 / effort.ratePerMin) * (1 + (effort.variability?.periodFrac ?? 0));
  return Math.ceil(60 / periodoMaxS) - 1;
}

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

/** Lo que define al perfil, en una línea breve bajo su nombre: el esfuerzo si respira, si no C y R. */
export function profileShort(profile: PatientProfile): string {
  const { patient, effort } = profileState(profile);
  if (effort.enabled && effort.amplitude > 0) return `Pmus ${displayNumber(effort.amplitude)} · ${displayNumber(effort.ratePerMin)}/min`;
  const r =
    patient.rInsp === patient.rExp ? displayNumber(patient.rInsp) : `${displayNumber(patient.rInsp)}/${displayNumber(patient.rExp)}`;
  return `C ${displayNumber(patient.crs * 1000)} · R ${r}`;
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
