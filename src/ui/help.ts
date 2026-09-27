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
      'Techo de presión en la vía aérea. Alcanzarlo termina la inspiración y activa la alarma de prioridad alta.',
      'En presión control, Pinsp fija el incremento sobre PEEP y Pmáx sigue siendo el techo. En volumen control puede añadirse un límite inferior (Plimit, ajuste avanzado) que recorta la presión sin terminar la inspiración.',
    ],
  },
  'setting.plimit': {
    title: 'Límite de presión de entrega · Plimit',
    text: [
      'Limita la presión mientras se entrega una respiración por volumen. Cuando se alcanza, el flujo deja de ser constante y el volumen objetivo puede no completarse.',
      'Ajuste avanzado: por omisión está en su máximo y no actúa; Pmáx es el techo. Si se baja por debajo de Pmáx, recorta la presión antes de que Pmáx termine la inspiración.',
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
      'Caída de presión por debajo de la PEEP que inicia la asistencia (por ejemplo −2 cmH₂O). Un umbral más cercano a cero requiere menos esfuerzo.',
      'La presión sólo cae cuando el esfuerzo del paciente supera el flujo de base; con atrapamiento, parte del esfuerzo se gasta en vencer la PEEP intrínseca antes de que la presión baje.',
    ],
  },
  'setting.biasFlow': {
    title: 'Flujo de base',
    text: [
      'Flujo continuo que circula por el circuito durante la espiración. El disparo por flujo detecta la parte de ese flujo que el paciente desvía hacia sus pulmones, por eso el umbral de disparo no puede superar el flujo de base.',
      'Mientras el esfuerzo del paciente pide menos que el flujo de base, la presión en la vía aérea se mantiene en PEEP; si pide más, la presión cae (deflexión de disparo).',
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
  'setting.minRate': {
    title: 'Frecuencia mínima',
    text: [
      'En CPAP/PS el paciente decide la frecuencia. Si pasa más de 60/FRmín segundos sin ninguna respiración, el ventilador entrega una controlada por presión con la Pinsp y el Tinsp de respaldo.',
      'Off deja al paciente sin ese suelo: entonces sólo el tiempo de apnea protege, con su alarma y su respaldo.',
    ],
  },
  'setting.backupPinsp': {
    title: 'Pinsp de respaldo',
    text: [
      'Presión sobre PEEP de las respiraciones que el ventilador entrega por su cuenta en CPAP/PS: las de la frecuencia mínima y las del respaldo por apnea.',
      'No cambia el soporte de las respiraciones que dispara el paciente; ésas usan PS.',
    ],
    equation: 'Pva objetivo = PEEP + Pinsp de respaldo',
  },
  'setting.backupTinsp': {
    title: 'Tinsp de respaldo',
    text: [
      'Duración de las respiraciones de respaldo. Las que dispara el paciente no la usan: terminan cuando el flujo cae al porcentaje de ciclaje o, como tope, a los 3 s.',
    ],
  },
  'setting.backupRR': {
    title: 'Frecuencia de respaldo',
    text: [
      'Frecuencia de los ciclos obligatorios utilizados cuando se activa el respaldo por apnea.',
      'No modifica la frecuencia de los esfuerzos del paciente: determina la asistencia por tiempo durante el respaldo.',
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
  'patient.second': {
    title: 'Segunda unidad alveolar',
    text: [
      'Añade en paralelo una segunda unidad con su propia compliance y resistencia, es decir, con otra constante de tiempo. Ambas comparten el nodo de la vía aérea, así que el pulmón deja de vaciarse con una sola exponencial: al final domina la unidad lenta.',
      'Con el circuito ocluido aparece el pendelluft: el gas pasa de la unidad rápida a la lenta hasta igualar presiones, de modo que la meseta sigue bajando y su valor depende de cuánto dure la oclusión. Con compliance 0 hay un solo compartimento.',
    ],
    equation: 'Ocluido: ΔP decae con τ = (R₁+R₂)·C₁·C₂/(C₁+C₂)',
  },
  'patient.efl': {
    title: 'Colapso espiratorio (limitación al flujo)',
    text: [
      'Por debajo de esta presión el segmento colapsable de la vía aérea se estrecha y el flujo espiratorio deja de depender de la presión aguas abajo: queda fijado por el retroceso elástico y por la resistencia que hay antes del punto de estrangulamiento.',
      'Consecuencias: espirar con más fuerza no saca más gas, el pulmón atrapa hasta que su retroceso iguala esta presión, y subir la PEEP hasta ese valor abre la vía aérea sin aumentar la PEEP total. Con 0 no hay colapso.',
    ],
    equation: 'Qmax = (Pel − Pcrít)/(f·Rexp),  sólo si Pva < Pcrít',
  },
  'patient.airwayCollapse': {
    title: 'Estrechamiento al vaciarse',
    text: [
      'Multiplica la resistencia espiratoria a medida que el pulmón se vacía, porque el calibre de la vía aérea depende del volumen pulmonar. Con 0 la resistencia es constante y el flujo resulta exactamente proporcional al volumen, es decir, la rama espiratoria del bucle es una recta.',
      'Al subirlo, esa rama se hunde: es el bucle excavado del paciente obstructivo.',
    ],
    equation: 'Rexp(V) = Rexp·(1 + ganancia·(1 − V/Vref))',
  },
  'patient.sigmoid': {
    title: 'Curva presión-volumen sigmoidea',
    text: [
      'Con capacidad 0 el pulmón es un resorte de compliance constante y el bucle presión-volumen es una recta. Al darle capacidad, la curva pasa a tener forma de S: rígida abajo (unidades colapsadas), máxima compliance en la presión c y rígida otra vez arriba (sobredistensión).',
      'Los codos caen en c ± 1,317·d y la compliance máxima vale b/(4·d). Sirve para titular PEEP: la compliance medida dibuja una U invertida y cae de nuevo si la PEEP sobredistiende.',
    ],
    equation: 'V(P) = a + b/(1 + e^(−(P−c)/d))',
  },
  'patient.recruit': {
    title: 'Reclutamiento alveolar (histéresis P-V)',
    text: [
      'Una parte de la capacidad elástica está colapsada mientras la presión de distensión no supera la de apertura; una vez abierta no se cierra hasta caer por debajo de la de cierre, que es menor. Entre ambas el estado se conserva: subir y bajar la presión no recorre la misma curva — esa zona muerta es la histéresis estática del pulmón real.',
      'Reclutar suma compliance: a la misma presión el volumen sube y el Pplat baja. Con una PEEP suficiente las unidades quedan abiertas y la bajada posterior ya no devuelve la compliance inicial: es el fenómeno de la tabla de PEEP decremental. Apertura y cierre tienen cada una su constante de tiempo.',
    ],
    equation: 'C efectiva = C·(1 + r·frac),  r: 0→1 si Pel−P0 > Papertura',
  },
  'patient.viscoelastic': {
    title: 'Relajación viscoelástica (E₂)',
    text: [
      'El tejido pulmonar y la pared torácica no responden sólo como un resorte: parte de la presión se disipa lentamente. Al ocluir, la presión cae de golpe lo resistivo (Ppico → P1) y después sigue bajando durante uno a tres segundos hasta la meseta estática (P2).',
      'Con 0 el sistema es un resorte puro y la meseta es plana desde el primer instante. Al subir E₂ aumenta la diferencia entre P1 y P2, es decir entre la elastancia dinámica y la estática.',
    ],
    equation: 'Pel = P0 + V/Cest + E₂·(V − Vve),  dVve/dt = (V − Vve)/τ₂',
  },
  'patient.viscTau': {
    title: 'Constante viscoelástica (τ₂)',
    text: [
      'Tiempo característico de la relajación. Con τ₂ de 1,2 s hace falta una oclusión de unos 3 s para que la meseta se asiente; una pausa corta la lee todavía en descenso y el simulador la declara no válida.',
    ],
  },
  'patient.rohrer': {
    title: 'Resistencia de Rohrer (K₂)',
    text: [
      'Componente turbulenta de la resistencia: se suma a la resistencia lineal en proporción al flujo. Con K₂ mayor que cero, la diferencia entre Ppico y Pplat deja de ser proporcional al flujo y crece más deprisa al acelerar la inspiración.',
      'Es lo que aporta sobre todo el tubo endotraqueal: a menor diámetro, mayor K₂.',
    ],
    equation: 'R(Q) = K₁ + K₂·|Q|',
  },
  'patient.presetTissue': {
    title: 'Preset de tejido (E₂/τ₂)',
    text: [
      'Valores de referencia de la relajación viscoelástica: «Adulto sano» usa E₂ ≈ 3 cmH₂O/L y τ₂ ≈ 1,1 s para el sistema respiratorio total anestesiado-paralizado (D’Angelo 1989/1991, método de oclusión rápida a flujo constante); «Restrictivo / SDRA» multiplica la viscoelasticidad por 2–3 (orden de magnitud de las series con oclusión en lesión pulmonar aguda).',
      'Son valores aproximados de literatura (P), no medidas del equipo. Al elegir un preset se rellenan los deslizadores E₂ y τ₂; ajustarlos a mano deja el preset en «Personalizado».',
    ],
  },
  'patient.presetTube': {
    title: 'Preset de tubo endotraqueal (K₂)',
    text: [
      'K₂ inspiratorio del TET adulto por diámetro interno, medido con el método de oclusión (Anaesth Intensive Care 2011;39:410): de 2,4 cmH₂O/(L/s)² en 9,0 mm a 12,8 en 6,5 mm — a menor diámetro la componente turbulenta crece deprisa.',
      'El término lineal K₁ del tubo se considera incluido en la resistencia del paciente (P). Al elegir un preset se rellena el deslizador K₂; ajustarlo a mano deja el preset en «Personalizado».',
    ],
    equation: 'R(Q) = K₁ + K₂·|Q|',
  },
  'patient.expValve': {
    title: 'Resistencia de la rama espiratoria',
    text: [
      'Resistencia del circuito y la válvula espiratoria, en serie con la vía aérea. Mientras sale gas, la presión medida en la pieza en Y queda algo por encima de la PEEP, proporcional al flujo.',
      'Las normas del sistema respiratorio limitan esta resistencia a unos 6 cmH₂O al flujo de referencia; 0 representa una válvula ideal.',
    ],
  },
  'patient.expResistance': {
    title: 'Resistencia espiratoria',
    text: [
      'Oposición a la salida de gas durante la espiración. Una resistencia mayor enlentece el vaciamiento.',
      'Si el siguiente ciclo empieza antes de vaciarse suficientemente, queda gas atrapado y aumenta la PEEP intrínseca.',
    ],
    equation: 'Constante de tiempo espiratoria: τ = Rexp × CEST',
  },
  'patient.effortExp': {
    title: 'Esfuerzo espiratorio',
    text: [
      'Contracción espiratoria activa: Pmus negativa en medio seno que empieza al final de la inspiración neural.',
      'Aumenta el flujo espiratorio y puede vaciar el pulmón por debajo de la FRC. Si hay limitación al flujo espiratorio (colapso), el esfuerzo no aumenta el flujo a igual volumen (mecanismo de Starling).',
    ],
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
  'patient.circuitCompliance': {
    title: 'Compliance del circuito',
    text: [
      'Volumen de gas que la tubuladura comprime a cada presión (mL por cmH₂O). En el equipo real parte del gas entregado se queda comprimido en el circuito y nunca llega al pulmón.',
      'El flujo mostrado es el del sensor del ventilador, así que el VTi se mantiene, pero la meseta baja: la Cstat medida por bloqueo sale como C + compliance del circuito. En espiración el gas comprimido vuelve por la válvula.',
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
  'metric.tauExp': {
    title: 'Constante de tiempo espiratoria · τ',
    text: [
      'En un vaciamiento pasivo el flujo que sale es proporcional al volumen que aún queda por salir, de modo que la rama espiratoria del bucle flujo-volumen es una recta. Su pendiente da τ sin ninguna maniobra: no hace falta ocluir nada.',
      'En una constante de tiempo sale alrededor del 63 % del volumen; en tres, el 95 %. De ahí la regla de cabecera: si el tiempo espiratorio no llega a tres τ, el pulmón empieza la siguiente respiración sin haber terminado de vaciar, y aparece atrapamiento aéreo.',
      'Se mide sobre el tramo central del vaciado, y sólo se publica si la recta ajusta. Cuando no ajusta —dos unidades con constantes distintas, una vía aérea que se estrangula al bajar la presión, o el paciente soplando— el simulador dice por qué en vez de dar un número: que el pulmón no se vacíe como un solo compartimento es un hallazgo, no un fallo de la medición.',
      'Ojo con confundirla con la resistencia que mide el bloqueo inspiratorio: ésa es la inspiratoria, y en un obstructivo la espiratoria es bastante mayor.',
    ],
    equation: 'Q = −(V − V∞) / τ · · · τ ≈ Rexp × C',
  },
  'metric.mechPower': {
    title: 'Potencia mecánica',
    text: [
      'Energía que el ventilador entrega al sistema respiratorio por minuto: en cada inspiración, la presión de vía aérea por el volumen que entra (el área bajo la curva presión-volumen), multiplicada por la frecuencia. El simulador integra esa área en cada respiración; no usa una fórmula aproximada.',
      'Reúne en un solo número lo que la lesión por ventilador tiene de presión, de volumen y de frecuencia: bajar el VT la reduce, pero subir la frecuencia para recuperar el volumen minuto la devuelve. En un pulmón lineal pasivo con flujo constante coincide con la fórmula de Gattinoni: 0,098 · FR · VT · [Ppico − ½ (Pplat − PEEP)].',
      'La PEEP forma parte de la energía entregada (se empuja el gas contra ella); en soporte de presión sólo se cuenta lo que pone el ventilador, no el trabajo del paciente.',
    ],
    equation: 'PM = FR · ∫ Pva · dV · 0,098 J/(cmH₂O·L)',
  },
  'metric.stressIndex': {
    title: 'Índice de estrés',
    text: [
      'Forma de la curva de presión durante una inspiración a flujo constante. Con flujo constante el volumen entra a ritmo fijo, así que la forma de la presión frente al tiempo es la forma de la presión elástica frente al volumen dentro del volumen corriente.',
      'Cerca de 1 la subida es una recta: la distensibilidad no cambia mientras entra el volumen. Por debajo de 1 la curva se dobla hacia abajo —el pulmón admite mejor el volumen a medida que se insufla—. Por encima de 1 se dobla hacia arriba: cuesta cada vez más, que es el aspecto de la sobredistensión.',
      'Sólo significa algo si la rampa es del pulmón y de nadie más: si el paciente hace fuerza, si un techo de presión recorta la señal o si el modo no entrega flujo constante, no se publica y se dice el motivo.',
    ],
    equation: 'Paw(t) = a · t^b + c · · · el índice es b',
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
      'Volumen, frecuencia y Ppico baja se evalúan al terminar cada respiración: a frecuencia baja, entre el cambio y la alarma puede pasar un ciclo entero. Un límite recién confirmado no espera: se compara enseguida con la última respiración medida. Pmáx actúa dentro del propio ciclo, sobre la presión antes de redondear.',
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
