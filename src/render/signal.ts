/** La señal que se dibuja: puntos [t s, Paw cmH2O, flujo L/min, volumen mL, Pmus cmH2O, ciclo], su búfer y su selección. */

export type Point = [number, number, number, number, number, number];

export interface TrendRow {
  t: number;
  ppeak: number | null;
  peep: number | null;
  vte: number | null;
  rr: number | null;
}

/** Tope de la traza en memoria: 120 s a la resolución del motor (un paso cada 4 ms). */
export const TRACE_CAP = 30_000;

/** Búferes de muestras tal como los publica el motor en cada cuadro: tiempo en ms, flujo en L/s y volumen en L. */
export interface SampleBuffers {
  t: ArrayLike<number>;
  paw: ArrayLike<number>;
  flow: ArrayLike<number>;
  vol: ArrayLike<number>;
  pmus: ArrayLike<number>;
  breath: ArrayLike<number>;
}

/**
 * Añade a la traza TODAS las muestras nuevas del cuadro, en unidades de pantalla, y recorta al tope.
 *
 * Se guardaba una de cada cinco, y un evento de un solo paso desaparecía de la curva: cuando Pmáx corta la inspiración
 * la presión toca el umbral durante 4 ms, y en SC-09 la alarma y la Ppico decían 40 mientras la curva seguía plana en
 * 5. Una curva que contradice al número y a la alarma enseña que la alarma miente. Ni siquiera era reproducible: el
 * salto de cinco reempezaba en cada cuadro, así que el pico salía o no según cuántos pasos trajera. Con 12 s de ventana
 * caen unas tres muestras por píxel de dispositivo: dibujarlas todas es barato.
 */
export function appendSamples(points: Point[], s: SampleBuffers, cap = TRACE_CAP): void {
  let lastT = points.length ? (points[points.length - 1] as Point)[0] : Number.NEGATIVE_INFINITY;
  for (let i = 0; i < s.t.length; i++) {
    const tMuestra = (s.t[i] as number) / 1000;
    // Sólo se descarta lo que es de verdad anterior. Una transición al principio de un paso (Pmáx cortando la
    // inspiración en su primer instante) llega como muestra de sub-paso con el mismo instante que la muestra previa, y
    // el reloj del controlador —segundos acumulados— puede quedar unos picosegundos por debajo del de la simulación.
    // Esa muestra es el pico: con un filtro estricto se perdía justo ella, en unas respiraciones sí y en otras no.
    if (tMuestra < lastT - 1e-9) continue;
    const t = Math.max(tMuestra, lastT);
    points.push([
      t,
      s.paw[i] as number,
      (s.flow[i] as number) * 60,
      (s.vol[i] as number) * 1000,
      s.pmus[i] as number,
      s.breath[i] as number,
    ]);
    lastT = t;
  }
  if (points.length > cap) points.splice(0, points.length - cap);
}

/** Lo que cae dentro de la ventana que se dibuja: la misma selección sirve para la escala y para la traza. */
export function visiblePoints(all: Point[], end: number, win: number): Point[] {
  return all.filter((p) => p[0] >= end - win - 0.05 && p[0] <= end + 0.001);
}

/**
 * Barrido limpio tras un cambio de modo: instante (s) antes del cual no se dibuja nada, o null si no hay que ocultar.
 *
 * En barrido, a la derecha del cursor sigue la pasada anterior, y tras confirmar un modo la pantalla mezclaba la forma
 * del modo viejo con la del nuevo sin decir dónde empezaba cada una. La pasada en curso se conserva entera —a la
 * izquierda del cambio se ve cómo terminaba el modo anterior, con la marca del cambio—; la anterior sólo conserva lo
 * posterior al cambio (`sinceS`). Pasada una ventana entera desde el cambio no oculta nada: todo lo visible es del
 * modo nuevo. Traza, marcas de fase y disparos usan el mismo corte, para que ninguna marca quede flotando sin curva.
 */
export function sweepCut(end: number, win: number, sinceS: number | null): number | null {
  if (sinceS === null || end - sinceS >= win) return null;
  return Math.min(sinceS, Math.floor(end / win) * win);
}

/** Muestra más cercana a `t` en una traza ordenada por tiempo; ante un empate, la anterior. Búsqueda binaria. */
export function nearestSample(points: Point[], t: number): Point | null {
  if (!points.length) return null;
  let lo = 0,
    hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((points[mid] as Point)[0] < t) lo = mid + 1;
    else hi = mid;
  }
  const a = points[lo] as Point,
    b = lo > 0 ? (points[lo - 1] as Point) : null;
  return b && Math.abs(b[0] - t) <= Math.abs(a[0] - t) ? b : a;
}

/** Puntos del último ciclo completo ('last') o del ciclo en curso ('current'). */
export function cyclePoints(points: Point[], which: 'last' | 'current' = 'last'): Point[] {
  // La traza guarda cada muestra del motor (hasta 30 000): los dos últimos ciclos se buscan desde el final, en vez de
  // reunir en cada dibujo del bucle todos los identificadores de la historia.
  const ids: number[] = [];
  for (let i = points.length - 1; i >= 0 && ids.length < 2; i--) {
    const id = (points[i] as Point)[5];
    if (id > 0 && id !== ids[ids.length - 1]) ids.push(id);
  }
  const id = which === 'current' ? ids[0] : ids[1];
  return id === undefined ? [] : points.filter((p) => p[5] === id);
}
