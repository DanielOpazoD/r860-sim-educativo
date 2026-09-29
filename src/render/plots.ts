import { formatNumber as format } from '../domain/units';
import { PLOT_TEXT_COLORS } from './plotColors';
/**
 * Renderizado exclusivamente visual (canvas). Nunca modifica el estado de la simulación.
 * Estilo de curvas, bucles, manómetro, tendencias y esfuerzo derivado de «R860 Lab» v1.1 (src/plots.js, MIT 2026),
 * portado a TypeScript sobre las muestras del motor de este proyecto.
 * Punto de señal: [t s, Paw cmH2O, flujo L/min, volumen mL, Pmus cmH2O, ciclo].
 */
export type Point = [number, number, number, number, number, number];
export interface TrendRow {
  t: number;
  ppeak: number | null;
  peep: number | null;
  vte: number | null;
  rr: number | null;
}

const setups = new WeakMap<HTMLCanvasElement, { w: number; h: number; dpr: number; ctx: CanvasRenderingContext2D }>();
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const nice = (value: number, steps: number[]): number =>
  steps.find((x) => x >= value) ?? Math.ceil(value / (steps[steps.length - 1] as number)) * (steps[steps.length - 1] as number);

function context(canvas: HTMLCanvasElement) {
  if (!setups.has(canvas)) {
    const w = Number(canvas.getAttribute('width')),
      h = Number(canvas.getAttribute('height')),
      dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    setups.set(canvas, { w, h, dpr, ctx: canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D });
  }
  const o = setups.get(canvas)!;
  o.ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  o.ctx.clearRect(0, 0, o.w, o.h);
  return o;
}
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = '#7fbde055', width = 0.6): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size = 11,
  color = '#98d8ff',
  align: CanvasTextAlign = 'left',
  weight = 'normal',
): void {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.font = `${weight} ${size}px Arial,sans-serif`;
  ctx.fillText(s, x, y);
}

export interface Bounds {
  pressure: number;
  flow: number;
  volume: number;
  minPressure: number;
  minVolume: number;
}
export interface WaveBreath {
  breathId: string;
  startSimTimeMs: number;
  endSimTimeMs: number;
  tInspS: number;
  ppeak: number;
  pplatCycle: number | null;
  tauExpS: number | null;
  cyclingCause: string;
}
export type WaveMarkerKind = 'start' | 'cycle' | 'ppeak' | 'pplat' | 'end' | 'effort';
export interface WaveMarker {
  kind: WaveMarkerKind;
  t: number;
  label: string;
  value?: number;
}
export interface WaveformFeatures {
  ppeak: number;
  minPressure: number;
  peakInspFlow: number;
  peakExpFlow: number;
  maxVolume: number;
  minVolume: number;
}

export function expandBounds(current: Bounds, measured: Bounds): Bounds {
  return {
    pressure: Math.max(current.pressure, measured.pressure),
    flow: Math.max(current.flow, measured.flow),
    volume: Math.max(current.volume, measured.volume),
    minPressure: Math.min(current.minPressure, measured.minPressure),
    minVolume: Math.min(current.minVolume, measured.minVolume),
  };
}

export function cursorMeasurements(a: Point, b: Point): { deltaP: number; deltaT: number; tauExp: number | null } {
  const deltaT = Math.abs(b[0] - a[0]);
  const q1 = Math.abs(a[2]);
  const q2 = Math.abs(b[2]);
  const bothExpiratory = a[2] < -1 && b[2] < -1;
  const tauExp = bothExpiratory && q1 > q2 && deltaT > 0 ? deltaT / Math.log(q1 / q2) : null;
  return { deltaP: Math.abs(b[1] - a[1]), deltaT, tauExp: tauExp !== null && Number.isFinite(tauExp) ? tauExp : null };
}

export function waveformFeatures(points: Point[]): WaveformFeatures {
  return {
    ppeak: points.length ? Math.max(...points.map((p) => p[1])) : 0,
    minPressure: points.length ? Math.min(...points.map((p) => p[1])) : 0,
    peakInspFlow: points.length ? Math.max(...points.map((p) => p[2])) : 0,
    peakExpFlow: points.length ? Math.min(...points.map((p) => p[2])) : 0,
    maxVolume: points.length ? Math.max(...points.map((p) => p[3])) : 0,
    minVolume: points.length ? Math.min(...points.map((p) => p[3])) : 0,
  };
}

export function waveMarkers(
  points: Point[],
  breath: WaveBreath | null,
  hold: { breathId: string | null; startedAtMs: number | null; completedAtMs: number | null; pplat: number } | null,
): WaveMarker[] {
  if (!breath) return [];
  const start = breath.startSimTimeMs / 1000;
  const cycle = start + breath.tInspS;
  const end = breath.endSimTimeMs / 1000;
  const breathPoints = points.filter((p) => p[0] >= start && p[0] <= end);
  const ppeakPoint = breathPoints.reduce<Point | null>((best, p) => (!best || p[1] > best[1] ? p : best), null);
  const effortPoint = points.find((p) => p[0] >= start - 1 && p[0] <= cycle && p[4] > 0.2) ?? null;
  const markers: WaveMarker[] = [
    { kind: 'start', t: start, label: 'Inicio' },
    { kind: 'cycle', t: cycle, label: 'Ciclado' },
    { kind: 'end', t: end, label: 'Fin esp.' },
  ];
  if (ppeakPoint) markers.push({ kind: 'ppeak', t: ppeakPoint[0], label: `Ppico ${format(breath.ppeak, 1)}`, value: breath.ppeak });
  if (effortPoint) markers.push({ kind: 'effort', t: effortPoint[0], label: 'Esfuerzo' });
  if (hold?.breathId === breath.breathId && hold.startedAtMs !== null)
    markers.push({ kind: 'pplat', t: hold.startedAtMs / 1000, label: `Pplat ${format(hold.pplat, 1)}`, value: hold.pplat });
  return markers;
}

