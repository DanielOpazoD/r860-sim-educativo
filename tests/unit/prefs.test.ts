import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_PREFS_KEY, loadPrefs, PREFS_KEY, resetViewPrefs, savePrefs } from '../../src/ui/prefs';

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

  it('acepta las preferencias de ayudas sólo cuando son booleanas', () => {
    for (const key of ['variableDescriptions', 'waveGuides', 'waveAnnotations'] as const) {
      for (const value of [true, false]) {
        vi.stubGlobal('localStorage', storage({ [PREFS_KEY]: JSON.stringify({ v: 1, [key]: value }) }));
        expect(loadPrefs()).toEqual({ v: 1, [key]: value });
      }
      for (const value of ['true', 'false', null]) {
        vi.stubGlobal('localStorage', storage({ [PREFS_KEY]: JSON.stringify({ v: 1, [key]: value }) }));
        expect(loadPrefs()).toEqual({ v: 1 });
      }
    }
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
    expect(() => resetViewPrefs()).not.toThrow();
  });

  it('migra una vez la clave antigua de preferencias', () => {
    const local = storage({ [LEGACY_PREFS_KEY]: JSON.stringify({ v: 1, waveStyle: 'scroll', welcomed: true }) });
    vi.stubGlobal('localStorage', local);
    expect(LEGACY_PREFS_KEY).not.toBe(PREFS_KEY);
    expect(loadPrefs()).toEqual({ v: 1, waveStyle: 'scroll', welcomed: true });
    expect(local.getItem(LEGACY_PREFS_KEY)).toBeNull();
    expect(local.getItem(PREFS_KEY)).not.toBeNull();
  });

  it('guarda la densidad de casillas en las preferencias y migra la clave suelta', () => {
    const local = storage({ [PREFS_KEY]: JSON.stringify({ v: 1, welcomed: true }), 'ventila.tileDensity': '6' });
    vi.stubGlobal('localStorage', local);
    expect(loadPrefs()).toEqual({ v: 1, welcomed: true, tileDensity: 6 });
    expect(local.getItem('ventila.tileDensity')).toBeNull();
    savePrefs({ tileDensity: 13 });
    expect(loadPrefs().tileDensity).toBe(13);
  });

  it('restablecer borra las preferencias de vista y conserva bienvenida y último escenario', () => {
    const local = storage({
      [PREFS_KEY]: JSON.stringify({ v: 1, welcomed: true, lastScenario: 'SC-03', waveWindow: '6', speed: 4, tileDensity: 6 }),
    });
    vi.stubGlobal('localStorage', local);
    resetViewPrefs();
    expect(loadPrefs()).toEqual({ v: 1, welcomed: true, lastScenario: 'SC-03' });
  });
});
