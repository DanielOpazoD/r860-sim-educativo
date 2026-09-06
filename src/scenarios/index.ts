import type { AlarmLimits, EffortParams, PatientParams, SensorParams, VcSettings } from '../domain/types';

/**
 * Escenarios SINTÉTICOS (P · dossier §25). Son casos de prueba y de docencia, no pacientes ni configuraciones de tratamiento.
 * Cada uno declara qué parámetros artificiales cambia y cuándo.
 */
export interface Perturbation { atSimTimeMs: number; patient?: Partial<PatientParams>; effort?: Partial<EffortParams>; sensors?: Partial<SensorParams>; note: string }

export interface Scenario {
  id: string;
  name: string;
  description: string;
  synthetic: true;
  patient: PatientParams;
  effort: EffortParams;
  sensors: SensorParams;
  settings?: Partial<VcSettings>;
  alarmLimits?: Partial<AlarmLimits>;
  initialV?: number | 'equilibrium';
  perturbations: Perturbation[];
  observe: string;
  caution: string;
}

const passive: EffortParams = { enabled: false, amplitude: 0, ratePerMin: 12, tiS: 0.8, phaseS: 0 };
const idealSensors: SensorParams = { fio2TauS: 6, fio2Bias: 0 };

export const SCENARIOS: Scenario[] = [
  {
    id: 'SC-01', name: 'Banco lineal pasivo', synthetic: true,
    description: 'C = 0.05 L/cmH2O; Rinsp = Rexp = 10; esfuerzo 0; sin fuga. Ajustes de banco: VT 0.5 L, PEEP 5, Tinsp 1 s (BM-01/02).',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: passive, sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 35, pausePct: 0 }, initialV: 'equilibrium', perturbations: [],
    observe: 'Relaciones analíticas VC y coherencia de unidades.', caution: 'No se denomina «paciente normal» ni constituye configuración de tratamiento.',
  },
  {
    id: 'SC-02', name: 'Menor distensibilidad', synthetic: true,
    description: 'Como SC-01 pero C = 0.02 L/cmH2O desde t = 20 s.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: passive, sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 35, pausePct: 0 }, initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 20_000, patient: { crs: 0.02 }, note: 'C 0.05 → 0.02' }],
    observe: 'Más presión para el mismo VT en VC.', caution: 'Cambiar C no diagnostica por sí solo SDRA.',
  },
  {
    id: 'SC-03', name: 'Mayor resistencia espiratoria', synthetic: true,
    description: 'Rexp = 30 y tiempo espiratorio corto (FR 25, I:E 1:1): vaciamiento incompleto y auto-PEEP emergente.',
    patient: { crs: 0.05, rInsp: 10, rExp: 30, r2: 0, p0: 0 }, effort: passive, sensors: idealSensors,
    settings: { vt: 0.5, rr: 25, ie: 1, peep: 5, pmax: 45, plimit: 40, pausePct: 0 }, initialV: 'equilibrium', perturbations: [],
    observe: 'Volumen residual y PEEP total con bloqueo espiratorio; no se impone una cifra.', caution: 'Calcular, no fijar la auto-PEEP.',
  },
  {
    id: 'SC-04', name: 'Mayor resistencia inspiratoria', synthetic: true,
    description: 'Rinsp = 40 desde t = 20 s: separación entre presión resistiva y elástica; efecto de Plimit.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: passive, sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 30, pausePct: 0 }, initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 20_000, patient: { rInsp: 40 }, note: 'Rinsp 10 → 40' }],
    observe: 'Ppico sube, Pplat no; Plimit recorta la entrega.', caution: 'No cambiar C en secreto para exagerar el aspecto.',
  },
  {
    id: 'SC-05', name: 'Esfuerzo débil', synthetic: true,
    description: 'Pmus 1.5 cmH2O a 18/min: algunos esfuerzos no disparan.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: { enabled: true, amplitude: 1.5, ratePerMin: 18, tiS: 0.7, phaseS: 0.3 }, sensors: idealSensors,
    settings: { vt: 0.5, rr: 12, ie: 1 / 3, peep: 5, pmax: 40, plimit: 35, pausePct: 0, flowTrigger: 3 / 60 }, initialV: 'equilibrium', perturbations: [],
    observe: 'Esfuerzos inefectivos y significado de sensibilidad.', caution: 'Ausencia de disparo no es ausencia de esfuerzo.',
  },
  {
    id: 'SC-09', name: 'Oclusión de ensayo', synthetic: true,
    description: 'Rinsp = 400 desde t = 12 s: la presión alcanza Plimit y luego Pmáx si Plimit > Pmáx.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: passive, sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 60, pausePct: 0 }, initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 12_000, patient: { rInsp: 400 }, note: 'Rinsp 10 → 400' }],
    observe: 'Límite de presión y fin de inspiración; sin divergencia numérica.', caution: 'Dominio de fallo del ensayo, no fisiología.',
  },
  {
    id: 'SC-10', name: 'Maniobra inválida', synthetic: true,
    description: 'Esfuerzo fuerte continuo (Pmus 8 cmH2O a 30/min): el bloqueo inspiratorio resulta inestable e inválido.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: { enabled: true, amplitude: 8, ratePerMin: 30, tiS: 0.8, phaseS: 0.2 }, sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 35, pausePct: 0, assistControl: false }, initialV: 'equilibrium', perturbations: [],
    observe: 'Resultado inválido con motivo; no se fabrica Cstat.', caution: 'No fabricar Cstat precisa en una condición no interpretable.',
  },
  {
    id: 'SC-12', name: 'Sensor de O2 sesgado', synthetic: true,
    description: 'Sesgo −0.03 en el sensor de FiO2 desde t = 10 s sin cambiar la mezcla verdadera.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: passive, sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 35, pausePct: 0, fio2: 1.0 }, initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 10_000, sensors: { fio2Bias: -0.03 }, note: 'sesgo sensor O2 −3 %' }],
    observe: 'Separar objetivo, entrega y medición.', caution: 'Escenario sintético; no asociado a fallas reales del equipo fotografiado.',
  },
];

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
