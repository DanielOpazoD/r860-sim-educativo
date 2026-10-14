import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// VR-02 · la regresión visual (VR-01) tiene referencia en cada plataforma. Las de macOS se generan en local y las de Linux
// las escribe el CI y se commitean desde su artefacto (docs/04 §5): si falta una, el CI de Linux la escribiría en cada
// pasada y no compararía nada. Aquí se exige el mismo juego de nombres en las dos y en el spec.

const RAIZ = new URL('../../tests/e2e/capturas/', import.meta.url);
function juego(plataforma: string): string[] {
  const dir = new URL(`${plataforma}/`, RAIZ);
  const out: string[] = [];
  for (const proyecto of readdirSync(dir))
    if (statSync(new URL(proyecto, dir)).isDirectory())
      for (const f of readdirSync(new URL(`${proyecto}/`, dir))) if (f.endsWith('.png')) out.push(`${proyecto}/${f}`);
  return out.sort();
}

describe('VR-02 · cada captura de la regresión visual tiene referencia en macOS y en Linux', () => {
  const spec = readFileSync(new URL('../e2e/regresion.spec.ts', import.meta.url), 'utf8');
  const ids = [...spec.matchAll(/\{ id: '([\w-]+)'/g)].map((m) => m[1]!);
  const moviles = [...spec.matchAll(/\{ id: '([\w-]+)'[^}]*movil: true/g)].map((m) => m[1]!);
  const esperado = [...ids.map((id) => `desktop-1280/${id}.png`), ...moviles.map((id) => `mobile/${id}.png`)].sort();
  it('el spec declara estados y algunos también en el teléfono', () => {
    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(moviles.length).toBeGreaterThanOrEqual(2);
  });
  for (const plataforma of ['darwin', 'linux'])
    it(`${plataforma}: las referencias son exactamente las del spec`, () => expect(juego(plataforma)).toEqual(esperado));
});
