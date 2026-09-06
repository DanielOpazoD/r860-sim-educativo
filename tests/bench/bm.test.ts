import { describe, expect, it } from 'vitest';
import { PatientModel } from '../../src/engine/patient';
import { litersToMl, lpsToLpm, complianceToMlPerCmH2O } from '../../src/domain/units';
import { benchSim, runUntilBreath, BENCH_PATIENT, BENCH_SETTINGS } from '../helpers';

const TOL_P = 0.5; // cmH2O (tolerancia inicial del dossier §26)
const TOL_VT = 0.01; // 1 % (dossier §26)

describe('BM-01 · VC con flujo constante (banco lineal pasivo)', () => {
  it('Tinsp 1 s, Ppico 20 cmH2O, presión elástica al ocluir 15 cmH2O', () => {
    const sim = benchSim();
    // Bloqueo inspiratorio de 2 s en la primera respiración para observar la presión elástica.
    expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 }).accepted).toBe(true);
    runUntilBreath(sim, 1);
    const b = sim.breaths[0]!;
    expect(b.tInspS).toBeCloseTo(1.0, 6);
    expect(b.ppeak).toBeCloseTo(20, 3);
    expect(Math.abs(b.ppeak - 20)).toBeLessThan(TOL_P);
    expect(b.vtInsp).toBeCloseTo(0.5, 9);
    const hold = sim.procedures.last.inspHold!;
    expect(hold.quality).toBe('valid');
    expect(hold.values.pplat!.value).toBeCloseTo(15, 3);
    expect(hold.wallTimeMs).not.toBeNull();
  });
});

describe('BM-02 · Cstat y resistencia desde la misma respiración', () => {
  it('Cstat = 500/(15−5) = 50 mL/cmH2O; R = (20−15)/0.5 = 10', () => {
    const sim = benchSim();
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    runUntilBreath(sim, 1);
    const b = sim.breaths[0]!;
    const hold = sim.procedures.last.inspHold!;
    const cstat = hold.values.cstat!;
    expect(cstat.breathId).toBe(b.breathId);
    expect(complianceToMlPerCmH2O(cstat.value!)).toBeCloseTo(50, 2);
    expect(Math.abs(complianceToMlPerCmH2O(cstat.value!) - 50) / 50).toBeLessThan(TOL_VT);
    const q = b.vtInsp / b.tInspS;
    const r = (b.ppeak - hold.values.pplat!.value!) / q;
    expect(r).toBeCloseTo(10, 2);
  });
});

describe('BM-03 · Fuente de presión ideal (modelo, no modo PC)', () => {
  it('ΔP 10 sobre PEEP 5, R 10, C 0.05, 1 s: VT ≈ 0.432332 L; Q0 = 1 L/s; Qfin ≈ 0.135335 L/s', () => {
    const p = new PatientModel(BENCH_PATIENT, 0.05 * 5);
    expect(p.flowForPaw(15, 0)).toBeCloseTo(1.0, 9);
    let dv = 0;
    let qEnd = 0;
    const dt = 0.004;
    for (let i = 0; i < 250; i++) {
      const r = p.integratePressureSource(15, () => 0, i * dt, dt);
      dv += r.dV;
      qEnd = r.qEnd;
    }
    expect(dv).toBeCloseTo(0.432332, 4);
    expect(Math.abs(dv - 0.432332) / 0.432332).toBeLessThan(TOL_VT);
    expect(qEnd).toBeCloseTo(0.135335, 4);
  });
});

describe('BM-04 · Espiración incompleta (atrapamiento)', () => {
  it('Rexp 20, C 0.05, exceso 0.5 L, Te 0.5 s: exceso final ≈ 0.303265 L; presión elástica extra ≈ 6.0653 cmH2O', () => {
    const p = new PatientModel({ crs: 0.05, rInsp: 10, rExp: 20, r2: 0, p0: 0 }, 0.05 * 5 + 0.5);
    const dt = 0.004;
    for (let i = 0; i < 125; i++) p.integratePressureSource(5, () => 0, i * dt, dt);
    const excess = p.v - p.equilibriumVolume(5);
    expect(excess).toBeCloseTo(0.303265, 4);
    expect(p.pel() - 5).toBeCloseTo(6.0653, 3);
    expect(p.pel()).toBeCloseTo(11.0653, 3);
  });
});

