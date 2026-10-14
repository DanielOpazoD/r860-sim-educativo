import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { defaultInit, REFERENCE_PROFILE } from '../../src/profiles';

// VTC-01 · en volumen control el equipo «monitors delivered tidal volume and adjusts the delivered inspiratory flow as
// needed to maintain the set tidal volume for subsequent breaths» (URM SW10 5-11; R23). Cuando Plimit recorta la
// entrega a mitad de la inspiración, las respiraciones siguientes suben el flujo hasta completar el VT; si ni con el
// flujo máximo cabe bajo Plimit, sigue corto y salta «VT no entregado». Sin Plimit, el flujo vuelve al nominal.

function correr(plimit: number, rInsp: number, ms: number, cambiar?: { tMs: number; plimit: number }) {
  const base = defaultInit({});
  const sim = new Simulator(
    defaultInit({
      patient: { crs: 0.05, rInsp, rExp: 10, r2: 0, p0: 0 },
      settings: { ...base.settings, mode: 'AC_VC', vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit, pausePct: 0 },
      initialV: 'equilibrium',
    }),
    REFERENCE_PROFILE,
  );
  let hecho = false;
  while (sim.simTimeMs < ms) {
    sim.step();
    if (cambiar && !hecho && sim.simTimeMs >= cambiar.tMs) {
      sim.command({ type: 'confirmSettings', changes: { plimit: cambiar.plimit } });
      hecho = true;
    }
  }
  return sim;
}
const ml = (l: number): number => Math.round(l * 1000);

describe('VTC-01 · compensación del VT entregado en volumen control', () => {
  it('Plimit a mitad de la inspiración: la primera respiración queda corta y las siguientes completan el VT', () => {
    const sim = correr(18, 10, 40_000);
    const vt = sim.breaths.map((b) => ml(b.vtInsp));
    expect(sim.breaths[0]!.plimitReached).toBe(true);
    expect(vt[0]).toBeLessThan(495); // ≈ 482: con flujo constante Plimit corta antes de completar
    for (const v of vt.slice(3)) expect(v).toBeGreaterThanOrEqual(495);
    for (const v of vt) expect(v).toBeLessThanOrEqual(502); // nunca entrega de más: al completar el VT, pausa
    expect(sim.frame().alarms.find((a) => a.id === 'vtNotDelivered' && a.conditionActive)).toBeUndefined();
  });

  it('VT imposible bajo Plimit (R 60, como SC-04): sigue corto y salta «VT no entregado»', () => {
    const sim = correr(30, 60, 60_000);
    // El techo con presión limitada es C·(Plimit − PEEP)·(1 − e^(−Ti/RC)) ≈ 354 mL: ningún flujo lo supera.
    for (const b of sim.breaths.slice(2)) expect(ml(b.vtInsp)).toBeLessThanOrEqual(356);
    expect(sim.frame().alarms.find((a) => a.id === 'vtNotDelivered')?.conditionActive).toBe(true);
  });

  it('al subir Plimit, el flujo vuelve al nominal: VT exacto y sin pausa', () => {
    const sim = correr(18, 10, 40_000, { tMs: 20_000, plimit: 100 });
    const tras = sim.breaths.filter((b) => b.startSimTimeMs > 24_000);
    expect(tras.length).toBeGreaterThan(3);
    for (const b of tras) {
      expect(b.plimitReached).toBe(false);
      expect(ml(b.vtInsp)).toBe(500);
      expect(b.pplatCycleReason).toBe('noPause');
    }
  });
});
