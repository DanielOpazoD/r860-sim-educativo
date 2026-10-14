import { formatNumber as format } from '../domain/units';
import { alfa, AYUDA, MON, MON_CSS, PLOT_TEXT_COLORS } from './monitorPalette';
import { context, line, text } from './canvas';
import { cyclePoints, type Point } from './signal';
import { getBounds } from './waves';

/** Bucles presión-volumen y flujo-volumen con flechas de sentido y el ciclo previo o de referencia. */

/** Índices de las tres flechas de sentido del bucle (20 %, 50 % y 80 % del ciclo); vacío con menos de 8 muestras. */
export function arrowIndices(n: number): number[] {
  return n >= 8 ? [Math.floor(n * 0.2), Math.floor(n * 0.5), Math.floor(n * 0.8)] : [];
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
  text(ctx, type === 'pv' ? 'Presión · volumen' : 'Flujo · volumen', left, 23, 'lg', MON_CSS.texto, 'left', '700');
  text(ctx, type === 'pv' ? 'mL' : 'L/min', left, top - 9, '2xs', PLOT_TEXT_COLORS.tickBucles);
  text(ctx, type === 'pv' ? 'cmH₂O' : 'mL', w - right, h - 9, '2xs', PLOT_TEXT_COLORS.tickBucles, 'right');
  for (let k = 0; k <= 4; k++) {
    const x = xrange[0]! + ((xrange[1]! - xrange[0]!) * k) / 4,
      y = yrange[0]! + ((yrange[1]! - yrange[0]!) * k) / 4;
    line(ctx, xf(x), top, xf(x), bottom, MON.rejilla);
    line(ctx, left, yf(y), w - right, yf(y), MON.rejilla);
    text(ctx, format(x), xf(x), bottom + 17, 'xs', PLOT_TEXT_COLORS.tickBucles, 'center');
    text(ctx, format(y), left - 8, yf(y) + 4, 'xs', PLOT_TEXT_COLORS.tickBucles, 'right');
  }
  line(ctx, left, yf(0), w - right, yf(0), MON.cero, 1);
  line(ctx, left, top, left, bottom, MON.cero, 1);
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
    // El bucle flujo-volumen del equipo va relleno de verde, como la curva de flujo (capturas del manual SW10).
    if (!dashed && type === 'fv' && data.length > 2) {
      ctx.closePath();
      ctx.fillStyle = MON.bucleFlujoVolumen;
      ctx.fill();
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (!dashed && data.length) {
      const p = data[data.length - 1]!;
      ctx.fillStyle = MON_CSS.texto;
      ctx.beginPath();
      ctx.arc(xf(type === 'pv' ? p[1] : p[3]), yf(type === 'pv' ? p[3] : p[2]), 3, 0, Math.PI * 2);
      ctx.fill();
      // Marcas pedagógicas: inicio de inspiración (círculo hueco) y flechas del sentido del ciclo.
      const p0 = data[0]!;
      ctx.strokeStyle = MON_CSS.texto;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(xf(type === 'pv' ? p0[1] : p0[3]), yf(type === 'pv' ? p0[3] : p0[2]), 3.5, 0, Math.PI * 2);
      ctx.stroke();
      const px = (i: number): { x: number; y: number } => {
        const m = data[Math.max(0, Math.min(data.length - 1, i))]!;
        return { x: xf(type === 'pv' ? m[1] : m[3]), y: yf(type === 'pv' ? m[3] : m[2]) };
      };
      ctx.fillStyle = MON_CSS.texto;
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
    line(ctx, xf(peep), top, xf(peep), bottom, alfa(AYUDA.peep, '99'), 0.9);
    ctx.restore();
    line(ctx, xf(peep), bottom, xf(peep), bottom + 5, AYUDA.peep, 1);
    text(ctx, 'PEEP', xf(peep) + 3, top + 10, '2xs', PLOT_TEXT_COLORS.lineaPeep, 'left');
  }
  // La VT sólo es consigna en VC; en PC/PS es resultado, no ajuste.
  if (options.vtMark && vtMl > 0 && type === 'pv' && vtMl > yrange[0]! && vtMl < yrange[1]!) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    line(ctx, left, yf(vtMl), w - right, yf(vtMl), alfa(AYUDA.vt, '99'), 0.9);
    ctx.restore();
    text(ctx, 'VT', w - right - 2, yf(vtMl) - 2, '2xs', PLOT_TEXT_COLORS.lineaVt, 'right');
  }
  if (options.vtMark && vtMl > 0 && type === 'fv' && vtMl > xrange[0]! && vtMl < xrange[1]!) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    line(ctx, xf(vtMl), top, xf(vtMl), bottom, alfa(AYUDA.vt, '99'), 0.9);
    ctx.restore();
    text(ctx, 'VT', xf(vtMl) + 3, top + 10, '2xs', PLOT_TEXT_COLORS.lineaVt, 'left');
  }
  path(ref, reference ? alfa(AYUDA.referencia, 'cc') : AYUDA.previo, true);
  path(current, MON_CSS.texto, false);
  line(ctx, w - 140, 20, w - 122, 20, MON_CSS.texto, 2);
  text(ctx, 'Actual', w - 116, 24, '2xs', MON_CSS.texto);
  line(ctx, w - 140, 34, w - 122, 34, reference ? alfa(AYUDA.referencia, 'cc') : AYUDA.previo, 1.5);
  text(ctx, reference ? 'Referencia' : 'Previo', w - 116, 38, '2xs', reference ? PLOT_TEXT_COLORS.referencia : PLOT_TEXT_COLORS.tickBucles);
}
