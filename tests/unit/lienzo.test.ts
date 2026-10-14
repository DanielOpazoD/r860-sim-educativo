import { describe, expect, it } from 'vitest';
import { canvasLogicalWidth, drawMuscleLoop } from '../../src/render/plots';

// LIE-01 · el lienzo sigue la densidad de la pantalla. Al llevar la ventana a otra pantalla (o con el zoom del
// navegador) cambia devicePixelRatio; el lienzo se montaba una sola vez y quedaba con la densidad de la primera: curvas
// borrosas o a otra escala. El lienzo falso imita al real: su atributo `width` refleja el tamaño multiplicado.
const ventana = ((globalThis as { window?: { devicePixelRatio: number } }).window ??= { devicePixelRatio: 1 });

function lienzo(ancho: number, alto: number) {
  const ctx = new Proxy(
    { canvas: null },
    { get: (t, p) => (p in t ? (t as Record<string, unknown>)[p as string] : () => undefined), set: () => true },
  );
  const attrs: Record<string, string> = { width: String(ancho), height: String(alto) };
  const el = {
    getAttribute: (a: string) => attrs[a] ?? null,
    get width() {
      return Number(attrs.width);
    },
    set width(v: number) {
      attrs.width = String(v);
    },
    get height() {
      return Number(attrs.height);
    },
    set height(v: number) {
      attrs.height = String(v);
    },
    getContext: () => ctx,
  };
  return el as unknown as HTMLCanvasElement;
}

describe('LIE-01 · el lienzo se rehace cuando cambia la densidad de la pantalla', () => {
  it('pasa de 1× a 2× y vuelve, sin perder su tamaño lógico', () => {
    const c = lienzo(280, 170);
    ventana.devicePixelRatio = 1;
    drawMuscleLoop(c, []);
    expect([c.width, c.height]).toEqual([280, 170]);
    ventana.devicePixelRatio = 2;
    drawMuscleLoop(c, []);
    expect([c.width, c.height]).toEqual([560, 340]);
    expect(canvasLogicalWidth(c)).toBe(280);
    ventana.devicePixelRatio = 1;
    drawMuscleLoop(c, []);
    expect([c.width, c.height]).toEqual([280, 170]);
  });

  it('por encima de 2× se queda en 2× (el coste de pintar crece con el cuadrado)', () => {
    const c = lienzo(100, 50);
    ventana.devicePixelRatio = 3;
    drawMuscleLoop(c, []);
    expect(c.width).toBe(200);
    ventana.devicePixelRatio = 1;
  });
});
