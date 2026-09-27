import { describe, expect, it } from 'vitest';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';
import type { Simulator } from '../../src/engine/simulator';

// BM-RC · reclutamiento con histéresis (U-47): la misma consigna de PEEP devuelve compliances distintas según el
// camino recorrido. Banco tipo SDRA: C basal 30 mL/cmH₂O con un 60 % de capacidad ganable, apertura a 25 y cierre a
// 9 cmH₂O de distensión. A PEEP 5 la meseta (~22) no alcanza la apertura; a PEEP 20 los picos inspiratorios sí.
const RECLUTABLE = {
  ...BENCH_PATIENT,
  crs: 0.03,
  rExp: 12,
  recruit: { frac: 0.6, pOpen: 28, pClose: 9, tauOpenS: 0.6, tauCloseS: 8 },
};
const AJUSTES = { ...BENCH_SETTINGS, plimit: 100, pmax: 60 };
const REC_PARA_QUITAR = { frac: 0.6, pOpen: 28, pClose: 9, tauOpenS: 0.6, tauCloseS: 8 };

function simReclutable(peep = 5): Simulator {
  return benchSim({ patient: { ...RECLUTABLE }, settings: { ...AJUSTES, peep } });
}

/** Bloqueo inspiratorio válido y su Cstat (L/cmH₂O). Espera una maniobra NUEVA: `last` conserva la anterior. */
function cstatMedida(sim: Simulator, respiracionesPrevias = 2): number {
  runUntilBreath(sim, sim.breaths.length + respiracionesPrevias);
  const previoId = sim.procedures.last.inspHold?.procedureId;
  expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 }).accepted).toBe(true);
  while (sim.procedures.last.inspHold?.phase !== 'completed' || sim.procedures.last.inspHold.procedureId === previoId) sim.step();
  const h = sim.procedures.last.inspHold!;
  expect(h.quality).toBe('valid');
  return h.values.cstat!.value!;
}

describe('BM-RC · reclutamiento y curva P-V con histéresis', () => {
  it('por debajo de la apertura no recluta: r se mantiene 0 y la Cstat es la basal (≈30 mL/cmH₂O)', () => {
    const sim = simReclutable();
    const cstat = cstatMedida(sim, 4);
    expect(sim.frame().truth.recruited).toBe(0);
    expect(Math.abs(cstat * 1000 - 30)).toBeLessThanOrEqual(3);
  });

  it('mantener presión por encima de la apertura abre la capacidad ganable: r sube y la meseta baja al mismo VT', () => {
    const sim = simReclutable();
    runUntilBreath(sim, 2);
    const cstatCerrada = cstatMedida(sim, 0);
    expect(sim.command({ type: 'confirmSettings', changes: { peep: 20 } }).accepted).toBe(true);
    runUntilBreath(sim, 10);
    expect(sim.frame().truth.recruited).toBeGreaterThan(0.5);
    // Una oclusión sostenida a PEEP 20 lleva la distensión a ~36 cmH₂O durante segundos: reclutamiento completo.
    const cstat = cstatMedida(sim, 0);
    expect(sim.frame().truth.recruited).toBeGreaterThan(0.9);
    expect(cstat * 1000).toBeGreaterThan(1.4 * 30);
    // EELV ganado: a PEEP 20 el pulmón abierto aloja ~0,96 L frente a los ~0,6 L del pulmón cerrado.
    expect(sim.frame().truth.vAbsL).toBeGreaterThan(0.8);
    expect(cstatCerrada).toBeLessThan(cstat); // sólo marca que ambas mediciones corrieron
  });

  it('histéresis: la PEEP decremental devuelve más compliance que la ascendente al mismo nivel', () => {
    const sim = simReclutable();
    const ascendente = cstatMedida(sim, 4); // PEEP 5, cerrado
    expect(sim.command({ type: 'confirmSettings', changes: { peep: 20 } }).accepted).toBe(true);
    cstatMedida(sim, 8); // recluta
    expect(sim.frame().truth.recruited).toBeGreaterThan(0.9);
    expect(sim.command({ type: 'confirmSettings', changes: { peep: 10 } }).accepted).toBe(true);
    // PEEP 10 > pClose 9: el pulmón conserva lo reclutado en la banda muerta.
    const decremental = cstatMedida(sim, 4);
    expect(sim.frame().truth.recruited).toBeGreaterThan(0.9);
    expect(decremental).toBeGreaterThan(1.35 * ascendente);
    // Un pulmón que nunca se abrió, medido a PEEP 10 (pico mareal ~27 < pOpen 28), sigue dando la basal.
    const virgen = simReclutable(10);
    const sinRec = cstatMedida(virgen, 4);
    expect(virgen.frame().truth.recruited).toBe(0);
    expect(Math.abs(sinRec - ascendente) / ascendente).toBeLessThan(0.1);
  });

  it('por debajo del cierre se desrecluta con su propia constante de tiempo', () => {
    const sim = simReclutable(20);
    cstatMedida(sim, 4);
    expect(sim.frame().truth.recruited).toBeGreaterThan(0.9);
    expect(sim.command({ type: 'confirmSettings', changes: { peep: 5 } }).accepted).toBe(true);
    runUntilBreath(sim, 14); // ~56 s: con tauClose 8 s y cierre sólo en espiración, r cae a una fracción pequeña
    const r = sim.frame().truth.recruited;
    expect(r).toBeGreaterThan(0); // no es instantáneo: en la banda conserva estado
    expect(r).toBeLessThan(0.3);
  });

  it('quitar el reclutamiento devuelve el modelo exactamente al lineal', () => {
    const a = benchSim({ patient: { ...BENCH_PATIENT }, settings: { ...AJUSTES } });
    const b = benchSim({ patient: { ...BENCH_PATIENT, recruit: REC_PARA_QUITAR }, settings: { ...AJUSTES } });
    b.command({ type: 'setPatient', params: { recruit: undefined } });
    runUntilBreath(a, 6);
    runUntilBreath(b, 6);
    const fa = a.frame(),
      fb = b.frame();
    expect(fb.truth.recruited).toBe(0);
    expect(fb.truth.vAbsL).toBeCloseTo(fa.truth.vAbsL, 10);
    expect(Math.max(...b.breaths.slice(-3).map((x) => x.ppeak))).toBeCloseTo(Math.max(...a.breaths.slice(-3).map((x) => x.ppeak)), 10);
  });
});
