/** Controles del panel docente: mecánica del paciente virtual, esfuerzo y sensor de O₂ (especificación + plantilla HTML). */
import type { Command } from '../domain/commands';
import type { EngineFrame } from '../engine/simulator';

export interface PhysSpec {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  help: string;
  get: (fr: EngineFrame) => number;
  cmd: (v: number, fr: EngineFrame) => Command;
}
export const PHYS: Record<string, PhysSpec> = {
  compliance: {
    label: 'Compliance estática (C)',
    unit: 'mL/cmH₂O',
    min: 5,
    max: 150,
    step: 1,
    help: 'patient.compliance',
    get: (fr) => fr.truth.patient.crs * 1000,
    cmd: (v) => ({ type: 'setPatient', params: { crs: v / 1000 } }),
  },
  resistance: {
    label: 'Resistencia inspiratoria',
    unit: 'cmH₂O/L/s',
    min: 2,
    max: 100,
    step: 1,
    help: 'patient.resistance',
    get: (fr) => fr.truth.patient.rInsp,
    cmd: (v) => ({ type: 'setPatient', params: { rInsp: v } }),
  },
  expResistance: {
    label: 'Resistencia espiratoria',
    unit: 'cmH₂O/L/s',
    min: 2,
    max: 150,
    step: 1,
    help: 'patient.expResistance',
    get: (fr) => fr.truth.patient.rExp,
    cmd: (v) => ({ type: 'setPatient', params: { rExp: v } }),
  },
  effort: {
    label: 'Intensidad del esfuerzo',
    unit: 'cmH₂O',
    min: 0,
    max: 30,
    step: 0.5,
    help: 'patient.effort',
    get: (fr) => (fr.truth.effort.enabled ? fr.truth.effort.amplitude : 0),
    cmd: (v) => ({ type: 'setEffort', params: { enabled: v > 0, amplitude: v } }),
  },
  patientRR: {
    label: 'Frecuencia del paciente',
    unit: '/min',
    min: 3,
    max: 60,
    step: 1,
    help: 'patient.patientRR',
    get: (fr) => fr.truth.effort.ratePerMin,
    cmd: (v) => ({ type: 'setEffort', params: { ratePerMin: v } }),
  },
  muscleTi: {
    label: 'Duración del esfuerzo',
    unit: 's',
    min: 0.3,
    max: 3,
    step: 0.1,
    help: 'patient.muscleTi',
    get: (fr) => fr.truth.effort.tiS,
    cmd: (v) => ({ type: 'setEffort', params: { tiS: v } }),
  },
  o2Tau: {
    label: 'Constante del sensor de O₂',
    unit: 's',
    min: 0.5,
    max: 60,
    step: 0.5,
    help: 'setting.fio2',
    get: (fr) => fr.truth.sensors.fio2TauS,
    cmd: (v) => ({ type: 'setSensors', params: { fio2TauS: v } }),
  },
  o2Bias: {
    label: 'Sesgo del sensor de O₂',
    unit: '%',
    min: -20,
    max: 20,
    step: 1,
    help: 'setting.fio2',
    get: (fr) => Math.round(fr.truth.sensors.fio2Bias * 100),
    cmd: (v) => ({ type: 'setSensors', params: { fio2Bias: v / 100 } }),
  },
};
export const PATIENT_MAIN = ['compliance', 'resistance', 'expResistance', 'effort'];
export const PATIENT_EXTRA = ['patientRR', 'muscleTi', 'o2Tau', 'o2Bias'];
/** Botones de eventos (pestaña «Eventos»): [id, icono, título, descripción, deshabilitado]. */
export const FAULTS: [string, string, string, string, boolean][] = [
  ['resistance', 'wave', 'Resistencia ×2', 'Aumenta la carga resistiva', false],
  ['compliance', 'lung', 'C ÷2', 'Aumenta la carga elástica', false],
  ['apnea', 'pause', 'Apnea', 'Interrumpe el esfuerzo', false],
  ['obstruction', 'lock', 'Oclusión', 'Resistencia extrema (Pmáx)', false],
  ['leak', 'wave', 'Fuga', 'No modelada en esta etapa', true],
  ['disconnect', 'plug', 'Desconexión', 'No modelada en esta etapa', true],
];

export function physHtml(
  keys: string[],
  infoButton: (key: string, id: string) => string,
  infoPanel: (key: string, id: string) => string,
): string {
  return keys
    .map((k) => {
      const sp = PHYS[k] as PhysSpec;
      const id = `help-phys-${k}`;
      return `<div class="phys-field"><div class="phys-field-header"><div class="parameter-label"><label for="phys-${k}">${sp.label}</label>${infoButton(sp.help, id)}</div><div class="phys-value"><input id="phys-${k}" data-phys-number="${k}" type="number" min="${sp.min}" max="${sp.max}" step="${sp.step}" aria-label="${sp.label}"><small>${sp.unit}</small></div></div><input type="range" data-phys-range="${k}" min="${sp.min}" max="${sp.max}" step="${sp.step}" aria-label="Deslizador ${sp.label}"><div class="phys-range-labels"><span>${sp.min}</span><span>${sp.max}</span></div>${infoPanel(sp.help, id)}</div>`;
    })
    .join('');
}
