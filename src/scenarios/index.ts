import type { AlarmLimits, EffortParams, PatientParams, SensorParams, VcSettings } from '../domain/types';

/**
 * Escenarios SINTÉTICOS (P · dossier §25). Son casos de prueba y de docencia, no pacientes ni configuraciones de tratamiento.
 * Cada uno declara qué parámetros artificiales cambia y cuándo.
 */
export interface Perturbation {
  atSimTimeMs: number;
  patient?: Partial<PatientParams>;
  effort?: Partial<EffortParams>;
  sensors?: Partial<SensorParams>;
  note: string;
}

export interface LessonTask {
  id: string;
  text: string;
  test: string;
}
export interface Lesson {
  title: string;
  text: string;
  tasks: LessonTask[];
}

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

const passive: EffortParams = { enabled: false, amplitude: 0, ratePerMin: 12, tiS: 0.8, phaseS: 0, shape: 'riseRelax' };
const idealSensors: SensorParams = { fio2TauS: 6, fio2Bias: 0 };

export const SCENARIOS: Scenario[] = [
  {
    id: 'SC-01',
    name: 'Banco lineal pasivo',
    synthetic: true,
    category: 'Fundamentos',
    level: 1,
    lesson: {
      title: 'La presión tiene dos componentes',
      text: 'En este pulmón pasivo, elevar R aumenta sobre todo la presión resistiva; reducir C aumenta la elástica. Un bloqueo permite separarlas.',
      tasks: [
        { id: 'plateau', text: 'Realiza un bloqueo inspiratorio válido.', test: 'validInsp' },
        { id: 'r', text: 'Duplica la resistencia inspiratoria hasta ≥ 20.', test: 'r20' },
        { id: 'repeat', text: 'Repite el bloqueo después del cambio.', test: 'holdAfterPatient' },
      ],
    },
    question: '¿Qué ocurre con Ppico y Pplat cuando sólo aumenta la resistencia?',
    answer:
      'En volumen controlado con flujo constante, Ppico sube por R × flujo; Pplat casi no cambia si no hay atrapamiento. La compliance del pulmón sintético es la misma.',
    description: 'C = 50 mL/cmH2O; Rinsp = Rexp = 10; sin esfuerzo ni fuga. VT 500 mL, PEEP 5, Tinsp 1 s.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 100, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Relaciones analíticas VC y coherencia de unidades.',
    caution: 'No se denomina «paciente normal» ni constituye configuración de tratamiento.',
  },
  {
    id: 'SC-02',
    name: 'Menor distensibilidad',
    synthetic: true,
    category: 'Mecánica restrictiva',
    level: 2,
    lesson: {
      title: 'El mismo volumen, otra presión',
      text: 'A los 20 s la C baja a 20 mL/cmH2O. El mismo VT exige más presión elástica. La etiqueta describe mecánica, no un paciente con SDRA.',
      tasks: [
        { id: 'meseta', text: 'Mide Pplat con un bloqueo inspiratorio antes del cambio.', test: 'validInsp' },
        { id: 'after', text: 'Repite el bloqueo después de los 20 s.', test: 'holdAfter20' },
        {
          id: 'peep',
          text: 'Sube la PEEP a 8 y repite el bloqueo: Pplat sube esos mismos 3 cmH₂O. Con C 20 no cabe más: a PEEP 10 la inspiración ya termina por Pmáx.',
          test: 'peepChanged',
        },
      ],
    },
    question: '¿Por qué Ppico y Pplat suben juntos al bajar C?',
    answer: 'La presión elástica VT/C sube para ambas; la resistiva no cambia. La diferencia Ppico − Pplat se conserva.',
    description: 'Mismo pulmón que el banco lineal, pero la C baja a 20 mL/cmH2O a los 20 s.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 100, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 20_000, patient: { crs: 0.02 }, note: 'C 0.05 → 0.02' }],
    observe: 'Más presión para el mismo VT en VC.',
    caution: 'Cambiar C no diagnostica por sí solo SDRA.',
  },
  {
    id: 'SC-03',
    name: 'Mayor resistencia espiratoria',
    synthetic: true,
    category: 'Mecánica obstructiva',
    level: 2,
    lesson: {
      title: 'El flujo todavía no volvió a cero',
      text: 'La auto-PEEP emerge del vaciamiento incompleto, no de una etiqueta. El panel docente muestra la verdad del modelo; para medirla usa un bloqueo espiratorio.',
      tasks: [
        { id: 'exp', text: 'Realiza un bloqueo espiratorio válido.', test: 'validExp' },
        { id: 'time', text: 'Amplía el tiempo espiratorio a ≥ 3 s (FR o I:E).', test: 'te3' },
        { id: 'again', text: 'Repite el bloqueo espiratorio tras el cambio.', test: 'expAfterSettings' },
      ],
    },
    question: '¿Por qué la PEEP total supera la PEEP programada?',
    answer:
      'Con τ = Rexp·C larga y Texp corto, el pulmón no llega al equilibrio: queda volumen atrapado y su presión elástica se suma a la PEEP externa.',
    description: 'Rexp = 30 y tiempo espiratorio corto (FR 25, I:E 1:1): vaciamiento incompleto y auto-PEEP emergente.',
    patient: { crs: 0.05, rInsp: 10, rExp: 30, r2: 0, p0: 0 },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.5, rr: 25, ie: 1, peep: 5, pmax: 45, plimit: 100, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Volumen residual y PEEP total con bloqueo espiratorio; no se impone una cifra.',
    caution: 'Calcular, no fijar la auto-PEEP.',
  },
  {
    id: 'SC-04',
    name: 'Mayor resistencia inspiratoria',
    synthetic: true,
    category: 'Límites de presión',
    level: 2,
    lesson: {
      title: 'Plimit recorta la entrega',
      text: 'A los 20 s la R inspiratoria sube a 60. Con Plimit 30, el flujo deja de ser constante y el VT espirado cae a unos 350 mL: el ventilador sostiene la presión en vez de completar el volumen.',
      tasks: [
        { id: 'observe', text: 'Observa VTesp < VT programado tras los 20 s.', test: 'vteBelowSet' },
        { id: 'plimit', text: 'Sube Plimit (menú de modo, apartado Avanzado) y confirma.', test: 'plimitChanged' },
        { id: 'hold', text: 'Realiza un bloqueo inspiratorio válido.', test: 'validInsp' },
      ],
    },
    question: '¿Qué diferencia hay entre Plimit y Pmáx?',
    answer:
      'Plimit sostiene la presión el resto de la inspiración (el volumen puede no completarse). Pmáx termina la inspiración de inmediato y activa la alarma.',
    description: 'Rinsp = 40 desde t = 20 s: separación entre presión resistiva y elástica; efecto de Plimit.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 30, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 20_000, patient: { rInsp: 60 }, note: 'Rinsp 10 → 60' }],
    observe: 'Ppico sube, Pplat no; Plimit recorta la entrega.',
    caution: 'No cambiar C en secreto para exagerar el aspecto.',
  },
  {
    id: 'SC-05',
    name: 'Esfuerzo débil',
    synthetic: true,
    category: 'Sincronía',
    level: 3,
    lesson: {
      title: 'Esfuerzos que no disparan',
      text: 'Pmus de 0.4 cmH2O con disparo por flujo de 3 L/min: el esfuerzo mueve algo más de 1 L/min y no llega al umbral. Observa la curva de Pmus en el panel docente.',
      tasks: [
        { id: 'trig', text: 'Baja el trigger de flujo a 1 L/min en el menú de modo.', test: 'trigger1' },
        { id: 'assisted', text: 'Consigue al menos una respiración asistida: el registro la marca como «asistida».', test: 'assisted' },
        { id: 'hold', text: 'Intenta un bloqueo inspiratorio con esfuerzo y revisa su validez.', test: 'anyHold' },
      ],
    },
    question: '¿Ausencia de disparo significa ausencia de esfuerzo?',
    answer: 'No. El esfuerzo existe en el modelo (curva de Pmus del panel docente) aunque no supere el umbral del trigger.',
    description: 'Pmus 0.4 cmH2O a 18/min: los esfuerzos no disparan con 3 L/min.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
    effort: { enabled: true, amplitude: 0.4, ratePerMin: 18, tiS: 0.7, phaseS: 0.3, shape: 'riseRelax' },
    sensors: idealSensors,
    settings: { vt: 0.5, rr: 12, ie: 1 / 3, peep: 5, pmax: 40, plimit: 100, pausePct: 0, flowTrigger: 3 / 60, biasFlow: 4 / 60 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Esfuerzos inefectivos y significado de sensibilidad.',
    caution: 'Ausencia de disparo no es ausencia de esfuerzo.',
  },
  {
    id: 'SC-09',
    name: 'Oclusión de ensayo',
    synthetic: true,
    category: 'Alarmas',
    level: 2,
    lesson: {
      title: 'Pmáx termina la inspiración',
      text: 'A los 12 s la resistencia se vuelve extrema. Pmáx (40) se alcanza al inicio de cada inspiración: alarma de prioridad alta y VT casi nulo.',
      tasks: [
        { id: 'alarm', text: 'Abre la lista de alarmas mientras la alarma está activa.', test: 'alarmSeen' },
        { id: 'ack', text: 'Reconoce la alarma: la condición sigue activa.', test: 'acknowledged' },
        { id: 'fix', text: 'Deshace el evento en el panel docente y comprueba que la banda vuelve a verde.', test: 'alarmCleared' },
      ],
    },
    question: '¿Reconocer resuelve la alarma?',
    answer: 'No. Reconocer registra que el usuario la vio; la condición física sólo se resuelve cuando la presión deja de alcanzar Pmáx.',
    description: 'Rinsp = 400 desde t = 12 s: la presión alcanza Pmáx y la inspiración termina.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 100, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 12_000, patient: { rInsp: 400 }, note: 'Rinsp 10 → 400' }],
    observe: 'Límite de presión y fin de inspiración; sin divergencia numérica.',
    caution: 'Dominio de fallo del ensayo, no fisiología.',
  },
  {
    id: 'SC-18',
    name: 'Doble disparo y esfuerzos que no llegan',
    synthetic: true,
    category: 'Sincronía',
    level: 3,
    lesson: {
      title: 'El mismo esfuerzo, dos problemas opuestos',
      text: 'El paciente inspira durante 2 s pero el ventilador cicla al segundo: el esfuerzo sobrevive al ciclado y dispara una segunda respiración sobre un pulmón sin vaciar. A los 40 s la resistencia espiratoria se dispara: aparece auto-PEEP y esos mismos esfuerzos dejan de llegar al umbral.',
      tasks: [
        { id: 'ver', text: 'Observa en el registro las respiraciones asistidas seguidas de otra al poco tiempo.', test: 'assisted' },
        {
          id: 'peepi',
          text: 'Tras la perturbación, mide la PEEP total con un bloqueo espiratorio de 2 s: el hueco entre dos esfuerzos dura 3 s y uno más largo sale perturbado.',
          test: 'validExp',
        },
        { id: 'trig', text: 'Baja el disparo por flujo a 1 L/min y comprueba si recupera alguna respiración.', test: 'trigger1' },
      ],
    },
    question: '¿Por qué el mismo esfuerzo primero sobra y luego no basta?',
    answer:
      'Porque el disparo compara el flujo que genera el esfuerzo, y ese flujo depende de la mecánica. Al principio el pulmón se vacía bien, así que el esfuerzo que sobrevive al ciclado dispara otra respiración encima: eso apila volumen y, por sí solo, ya genera PEEP intrínseca. Cuando además sube la resistencia espiratoria, el esfuerzo se gasta primero en vencer la presión atrapada y deja de generar flujo suficiente para disparar.',
    description:
      'Ti neural 2 s frente a Ti mecánico 1 s: doble disparo. A los 40 s la resistencia espiratoria pasa a 60 y los esfuerzos se vuelven inefectivos.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
    effort: { enabled: true, amplitude: 12, ratePerMin: 12, tiS: 2, phaseS: 0, shape: 'riseRelax' },
    sensors: idealSensors,
    settings: {
      vt: 0.5,
      rr: 15,
      ie: 1 / 3,
      peep: 5,
      pmax: 45,
      plimit: 100,
      pausePct: 0,
      assistControl: true,
      flowTrigger: 2 / 60,
      biasFlow: 4 / 60,
    },
    initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 40_000, patient: { rExp: 60 }, note: 'Rexp 10 → 60' }],
    observe:
      'Respiraciones apiladas y la PEEP intrínseca que ellas mismas generan; después, esfuerzos sin disparo y muesca en el flujo espiratorio.',
    caution: 'Las asincronías salen de la mecánica y del disparo, no de una regla que las imponga.',
  },
  {
    id: 'SC-17',
    name: 'Dos pulmones en uno',
    synthetic: true,
    category: 'Mecánica del tejido',
    level: 3,
    lesson: {
      title: 'Constantes de tiempo distintas y pendelluft',
      text: 'Este pulmón tiene dos unidades en paralelo: una rápida y una lenta. El vaciamiento ya no es una sola exponencial y, con el circuito ocluido, el gas sigue moviéndose de una a otra.',
      tasks: [
        {
          id: 'corto',
          text: 'Mide una meseta con un bloqueo inspiratorio de 4 s (con 2 s el equipo aún no la da por asentada).',
          test: 'validInsp',
        },
        { id: 'largo', text: 'Repite con 15 s: la meseta medida baja alrededor de 1 cmH₂O.', test: 'plateauDropSeen' },
        { id: 'modelo', text: 'Abre «Datos del modelo» y compara la compliance local con la de cada unidad.', test: 'truthOpen' },
      ],
    },
    question: '¿Por qué la meseta depende de cuánto dure la oclusión?',
    answer:
      'Porque con el circuito cerrado las dos unidades no están en equilibrio entre sí: el gas pasa de la que quedó a más presión a la que quedó a menos (pendelluft) hasta igualarlas. Mientras eso ocurre la presión de la vía aérea sigue bajando, así que una oclusión corta mide una meseta más alta que la verdadera.',
    description:
      'Unidad rápida (35 mL/cmH₂O, R 5) en paralelo con una muy lenta (25 mL/cmH₂O, R 200): cola espiratoria lenta y meseta que baja alrededor de 1 cmH₂O entre una oclusión de 4 s y otra de 15 s. Con 2 s la presión aún cae demasiado deprisa y el equipo no da la meseta por válida.',
    patient: { crs: 0.035, rInsp: 5, rExp: 5, r2: 0, p0: 0, second: { crs: 0.025, rInsp: 200, rExp: 200 } },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.5, rr: 12, ie: 1 / 3, peep: 5, pmax: 45, plimit: 100, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Doble constante de tiempo en la espiración y redistribución interna durante la oclusión.',
    caution: 'La segunda unidad es del modelo; no representa un lóbulo concreto.',
  },
  {
    id: 'SC-16',
    name: 'Espiración estrangulada',
    synthetic: true,
    category: 'Mecánica obstructiva',
    level: 3,
    lesson: {
      title: 'Flujo limitado y PEEP externa',
      text: 'La vía aérea se estrecha al vaciarse y colapsa por debajo de 8 cmH₂O: el flujo espiratorio queda estrangulado y el pulmón atrapa aire. Mira la rama espiratoria del bucle flujo-volumen y mide la PEEP total.',
      tasks: [
        { id: 'bucle', text: 'Abre la vista de bucles y observa la rama espiratoria excavada.', test: 'loops' },
        { id: 'medir', text: 'Mide la PEEP total con un bloqueo espiratorio.', test: 'validExp' },
        { id: 'peep', text: 'Sube la PEEP a 8 cmH₂O y vuelve a mirar la curva de flujo.', test: 'peepAtCritical' },
      ],
    },
    question: '¿Qué gana el paciente si se sube la PEEP hasta el punto de colapso?',
    answer:
      'El atrapamiento no lo fija la PEEP sino el colapso: el pulmón se vacía hasta que su retroceso iguala la presión crítica. Al subir la PEEP de 3 a 8 la vía aérea deja de estrangularse; la PEEP total apenas cambia (de unos 9 a unos 11 cmH₂O) pero el escalón que el paciente debe vencer para disparar cae de 6 a menos de 3 cmH₂O.',
    description:
      'Colapso por debajo de 8 cmH₂O y resistencia que se triplica al vaciarse: bucle excavado y auto-PEEP que no depende de la PEEP programada.',
    patient: {
      crs: 0.06,
      rInsp: 15,
      rExp: 25,
      r2: 0,
      p0: 0,
      efl: { pcrit: 8, rusFraction: 0.5 },
      rExpVolumeDep: { gain: 3, vRefL: 1 },
    },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.5, rr: 14, ie: 1 / 3, peep: 3, pmax: 45, plimit: 100, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Rama espiratoria excavada, flujo que no vuelve a cero y PEEP total fijada por el colapso.',
    caution: 'El punto de colapso es del modelo; no es una recomendación de PEEP.',
  },
  {
    id: 'SC-15',
    name: 'Titular la PEEP sobre la curva P-V',
    synthetic: true,
    category: 'Mecánica del tejido',
    level: 3,
    lesson: {
      title: 'La compliance dibuja una U invertida',
      text: 'Este pulmón no tiene una compliance única: es rígido colapsado, se abre al subir la PEEP y vuelve a ponerse rígido si se sobredistiende. Mide la compliance con un bloqueo inspiratorio a varias PEEP.',
      tasks: [
        { id: 'medir', text: 'Mide la Cstat con un bloqueo inspiratorio a PEEP 5.', test: 'validInsp' },
        { id: 'subir', text: 'Sube la PEEP a 18 cmH₂O.', test: 'peep18' },
        { id: 'mejor', text: 'Consigue una Cstat medida por encima de 70 mL/cmH₂O.', test: 'cstatOver70' },
      ],
    },
    question: '¿Por qué la compliance vuelve a caer con PEEP alta?',
    answer:
      'Porque el pulmón entra en la parte plana superior de la curva: el mismo volumen exige mucha más presión. La compliance máxima está cerca del punto medio de la sigmoide, entre los dos codos.',
    description:
      'Curva sigmoide con capacidad 1,6 L, máxima compliance en 18 cmH₂O y codos en 11 y 25: la Cstat medida depende de la PEEP.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0, sigmoid: { b: 1.6, c: 18, d: 5 } },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.3, rr: 15, ie: 1 / 3, peep: 5, pmax: 60, plimit: 100, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Compliance medida frente a PEEP; codo inferior y sobredistensión.',
    caution: 'La curva es del modelo, no de un paciente: no es una recomendación de PEEP.',
  },
  {
    id: 'SC-14',
    name: 'La meseta que sigue bajando',
    synthetic: true,
    category: 'Mecánica del tejido',
    level: 3,
    lesson: {
      title: 'P1 y P2: la meseta tarda en asentarse',
      text: 'El tejido no es un resorte puro. Al ocluir, la presión cae de golpe lo resistivo y después sigue bajando durante segundos. Una oclusión corta lee una meseta que todavía se mueve.',
      tasks: [
        { id: 'corto', text: 'Pide un bloqueo inspiratorio de 2 s y observa por qué no es válido.', test: 'shortHoldInvalid' },
        { id: 'largo', text: 'Repítelo con 5 s o más: ahora sí se asienta.', test: 'longHoldValid' },
        {
          id: 'peeptot',
          text: 'Mide la PEEP total con un bloqueo espiratorio de 5 s: la relajación también atrapa aire, y también tarda.',
          test: 'validExp',
        },
        { id: 'modelo', text: 'Abre «Datos del modelo» y mira la presión viscoelástica.', test: 'truthOpen' },
      ],
    },
    question: '¿Por qué la Cstat de una oclusión corta parece menor que la real?',
    answer:
      'Por dos motivos que se suman. El volumen se divide por una meseta todavía alta, porque parte de esa presión es viscoelástica y aún no se disipó; y además la propia relajación atrapa aire, así que la PEEP que hay que restar no es la programada sino la total. Con la oclusión larga y la PEEP total medida con un bloqueo espiratorio, la Cstat vuelve a su valor estático.',
    description: 'Elastancia viscoelástica 20 cmH₂O/L con τ₂ 1,5 s: la oclusión muestra P1 y luego el descenso hasta P2.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0, eVisc: 20, tauViscS: 1.5 },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 100, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Diferencia entre elastancia dinámica y estática con una oclusión larga.',
    caution: 'La meseta de una pausa corta no es la meseta estática.',
  },
  {
    id: 'SC-10',
    name: 'Maniobra inválida',
    synthetic: true,
    category: 'Calidad de datos',
    level: 3,
    lesson: {
      title: 'Una meseta inestable no es una meseta',
      text: 'Con esfuerzo fuerte y continuo, el bloqueo inspiratorio resulta inestable. El resultado se marca inválido con motivo; no se fabrica Cstat.',
      tasks: [
        { id: 'inv', text: 'Realiza un bloqueo inspiratorio y observa que es inválido.', test: 'invalidHold' },
        { id: 'apnea', text: 'Aplica «Apnea» en Eventos para retirar el esfuerzo.', test: 'noEffort' },
        { id: 'valid', text: 'Repite el bloqueo: ahora es válido.', test: 'validInsp' },
      ],
    },
    question: '¿Por qué el ventilador no muestra Cstat durante el esfuerzo?',
    answer:
      'Porque la presión ocluida varía con Pmus; el estimador exige una meseta estable y declara el motivo en vez de mostrar un número engañoso.',
    description: 'Esfuerzo fuerte continuo (Pmus 8 cmH2O a 30/min): el bloqueo inspiratorio resulta inestable e inválido.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
    effort: { enabled: true, amplitude: 8, ratePerMin: 30, tiS: 0.8, phaseS: 0.2, shape: 'riseRelax' },
    sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 100, pausePct: 0, assistControl: false },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Resultado inválido con motivo; no se fabrica Cstat.',
    caution: 'No fabricar Cstat precisa en una condición no interpretable.',
  },
  {
    id: 'SC-12',
    name: 'Sensor de O2 sesgado',
    synthetic: true,
    category: 'Sensores',
    level: 3,
    lesson: {
      title: 'Objetivo, entrega y medición',
      text: 'A los 10 s el sensor de O2 adquiere un sesgo de −3 %. El ajuste sigue en 100 %, la mezcla entregada también; el número medido baja a 97.',
      tasks: [
        { id: 'see', text: 'Observa FiO2 medida 97 con ajuste 100.', test: 'fio2Gap' },
        { id: 'alarm', text: 'Configura una alarma de FiO2 baja en 98 % y compruébala.', test: 'fio2Alarm' },
        { id: 'fix', text: 'Corrige el sesgo del sensor en el panel docente.', test: 'biasZero' },
      ],
    },
    question: '¿La lectura 97 significa que se entrega 97 %?',
    answer:
      'No en este escenario: es el sensor sesgado. En un equipo real, la discrepancia obliga a verificar el sensor, no a cambiar el ajuste.',
    description: 'Sesgo −0.03 en el sensor de FiO2 desde t = 10 s sin cambiar la mezcla verdadera.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 100, pausePct: 0, fio2: 1.0 },
    initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 10_000, sensors: { fio2Bias: -0.03 }, note: 'sesgo sensor O2 −3 %' }],
    observe: 'Separar objetivo, entrega y medición.',
    caution: 'Escenario sintético; no asociado a fallas reales del equipo fotografiado.',
  },
  {
    id: 'SC-24',
    name: 'Disparo reverso',
    synthetic: true,
    category: 'Sincronía',
    level: 3,
    lesson: {
      title: 'La máquina que dispara al paciente',
      text: 'Este paciente sedado no inicia ninguna respiración: todas son de la máquina. Pero la insuflación evoca una contracción diafragmática 0,5 s después de arrancar, que muere antes del ciclado. A los 40 s la latencia pasa a 1,4 s: la contracción sobrevive al ciclado y dispara ella misma la siguiente respiración.',
      tasks: [
        {
          id: 'fase',
          text: 'Abre «Datos del modelo» y observa el Pmus: aparece siempre el mismo tiempo después del inicio de la insuflación, aunque el paciente no se esfuerce.',
          test: 'truthOpen',
        },
        {
          id: 'apiladas',
          text: 'Tras la perturbación, observa en el registro las respiraciones asistidas pegadas a la anterior.',
          test: 'assisted',
        },
      ],
    },
    question:
      '¿Por qué un paciente sedado «dispara» respiraciones justo después de las de la máquina, y por qué las apiladas sólo salen con la latencia larga?',
    answer:
      'Porque el disparo reverso no es una decisión del paciente: la insuflación pasiva evoca una contracción diafragmática a una latencia fija (entrainment). Mientras esa contracción muere antes del ciclado no se ve nada; cuando sobrevive al ciclado, su demanda cruza el umbral del disparo y la máquina entrega una segunda respiración apilada sobre la anterior.',
    description:
      'Paciente sedado con contracción evocada por cada respiración mandatoria (Pmus 8, latencia 0,5 s). A los 40 s la latencia pasa a 1,4 s y aparecen respiraciones apiladas.',
    patient: { crs: 0.045, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
    effort: {
      enabled: true,
      amplitude: 0,
      ratePerMin: 12,
      tiS: 0.8,
      phaseS: 0,
      shape: 'riseRelax',
      relaxTauS: 0.2,
      reverse: { amplitude: 8, delayS: 0.5 },
    },
    sensors: idealSensors,
    settings: {
      vt: 0.45,
      rr: 14,
      ie: 1 / 2,
      peep: 5,
      pmax: 45,
      plimit: 100,
      pausePct: 0,
      assistControl: true,
      flowTrigger: 2 / 60,
      biasFlow: 4 / 60,
    },
    initialV: 'equilibrium',
    perturbations: [{ atSimTimeMs: 40_000, effort: { reverse: { amplitude: 8, delayS: 1.4 } }, note: 'latencia evocada 0,5 → 1,4 s' }],
    observe: 'Pmus fase-bloqueada tras cada insuflación; tras la perturbación, respiraciones asistidas apiladas.',
    caution: 'El disparo reverso es un fenómeno propuesto (P): la latencia y el acoplamiento son valores del simulador, no del equipo.',
  },
];

