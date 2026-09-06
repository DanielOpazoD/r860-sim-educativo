/**
 * Renderizado exclusivamente visual (canvas). Nunca modifica el estado de la simulación.
 * Estilo de curvas, bucles, manómetro, tendencias y esfuerzo derivado de «R860 Lab» v1.1 (src/plots.js, MIT 2026),
 * portado a TypeScript sobre las muestras del motor de este proyecto.
 * Punto de señal: [t s, Paw cmH2O, flujo L/min, volumen mL, Pmus cmH2O, ciclo].
 */
export type Point = [number, number, number, number, number, number];
export interface TrendRow { t: number; ppeak: number | null; peep: number | null; vte: number | null; rr: number | null }

const setups = new WeakMap<HTMLCanvasElement, { w: number; h: number; dpr: number; ctx: CanvasRenderingContext2D }>();
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const nice = (value: number, steps: number[]): number => steps.find((x) => x >= value) ?? Math.ceil(value / (steps[steps.length - 1] as number)) * (steps[steps.length - 1] as number);
export const format = (v: number | null | undefined, d = 0): string => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '—'); // punto decimal como en las fotos (O)

function context(canvas: HTMLCanvasElement) {
  if (!setups.has(canvas)) {
    const w = Number(canvas.getAttribute('width')), h = Number(canvas.getAttribute('height')), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    setups.set(canvas, { w, h, dpr, ctx: canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D });
  }
  const o = setups.get(canvas)!;
  o.ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0); o.ctx.clearRect(0, 0, o.w, o.h);
  return o;
}
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = '#7fbde055', width = 0.6): void {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size = 11, color = '#98d8ff', align: CanvasTextAlign = 'left', weight = 'normal'): void {
  ctx.fillStyle = color; ctx.textAlign = align; ctx.font = `${weight} ${size}px Arial,sans-serif`; ctx.fillText(s, x, y);
}

export interface Bounds { pressure: number; flow: number; volume: number; minPressure: number }
export function getBounds(points: Point[], peep: number, vtMl: number): Bounds {
  let maxP = peep + 20 || 35, maxF = 40, maxV = vtMl || 450, minP = 0;
  for (const p of points) { maxP = Math.max(maxP, p[1]); minP = Math.min(minP, p[1]); maxF = Math.max(maxF, Math.abs(p[2])); maxV = Math.max(maxV, p[3]); }
  return { pressure: nice(maxP * 1.12, [40, 60, 80, 100, 120]), flow: nice(maxF * 1.15, [40, 60, 80, 120, 160, 240, 320]), volume: nice(maxV * 1.1, [300, 400, 600, 800, 1000, 1500, 2000, 2500, 4000]), minPressure: Math.min(-10, Math.floor(minP / 10) * 10) };
}

export interface WaveOptions { window?: number; style?: 'sweep' | 'scroll'; single?: boolean; frozen?: boolean; cursorTime?: number | null }