const ESCALA_VOLUMEN = [300, 400, 600, 800, 1000, 1500, 2000, 2500, 4000];
export function getBounds(points: Point[], peep: number, vtMl: number): Bounds {
  let maxP = Math.max(peep + 10, 16),
    maxF = 40,
    maxV = vtMl || 450,
    minP = 0,
    minV = 0;
  for (const p of points) {
    maxP = Math.max(maxP, p[1]);
    minP = Math.min(minP, p[1]);
    maxF = Math.max(maxF, Math.abs(p[2]));
    maxV = Math.max(maxV, p[3]);
    minV = Math.min(minV, p[3]);
  }
  const volume = nice(maxV * 1.1, ESCALA_VOLUMEN);
  // El suelo del eje de volumen tiene que caber el mínimo REAL, no un porcentaje fijo de la escala superior. La traza
  // es el volumen desde el inicio de la respiración, así que baja de cero cuando el pulmón devuelve gas que no
  // recibió en ese ciclo: apilamiento, espiración activa o liberación de aire atrapado. Con el suelo fijo, la señal
  // que más enseña —la curva de volumen hundiéndose bajo la línea de base— se dibujaba como una barra plana
  // recortada: en el escenario de doble disparo la traza llega a −516 mL contra un suelo de −60.
  const holgura = -volume * 0.05;
  const pressure = nice(maxP * 1.12, [20, 25, 30, 35, 40, 45, 50, 60, 80, 100, 120]);
  return {
    pressure,
    flow: nice(maxF * 1.15, [40, 60, 80, 100, 120, 160, 180, 200, 240, 320]),
    volume,
    // Un pulmón pasivo nunca baja de 0 cmH₂O: el suelo fijo de −10 dejaba vacío un cuarto del panel. Sólo baja
    // cuando la señal lo hace (esfuerzo del paciente); en reposo queda un margen del 5 % para que la línea de base
    // no se pegue al marco.
    minPressure: minP >= -0.5 ? -pressure * 0.05 : Math.min(-5, Math.floor(minP / 5) * 5),
    minVolume: minV < holgura ? -nice(-minV * 1.12, ESCALA_VOLUMEN) : holgura,
  };
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

/** Estado de la escala de dibujo de un lienzo entre un cuadro y el siguiente. */
export interface ScaleState {
  bounds: Bounds;
  /** Desde qué instante (s de simulación) lo visible cabría en una escala menor; null mientras no quepa. */
  shrinkSinceS: number | null;
  /** Instante del cuadro anterior: para saber si el barrido acaba de volver al origen. */
  lastEndS: number;
}

/**
 * Escala de dibujo con histéresis (P: decisión de legibilidad; el rango sigue saliendo de los datos).
 *
 * `getBounds` recalcula la escala cada cuadro sobre lo visible, y el eje saltaba en mitad del barrido: al salir de la
 * ventana la última respiración alta, la traza ya dibujada cambiaba de tamaño bajo el ojo del alumno. En SC-18 el eje
 * de flujo pasaba de ±160 a ±60 en tres saltos en 300 ms, con el barrido al 15 %. La regla:
 *
 *   - crecer SIEMPRE en el acto: una señal recortada contra el techo se lee como una meseta que no existe;
 *   - encoger sólo cuando lo visible lleva una ventana entera cabiendo en una escala menor, y en barrido además al
 *     volver el cursor al origen, que es cuando la traza empieza a redibujarse desde la izquierda.
 */
export function stableBounds(prev: ScaleState | null, measured: Bounds, endS: number, win: number, style: 'sweep' | 'scroll'): ScaleState {
  // Sin historia, o con el tiempo hacia atrás (escenario nuevo, sesión importada): la escala de lo que se ve.
  if (!prev || endS < prev.lastEndS) return { bounds: measured, shrinkSinceS: null, lastEndS: endS };
  const p = prev.bounds;
  const grown: Bounds = {
    pressure: Math.max(p.pressure, measured.pressure),
    flow: Math.max(p.flow, measured.flow),
    volume: Math.max(p.volume, measured.volume),
    minPressure: Math.min(p.minPressure, measured.minPressure),
    minVolume: Math.min(p.minVolume, measured.minVolume),
  };
  const cabeEnMenos =
    measured.pressure < grown.pressure ||
    measured.flow < grown.flow ||
    measured.volume < grown.volume ||
    measured.minPressure > grown.minPressure ||
    measured.minVolume > grown.minVolume;
  if (!cabeEnMenos) return { bounds: grown, shrinkSinceS: null, lastEndS: endS };
  const desde = prev.shrinkSinceS ?? endS;
  const enOrigen = style === 'scroll' || Math.floor(endS / win) > Math.floor(prev.lastEndS / win);
  if (endS - desde >= win && enOrigen) return { bounds: measured, shrinkSinceS: null, lastEndS: endS };
  return { bounds: grown, shrinkSinceS: desde, lastEndS: endS };
}

/** Rótulos del eje de tiempo: en barrido, la fase dentro de la ventana; en continuo, el tiempo de simulación. */
export function timeAxisLabels(style: 'sweep' | 'scroll', end: number, win: number, divisions = 3): number[] {
  return Array.from({ length: divisions + 1 }, (_, k) =>
    style === 'sweep' ? (k * win) / divisions : Math.max(0, end - win + (k * win) / divisions),
  );
}

/**
 * Instante bajo una fracción horizontal de la ventana (0 = borde izquierdo, 1 = derecho), con la misma geometría con
 * que se dibuja la traza, para que cursor y lector nunca se separen del dibujo. En continuo el borde derecho es `end`.
 * En barrido la posición es la fase de la pasada: a la izquierda de la unión están los datos de la pasada en curso y a
 * la derecha los de la anterior.
 */
export function cursorTimeAt(ratio: number, style: 'sweep' | 'scroll', end: number, win: number): number {
  // En barrido el borde derecho es la fase 1, que coincide con la 0: se queda justo antes para no saltar a la izquierda.
  const r = Math.max(0, Math.min(style === 'sweep' ? 1 - 1e-9 : 1, ratio));
  if (style === 'scroll') return end - win + r * win;
  const t = Math.floor(end / win) * win + r * win;
  return t > end ? t - win : t;
}

/** Márgenes horizontales de la rejilla de curvas: el puntero los necesita para convertir su posición en tiempo. */
export const WAVE_MARGIN = { left: 47, right: 9 } as const;

/**
 * Ancho lógico de un lienzo de curvas. No se puede leer del atributo `width`: al preparar el lienzo se reescribe con el
 * ancho en píxeles de dispositivo (608 × 2 en una pantalla de alta densidad), y el puntero convertía con el doble de
 * ancho: el cursor caía unos 0,2 s más allá en el centro de la ventana en cualquier Retina o teléfono.
 */
export function canvasLogicalWidth(canvas: HTMLCanvasElement): number {
  return setups.get(canvas)?.w ?? Number(canvas.getAttribute('width'));
}

/**
 * Desplazamiento temporal (s) con que se dibuja la respiración de referencia: su inicio queda alineado con el de la
 * respiración visible más reciente, que es con la que el alumno la compara. El inicio real del ciclo se busca en la
 * traza completa —su primera muestra puede haber quedado fuera de la ventana—. null cuando no hay con qué alinearla
 * (sin muestras a la vista o sin respiración asignada).
 */
export function referenceShift(visible: Point[], all: Point[], ref: Point[]): number | null {
  if (!ref.length || !visible.length) return null;
  const id = visible[visible.length - 1]![5];
  if (id <= 0) return null;
  for (const p of all) if (p[5] === id) return p[0] - ref[0]![0];
  return null;
}

export interface WaveOptions {
  window?: number;
  style?: 'sweep' | 'scroll';
  single?: boolean;
  frozen?: boolean;
  cursorTime?: number | null;
  cursorTimeB?: number | null;
  markers?: WaveMarker[];
  /** Ciclo medido guardado como referencia: se dibuja tenue bajo la traza, alineado al inicio de la última respiración visible. */
  reference?: Point[] | null;
  /** Escala ya decidida por quien llama (con histéresis, `stableBounds`); sin ella, la de lo visible en este cuadro. */
  bounds?: Bounds;
  /** Techo de presión Pmáx del ajuste vigente: se dibuja como línea de referencia en el panel de Pva. */
  pmax?: number;
  /** Instantes en que el sensor detectó un disparo (s). Es la detección del equipo, no prueba de esfuerzo del paciente: una fuga que cruce el umbral también cuenta (autodisparo). */
  triggerDetectionsS?: number[];
}

/** Tres curvas apiladas (o sólo Pva con `single`) con relleno degradado y barrido con hueco por delante del cursor. */
export function drawWave(
  canvas: HTMLCanvasElement,
  all: Point[],
  end: number,
  peep: number,
  vtMl: number,
  options: WaveOptions = {},
): { left: number; right: number; plotW: number; win: number } {
  const o = context(canvas),
    { ctx, w, h } = o,
    win = options.window ?? 12,
    style = options.style ?? 'sweep';
  const points = visiblePoints(all, end, win);
  const ref = options.reference?.length ? options.reference : null,
    refShift = ref ? referenceShift(points, all, ref) : null;
  const range = options.bounds ?? getBounds(points, peep, vtMl),
    single = options.single ?? false;
  type Spec = {
    label: string;
    unit: string;
    index: 1 | 2 | 3;
    min: number;
    max: number;
    ticks: number[];
    color: string;
    fill: 'pressure' | 'flow' | 'volume';
  };
  const specs: Spec[] = single
    ? [
        {
          label: 'Pva',
          unit: 'cmH₂O',
          index: 1,
          min: range.minPressure,
          max: range.pressure,
          ticks: [0, range.pressure / 2, range.pressure],
          color: '#c8f3f2',
          fill: 'pressure',
        },
      ]
    : [
        {
          label: 'Pva',
          unit: 'cmH₂O',
          index: 1,
          min: range.minPressure,
          max: range.pressure,
          // Con suelo negativo hace falta su marca, como en el volumen: la excursión se ve pero también se mide.
          ticks:
            range.minPressure <= -5 ? [range.minPressure, 0, range.pressure / 2, range.pressure] : [0, range.pressure / 2, range.pressure],
          color: '#dcfff2',
          fill: 'pressure',
        },
        {
          label: 'Flujo',
          unit: 'L/min',
          index: 2,
          min: -range.flow,
          max: range.flow,
          ticks: [-range.flow, 0, range.flow],
          color: '#baf9f4',
          fill: 'flow',
        },
        {
          label: 'Volumen',
          unit: 'mL',
          index: 3,
          min: range.minVolume,
          max: range.volume,
          // Con suelo negativo hace falta su marca: si no, la excursión bajo la línea de base se ve pero no se mide.
          ticks: range.minVolume < -range.volume * 0.15 ? [range.minVolume, 0, range.volume] : [0, range.volume / 2, range.volume],
          color: '#c2efff',
          fill: 'volume',
        },
      ];
  const left = WAVE_MARGIN.left,
    right = WAVE_MARGIN.right,
    plotW = w - left - right,
    rowH = h / specs.length;
  const xfn = (t: number): number => left + (style === 'sweep' ? (((t % win) + win) % win) / win : (t - (end - win)) / win) * plotW;
  specs.forEach((sp, i) => {
    const ytop = i * rowH + 21,
      ybottom = (i + 1) * rowH - (i === specs.length - 1 ? 13 : 7),
      ph = ybottom - ytop;
    const yf = (v: number): number => ybottom - ((v - sp.min) / (sp.max - sp.min)) * ph;
    text(ctx, sp.label, left + 1, i * rowH + 16, 13, '#b8ecff', 'left', '500');
    text(ctx, sp.unit, w - right, i * rowH + 16, 10, '#95cceb', 'right');
    for (let k = 0; k <= 6; k++) line(ctx, left + (k * plotW) / 6, ytop, left + (k * plotW) / 6, ybottom, '#64ace451', 0.65);
    for (const val of sp.ticks) {
      const y = yf(val);
      line(ctx, left, y, w - right, y, val === 0 ? '#b0e8f78c' : '#77c0e44a', val === 0 ? 1 : 0.6);
      text(ctx, String(Math.round(val)), left - 7, y + 3, 11, PLOT_TEXT_COLORS.tickCurvas, 'right');
    }
    line(ctx, left, ytop, left, ybottom, '#77bfea7a');
    line(ctx, w - right, ytop, w - right, ybottom, '#77bfea7a');
    line(ctx, left, ybottom, w - right, ybottom, '#6caee877');
    const segments: { x: number; y: number }[][] = [];
    let segment: { x: number; y: number }[] = [];
    let prevX = -1,
      prevId: number | null = null;
    for (const p of points) {
      const x = xfn(p[0]);
      if (x < left - 0.5 || x > w - right + 0.5) continue;
      if (segment.length && (x < prevX - plotW * 0.5 || (sp.index === 3 && prevId !== p[5]))) {
        segments.push(segment);
        segment = [];
      }
      segment.push({ x, y: yf(p[sp.index]) });
      prevX = x;
      prevId = p[5];
    }
    if (segment.length) segments.push(segment);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, ytop, plotW, ph);
    ctx.clip();
    if (sp.index === 1) {
      // Referencias del panel de presión: PEEP programada y techo Pmáx (P: legibilidad de la curva).
      ctx.save();
      ctx.setLineDash([4, 4]);
      if (peep > 0) {
        line(ctx, left, yf(peep), w - right, yf(peep), '#ffd66e99', 0.9);
        text(ctx, 'PEEP', w - right - 2, yf(peep) - 2, 9, '#ffd66e99', 'right');
      }
      if (typeof options.pmax === 'number' && Number.isFinite(options.pmax) && options.pmax > sp.min && options.pmax < sp.max) {
        line(ctx, left, yf(options.pmax), w - right, yf(options.pmax), '#ff7b7bb0', 0.9);
        text(ctx, 'Pmáx', w - right - 2, yf(options.pmax) - 2, 9, '#ff7b7bb0', 'right');
      }
      ctx.restore();
      // Cada disparo detectado por el sensor queda marcado en el borde inferior; no distingue esfuerzo de autodisparo por fuga.
      for (const t of options.triggerDetectionsS ?? []) {
        if (t < end - win || t > end) continue;
        const x = xfn(t);
        if (x < left || x > w - right) continue;
        ctx.fillStyle = '#ffd66e';
        ctx.beginPath();
        ctx.moveTo(x, ybottom - 1);
        ctx.lineTo(x - 3.5, ybottom - 7);
        ctx.lineTo(x + 3.5, ybottom - 7);
        ctx.closePath();
        ctx.fill();
      }
    }
    const gradient = ctx.createLinearGradient(0, ytop, 0, ybottom);
    if (sp.fill === 'pressure') {
      gradient.addColorStop(0, '#90d27508');
      gradient.addColorStop(0.52, '#b5d04c77');
      gradient.addColorStop(0.87, '#ddda68b0');
      gradient.addColorStop(1, '#a8ce6c80');
    } else if (sp.fill === 'flow') {
      gradient.addColorStop(0, '#84e6bd55');
      gradient.addColorStop(0.45, '#6ae0c68c');
      gradient.addColorStop(0.5, '#6fd5d747');
      gradient.addColorStop(0.7, '#46c4dd70');
      gradient.addColorStop(1, '#409de888');
    } else {
      gradient.addColorStop(0, '#97d9ff36');
      gradient.addColorStop(1, '#77cfee90');
    }
    for (const seg of segments) {
      if (seg.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(seg[0]!.x, yf(0));
      for (const p of seg) ctx.lineTo(p.x, p.y);
      ctx.lineTo(seg[seg.length - 1]!.x, yf(0));
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }
    // Respiración de referencia: atenuada, sobre el relleno y bajo el trazo de la curva actual, como el fantasma de
    // los monitores. Se compara de forma, no de fase — si el ciclo actual cambió de duración la referencia no se
    // estira, y esa diferencia es justo lo que se quiere ver.
    if (ref && refShift !== null) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#edc87eb3';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      let refStarted = false,
        refPrevX = 0;
      for (const p of ref) {
        const x = xfn(p[0] + refShift);
        if (x < left - 0.5 || x > w - right + 0.5) continue;
        const y = yf(p[sp.index]);
        if (!refStarted || x < refPrevX - plotW * 0.5) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        refStarted = true;
        refPrevX = x;
      }
      ctx.stroke();
      ctx.restore();
      if (i === 0) {
        text(ctx, 'Antes', left + 5, ytop + 10, 8, '#edc87e');
        text(ctx, 'Después', left + 39, ytop + 10, 8, sp.color);
      }
    }
    for (const seg of segments) {
      if (seg.length < 2) continue;
      ctx.strokeStyle = sp.color;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      seg.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    }
    for (const marker of options.markers ?? []) {
      if (marker.t < end - win || marker.t > end) continue;
      const x = xfn(marker.t);
      if (x < left || x > w - right) continue;
      if (marker.kind === 'start' || marker.kind === 'cycle' || marker.kind === 'end') {
        ctx.save();
        ctx.setLineDash([2, 4]);
        line(ctx, x, ytop, x, ybottom, marker.kind === 'cycle' ? '#ffd36e80' : '#b4dcf060', 0.8);
        ctx.restore();
        if (i === 0) {
          const labelY = marker.kind === 'start' ? ytop + 10 : marker.kind === 'cycle' ? ybottom - 16 : ybottom - 5;
          text(ctx, marker.label, x + 3, labelY, 8, '#c4e5f2');
        }
      } else if (i === 0) {
        const value = marker.value ?? sp.min;
        const y = marker.kind === 'effort' ? ybottom - 4 : yf(value);
        const markerColor = marker.kind === 'pplat' ? '#ffe49a' : marker.kind === 'ppeak' ? '#ffb0aa' : '#d6b7ff';
        ctx.fillStyle = markerColor;
        ctx.beginPath();
        ctx.arc(x, y, 2.8, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, marker.label, x + 4, Math.max(ytop + 8, y - 4), 8, markerColor);
      }
    }
    if (style === 'sweep' && !options.frozen) {
      const cursor = xfn(end);
      ctx.fillStyle = '#0555b4f0';
      ctx.fillRect(cursor + 1, ytop, 8, ph);
      line(ctx, cursor, ytop, cursor, ybottom, '#c4f5ff88', 0.8);
    } else if (style === 'sweep') {
      // Congeladas en barrido: a la izquierda de esta línea está la pasada nueva y a la derecha la anterior. Sin marca,
      // el salto de la señal en la unión se lee como un defecto de la curva.
      const union = xfn(end);
      ctx.save();
      ctx.setLineDash([3, 3]);
      line(ctx, union, ytop, union, ybottom, '#c4f5ffaa', 0.9);
      ctx.restore();
    }
    if (typeof options.cursorTime === 'number' && Number.isFinite(options.cursorTime)) {
      const x = xfn(options.cursorTime);
      line(ctx, x, ytop, x, ybottom, '#ffffffd0', 0.8);
      if (i === 0) text(ctx, 'A', x + 3, ytop + 10, 8, '#ffffffd0', 'left', '600');
    }
    if (typeof options.cursorTimeB === 'number' && Number.isFinite(options.cursorTimeB)) {
      const x = xfn(options.cursorTimeB);
      line(ctx, x, ytop, x, ybottom, '#ffe49ad0', 0.8);
      if (i === 0) text(ctx, 'B', x + 3, ytop + 10, 8, '#ffe49ad0', 'left', '600');
    }
    ctx.restore();
    if (i === specs.length - 1)
      timeAxisLabels(style, end, win, 6).forEach((val, k) =>
        text(
          ctx,
          format(val, 0) + ' s',
          left + (k * plotW) / 6,
          h - 1,
          10,
          PLOT_TEXT_COLORS.ejeTiempo,
          k === 6 ? 'right' : k === 0 ? 'left' : 'center',
        ),
      );
  });
  return { left, right, plotW, win };
}