SCENARIOS.push({
  id: 'SC-13',
  name: 'Presión control: la misma mecánica, otra variable controlada',
  synthetic: true,
  category: 'Modos',
  level: 2,
  description:
    'A/C PC con Pinsp 10 sobre PEEP 5, Tinsp 1 s, C 50 y R 10 (τ = 0,5 s). El flujo decae exponencialmente y el VT sale de la mecánica: ≈ 432 mL.',
  patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
  effort: passive,
  sensors: idealSensors,
  settings: { mode: 'AC_PC', pinsp: 10, riseMs: 100, rr: 15, ie: 1 / 3, peep: 5, pmax: 40 },
  initialV: 'equilibrium',
  perturbations: [{ atSimTimeMs: 30_000, patient: { rInsp: 20 }, note: 'Rinsp 10 → 20' }],
  observe: 'El flujo pico baja a la mitad y el VT cae; la presión no cambia.',
  caution: 'La rampa de primer orden y el tope de flujo son aproximaciones del simulador.',
  lesson: {
    title: 'En PC la presión es la consigna y el volumen la consecuencia',
    text: 'A los 30 s la resistencia se duplica: el flujo pico (ΔP/R) cae a la mitad y el VT baja aunque Pinsp no cambie. Compara con VC, donde ocurre lo contrario.',
    tasks: [
      { id: 'vt', text: 'Observa VTesp ≈ 430 mL con Pinsp 10 antes de los 30 s.', test: 'vtNear430' },
      { id: 'drop', text: 'Tras los 30 s, comprueba que VTesp cae y Ppico se mantiene.', test: 'vtDropPc' },
      {
        id: 'ti',
        text: 'Con el VTesp ya caído a ~305 mL, alarga el tiempo inspiratorio (I:E 1:1): vuelve a ~430 mL. No llega a C·ΔP = 500 porque 2 s son sólo dos constantes de tiempo (τ = 1 s con la R doblada).',
        test: 'ieOne',
      },
    ],
  },
  question: '¿Por qué en PC un Tinsp más largo aumenta el VT sólo hasta cierto punto?',
  answer: 'Porque el volumen sigue V = C·ΔP·(1 − e^(−t/τ)): tras 3–5 constantes de tiempo el flujo ya es casi cero y no entra más gas.',
});