/** Tres curvas apiladas (o sólo Pva con `single`) con relleno degradado y barrido con hueco por delante del cursor. */
export function drawWave(canvas: HTMLCanvasElement, all: Point[], end: number, peep: number, vtMl: number, options: WaveOptions = {}): { left: number; right: number; plotW: number; win: number } {
  const o = context(canvas), { ctx, w, h } = o, win = options.window ?? 12, style = options.style ?? 'sweep';
  const points = all.filter((p) => p[0] >= end - win - 0.05 && p[0] <= end + 0.001);
  const range = getBounds(points, peep, vtMl), single = options.single ?? false;
  type Spec = { label: string; unit: string; index: 1 | 2 | 3; min: number; max: number; ticks: number[]; color: string; fill: 'pressure' | 'flow' | 'volume' };
  const specs: Spec[] = single
    ? [{ label: 'Pva', unit: 'cmH₂O', index: 1, min: range.minPressure, max: range.pressure, ticks: [0, range.pressure / 2, range.pressure], color: '#c8f3f2', fill: 'pressure' }]
    : [
        { label: 'Pva', unit: 'cmH₂O', index: 1, min: range.minPressure, max: range.pressure, ticks: [0, range.pressure / 2, range.pressure], color: '#dcfff2', fill: 'pressure' },
        { label: 'Flujo', unit: 'L/min', index: 2, min: -range.flow, max: range.flow, ticks: [-range.flow, 0, range.flow], color: '#baf9f4', fill: 'flow' },
        { label: 'Volumen', unit: 'mL', index: 3, min: -range.volume * 0.1, max: range.volume, ticks: [0, range.volume / 2, range.volume], color: '#c2efff', fill: 'volume' },
      ];
  const left = 47, right = 9, plotW = w - left - right, rowH = h / specs.length;
  const xfn = (t: number): number => left + (style === 'sweep' ? (((t % win) + win) % win) / win : (t - (end - win)) / win) * plotW;
  specs.forEach((sp, i) => {
    const ytop = i * rowH + 25, ybottom = (i + 1) * rowH - 12, ph = ybottom - ytop;
    const yf = (v: number): number => ybottom - ((v - sp.min) / (sp.max - sp.min)) * ph;
    text(ctx, sp.label, left + 1, i * rowH + 16, 13, '#b8ecff', 'left', '500'); text(ctx, sp.unit, w - right, i * rowH + 16, 10, '#95cceb', 'right');
    for (let k = 0; k <= 6; k++) line(ctx, left + (k * plotW) / 6, ytop, left + (k * plotW) / 6, ybottom, '#64ace451', 0.65);
    for (const val of sp.ticks) { const y = yf(val); line(ctx, left, y, w - right, y, val === 0 ? '#b0e8f78c' : '#77c0e44a', val === 0 ? 1 : 0.6); text(ctx, String(Math.round(val)), left - 7, y + 3, 10, '#8dd4f1', 'right'); }
    line(ctx, left, ytop, left, ybottom, '#77bfea7a'); line(ctx, w - right, ytop, w - right, ybottom, '#77bfea7a'); line(ctx, left, ybottom, w - right, ybottom, '#6caee877');
    const segments: { x: number; y: number }[][] = []; let segment: { x: number; y: number }[] = []; let prevX = -1, prevId: number | null = null;
    for (const p of points) {
      const x = xfn(p[0]); if (x < left - 0.5 || x > w - right + 0.5) continue;
      if (segment.length && (x < prevX - plotW * 0.5 || (sp.index === 3 && prevId !== p[5]))) { segments.push(segment); segment = []; }
      segment.push({ x, y: yf(p[sp.index]) }); prevX = x; prevId = p[5];
    }
    if (segment.length) segments.push(segment);
    ctx.save(); ctx.beginPath(); ctx.rect(left, ytop, plotW, ph); ctx.clip();
    const gradient = ctx.createLinearGradient(0, ytop, 0, ybottom);
    if (sp.fill === 'pressure') { gradient.addColorStop(0, '#90d27508'); gradient.addColorStop(0.52, '#b5d04c77'); gradient.addColorStop(0.87, '#ddda68db'); gradient.addColorStop(1, '#a8ce6c99'); }
    else if (sp.fill === 'flow') { gradient.addColorStop(0, '#84e6bd55'); gradient.addColorStop(0.45, '#6ae0c68c'); gradient.addColorStop(0.5, '#6fd5d747'); gradient.addColorStop(0.7, '#46c4dd88'); gradient.addColorStop(1, '#409de8aa'); }
    else { gradient.addColorStop(0, '#97d9ff36'); gradient.addColorStop(1, '#77cfeeab'); }
    for (const seg of segments) {
      if (seg.length < 2) continue;
      ctx.beginPath(); ctx.moveTo(seg[0]!.x, yf(0)); for (const p of seg) ctx.lineTo(p.x, p.y); ctx.lineTo(seg[seg.length - 1]!.x, yf(0)); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
      ctx.strokeStyle = sp.color; ctx.lineWidth = 1.55; ctx.lineJoin = 'round'; ctx.beginPath(); seg.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    }
    if (style === 'sweep' && !options.frozen) { const cursor = xfn(end); ctx.fillStyle = '#0555b4f0'; ctx.fillRect(cursor + 1, ytop, 8, ph); line(ctx, cursor, ytop, cursor, ybottom, '#c4f5ff88', 0.8); }
    if (typeof options.cursorTime === 'number' && Number.isFinite(options.cursorTime)) { const x = xfn(options.cursorTime); line(ctx, x, ytop, x, ybottom, '#ffffffd0', 0.8); }
    ctx.restore();
    if (i === specs.length - 1) for (let k = 0; k <= 3; k++) { const val = style === 'sweep' ? (k * win) / 3 : Math.max(0, end - win + (k * win) / 3); text(ctx, format(val, 0) + ' s', left + (k * plotW) / 3, h - 1, 8, '#77b5d4', k === 3 ? 'right' : k === 0 ? 'left' : 'center'); }
  });
  return { left, right, plotW, win };
}

