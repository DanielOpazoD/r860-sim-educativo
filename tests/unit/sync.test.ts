import { describe, expect, it } from 'vitest';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';
import { validateVcSettings } from '../../src/domain/validation';
import { VC_ADULT_CROSS_LIMITS } from '../../src/profiles/r860-es-photo-reference/settings';

// Cierre de U-33/U-35: flujo de base ajustable (D 2–10 L/min), disparo por presión (D −10…−0.25 cmH₂O) y resistencia de la rama espiratoria.
const effort = { enabled: true, amplitude: 6, ratePerMin: 15, tiS: 0.8, phaseS: 2.0 };
function expStats(sim: ReturnType<typeof benchSim>, breaths: number): { pawMin: number; pawMax: number; qMin: number; qMaxIn: number } {
  let pawMin = Infinity,
    pawMax = -Infinity,
    qMin = Infinity,
    qMaxIn = -Infinity,
    prevExp = false;
  while (sim.breaths.length < breaths) {
    sim.step();
    const f = sim.frame();
    const isExp = f.live.phase === 'exp';
    if (isExp && prevExp) {
      pawMin = Math.min(pawMin, f.live.paw);
      pawMax = Math.max(pawMax, f.live.paw);
      qMin = Math.min(qMin, f.live.flowLps);
      qMaxIn = Math.max(qMaxIn, f.live.flowLps);
    }
    prevExp = isExp;
  }
  return { pawMin, pawMax, qMin, qMaxIn };
}

describe('SYN-01 · flujo de base programable', () => {
  it('con flujo de base 10 L/min el paciente toma hasta 10 L/min sin hundir la Pva; con 2 L/min la hunde antes', () => {
    const hi = benchSim({ effort, settings: { ...BENCH_SETTINGS, assistControl: false, biasFlow: 10 / 60 } });
    const lo = benchSim({ effort, settings: { ...BENCH_SETTINGS, assistControl: false, biasFlow: 2 / 60 } });
    const a = expStats(hi, 6),
      b = expStats(lo, 6);
    expect(a.qMaxIn).toBeLessThanOrEqual(10 / 60 + 1e-9);
    expect(b.qMaxIn).toBeLessThanOrEqual(2 / 60 + 1e-9);
    expect(b.pawMin).toBeLessThan(a.pawMin); // menos flujo de base → deflexión de presión mayor
  });
  it('el disparo por flujo no puede superar el flujo de base (motivo legible)', () => {
    const v = validateVcSettings({ ...BENCH_SETTINGS, flowTrigger: 5 / 60, biasFlow: 2 / 60 }, VC_ADULT_CROSS_LIMITS);
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/flujo de base/);
    expect(validateVcSettings({ ...BENCH_SETTINGS, flowTrigger: 5 / 60, biasFlow: 5 / 60 }, VC_ADULT_CROSS_LIMITS).ok).toBe(true);
    expect(benchSim().command({ type: 'confirmSettings', changes: { flowTrigger: 9 / 60 } }).accepted).toBe(false);
  });
});

describe('SYN-02 · disparo por presión', () => {
  it('con umbral −2 cmH₂O el esfuerzo dispara asistidas; con −10 no llega y las respiraciones siguen siendo mandatorias', () => {
    const easy = benchSim({ effort, settings: { ...BENCH_SETTINGS, assistControl: true, triggerByPressure: true, pressureTrigger: -2 } });
    runUntilBreath(easy, 10);
    expect(easy.breaths.filter((b) => b.type === 'assisted').length).toBeGreaterThanOrEqual(4);
    const hard = benchSim({ effort, settings: { ...BENCH_SETTINGS, assistControl: true, triggerByPressure: true, pressureTrigger: -10 } });
    runUntilBreath(hard, 10);
    expect(hard.breaths.every((b) => b.type === 'mandatory')).toBe(true);
  });
  it('el disparo por presión ignora el umbral de flujo (flujo de disparo alto no bloquea)', () => {
    const sim = benchSim({
      effort,
      settings: {
        ...BENCH_SETTINGS,
        assistControl: true,
        triggerByPressure: true,
        pressureTrigger: -1,
        flowTrigger: 9 / 60,
        biasFlow: 10 / 60,
      },
    });
    runUntilBreath(sim, 10);
    expect(sim.breaths.some((b) => b.type === 'assisted')).toBe(true);
  });
});

describe('SYN-03 · resistencia de la rama espiratoria', () => {
  it('con 3 cmH₂O·s/L la Pva queda por encima de PEEP al inicio de la espiración y el flujo pico espiratorio baja; el VT espirado se conserva', () => {
    const ideal = benchSim();
    const valve = benchSim({ patient: { ...BENCH_PATIENT, rExpValve: 3 } });
    const a = expStats(ideal, 4),
      b = expStats(valve, 4);
    expect(a.pawMax).toBeCloseTo(5, 6);
    expect(b.pawMax).toBeGreaterThan(5.5);
    expect(Math.abs(b.qMin)).toBeLessThan(Math.abs(a.qMin));
    // Ppico teórico espiratorio: (Pplat − PEEP)/(Rexp + Rválvula) = 10/13 L/s
    expect(Math.abs(b.qMin)).toBeCloseTo(10 / 13, 1);
    expect(valve.breaths[3]?.vtExp ?? 0).toBeCloseTo(0.5, 2);
  });
  it('se valida en 0–6 y se conserva en la sesión', () => {
    expect(benchSim().command({ type: 'setPatient', params: { rExpValve: 7 } }).accepted).toBe(false);
    expect(benchSim().command({ type: 'setPatient', params: { rExpValve: 2.5 } }).accepted).toBe(true);
    expect(() => benchSim({ patient: { ...BENCH_PATIENT, rExpValve: -1 } })).toThrow(/rama espiratoria/);
  });
});