describe('BM-05 · Unidades', () => {
  it('0.5 L/s → 30 L/min; 0.5 L·1 s → 500 mL; C 0.05 → 50 mL/cmH2O', () => {
    expect(lpsToLpm(0.5)).toBe(30);
    expect(litersToMl(0.5 * 1)).toBe(500);
    expect(complianceToMlPerCmH2O(0.05)).toBe(50);
  });
  it('el motor no confunde unidades: VTesp de banco = 500 mL exactos', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    expect(litersToMl(sim.breaths[1]!.vtExp)).toBeCloseTo(500, 0);
  });
});

/** Solución numérica independiente (Euler fino) para la respiración limitada por presión de BM-06a. */
function referenceLimitedVt(
  crs: number,
  r: number,
  peep: number,
  q: number,
  plimit: number,
  tInsp: number,
): { vt: number; tCross: number } {
  const h = 1e-5;
  let v = crs * peep;
  let t = 0;
  const v0 = v;
  let tCross = -1;
  while (t < tInsp - 1e-12) {
    const paw = v / crs + r * q; // Paw = Pel + R·Q (Pel ya incluye el volumen de equilibrio: PEEP no se suma otra vez)
    if (tCross < 0 && paw >= plimit) tCross = t;
    if (tCross < 0) v += q * h;
    else v += ((plimit - v / crs) / r) * h;
    t += h;
  }
  return { vt: v - v0, tCross };
}

describe('BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas', () => {
  // C = 0.02: Paw(t) = Pel(V0 + Q·t) + R·Q = 5 + 25·t + 5 = 10 + 25·t cmH2O (presión final sin límites = 35).
  const stiff = { ...BENCH_PATIENT, crs: 0.02 };
  it('Plimit 25 (< Pmáx 40): el flujo cae para mantener 25 durante el Tinsp restante; VT real < VT programado; ciclo por tiempo', () => {
    const sim = benchSim({ patient: stiff, settings: { ...BENCH_SETTINGS, plimit: 25, pmax: 40 } });
    runUntilBreath(sim, 1);
    const b = sim.breaths[0]!;
    expect(b.plimitReached).toBe(true);
    expect(b.pmaxReached).toBe(false);
    expect(b.cyclingCause).toBe('time');
    expect(b.tInspS).toBeCloseTo(1.0, 6);
    expect(b.ppeak).toBeCloseTo(25, 6);
    const ref = referenceLimitedVt(0.02, 10, 5, 0.5, 25, 1.0);
    expect(ref.tCross).toBeCloseTo(0.6, 3);
    expect(b.vtInsp).toBeLessThan(0.5);
    expect(Math.abs(b.vtInsp - ref.vt) / ref.vt).toBeLessThan(TOL_VT);
    // Analítico: 0.3 L en flujo + 0.1·(1−e⁻²) L a presión constante = 0.38647 L
    expect(b.vtInsp).toBeCloseTo(0.38647, 3);
    expect(sim.alarms.get('pmax')!.conditionActive).toBe(false);
  });
  it('Pmáx 30 (< Plimit 60): alcanzar Pmáx TERMINA la inspiración a 0.8 s; VT = 0.4 L; alarma Pmáx activa', () => {
    const sim = benchSim({ patient: stiff, settings: { ...BENCH_SETTINGS, plimit: 60, pmax: 30 } });
    runUntilBreath(sim, 1);
    const b = sim.breaths[0]!;
    expect(b.pmaxReached).toBe(true);
    expect(b.plimitReached).toBe(false);
    expect(b.cyclingCause).toBe('pmax');
    expect(b.tInspS).toBeCloseTo(0.8, 3);
    expect(b.vtInsp).toBeCloseTo(0.4, 3);
    expect(b.ppeak).toBeCloseTo(30, 6);
    const a = sim.alarms.get('pmax')!;
    expect(a.conditionActive).toBe(true);
    expect(a.rawValueAtOnset).toBeCloseTo(30, 6);
    expect(a.responseAction).toBe('endInspiration');
  });
  it('no fuerza el volumen objetivo bajo límites: VTesp medido difiere del VT programado', () => {
    const sim = benchSim({ patient: stiff, settings: { ...BENCH_SETTINGS, plimit: 25, pmax: 40 } });
    runUntilBreath(sim, 3);
    const f = sim.frame();
    expect(f.settings.vt).toBe(0.5);
    expect(f.metrics.vte!.value!).toBeLessThan(0.45);
  });
});

