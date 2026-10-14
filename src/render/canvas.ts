import { MON, MON_FS, PLOT_TEXT_COLORS, type PasoTipo } from './monitorPalette';

/** Primitivas de dibujo en canvas: montaje del lienzo a la densidad de la pantalla, líneas y texto en un paso de la escala. */

export const setups = new WeakMap<HTMLCanvasElement, { w: number; h: number; dpr: number; ctx: CanvasRenderingContext2D }>();

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

export const nice = (value: number, steps: number[]): number =>
  steps.find((x) => x >= value) ?? Math.ceil(value / (steps[steps.length - 1] as number)) * (steps[steps.length - 1] as number);

export function context(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const previo = setups.get(canvas);
  // La densidad cambia al llevar la ventana a otra pantalla (o con el zoom del navegador): el lienzo se rehace a la nueva,
  // o la curva queda borrosa o se dibuja a otra escala. El tamaño lógico es el del primer montaje: el atributo `width`
  // ya refleja el lienzo multiplicado.
  if (!previo || previo.dpr !== dpr) {
    const w = previo?.w ?? Number(canvas.getAttribute('width')),
      h = previo?.h ?? Number(canvas.getAttribute('height'));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    setups.set(canvas, { w, h, dpr, ctx: previo?.ctx ?? (canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D) });
  }
  const o = setups.get(canvas)!;
  o.ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  o.ctx.clearRect(0, 0, o.w, o.h);
  return o;
}

export function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string = MON.lineaPorOmision,
  width = 0.6,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  paso: PasoTipo = 'xs',
  color: string = PLOT_TEXT_COLORS.tickCurvas,
  align: CanvasTextAlign = 'left',
  weight = 'normal',
): void {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.font = `${weight} ${MON_FS[paso]}px Arial,sans-serif`;
  ctx.fillText(s, x, y);
}

/**
 * Ancho lógico de un lienzo de curvas. No se puede leer del atributo `width`: al preparar el lienzo se reescribe con el
 * ancho en píxeles de dispositivo (608 × 2 en una pantalla de alta densidad), y el puntero convertía con el doble de
 * ancho: el cursor caía unos 0,2 s más allá en el centro de la ventana en cualquier Retina o teléfono.
 */
export function canvasLogicalWidth(canvas: HTMLCanvasElement): number {
  return setups.get(canvas)?.w ?? Number(canvas.getAttribute('width'));
}