SCENARIOS.push({
  id: 'SC-19',
  name: 'Presión de soporte: el paciente manda',
  synthetic: true,
  category: 'Modos',
  level: 2,
  description:
    'CPAP/PS con PS 10 sobre PEEP 5, ciclaje al 25 % del flujo pico. Esfuerzo de 8 cmH2O a 15/min: cada respiración la dispara y la termina el paciente; sin esfuerzo, apnea y respaldo.',
  patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
  effort: { enabled: true, amplitude: 8, ratePerMin: 15, tiS: 0.8, phaseS: 0.5, shape: 'riseRelax' },
  sensors: idealSensors,
  settings: {
    mode: 'CPAP_PS',
    psupport: 10,
    expTriggerPct: 0.25,
    riseMs: 100,
    peep: 5,
    pmax: 40,
    flowTrigger: 2 / 60,
    biasFlow: 4 / 60,
    minRate: 'off',
    apneaTimeS: 20,
    backupPinsp: 12,
    backupTinspS: 1,
  },
  initialV: 'equilibrium',
  perturbations: [],
  observe: 'Ppico = PEEP + PS en todas; el flujo se corta al 25 % de su pico; FR, Ti y VT los decide el paciente.',
  caution: 'El ciclado por flujo y el respaldo por apnea son la lógica del simulador (P, E-085), no la del equipo fotografiado.',
  lesson: {
    title: 'En soporte, el volumen es del paciente y del ventilador',
    text: 'No hay frecuencia programada: el paciente dispara, el ventilador sube a PEEP + PS y cicla cuando el flujo cae al 25 % de su pico. El VT no es una consigna: sale de PS, del esfuerzo y de la mecánica.',
    tasks: [
      {
        id: 'spont',
        text: 'Observa en el registro que todas las respiraciones son espontáneas: Ppico = 15 y el flujo se corta antes de llegar a cero.',
        test: 'spontSeen',
      },
      { id: 'ps', text: 'Sube la presión de soporte a 15: el VTesp sube (≈ 750 mL) sin que cambie el esfuerzo.', test: 'psRaised' },
      {
        id: 'apnea',
        text: 'Provoca una apnea en «Eventos»: a los 20 s alarma de apnea y respiraciones de respaldo. Deshazla y mira cómo el primer disparo del paciente resuelve la alarma.',
        test: 'apneaRecovered',
      },
    ],
  },
  question: '¿Por qué el VT cambia entre respiraciones aunque PS no cambie?',
  answer:
    'Porque en soporte el gradiente que mueve el gas es PS más el esfuerzo del paciente, y el final de la inspiración lo fija el flujo, no un tiempo: un esfuerzo distinto da un flujo distinto, un Ti distinto y un volumen distinto.',
});

