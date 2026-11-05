/**
 * Lectura en vivo de las curvas: nombra lo que acaba de pasar en la respiración que terminó —doble disparo, esfuerzo
 * inefectivo, autodisparo, corte por Pmáx, ciclado por Ti máximo— y dice por qué, en una frase. Es una ayuda docente,
 * no una función del equipo: se calcula aquí, sobre lo que el motor ya publica (la traza con la Pmus del modelo, las
 * respiraciones terminadas y las detecciones de disparo), sin tocar la física. En examen y sin ayudas no se muestra.
 */
import { formatTexto as f } from '../domain/units';
import type { Point, WaveBreath } from '../render/plots';

export type LecturaKind = 'doble' | 'inefectivo' | 'autodisparo' | 'pmax' | 'tiMax';

export interface Lectura {
  kind: LecturaKind;
  /** Instante al que apunta la marca sobre la curva (s de simulación). */
  t: number;
  breathId: string;
  /** Rótulo corto sobre la curva. */
  titulo: string;
  /** Una frase: qué pasó y por qué, con los números de esta respiración. */
  porque: string;
}

/** Lo que la explicación necesita saber del equipo y del modelo en ese momento. */
export interface ContextoLectura {
  /** Umbral de disparo por flujo (L/min), o null si el disparo es por presión. */
  flowTriggerLpm: number | null;
  pmax: number;
  /** % del flujo pico al que cicla el soporte (sólo CPAP/PS). */
  expTriggerPct: number;
  /** Auto-PEEP verdadera del modelo al final de la espiración (cmH₂O). */
  peepi: number;
}

/** Un pulso de Pmus por encima de esto cuenta como esfuerzo (el perfil «Esfuerzo débil» mueve 3 cmH₂O; SC-05, 0,6). */
export const ESFUERZO_MIN_CMH2O = 0.5;
/** Un esfuerzo es efectivo si el equipo detecta un disparo dentro de este plazo desde que empieza. */
export const PLAZO_DISPARO_S = 1.0;
/** Espiración más corta que esto entre dos respiraciones disparadas: la segunda llegó antes de espirar la primera. */
export const TEXP_APILADA_S = 0.8;
/** Sin Pmus por encima de esto alrededor del disparo, nadie lo pidió: fuga u oscilación cardíaca. */
export const SIN_ESFUERZO_CMH2O = 0.2;
/** Flujo espiratorio que aún sale cuando empieza la inspiración siguiente (L/min): aire atrapado. */
export const FLUJO_FIN_ESP_LPM = 3;

const disparada = (b: WaveBreath): boolean => b.type === 'assisted' || b.type === 'spontaneous';
const tExpS = (b: WaveBreath): number => (b.endSimTimeMs - b.startSimTimeMs) / 1000 - b.tInspS;

