/** Periodo refractario tras el inicio de la espiración antes de admitir disparo (P; inspirado en Texp mínimo 0.25 s, D). */
export const TRIGGER_REFRACTORY_S = 0.25;
/**
 * Retardo de respuesta del disparo por FLUJO (s), P (U-53): del cruce del umbral a la apertura de la válvula
 * inspiratoria. 80 ms está dentro del rango de banco de los ventiladores de cuidados intensivos (60–100 ms por flujo).
 */
export const TRIGGER_DELAY_FLOW_S = 0.08;
/**
 * Retardo de respuesta del disparo por PRESIÓN (s), P (U-53): la caída de Pva debe propagarse por el circuito y medirse
 * en la rama antes de decidir, así que es más lento que el de flujo (bancos ICU: ≈ 100–150 ms por presión frente a
 * 60–100 ms por flujo). En ese lapso mayor el paciente tira más tiempo del flujo de base y la caída crece: el trabajo
 * de disparo por presión es mayor, como en el equipo real.
 */
export const TRIGGER_DELAY_PRESSURE_S = 0.11;
/** Retardo de respuesta según el tipo de disparo programado. */
export function triggerDelayS(byPressure: boolean): number {
  return byPressure ? TRIGGER_DELAY_PRESSURE_S : TRIGGER_DELAY_FLOW_S;
}
/**
 * Caída de la Pva espiratoria por cada L/s de demanda del paciente que el regulador de PEEP aún no ha compensado
 * (cmH2O·s/L), P (U-43). El regulador real tiene ancho de banda finito: ante una demanda REPENTINA la Pva hunde
 * transitoriamente hasta que su acción integral repone el flujo. 3 cmH2O·s/L da 1–2 cmH2O de trabajo con demandas de
 * 0,3–0,6 L/s, el orden que publican los bancos de disparo.
 */
export const PEEP_REGULATOR_DROOP_CMH2O_S_L = 3;
/**
 * Constante de tiempo con que el regulador recupera la demanda (s), P (U-43): τ del filtro que representa su acción
 * integral. En régimen (demanda sostenida) la caída desaparece y la Pva vuelve a PEEP; sólo el transitorio queda.
 */
export const PEEP_REGULATOR_TAU_S = 0.1;
/** @deprecated Alias del retardo por flujo, para compatibilidad de imports. */
export const TRIGGER_DELAY_S = TRIGGER_DELAY_FLOW_S;
/**
 * Caída de la Pva espiratoria bajo la PEEP programada a partir de la cual el disparo no se evalúa (cmH2O), P. Con el
 * circuito abierto o una fuga que el flujo de base no cubre, el sensor de flujo ve salir gas de forma continua y
 * dispararía sin parar; un equipo real declara la desconexión y deja de buscar esfuerzos.
 */
export const TRIGGER_MIN_PEEP_DROP_CMH2O = 3;

/**
 * Cuál de los dos techos de presión actúa dentro de un tramo, y en qué fracción de él.
 *
 * Durante la inspiración a flujo constante la presión sube de forma monótona, así que **gana el umbral que se cruza
 * antes, que es el más bajo**. Vive aparte del `switch` porque es aritmética pura y porque es la jerarquía de
 * seguridad del ventilador: aquí estuvo el peor defecto que ha tenido este proyecto. Se miraba Pmáx primero, sin
 * compararlo con Plimit, y contra la presión que produciría el flujo ORDENADO en vez de la que la máquina dejaría
 * alcanzar; con Plimit 30 y Pmáx 40, subir la resistencia de 69 a 70 cmH2O·s/L pasaba de entregar 314 mL a entregar
 * CERO, porque saltaba Pmáx contra una presión que Plimit habría recortado a 30. Plimit existe para proteger sin
 * dejar de ventilar.
 *
 * Con los dos umbrales iguales gana Pmáx, que es la acción de seguridad: terminar la inspiración.
 *
 * @param paw0 presión de vía aérea al empezar el tramo, con el flujo ordenado
 * @param paw1 la misma al terminarlo
 * @returns `frac` en 0..1 del tramo que se puede integrar antes de que actúe el techo, y cuál actúa (`null` si ninguno)
 */
export function thresholdCrossing(
  paw0: number,
  paw1: number,
  plimit: number,
  pmax: number,
): { frac: number; hit: 'plimit' | 'pmax' | null } {
  const primero = plimit < pmax ? 'plimit' : 'pmax';
  if (paw0 >= Math.min(pmax, plimit)) return { frac: 0, hit: primero };
  let frac = 1;
  let hit: 'plimit' | 'pmax' | null = null;
  const cruce = (umbral: number): number => (paw1 - paw0 > 0 ? (umbral - paw0) / (paw1 - paw0) : 1);
  if (paw1 >= pmax) {
    frac = cruce(pmax);
    hit = 'pmax';
  }
  if (paw1 >= plimit) {
    const f = cruce(plimit);
    if (f < frac) {
      frac = f;
      hit = 'plimit';
    }
  }
  return { frac, hit };
}
