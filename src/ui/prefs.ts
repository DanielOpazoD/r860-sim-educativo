export const PREFS_KEY = 'ventila.prefs';
/** Clave anterior al cambio de nombre: se lee una vez y se migra para no perder las preferencias guardadas. */
export const LEGACY_PREFS_KEY = 'ventila.prefs';

export type Prefs = {
  v: 1;
  lastScenario?: string;
  view?: string;
  waveWindow?: '6' | '12' | '24';
  waveStyle?: 'sweep' | 'scroll';
  waveScale?: 'auto' | 'fixed';
  variableDescriptions?: boolean;
  waveGuides?: boolean;
  waveAnnotations?: boolean;
  instructorVisible?: boolean;
  welcomed?: boolean;
};

const VIEWS = new Set(['waves', 'basic', 'loops', 'data', 'trends', 'log', 'teaching']);
const WAVE_WINDOWS = new Set(['6', '12', '24']);
const WAVE_STYLES = new Set(['sweep', 'scroll']);
const WAVE_SCALES = new Set(['auto', 'fixed']);

function normalize(value: unknown): Prefs {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (value as { v?: unknown }).v !== 1) return { v: 1 };
  const source = value as Record<string, unknown>;
  return {
    v: 1,
    ...(typeof source.lastScenario === 'string' && source.lastScenario.trim() ? { lastScenario: source.lastScenario } : {}),
    ...(typeof source.view === 'string' && VIEWS.has(source.view) ? { view: source.view } : {}),
    ...(typeof source.waveWindow === 'string' && WAVE_WINDOWS.has(source.waveWindow)
      ? { waveWindow: source.waveWindow as Prefs['waveWindow'] }
      : {}),
    ...(typeof source.waveStyle === 'string' && WAVE_STYLES.has(source.waveStyle)
      ? { waveStyle: source.waveStyle as Prefs['waveStyle'] }
      : {}),
    ...(typeof source.waveScale === 'string' && WAVE_SCALES.has(source.waveScale)
      ? { waveScale: source.waveScale as Prefs['waveScale'] }
      : {}),
    ...(typeof source.instructorVisible === 'boolean' ? { instructorVisible: source.instructorVisible } : {}),
    ...(typeof source.variableDescriptions === 'boolean' ? { variableDescriptions: source.variableDescriptions } : {}),
    ...(typeof source.waveGuides === 'boolean' ? { waveGuides: source.waveGuides } : {}),
    ...(typeof source.waveAnnotations === 'boolean' ? { waveAnnotations: source.waveAnnotations } : {}),
    ...(typeof source.welcomed === 'boolean' ? { welcomed: source.welcomed } : {}),
  };
}

export function loadPrefs(): Prefs {
  try {
    let stored = globalThis.localStorage.getItem(PREFS_KEY);
    if (stored === null) {
      stored = globalThis.localStorage.getItem(LEGACY_PREFS_KEY);
      if (stored !== null) {
        globalThis.localStorage.setItem(PREFS_KEY, stored);
        globalThis.localStorage.removeItem(LEGACY_PREFS_KEY);
      }
    }
    return stored ? normalize(JSON.parse(stored)) : { v: 1 };
  } catch {
    return { v: 1 };
  }
}

export function savePrefs(patch: Partial<Prefs>): void {
  try {
    const current = loadPrefs();
    globalThis.localStorage.setItem(PREFS_KEY, JSON.stringify(normalize({ ...current, ...patch, v: 1 })));
  } catch {
    // Preferences are optional; storage failures must not interrupt the simulation.
  }
}

export function clearPrefs(): void {
  try {
    globalThis.localStorage.removeItem(PREFS_KEY);
  } catch {
    // Preferences are optional; storage failures must not interrupt the simulation.
  }
}
