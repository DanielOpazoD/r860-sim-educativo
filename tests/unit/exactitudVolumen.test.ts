import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { DEFAULT_FLOW_NOISE, FlowSensor } from '../../src/engine/sensors';
import { defaultInit, REFERENCE_PROFILE } from '../../src/profiles';

// VTD-01 · el volumen corriente cabe en la especificación del equipo. URM SW10 13-20, «Tidal volume delivery»: exactitud
// ± 10 % del ajuste o ± 5 mL (lo mayor) y repetibilidad 1σ de ± 2 % o ± 3 mL (lo mayor). Son cotas, no una descripción:
// el simulador no las imita en su peor caso. El canal de volumen lee cada respiración con una ganancia uniforme de
// ± 2,5 % (U-36, P), cuya σ es 2,5/√3 ≈ 1,44 %: dentro de la repetibilidad publicada.

const exactitud = (setMl: number): number => Math.max(0.1 * setMl, 5);
const repetibilidad = (setMl: number): number => Math.max(0.02 * setMl, 3);
const media = (x: number[]): number => x.reduce((a, b) => a + b, 0) / x.length;
const sigma = (x: number[]): number => {
  const m = media(x);
  return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1));
};

describe('VTD-01 · volumen y presiones caben en la especificación del equipo (URM SW10 13-20)', () => {
  it('la ganancia del canal de volumen por omisión: 1σ ≤ 2 % y nunca fuera de ± 10 %', () => {
    const s = new FlowSensor(1);
    const g = Array.from({ length: 20_000 }, () => s.gain(undefined));
    expect(sigma(g)).toBeLessThanOrEqual(0.02);
    expect(sigma(g)).toBeCloseTo(DEFAULT_FLOW_NOISE / Math.sqrt(3), 3);
    for (const x of g) expect(Math.abs(x - 1)).toBeLessThanOrEqual(0.1);
  });

  for (const vtMl of [500, 300])
    it(`A/C VC ${vtMl} mL, pulmón pasivo y canal por omisión: entregado exacto; medido con media y σ dentro de la cota`, () => {
      const base = defaultInit({});
      const sim = new Simulator(
        defaultInit({
          patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
          settings: { ...base.settings, mode: 'AC_VC', vt: vtMl / 1000, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, plimit: 100, pausePct: 0 },
          initialV: 'equilibrium',
        }),
        REFERENCE_PROFILE,
      );
      while (sim.breaths.length < 42) sim.step();
      const ciclos = sim.breaths.slice(2); // las dos primeras asientan el equilibrio
      const entregado = ciclos.map((b) => b.vtInsp * 1000);
      const medido = ciclos.map((b) => (b.vtInspMeasured ?? b.vtInsp) * 1000);
      for (const v of entregado) expect(Math.abs(v - vtMl)).toBeLessThanOrEqual(exactitud(vtMl));
      expect(Math.abs(media(medido) - vtMl)).toBeLessThanOrEqual(exactitud(vtMl));
      expect(sigma(medido)).toBeLessThanOrEqual(repetibilidad(vtMl));
      expect(sigma(medido)).toBeGreaterThan(0); // el canal no es ideal: hay dispersión ciclo a ciclo
    });

  it('A/C PC: presión inspiratoria y PEEP dentro de ± 2 cmH₂O del ajuste y con 1σ ≤ 1 (13-20, «Inspired pressure control», «PEEP control»)', () => {
    const base = defaultInit({});
    const sim = new Simulator(
      defaultInit({
        patient: { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0 },
        settings: { ...base.settings, mode: 'AC_PC', pinsp: 15, rr: 15, ie: 1 / 3, peep: 5, pmax: 40, riseMs: 100 },
        initialV: 'equilibrium',
      }),
      REFERENCE_PROFILE,
    );
    while (sim.breaths.length < 22) sim.step();
    const ciclos = sim.breaths.slice(2);
    const picos = ciclos.map((b) => b.ppeak);
    const peeps = ciclos.map((b) => b.peepe);
    for (const p of picos) expect(Math.abs(p - (5 + 15))).toBeLessThanOrEqual(2);
    for (const p of peeps) expect(Math.abs(p - 5)).toBeLessThanOrEqual(2);
    expect(sigma(picos)).toBeLessThanOrEqual(1);
    expect(sigma(peeps)).toBeLessThanOrEqual(1);
  });
});
