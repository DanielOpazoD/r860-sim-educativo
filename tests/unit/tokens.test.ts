import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesDir = new URL('../../src/ui/styles/', import.meta.url);
const cssFiles = readdirSync(stylesDir)
  .filter((file) => file.endsWith('.css'))
  .sort()
  .map((file) => readFileSync(new URL(file, stylesDir), 'utf8'));
const css = cssFiles.join('\n');
const declaredProperties = new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((match) => match[1]));
const usedProperties = new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]));

describe('tokens CSS', () => {
  it('declara todas las propiedades personalizadas usadas por las parciales', () => {
    const missing = [...usedProperties].filter((property) => !declaredProperties.has(property)).sort();
    expect(missing).toEqual([]);
  });

  it('centraliza los neutros fusionados de 08-minimal.css en sus tokens', () => {
    const minimal = readFileSync(new URL('08-minimal.css', stylesDir), 'utf8');
    const rootTokens = /:root\s*\{[^}]*\}/.exec(minimal)?.[0] ?? '';
    const rules = minimal.replace(rootTokens, '').toLowerCase();
    const centralizedNeutrals = [
      '#e5edf5',
      '#a5b0b9',
      '#7c8993',
      '#141414',
      '#1c1c1c',
      '#262626',
      '#46505a',
      '#7b8792',
      '#65717c',
      '#5d6f80',
      '#7a8a98',
      '#82909d',
      '#9aa4ae',
      '#77838e',
      '#c2ccd5',
      '#0d0d0d',
      '#303030',
      '#a9bdcc',
      '#292929',
      '#101010',
      '#cbd4dc',
      '#26313a',
      '#0b0f12',
      '#dce4e9',
      '#e1e8ed',
    ];
    for (const color of centralizedNeutrals) expect(rules).not.toContain(color);
  });
});