describe('BM-07 · Conservación de volumen (sin fuga)', () => {
  it('por respiración: VTinsp − VTesp = ΔV absoluto; acumulado en 10 respiraciones', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, rExp: 30 }, settings: { ...BENCH_SETTINGS, rr: 25, ie: 1 } });
    const v0 = sim.patient.v;
    runUntilBreath(sim, 10);
    let sumDiff = 0;
    for (let i = 0; i < sim.breaths.length; i++) {
      const b = sim.breaths[i]!;
      const next = sim.breaths[i + 1];
      const vEnd = next ? next.truthVStartL : sim.patient.v;
      expect(b.vtInsp - b.vtExp).toBeCloseTo(vEnd - b.truthVStartL, 6);
      sumDiff += b.vtInsp - b.vtExp;
    }
    expect(sumDiff).toBeCloseTo(sim.patient.v - v0, 6);
  });
});

describe('BM-08 · Convergencia con el paso de integración', () => {
  it('errores de VT decrecientes para dt = 4, 2, 1 ms en la respiración limitada por presión (RK2)', () => {
    const stiff = { ...BENCH_PATIENT, crs: 0.02 };
    // Referencia ANALÍTICA (no numérica): 0.3 L en flujo + 0.1·(1−e⁻²) L a presión constante durante 0.4 s con tau 0.2 s.
    const ref = 0.3 + 0.1 * (1 - Math.exp(-2));
    const errs = [4, 2, 1].map((dtMs) => {
      const sim = benchSim({ dtMs, patient: stiff, settings: { ...BENCH_SETTINGS, plimit: 25, pmax: 40 } });
      runUntilBreath(sim, 1);
      return Math.abs(sim.breaths[0]!.vtInsp - ref);
    });
    expect(errs[0]!).toBeGreaterThan(errs[1]!);
    expect(errs[1]!).toBeGreaterThan(errs[2]!);
    expect(errs[0]! / ref).toBeLessThan(TOL_VT);
  });
  it('los tiempos de evento (Ppico, Tinsp) no dependen del paso cuando el evento no cae en un múltiplo de dt', () => {
    // RR 32, I:E 1:1.5 → Tinsp 0.75 s (no múltiplo de 4 ms). Sub-pasos exactos: mismo Tinsp con dt 4 y 1 ms.
    const s = { ...BENCH_SETTINGS, rr: 32, ie: 1 / 1.5, vt: 0.285 };
    const a = benchSim({ dtMs: 4, settings: s });
    const b = benchSim({ dtMs: 1, settings: s });
    runUntilBreath(a, 2);
    runUntilBreath(b, 2);
    expect(a.breaths[1]!.tInspS).toBeCloseTo(0.75, 9);
    expect(b.breaths[1]!.tInspS).toBeCloseTo(0.75, 9);
    expect(a.breaths[1]!.vtInsp).toBeCloseTo(b.breaths[1]!.vtInsp, 9);
    expect(Math.abs(a.breaths[1]!.ppeak - b.breaths[1]!.ppeak)).toBeLessThan(1e-4); // acumulación flotante de V += Q·dt
  });
});
