import { describe, expect, it } from 'vitest';
import { benchSim, BENCH_PATIENT, BENCH_SETTINGS, runUntilBreath } from '../helpers';
import { Simulator } from '../../src/engine/simulator';
import { defaultInit, R860_PROFILE } from '../../src/profiles';
import { SCENARIOS } from '../../src/scenarios';
import { LESSON_TESTS } from '../../src/ui/lesson';
import { ALL_METRICS, metricStatus } from '../../src/ui/metricsTable';
import { AVISO_ESFUERZO, tarjetas } from '../../src/ui/teaching';

const effort = { enabled: true, amplitude: 4, ratePerMin: 3, tiS: 3, phaseS: 0, shape: 'riseRelax' as const };

describe('fidelidad de medición: señal, validez y canales', () => {
  it('con músculo y meseta estable el equipo publica lo que mide; el modelo la marca como no pasiva', () => {
    const sim = benchSim({ effort });
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    sim.run(3004);
    const r = sim.procedures.last.inspHold!;
    // Lo que vería el ventilador: sólo juzga la presión, y la presión es estable.
    expect(r.quality).toBe('valid');
    expect(r.values.pplat!.value).toBeCloseTo(11, 5);
    expect(r.values.driving!.value).toBeCloseTo(6, 5);
    expect(r.values.cstat!.value).toBeCloseTo(0.5 / 6, 5);
    // Lo que sabe el modelo y usa la capa docente.
    expect(r.passiveMechanicsValid).toBe(false);
  });

  it('Aula: las tarjetas conservan el número del equipo y añaden el aviso del modelo sólo con esfuerzo', () => {
    for (const conEsfuerzo of [true, false]) {
      const sim = conEsfuerzo ? benchSim({ effort }) : benchSim();
      sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
      sim.run(3004);
      const cards = tarjetas(sim.frame());
      for (const id of ['ppico', 'pplat', 'driving', 'cstat']) {
        const card = cards.find((c) => c.id === id)!;
        expect(card.aviso ?? null, id).toBe(conEsfuerzo ? AVISO_ESFUERZO : null);
      }
      expect(cards.find((c) => c.id === 'pplat')!.valor).toBeCloseTo(conEsfuerzo ? 11 : 15, 5);
    }
  });

  it('detecta esfuerzo al arranque del bloqueo aunque desaparezca antes de la ventana final', () => {
    const sim = benchSim({ effort: { ...effort, tiS: 0.2, phaseS: 1, shape: 'halfSine' } });
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    sim.run(3004);
    expect(sim.effort.pmusAt(3)).toBe(0);
    expect(sim.procedures.last.inspHold!.passiveMechanicsValid).toBe(false);
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

describe('cierre de coherencia de pausa y SC-18', () => {
  it.each([false, true])('pausa estable: conserva presión observada; esfuerzo=%s', (enabled) => {
    const sim = benchSim({
      settings: { ...BENCH_SETTINGS, pausePct: 0.2 },
      effort: { ...effort, enabled, tiS: 1 },
    });
    runUntilBreath(sim, 1);
    expect(sim.frame().metrics.pplatCycle).toMatchObject({
      value: enabled ? expect.closeTo(11, 6) : expect.closeTo(15, 6),
      quality: 'valid',
      reason: null,
    });
    expect(sim.breaths.at(-1)!.effortDuringPause).toBe(enabled);
  });

  it('pausa: no pierde el esfuerzo inicial aunque la cola y Pmus final sean pasivos', () => {
    const sim = benchSim({
      settings: { ...BENCH_SETTINGS, pausePct: 0.2 },
      effort: { ...effort, shape: 'halfSine', tiS: 0.02, phaseS: 0.8 },
    });
    runUntilBreath(sim, 1);
    expect(sim.frame().metrics.pplatCycle).toMatchObject({ value: expect.closeTo(15, 6), quality: 'valid' });
    expect(sim.breaths.at(-1)!.effortDuringPause).toBe(true);
  });

  it('SC-18: el objetivo acepta la maniobra con esfuerzo tras la perturbación, no cancelaciones ni resultados previos', () => {
    const e = SCENARIOS.find((s) => s.id === 'SC-18')!;
    const sim = new Simulator(
      defaultInit({
        patient: e.patient,
        effort: e.effort,
        sensors: e.sensors,
        settings: { ...BENCH_SETTINGS, ...e.settings },
      }),
      R860_PROFILE,
    );
    sim.run(40000);
    sim.command({ type: 'setPatient', params: { rExp: 60 } });
    runUntilBreath(sim, sim.breaths.length + 6);
    expect(sim.command({ type: 'requestHold', kind: 'expHold', durationS: 2 }).accepted).toBe(true);
    for (let i = 0; i < 20000 && !sim.procedures.last.expHold; i++) sim.step();
    expect(sim.procedures.last.expHold).not.toBeNull();
    const frame = sim.frame();
    const context = {
      frame,
      scenarioId: e.id,
      lessonStartMs: 0,
      patientChangeMs: 40000,
      settingsChangeMs: -1,
      perturbationMs: 40000,
      flags: {},
    };
    const task = e.lesson!.tasks.find((t) => t.id === 'peepi')!;
    const h = frame.procedure.last.expHold!;
    expect(h).toMatchObject({ phase: 'completed', passiveMechanicsValid: false });
    expect(LESSON_TESTS[task.test]!(context)).toBe(true);
    h.startedAtMs = 39000;
    expect(LESSON_TESTS[task.test]!(context)).toBe(false);
    h.startedAtMs = 50000;
    h.phase = 'cancelled';
    expect(LESSON_TESTS[task.test]!(context)).toBe(false);
  });
});
