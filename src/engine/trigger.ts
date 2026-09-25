/** Periodo refractario tras el inicio de la espiración antes de admitir disparo (P; inspirado en Texp mínimo 0.25 s, D). */
export const TRIGGER_REFRACTORY_S = 0.25;
/**
 * Retardo de respuesta del disparo (s), P (U-53): del cruce del umbral a la apertura de la válvula inspiratoria. Un
 * equipo real tarda unas decenas de milisegundos en detectar, decidir y actuar; en ese lapso el paciente sigue tirando
 * del gas de la válvula espiratoria y la Pva cae por debajo de la PEEP en cuanto la demanda supera el flujo de base.
 * Esa caída es el trabajo de disparo que se enseña en la curva de presión; con respuesta instantánea no existía
 * (20 ms y 0,026 cmH2O). 80 ms está dentro del rango de banco de los ventiladores de cuidados intensivos (60–150 ms).
 */
export const TRIGGER_DELAY_S = 0.08;
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
