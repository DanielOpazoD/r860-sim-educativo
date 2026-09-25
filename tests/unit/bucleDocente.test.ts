import { describe, it, expect } from 'vitest';
import { drawMuscleLoop, type Point } from '../../src/render/plots';

// BLD · bucle Pva–V docente con presión total (Pva+Pmus)–V. El canvas se falsifica grabando las llamadas:
// no hay DOM real en vitest, así que el mock sólo necesita la API que usa el dibujo.
// plots.ts lee window.devicePixelRatio al configurar el canvas.
(globalThis as { window?: unknown }).window ??= { devicePixelRatio: 1 };

function canvasFalsa() {
  const textos: string[] = [];
  const ctx = new Proxy(
    { fillText: (t: string) => textos.push(String(t)), canvas: null },
    {
      get(target, prop) {
        if (prop in target) return (target as Record<string, unknown>)[prop as string];
        return () => undefined;
      },
      set() {
        return true;
      },
    },
  );
  const el = {
    getAttribute: (a: string) => (a === 'width' ? '280' : '170'),
    setAttribute: () => undefined,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  return { el, textos };
}

/** Un ciclo sencillo de ~50 muestras: Pva triangular desde `pvaBase`, volumen senoidal, Pmus constante. */
const ciclo = (pmus: number, pvaBase = 5): Point[] =>
  Array.from({ length: 50 }, (_, i) => {
    const f = i / 49;
    return [f * 4, pvaBase + 15 * f, f < 0.4 ? 30 : -20, 250 + 250 * Math.sin(Math.PI * f), pmus, 1];
  });

describe('BLD · bucle docente con presión muscular', () => {
  it('con Pmus ≈ 0 sólo dibuja Pva y anota que coincide con la presión total', () => {
    const { el, textos } = canvasFalsa();
    drawMuscleLoop(el, ciclo(0));
    expect(textos.some((t) => t.includes('Sin esfuerzo'))).toBe(true);
  });

  it('con Pmus negativa el eje X incluye el cero con margen negativo', () => {
    const { el, textos } = canvasFalsa();
    drawMuscleLoop(el, ciclo(-5, 4)); // Pva 4 + Pmus −5 → presión total negativa en el ciclo
    const tickMin = Math.min(...textos.filter((t) => /^-?\d/.test(t.trim())).map((t) => parseFloat(t.replace(',', '.'))));
    expect(tickMin).toBeLessThan(0);
    expect(textos.some((t) => t.includes('presión total'))).toBe(true);
  });

  it('no lanza con una traza vacía', () => {
    const { el } = canvasFalsa();
    expect(() => drawMuscleLoop(el, [])).not.toThrow();
  });
});
