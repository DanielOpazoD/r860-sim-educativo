import { describe, expect, it } from 'vitest';
import { EffortGenerator } from '../../src/engine/effort';
import { SCENARIOS } from '../../src/scenarios';

// P01-01 · el esfuerzo de cada escenario es coherente con su impulso. Telias et al. 2020 (C15): P0.1 ≤ 1,0 cmH₂O
// identifica esfuerzo bajo (PTP esofágico ≤ 50 cmH₂O·s/min) y P0.1 > 3,5 esfuerzo alto (PTP ≥ 200). El P0.1 implícito es
// la Pmus a los 100 ms de empezar el esfuerzo (vía aérea ocluida, sin flujo) y el PTP, la integral de la Pmus positiva en
// un minuto. Un escenario no puede tener las dos medidas en franjas opuestas, salvo la excepción registrada (U-55).

type Franja = 'bajo' | 'intermedio' | 'alto';
const porP01 = (p: number): Franja => (p <= 1 ? 'bajo' : p > 3.5 ? 'alto' : 'intermedio');
const porPtp = (p: number): Franja => (p <= 50 ? 'bajo' : p >= 200 ? 'alto' : 'intermedio');
/** Excepciones conocidas, cada una con su vacío: si se recalibra el escenario, hay que sacarlo de aquí. */
const EXCEPCIONES: Record<string, string> = { 'SC-18': 'U-55' };

const conEsfuerzo = SCENARIOS.filter((s) => s.effort?.enabled && s.effort.amplitude > 0);

function medir(id: string) {
  const e = SCENARIOS.find((s) => s.id === id)!.effort!;
  const g = new EffortGenerator({ ...e, variability: undefined }, 1);
  const p01 = g.pmusAt(e.phaseS + 0.1);
  let ptp = 0;
  for (let t = e.phaseS; t < e.phaseS + 60; t += 0.001) ptp += Math.max(0, g.pmusAt(t)) * 0.001;
  return { p01, ptp };
}

describe('P01-01 · el P0.1 implícito y el trabajo del esfuerzo cuentan lo mismo (Telias 2020)', () => {
  it('hay escenarios con esfuerzo que comprobar', () => expect(conEsfuerzo.length).toBeGreaterThanOrEqual(5));
  for (const s of conEsfuerzo)
    it(`${s.id} · ${s.name}`, () => {
      const { p01, ptp } = medir(s.id);
      const a = porP01(p01),
        b = porPtp(ptp);
      const opuestas = (a === 'bajo' && b === 'alto') || (a === 'alto' && b === 'bajo');
      expect(opuestas, `P0.1 ${p01.toFixed(2)} (${a}) frente a PTP ${ptp.toFixed(0)} (${b})`).toBe(s.id in EXCEPCIONES);
    });
  it('el esfuerzo débil (SC-05) es bajo por las dos medidas', () => {
    const { p01, ptp } = medir('SC-05');
    expect(porP01(p01)).toBe('bajo');
    expect(porPtp(ptp)).toBe('bajo');
  });
});