/** Índices de las tres flechas de sentido del bucle (20 %, 50 % y 80 % del ciclo); vacío con menos de 8 muestras. */
export function arrowIndices(n: number): number[] {
  return n >= 8 ? [Math.floor(n * 0.2), Math.floor(n * 0.5), Math.floor(n * 0.8)] : [];
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

export function drawLoop(
  canvas: HTMLCanvasElement,
  points: Point[],
  reference: Point[] | null,
  peep: number,
  vtMl: number,
  type: 'pv' | 'fv' = 'pv',
  options: { vtMark?: boolean } = {},
): void {
  const { ctx, w, h } = context(canvas),
    current = cyclePoints(points, 'current'),
    prev = cyclePoints(points, 'last'),
    ref = reference ?? prev;
  const ranges = getBounds([...current, ...ref], peep, vtMl);
  const left = 55,
    right = 16,
    top = 49,
    bottom = h - 36,
    pw = w - left - right,
    ph = bottom - top;
  const xrange = type === 'pv' ? [0, ranges.pressure] : [0, ranges.volume],
    yrange = type === 'pv' ? [0, ranges.volume] : [-ranges.flow, ranges.flow];
  const xf = (x: number): number => left + ((x - xrange[0]!) / (xrange[1]! - xrange[0]!)) * pw,
    yf = (y: number): number => bottom - ((y - yrange[0]!) / (yrange[1]! - yrange[0]!)) * ph;
  text(ctx, type === 'pv' ? 'Presión · volumen' : 'Flujo · volumen', left, 23, 15, '#c4f0ff', 'left', '500');
  text(ctx, type === 'pv' ? 'mL' : 'L/min', left, top - 9, 10);
  text(ctx, type === 'pv' ? 'cmH₂O' : 'mL', w - right, h - 9, 10, '#93cdec', 'right');
  for (let k = 0; k <= 4; k++) {
    const x = xrange[0]! + ((xrange[1]! - xrange[0]!) * k) / 4,
      y = yrange[0]! + ((yrange[1]! - yrange[0]!) * k) / 4;
    line(ctx, xf(x), top, xf(x), bottom, '#66add957');
    line(ctx, left, yf(y), w - right, yf(y), '#66add957');
    text(ctx, format(x), xf(x), bottom + 17, 10, PLOT_TEXT_COLORS.tickBucles, 'center');
    text(ctx, format(y), left - 8, yf(y) + 4, 10, PLOT_TEXT_COLORS.tickBucles, 'right');
  }
  line(ctx, left, yf(0), w - right, yf(0), '#a8e6f799', 1);
  line(ctx, left, top, left, bottom, '#a8e6f799', 1);
  const path = (data: Point[], color: string, dashed: boolean): void => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, pw, ph);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = dashed ? 1.7 : 2.2;
    ctx.setLineDash(dashed ? [5, 4] : []);
    ctx.beginPath();
    data.forEach((p, i) => {
      const x = xf(type === 'pv' ? p[1] : p[3]),
        y = yf(type === 'pv' ? p[3] : p[2]);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    if (!dashed && data.length) {
      const p = data[data.length - 1]!;
      ctx.fillStyle = '#defdf3';
      ctx.beginPath();
      ctx.arc(xf(type === 'pv' ? p[1] : p[3]), yf(type === 'pv' ? p[3] : p[2]), 3, 0, Math.PI * 2);
      ctx.fill();
      // Marcas pedagógicas: inicio de inspiración (círculo hueco) y flechas del sentido del ciclo.
      const p0 = data[0]!;
      ctx.strokeStyle = '#9bf4de';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(xf(type === 'pv' ? p0[1] : p0[3]), yf(type === 'pv' ? p0[3] : p0[2]), 3.5, 0, Math.PI * 2);
      ctx.stroke();
      const px = (i: number): { x: number; y: number } => {
        const m = data[Math.max(0, Math.min(data.length - 1, i))]!;
        return { x: xf(type === 'pv' ? m[1] : m[3]), y: yf(type === 'pv' ? m[3] : m[2]) };
      };
      ctx.fillStyle = '#9bf4de';
      for (const i of arrowIndices(data.length)) {
        const a = px(i - 2),
          b = px(i + 2),
          c = px(i);
        const dx = b.x - a.x,
          dy = b.y - a.y,
          len = Math.hypot(dx, dy);
        if (len < 1) continue;
        const ux = dx / len,
          uy = dy / len;
        ctx.beginPath();
        ctx.moveTo(c.x + ux * 5, c.y + uy * 5);
        ctx.lineTo(c.x - ux * 5 - uy * 3.5, c.y - uy * 5 + ux * 3.5);
        ctx.lineTo(c.x - ux * 5 + uy * 3.5, c.y - uy * 5 - ux * 3.5);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  };
  // Referencias del bucle P-V: líneas de PEEP y de VT programado, como las marcas de la pantalla del equipo.
  if (type === 'pv' && peep > 0 && peep > xrange[0]! && peep < xrange[1]!) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    line(ctx, xf(peep), top, xf(peep), bottom, '#ffd66e99', 0.9);
    ctx.restore();
    line(ctx, xf(peep), bottom, xf(peep), bottom + 5, '#ffd66e', 1);
    text(ctx, 'PEEP', xf(peep) + 3, top + 10, 9, '#ffd66e', 'left');
  }
  // La VT sólo es consigna en VC; en PC/PS es resultado, no ajuste.
  if (options.vtMark && vtMl > 0 && type === 'pv' && vtMl > yrange[0]! && vtMl < yrange[1]!) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    line(ctx, left, yf(vtMl), w - right, yf(vtMl), '#9fd7ff99', 0.9);
    ctx.restore();
    text(ctx, 'VT', w - right - 2, yf(vtMl) - 2, 9, '#9fd7ff', 'right');
  }
  if (options.vtMark && vtMl > 0 && type === 'fv' && vtMl > xrange[0]! && vtMl < xrange[1]!) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    line(ctx, xf(vtMl), top, xf(vtMl), bottom, '#9fd7ff99', 0.9);
    ctx.restore();
    text(ctx, 'VT', xf(vtMl) + 3, top + 10, 9, '#9fd7ff', 'left');
  }
  path(ref, reference ? '#edc87ecc' : '#b7c4d466', true);
  path(current, '#9bf4de', false);
  line(ctx, w - 140, 20, w - 122, 20, '#9bf4de', 2);
  text(ctx, 'Actual', w - 116, 24, 10, '#a2e6df');
  line(ctx, w - 140, 34, w - 122, 34, reference ? '#edc87ecc' : '#b7c4d466', 1.5);
  text(ctx, reference ? 'Referencia' : 'Previo', w - 116, 38, 10, reference ? '#eed49d' : '#adc6e0');
}