/** Puntos del último ciclo completo ('last') o del ciclo en curso ('current'). */
export function cyclePoints(points: Point[], which: 'last' | 'current' = 'last'): Point[] {
  const ids = [...new Set(points.map((p) => p[5]).filter((v) => v > 0))];
  const id = which === 'current' ? ids[ids.length - 1] : ids[ids.length - 2];
  return id === undefined ? [] : points.filter((p) => p[5] === id);
}

export function drawLoop(canvas: HTMLCanvasElement, points: Point[], reference: Point[] | null, peep: number, vtMl: number, type: 'pv' | 'fv' = 'pv'): void {
  const { ctx, w, h } = context(canvas), current = cyclePoints(points, 'current'), prev = cyclePoints(points, 'last'), ref = reference ?? prev;
  const ranges = getBounds([...current, ...ref], peep, vtMl);
  const left = 55, right = 16, top = 49, bottom = h - 36, pw = w - left - right, ph = bottom - top;
  const xrange = type === 'pv' ? [0, ranges.pressure] : [0, ranges.volume], yrange = type === 'pv' ? [0, ranges.volume] : [-ranges.flow, ranges.flow];
  const xf = (x: number): number => left + ((x - xrange[0]!) / (xrange[1]! - xrange[0]!)) * pw, yf = (y: number): number => bottom - ((y - yrange[0]!) / (yrange[1]! - yrange[0]!)) * ph;
  text(ctx, type === 'pv' ? 'Presión · volumen' : 'Flujo · volumen', left, 23, 15, '#c4f0ff', 'left', '500');
  text(ctx, type === 'pv' ? 'mL' : 'L/min', left, top - 9, 10); text(ctx, type === 'pv' ? 'cmH₂O' : 'mL', w - right, h - 9, 10, '#93cdec', 'right');
  for (let k = 0; k <= 4; k++) { const x = xrange[0]! + ((xrange[1]! - xrange[0]!) * k) / 4, y = yrange[0]! + ((yrange[1]! - yrange[0]!) * k) / 4; line(ctx, xf(x), top, xf(x), bottom, '#66add957'); line(ctx, left, yf(y), w - right, yf(y), '#66add957'); text(ctx, format(x), xf(x), bottom + 17, 10, '#90cae6', 'center'); text(ctx, format(y), left - 8, yf(y) + 4, 10, '#90cae6', 'right'); }
  line(ctx, left, yf(0), w - right, yf(0), '#a8e6f799', 1); line(ctx, left, top, left, bottom, '#a8e6f799', 1);
  const path = (data: Point[], color: string, dashed: boolean): void => {
    ctx.save(); ctx.beginPath(); ctx.rect(left, top, pw, ph); ctx.clip(); ctx.strokeStyle = color; ctx.lineWidth = dashed ? 1.7 : 2.2; ctx.setLineDash(dashed ? [5, 4] : []); ctx.beginPath();
    data.forEach((p, i) => { const x = xf(type === 'pv' ? p[1] : p[3]), y = yf(type === 'pv' ? p[3] : p[2]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]);
    if (!dashed && data.length) { const p = data[data.length - 1]!; ctx.fillStyle = '#defdf3'; ctx.beginPath(); ctx.arc(xf(type === 'pv' ? p[1] : p[3]), yf(type === 'pv' ? p[3] : p[2]), 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  path(ref, reference ? '#edc87ecc' : '#9fbade77', true); path(current, '#9bf4de', false);
  line(ctx, w - 140, 20, w - 122, 20, '#9bf4de', 2); text(ctx, 'Actual', w - 116, 24, 10, '#a2e6df'); line(ctx, w - 140, 34, w - 122, 34, reference ? '#edc87ecc' : '#9fbade77', 1.5); text(ctx, reference ? 'Referencia' : 'Previo', w - 116, 38, 10, reference ? '#eed49d' : '#adc6e0');
}

export interface GaugeState { paw: number; pmax: number; ppeak: number | null; peep: number; standby: boolean; vteMl: number | null; fio2Pct: number | null }
export function drawGauge(canvas: HTMLCanvasElement, s: GaugeState): void {
  const { ctx, w } = context(canvas);
  const max = nice(Math.max(s.pmax, s.paw, s.ppeak ?? 0) * 1.15, [60, 80, 100, 120]), top = 58, bottom = 382, x = 47, bw = 43;
  const yf = (v: number): number => bottom - (clamp(v, 0, max) / max) * (bottom - top);
  text(ctx, 'Pva', x + bw / 2, 18, 12, '#a9e8ff', 'center'); text(ctx, format(s.standby ? null : s.paw, 0), x + bw / 2, 42, 25, '#e0feff', 'center', '600');
  ctx.fillStyle = '#041d42'; ctx.strokeStyle = '#88b3cd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x, top, bw, bottom - top + 12, [6, 6, 22, 22]); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.roundRect(x + 1, top + 1, bw - 2, bottom - top + 10, [5, 5, 20, 20]); ctx.clip();
  const fill = ctx.createLinearGradient(x, 0, x + bw, 0); fill.addColorStop(0, '#168da7'); fill.addColorStop(0.52, '#4eded5'); fill.addColorStop(1, '#1da8b7');
  const paw = s.standby ? 0 : s.paw; ctx.fillStyle = fill; ctx.fillRect(x + 1, yf(paw), bw - 2, bottom - yf(paw) + 13);
  ctx.restore();
  const tick = max / 3; for (let i = 0; i <= 3; i++) { const v = i * tick; line(ctx, x, yf(v), x + bw, yf(v), '#96d9e399', 1); text(ctx, format(v), x - 8, yf(v) + 4, 11, '#84d6f6', 'right'); }
  const marker = (value: number | null, label: string, color: string): void => { if (value === null || !Number.isFinite(value)) return; const y = yf(value); line(ctx, x - 2, y, x + bw + 2, y, color, 3); text(ctx, label, x + bw + 7, y + 3, 10, color); };
  marker(s.pmax, 'Pmáx', '#ff75a0'); marker(s.ppeak, 'Ppico', '#c9f9ff'); marker(s.peep, 'PEEP', '#81e1e1');
  text(ctx, 'VTesp', w / 2, 420, 10, '#9adaff', 'center'); text(ctx, format(s.standby ? null : s.vteMl, 0), w / 2, 449, 29, '#e0feff', 'center', '600'); text(ctx, `FiO₂ ${format(s.fio2Pct, 0)} %`, w / 2, 477, 12, '#ace9ff', 'center');
}

export function drawMuscle(canvas: HTMLCanvasElement, points: Point[], end: number): void {
  const { ctx, w, h } = context(canvas), recent = points.filter((p) => p[0] >= end - 10 && p[0] <= end), max = Math.max(10, ...recent.map((p) => p[4] * 1.3)), top = 14, bottom = h - 10;
  line(ctx, 0, bottom, w, bottom, '#6385a64a'); line(ctx, 0, (top + bottom) / 2, w, (top + bottom) / 2, '#6385a62a');
  if (!recent.length) return;
  ctx.beginPath(); recent.forEach((p, i) => { const x = ((p[0] - (end - 10)) / 10) * w, y = bottom - (p[4] / max) * (bottom - top); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.strokeStyle = '#b2a5ee'; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineTo(w, bottom); ctx.lineTo(0, bottom); ctx.closePath(); const g = ctx.createLinearGradient(0, top, 0, bottom); g.addColorStop(0, '#8e82d939'); g.addColorStop(1, '#8e82d904'); ctx.fillStyle = g; ctx.fill();
}

export function drawTrends(canvas: HTMLCanvasElement, points: TrendRow[], end: number): void {
  const { ctx, w, h } = context(canvas), span = Math.min(600, Math.max(60, end)), start = Math.max(0, end - span), visible = points.filter((x) => x.t >= start && x.t <= end);
  const specs = [
    { label: 'Presiones', unit: 'cmH₂O', keys: [['ppeak', '#cff7f4', 'Ppico'], ['peep', '#64d7c4', 'PEEPe']] as [keyof TrendRow, string, string][], max: nice(Math.max(30, ...visible.map((x) => x.ppeak ?? 0)) * 1.15, [40, 60, 80, 120]) },
    { label: 'Volumen espirado', unit: 'mL', keys: [['vte', '#abdfff', 'VTesp']] as [keyof TrendRow, string, string][], max: nice(Math.max(450, ...visible.map((x) => x.vte ?? 0)) * 1.15, [600, 800, 1000, 1500, 2500]) },
    { label: 'Frecuencia', unit: '/min', keys: [['rr', '#e8d397', 'FR']] as [keyof TrendRow, string, string][], max: nice(Math.max(30, ...visible.map((x) => x.rr ?? 0)) * 1.1, [40, 60, 90, 120]) },
  ];
  const row = h / 3, left = 66, right = 17, pw = w - left - right;
  specs.forEach((sp, i) => {
    const top = i * row + 28, bottom = (i + 1) * row - 19, ph = bottom - top, xf = (t: number): number => left + ((t - start) / span) * pw, yf = (v: number): number => bottom - (v / sp.max) * ph;
    text(ctx, sp.label, left, i * row + 16, 12, '#bce5fa'); text(ctx, sp.unit, left - 9, i * row + 16, 9, '#8dbddf', 'right');
    for (let k = 0; k <= 4; k++) { const y = yf((k * sp.max) / 4); line(ctx, left, y, w - right, y, '#78b8da3d'); text(ctx, format((k * sp.max) / 4), left - 8, y + 3, 9, '#8dc8e9', 'right'); const x = left + (k * pw) / 4; line(ctx, x, top, x, bottom, '#78b8da3d'); }
    sp.keys.forEach(([key, color, label], j) => { ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.beginPath(); let drawn = false; for (const p of visible) { const v = p[key] as number | null; if (v === null || !Number.isFinite(v)) { drawn = false; continue; } if (drawn) ctx.lineTo(xf(p.t), yf(v)); else ctx.moveTo(xf(p.t), yf(v)); drawn = true; } ctx.stroke(); text(ctx, label, w - right - j * 67, i * row + 16, 10, color, 'right'); });
    if (i === 2) for (let k = 0; k <= 4; k++) { const time = start + (k * span) / 4; text(ctx, `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`, left + (k * pw) / 4, h - 3, 9, '#81b9d9', k === 0 ? 'left' : k === 4 ? 'right' : 'center'); }
  });
}
