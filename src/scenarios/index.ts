import type { AlarmLimits, EffortParams, PatientParams, SensorParams, VcSettings } from '../domain/types';

/**
 * Escenarios SINTÉTICOS (P · dossier §25). Son casos de prueba y de docencia, no pacientes ni configuraciones de tratamiento.
 * Cada uno declara qué parámetros artificiales cambia y cuándo.
 */
export interface Perturbation { atSimTimeMs: number; patient?: Partial<PatientParams>; effort?: Partial<EffortParams>; sensors?: Partial<SensorParams>; note: string }

export interface LessonTask { id: string; text: string; test: string }
export interface Lesson { title: string; text: string; tasks: LessonTask[] }

export interface Scenario {
  id: string;
  name: string;
  description: string;
  synthetic: true;
  /** Presentación en el catálogo (P). */
  category?: string;
  level?: 1 | 2 | 3;
  lesson?: Lesson;
  question?: string;
  answer?: string;
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
    id: 'SC-01', name: 'Banco lineal pasivo', synthetic: true, category: 'Fundamentos', level: 1,
    lesson: { title: 'La presión tiene dos componentes', text: 'En este pulmón pasivo, elevar R aumenta sobre todo la presión resistiva; reducir C aumenta la elástica. Un bloqueo permite separarlas.', tasks: [{ id: 'plateau', text: 'Realiza un bloqueo inspiratorio válido.', test: 'validInsp' }, { id: 'r', text: 'Duplica la resistencia inspiratoria hasta ≥ 20.', test: 'r20' }, { id: 'repeat', text: 'Repite el bloqueo después del cambio.', test: 'holdAfterPatient' }] },
    question: '¿Qué ocurre con Ppico y Pplat cuando sólo aumenta la resistencia?', answer: 'En volumen controlado con flujo constante, Ppico sube por R × flujo; Pplat casi no cambia si no hay atrapamiento. La compliance del pulmón sintético es la misma.',
    description: 'C = 0.05 L/cmH2O; Rinsp = Rexp = 10; esfuerzo 0; sin fuga. Ajustes de banco: VT 0.5 L, PEEP 5, Tinsp 1 s (BM-01/02).',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: passive, sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 35, pausePct: 0 }, initialV: 'equilibrium', perturbations: [],
    observe: 'Relaciones analíticas VC y coherencia de unidades.', caution: 'No se denomina «paciente normal» ni constituye configuración de tratamiento.',
  },
  {
    id: 'SC-02', name: 'Menor distensibilidad', synthetic: true, category: 'Mecánica restrictiva', level: 2,
    lesson: { title: 'El mismo volumen, otra presión', text: 'A los 20 s la C baja a 20 mL/cmH2O. El mismo VT exige más presión elástica. La etiqueta describe mecánica, no un paciente con SDRA.', tasks: [{ id: 'meseta', text: 'Mide Pplat con un bloqueo inspiratorio antes del cambio.', test: 'validInsp' }, { id: 'after', text: 'Repite el bloqueo después de los 20 s.', test: 'holdAfter20' }, { id: 'peep', text: 'Cambia la PEEP y observa que Pplat sube en la misma cantidad.', test: 'peepChanged' }] },
    question: '¿Por qué Ppico y Pplat suben juntos al bajar C?', answer: 'La presión elástica VT/C sube para ambas; la resistiva no cambia. La diferencia Ppico − Pplat se conserva.',
    description: 'Como SC-01 pero C = 0.02 L/cmH2O desde t = 20 s.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: passive, sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 35, pausePct: 0 }, initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 20_000, patient: { crs: 0.02 }, note: 'C 0.05 → 0.02' }],
    observe: 'Más presión para el mismo VT en VC.', caution: 'Cambiar C no diagnostica por sí solo SDRA.',
  },
  {
    id: 'SC-03', name: 'Mayor resistencia espiratoria', synthetic: true, category: 'Mecánica obstructiva', level: 2,
    lesson: { title: 'El flujo todavía no volvió a cero', text: 'La auto-PEEP emerge del vaciamiento incompleto, no de una etiqueta. El panel docente muestra la verdad del modelo; para medirla usa un bloqueo espiratorio.', tasks: [{ id: 'exp', text: 'Realiza un bloqueo espiratorio válido.', test: 'validExp' }, { id: 'time', text: 'Amplía el tiempo espiratorio a ≥ 3 s (FR o I:E).', test: 'te3' }, { id: 'again', text: 'Repite el bloqueo espiratorio tras el cambio.', test: 'expAfterSettings' }] },
    question: '¿Por qué la PEEP total supera la PEEP programada?', answer: 'Con τ = Rexp·C larga y Texp corto, el pulmón no llega al equilibrio: queda volumen atrapado y su presión elástica se suma a la PEEP externa.',
    description: 'Rexp = 30 y tiempo espiratorio corto (FR 25, I:E 1:1): vaciamiento incompleto y auto-PEEP emergente.',
    patient: { crs: 0.05, rInsp: 10, rExp: 30, r2: 0, p0: 0 }, effort: passive, sensors: idealSensors,
    settings: { vt: 0.5, rr: 25, ie: 1, peep: 5, pmax: 45, plimit: 40, pausePct: 0 }, initialV: 'equilibrium', perturbations: [],
    observe: 'Volumen residual y PEEP total con bloqueo espiratorio; no se impone una cifra.', caution: 'Calcular, no fijar la auto-PEEP.',
  },
  {
    id: 'SC-04', name: 'Mayor resistencia inspiratoria', synthetic: true, category: 'Límites de presión', level: 2,
    lesson: { title: 'Plimit recorta la entrega', text: 'A los 20 s la R inspiratoria sube a 40. Con Plimit 30, el flujo deja de ser constante y el VT espirado cae por debajo del programado.', tasks: [{ id: 'observe', text: 'Observa VTesp < VT programado tras los 20 s.', test: 'vteBelowSet' }, { id: 'plimit', text: 'Sube Plimit en el menú de modo y confirma.', test: 'plimitChanged' }, { id: 'hold', text: 'Realiza un bloqueo inspiratorio válido.', test: 'validInsp' }] },
    question: '¿Qué diferencia hay entre Plimit y Pmáx?', answer: 'Plimit sostiene la presión el resto de la inspiración (el volumen puede no completarse). Pmáx termina la inspiración de inmediato y activa la alarma.',
    description: 'Rinsp = 40 desde t = 20 s: separación entre presión resistiva y elástica; efecto de Plimit.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: passive, sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 30, pausePct: 0 }, initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 20_000, patient: { rInsp: 40 }, note: 'Rinsp 10 → 40' }],
    observe: 'Ppico sube, Pplat no; Plimit recorta la entrega.', caution: 'No cambiar C en secreto para exagerar el aspecto.',
  },
  {
    id: 'SC-05', name: 'Esfuerzo débil', synthetic: true, category: 'Sincronía', level: 3,
    lesson: { title: 'Esfuerzos que no disparan', text: 'Pmus de 1.5 cmH2O con trigger de 3 L/min: la mayoría de los esfuerzos no producen flujo suficiente. Observa el panel docente.', tasks: [{ id: 'trig', text: 'Baja el trigger de flujo a 1 L/min en el menú de modo.', test: 'trigger1' }, { id: 'assisted', text: 'Consigue una respiración asistida (FR medida > programada).', test: 'assisted' }, { id: 'hold', text: 'Intenta un bloqueo inspiratorio con esfuerzo y revisa su validez.', test: 'anyHold' }] },
    question: '¿Ausencia de disparo significa ausencia de esfuerzo?', answer: 'No. El esfuerzo existe en el modelo (curva de Pmus del panel docente) aunque no supere el umbral del trigger.',
    description: 'Pmus 1.5 cmH2O a 18/min: algunos esfuerzos no disparan.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: { enabled: true, amplitude: 1.5, ratePerMin: 18, tiS: 0.7, phaseS: 0.3 }, sensors: idealSensors,
    settings: { vt: 0.5, rr: 12, ie: 1 / 3, peep: 5, pmax: 40, plimit: 35, pausePct: 0, flowTrigger: 3 / 60 }, initialV: 'equilibrium', perturbations: [],
    observe: 'Esfuerzos inefectivos y significado de sensibilidad.', caution: 'Ausencia de disparo no es ausencia de esfuerzo.',
  },
  {
    id: 'SC-09', name: 'Oclusión de ensayo', synthetic: true, category: 'Alarmas', level: 2,
    lesson: { title: 'Pmáx termina la inspiración', text: 'A los 12 s la resistencia se vuelve extrema. Pmáx (40) se alcanza al inicio de cada inspiración: alarma de prioridad alta y VT casi nulo.', tasks: [{ id: 'alarm', text: 'Abre la lista de alarmas mientras la alarma está activa.', test: 'alarmSeen' }, { id: 'ack', text: 'Reconoce la alarma: la condición sigue activa.', test: 'acknowledged' }, { id: 'fix', text: 'Deshace el evento en el panel docente y comprueba que la banda vuelve a verde.', test: 'alarmCleared' }] },
    question: '¿Reconocer resuelve la alarma?', answer: 'No. Reconocer registra que el usuario la vio; la condición física sólo se resuelve cuando la presión deja de alcanzar Pmáx.',
    description: 'Rinsp = 400 desde t = 12 s: la presión alcanza Plimit y luego Pmáx si Plimit > Pmáx.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: passive, sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 60, pausePct: 0 }, initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 12_000, patient: { rInsp: 400 }, note: 'Rinsp 10 → 400' }],
    observe: 'Límite de presión y fin de inspiración; sin divergencia numérica.', caution: 'Dominio de fallo del ensayo, no fisiología.',
  },
  {
    id: 'SC-10', name: 'Maniobra inválida', synthetic: true, category: 'Calidad de datos', level: 3,
    lesson: { title: 'Una meseta inestable no es una meseta', text: 'Con esfuerzo fuerte y continuo, el bloqueo inspiratorio resulta inestable. El resultado se marca inválido con motivo; no se fabrica Cstat.', tasks: [{ id: 'inv', text: 'Realiza un bloqueo inspiratorio y observa que es inválido.', test: 'invalidHold' }, { id: 'apnea', text: 'Aplica «Apnea» en Eventos para retirar el esfuerzo.', test: 'noEffort' }, { id: 'valid', text: 'Repite el bloqueo: ahora es válido.', test: 'validInsp' }] },
    question: '¿Por qué el ventilador no muestra Cstat durante el esfuerzo?', answer: 'Porque la presión ocluida varía con Pmus; el estimador exige una meseta estable y declara el motivo en vez de mostrar un número engañoso.',
    description: 'Esfuerzo fuerte continuo (Pmus 8 cmH2O a 30/min): el bloqueo inspiratorio resulta inestable e inválido.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: { enabled: true, amplitude: 8, ratePerMin: 30, tiS: 0.8, phaseS: 0.2 }, sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 35, pausePct: 0, assistControl: false }, initialV: 'equilibrium', perturbations: [],
    observe: 'Resultado inválido con motivo; no se fabrica Cstat.', caution: 'No fabricar Cstat precisa en una condición no interpretable.',
  },
  {
    id: 'SC-12', name: 'Sensor de O2 sesgado', synthetic: true, category: 'Sensores', level: 3,
    lesson: { title: 'Objetivo, entrega y medición', text: 'A los 10 s el sensor de O2 adquiere un sesgo de −3 %. El ajuste sigue en 100 %, la mezcla entregada también; el número medido baja a 97.', tasks: [{ id: 'see', text: 'Observa FiO2 medida 97 con ajuste 100.', test: 'fio2Gap' }, { id: 'alarm', text: 'Configura una alarma de FiO2 baja en 98 % y compruébala.', test: 'fio2Alarm' }, { id: 'fix', text: 'Corrige el sesgo del sensor en el panel docente.', test: 'biasZero' }] },
    question: '¿La lectura 97 significa que se entrega 97 %?', answer: 'No en este escenario: es el sensor sesgado. En un equipo real, la discrepancia obliga a verificar el sensor, no a cambiar el ajuste.',
    description: 'Sesgo −0.03 en el sensor de FiO2 desde t = 10 s sin cambiar la mezcla verdadera.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 }, effort: passive, sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 35, pausePct: 0, fio2: 1.0 }, initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 10_000, sensors: { fio2Bias: -0.03 }, note: 'sesgo sensor O2 −3 %' }],
    observe: 'Separar objetivo, entrega y medición.', caution: 'Escenario sintético; no asociado a fallas reales del equipo fotografiado.',
  },
];