export interface GaugeState {
  paw: number;
  pmax: number;
  ppeak: number | null;
  peep: number;
  standby: boolean;
  vteMl: number | null;
  fio2Pct: number | null;
}
export function drawGauge(canvas: HTMLCanvasElement, s: GaugeState): void {
  const { ctx, w } = context(canvas);
  const max = nice(Math.max(s.pmax, s.paw, s.ppeak ?? 0) * 1.15, [60, 80, 100, 120]),
    top = 58,
    bottom = 382,
    x = 47,
    bw = 43;
  const yf = (v: number): number => bottom - (clamp(v, 0, max) / max) * (bottom - top);
  text(ctx, 'Pva', x + bw / 2, 18, 12, '#a9e8ff', 'center');
  text(ctx, format(s.standby ? null : s.paw, 0), x + bw / 2, 42, 25, '#e0feff', 'center', '600');
  ctx.fillStyle = '#041d42';
  ctx.strokeStyle = '#88b3cd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, top, bw, bottom - top + 12, [6, 6, 22, 22]);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 1, top + 1, bw - 2, bottom - top + 10, [5, 5, 20, 20]);
  ctx.clip();
  const fill = ctx.createLinearGradient(x, 0, x + bw, 0);
  fill.addColorStop(0, '#168da7');
  fill.addColorStop(0.52, '#4eded5');
  fill.addColorStop(1, '#1da8b7');
  const paw = s.standby ? 0 : s.paw;
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, yf(paw), bw - 2, bottom - yf(paw) + 13);
  ctx.restore();
  const tick = max / 3;
  for (let i = 0; i <= 3; i++) {
    const v = i * tick;
    line(ctx, x, yf(v), x + bw, yf(v), '#96d9e399', 1);
    text(ctx, format(v), x - 8, yf(v) + 4, 11, '#84d6f6', 'right');
  }
  const marker = (value: number | null, label: string, color: string): void => {
    if (value === null || !Number.isFinite(value)) return;
    const y = yf(value);
    line(ctx, x - 2, y, x + bw + 2, y, color, 3);
    text(ctx, label, x + bw + 7, y + 3, 10, color);
  };
  marker(s.pmax, 'Pmáx', '#ff75a0');
  if (s.ppeak !== null && Math.abs(s.ppeak - s.pmax) < max * 0.04) {
    const y = yf(s.ppeak);
    line(ctx, x - 2, y, x + bw + 2, y, '#c9f9ff', 3);
    text(ctx, 'Ppico', x - 6, y + 14, 10, '#c9f9ff', 'right');
  } else marker(s.ppeak, 'Ppico', '#c9f9ff');
  marker(s.peep, 'PEEP', '#81e1e1');
  text(ctx, 'VTesp', w / 2, 420, 10, '#9adaff', 'center');
  text(ctx, format(s.standby ? null : s.vteMl, 0), w / 2, 449, 29, '#e0feff', 'center', '600');
  text(ctx, `FiO₂ ${format(s.fio2Pct, 0)} %`, w / 2, 477, 12, '#ace9ff', 'center');
}

