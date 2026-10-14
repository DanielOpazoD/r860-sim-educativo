import { formatNumber as format } from '../domain/units';
import { alfa, AYUDA, MON, MON_CSS, MON_FS, PLOT_TEXT_COLORS } from './monitorPalette';
import { context, line, nice, text } from './canvas';
import { type Point, visiblePoints } from './signal';

/** Curvas de presión, flujo y volumen: escalas estables, marcas y rótulos de fase, cursor y el dibujo de las tres curvas. */

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

/** Caja de un rótulo ya escrito sobre la curva: extremos en x y línea base. */
export interface LabelBox {
  x0: number;
  x1: number;
  y: number;
}

/**
 * Línea base de un rótulo de marca (Ppico, Pplat, esfuerzo) que no pise los ya escritos: el sitio preferido es encima
 * del punto; si ahí choca —en una oclusión Ppico cae justo en «Inicio», los dos arriba del todo—, va debajo del punto.
 */
export function labelBaseline(taken: LabelBox[], x0: number, x1: number, preferred: number, below: number, height: number): number {
  const choca = (y: number): boolean => taken.some((b) => x0 < b.x1 + 4 && x1 > b.x0 - 4 && Math.abs(y - b.y) < height + 2);
  return choca(preferred) && !choca(below) ? below : preferred;
}

/** Alto que ocupa la traza (en píxeles del lienzo) entre x0 y x1, o null si allí no pasa: cuenta todo tramo que lo cruce. */
export function traceSpan(segments: { x: number; y: number }[][], x0: number, x1: number): [number, number] | null {
  let lo = Infinity,
    hi = -Infinity;
  for (const seg of segments)
    for (let k = 0; k < seg.length; k++) {
      const p = seg[k]!,
        q = seg[k + 1] ?? p;
      if (Math.max(p.x, q.x) < x0 || Math.min(p.x, q.x) > x1) continue;
      lo = Math.min(lo, p.y, q.y);
      hi = Math.max(hi, p.y, q.y);
    }
  return lo <= hi ? [lo, hi] : null;
}

/**
 * Línea base de un rótulo de fase («Inicio», «Ciclado», «Fin esp.») que no tache la traza. Si la traza cruza su banda —en
 * SC-09 la PEEP queda justo a la altura de «Ciclado»—, el rótulo sube por encima de ella, sobre el fondo; si no cabe, baja
 * por debajo; si tampoco, se queda donde estaba.
 */