SCENARIOS.push({
  id: 'SC-20',
  name: 'Ciclado tardío: el ventilador inspira más que el paciente',
  synthetic: true,
  category: 'Sincronía',
  level: 3,
  description:
    'CPAP/PS con PS 12 y ciclaje al 25 % en un pulmón obstructivo (R 30, τ = 1,5 s). El esfuerzo dura 0,6 s pero el flujo tarda ~1 s en caer al umbral: el soporte sigue cuando el paciente ya espira.',
  patient: { crs: 0.05, rInsp: 30, rExp: 30, r2: 0, p0: 0 },
  effort: {
    enabled: true,
    amplitude: 8,
    ratePerMin: 15,
    tiS: 0.6,
    phaseS: 0.5,
    shape: 'riseRelax',
    variability: { amplitudeFrac: 0.1, periodFrac: 0.1 },
  },
  sensors: idealSensors,
  settings: {
    mode: 'CPAP_PS',
    psupport: 12,
    expTriggerPct: 0.25,
    riseMs: 100,
    peep: 5,
    pmax: 40,
    flowTrigger: 2 / 60,
    biasFlow: 4 / 60,
    minRate: 'off',
    apneaTimeS: 20,
    backupPinsp: 12,
    backupTinspS: 1,
  },
  initialV: 'equilibrium',
  perturbations: [],
  observe:
    'Ti mecánico mayor que el esfuerzo (curva de Pmus del panel docente); al subir el ciclaje al 50 % la inspiración se acorta hasta el esfuerzo.',
  caution:
    'Asincronía de ciclado por la mecánica y el criterio de flujo; el modelo no simula la espiración activa con la que el paciente real pelea.',
  lesson: {
    title: 'El ciclaje espiratorio es un ajuste, no una constante',
    text: 'Con τ larga el flujo decae despacio y tarda en caer al 25 % de su pico: el ventilador sigue insuflando cuando el paciente ya terminó su esfuerzo. Subir el porcentaje de ciclaje termina antes la inspiración sin tocar PS.',
    tasks: [
      {
        id: 'late',
        text: 'Compara el Ti del ventilador con la duración del esfuerzo (curva de Pmus, 0,6 s): el soporte sigue cuando el paciente ya espira.',
        test: 'lateCycling',
      },
      { id: 'ets', text: 'Sube el ciclaje espiratorio al 50 % o más.', test: 'ets50' },
      { id: 'fixed', text: 'Comprueba que el Ti baja hasta la duración del esfuerzo, con la misma PS.', test: 'cyclingFixed' },
    ],
  },
  question: '¿Por qué el mismo criterio de ciclaje acaba bien en un pulmón y tarde en otro?',
  answer:
    'Porque el criterio es un porcentaje del flujo pico y el flujo decae con τ = R·C: con resistencia alta el pico es bajo y la caída lenta, así que el umbral llega tarde. El porcentaje de ciclaje se ajusta a la mecánica, no al revés.',
});

