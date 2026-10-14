import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MON_FS } from '../../src/render/monitorPalette';

const stylesDir = new URL('../../src/ui/styles/', import.meta.url);
const exceptions = ['.bezel-signature small'];

describe('escala tipográfica del monitor', () => {
  it('no declara tamaños en px inferiores a 10 fuera de la serigrafía', () => {
    const violations: string[] = [];
    for (const file of readdirSync(stylesDir).filter((name) => name.endsWith('.css'))) {
      const css = readFileSync(new URL(file, stylesDir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        for (const [, size] of body!.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px\b/g)) {
          const allowed = selector!.split(',').every((item) => exceptions.includes(item.trim()));
          if (Number(size) < 10 && !allowed) {
            violations.push(`${file}: ${selector!.trim()} font-size ${size}px`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// TIP-02 · el monitor escribe con once tamaños, no con veinte. Las hojas del monitor (la parte de 01-base, 02-vistas y
// 09-instrument) sólo usan los pasos `--mon-fs-*`, y el canvas (curvas, barra de presión, captura) los mismos pasos de
// MON_FS: `text()` no acepta un número suelto.
describe('TIP-02 · una sola escala tipográfica para el monitor', () => {
  const leer = (f: string): string => readFileSync(new URL(f, stylesDir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const base = leer('01-base.css');
  const escala = Object.fromEntries([...base.matchAll(/--mon-fs-([\w]+):\s*(\d+)px/g)].map((m) => [m[1]!, Number(m[2])]));

  it('once pasos crecientes, ninguno bajo 10 px, iguales en la hoja y en el canvas', () => {
    expect(escala).toEqual(MON_FS);
    const pasos = Object.values(MON_FS);
    expect(pasos).toHaveLength(11);
    expect(pasos[0]).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < pasos.length; i++) expect(pasos[i]).toBeGreaterThan(pasos[i - 1]!);
  });

  it('las hojas del monitor no declaran tamaños fuera de la escala', () => {
    const hojas: [string, string][] = [
      ['01-base.css (monitor)', base.slice(base.indexOf('.bezel-top {'), base.indexOf('.bezel-bottom {'))],
      ['02-vistas.css', leer('02-vistas.css')],
      ['09-instrument.css', leer('09-instrument.css')],
    ];
    const fuera: string[] = [];
    for (const [nombre, css] of hojas)
      for (const [, valor] of css.matchAll(/font-size:\s*([^;]+);/g))
        if (!/^(var\(--mon-fs-\w+\)|inherit)$/.test(valor!.trim())) fuera.push(`${nombre}: ${valor}`);
    expect(fuera).toEqual([]);
  });
});