/** Referencia visual de las fotografías P1/P3 (O): sólo los AJUSTES visibles; C y R son artificiales; las lecturas se calculan. */
SCENARIOS.push({
  id: 'SC-P', name: 'Referencia de tus fotografías', synthetic: true, category: 'Referencia visual', level: 1,
  description: 'VT 285 mL, FR 32, I:E 1:1.5, PEEP 16, FiO2 100 %, Pmáx 50 como en P1/P3. C = 19 mL/cmH2O y R = 8 elegidas para un aspecto cercano; las mediciones no se copian de la foto.',
  patient: { crs: 0.019, rInsp: 8, rExp: 8, r2: 0, p0: 0 }, effort: passive, sensors: idealSensors,
  settings: { vt: 0.285, rr: 32, ie: 1 / 1.5, peep: 16, pmax: 50, plimit: 45, pausePct: 0, fio2: 1.0 },
  alarmLimits: { ppeakLow: 22, vteLow: 0.25, vteHigh: 0.425, mveLow: 5, mveHigh: 20, rrLow: 10, rrHigh: 40, fio2Low: 0.21, fio2High: 1.0 },
  initialV: 'equilibrium', perturbations: [],
  observe: 'Composición de P1/P3 con números calculados por el motor.', caution: 'No reconstruye al paciente de la foto ni valida sus ajustes.',
  lesson: { title: 'Una referencia, no un paciente recreado', text: 'Sólo se usan ajustes visibles. Las mediciones se calculan; no se copian los números de la fotografía.', tasks: [{ id: 'hold', text: 'Solicita un bloqueo inspiratorio de 3 s.', test: 'validInsp' }, { id: 'basic', text: 'Alterna a la vista de datos grandes.', test: 'basic' }, { id: 'snap', text: 'Guarda una captura de pantalla.', test: 'snapshot' }] },
  question: '¿Por qué la lectura puede diferir de la fotografía aunque los ajustes coincidan?', answer: 'Porque la mecánica del paciente fotografiado es desconocida; C y R aquí son artificiales y el motor calcula sus propias lecturas.',
});

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
