/**
 * Constantes del equipo y del modelo que usa el controlador de respiración, cada una con su origen (D del manual o de
 * la ficha, P del simulador). Se reexportan desde controller.ts.
 */

/**
 * Tiempo inspiratorio máximo de una respiración soportada (s): «Tsupp or 4 seconds for adults» (D, URM SW10 5-4; valor
 * de fábrica de Tsupp, 11-9). El ciclado por flujo puede no llegar —esfuerzo sostenido, fuga, flujo que se aplana por
 * encima del umbral— y el soporte no puede durar indefinidamente. Antes era 3 s (P).
 */
export const SUPPORT_TI_MAX_S = 4;
/**
 * La inspiración soportada termina también si la presión supera PEEP + PS + 2,5 cmH2O (D, URM SW10 5-4): un paciente
 * que empieza a espirar contra el soporte (la válvula espiratoria está cerrada y la inspiratoria no admite flujo de
 * vuelta) hace subir la Pva, y el equipo corta la inspiración.
 */
export const PS_PRESSURE_CYCLE_CMH2O = 2.5;
/**
 * Pausa mínima entre respiraciones antes de entregar una manual (s): «The ventilator requires a 0.25 second pause between
 * delivery of breaths» (D, URM SW10 7-9). La orden se acepta en cualquier fase y se sirve pasada esa pausa espiratoria.
 */
export const MANUAL_BREATH_PAUSE_S = 0.25;
/** Julios por cmH2O·litro: la energía de la ventilación se mide en presión × volumen (1 cmH2O = 98,07 Pa; 1 L = 1e-3 m³). */
export const JOULES_PER_CMH2O_L = 0.09807;
/** Frecuencia de las respiraciones de respaldo mientras dura la apnea sin frecuencia mínima programada (/min), P (U-52). */
export const APNEA_BACKUP_RATE_PER_MIN = 12;
/**
 * Retardos del respaldo (D, URM SW10 8-26 y 8-27, «Alarm delays»): «Backup ventilation on» no se activa en los 10 s
 * siguientes a que terminó el último respaldo, ni tras confirmar un modo en los 10 s (por apnea) o 60 s (por VMesp). Los
 * de 60 s tras un bloqueo y al empezar a ventilar, por VMesp, son los de la alarma de VMesp bajo (alarms.ts).
 */
export const BACKUP_DELAY_AFTER_BACKUP_S = 10;
export const BACKUP_DELAY_AFTER_MODE_S = { apnea: 10, vmesp: 60 } as const;
/** Duración mínima de pausa para estimar Pplat de ciclo (P). */
export const MIN_PAUSE_FOR_PPLAT_S = 0.1;
/** Tope de flujo del actuador virtual en PC (L/s): 160 L/min, D ficha 2014 (flujo inspiratorio adulto 2–160 L/min). */
export const ACTUATOR_MAX_FLOW_LPS = 160 / 60;
/**
 * Ganancia del lazo de presión de PC y del soporte (L/s² por cmH2O): el flujo de la válvula inspiratoria crece a
 * razón de G·(objetivo − Pva) mientras no alcanza la demanda, en vez de saltar al instante. Así la presión tarda en
 * volver sobre la PEEP tras el disparo más cuanto más tira el paciente y menos cuanto mayor es el soporte, como en
 * Thille (Intensive Care Med 2009, banco de 13 equipos): el retardo inspiratorio crece con el esfuerzo y cae con el
 * soporte, y con el Engström quedó bajo 70 ms en promedio y bajo 100 ms en el peor caso (soporte 5, esfuerzo muy
 * fuerte). El valor es P calibrado sobre esos D con el mismo banco (prueba SYN-05): media 66 ms, peor caso 84 ms.
 */
export const PRESSURE_LOOP_GAIN = 4;
/**
 * Tope de flujo espiratorio (L/s): la conductancia máxima de la válvula y de la rama espiratoria con la válvula
 * abierta del todo. No existía, y sin él la espiración no tenía ningún límite de máquina: con resistencia muy baja y
 * un gradiente alto el modelo llegaba a −2949 L/min, que ninguna tubuladura deja pasar. El valor es P: la ficha
 * documenta el rango inspiratorio (2–160 L/min) y no el espiratorio, así que se toma un techo por encima de todo lo
 * fisiológico (el escenario más obstructivo del simulador llega a −149 L/min) para que sólo actúe en lo irreal (U-50).
 */
export const EXP_MAX_FLOW_LPS = -200 / 60;
/** Flujo de base espiratorio por omisión (D: rango 2–10 L/min, ficha 2014 y URM SW10 13-12; valor inicial 3 L/min, el de fábrica, 11-9). Ajustable en `settings.biasFlow`. */
export const EXP_BIAS_FLOW_LPS = 2 / 60;
/**
 * Apertura de la válvula espiratoria por omisión (ms). Pinède (Respir Care 2021, banco de 7 ventiladores de UCI) midió
 * 0,110 s (0,105–0,110) con el Carescape de GE, y de 0,072 a 0,145 s entre los siete equipos. Antes era 40 ms (P).
 */
export const DEFAULT_EXP_VALVE_OPEN_MS = 110;
/**
 * Resistencia de la rama y la válvula espiratorias por omisión (cmH2O·s/L), en serie con la vía aérea. En el mismo
 * banco el Carescape dejó, con PEEP 5 y VT 0,8 L, un producto presión-tiempo sobre la PEEP de 2,4 cmH2O·s durante la
 * espiración; en una resistencia lineal ese producto es R·VT, así que R ≈ 2,4 / 0,8 = 3 (derivación P sobre un dato D),
 * la mitad del techo de 6 cmH2O que cita el manual. Antes era 0: la Pva espiratoria era exactamente la PEEP (U-42).
 */
export const DEFAULT_EXP_BRANCH_R_CMH2O_S_L = 3;

/** Resistencia equivalente de la válvula cerrada (cmH2O·s/L): el flujo arranca casi en cero al abrirse. */
export const VALVE_CLOSED_R = 200;
/** La PEEPe se lee este tiempo antes del disparo detectado (s), P: la muestra aún no lleva la caída del esfuerzo. */
export const PEEPE_PRE_TRIGGER_S = 0.15;
/** Ventana de Paw espiratoria conservada para buscar la PEEPe pre-disparo (s). */
export const PEEPE_TRACE_S = 0.6;
/**
 * Constante de tiempo de la rampa de primer orden como fracción de riseMs: la rampa es «the time in milliseconds for
 * pressure to reach 90% of the set inspiratory pressure» (D, URM SW10 5-3), así que τ = riseMs / ln 10. La forma
 * exponencial es P. Antes se tomaba el 95 % (3τ).
 */
export const RISE_TIME_TAU_FRACTION = Math.LN10;
