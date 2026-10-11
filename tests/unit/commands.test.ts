import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMMAND_IDS, isCommandId, PALETTE_COMMANDS, SHORTCUTS, shortcutLabel } from '../../src/ui/commands';

const root = new URL('../../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const uiDir = new URL('src/ui/', root);
const uiSources = readdirSync(uiDir)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => readFileSync(new URL(file, uiDir), 'utf8'))
  .join('\n');

/** `data-action` escritos en la página y los generados por `btn('…', 'accion')` o plantillas de la interfaz. */
function referencedActions(): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/data-action="([\w-]+)"/g)) found.add(match[1] ?? '');
  for (const match of uiSources.matchAll(/data-action=\\?"([\w-]+)/g)) found.add(match[1] ?? '');
  for (const match of uiSources.matchAll(/btn\([^,()]+,\s*'([\w-]+)'/g)) found.add(match[1] ?? '');
  return [...found].sort();
}

describe('registro de comandos de la interfaz', () => {
  it('no repite identificadores', () => {
    expect(new Set(COMMAND_IDS).size).toBe(COMMAND_IDS.length);
  });
  it('todo data-action de la página y de las plantillas existe en el registro', () => {
    const unknown = referencedActions().filter((id) => !isCommandId(id));
    expect(unknown).toEqual([]);
  });
  it('la paleta y los atajos sólo apuntan a comandos registrados y sin duplicados', () => {
    const ids = PALETTE_COMMANDS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(isCommandId)).toBe(true);
    expect(Object.values(SHORTCUTS).every(isCommandId)).toBe(true);
    for (const entry of PALETTE_COMMANDS) {
      expect(entry.label.trim().length).toBeGreaterThan(0);
      expect(entry.keywords.trim().length).toBeGreaterThan(0);
    }
  });
  it('describe el atajo con la tecla visible', () => {
    expect(shortcutLabel('pause')).toBe('Espacio');
    expect(shortcutLabel('freeze')).toBe('C');
    expect(shortcutLabel('help')).toBe('?');
    expect(shortcutLabel('modes')).toBeUndefined();
  });
  it('rechaza identificadores desconocidos', () => {
    expect(isCommandId('hackear')).toBe(false);
    expect(isCommandId('')).toBe(false);
  });
});