export function drawMuscle(canvas: HTMLCanvasElement, points: Point[], end: number): void {
  const { ctx, w, h } = context(canvas),
    recent = points.filter((p) => p[0] >= end - 10 && p[0] <= end),
    top = 14,
    bottom = h - 10,
    // La espiración activa lleva Pmus a valores negativos: eje simétrico con línea de cero explícita.
    hi = Math.max(10, ...recent.map((p) => p[4] * 1.3)),
    lo = Math.min(0, ...recent.map((p) => p[4] * 1.3)),
    y = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  line(ctx, 0, bottom, w, bottom, '#6385a64a');
  line(ctx, 0, lo < 0 ? y(0) : (top + bottom) / 2, w, lo < 0 ? y(0) : (top + bottom) / 2, '#6385a62a');
  if (!recent.length) return;
  ctx.beginPath();
  recent.forEach((p, i) => {
    const x = ((p[0] - (end - 10)) / 10) * w,
      yy = y(p[4]);
    if (i) ctx.lineTo(x, yy);
    else ctx.moveTo(x, yy);
  });
  ctx.strokeStyle = '#b2a5ee';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineTo(w, bottom);
  ctx.lineTo(0, bottom);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, '#8e82d939');
  g.addColorStop(1, '#8e82d904');
  ctx.fillStyle = g;
  ctx.fill();
}

