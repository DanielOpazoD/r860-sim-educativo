import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MON_CSS } from '../../src/render/monitorPalette';
import { alarmBandLabel } from '../../src/ui/humanize';

// Los tonos de la banda de alarmas y de las cifras pequeñas de la columna numérica están calculados, no elegidos a ojo.
// Estas pruebas leen los literales de las parciales de styles.css y miden el contraste WCAG 2.1 en los DOS extremos de
// cada degradado: si alguien retoca un color y baja de 4,5:1 (texto normal, AA), la integración lo dice.

const dirStyles = new URL('../../src/ui/styles/', import.meta.url);
const fuente = readdirSync(dirStyles)
  .filter((f) => f.endsWith('.css'))
  .sort()
  .map((f) => readFileSync(new URL(f, dirStyles), 'utf8'))
  .join('\n');
/** Paleta del monitor (`--mon-*` en 01-base.css): se sustituye por su valor para medir el color que de verdad se pinta. */
export const PALETA = Object.fromEntries([...fuente.matchAll(/(--mon-[\w-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1]!, m[2]!]));
const css = fuente.replace(/var\((--mon-[\w-]+)\)/g, (todo, token: string) => PALETA[token] ?? todo);

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
  it('en espera: panel y tecla tostados del equipo (#e7dab8) con texto oscuro legible, y el botón de iniciar naranja', () => {
    const TOSTADO = '#e7dab8';
    expect(bloque('.standby-overlay')).toMatch(/background: #e7dab8/);
    expect(bloque('.quick-key.active-standby')).toMatch(/background: #e7dab8/);
    for (const sel of ['.standby-overlay', '.standby-overlay p', '.standby-overlay small', '.quick-key.active-standby'])
      expect(contraste(color(sel), TOSTADO), sel).toBeGreaterThanOrEqual(AA);
    for (const f of degradado('.standby-overlay .primary-button'))
      expect(contraste(color('.standby-overlay .primary-button'), f), f).toBeGreaterThanOrEqual(AA);
  });
  it('las ventanas del equipo son de grafito, como la configuración de alarmas del manual, con texto legible', () => {
    const tokens = bloque('.app-dialog.device-dialog');
    const tono = (t: string): string => new RegExp(`--shell-${t}: (#[0-9a-f]{6})`).exec(tokens)![1] as string;
    for (const t of ['surface', 'raised', 'hover', 'line']) {
      const [r, , b] = rgb(tono(t));
      expect(Math.abs(b - r), t).toBeLessThan(25);
    }
    for (const t of ['text', 'muted', 'dim'])
      for (const f of ['surface', 'raised']) expect(contraste(tono(t), tono(f)), `${t} sobre ${f}`).toBeGreaterThanOrEqual(AA);
  });
  it('la X roja de una medición de bloqueo sin resultado se lee sobre la ventana (texto grande, ≥ 3:1)', () => {
    const fondos = degradado('.hold-panel');
    expect(fondos).toHaveLength(2);
    for (const f of fondos) expect(contraste(color('.hold-result > b.hold-x'), f), f).toBeGreaterThanOrEqual(3);
  });
});

// CTR-06 · la paleta del monitor vive en un solo sitio: sus colores no se vuelven a escribir a mano en las hojas del
// monitor (02-vistas, 09-instrument y la parte del monitor de 01-base), sino que se usan por su nombre; y lo que se pinta
// en canvas (curvas, barra de presión, captura exportada) toma los mismos valores de src/render/monitorPalette.ts.
describe('CTR-06 · la paleta del monitor, en un solo sitio', () => {
  it('declara la paleta medida y ninguna hoja del monitor repite sus colores como literal', () => {
    expect(Object.keys(PALETA).length).toBeGreaterThanOrEqual(30);
    const leer = (f: string): string => readFileSync(new URL(f, dirStyles), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const base = leer('01-base.css');
    const monitor = base.slice(base.indexOf('.bezel-top {'), base.indexOf('.bezel-bottom {'));
    const hojas: [string, string][] = [
      ['01-base.css (monitor)', monitor],
      ['02-vistas.css', leer('02-vistas.css')],
      ['09-instrument.css', leer('09-instrument.css')],
    ];
    for (const [token, valor] of Object.entries(PALETA)) {
      if (valor === '#ffffff') continue; // el blanco también es fondo de opciones elegidas: no es sólo texto
      for (const [nombre, texto] of hojas)
        expect(new RegExp(`${valor}(?![0-9a-f])`, 'i').test(texto), `${nombre} escribe ${valor} en vez de var(${token})`).toBe(false);
    }
  });

  it('el canvas usa los mismos valores que la hoja (MON_CSS ↔ --mon-*)', () => {
    for (const [clave, valor] of Object.entries(MON_CSS)) {
      const token = `--mon-${clave.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`)}`;
      expect(PALETA[token], `${clave} → ${token}`).toBe(valor);
    }
  });

  it('las curvas y la captura exportada no escriben colores a mano: todos vienen de monitorPalette.ts', () => {
    for (const f of ['../../src/render/plots.ts', '../../src/ui/exports.ts'])
      expect(readFileSync(new URL(f, import.meta.url), 'utf8').match(/#[0-9a-f]{6}/gi), f).toBeNull();
  });
});

// CTR-07 · el foco de teclado del equipo se ve en todas sus superficies. Es un indicador no textual: WCAG 2.2 (1.4.11)
// pide 3:1 contra lo que lo rodea. Amarillo sobre pizarra, grafito, ventanas, editor, fila de vistas, bisel y las bandas
// verde, roja y gris; oscuro sobre el ámbar de la banda media y el tostado de la espera (09-instrument.css).
describe('CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece', () => {
  const NO_TEXTO = 3;
  const p = (t: string): string => PALETA[`--mon-${t}`]!;
  /** Bisel del equipo (08-minimal, @media ≥ 701 px): no es de la paleta del monitor. */
  const BISEL = ['#3a4047', '#23282d'];
  it('el bisel sigue siendo el que se mide aquí', () => {
    expect(fuente).toContain(`linear-gradient(160deg, ${BISEL[0]}, ${BISEL[1]})`);
  });
  const claros = [
    'pantalla-claro',
    'pantalla',
    'pantalla-borde',
    'grafito-alto',
    'grafito-bajo',
    'ventana',
    'ventana-barra',
    'bloqueo-alto',
    'bloqueo-bajo',
    'nav-alto',
    'nav-bajo',
    'reposo-alto',
    'reposo-bajo',
    'banda-alta-a',
    'banda-alta-b',
    'banda-previa-a',
    'banda-previa-b',
  ];
  for (const fondo of claros)
    it(`amarillo sobre --mon-${fondo}`, () => expect(contraste(p('foco'), p(fondo))).toBeGreaterThanOrEqual(NO_TEXTO));
  for (const fondo of BISEL)
    it(`amarillo sobre el bisel ${fondo}`, () => expect(contraste(p('foco'), fondo)).toBeGreaterThanOrEqual(NO_TEXTO));
  it('oscuro sobre el ámbar de la banda media y el tostado de la espera', () => {
    for (const fondo of ['banda-media-a', 'banda-media-b']) expect(contraste(p('media-texto'), p(fondo))).toBeGreaterThanOrEqual(NO_TEXTO);
    expect(contraste(p('tinta'), p('tostado'))).toBeGreaterThanOrEqual(NO_TEXTO);
  });
  it('el anillo de las hojas del equipo es éste y no otro', () => {
    expect(css).toMatch(
      /:is\(\.device-shell, \.device-dialog\) :is\(button, a, summary, input, select\):focus-visible \{\s*outline: 2px solid #ffdf75;/,
    );
    expect(fuente).not.toMatch(/\.device-shell > :not\(#screen-window\)[^{]*:focus-visible/);
  });
});