SCENARIOS.push({
  id: 'SC-21',
  name: 'Ventilación protectora: la presión de distensión y la potencia',
  synthetic: true,
  category: 'Ventilación protectora',
  level: 2,
  description:
    'Pulmón rígido (C 25 mL/cmH2O) en A/C VC con VT 500 a 20/min y PEEP 8: la ΔP estática pasa de 15 y la potencia mecánica ronda los 23 J/min. Qué cambia al bajar el VT, y qué no.',
  patient: { crs: 0.025, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
  effort: passive,
  sensors: idealSensors,
  settings: { vt: 0.5, rr: 20, ie: 1 / 2, peep: 8, pmax: 45, plimit: 100, pausePct: 0.1 },
  initialV: 'equilibrium',
  perturbations: [],
  observe: 'Pplat, ΔP estática y potencia mecánica en la tabla y en el resumen; cómo se mueven con el VT y con la frecuencia.',
  caution: 'Las cifras son de un modelo lineal pasivo; no son umbrales ni ajustes para ningún paciente.',
  lesson: {
    title: 'Un número para presión, volumen y frecuencia',
    text: 'La ΔP estática dice cuánta presión elástica cuesta cada volumen corriente; la potencia mecánica junta esa presión con el volumen y la frecuencia. Antes de tocar nada, anticipa cómo cambiará cada una al bajar el VT.',
    tasks: [
      { id: 'dp', text: 'Mide Pplat con un bloqueo inspiratorio y lee la ΔP estática: 15 o más.', test: 'dpHigh' },
      {
        id: 'vt',
        text: 'Baja el VT hasta que un nuevo bloqueo dé una ΔP por debajo de 15 (con C 25, 350 mL o menos).',
        test: 'dpProtective',
      },
      {
        id: 'mp',
        text: 'Comprueba en la tabla de mediciones que la potencia mecánica bajó de 15 J/min, y piensa qué le pasaría si subieras la frecuencia para recuperar el volumen minuto.',
        test: 'mpBelow',
      },
    ],
  },
  question: '¿Por qué bajar el VT reduce más la potencia que lo que reduce la ΔP?',
  answer:
    'Porque la potencia es presión por volumen por frecuencia: al bajar el VT cae el volumen y, con él, la presión elástica que ese volumen cuesta; el producto cae más que cada factor. Si después se sube la frecuencia para mantener el volumen minuto, la potencia vuelve a subir aunque la ΔP se quede baja.',
});

SCENARIOS.push({
  id: 'SC-22',
  name: 'Fuga en el circuito: lo que entra no es lo que vuelve',
  synthetic: true,
  category: 'Circuito',
  level: 2,
  description:
    'A/C VC con una fuga de 6 L/min a 10 cmH2O en la pieza en Y, paciente pasivo, flujo de base 4 y disparo 2 L/min. El VT espirado queda por debajo del inspirado y la fuga dispara respiraciones que nadie pidió.',
  patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0, leakLpmAt10: 6 },
  effort: passive,
  sensors: idealSensors,
  settings: {
    vt: 0.5,
    rr: 12,
    ie: 1 / 3,
    peep: 5,
    pmax: 40,
    plimit: 100,
    pausePct: 0,
    assistControl: true,
    flowTrigger: 2 / 60,
    biasFlow: 4 / 60,
  },
  initialV: 'equilibrium',
  perturbations: [],
  observe: 'VTi y VTe en la tabla, la fuga volumétrica, y respiraciones «asistidas» con el esfuerzo apagado.',
  caution: 'Fuga lineal con la presión y sin compensación de fuga: la del equipo real es otra (U-10).',
  lesson: {
    title: 'La fuga se ve tres veces',
    text: 'Con el circuito perdiendo gas, el ventilador entrega más de lo que vuelve, la PEEP depende de que el flujo de base cubra la fuga, y el sensor de flujo ve salir gas de forma continua. Antes de mirar el registro, predice de qué tipo serán las respiraciones con el esfuerzo apagado.',
    tasks: [
      { id: 'leak', text: 'Compara VTi y VTe en la tabla de mediciones: la fuga volumétrica supera el 15 %.', test: 'leakSeen' },
      {
        id: 'auto',
        text: 'Comprueba en el registro que hay respiraciones asistidas aunque el esfuerzo está apagado: autodisparo.',
        test: 'assisted',
      },
      {
        id: 'trig',
        text: 'Sube el disparo por flujo a 4 L/min, por encima de la fuga a esta PEEP, y comprueba que el autodisparo cesa.',
        test: 'trigger4',
      },
    ],
  },
  question: '¿Por qué la fuga dispara respiraciones si el paciente no hace nada?',
  answer:
    'Porque el disparo por flujo compara el flujo que el sensor ve salir hacia el paciente con el umbral, y el gas que escapa por la fuga sale por el mismo camino: para el ventilador es indistinguible de un esfuerzo. Subir el umbral por encima de la fuga —o compensarla, como hace el equipo real— lo corrige.',
});

