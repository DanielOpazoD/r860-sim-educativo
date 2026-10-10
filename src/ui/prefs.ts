export const PREFS_KEY = 'r860.prefs';

export type Prefs = {
  v: 1;
  lastScenario?: string;
  view?: string;
  waveWindow?: '6' | '12' | '24';
  waveStyle?: 'sweep' | 'scroll';
  waveScale?: 'auto' | 'fixed';
  instructorVisible?: boolean;
  patientMoreOpen?: boolean;
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
    ...(typeof source.patientMoreOpen === 'boolean' ? { patientMoreOpen: source.patientMoreOpen } : {}),
    ...(typeof source.welcomed === 'boolean' ? { welcomed: source.welcomed } : {}),
  };
}

export function loadPrefs(): Prefs {
  try {
    const stored = globalThis.localStorage.getItem(PREFS_KEY);
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
