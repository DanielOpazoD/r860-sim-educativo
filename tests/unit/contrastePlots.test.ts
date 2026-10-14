import { describe, expect, it } from 'vitest';
import { AYUDA, EXTERIOR, MON, MON_CSS, PLOT_BACKGROUND_LIGHTEST, PLOT_TEXT_COLORS, SHELL_CSS } from '../../src/render/monitorPalette';

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

// CTR-09 · el esfuerzo muscular y su bucle viven en el panel blanco de «Datos del modelo», no en el monitor: con la
// paleta del monitor la curva Pva·V y su leyenda eran blancas sobre blanco (1:1) y los ejes daban 1,3:1.
describe('CTR-09 · los gráficos del panel claro contrastan sobre blanco', () => {
  for (const clave of ['trazo', 'eje', 'esfuerzo'] as const)
    it(`${clave} (${EXTERIOR[clave]}) ≥ 4,5:1 sobre ${SHELL_CSS.surface}`, () => {
      expect(contraste(EXTERIOR[clave], SHELL_CSS.surface)).toBeGreaterThanOrEqual(4.5);
    });
});

// CTR-10 · las líneas de las ayudas se ven: van con transparencia para no competir con la curva, pero un elemento gráfico
// necesario para entender lo que se muestra pide 3:1 contra lo que lo rodea (WCAG 2.2, 1.4.11). Se mide el color que de
// verdad queda —la línea mezclada con su opacidad sobre el fondo— en los dos tonos de la pizarra.
describe('CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra', () => {
  const hex = (h: string): number[] => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  const mezcla = (linea: string, fondo: string): string => {
    const a = linea.length === 9 ? Number.parseInt(linea.slice(7, 9), 16) / 255 : 1;
    const [f, b] = [hex(linea), hex(fondo)];
    return (
      '#' +
      f
        .map((c, i) =>
          Math.round(c * a + b[i]! * (1 - a))
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    );
  };
  const LINEAS: Record<string, string> = {
    PEEP: AYUDA.peepLinea,
    'VT (bucles)': AYUDA.vtLinea,
    Pmáx: AYUDA.pmaxLinea,
    ciclado: AYUDA.ciclado,
    'marcas de inicio y fin': AYUDA.marca,
    'referencia en la curva': AYUDA.referenciaCurva,
    'referencia en el bucle': AYUDA.referenciaBucle,
    'bucle previo': AYUDA.previo,
    'unión de las congeladas': AYUDA.union,
    'cursor A': AYUDA.cursor,
    'cursor de barrido': MON.cursorBarrido,
  };
  for (const fondo of [PLOT_BACKGROUND_LIGHTEST, MON_CSS.pantalla])
    for (const [nombre, linea] of Object.entries(LINEAS))
      it(`${nombre} (${linea}) sobre ${fondo}`, () => expect(contraste(mezcla(linea, fondo), fondo)).toBeGreaterThanOrEqual(3));
});
