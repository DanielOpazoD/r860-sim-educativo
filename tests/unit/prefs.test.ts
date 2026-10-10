import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPrefs, loadPrefs, PREFS_KEY, savePrefs } from '../../src/ui/prefs';

function storage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('preferencias de interfaz', () => {
  it('usa valores por omisión cuando el JSON está corrupto', () => {
    vi.stubGlobal('localStorage', storage({ [PREFS_KEY]: '{' }));
    expect(loadPrefs()).toEqual({ v: 1 });
  });

  it('descarta una ventana de curvas desconocida sin perder valores válidos', () => {
    vi.stubGlobal('localStorage', storage({ [PREFS_KEY]: JSON.stringify({ v: 1, waveWindow: '30', welcomed: true }) }));
    expect(loadPrefs()).toEqual({ v: 1, welcomed: true });
  });

  it('combina cambios con las preferencias existentes', () => {
    const local = storage({ [PREFS_KEY]: JSON.stringify({ v: 1, lastScenario: 'SC-03', welcomed: true }) });
    vi.stubGlobal('localStorage', local);
    savePrefs({ view: 'loops' });
    expect(loadPrefs()).toEqual({ v: 1, lastScenario: 'SC-03', view: 'loops', welcomed: true });
  });

  it('no lanza si localStorage falla al leer, escribir o borrar', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('sin almacenamiento');
      },
      setItem: () => {
        throw new Error('sin almacenamiento');
      },
      removeItem: () => {
        throw new Error('sin almacenamiento');
      },
    });
    expect(loadPrefs()).toEqual({ v: 1 });
    expect(() => savePrefs({ welcomed: true })).not.toThrow();
    expect(() => clearPrefs()).not.toThrow();
  });
});
