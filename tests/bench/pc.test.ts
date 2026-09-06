/**
 * Banco A/C PC (P · dossier §13 y §26). Condición para habilitar PC en la interfaz: pasar estas pruebas.
 * Física de referencia (ecuación de movimiento lineal): con presión objetivo constante ΔP sobre PEEP desde el equilibrio,
 *   Q(t) = (ΔP/R)·e^(−t/τ),  V(t) = C·ΔP·(1 − e^(−t/τ)),  τ = R·C.
 */
import { describe, expect, it } from 'vitest';
import { benchSim, runUntilBreath, BENCH_PATIENT, BENCH_SETTINGS } from '../helpers';
import type { VcSettings } from '../../src/domain/types';

const PC: VcSettings = { ...BENCH_SETTINGS, mode: 'AC_PC', pinsp: 10, riseMs: 0, rr: 15, ie: 1 / 3, peep: 5, pmax: 40 };

/** Referencia numérica independiente (Euler 10 µs) para presión objetivo con rampa lineal y flujo acotado. */
function referencePc(crs: number, r: number, peep: number, pinsp: number, riseS: number, tInsp: number, qMax = 160 / 60): { vt: number; qPeak: number; qEnd: number; pawEnd: number } {
  const h = 1e-5; let v = crs * peep; const v0 = v; let t = 0; let qPeak = 0; let q = 0; let paw = peep;
  while (t < tInsp - 1e-12) {
    const target = peep + pinsp * (riseS > 0 ? Math.min(1, t / riseS) : 1);
    q = (target - v / crs) / r;
    if (q > qMax) { q = qMax; paw = v / crs + r * q; } else paw = target;
    v += q * h; t += h; qPeak = Math.max(qPeak, q);
  }
  return { vt: v - v0, qPeak, qEnd: q, pawEnd: paw };
}

describe('BM-03 · A/C PC ideal (rampa 0) en el motor', () => {
  it('ΔP 10 sobre PEEP 5, R 10, C 0.05, Tinsp 1 s: VT ≈ 0.432332 L; Q0 = 1 L/s; Qfin ≈ 0.135335 L/s; Ppico = PEEP + Pinsp', () => {
    const sim = benchSim({ settings: PC });
    let qPeak = 0;
    while (sim.breaths.length < 1) { sim.step(); qPeak = Math.max(qPeak, sim.controller.q); }
    const b = sim.breaths[0]!;
    expect(b.tInspS).toBeCloseTo(1.0, 6);
    expect(b.vtInsp).toBeCloseTo(0.432332, 4);
    expect(qPeak).toBeCloseTo(Math.exp(-0.004 / 0.5), 3); // flujo leído al final del primer sub-paso de 4 ms
    expect(b.ppeak).toBeCloseTo(15, 6);
    expect(b.pplatCycle).toBeNull();
    expect(b.pplatCycleReason).toBe('noOcclusion');
    // flujo al final de la inspiración: leer justo antes del fin de la fase
    const sim2 = benchSim({ settings: PC }); let last = 0; while (sim2.controller.phase !== 'exp') { last = sim2.controller.q; sim2.step(); }
    expect(last).toBeCloseTo(0.135335, 2);
  });
  it('con rampa de 200 ms el VT coincide con la referencia numérica independiente (< 1 %)', () => {
    const sim = benchSim({ settings: { ...PC, riseMs: 200 } });
    runUntilBreath(sim, 1);
    const ref = referencePc(0.05, 10, 5, 10, 0.2, 1.0);
    expect(Math.abs(sim.breaths[0]!.vtInsp - ref.vt) / ref.vt).toBeLessThan(0.01);
    expect(sim.breaths[0]!.vtInsp).toBeLessThan(0.432332); // la rampa retrasa la entrega
  });
  it('tope de flujo del actuador (160 L/min): con R muy baja la presión no alcanza el objetivo de inmediato', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, rInsp: 1 }, settings: { ...PC, pinsp: 20 } });
    let qPeak = 0; while (sim.breaths.length < 1) { sim.step(); qPeak = Math.max(qPeak, sim.controller.q); }
    expect(qPeak).toBeLessThanOrEqual(160 / 60 + 1e-9);
    const ref = referencePc(0.05, 1, 5, 20, 0, 1.0);
    expect(Math.abs(sim.breaths[0]!.vtInsp - ref.vt) / ref.vt).toBeLessThan(0.01);
  });
});

