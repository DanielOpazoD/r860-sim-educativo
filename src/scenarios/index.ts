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

const passive: EffortParams = { enabled: false, amplitude: 0, ratePerMin: 12, tiS: 0.8, phaseS: 0 };
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
        { id: 'peep', text: 'Cambia la PEEP y observa que Pplat sube en la misma cantidad.', test: 'peepChanged' },
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
      text: 'A los 20 s la R inspiratoria sube a 40. Con Plimit 30, el flujo deja de ser constante y el VT espirado cae por debajo del programado.',
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
    perturbations: [{ atSimTimeMs: 20_000, patient: { rInsp: 40 }, note: 'Rinsp 10 → 40' }],
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
      text: 'Pmus de 0.4 cmH2O con disparo por flujo de 3 L/min: el esfuerzo mueve unos 2 L/min y no dispara. Observa la curva de Pmus en el panel docente.',
      tasks: [
        { id: 'trig', text: 'Baja el trigger de flujo a 1 L/min en el menú de modo.', test: 'trigger1' },
        { id: 'assisted', text: 'Consigue una respiración asistida (FR medida > programada).', test: 'assisted' },
        { id: 'hold', text: 'Intenta un bloqueo inspiratorio con esfuerzo y revisa su validez.', test: 'anyHold' },
      ],
    },
    question: '¿Ausencia de disparo significa ausencia de esfuerzo?',
    answer: 'No. El esfuerzo existe en el modelo (curva de Pmus del panel docente) aunque no supere el umbral del trigger.',
    description: 'Pmus 0.4 cmH2O a 18/min: los esfuerzos no disparan con 3 L/min.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
    effort: { enabled: true, amplitude: 0.4, ratePerMin: 18, tiS: 0.7, phaseS: 0.3 },
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
        { id: 'peepi', text: 'Tras la perturbación, mide la PEEP total con un bloqueo espiratorio.', test: 'validExp' },
        { id: 'trig', text: 'Baja el disparo por flujo a 1 L/min y comprueba si recupera alguna respiración.', test: 'trigger1' },
      ],
    },
    question: '¿Por qué el mismo esfuerzo primero sobra y luego no basta?',
    answer:
      'Porque el disparo compara el flujo que genera el esfuerzo, y ese flujo depende de la mecánica. Al principio el pulmón se vacía bien, así que el esfuerzo que sobrevive al ciclado dispara otra respiración encima: eso apila volumen y, por sí solo, ya genera PEEP intrínseca. Cuando además sube la resistencia espiratoria, el esfuerzo se gasta primero en vencer la presión atrapada y deja de generar flujo suficiente para disparar.',
    description:
      'Ti neural 2 s frente a Ti mecánico 1 s: doble disparo. A los 40 s la resistencia espiratoria pasa a 60 y los esfuerzos se vuelven inefectivos.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
    effort: { enabled: true, amplitude: 12, ratePerMin: 12, tiS: 2, phaseS: 0 },
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
        { id: 'corto', text: 'Mide una meseta con un bloqueo inspiratorio de 2 s.', test: 'validInsp' },
        { id: 'largo', text: 'Repite con 15 s: la meseta medida baja unos 2 cmH₂O.', test: 'plateauDropSeen' },
        { id: 'modelo', text: 'Abre «Datos del modelo» y compara la compliance local con la de cada unidad.', test: 'truthOpen' },
      ],
    },
    question: '¿Por qué la meseta depende de cuánto dure la oclusión?',
    answer:
      'Porque con el circuito cerrado las dos unidades no están en equilibrio entre sí: el gas pasa de la que quedó a más presión a la que quedó a menos (pendelluft) hasta igualarlas. Mientras eso ocurre la presión de la vía aérea sigue bajando, así que una oclusión corta mide una meseta más alta que la verdadera.',
    description:
      'Unidad rápida (35 mL/cmH₂O, R 5) en paralelo con una muy lenta (25 mL/cmH₂O, R 200): cola espiratoria lenta y meseta que baja unos 2 cmH₂O entre una oclusión de 2 s y otra de 15 s.',
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
        { id: 'peeptot', text: 'Mide la PEEP total con un bloqueo espiratorio: la relajación también atrapa aire.', test: 'validExp' },
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
    effort: { enabled: true, amplitude: 8, ratePerMin: 30, tiS: 0.8, phaseS: 0.2 },
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
  caution: 'La rampa lineal y el tope de flujo son aproximaciones del simulador.',
  lesson: {
    title: 'En PC la presión es la consigna y el volumen la consecuencia',
    text: 'A los 30 s la resistencia se duplica: el flujo pico (ΔP/R) cae a la mitad y el VT baja aunque Pinsp no cambie. Compara con VC, donde ocurre lo contrario.',
    tasks: [
      { id: 'vt', text: 'Observa VTesp ≈ 430 mL con Pinsp 10 antes de los 30 s.', test: 'vtNear430' },
      { id: 'drop', text: 'Tras los 30 s, comprueba que VTesp cae y Ppico se mantiene.', test: 'vtDropPc' },
      { id: 'ti', text: 'Alarga el tiempo inspiratorio (I:E 1:1) y observa el VT acercarse a C·ΔP = 500 mL.', test: 'ieOne' },
    ],
  },
  question: '¿Por qué en PC un Tinsp más largo aumenta el VT sólo hasta cierto punto?',
  answer: 'Porque el volumen sigue V = C·ΔP·(1 − e^(−t/τ)): tras 3–5 constantes de tiempo el flujo ya es casi cero y no entra más gas.',
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
