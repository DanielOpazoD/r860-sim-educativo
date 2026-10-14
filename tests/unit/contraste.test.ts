import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { alarmBandLabel } from '../../src/ui/humanize';

// Los tonos de la banda de alarmas y de las cifras pequeñas de la columna numérica están calculados, no elegidos a ojo.
// Estas pruebas leen los literales de las parciales de styles.css y miden el contraste WCAG 2.1 en los DOS extremos de
// cada degradado: si alguien retoca un color y baja de 4,5:1 (texto normal, AA), la integración lo dice.

const dirStyles = new URL('../../src/ui/styles/', import.meta.url);
const css = readdirSync(dirStyles)
  .filter((f) => f.endsWith('.css'))
  .sort()
  .map((f) => readFileSync(new URL(f, dirStyles), 'utf8'))
  .join('\n');

function luminancia(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  const f = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contraste(a: string, b: string): number {
  const la = luminancia(a),
    lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Bloque de reglas de un selector exacto (`.alarm-band.high {…}`), sin sus variantes. */
function bloque(selector: string): string {
  const re = new RegExp(`(?:^|\\n)${selector.replace(/[.\\]/g, '\\$&')} \\{([^}]*)\\}`);
  const m = re.exec(css);
  if (!m) throw new Error(`sin bloque para ${selector}`);
  return m[1] as string;
}
// «border-color:» también contiene «color:»: sólo vale la propiedad que empieza la declaración.
const color = (selector: string): string => /(?<![-\w])color: (#[0-9a-f]{6})/.exec(bloque(selector))![1] as string;
const degradado = (selector: string): string[] => [...bloque(selector).matchAll(/#[0-9a-f]{6}/g)].map((m) => m[0]).slice(0, 2);
/** Extremo más claro del azul pizarra de la pantalla (capturas del manual SW10): el caso peor para el texto claro. */
const FONDO_MONITOR = '#3b4f68';
const AA = 4.5;

describe('CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado', () => {
  for (const estado of ['.alarm-band', '.alarm-band.high', '.alarm-band.medium', '.alarm-band.previous']) {
    it(`${estado}: texto ≥ ${AA}:1 sobre ambos extremos`, () => {
      const texto = color(estado);
      const fondos = degradado(estado).filter((h) => h !== texto);
      expect(fondos, 'dos extremos de degradado').toHaveLength(2);
      for (const fondo of fondos) expect(contraste(texto, fondo), `${texto} sobre ${fondo}`).toBeGreaterThanOrEqual(AA);
    });
  }
  it('el subtítulo de la banda no lleva opacidad: hereda el color medido', () => {
    expect(bloque('.alarm-message small')).not.toMatch(/opacity/);
  });
  it('sin alarmas la banda es verde, como en las pantallas del manual SW10 y en la fotografía P1', () => {
    for (const fondo of degradado('.alarm-band')) {
      const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(fondo.slice(1 + i, 3 + i), 16)) as [number, number, number];
      expect(g, fondo).toBeGreaterThan(r + 60);
      expect(g, fondo).toBeGreaterThan(b + 40);
    }
  });
  it('la prioridad media es ámbar con texto oscuro, como la celda que alarma', () => {
    expect(luminancia(color('.alarm-band.medium'))).toBeLessThan(0.1);
  });
});

describe('CTR-02 · las cifras pequeñas de la columna numérica contrastan sobre el fondo del monitor', () => {
  for (const [selector, minimo] of [
    ['.numeric .numeric-age', 6],
    ['.numeric-label', 6],
    ['.numeric-unit', 6],
    ['.numeric .numeric-value .sin-dato', 6],
  ] as const) {
    it(`${selector} ≥ ${minimo}:1`, () => {
      // Texto de 8–9 px: se exige más que el mínimo AA porque el tamaño ya castiga la lectura.
      expect(contraste(color(selector), FONDO_MONITOR)).toBeGreaterThanOrEqual(minimo);
    });
  }
});

describe('CTR-03 · la prioridad va en palabras y la luz roja parpadea salvo con «reducir movimiento»', () => {
  it('alarmBandLabel antepone la prioridad y respeta los estados sin alarma', () => {
    expect(alarmBandLabel({ color: 'green', message: 'Sin alarmas' })).toBe('Sin alarmas');
    expect(alarmBandLabel({ color: 'grey', message: 'Alarma previa: reconocer (P)' })).toBe('Alarmas resueltas');
    expect(alarmBandLabel({ color: 'red', message: 'Pmáx alcanzada (Ppico alta) (P)' })).toBe(
      'Prioridad alta · Pmáx alcanzada (Ppico alta)',
    );
    expect(alarmBandLabel({ color: 'yellow', message: 'VTesp bajo' })).toBe('Prioridad media · VTesp bajo');
    expect(alarmBandLabel({ color: 'blue', message: 'FiO₂ alta' })).toBe('Prioridad informativa · FiO₂ alta');
  });
  it('la luz del bisel de prioridad alta lleva animación, y la regla de reducir movimiento la anula', () => {
    expect(bloque('.bezel-light.high')).toMatch(/animation: bezel-blink/);
    expect(css).toMatch(/@keyframes bezel-blink/);
    // Media también intermitente y baja fija (URM SW10 8-6); la pausa de audio pinta de azul la mitad izquierda.
    expect(bloque('.bezel-light.medium')).toMatch(/animation: bezel-blink-medium/);
    expect(bloque('.bezel-light.low')).not.toMatch(/animation/);
    expect(bloque('.bezel-light.pausa::before')).toMatch(/inset: 0 50% 0 0/);
    const reducido = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css);
    expect(reducido, 'regla de reducir movimiento').not.toBeNull();
    expect(reducido![1]).toMatch(/animation: none !important/);
  });
});

describe('CTR-04 · los chips de estado y la procedencia son legibles sobre el monitor', () => {
  for (const selector of ['.q-ok', '.q-warn'] as const) {
    it(`${selector}: texto ≥ ${AA}:1 sobre su fondo`, () => {
      const fondo = /(?<![-\w])background: (#[0-9a-f]{6})/i.exec(bloque(selector))![1] as string;
      expect(contraste(color(selector), fondo)).toBeGreaterThanOrEqual(AA);
    });
  }
  for (const selector of ['.q-off', '.q-src'] as const) {
    it(`${selector}: texto ≥ ${AA}:1 sobre el fondo del monitor`, () => {
      expect(contraste(color(selector), FONDO_MONITOR)).toBeGreaterThanOrEqual(AA);
    });
  }
});

// CTR-05 · la cara del equipo: los colores medidos en las capturas del manual SW10 (3-12 a 3-14 y 8-8), no el azul
// saturado de antes. Pantalla azul pizarra, teclas de grafito y valor en alarma con un borde del color de la prioridad.
describe('CTR-05 · los colores del equipo', () => {
  const rgb = (hex: string): [number, number, number] =>
    [0, 2, 4].map((i) => Number.parseInt(hex.slice(1 + i, 3 + i), 16)) as [number, number, number];
  it('la pantalla es azul pizarra: azul dominante pero poco saturado, y su extremo claro es el que miden los contrastes', () => {
    const fondo = /\n\s*background: ([^;]+);/.exec(bloque('.monitor'))![1] as string;
    const tonos = [...fondo.matchAll(/#[0-9a-f]{6}/g)].map((m) => m[0]);
    expect(tonos.length).toBeGreaterThanOrEqual(3);
    expect(tonos[0]).toBe(FONDO_MONITOR);
    for (const t of tonos) {
      const [r, g, b] = rgb(t);
      expect(b, t).toBeGreaterThan(g);
      expect(g, t).toBeGreaterThan(r);
      expect(b - r, t).toBeLessThan(70);
    }
  });
  it('las teclas son de grafito: gris neutro, con rótulo blanco', () => {
    for (const t of degradado('.device-key')) {
      const [r, , b] = rgb(t);
      expect(Math.abs(b - r), t).toBeLessThan(25);
      expect(contraste('#ffffff', t), t).toBeGreaterThanOrEqual(AA);
    }
    expect(color('.device-key')).toBe('#ffffff');
  });
  it('el valor en alarma lleva un borde de la prioridad que se distingue del fondo (≥ 3:1) y la cifra sigue blanca', () => {
    const ambar = /outline: 2px solid (#[0-9a-f]{6})/.exec(bloque('.numeric.alarm-value'))![1] as string;
    const rojo = /outline-color: (#[0-9a-f]{6})/.exec(bloque('.numeric.alarm-value.alarm-high'))![1] as string;
    for (const borde of [ambar, rojo]) expect(contraste(borde, FONDO_MONITOR), borde).toBeGreaterThanOrEqual(3);
    expect(bloque('.numeric.alarm-value')).not.toMatch(/(?<![-\w])color:/);
  });
});
