import { formatNumber as format } from '../domain/units';
import { AYUDA, MON, MON_CSS, PLOT_TEXT_COLORS } from './monitorPalette';
import { context, line, nice, text } from './canvas';
import { type TrendRow } from './signal';

/** Tendencias de un punto por ciclo: presiones, volumen espirado y frecuencia. */

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
        ['ppeak', MON_CSS.texto, 'Ppico'],
        ['peep', AYUDA.tendenciaPeep, 'PEEPe'],
      ] as [keyof TrendRow, string, string][],
      max: nice(Math.max(30, ...visible.map((x) => x.ppeak ?? 0)) * 1.15, [40, 60, 80, 120]),
    },
    {
      label: 'Volumen espirado',
      unit: 'mL',
      keys: [['vte', MON_CSS.textoSuave, 'VTesp']] as [keyof TrendRow, string, string][],
      max: nice(Math.max(450, ...visible.map((x) => x.vte ?? 0)) * 1.15, [600, 800, 1000, 1500, 2500]),
    },
    {
      label: 'Frecuencia',
      unit: '/min',
      keys: [['rr', AYUDA.tendenciaFr, 'FR']] as [keyof TrendRow, string, string][],
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
    text(ctx, sp.label, left, i * row + 16, 'sm', MON_CSS.texto, 'left', '700');
    text(ctx, sp.unit, left - 9, i * row + 16, '2xs', PLOT_TEXT_COLORS.tickTendencias, 'right');
    for (let k = 0; k <= 4; k++) {
      const y = yf((k * sp.max) / 4);
      line(ctx, left, y, w - right, y, MON.rejillaSuave);
      text(ctx, format((k * sp.max) / 4), left - 8, y + 3, 'xs', PLOT_TEXT_COLORS.tickTendencias, 'right');
      const x = left + (k * pw) / 4;
      line(ctx, x, top, x, bottom, MON.rejillaSuave);
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
      text(ctx, label, w - right - j * 67, i * row + 16, '2xs', color, 'right');
    });
    if (i === 2)
      for (let k = 0; k <= 4; k++) {
        const time = start + (k * span) / 4;
        text(
          ctx,
          `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`,
          left + (k * pw) / 4,
          h - 3,
          'xs',
          PLOT_TEXT_COLORS.tickTendencias,
          k === 0 ? 'left' : k === 4 ? 'right' : 'center',
        );
      }
  });
}