SCENARIOS.push({
  id: 'SC-23',
  name: 'Desconexión: sin presión y sin volumen',
  synthetic: true,
  category: 'Circuito',
  level: 1,
  description:
    'Banco pasivo en A/C VC. En «Eventos», abre el circuito en la Y: la presión no sube de 0, no vuelve volumen y suena la alarma de desconexión; al reconectar se resuelve y hay que reconocerla.',
  patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
  effort: passive,
  sensors: idealSensors,
  settings: { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 100, pausePct: 0 },
  initialV: 'equilibrium',
  perturbations: [],
  observe:
    'Curva de presión plana en cero, VTe 0, alarmas de desconexión, Ppico baja, VTesp bajo y VMesp bajo; al reconectar, banda gris hasta reconocer.',
  caution: 'El equipo real detecta la desconexión con sus propios criterios y puede reaccionar de otra forma (U-10).',
  lesson: {
    title: 'Una alarma que no se arregla reconociéndola',
    text: 'Predice qué verás en las curvas al abrir el circuito y qué alarmas saltarán, y después provócalo.',
    tasks: [
      { id: 'disc', text: 'Provoca una desconexión en «Eventos» y observa la alarma de prioridad alta.', test: 'disconnectSeen' },
      { id: 'back', text: 'Deshaz el evento: la condición se resuelve con la primera respiración que vuelve.', test: 'reconnected' },
      { id: 'ack', text: 'Abre la lista de alarmas y reconoce las resueltas: la banda vuelve al azul.', test: 'alarmCleared' },
    ],
  },
  question: '¿Qué distingue una alarma resuelta de una reconocida?',
  answer:
    'Resolverse es del paciente y del circuito: la condición física dejó de cumplirse. Reconocer es del usuario: registra que la vio. La banda gris es la resuelta sin reconocer; sólo el reconocimiento la devuelve al azul.',
});

