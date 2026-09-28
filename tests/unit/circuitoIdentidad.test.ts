import { describe, it, expect } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { ACTUATOR_MAX_FLOW_LPS } from '../../src/engine/controller';
import { R860_PROFILE, defaultInit } from '../../src/profiles';
import { SCENARIOS } from '../../src/scenarios';
import { benchSim, runUntilBreath, BENCH_PATIENT, BENCH_SETTINGS, BENCH_SENSORS } from '../helpers';

function simEscenario(id: string, circuito: number | undefined) {
  const e = SCENARIOS.find((s) => s.id === id)!;
  const base = defaultInit({});
  const patient = { ...e.patient };
  if (circuito !== undefined) patient.circuitComplianceLPerCmH2O = circuito;
  return new Simulator(
    defaultInit({
      patient,
      effort: { ...e.effort },
      sensors: { ...e.sensors },
      settings: { ...base.settings, ...(e.settings ?? {}) },
      initialV: e.initialV ?? 'equilibrium',
    }),
    R860_PROFILE,
  );
}

/** Traza de 10 s paso a paso: paw, flujo mostrado y volumen absoluto. */
function traza(sim: Simulator, ms = 10_000): number[] {
  const out: number[] = [];
  const t0 = sim.simTimeMs;
  while (sim.simTimeMs - t0 < ms) {
    sim.step();
    out.push(sim.controller.paw, sim.controller.q, sim.patient.vTotal);
  }
  return out;
}

describe('CIR-01 identidad con circuito incompresible', () => {
  it.each(['SC-01', 'SC-13'])('%s con Cc = 0 da la misma traza que sin el campo', (id) => {
    const sin = simEscenario(id, undefined);
    const cero = simEscenario(id, 0);
    expect(traza(sin)).toEqual(traza(cero));
    expect(sin.controller.vCirc).toBe(0);
    expect(cero.controller.vCirc).toBe(0);
  });
});

describe('CIR-02 PC con circuito compresible', () => {
  it('el pulmón recibe lo mismo y el sensor de la máquina ve más flujo', () => {
    const mk = (cc: number) =>
      benchSim({
        patient: { ...BENCH_PATIENT, circuitComplianceLPerCmH2O: cc },
        settings: { ...BENCH_SETTINGS, mode: 'AC_PC', pinsp: 10, riseMs: 100 },
        sensors: { ...BENCH_SENSORS },
      });
    const a = mk(0);
    const b = mk(0.002);
    const swing = (sim: Simulator): { vMin: number; vMax: number; qMax: number } => {
      runUntilBreath(sim, 2);
      const n0 = sim.breaths.length;
      let vMin = Infinity,
        vMax = -Infinity,
        qMax = 0;
      while (sim.breaths.length === n0) {
        sim.step();
        const v = sim.patient.vTotal;
        vMin = Math.min(vMin, v);
        vMax = Math.max(vMax, v);
        if (sim.controller.phase !== 'exp') qMax = Math.max(qMax, sim.controller.q);
      }
      return { vMin, vMax, qMax };
    };
    const r0 = swing(a);
    const r2 = swing(b);
    // El volumen pulmonar no cambia: la fuente de presión fija el nodo y la compliance sólo mueve gas por el sensor.
    expect(r2.vMax - r2.vMin).toBeCloseTo(r0.vMax - r0.vMin, 3);
    // El flujo mostrado suma la compresión del circuito al arrancar la inspiración.
    expect(r2.qMax).toBeGreaterThan(r0.qMax);
  });
  it('el flujo del sensor nunca supera el tope del actuador: pulmón, fuga y compresión comparten un solo presupuesto', () => {
    // Regresión de auditoría: con resistencia baja, rampa rápida y circuito compresible el sensor llegó a 320 L/min
    // porque la (de)compresión recibía su propio presupuesto completo encima del flujo al pulmón.
    const sim = benchSim({
      patient: { ...BENCH_PATIENT, rInsp: 2, circuitComplianceLPerCmH2O: 0.005 },
      settings: { ...BENCH_SETTINGS, mode: 'AC_PC', pinsp: 15, riseMs: 0 },
    });
    let qMax = 0;
    while (sim.breaths.length < 6) {
      sim.step();
      qMax = Math.max(qMax, sim.controller.q);
    }
    expect(sim.controller.vCirc).toBeGreaterThan(0.02); // la compresión sí se ejerció (Cc·Paw ≈ 0,1 L)
    expect(qMax).toBeLessThanOrEqual(ACTUATOR_MAX_FLOW_LPS + 1e-9);
  });
});
