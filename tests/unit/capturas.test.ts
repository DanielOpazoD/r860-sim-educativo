import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// VR-02 · las referencias de la regresión visual (VR-01) corresponden al spec. Las de macOS se generan en local y deben
// ser exactamente las del spec. Las de Linux las escribe el CI y se commitean desde su artefacto (docs/04 §5): si falta
// una, Playwright ya hace fallar el CI («writing actual»), así que aquí sólo se exige que no sobre ninguna —una referencia
// huérfana de un estado que ya no existe—. Exigirlas todas bloquearía la pasada que las escribe.

const RAIZ = new URL('../../tests/e2e/capturas/', import.meta.url);
function juego(plataforma: string): string[] {
  const dir = new URL(`${plataforma}/`, RAIZ);
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const proyecto of readdirSync(dir))
    if (statSync(new URL(proyecto, dir)).isDirectory())
      for (const f of readdirSync(new URL(`${proyecto}/`, dir))) if (f.endsWith('.png')) out.push(`${proyecto}/${f}`);
  return out.sort();
}

describe('VR-02 · las referencias de la regresión visual corresponden al spec', () => {
  const spec = readFileSync(new URL('../e2e/regresion.spec.ts', import.meta.url), 'utf8');
  const ids = [...spec.matchAll(/\{\s*id: '([\w-]+)'/g)].map((m) => m[1]!);
  const moviles = [...spec.matchAll(/\{\s*id: '([\w-]+)'[^}]*movil: true/g)].map((m) => m[1]!);
  const esperado = [...ids.map((id) => `desktop-1280/${id}.png`), ...moviles.map((id) => `mobile/${id}.png`)].sort();
  it('el spec declara estados y algunos también en el teléfono', () => {
    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(moviles.length).toBeGreaterThanOrEqual(2);
  });
  it('macOS: las referencias son exactamente las del spec', () => expect(juego('darwin')).toEqual(esperado));
  it('Linux: no hay referencias huérfanas', () => expect(juego('linux').filter((f) => !esperado.includes(f))).toEqual([]));
});
