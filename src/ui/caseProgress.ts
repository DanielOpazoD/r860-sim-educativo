/** Progreso de los casos clínicos en este navegador: resuelto o intentado. Opcional: un fallo de almacenamiento no importa. */
export const CASES_KEY = 'ventila.cases';
export type CaseStatus = 'resuelto' | 'intentado';

export function loadCaseProgress(): Record<string, CaseStatus> {
  try {
    const raw = JSON.parse(globalThis.localStorage.getItem(CASES_KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(([, v]) => v === 'resuelto' || v === 'intentado'),
    ) as Record<string, CaseStatus>;
  } catch {
    return {};
  }
}

/** Un caso resuelto no vuelve a «intentado» por un intento posterior fallido. */
export function saveCaseProgress(id: string, passed: boolean): void {
  try {
    const all = loadCaseProgress();
    all[id] = passed || all[id] === 'resuelto' ? 'resuelto' : 'intentado';
    globalThis.localStorage.setItem(CASES_KEY, JSON.stringify(all));
  } catch {
    // El progreso es opcional.
  }
}
