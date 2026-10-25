export const PREFS_KEY = 'ventila.prefs';
/** Clave anterior al cambio de nombre: se lee una vez y se migra para no perder las preferencias guardadas. */
export const LEGACY_PREFS_KEY = 'r860.prefs';
/** Claves sueltas donde se guardaba la densidad de casillas antes de entrar en Prefs: se migran una vez. */
export const LEGACY_DENSITY_KEYS = ['ventila.tileDensity', 'r860.tileDensity'] as const;

export type Prefs = {
  v: 1;
  lastScenario?: string;
  view?: string;
  waveWindow?: '6' | '12' | '24';
  waveStyle?: 'sweep' | 'scroll';
  waveScale?: 'auto' | 'fixed';
  /** Velocidad del tiempo simulado elegida en Tiempo. */
  speed?: number;
  /** Casillas numéricas: 13 o 6 grandes. */
  tileDensity?: 6 | 13;
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
/** Velocidades que ofrece Tiempo; otra guardada (o de la dirección) no se recuerda. */
export const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;

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
    ...(typeof source.speed === 'number' && (SPEEDS as readonly number[]).includes(source.speed) ? { speed: source.speed } : {}),
    ...(source.tileDensity === 6 || source.tileDensity === 13 ? { tileDensity: source.tileDensity } : {}),
    ...(typeof source.instructorVisible === 'boolean' ? { instructorVisible: source.instructorVisible } : {}),
    ...(typeof source.variableDescriptions === 'boolean' ? { variableDescriptions: source.variableDescriptions } : {}),
    ...(typeof source.waveGuides === 'boolean' ? { waveGuides: source.waveGuides } : {}),
    ...(typeof source.waveAnnotations === 'boolean' ? { waveAnnotations: source.waveAnnotations } : {}),
    ...(typeof source.welcomed === 'boolean' ? { welcomed: source.welcomed } : {}),
  };
}

export function loadPrefs(): Prefs {
  try {
    const storage = globalThis.localStorage;
    let stored = storage.getItem(PREFS_KEY);
    if (stored === null) {
      stored = storage.getItem(LEGACY_PREFS_KEY);
      if (stored !== null) {
        storage.setItem(PREFS_KEY, stored);
        storage.removeItem(LEGACY_PREFS_KEY);
      }
    }
    const prefs = stored ? normalize(JSON.parse(stored)) : ({ v: 1 } as Prefs);
    const density = LEGACY_DENSITY_KEYS.map((key) => storage.getItem(key)).find((value) => value !== null);
    if (density !== undefined) {
      for (const key of LEGACY_DENSITY_KEYS) storage.removeItem(key);
      if (prefs.tileDensity === undefined && (density === '6' || density === '13')) {
        prefs.tileDensity = Number(density) as 6 | 13;
        storage.setItem(PREFS_KEY, JSON.stringify(prefs));
      }
    }
    return prefs;
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

/** Restablece las preferencias de vista; conserva la bienvenida vista y el último escenario. */
export function resetViewPrefs(): void {
  try {
    const { welcomed, lastScenario } = loadPrefs();
    const kept: Prefs = { v: 1, ...(welcomed === undefined ? {} : { welcomed }), ...(lastScenario ? { lastScenario } : {}) };
    globalThis.localStorage.setItem(PREFS_KEY, JSON.stringify(kept));
  } catch {
    // Preferences are optional; storage failures must not interrupt the simulation.
  }
}
