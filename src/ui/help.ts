/* Ayuda contextual derivada de «R860 Lab» v1.1 (src/help.js), MIT 2026. Adaptada a los ajustes disponibles en esta etapa. */
export interface HelpEntry {
  title: string;
  text: string[];
  equation?: string;
}
export const HELP: Record<string, HelpEntry> = {
  'setting.fio2': {
    title: 'Fracción inspirada de oxígeno · FiO₂',
    text: [
      'Porcentaje de oxígeno en el gas que entrega el ventilador. El aire ambiente contiene aproximadamente 21%.',
      'El número medido representa el sensor del circuito; puede tardar en alcanzar el ajuste. No es la saturación de oxígeno del paciente.',
    ],
  },
  'setting.vt': {
    title: 'Volumen tidal · VT',
    text: [
      'Volumen objetivo de cada respiración. En VC el ventilador intenta entregarlo; la presión necesaria depende de la compliance, la resistencia y el flujo.',
      'Una limitación de presión o una fuga puede impedir alcanzar el volumen esperado. En PRVC/VS es el objetivo que orienta la adaptación de presión entre ciclos.',
    ],
  },
  'setting.rr': {
    title: 'Frecuencia respiratoria programada',
    text: [
      'Número de ciclos obligatorios por minuto. Al aumentarla, cada ciclo dispone de menos tiempo para inspiración y espiración.',
      'La frecuencia medida puede superar la programada cuando el paciente dispara respiraciones adicionales.',
    ],
    equation: 'Duración del ciclo = 60 / FR',
  },
  'setting.ie': {
    title: 'Relación inspiración : espiración · I:E',
    text: [
      'Distribuye el tiempo del ciclo. Una relación 1:2 reserva el doble de tiempo para espirar que para inspirar.',
      'A igual frecuencia, aumentar el segundo número alarga la espiración y acorta la inspiración; en VC esto exige un flujo inspiratorio mayor.',
    ],
    equation: 'Ti = (60 / FR) / (1 + x) · Te = x × Ti',
  },
  'setting.peep': {
    title: 'Presión positiva al final de la espiración · PEEP',
    text: [
      'Presión externa que el ventilador mantiene durante la espiración. Es la referencia desde la que se entrega Pinsp o presión de soporte.',
      'La presión alveolar al final de la espiración puede ser mayor si queda gas atrapado. Esa diferencia es la PEEP intrínseca y se evalúa mediante un bloqueo espiratorio.',
    ],
  },
  'setting.pmax': {
    title: 'Presión máxima · Pmáx',
    text: [
      'Techo de presión total en la vía aérea. En este simulador, alcanzarlo durante una inspiración por volumen interrumpe la entrega y activa la alarma.',
      'No determina cuánta presión se intenta entregar: Pinsp establece el incremento sobre PEEP; Plimit limita la entrega de VC antes de alcanzar este techo.',
    ],
  },
  'setting.plimit': {
    title: 'Límite de presión de entrega · Plimit',
    text: [
      'Limita la presión mientras se entrega una respiración por volumen. Cuando se alcanza, el flujo deja de ser constante y el volumen objetivo puede no completarse.',
      'Pmáx sigue siendo el techo de protección. Plimit se configura por encima de PEEP y no puede superar Pmáx.',
    ],
  },
  'setting.pinsp': {
    title: 'Presión inspiratoria · Pinsp',
    text: [
      'Incremento de presión por encima de PEEP durante los ciclos controlados por presión. El volumen obtenido depende de la compliance, la resistencia, el tiempo inspiratorio y el esfuerzo.',
      'Por ejemplo, PEEP 5 y Pinsp 15 corresponden a una presión objetivo de 20 cmH₂O.',
    ],
    equation: 'Pva objetivo = PEEP + Pinsp',
  },
  'setting.ps': {
    title: 'Presión de soporte · PS',
    text: [
      'Ayuda de presión por encima de PEEP para una respiración iniciada por el paciente. El paciente dispara el ciclo y el descenso del flujo determina su final.',
      'Más soporte suele aumentar el volumen entregado; el resultado también depende del esfuerzo y de la mecánica respiratoria.',
    ],
  },
  'setting.rise': {
    title: 'Rampa de presión',
    text: [
      'Tiempo que tarda la presión en subir desde PEEP hasta el objetivo en modos de presión y soporte.',
      'Un tiempo menor produce una subida más rápida y mayor flujo inicial. Un tiempo mayor suaviza el ascenso. El modelo utiliza una rampa lineal.',
    ],
  },
  'setting.pause': {
    title: 'Pausa inspiratoria programada',
    text: [
      'Fracción del tiempo inspiratorio durante la que se mantiene la oclusión sin entregar flujo, en cada respiración por volumen.',
      'El mismo VT debe entrar durante el tiempo restante: aumentar la pausa eleva el flujo requerido. El bloqueo inspiratorio manual, en cambio, es una maniobra de medición puntual.',
    ],
  },
  'setting.trigger': {
    title: 'Sensibilidad de disparo por flujo',
    text: [
      'Umbral de flujo generado por el esfuerzo que inicia una respiración asistida. Un valor menor hace el disparo más sensible.',
      'Con atrapamiento de gas, parte del esfuerzo se consume en vencer la PEEP intrínseca y puede no llegar a disparar el ventilador.',
    ],
  },
  'setting.triggerPressure': {
    title: 'Sensibilidad de disparo por presión',
    text: [
      'Magnitud de la caída de presión necesaria para iniciar la asistencia. Un umbral menor requiere menos esfuerzo.',
      'Se introduce como un número positivo. En este modelo representa el esfuerzo disponible después de vencer la carga de PEEP intrínseca.',
    ],
  },
  'setting.triggerType': {
    title: 'Tipo de disparo',
    text: [
      'Selecciona la señal utilizada para detectar el intento inspiratorio: flujo o presión.',
      'El disparo inicia la inspiración asistida. No debe confundirse con el ciclaje, que decide cuándo termina.',
    ],
  },
  'setting.assist': {
    title: 'Disparo asistido en A/C',
    text: [
      'Permite que el esfuerzo del paciente inicie un ciclo completo del modo seleccionado, además de los ciclos por tiempo.',
      'La frecuencia medida puede aumentar, pero los objetivos de volumen o presión de esos ciclos siguen siendo los configurados.',
    ],
  },
  'setting.expTrigger': {
    title: 'Ciclaje espiratorio',
    text: [
      'Finaliza una respiración de soporte cuando el flujo inspiratorio cae al porcentaje indicado de su máximo.',
      'Un porcentaje mayor tiende a terminar antes la inspiración; uno menor tiende a prolongarla. El tiempo inspiratorio máximo sigue actuando como límite.',
    ],
  },
  'setting.tiMax': {
    title: 'Tiempo inspiratorio máximo',
    text: [
      'Duración máxima de un ciclo asistido por soporte. Finaliza la inspiración si el flujo todavía no ha alcanzado el criterio de ciclaje.',
      'No fija la duración de todos los ciclos: el ciclaje por flujo puede terminarlos antes.',
    ],
  },
  'setting.simvTi': {
    title: 'Tiempo inspiratorio obligatorio · SIMV',
    text: [
      'Duración de los ciclos obligatorios de SIMV. La frecuencia programada determina la duración total del ciclo y, por diferencia, el tiempo disponible para espirar.',
      'Las respiraciones espontáneas intermedias utilizan presión de soporte y su propio criterio de ciclaje.',
    ],
  },
  'setting.apnea': {
    title: 'Tiempo de apnea',
    text: [
      'Intervalo sin respiraciones detectadas antes de activar ventilación de respaldo en los modos espontáneos.',
      'El respaldo del simulador utiliza control por presión. Sus ajustes de frecuencia y presión se definen por separado.',
    ],
  },
  'setting.backupRR': {
    title: 'Frecuencia de respaldo',
    text: [
      'Frecuencia de los ciclos obligatorios utilizados cuando se activa el respaldo por apnea.',
      'No modifica la frecuencia de los esfuerzos del paciente: determina la asistencia por tiempo durante el respaldo.',
    ],
  },
  'setting.backupPinsp': {
    title: 'Presión inspiratoria de respaldo',
    text: [
      'Presión adicional sobre PEEP utilizada durante los ciclos de respaldo por apnea.',
      'Como en PC, el volumen resultante cambia con la mecánica y el esfuerzo; no es un volumen garantizado.',
    ],
  },
  'setting.pmin': {
    title: 'Presión adaptativa mínima',
    text: [
      'Límite inferior del incremento de presión que puede utilizar el controlador de PRVC o VS. Se expresa por encima de PEEP.',
      'Delimita la adaptación entre respiraciones; no fuerza una presión constante. El controlador de esta aplicación es una aproximación docente.',
    ],
  },
  'patient.compliance': {
    title: 'Compliance estática (CEST)',
    text: [
      'Volumen que gana el sistema respiratorio por cada cmH₂O de presión de distensión, sin flujo. Una CEST menor significa un sistema más rígido: el mismo volumen requiere más presión.',
      'Aquí ajustas la propiedad del modelo. La CEST mostrada como medición se calcula durante una oclusión válida; no se copia de este control.',
    ],
    equation: 'CEST = VT / (Pplat − PEEP total) · mL/cmH₂O',
  },
  'patient.resistance': {
    title: 'Resistencia inspiratoria',
    text: [
      'Oposición de la vía aérea al paso del flujo inspiratorio. A mayor resistencia o mayor flujo, mayor diferencia entre presión pico y presión de meseta.',
      'En VC pasivo, elevarla aumenta principalmente Ppico; no eleva por sí sola la presión elástica estática.',
    ],
    equation: 'Presión resistiva = R × flujo',
  },
  'patient.expResistance': {
    title: 'Resistencia espiratoria',
    text: [
      'Oposición a la salida de gas durante la espiración. Una resistencia mayor enlentece el vaciamiento.',
      'Si el siguiente ciclo empieza antes de vaciarse suficientemente, queda gas atrapado y aumenta la PEEP intrínseca.',
    ],
    equation: 'Constante de tiempo espiratoria: τ = Rexp × CEST',
  },
  'patient.effort': {
    title: 'Intensidad del esfuerzo',
    text: [
      'Amplitud de la presión generada por los músculos inspiratorios del paciente virtual. Cero representa un paciente pasivo.',
      'El esfuerzo puede disparar respiraciones y aumentar el volumen. Durante un bloqueo también modifica la presión: una línea sin flujo no garantiza una medición estática válida.',
    ],
  },
  'patient.patientRR': {
    title: 'Frecuencia del paciente',
    text: [
      'Número de intentos inspiratorios del paciente virtual por minuto, independiente de la frecuencia programada en el ventilador.',
      'No todos los esfuerzos necesariamente disparan un ciclo. El umbral de disparo, el momento del esfuerzo y la PEEP intrínseca influyen en la detección.',
    ],
  },
  'patient.muscleTi': {
    title: 'Duración del esfuerzo',
    text: [
      'Tiempo durante el que actúan los músculos en cada intento inspiratorio. No es el tiempo inspiratorio programado del ventilador.',
      'Una diferencia importante entre ambos tiempos puede hacer que el esfuerzo continúe después de que el ventilador haya ciclado a espiración.',
    ],
  },
  'patient.leak': {
    title: 'Fuga del circuito',
    text: [
      'Flujo que se pierde fuera del circuito, expresado a una presión de referencia de 20 cmH₂O. En el modelo, la pérdida aumenta con la presión.',
      'Puede disminuir el volumen que vuelve al sensor y hacer caer la presión durante una oclusión. El volumen trazado integra el sensor, no el volumen anatómico del pulmón.',
    ],
  },
  'metric.ppeak': {
    title: 'Presión pico · Ppico',
    text: [
      'Máxima presión medida durante la inspiración. En ventilación pasiva incluye la presión elástica y la necesaria para vencer la resistencia al flujo.',
      'Por eso una presión pico alta no identifica por sí sola cuál de esos componentes aumentó.',
    ],
    equation: 'Ppico ≈ PEEP total + VT / CEST + R × flujo',
  },
  'metric.peep': {
    title: 'PEEP externa medida · PEEPe',
    text: [
      'Presión de la vía aérea al final de la espiración observada por el sensor. No equivale necesariamente a la presión alveolar cuando aún hay flujo espiratorio.',
      'Para estimar la PEEP total se detiene el flujo mediante un bloqueo espiratorio.',
    ],
  },
  'metric.pplat': {
    title: 'Presión de meseta · Pplat',
    text: [
      'Presión durante la oclusión al final de la inspiración, cuando ya no hay flujo. En el paciente pasivo refleja la carga elástica del sistema respiratorio.',
      'El flujo desaparece, el volumen se mantiene y la presión cae desde el pico resistivo hacia una meseta. El esfuerzo o una fuga impiden interpretarla como una medición estática fiable.',
    ],
  },
  'metric.pmean': {
    title: 'Presión media · Pmedia',
    text: [
      'Promedio temporal de la presión de la vía aérea a lo largo de todo el ciclo, no la media entre Ppico y PEEP.',
      'Depende tanto de los niveles de presión como del tiempo mantenido en cada uno. Un bloqueo prolongado también modifica este promedio.',
    ],
  },
  'metric.mv': {
    title: 'Volumen minuto espirado · VMesp',
    text: [
      'Cantidad de gas que vuelve por el sensor en un minuto. El simulador la obtiene del volumen espirado y del tiempo de los ciclos recientes.',
      'Depende del volumen por respiración y de la frecuencia, pero no equivale a la ventilación alveolar porque no descuenta espacio muerto.',
    ],
    equation: 'En respiraciones regulares: VM ≈ VTe × FR',
  },
  'metric.rr': {
    title: 'Frecuencia respiratoria medida · FR',
    text: [
      'Número de ciclos detectados por minuto, calculado a partir de los ciclos recientes. Incluye los disparados por el paciente y los iniciados por tiempo.',
      'Una maniobra de bloqueo alarga el ciclo; por eso la frecuencia medida puede bajar transitoriamente sin haber cambiado el ajuste.',
    ],
  },
  'metric.vte': {
    title: 'Volumen tidal espirado · VTesp',
    text: [
      'Volumen que regresa por el sensor durante la espiración. Se calcula integrando el flujo espiratorio.',
      'Puede diferir del volumen ajustado o inspirado por fuga, limitación de presión o cambios transitorios del volumen retenido.',
    ],
  },
  'metric.vti': {
    title: 'Volumen tidal inspirado · VTi',
    text: [
      'Volumen de gas que pasa por el sensor en sentido inspiratorio. Se obtiene integrando el flujo positivo de la respiración.',
      'No es necesariamente el volumen que alcanza el compartimento pulmonar cuando existe una fuga en el circuito.',
    ],
  },
  'metric.fio2': {
    title: 'FiO₂ medida',
    text: [
      'Porcentaje de oxígeno indicado por el sensor del circuito. Tras cambiar el ajuste, su respuesta no es instantánea.',
      'Es una medición del gas inspirado, no de la oxigenación sanguínea. El modelo no calcula SpO₂ ni gasometría.',
    ],
  },
  'metric.mvSpont': {
    title: 'Volumen minuto espontáneo',
    text: [
      'Parte del volumen minuto procedente de respiraciones clasificadas como espontáneas por el modo activo.',
      'Los ciclos asistidos completos de A/C no se contabilizan aquí como soporte espontáneo, aunque los haya disparado el paciente.',
    ],
  },
  'metric.rrSpont': {
    title: 'Frecuencia espontánea',
    text: [
      'Frecuencia de los ciclos clasificados como espontáneos: respiraciones de soporte, no todos los esfuerzos musculares.',
      'Puede diferir tanto de la frecuencia programada como de los intentos del paciente que no llegan a disparar asistencia.',
    ],
  },
  'metric.cstat': {
    title: 'Compliance estática (CEST)',
    text: [
      'Relaciona el volumen inspirado con el aumento de presión estática. Una cifra menor significa que el mismo volumen exige más presión.',
      'Se estima con una meseta válida y una referencia de PEEP total fiable. Con atrapamiento, mide primero PEEP total; la CEST del panel docente es una propiedad independiente del modelo.',
    ],
    equation: 'CEST = VTi / (Pplat − PEEP total)',
  },
  'metric.driving': {
    title: 'Presión de distensión · ΔP estática',
    text: [
      'Incremento de presión elástica entre el final de espiración y el final de inspiración, con el paciente pasivo y sin flujo.',
      'Se calcula usando PEEP total, no sólo PEEP programada cuando existe auto-PEEP. No es equivalente a Ppico menos PEEP.',
    ],
    equation: 'ΔP = Pplat − PEEP total',
  },
  'metric.leak': {
    title: 'Fuga volumétrica estimada',
    text: [
      'Porcentaje del volumen inspirado que no vuelve por el sensor en el ciclo medido.',
      'Una diferencia transitoria también puede reflejar cambios del volumen retenido, no necesariamente una fuga. Se interpreta junto con la señal y el estado del circuito.',
    ],
    equation: 'Fuga (%) = 100 × (VTi − VTe) / VTi',
  },
  'metric.rinsp': {
    title: 'Resistencia inspiratoria estimada',
    text: [
      'Separa la presión necesaria para vencer el flujo de la presión elástica. En un ciclo VC pasivo de flujo constante, utiliza la diferencia entre pico y meseta.',
      'El resultado pierde validez con esfuerzo, fuga, limitación de presión o un flujo que no cumple esas condiciones.',
    ],
    equation: 'Rinsp ≈ (Ppico − Pplat) / flujo inspiratorio (L/s)',
  },
  'metric.rsbi': {
    title: 'Índice de respiración rápida superficial · FR/VT',
    text: [
      'Relación entre la frecuencia y el volumen corriente en litros durante respiraciones espontáneas. Una cifra mayor representa respiraciones más rápidas o de menor volumen.',
      'Este simulador muestra la relación mecánica; no determina por sí sola la posibilidad de retirar el soporte.',
    ],
    equation: 'FR/VT = frecuencia (/min) / volumen tidal (L)',
  },
  'teacher.tau': {
    title: 'Constante de tiempo espiratoria · τ',
    text: [
      'Describe la rapidez de vaciamiento de un compartimento pasivo. Combina compliance y resistencia espiratoria.',
      'En una constante de tiempo se elimina aproximadamente el 63% del volumen por encima del equilibrio. Un valor mayor significa que se necesita más tiempo para espirar.',
    ],
    equation: 'τ = Rexp × CEST (en L/cmH₂O)',
  },
  'teacher.auto': {
    title: 'PEEP intrínseca · PEEPi',
    text: [
      'Presión que queda por encima de la PEEP externa cuando la espiración no se ha completado. En una oclusión espiratoria pasiva, la presión se equilibra hacia la PEEP total.',
      'Este recuadro muestra el estado interno del modelo al comienzo del último ciclo. La medición del ventilador se obtiene mediante el bloqueo.',
    ],
    equation: 'PEEPi = PEEP total − PEEP externa',
  },
  'teacher.vtpbw': {
    title: 'Volumen / peso corporal predicho',
    text: [
      'Normaliza el volumen pulmonar inspirado respecto de un peso de referencia calculado con talla y ecuación seleccionada.',
      'No utiliza el peso real. En esta aplicación es un dato descriptivo y no cambia automáticamente los ajustes ni la mecánica.',
    ],
  },
  'teacher.missed': {
    title: 'Esfuerzos no disparados',
    text: [
      'Cuenta intentos inspiratorios que no originaron una respiración asistida.',
      'Pueden ocurrir por un umbral elevado, por PEEP intrínseca o porque el esfuerzo cayó fuera de un momento elegible para el disparo.',
    ],
  },
  'procedure.inspiratory': {
    title: 'Bloqueo inspiratorio',
    text: [
      'Al terminar la inspiración se ocluyen los puertos. Sin fuga, el flujo pasa a cero y el volumen queda constante. En el paciente pasivo, la presión desciende desde el pico hasta la meseta.',
      'Permite medir Pplat y calcular CEST si la referencia espiratoria es válida. El esfuerzo puede deformar la presión, aunque no haya flujo; no se fuerza una meseta artificial.',
    ],
    equation: 'Flujo = 0 · Volumen constante · Pva → Pplat',
  },
  'procedure.expiratory': {
    title: 'Bloqueo espiratorio',
    text: [
      'Ocluye el circuito al final de la espiración, antes del siguiente ciclo. El flujo se detiene y el volumen queda al nivel alcanzado al terminar la espiración.',
      'La presión se equilibra con la presión alveolar: sin atrapamiento permanece cerca de PEEP; con auto-PEEP sube hacia PEEP total. El esfuerzo y la fuga alteran la interpretación. El cero de la curva de volumen es relativo al ciclo: no excluye gas atrapado.',
    ],
    equation: 'Flujo = 0 · Volumen constante · PEEP total − PEEP = PEEPi',
  },
  'procedure.alarms': {
    title: 'Límites y alarmas',
    text: [
      'Los límites comparan mediciones de los ciclos con el intervalo elegido. Un valor fuera de rango debe persistir para activar ciertas alarmas.',
      'Silenciar sólo pausa el sonido. Reconocer registra la revisión; no elimina una condición que sigue activa. Pmáx se configura con los ajustes de ventilación.',
    ],
  },
  'procedure.sbt': {
    title: 'Prueba de respiración espontánea',
    text: [
      'Cambia temporalmente a CPAP/PS con los valores seleccionados y registra la mecánica respiratoria durante el tiempo elegido. Al finalizar restaura los ajustes anteriores.',
      'Es un ejercicio de simulación: no incluye oxigenación, hemodinámica ni una evaluación de extubación.',
    ],
  },
  'procedure.duration': {
    title: 'Duración de la maniobra',
    text: [
      'Tiempo de oclusión medido desde que comienza el bloqueo, no desde que se solicita. Primero debe llegar el final de la fase correspondiente.',
      'El reloj continúa, pero no se inician ciclos nuevos durante la oclusión. Al terminar se libera el circuito y continúa la secuencia ventilatoria.',
    ],
  },
};
