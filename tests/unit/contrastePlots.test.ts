import { describe, expect, it } from 'vitest';
import { PLOT_BACKGROUND_LIGHTEST, PLOT_TEXT_COLORS } from '../../src/render/plotColors';

// El texto de ejes dibujado en canvas no lo cubre el contraste CSS de CTR-02: aquí se miden los literales centralizados
// en PLOT_TEXT_COLORS contra el extremo más claro del fondo del monitor. (Misma fórmula WCAG 2.1 que contraste.test.ts.)

function luminancia(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  const f = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contraste(a: string, b: string): number {
  const la = luminancia(a),
    lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor', () => {
  for (const [clave, color] of Object.entries(PLOT_TEXT_COLORS)) {
    it(`${clave} (${color}) ≥ 4,5:1 sobre ${PLOT_BACKGROUND_LIGHTEST}`, () => {
      expect(contraste(color, PLOT_BACKGROUND_LIGHTEST)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
