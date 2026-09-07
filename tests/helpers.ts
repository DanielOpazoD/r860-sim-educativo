import { Simulator, type SimulatorInit } from '../src/engine/simulator';
import { R860_PROFILE, defaultInit } from '../src/profiles';
import type { PatientParams, VcSettings } from '../src/domain/types';

/** Banco SC-01: C = 0.05, R = 10, PEEP 5, VT 0.5 L, Tinsp 1 s (flujo 0.5 L/s), sin pausa. */
/** El banco analítico usa válvula ideal (apertura instantánea): las referencias BM/PHY son exactas. */
export const BENCH_PATIENT: PatientParams = { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0, expValveOpenMs: 0 };
export const BENCH_SETTINGS: VcSettings = {
  mode: 'AC_VC',
  fio2: 0.21,
  vt: 0.5,
  rr: 15,
  ie: 1 / 3,
  peep: 5,
  pmax: 40,
  plimit: 35,
  pausePct: 0,
  assistControl: false,
  flowTrigger: 2 / 60,
  biasFlow: 2 / 60,
  triggerByPressure: false,
  pressureTrigger: -2,
  pinsp: 10,
  riseMs: 100,
};

/** El banco analítico lee el volumen sin ruido de sensor: las referencias BM/PHY son exactas. */
export const BENCH_SENSORS = { fio2TauS: 6, fio2Bias: 0, flowNoiseFraction: 0 };
export function benchSim(over: Partial<SimulatorInit> = {}): Simulator {
  return new Simulator(
    defaultInit({ patient: { ...BENCH_PATIENT }, settings: { ...BENCH_SETTINGS }, sensors: { ...BENCH_SENSORS }, ...over }),
    R860_PROFILE,
  );
}

/** Avanza hasta que se complete la respiración con secuencia `seq` (o expira el presupuesto). */
export function runUntilBreath(sim: Simulator, seq: number, maxMs = 120_000): void {
  const t0 = sim.simTimeMs;
  while (sim.breaths.length < seq && sim.simTimeMs - t0 < maxMs) sim.step();
}