export function phaseBaseline(span: [number, number] | null, preferred: number, height: number, ytop: number, ybottom: number): number {
  const tacha = (y: number): boolean => !!span && span[0] < y + 2 && span[1] > y - height;
  if (!span || !tacha(preferred)) return preferred;
  const encima = span[0] - 3,
    debajo = span[1] + height + 2;
  if (encima >= ytop + height && !tacha(encima)) return encima;
  if (debajo <= ybottom - 1 && !tacha(debajo)) return debajo;
  return preferred;
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
  if (ppeakPoint) markers.push({ kind: 'ppeak', t: ppeakPoint[0], label: `Ppico ${format(breath.ppeak, 0)}`, value: breath.ppeak });
  if (effortPoint) markers.push({ kind: 'effort', t: effortPoint[0], label: 'Esfuerzo' });
  if (hold?.breathId === breath.breathId && hold.startedAtMs !== null)
    markers.push({ kind: 'pplat', t: hold.startedAtMs / 1000, label: `Pplat ${format(hold.pplat, 0)}`, value: hold.pplat });
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
  /** Ayudas sobre las curvas (líneas de PEEP y Pmáx, marcas de disparo). Apagadas, la curva queda como en el equipo. */
  aids?: boolean;
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
          color: MON_CSS.texto,
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
          color: MON_CSS.texto,
          fill: 'pressure',
        },
        {
          label: 'Flujo',
          unit: 'L/min',
          index: 2,
          min: -range.flow,
          max: range.flow,
          ticks: [-range.flow, 0, range.flow],
          color: MON_CSS.texto,
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
          color: MON_CSS.texto,
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
    // Rótulo blanco en negrita y unidad gris, como en las capturas del manual; rejilla discreta y línea de cero clara.
    text(ctx, sp.label, left + 1, i * rowH + 16, 'sm', MON_CSS.texto, 'left', '700');
    text(ctx, sp.unit, w - right, i * rowH + 16, '2xs', PLOT_TEXT_COLORS.tickCurvas, 'right');
    for (let k = 0; k <= 6; k++) line(ctx, left + (k * plotW) / 6, ytop, left + (k * plotW) / 6, ybottom, MON.rejilla, 0.65);
    for (const val of sp.ticks) {
      const y = yf(val);
      line(ctx, left, y, w - right, y, val === 0 ? MON.cero : MON.rejillaSuave, val === 0 ? 1 : 0.6);
      text(ctx, String(Math.round(val)), left - 7, y + 3, 'xs', PLOT_TEXT_COLORS.tickCurvas, 'right');
    }
    line(ctx, left, ytop, left, ybottom, MON.marco);
    line(ctx, w - right, ytop, w - right, ybottom, MON.marco);
    line(ctx, left, ybottom, w - right, ybottom, MON.marco);
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
    if (sp.index === 1 && options.aids !== false) {
      // Referencias del panel de presión: PEEP programada y techo Pmáx (P: legibilidad de la curva).
      ctx.save();
      ctx.setLineDash([4, 4]);
      if (peep > 0) {
        line(ctx, left, yf(peep), w - right, yf(peep), alfa(AYUDA.peep, '99'), 0.9);
        text(ctx, 'PEEP', w - right - 2, yf(peep) - 2, '2xs', PLOT_TEXT_COLORS.lineaPeep, 'right');
      }
      if (typeof options.pmax === 'number' && Number.isFinite(options.pmax) && options.pmax > sp.min && options.pmax < sp.max) {
        line(ctx, left, yf(options.pmax), w - right, yf(options.pmax), AYUDA.pmaxLinea, 0.9);
        text(ctx, 'Pmáx', w - right - 2, yf(options.pmax) - 2, '2xs', PLOT_TEXT_COLORS.marcaPpico, 'right');
      }
      ctx.restore();
      // Cada disparo detectado por el sensor queda marcado en el borde inferior; no distingue esfuerzo de autodisparo por fuga.
      for (const t of options.triggerDetectionsS ?? []) {
        if (t < end - win || t > end) continue;
        const x = xfn(t);
        if (x < left || x > w - right) continue;
        ctx.fillStyle = AYUDA.peep;
        ctx.beginPath();
        ctx.moveTo(x, ybottom - 1);
        ctx.lineTo(x - 3.5, ybottom - 7);
        ctx.lineTo(x + 3.5, ybottom - 7);
        ctx.closePath();
        ctx.fill();
      }
    }
    const gradient = ctx.createLinearGradient(0, ytop, 0, ybottom);
    // Rellenos de fábrica del equipo en las capturas del manual SW10: presión amarilla que se aclara hacia la base (como
    // en la foto P1), flujo verde y volumen blanco que se apaga hacia la base. El equipo deja cambiarlos (URM 23-6).
    if (sp.fill === 'pressure') {
      gradient.addColorStop(0, MON.presion[0]);
      gradient.addColorStop(0.45, MON.presion[1]);
      gradient.addColorStop(1, MON.presion[2]);
    } else if (sp.fill === 'flow') {
      gradient.addColorStop(0, MON.flujo[0]);
      gradient.addColorStop(0.5, MON.flujo[1]);
      gradient.addColorStop(1, MON.flujo[0]);
    } else {
      gradient.addColorStop(0, MON.volumen[0]);
      gradient.addColorStop(1, MON.volumen[1]);
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
      ctx.strokeStyle = alfa(AYUDA.referencia, 'b3');
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
        text(ctx, 'Antes', left + 5, ytop + 11, '2xs', PLOT_TEXT_COLORS.antes);
        text(ctx, 'Después', left + 44, ytop + 11, '2xs', sp.color);
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
    const escritos: LabelBox[] = [];
    const rotular = (s: string, x: number, y: number, color: string): void => {
      text(ctx, s, x, y, '2xs', color);
      escritos.push({ x0: x, x1: x + ctx.measureText(s).width, y });
    };
    for (const marker of options.markers ?? []) {
      if (marker.t < end - win || marker.t > end) continue;
      const x = xfn(marker.t);
      if (x < left || x > w - right) continue;
      if (marker.kind === 'start' || marker.kind === 'cycle' || marker.kind === 'end') {
        ctx.save();
        ctx.setLineDash([2, 4]);
        line(ctx, x, ytop, x, ybottom, marker.kind === 'cycle' ? AYUDA.ciclado : AYUDA.marca, 0.8);
        ctx.restore();
        if (i === 0) {
          const labelY = marker.kind === 'start' ? ytop + 10 : marker.kind === 'cycle' ? ybottom - 16 : ybottom - 5;
          ctx.font = `normal ${MON_FS['2xs']}px Arial,sans-serif`;
          const span = traceSpan(segments, x + 3, x + 3 + ctx.measureText(marker.label).width);
          rotular(marker.label, x + 3, phaseBaseline(span, labelY, MON_FS['2xs'], ytop, ybottom), PLOT_TEXT_COLORS.anotacion);
        }
      } else if (i === 0) {
        const value = marker.value ?? sp.min;
        const y = marker.kind === 'effort' ? ybottom - 4 : yf(value);
        const markerColor =
          marker.kind === 'pplat'
            ? PLOT_TEXT_COLORS.marcaPplat
            : marker.kind === 'ppeak'
              ? PLOT_TEXT_COLORS.marcaPpico
              : PLOT_TEXT_COLORS.marcaEsfuerzo;
        ctx.fillStyle = markerColor;
        ctx.beginPath();
        ctx.arc(x, y, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `normal ${MON_FS['2xs']}px Arial,sans-serif`;
        const ancho = ctx.measureText(marker.label).width;
        const base = labelBaseline(
          escritos,
          x + 4,
          x + 4 + ancho,
          Math.max(ytop + 10, y - 4),
          Math.min(ybottom - 3, y + 13),
          MON_FS['2xs'],
        );
        rotular(marker.label, x + 4, base, markerColor);
      }
    }
    if (style === 'sweep' && !options.frozen) {
      const cursor = xfn(end);
      ctx.fillStyle = MON.barrido;
      ctx.fillRect(cursor + 1, ytop, 8, ph);
      line(ctx, cursor, ytop, cursor, ybottom, MON.cursorBarrido, 0.8);
    } else if (style === 'sweep') {
      // Congeladas en barrido: a la izquierda de esta línea está la pasada nueva y a la derecha la anterior. Sin marca,
      // el salto de la señal en la unión se lee como un defecto de la curva.
      const union = xfn(end);
      ctx.save();
      ctx.setLineDash([3, 3]);
      line(ctx, union, ytop, union, ybottom, AYUDA.union, 0.9);
      ctx.restore();
    }
    if (typeof options.cursorTime === 'number' && Number.isFinite(options.cursorTime)) {
      const x = xfn(options.cursorTime);
      line(ctx, x, ytop, x, ybottom, AYUDA.cursor, 0.8);
      if (i === 0) text(ctx, 'A', x + 3, ytop + 11, '2xs', MON_CSS.texto, 'left', '600');
    }
    if (typeof options.cursorTimeB === 'number' && Number.isFinite(options.cursorTimeB)) {
      const x = xfn(options.cursorTimeB);
      line(ctx, x, ytop, x, ybottom, alfa(PLOT_TEXT_COLORS.marcaPplat, 'd0'), 0.8);
      if (i === 0) text(ctx, 'B', x + 3, ytop + 11, '2xs', PLOT_TEXT_COLORS.marcaPplat, 'left', '600');
    }
    ctx.restore();
    if (i === specs.length - 1)
      timeAxisLabels(style, end, win, 6).forEach((val, k) =>
        text(
          ctx,
          format(val, 0) + ' s',
          left + (k * plotW) / 6,
          h - 1,
          'xs',
          PLOT_TEXT_COLORS.ejeTiempo,
          k === 6 ? 'right' : k === 0 ? 'left' : 'center',
        ),
      );
  });
  return { left, right, plotW, win };
}
