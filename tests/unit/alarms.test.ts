import { describe, expect, it } from 'vitest';
import { AlarmEngine } from '../../src/engine/alarms';
import { DEFAULT_ALARM_LIMITS } from '../../src/profiles/r860-es-photo-reference/settings';
import { benchSim, runUntilBreath, BENCH_PATIENT, BENCH_SETTINGS } from '../helpers';

describe('ALM · estados separados (activa, reconocida, resuelta, audio)', () => {
  it('ALM-02: reconocer una alarma cuya condición persiste: sigue activa', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, crs: 0.02 }, settings: { ...BENCH_SETTINGS, plimit: 60, pmax: 30 } });
    runUntilBreath(sim, 2);
    expect(sim.alarms.get('pmax')!.conditionActive).toBe(true);
    sim.command({ type: 'acknowledgeAlarms', id: 'pmax' });
    const a = sim.alarms.get('pmax')!;
    expect(a.conditionActive).toBe(true);
    expect(a.acknowledgedAtMs).not.toBeNull();
    expect(sim.alarms.bar().color).toBe('red');
  });
  it('ALM-03: resolver sin reconocer deja estado pendiente (banda gris) distinguible de activa', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, crs: 0.02 }, settings: { ...BENCH_SETTINGS, plimit: 60, pmax: 30 } });
    runUntilBreath(sim, 2);
    expect(sim.alarms.bar().color).toBe('red');
    sim.command({ type: 'confirmSettings', changes: { pmax: 60 } });
    runUntilBreath(sim, 4);
    const a = sim.alarms.get('pmax')!;
    expect(a.conditionActive).toBe(false);
    expect(a.resolvedAtMs).not.toBeNull();
    expect(a.acknowledgedAtMs).toBeNull();
    expect(sim.alarms.bar().color).toBe('grey');
    sim.command({ type: 'acknowledgeAlarms' });
    expect(sim.alarms.bar().color).toBe('green');
  });
  it('ALM-07: límite Off no es cero; dato ausente no genera alarma ni valor normal', () => {
    const e = new AlarmEngine({ ...DEFAULT_ALARM_LIMITS, vteLow: 'off' });
    e.onBreath({ breathId: 'b1', sequence: 1, type: 'mandatory', startSimTimeMs: 0, endSimTimeMs: 4000, cyclingCause: 'time', tInspS: 1, tExpS: 3, ppeak: 20, pplatCycle: null, pplatCycleReason: 'noPause', peepe: 5, pmean: 8, vtInsp: 0.0, vtExp: 0.0, plimitReached: false, pmaxReached: false, truthVStartL: 0.25 }, {}, 4000);
    expect(e.get('vteLow')!.conditionActive).toBe(false);
    e.setLimits({ mveLow: 3 });
    e.onBreath({ breathId: 'b2', sequence: 2, type: 'mandatory', startSimTimeMs: 4000, endSimTimeMs: 8000, cyclingCause: 'time', tInspS: 1, tExpS: 3, ppeak: 20, pplatCycle: null, pplatCycleReason: 'noPause', peepe: 5, pmean: 8, vtInsp: 0.5, vtExp: 0.5, plimitReached: false, pmaxReached: false, truthVStartL: 0.25 }, { mve: { key: 'mve', value: null, unit: 'L/min', source: 'ventilator', simTimeMs: 8000, breathId: 'b2', procedureId: null, quality: 'inProgress', reason: 'ventanaInsuficiente', windowMs: null } }, 8000);
    expect(e.get('mveLow')!.conditionActive).toBe(false);
  });
  it('ALM-05/06: la alarma Pmáx se traza al valor bruto; varias alarmas concurrentes conservan todas las condiciones', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, crs: 0.02 }, settings: { ...BENCH_SETTINGS, plimit: 60, pmax: 30 }, alarmLimits: { ...DEFAULT_ALARM_LIMITS, vteLow: 0.45 } });
    runUntilBreath(sim, 3);
    const pm = sim.alarms.get('pmax')!;
    expect(pm.rawValueAtOnset).toBeCloseTo(30, 6);
    expect(sim.alarms.get('vteLow')!.conditionActive).toBe(true);
    const bar = sim.alarms.bar();
    expect(bar.activeCount).toBe(2);
    expect(bar.color).toBe('red');
  });
  it('FiO2: límites sobre el sensor con retardo; sesgo del instructor separa objetivo y medición (SC-12)', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, fio2: 1.0 }, alarmLimits: { ...DEFAULT_ALARM_LIMITS, fio2Low: 0.98 } });
    sim.run(40_000);
    expect(sim.alarms.get('fio2Low')!.conditionActive).toBe(false);
    sim.command({ type: 'setSensors', params: { fio2Bias: -0.03 } }, 'instructor');
    sim.run(40_000);
    const f = sim.frame();
    expect(f.settings.fio2).toBe(1.0);
    expect(f.metrics.fio2!.value!).toBeCloseTo(0.97, 3);
    expect(sim.alarms.get('fio2Low')!.conditionActive).toBe(true);
  });
});
