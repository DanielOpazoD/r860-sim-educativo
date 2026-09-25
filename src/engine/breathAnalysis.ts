/**
 * Deriva máxima admisible de la meseta, como TASA (cmH2O/s) medida sobre un tramo final de duración fija (P).
 *
 * Fue un valor absoluto sobre un tramo que crecía con la oclusión, y por eso el criterio no era monótono: con dos
 * unidades de constantes muy dispares, un bloqueo de 2 s pasaba como válido —con la Cstat un 40 % baja, porque el
 * pendelluft aún no había terminado— mientras que uno de 5 s se rechazaba por inestable y uno de 15 s volvía a pasar.
 * La medición peor era la que superaba el filtro. Una tasa sobre un tramo fijo responde a la pregunta correcta:
 * ¿se ha asentado ya la presión?, y su respuesta no depende de cuánto se haya esperado.
 *
 * El valor está calibrado sobre tres mecánicas, con la tasa medida al final de la oclusión (cmH2O/s):
 *
 *     oclusión        2 s     3 s     5 s    10 s    15 s
 *     dos unidades   0,845   0,717   0,516   0,227   0,099   (tau del pendelluft 6,1 s)
 *     viscoelástico  0,707   0,363   0,096   0,003   0,000   (E2 10, tau 1,5 s)
 *     un compartim.  0,000   0,000   0,000   0,000   0,000
 *
 * 0,45 separa el pulmón que ya se asentó del que sigue relajándose visiblemente: deja pasar el bloqueo de 3 s sobre
 * un pulmón viscoelástico —donde la meseta por encima de la estática es el fenómeno que se quiere enseñar— y rechaza
 * los de 2, 3 y 5 s con dos unidades muy dispares, que antes pasaban con la Cstat hasta un 40 % baja. Es una constante
 * P: lo principiado es la forma del criterio (tasa, ventana fija, monótona); el valor está calibrado, no deducido.
 */
export const PLATEAU_DRIFT_RATE_CMH2O_S = 0.45;
/**
 * Deriva máxima admitida en el bloqueo ESPIRATORIO (cmH2O/s), P. Más estrecha que la inspiratoria porque el producto
 * de la maniobra no es la presión leída sino una resta de dos presiones casi iguales: la PEEP intrínseca. Un error de
 * 0,3 cmH2O sobre una meseta de 25 es despreciable; sobre una PEEPi de 0,6 es la mitad del dato.
 *
 * Con la aproximación de primer orden `paw(t) = A − B·e^(−t/tau)`, la deriva medida sobre el tramo final de duración
 * T = PLATEAU_TAIL_S acota lo que aún falta por subir: `resto = deriva · T / (e^(T/tau) − 1)`. Medido sobre los dos
 * escenarios con redistribución lenta (resto en cmH2O frente a la asíntota a 40 s):
 *
 *     oclusión      2 s     3 s     4 s     6 s     8 s    12 s
 *     SC-17        0,111   0,080   0,057   0,029   0,015   0,004   (tau 2,7 s; resto 0,30 / 0,22 / 0,15 / 0,08 / 0,04)
 *     SC-14        0,240   0,123   0,063   0,017   0,004   0,000   (tau 1,3 s; resto 0,31 / 0,16 / 0,08 / 0,02 / 0,01)
 *     un compartim. 0,000   0,000   0,000   0,000   0,000   0,000
 *
 * 0,04 deja el resto por debajo de 0,1 cmH2O —la cifra que la pantalla muestra— en ese rango de tau: los pulmones que
 * vacían rápido siguen dando una PEEP total válida a los 2 s, y los que redistribuyen despacio exigen 6 s, que es lo
 * que de verdad tardan. Con 0,45 se certificaba a los 2 s una PEEPi de 0,33 cuando la real era 0,63.
 */
export const PLATEAU_DRIFT_RATE_EXP_CMH2O_S = 0.04;
/** Tramo final sobre el que se mide la deriva. Fijo a propósito: ver `PLATEAU_DRIFT_RATE_CMH2O_S`. */
export const PLATEAU_TAIL_S = 0.5;
/** Excursión contra la tendencia que delata una perturbación (esfuerzo, fuga, oscilación) en cmH2O. */
export const PLATEAU_REVERSAL_CMH2O = 0.3;
/**
 * Bondad mínima del ajuste de la rama espiratoria para dar por buena una constante de tiempo (P). Medido sobre los
 * escenarios, con la ventana del 5 % al 95 % de lo espirado: un compartimento lineal y el obstructivo de SC-03 dan
 * 1,0000; la espiración estrangulada de SC-16 da 0,9838 y el tejido viscoelástico de SC-14, 0,9840. 0,99 separa el
 * vaciamiento que sí es una exponencial de los dos que no lo son.
 */