/** Referencia visual de las fotografías P1/P3 (O): sólo los AJUSTES visibles; C y R son artificiales; las lecturas se calculan. */
SCENARIOS.push({
  id: 'SC-P',
  name: 'Referencia de tus fotografías',
  synthetic: true,
  category: 'Referencia visual',
  level: 1,
  description:
    'VT 285 mL, FR 32, I:E 1:1.5, PEEP 16, FiO2 100 %, Pmáx 50 como en P1/P3. C = 19 mL/cmH2O y R = 8 elegidas para un aspecto cercano; las mediciones no se copian de la foto.',
  patient: { crs: 0.019, rInsp: 8, rExp: 8, r2: 0, p0: 0 },
  effort: passive,
  sensors: idealSensors,
  settings: { vt: 0.285, rr: 32, ie: 1 / 1.5, peep: 16, pmax: 50, plimit: 100, pausePct: 0, fio2: 1.0 },
  alarmLimits: { ppeakLow: 22, vteLow: 0.25, vteHigh: 0.425, mveLow: 5, mveHigh: 20, rrLow: 10, rrHigh: 40, fio2Low: 0.21, fio2High: 1.0 },
  initialV: 'equilibrium',
  perturbations: [],
  observe: 'Composición de P1/P3 con números calculados por el motor.',
  caution: 'No reconstruye al paciente de la foto ni valida sus ajustes.',
  lesson: {
    title: 'Una referencia, no un paciente recreado',
    text: 'Sólo se usan ajustes visibles. Las mediciones se calculan; no se copian los números de la fotografía.',
    tasks: [
      { id: 'hold', text: 'Solicita un bloqueo inspiratorio de 3 s.', test: 'validInsp' },
      { id: 'basic', text: 'Alterna a la vista de datos grandes.', test: 'basic' },
      { id: 'snap', text: 'Guarda una captura de pantalla.', test: 'snapshot' },
    ],
  },
  question: '¿Por qué la lectura puede diferir de la fotografía aunque los ajustes coincidan?',
  answer:
    'Porque la mecánica del paciente fotografiado es desconocida; C y R aquí son artificiales y el motor calcula sus propias lecturas.',
});

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
