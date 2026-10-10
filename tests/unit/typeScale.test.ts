import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesDir = new URL('../../src/ui/styles/', import.meta.url);
const exceptions = ['.bezel-model > span', '.bezel-signature small'];

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