export const TAU_EXP_MIN_R2 = 0.99;
/**
 * Tramo del vaciado sobre el que se ajusta la recta, en fracción de lo espirado. Ancho a propósito: la curvatura que
 * delata un vaciamiento que no es una sola exponencial vive en los extremos, y un tramo central estrecho la esconde
 * —con el 25-75 % la espiración estrangulada de SC-16 ajustaba a 0,9987 y pasaba por buena—. Se recortan las puntas
 * porque el principio lo ensucia la apertura de la válvula y el final, una señal que tiende a cero.
 */
export const TAU_EXP_FIT_FROM = 0.05;
export const TAU_EXP_FIT_TO = 0.95;

/**
 * Constante de tiempo espiratoria medida sobre la propia rama espiratoria (Brunner, «RCexp»), en segundos.
 *
 * En un vaciamiento pasivo de un compartimento, el flujo que sale es proporcional al volumen que todavía queda por
 * salir: Q = −(V − V∞)/tau. Es decir, la rama espiratoria del bucle flujo-volumen es una RECTA cuya pendiente es
 * −1/tau. No hace falta ninguna oclusión: el número está en la curva que ya se dibuja.
 *
 * Se ajusta sobre el grueso del vaciado, recortando las puntas: el principio lo ensucia la apertura de la válvula y
 * el final, una señal que tiende a cero.
 *
 * Devuelve también la bondad del ajuste. Es lo más docente del asunto: cuando el pulmón NO se vacía como una sola
 * exponencial —un tejido que sigue relajando, o una vía aérea que se estrangula al bajar la presión— la recta deja de
 * ajustar, y eso es un hallazgo, no un fallo de la medición.
 *
 * Lo que este número NO es: la constante del pulmón entero cuando hay dos unidades muy dispares. Si una vacía en dos
 * décimas y la otra en diez segundos, en el tiempo espiratorio disponible sale casi todo por la rápida y la recta
 * ajusta perfectamente: lo medido es la constante de LO QUE SE ESTÁ VACIANDO. Es la misma limitación que tiene la
 * medida de cabecera, y la unidad lenta se delata por otro camino —la meseta que sigue bajando al alargar la oclusión—.
 */
export function expiratoryTimeConstant(muestras: { vAbsL: number; qLps: number }[]): { tau: number; r2: number } | null {
  if (muestras.length < 12) return null;
  const vInicio = (muestras[0] as { vAbsL: number }).vAbsL;
  const vFinal = (muestras[muestras.length - 1] as { vAbsL: number }).vAbsL;
  const espirado = vInicio - vFinal;
  if (!(espirado > 0.02)) return null; // menos de 20 mL: no hay vaciamiento del que sacar una pendiente
  const tramo = muestras.filter((m) => {
    const f = (vInicio - m.vAbsL) / espirado;
    return f >= TAU_EXP_FIT_FROM && f <= TAU_EXP_FIT_TO && m.qLps < 0;
  });
  if (tramo.length < 6) return null;
  // Regresión de Q sobre el volumen que queda: Q = pendiente · restante, con pendiente = −1/tau.
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0,
    syy = 0;
  const n = tramo.length;
  for (const m of tramo) {
    const x = m.vAbsL - vFinal;
    const y = m.qLps;
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
  }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-12) return null;
  const pendiente = (n * sxy - sx * sy) / den;
  if (!(pendiente < -1e-9)) return null; // pendiente no negativa: no es un vaciamiento
  const varY = n * syy - sy * sy;
  const r2 = varY > 1e-12 ? Math.pow(n * sxy - sx * sy, 2) / (den * varY) : 0;
  const tau = -1 / pendiente;
  return Number.isFinite(tau) && tau > 0 ? { tau, r2 } : null;
}