/**
 * Bucle docente (no va al monitor): Pva·V del ciclo y, superpuesta, la presión total (Pva+Pmus)·V — la presión que
 * realmente distiende pulmón y vía aérea (Paw + Pmus = Pel + R·Q). El área entre ambos bucles es el trabajo que
 * aporta el paciente. Sin esfuerzo sólo se dibuja Pva·V y se anota que ambas coinciden.
 */
export function drawMuscleLoop(canvas: HTMLCanvasElement, points: Point[]): void {
  const { ctx, w, h } = context(canvas);
  // Bucle principal: último ciclo COMPLETO; encima, el ciclo en curso con alfa para ver cómo se forma.
  const completo = cyclePoints(points, 'last'),
    actual = cyclePoints(points, 'current'),
    base = completo.length ? completo : actual;
  if (!base.length) return;
  const left = 36,
    right = 8,
    top = 24,
    bottom = h - 22,
    pw = w - left - right,
    ph = bottom - top;
  // El esfuerzo se decide por ciclo: un ciclo pasado pasivo junto a uno activo no debe heredar la traza total.
  const hasEffort = (data: Point[]): boolean => data.some((p) => Math.abs(p[4]) >= 0.2),
    esfBase = hasEffort(base),
    esfActual = hasEffort(actual);
  let pMin = 0,
    pMax = 0,
    vMin = 0,
    vMax = 0;
  for (const p of [...base, ...actual]) {
    const total = p[1] + p[4];
    pMin = Math.min(pMin, p[1], total);
    pMax = Math.max(pMax, p[1], total);
    vMin = Math.min(vMin, p[3]);
    vMax = Math.max(vMax, p[3]);
  }
  const xrange = [pMin < 0 ? pMin * 1.15 : 0, nice(Math.max(10, pMax * 1.15), [30, 40, 60, 80, 100, 120])],
    yrange = [
      vMin < 0 ? -nice(-vMin * 1.15, [100, 200, 300, 600, 900]) : 0,
      nice(Math.max(100, vMax * 1.15), [300, 600, 900, 1200, 1500, 2100, 3000]),
    ];
  const xf = (x: number): number => left + ((x - xrange[0]!) / (xrange[1]! - xrange[0]!)) * pw,
    yf = (y: number): number => bottom - ((y - yrange[0]!) / (yrange[1]! - yrange[0]!)) * ph;
  text(ctx, 'Pva · V', left, top - 9, 10, '#c4f0ff', 'left');
  text(ctx, '(Pva+Pmus) · V = presión total', left + 58, top - 9, 10, '#b2a5ee', 'left');
  for (let k = 0; k <= 3; k++) {
    const x = xrange[0]! + ((xrange[1]! - xrange[0]!) * k) / 3,
      y = yrange[0]! + ((yrange[1]! - yrange[0]!) * k) / 3;
    line(ctx, xf(x), top, xf(x), bottom, '#66add957');
    line(ctx, left, yf(y), w - right, yf(y), '#66add957');
    text(ctx, format(x), xf(x), bottom + 12, 9, PLOT_TEXT_COLORS.tickBucles, 'center');
    text(ctx, format(y), left - 5, yf(y) + 3, 9, PLOT_TEXT_COLORS.tickBucles, 'right');
  }
  if (xrange[0]! < 0) line(ctx, xf(0), top, xf(0), bottom, '#a8e6f799', 1);
  if (yrange[0]! < 0) line(ctx, left, yf(0), w - right, yf(0), '#a8e6f799', 1);
  const path = (data: Point[], xOf: (p: Point) => number, color: string, alpha: number): void => {
    if (!data.length) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.rect(left, top, pw, ph);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    data.forEach((p, i) => {
      const x = xf(xOf(p)),
        y = yf(p[3]);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  };
  // El ciclo en curso se dibuja primero y el completo encima, para que el bucle cerrado mande.
  if (completo.length) {
    path(actual, (p) => p[1], '#c4f0ff', 0.45);
    if (esfActual) path(actual, (p) => p[1] + p[4], '#b2a5ee', 0.45);
  }
  path(base, (p) => p[1], '#c4f0ff', 1);
  if (esfBase) path(base, (p) => p[1] + p[4], '#b2a5ee', 1);
  if (!esfBase && !esfActual) text(ctx, 'Sin esfuerzo: Pva = presión total', (left + w - right) / 2, h - 6, 10, '#85a3b9', 'center');
}

export function drawTrends(canvas: HTMLCanvasElement, points: TrendRow[], end: number): void {
  const { ctx, w, h } = context(canvas),
    span = Math.min(600, Math.max(60, end)),
    start = Math.max(0, end - span),
    visible = points.filter((x) => x.t >= start && x.t <= end);
  const specs = [
    {
      label: 'Presiones',
      unit: 'cmH₂O',
      keys: [
        ['ppeak', '#cff7f4', 'Ppico'],
        ['peep', '#64d7c4', 'PEEPe'],
      ] as [keyof TrendRow, string, string][],
      max: nice(Math.max(30, ...visible.map((x) => x.ppeak ?? 0)) * 1.15, [40, 60, 80, 120]),
    },
    {
      label: 'Volumen espirado',
      unit: 'mL',
      keys: [['vte', '#abdfff', 'VTesp']] as [keyof TrendRow, string, string][],
      max: nice(Math.max(450, ...visible.map((x) => x.vte ?? 0)) * 1.15, [600, 800, 1000, 1500, 2500]),
    },
    {
      label: 'Frecuencia',
      unit: '/min',
      keys: [['rr', '#e8d397', 'FR']] as [keyof TrendRow, string, string][],
      max: nice(Math.max(30, ...visible.map((x) => x.rr ?? 0)) * 1.1, [40, 60, 90, 120]),
    },
  ];
  const row = h / 3,
    left = 66,
    right = 17,
    pw = w - left - right;
  specs.forEach((sp, i) => {
    const top = i * row + 28,
      bottom = (i + 1) * row - 19,
      ph = bottom - top,
      xf = (t: number): number => left + ((t - start) / span) * pw,
      yf = (v: number): number => bottom - (v / sp.max) * ph;
    text(ctx, sp.label, left, i * row + 16, 12, '#bce5fa');
    text(ctx, sp.unit, left - 9, i * row + 16, 9, '#8dbddf', 'right');
    for (let k = 0; k <= 4; k++) {
      const y = yf((k * sp.max) / 4);
      line(ctx, left, y, w - right, y, '#78b8da3d');
      text(ctx, format((k * sp.max) / 4), left - 8, y + 3, 10, PLOT_TEXT_COLORS.tickTendencias, 'right');
      const x = left + (k * pw) / 4;
      line(ctx, x, top, x, bottom, '#78b8da3d');
    }
    sp.keys.forEach(([key, color, label], j) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      let drawn = false;
      for (const p of visible) {
        const v = p[key] as number | null;
        if (v === null || !Number.isFinite(v)) {
          drawn = false;
          continue;
        }
        if (drawn) ctx.lineTo(xf(p.t), yf(v));
        else ctx.moveTo(xf(p.t), yf(v));
        drawn = true;
      }
      ctx.stroke();
      text(ctx, label, w - right - j * 67, i * row + 16, 10, color, 'right');
    });
    if (i === 2)
      for (let k = 0; k <= 4; k++) {
        const time = start + (k * span) / 4;
        text(
          ctx,
          `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`,
          left + (k * pw) / 4,
          h - 3,
          9,
          '#81b9d9',
          k === 0 ? 'left' : k === 4 ? 'right' : 'center',
        );
      }
  });
}
