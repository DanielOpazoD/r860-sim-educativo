import { describe, expect, it } from 'vitest';
import { benchSim, BENCH_PATIENT, BENCH_SETTINGS, runUntilBreath } from '../helpers';
import { ALL_METRICS, metricStatus } from '../../src/ui/metricsTable';

const effort = { enabled: true, amplitude: 4, ratePerMin: 3, tiS: 3, phaseS: 0, shape: 'riseRelax' as const };

describe('fidelidad de medición: señal, validez y canales', () => {
  it('conserva Paw11 estable con músculo pero no certifica mecánica pasiva', () => {
    const sim = benchSim({ effort });
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    sim.run(3004);
    const r = sim.procedures.last.inspHold!;
    expect(r.values.pplat!.value).toBeCloseTo(11, 5);
    expect(r.quality).toBe('invalid');
    expect(r.reason).toBe('esfuerzoDuranteBloqueo');
    expect(r.signalQuality).toBe('valid');
    expect(r.passiveMechanicsValid).toBe(false);
    expect(r.values.cstat!.value).toBeNull();
    expect(r.values.driving!.value).toBeNull();
  });

  it('detecta esfuerzo al arranque del bloqueo aunque desaparezca antes de la ventana final', () => {
    const sim = benchSim({ effort: { ...effort, tiS: 0.2, phaseS: 1, shape: 'halfSine' } });
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    sim.run(3004);
    expect(sim.effort.pmusAt(3)).toBe(0);
    expect(sim.procedures.last.inspHold!.quality).toBe('invalid');
  });

  it('control pasivo: Pplat15, Cstat50, deltaP10', () => {
    const sim = benchSim();
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    sim.run(3004);
    const r = sim.procedures.last.inspHold!;
    expect(r.quality).toBe('valid');
    expect(r.values.pplat!.value).toBeCloseTo(15, 6);
    expect(r.values.cstat!.value).toBeCloseTo(0.05, 6);
    expect(r.values.driving!.value).toBeCloseTo(10, 6);
  });

  it.each([12, 100])('Plimit %s: balance por canal y flujo final', (plimit) => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, leakLpmAt10: 6 }, settings: { ...BENCH_SETTINGS, plimit } });
    let delivered = 0;
    let leaked = 0;
    let limitedLeak = 0;
    let expectedFlow: number | null = null;
    const integrate = sim.patient.integratePressureSource.bind(sim.patient);
    sim.patient.integratePressureSource = (...args) => {
      const r = integrate(...args);
      if (sim.controller.phase === 'inspLimited') {
        delivered += r.dV + r.dVLeak;
        leaked += r.dVLeak;
        limitedLeak += r.dVLeak;
        expectedFlow = r.qEnd + r.qLeakEnd;
      }
      return r;
    };
    const flow = sim.patient.integrateFlowSource.bind(sim.patient);
    sim.patient.integrateFlowSource = (...args) => {
      const before = sim.patient.vTotal;
      const r = flow(...args);
      if (sim.controller.phase === 'inspFlow') {
        delivered += args[0] * args[1];
        leaked += args[0] * args[1] - (sim.patient.vTotal - before);
      }
      return r;
    };
    const vStart = sim.patient.vTotal;
    while (sim.simTimeMs < 1000) {
      expectedFlow = null;
      sim.step();
      if (expectedFlow !== null) expect(sim.controller.q).toBeCloseTo(expectedFlow, 10);
    }
    const lungGain = sim.patient.vTotal - vStart;
    expect(delivered - leaked).toBeCloseTo(lungGain, 9);
    runUntilBreath(sim, 1);
    expect(sim.breaths[0]!.vtInsp).toBeCloseTo(delivered, 9);
    if (plimit === 12) {
      expect(limitedLeak).toBeCloseTo(0.071364, 5);
      expect(delivered).toBeCloseTo(0.406286, 5);
    } else expect(delivered).toBeCloseTo(0.5, 6);
  });

  it.each(['AC_VC', 'AC_PC', 'CPAP_PS'] as const)('%s: reproducción determinista con fuga y oclusión', (mode) => {
    const replay = () => {
      const sim = benchSim({
        seed: 73,
        patient: { ...BENCH_PATIENT, leakLpmAt10: 6 },
        settings: { ...BENCH_SETTINGS, mode, plimit: 12 },
        ...(mode === 'CPAP_PS' ? { effort: { ...effort, tiS: 0.8, phaseS: 0.5, ratePerMin: 15 } } : {}),
      });
      runUntilBreath(sim, 3);
      expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 }).accepted).toBe(true);
      sim.run(10000);
      expect(sim.procedures.last.inspHold).not.toBeNull();
      return { breaths: sim.breaths, hold: sim.procedures.last.inspHold, live: sim.frame().live };
    };
    expect(replay()).toEqual(replay());
  });

  it.each([0, 6])('oclusión con fuga %s: Paw es presión del nodo, Q ventilador cero', (leakLpmAt10) => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, leakLpmAt10 } });
    runUntilBreath(sim, 3);
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    while (sim.controller.phase !== 'holdInsp') sim.step();
    const vStart = sim.patient.vTotal;
    sim.run(100);
    const expected = sim.patient.pel() / (1 + (BENCH_PATIENT.rExp * leakLpmAt10) / 600);
    expect(sim.controller.paw).toBeCloseTo(expected, 6);
    expect(sim.controller.q).toBe(0);
    if (leakLpmAt10) expect(sim.patient.vTotal).toBeLessThan(vStart);
    else expect(sim.patient.vTotal).toBeCloseTo(vStart, 9);
  });

  it('VTi cero no produce porcentaje válido ni una etiqueta UI válida', () => {
    const sim = benchSim();
    runUntilBreath(sim, 1);
    const record = { ...sim.breaths[0]!, vtInsp: 0, vtExp: 0, vtInspMeasured: 0, vtExpMeasured: 0 };
    sim.metrics.onBreath(record);
    const frame = sim.frame();
    expect(frame.metrics.leakPct).toMatchObject({ value: null, quality: 'unavailable', reason: 'volumenInspiradoInsuficiente' });
    const spec = ALL_METRICS.find((m) => m.key === 'leakPct')!;
    expect(metricStatus(frame, spec).label).toBe('No disponible');
  });
});
