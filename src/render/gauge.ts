import { formatNumber as format } from '../domain/units';
import { MON, MON_CSS, PLOT_TEXT_COLORS } from './monitorPalette';
import { clamp, context, line, nice, text } from './canvas';

/** Barra de presión del equipo: tubo, escala, Pmáx, Ppico, PEEP y las cifras de VTesp y FiO₂. */

export interface GaugeState {
  paw: number;
  pmax: number;
  ppeak: number | null;
  peep: number;
  standby: boolean;
  vteMl: number | null;
  fio2Pct: number | null;
}

/**
 * Barra de presión como la del equipo (capturas del manual SW10, 3-12 a 3-14 y 8-8): «Pva» y su unidad arriba, un tubo
 * negro redondeado con relleno verde hasta la presión de ahora, marcas cian en la escala, Pmáx en rojo y Ppico y PEEP
 * en blanco; debajo, VTesp y FiO₂ en dos columnas con su unidad.
 */
export function drawGauge(canvas: HTMLCanvasElement, s: GaugeState): void {
  const { ctx, w } = context(canvas);
  const max = nice(Math.max(s.pmax, s.paw, s.ppeak ?? 0) * 1.15, [60, 80, 100, 120]),
    top = 58,
    bottom = 382,
    x = 47,
    bw = 43;
  const yf = (v: number): number => bottom - (clamp(v, 0, max) / max) * (bottom - top);
  // En espera el panel es tostado (URM SW10 3-6): el texto pasa a oscuro.
  const tinta = s.standby ? MON_CSS.tinta : MON_CSS.texto,
    tintaSuave = s.standby ? MON_CSS.tintaSuave : PLOT_TEXT_COLORS.tickCurvas;
  text(ctx, 'Pva', x + bw / 2, 20, 'sm', tinta, 'center', '700');
  text(ctx, 'cmH₂O', x + bw / 2, 37, '2xs', tintaSuave, 'center');
  // Tubo: negro con un brillo vertical, como un cilindro.
  const tubo = ctx.createLinearGradient(x, 0, x + bw, 0);
  tubo.addColorStop(0, MON.tubo[0]);
  tubo.addColorStop(0.45, MON.tubo[1]);
  tubo.addColorStop(1, MON.tubo[0]);
  ctx.fillStyle = tubo;
  ctx.strokeStyle = MON.tuboContorno;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, top - 10, bw, bottom - top + 22, [21, 21, 21, 21]);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 1, top - 9, bw - 2, bottom - top + 20, [20, 20, 20, 20]);
  ctx.clip();
  const fill = ctx.createLinearGradient(x, 0, x + bw, 0);
  fill.addColorStop(0, MON.tuboRelleno[0]);
  fill.addColorStop(0.5, MON.tuboRelleno[1]);
  fill.addColorStop(1, MON.tuboRelleno[0]);
  // En espera no hay presión que mostrar: el tubo queda vacío y sin marcas, como en el equipo (figura 3-4).
  if (!s.standby) {
    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, yf(s.paw), bw - 2, bottom - yf(s.paw) + 13);
  }
  ctx.restore();
  const tick = max / 3;
  for (let i = 0; i <= 3; i++) {
    const v = i * tick;
    line(ctx, x + 1, yf(v), x + bw - 1, yf(v), MON.tuboMarca, 1);
    text(ctx, format(v), x - 8, yf(v) + 4, 'sm', tinta, 'right', '700');
  }
  const marker = (value: number | null, label: string, color: string, dy = 3): void => {
    if (value === null || !Number.isFinite(value)) return;
    const y = yf(value);
    line(ctx, x + 1, y, x + bw - 1, y, color, 3);
    text(ctx, label, x + bw + 5, y + dy, 'xs', color, 'left', '700');
  };
  // Ppico junto a Pmáx: el rótulo baja para no pisar el de Pmáx, y la línea roja de Pmáx se dibuja encima.
  if (!s.standby) {
    marker(s.ppeak, 'Ppico', MON.marcaBlanca, s.ppeak !== null && Math.abs(s.ppeak - s.pmax) < max * 0.04 ? 15 : 3);
    marker(s.peep, 'PEEP', MON.marcaBlanca);
    marker(s.pmax, 'Pmáx', MON.pmax);
  }
  line(ctx, 8, 400, w - 8, 400, s.standby ? MON.separadorEspera : MON.separador, 1);
  // Resolución del equipo: VT en pasos de 0,1 mL bajo 50 mL y de 1 mL desde ahí (URM SW10 13-24).
  const vte = s.standby ? null : s.vteMl;
  const columna = (cx: number, rotulo: string, valor: string, unidad: string): void => {
    text(ctx, rotulo, cx, 420, 'sm', tinta, 'center', '700');
    text(ctx, valor, cx, 450, '2xl', tinta, 'center', '700');
    text(ctx, unidad, cx, 467, '2xs', tintaSuave, 'center');
  };
  columna(w * 0.3, 'VTesp', format(vte, vte !== null && Math.abs(vte) < 50 ? 1 : 0), 'mL');
  columna(w * 0.74, 'FiO₂', format(s.fio2Pct, 0), '%');
}
