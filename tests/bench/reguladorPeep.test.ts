import { describe, expect, it } from 'vitest';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim } from '../helpers';

// BM-RP · regulador de PEEP con ancho de banda finito (cierre de U-43): la demanda inspiratoria repentina hunde la Pva
// transitoriamente (K·demanda no compensada) y la acción integral la repone; en régimen no queda caída permanente.
function pawMinExp(sim: ReturnType<typeof benchSim>, breaths = 10, skipFirst = 1): number {
  let pawMin = Infinity,
    n = 0;
  let prev = false;
  while (n < breaths) {
    sim.step();
    const exp = sim.frame().live.phase === 'exp';
    if (!exp && prev) n++;
    if (exp && prev && n >= skipFirst) pawMin = Math.min(pawMin, sim.frame().live.paw);
    prev = exp;
  }
  return pawMin;
}

describe('BM-RP · regulador de PEEP: caída transitoria bajo demanda, recuperación en régimen', () => {
  it('con fuga estable que el flujo de base cubre la Pva tardía se queda en PEEP: la acción integral no deja caída permanente', () => {
    const sim = benchSim({
      patient: { ...BENCH_PATIENT, leakLpmAt10: 8 },
      settings: { ...BENCH_SETTINGS, biasFlow: 10 / 60 },
    });
    let tardia = Infinity,
      ultima = 5;
    let prev = false;
    while (sim.breaths.length < 8) {
      sim.step();
      const f = sim.frame();
      const exp = f.live.phase === 'exp';
      // El último instante de cada espiración ya en régimen (a partir de la segunda) cuenta como «tardía».
      if (exp) ultima = f.live.paw;
      if (!exp && prev && sim.breaths.length >= 1) tardia = Math.min(tardia, ultima);
      prev = exp;
    }
    // Sin esfuerzo la demanda es sólo la fuga, constante: qFilt la absorbe y la Pva vuelve a PEEP.
    expect(tardia).toBeCloseTo(5, 1);
    expect(tardia).toBeGreaterThan(4.9);
  });

  it('la caída máxima crece con la amplitud del esfuerzo y baja con más flujo de base', () => {
    // La caída sólo existe cuando el esfuerzo supera la PEEP intrínseca y tira gas (qLibre > 0): con rExp 15 y este
    // alineamiento, Pmus 4 no llega (caída 0), 8 da ≈ 0,74 y 12 ≈ 3,9; a base 4 L/min la misma amplitud da ≈ 1,6.
    const caida = (amplitude: number, biasFlow: number): number =>
      5 -
      pawMinExp(
        benchSim({
          patient: { ...BENCH_PATIENT, rExp: 15 },
          effort: { enabled: true, amplitude, ratePerMin: 20, tiS: 0.8, phaseS: 1.2 },
          settings: { ...BENCH_SETTINGS, assistControl: false, biasFlow: biasFlow / 60, rr: 25, ie: 1 },
        }),
        12,
      );
    const c4 = caida(4, 8),
      c8 = caida(8, 8),
      c12 = caida(12, 8);
    expect(c4).toBeLessThan(c8); // Pmus 4 no crea demanda: caída 0
    expect(c8).toBeGreaterThan(0.2);
    expect(c8).toBeLessThan(c12);
    expect(caida(8, 4)).toBeGreaterThan(c8); // con menos flujo de base el mismo esfuerzo hunde más
  });

  it('en un escenario con esfuerzo la PEEPe medida se conserva: la traza pre-disparo no se contamina', () => {
    const sim = benchSim({
      effort: { enabled: true, amplitude: 8, ratePerMin: 15, tiS: 0.8, phaseS: 0.5 },
      settings: { ...BENCH_SETTINGS, assistControl: true, biasFlow: 4 / 60, flowTrigger: 2 / 60, rr: 10 },
    });
    while (sim.breaths.length < 10) sim.step();
    // La PEEPe se mide en la traza anterior a la detección: la caída del regulador no debe moverla.
    for (const b of sim.breaths.slice(2)) expect(Math.abs(b.peepe - 5)).toBeLessThanOrEqual(0.5);
  });
});
