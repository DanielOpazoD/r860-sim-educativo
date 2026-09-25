import { describe, expect, it } from 'vitest';
import { ALL_METRICS, CORE_METRICS, METRICS } from '../../src/ui/metricsTable';

describe('DEN · densidad de casillas numéricas', () => {
  it('CORE_METRICS tiene las seis casillas de la vista del equipo', () => {
    expect(CORE_METRICS).toEqual(['ppeak', 'peepe', 'pplat', 'vte', 'rr', 'fio2']);
    expect(CORE_METRICS).toHaveLength(6);
  });

  it('cada clave de CORE_METRICS existe en la columna numérica (METRICS)', () => {
    const claves = new Set([...METRICS, ...ALL_METRICS].map((m) => m.key));
    for (const k of CORE_METRICS) expect(claves.has(k)).toBe(true);
    const columna = new Set(METRICS.map((m) => m.key));
    for (const k of CORE_METRICS) expect(columna.has(k)).toBe(true);
  });
});
