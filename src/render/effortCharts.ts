import { formatNumber as format } from '../domain/units';
import { EXTERIOR } from './monitorPalette';
import { context, line, nice, text } from './canvas';
import { cyclePoints, type Point } from './signal';

/** Gráficos del esfuerzo del paciente, en el panel claro de «Datos del modelo»: presión muscular y bucle docente. */

/** Presión muscular de los últimos 10 s, en el panel claro de «Datos del modelo»: paleta EXTERIOR, no la del monitor. */
export function drawMuscle(canvas: HTMLCanvasElement, points: Point[], end: number): void {
  const { ctx, w, h } = context(canvas),
    recent = points.filter((p) => p[0] >= end - 10 && p[0] <= end),
    top = 14,
    bottom = h - 10,
    // La espiración activa lleva Pmus a valores negativos: eje simétrico con línea de cero explícita.
    hi = Math.max(10, ...recent.map((p) => p[4] * 1.3)),
    lo = Math.min(0, ...recent.map((p) => p[4] * 1.3)),
    y = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  line(ctx, 0, bottom, w, bottom, EXTERIOR.rejilla);
  line(ctx, 0, lo < 0 ? y(0) : (top + bottom) / 2, w, lo < 0 ? y(0) : (top + bottom) / 2, EXTERIOR.cero);
  if (!recent.length) return;
  ctx.beginPath();
  recent.forEach((p, i) => {
    const x = ((p[0] - (end - 10)) / 10) * w,
      yy = y(p[4]);
    if (i) ctx.lineTo(x, yy);
    else ctx.moveTo(x, yy);
  });
  ctx.strokeStyle = EXTERIOR.esfuerzo;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineTo(w, bottom);
  ctx.lineTo(0, bottom);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, EXTERIOR.esfuerzoRelleno[0]);
  g.addColorStop(1, EXTERIOR.esfuerzoRelleno[1]);
  ctx.fillStyle = g;
  ctx.fill();
}

/**
 * Bucle docente (no va al monitor; se dibuja sobre el panel claro, con la paleta EXTERIOR): Pva·V del ciclo y, superpuesta, la presión total (Pva+Pmus)·V — la presión que
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
  text(ctx, 'Pva · V', left, top - 9, '2xs', EXTERIOR.trazo, 'left');
  text(ctx, '(Pva+Pmus) · V = presión total', left + 58, top - 9, '2xs', EXTERIOR.esfuerzo, 'left');
  for (let k = 0; k <= 3; k++) {
    const x = xrange[0]! + ((xrange[1]! - xrange[0]!) * k) / 3,
      y = yrange[0]! + ((yrange[1]! - yrange[0]!) * k) / 3;
    line(ctx, xf(x), top, xf(x), bottom, EXTERIOR.rejilla);
    line(ctx, left, yf(y), w - right, yf(y), EXTERIOR.rejilla);
    text(ctx, format(x), xf(x), bottom + 12, '2xs', EXTERIOR.eje, 'center');
    text(ctx, format(y), left - 5, yf(y) + 3, '2xs', EXTERIOR.eje, 'right');
  }
  if (xrange[0]! < 0) line(ctx, xf(0), top, xf(0), bottom, EXTERIOR.cero, 1);
  if (yrange[0]! < 0) line(ctx, left, yf(0), w - right, yf(0), EXTERIOR.cero, 1);
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
    path(actual, (p) => p[1], EXTERIOR.trazo, 0.45);
    if (esfActual) path(actual, (p) => p[1] + p[4], EXTERIOR.esfuerzo, 0.45);
  }
  path(base, (p) => p[1], EXTERIOR.trazo, 1);
  if (esfBase) path(base, (p) => p[1] + p[4], EXTERIOR.esfuerzo, 1);
  if (!esfBase && !esfActual) text(ctx, 'Sin esfuerzo: Pva = presión total', (left + w - right) / 2, h - 6, '2xs', EXTERIOR.eje, 'center');
}