/**
 * Índice de estrés: el exponente b del ajuste Paw(t) = a·t^b + c sobre la rampa de INSPIRACIÓN A FLUJO CONSTANTE
 * (Grasso, Ranieri). Con flujo constante el volumen crece con el tiempo, así que la forma de Paw frente a t es la
 * forma de la presión elástica frente al volumen dentro del volumen corriente:
 *
 *   b ≈ 1  recta: la distensibilidad no cambia mientras entra el volumen
 *   b < 1  cóncava hacia abajo: la distensibilidad MEJORA al insuflar (sigue reclutándose)
 *   b > 1  cóncava hacia arriba: la distensibilidad EMPEORA al insuflar (sobredistensión)
 *
 * El término constante c es la presión al abrirse el flujo, PEEP + R·Q: con flujo constante la caída resistiva no
 * cambia durante la rampa, así que restarla deja sólo el elástico. Con eso el ajuste es una regresión lineal sobre
 * log(Paw − c) frente a log(t), sin iteraciones ni valores iniciales que elegir.
 *
 * Devuelve null cuando la forma no significa lo que se cree: pocas muestras, presión recortada por un techo, o un
 * esfuerzo del paciente durante la rampa —entonces la curva es del paciente y del ventilador, no del pulmón—.
 */
export function stressIndex(muestras: { t: number; paw: number }[]): number | null {
  if (muestras.length < 12) return null;
  const t0 = muestras[0]!.t;
  const c = muestras[0]!.paw;
  const tFin = muestras[muestras.length - 1]!.t - t0;
  if (!(tFin > 0)) return null;
  // Se descarta el primer 10 % del tramo: ahí el logaritmo es singular y el escalón resistivo aún se está formando.
  let n = 0,
    sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (const m of muestras) {
    const t = m.t - t0;
    const y = m.paw - c;
    if (t < 0.1 * tFin || !(y > 1e-6)) continue;
    const lx = Math.log(t),
      ly = Math.log(y);
    n += 1;
    sx += lx;
    sy += ly;
    sxx += lx * lx;
    sxy += lx * ly;
  }
  if (n < 8) return null;
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-12) return null;
  const b = (n * sxy - sx * sy) / den;
  return Number.isFinite(b) ? b : null;
}

/**
 * Estabilidad de meseta (P): máx−mín de Paw en toda la ventana tras un arranque de min(0.5 s, 30 % de la ventana),
 * para que un esfuerzo o una fuga en cualquier punto del bloqueo invaliden el resultado (PRC-02).
 */
export function plateauQuality(samples: { t: number; paw: number }[], windowS: number): { driftRate: number; reversal: number } | null {
  if (samples.length < 2) return null;
  const tFrom = Math.min(0.5, windowS * 0.3);
  const win = samples.filter((s) => s.t >= tFrom - 1e-9);
  if (win.length < 2) return null;
  // Deriva: tasa sobre un tramo final de duración fija. Una relajación todavía cae al principio de la oclusión y eso
  // no la invalida; lo que importa es si la presión ya se asentó cuando se lee la meseta, y eso es una velocidad.
  const tEnd = (win[win.length - 1] as { t: number }).t;
  const tramo = Math.min(PLATEAU_TAIL_S, (tEnd - (win[0] as { t: number }).t) / 2);
  const tail = win.filter((s) => s.t >= tEnd - tramo - 1e-9);
  const usadas = tail.length >= 2 ? tail : win;
  const span = (usadas[usadas.length - 1] as { t: number }).t - (usadas[0] as { t: number }).t;
  let mn = Infinity,
    mx = -Infinity;
  for (const s of usadas) {
    mn = Math.min(mn, s.paw);
    mx = Math.max(mx, s.paw);
  }
  // Excursión contra la tendencia: una relajación (monótona hacia abajo) o un llenado de PEEP total (monótono hacia
  // arriba) dan 0; un esfuerzo, una fuga o una oscilación mueven la presión en ambos sentidos y dan un valor alto.
  let runMin = Infinity,
    runMax = -Infinity,
    maxRise = 0,
    maxFall = 0;
  for (const s of win) {
    runMin = Math.min(runMin, s.paw);
    runMax = Math.max(runMax, s.paw);
    maxRise = Math.max(maxRise, s.paw - runMin);
    maxFall = Math.max(maxFall, runMax - s.paw);
  }
  return { driftRate: span > 1e-9 ? (mx - mn) / span : 0, reversal: Math.min(maxRise, maxFall) };
}