/** Índice de la primera muestra con t ≥ `t` (búsqueda binaria sobre la traza ordenada). */
function desde(puntos: Point[], t: number): number {
  let lo = 0,
    hi = puntos.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((puntos[mid] as Point)[0] < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Pmus máxima de la traza en [t0, t1]. */
function pmusMax(puntos: Point[], t0: number, t1: number): number {
  let m = 0;
  for (let i = desde(puntos, t0); i < puntos.length && (puntos[i] as Point)[0] <= t1; i++) m = Math.max(m, (puntos[i] as Point)[4]);
  return m;
}

/**
 * Pulsos de esfuerzo en [t0, t1]: tramos con Pmus ≥ umbral, con su inicio y su pico. El que ya estaba en marcha al
 * abrirse la ventana es la cola del esfuerzo que trajo la inspiración (Ti neural más largo que el mecánico): no es un
 * esfuerzo nuevo y no se cuenta.
 */
function pulsos(puntos: Point[], t0: number, t1: number): { inicio: number; tPico: number; pico: number }[] {
  const out: { inicio: number; tPico: number; pico: number }[] = [];
  let actual: { inicio: number; tPico: number; pico: number } | null = null;
  let cola = true;
  for (let i = desde(puntos, t0); i < puntos.length && (puntos[i] as Point)[0] <= t1; i++) {
    const [t, , , , pmus] = puntos[i] as Point;
    if (pmus >= ESFUERZO_MIN_CMH2O) {
      if (cola) continue;
      if (!actual) actual = { inicio: t, tPico: t, pico: pmus };
      else if (pmus > actual.pico) {
        actual.pico = pmus;
        actual.tPico = t;
      }
    } else {
      cola = false;
      if (actual) {
        out.push(actual);
        actual = null;
      }
    }
  }
  if (actual) out.push(actual);
  return out;
}

/**
 * Lecturas de la respiración `b` recién terminada, mirando también la espiración de la anterior (`previa`), donde
 * viven los esfuerzos que no dispararon. `disparosS`: instantes en que el sensor detectó un disparo.
 */
export function lecturasDeRespiracion(
  b: WaveBreath,
  previa: WaveBreath | null,
  puntos: Point[],
  disparosS: readonly number[],
  c: ContextoLectura,
): Lectura[] {
  const out: Lectura[] = [];
  const inicio = b.startSimTimeMs / 1000;
  const ciclado = inicio + b.tInspS;
  const umbral = c.flowTriggerLpm === null ? 'el umbral de presión' : `${f(c.flowTriggerLpm, 0)} L/min`;

  if (previa) {
    // Esfuerzos durante la espiración anterior que no disparan: ni hay detección en su plazo ni son los que trajeron `b`.
    const desdeS = previa.startSimTimeMs / 1000 + previa.tInspS + 0.1;
    const hastaS = inicio - 0.05;
    for (const p of pulsos(puntos, desdeS, hastaS)) {
      const detectado = disparosS.some((d) => d >= p.inicio && d <= p.inicio + PLAZO_DISPARO_S);
      const trajoEsta = disparada(b) && inicio - p.inicio <= PLAZO_DISPARO_S;
      if (detectado || trajoEsta) continue;
      const causa =
        c.peepi >= 1 ? `con auto-PEEP ${f(c.peepi, 1)} cmH₂O debe vencerla antes de mover flujo` : 'esfuerzo débil para ese umbral';
      out.push({
        kind: 'inefectivo',
        t: p.tPico,
        breathId: b.breathId,
        titulo: 'Esfuerzo inefectivo',
        porque: `Pmus ${f(p.pico, 1)} cmH₂O no llegó al disparo de ${umbral}: ${causa}.`,
      });
    }
  }

  if (disparada(b)) {
    const conEsfuerzo = pmusMax(puntos, inicio - 0.5, inicio + 0.15) >= SIN_ESFUERZO_CMH2O;
    if (!conEsfuerzo)
      out.push({
        kind: 'autodisparo',
        t: inicio,
        breathId: b.breathId,
        titulo: 'Autodisparo',
        porque: `Disparo sin esfuerzo del paciente: una fuga o el latido cruzaron el umbral de ${umbral}.`,
      });
    else if (previa && tExpS(previa) < TEXP_APILADA_S)
      out.push({
        kind: 'doble',
        t: inicio,
        breathId: b.breathId,
        titulo: 'Doble disparo',
        porque: `El paciente seguía inspirando cuando el equipo cicló: disparó otra respiración ${f(tExpS(previa), 2)} s después y apiló dos volúmenes.`,
      });
  }

  if (b.cyclingCause === 'pmax')
    out.push({
      kind: 'pmax',
      t: ciclado,
      breathId: b.breathId,
      titulo: 'Corte por Pmáx',
      porque: `La presión tocó Pmáx ${f(c.pmax, 0)} cmH₂O: el equipo cortó la inspiración y el volumen quedó incompleto.`,
    });
  else if (b.cyclingCause === 'tiMax')
    out.push({
      kind: 'tiMax',
      t: ciclado,
      breathId: b.breathId,
      titulo: 'Ciclado por Ti máx',
      porque: `El flujo no cayó al ${f(c.expTriggerPct * 100, 0)} % del pico: el soporte terminó por el tiempo inspiratorio máximo (fuga o espiración lenta).`,
    });

  return out;
}

/** Flujo espiratorio (L/min, negativo) en la última muestra de `b`: lo que aún salía cuando empezó la inspiración siguiente. */
export function flujoAlFinalDeLaEspiracion(b: WaveBreath, puntos: Point[]): number | null {
  const i = desde(puntos, b.endSimTimeMs / 1000 - 1e-6) - 1;
  if (i < 0) return null;
  const p = puntos[i] as Point;
  return p[0] >= b.startSimTimeMs / 1000 + b.tInspS ? p[2] : null;
}

/** Estado de atrapamiento que se lee en la curva de flujo: no vuelve a cero antes de la inspiración siguiente. */
export function lecturaAutoPeep(flujoFinalLpm: number | null): string | null {
  if (flujoFinalLpm === null || flujoFinalLpm > -FLUJO_FIN_ESP_LPM) return null;
  return `El flujo espiratorio no vuelve a 0 (${f(flujoFinalLpm, 0)} L/min al empezar la inspiración): queda aire atrapado. Mide la PEEP total con un bloqueo espiratorio.`;
}
