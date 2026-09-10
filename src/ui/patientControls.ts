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
    label: 'Compliance (C)',
    unit: 'mL/cmH₂O',
    min: 5,
    max: 150,
    step: 1,
    help: 'patient.compliance',
    get: (fr) => fr.truth.patient.crs * 1000,
    cmd: (v) => ({ type: 'setPatient', params: { crs: v / 1000 } }),
  },
  resistance: {
    label: 'Resistencia insp.',
    unit: 'cmH₂O/L/s',
    min: 2,
    max: 100,
    step: 1,
    help: 'patient.resistance',
    get: (fr) => fr.truth.patient.rInsp,
    cmd: (v) => ({ type: 'setPatient', params: { rInsp: v } }),
  },
  expResistance: {
    label: 'Resistencia esp.',
    unit: 'cmH₂O/L/s',
    min: 2,
    max: 150,
    step: 1,
    help: 'patient.expResistance',
    get: (fr) => fr.truth.patient.rExp,
    cmd: (v) => ({ type: 'setPatient', params: { rExp: v } }),
  },
  expValve: {
    label: 'Resistencia de rama esp.',
    unit: 'cmH₂O·s/L',
    min: 0,
    max: 6,
    step: 0.5,
    help: 'patient.expValve',
    get: (fr) => fr.truth.patient.rExpValve ?? 0,
    cmd: (v) => ({ type: 'setPatient', params: { rExpValve: v } }),
  },
  leak: {
    label: 'Fuga en la Y',
    unit: 'L/min a 10 cmH₂O',
    min: 0,
    max: 40,
    step: 1,
    help: 'patient.leak',
    get: (fr) => fr.truth.patient.leakLpmAt10 ?? 0,
    cmd: (v) => ({ type: 'setPatient', params: { leakLpmAt10: v } }),
  },
  sigmoidB: {
    label: 'Curva P-V: capacidad (b)',
    unit: 'mL',
    min: 0,
    max: 3000,
    step: 100,
    help: 'patient.sigmoid',
    get: (fr) => (fr.truth.patient.sigmoid?.b ?? 0) * 1000,
    cmd: (v, fr) => ({
      type: 'setPatient',
      params: { sigmoid: v <= 0 ? undefined : { b: v / 1000, c: fr.truth.patient.sigmoid?.c ?? 18, d: fr.truth.patient.sigmoid?.d ?? 5 } },
    }),
  },
  sigmoidC: {
    label: 'Curva P-V: máxima compliance (c)',
    unit: 'cmH₂O',
    min: 0,
    max: 40,
    step: 1,
    help: 'patient.sigmoid',
    get: (fr) => fr.truth.patient.sigmoid?.c ?? 18,
    cmd: (v, fr) => ({
      type: 'setPatient',
      params: fr.truth.patient.sigmoid ? { sigmoid: { ...fr.truth.patient.sigmoid, c: v } } : {},
    }),
  },
  sigmoidD: {
    label: 'Curva P-V: anchura (d)',
    unit: 'cmH₂O',
    min: 1,
    max: 15,
    step: 0.5,
    help: 'patient.sigmoid',
    get: (fr) => fr.truth.patient.sigmoid?.d ?? 5,
    cmd: (v, fr) => ({
      type: 'setPatient',
      params: fr.truth.patient.sigmoid ? { sigmoid: { ...fr.truth.patient.sigmoid, d: v } } : {},
    }),
  },
  secondCrs: {
    label: 'Segunda unidad: compliance',
    unit: 'mL/cmH₂O',
    min: 0,
    max: 100,
    step: 1,
    help: 'patient.second',
    get: (fr) => (fr.truth.patient.second?.crs ?? 0) * 1000,
    cmd: (v, fr) => ({
      type: 'setPatient',
      params: {
        second:
          v <= 0 ? undefined : { crs: v / 1000, rInsp: fr.truth.patient.second?.rInsp ?? 60, rExp: fr.truth.patient.second?.rExp ?? 60 },
      },
    }),
  },
  secondR: {
    label: 'Segunda unidad: resistencia',
    unit: 'cmH₂O/L/s',
    min: 2,
    max: 300,
    step: 2,
    help: 'patient.second',
    get: (fr) => fr.truth.patient.second?.rInsp ?? 60,
    cmd: (v, fr) => ({
      type: 'setPatient',
      params: fr.truth.patient.second ? { second: { ...fr.truth.patient.second, rInsp: v, rExp: v } } : {},
    }),
  },
  eflPcrit: {
    label: 'Colapso espiratorio: presión crítica',
    unit: 'cmH₂O',
    min: 0,
    max: 25,
    step: 1,
    help: 'patient.efl',
    get: (fr) => fr.truth.patient.efl?.pcrit ?? 0,
    cmd: (v, fr) => ({
      type: 'setPatient',
      params: { efl: v <= 0 ? undefined : { pcrit: v, rusFraction: fr.truth.patient.efl?.rusFraction ?? 0.5 } },
    }),
  },
  airwayCollapse: {
    label: 'Estrechamiento al vaciarse',
    unit: '×',
    min: 0,
    max: 8,
    step: 0.5,
    help: 'patient.airwayCollapse',
    get: (fr) => fr.truth.patient.rExpVolumeDep?.gain ?? 0,
    cmd: (v, fr) => ({
      type: 'setPatient',
      params: { rExpVolumeDep: v <= 0 ? undefined : { gain: v, vRefL: fr.truth.patient.rExpVolumeDep?.vRefL ?? 1 } },
    }),
  },
  viscoelastic: {
    label: 'Relajación viscoelástica (E₂)',
    unit: 'cmH₂O/L',
    min: 0,
    max: 20,
    step: 0.5,
    help: 'patient.viscoelastic',
    get: (fr) => fr.truth.patient.eVisc ?? 0,
    cmd: (v) => ({ type: 'setPatient', params: { eVisc: v } }),
  },
  viscTau: {
    label: 'Constante viscoelástica (τ₂)',
    unit: 's',
    min: 0.2,
    max: 4,
    step: 0.1,
    help: 'patient.viscTau',
    get: (fr) => fr.truth.patient.tauViscS ?? 1.2,
    cmd: (v) => ({ type: 'setPatient', params: { tauViscS: v } }),
  },
  rohrer: {
    label: 'Resistencia de Rohrer (K₂)',
    unit: 'cmH₂O/(L/s)²',
    min: 0,
    max: 20,
    step: 0.5,
    help: 'patient.rohrer',
    get: (fr) => fr.truth.patient.r2,
    cmd: (v) => ({ type: 'setPatient', params: { r2: v } }),
  },
  effort: {
    label: 'Esfuerzo (Pmus)',
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
    label: 'Sensor O₂: constante',
    unit: 's',
    min: 0.5,
    max: 60,
    step: 0.5,
    help: 'setting.fio2',
    get: (fr) => fr.truth.sensors.fio2TauS,
    cmd: (v) => ({ type: 'setSensors', params: { fio2TauS: v } }),
  },
  o2Bias: {
    label: 'Sensor O₂: sesgo',
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
export const PATIENT_EXTRA = [
  'secondCrs',
  'secondR',
  'eflPcrit',
  'airwayCollapse',
  'sigmoidB',
  'sigmoidC',
  'sigmoidD',
  'viscoelastic',
  'viscTau',
  'rohrer',
  'expValve',
  'leak',
  'patientRR',
  'muscleTi',
  'o2Tau',
  'o2Bias',
];
/** Botones de eventos (pestaña «Eventos»): [id, icono, título, descripción, deshabilitado]. */
export const FAULTS: [string, string, string, string, boolean][] = [
  ['resistance', 'wave', 'Resistencia ×2', 'Aumenta la carga resistiva', false],
  ['compliance', 'lung', 'C ÷2', 'Aumenta la carga elástica', false],
  ['apnea', 'pause', 'Apnea', 'Interrumpe el esfuerzo', false],
  ['obstruction', 'lock', 'Oclusión', 'Resistencia extrema (Pmáx)', false],
  ['leak', 'wave', 'Fuga', '6 L/min a 10 cmH₂O en la Y', false],
  ['disconnect', 'plug', 'Desconexión', 'Circuito abierto en la Y', false],
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