describe('PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no', () => {
  it('duplicar R halva el flujo pico y reduce el VT; Ppico no cambia', () => {
    const a = benchSim({ settings: PC }); const b = benchSim({ patient: { ...BENCH_PATIENT, rInsp: 20 }, settings: PC });
    let qa = 0, qb = 0;
    while (a.breaths.length < 1) { a.step(); qa = Math.max(qa, a.controller.q); }
    while (b.breaths.length < 1) { b.step(); qb = Math.max(qb, b.controller.q); }
    expect(qb / qa).toBeCloseTo(0.5, 2);
    expect(b.breaths[0]!.vtInsp).toBeLessThan(a.breaths[0]!.vtInsp);
    expect(b.breaths[0]!.ppeak).toBeCloseTo(a.breaths[0]!.ppeak, 6);
  });
  it('halvar C reduce el VT (hacia C·ΔP) y acorta la constante de tiempo', () => {
    const a = benchSim({ settings: { ...PC, rr: 10, ie: 1 / 1 } }); // Tinsp 3 s ≫ tau: VT → C·ΔP
    const b = benchSim({ patient: { ...BENCH_PATIENT, crs: 0.025 }, settings: { ...PC, rr: 10, ie: 1 / 1 } });
    runUntilBreath(a, 1); runUntilBreath(b, 1);
    expect(a.breaths[0]!.vtInsp).toBeCloseTo(0.05 * 10 * (1 - Math.exp(-3 / 0.5)), 4);
    expect(b.breaths[0]!.vtInsp).toBeCloseTo(0.025 * 10 * (1 - Math.exp(-3 / 0.25)), 4);
  });
  it('alargar Tinsp aumenta el VT hasta saturar; el flujo cae a ~cero (fase plana del flujo)', () => {
    const short = benchSim({ settings: { ...PC, rr: 20, ie: 1 / 5 } }); // Tinsp 0.5 s = tau
    const long = benchSim({ settings: { ...PC, rr: 10, ie: 1 / 1 } });  // Tinsp 3 s = 6 tau
    runUntilBreath(short, 1); runUntilBreath(long, 1);
    expect(short.breaths[0]!.vtInsp).toBeCloseTo(0.5 * (1 - Math.exp(-1)), 3);
    expect(long.breaths[0]!.vtInsp).toBeCloseTo(0.5 * (1 - Math.exp(-6)), 3);
    let last = 0; const s3 = benchSim({ settings: { ...PC, rr: 10, ie: 1 / 1 } }); while (s3.controller.phase !== 'exp') { last = s3.controller.q; s3.step(); }
    expect(last).toBeLessThan(0.01);
  });
  it('cambiar PEEP en PC conserva el volumen y desplaza la línea base: mismo VT (ΔP relativo), Ppico = nuevo PEEP + Pinsp', () => {
    const sim = benchSim({ settings: PC });
    runUntilBreath(sim, 3);
    const vBefore = sim.patient.v;
    sim.command({ type: 'confirmSettings', changes: { peep: 10 } });
    expect(sim.patient.v).toBe(vBefore);
    runUntilBreath(sim, 12);
    const b = sim.breaths[11]!;
    expect(b.peepe).toBeCloseTo(10, 6);
    expect(b.ppeak).toBeCloseTo(20, 6);
    expect(b.vtInsp).toBeCloseTo(0.432332, 2); // el pulmón aún converge al nuevo equilibrio (residuo e⁻⁶ por ciclo)
  });
  it('el esfuerzo del paciente aumenta el flujo y el VT con la misma presión de vía aérea', () => {
    const passive = benchSim({ settings: { ...PC, assistControl: false } });
    const active = benchSim({ settings: { ...PC, assistControl: false }, effort: { enabled: true, amplitude: 5, ratePerMin: 15, tiS: 1.0, phaseS: 0 } });
    runUntilBreath(passive, 4); runUntilBreath(active, 4);
    expect(active.breaths[3]!.ppeak).toBeCloseTo(passive.breaths[3]!.ppeak, 6);
    expect(active.breaths[3]!.vtInsp).toBeGreaterThan(passive.breaths[3]!.vtInsp);
  });
  it('BM-07 en PC: conservación de volumen por respiración', () => {
    const sim = benchSim({ settings: PC, patient: { ...BENCH_PATIENT, rExp: 30 } });
    runUntilBreath(sim, 8);
    for (let i = 0; i < sim.breaths.length - 1; i++) { const b = sim.breaths[i]!; expect(b.vtInsp - b.vtExp).toBeCloseTo(sim.breaths[i + 1]!.truthVStartL - b.truthVStartL, 6); }
  });
  it('validación PC: PEEP + Pinsp ≥ Pmáx y rampa > Tinsp se rechazan con explicación; el cambio VC → PC es transacción de siguiente respiración', () => {
    const sim = benchSim();
    expect(sim.command({ type: 'confirmSettings', changes: { mode: 'AC_PC', pinsp: 40 } }).accepted).toBe(false);
    expect(sim.command({ type: 'confirmSettings', changes: { mode: 'AC_PC', riseMs: 500, rr: 60, ie: 1 / 3 } }).accepted).toBe(false);
    expect(sim.command({ type: 'confirmSettings', changes: { mode: 'AC_PC', pinsp: 12 } }).accepted).toBe(true);
    expect(sim.frame().settings.mode).toBe('AC_VC');
    runUntilBreath(sim, 2);
    expect(sim.frame().settings.mode).toBe('AC_PC');
    expect(sim.breaths[1]!.ppeak).toBeCloseTo(17, 6);
  });
});
