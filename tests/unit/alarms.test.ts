import { describe, expect, it } from 'vitest';
import { AlarmEngine } from '../../src/engine/alarms';
import { DEFAULT_ALARM_LIMITS } from '../../src/profiles/adulto-referencia/settings';
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
    e.onBreath(
      {
        breathId: 'b1',
        sequence: 1,
        type: 'mandatory',
        startSimTimeMs: 0,
        endSimTimeMs: 4000,
        cyclingCause: 'time',
        tInspS: 1,
        tExpS: 3,
        ppeak: 20,
        pplatCycle: null,
        pplatCycleReason: 'noPause',
        peepe: 5,
        pmean: 8,
        vtInsp: 0.0,
        vtExp: 0.0,
        plimitReached: false,
        pmaxReached: false,
        truthVStartL: 0.25,
      },
      {},
      4000,
    );
    expect(e.get('vteLow')!.conditionActive).toBe(false);
    e.setLimits({ mveLow: 3 });
    e.onBreath(
      {
        breathId: 'b2',
        sequence: 2,
        type: 'mandatory',
        startSimTimeMs: 4000,
        endSimTimeMs: 8000,
        cyclingCause: 'time',
        tInspS: 1,
        tExpS: 3,
        ppeak: 20,
        pplatCycle: null,
        pplatCycleReason: 'noPause',
        peepe: 5,
        pmean: 8,
        vtInsp: 0.5,
        vtExp: 0.5,
        plimitReached: false,
        pmaxReached: false,
        truthVStartL: 0.25,
      },
      {
        mve: {
          key: 'mve',
          value: null,
          unit: 'L/min',
          source: 'ventilator',
          simTimeMs: 8000,
          breathId: 'b2',
          procedureId: null,
          quality: 'inProgress',
          reason: 'ventanaInsuficiente',
          windowMs: null,
        },
      },
      8000,
    );
    expect(e.get('mveLow')!.conditionActive).toBe(false);
  });
  it('ALM-05/06: la alarma Pmáx se traza al valor bruto; varias alarmas concurrentes conservan todas las condiciones', () => {
    const sim = benchSim({
      patient: { ...BENCH_PATIENT, crs: 0.02 },
      settings: { ...BENCH_SETTINGS, plimit: 60, pmax: 30 },
      alarmLimits: { ...DEFAULT_ALARM_LIMITS, vteLow: 0.45 },
    });
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

// ALM-URM · filtros, retardos y alarmas no habilitadas del equipo (URM SW10 2065490-001, 8-8 y 8-25 a 8-27).
describe('ALM-URM · el sistema de alarmas se comporta como el del manual', () => {
  it('filtros: con el paciente desconectado, las de volumen y FR salen de la lista y la banda sólo cuenta la desconexión', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, assistControl: true, biasFlow: 4 / 60, flowTrigger: 2 / 60 } });
    runUntilBreath(sim, 3);
    sim.command({ type: 'setPatient', params: { disconnected: true } });
    runUntilBreath(sim, 8);
    const lista = sim.frame().alarms;
    const vte = lista.find((a) => a.id === 'vteLow')!;
    expect(vte.conditionActive).toBe(true); // la condición se sigue evaluando
    expect(vte.filteredBy).toBe('disconnect'); // pero el equipo la retira de la lista
    expect(lista.find((a) => a.id === 'disconnect')!.filteredBy ?? null).toBeNull();
    const visibles = lista.filter((a) => a.conditionActive && !a.filteredBy).map((a) => a.id);
    expect(visibles).toContain('disconnect');
    expect(visibles).not.toContain('vteLow');
    expect(sim.frame().alarmBar.activeCount).toBe(visibles.length);
  });

  it('Ppico alta retira Ppico baja: el motor de alarmas lo aplica en la lista y en la banda', () => {
    const al = new AlarmEngine({ ...DEFAULT_ALARM_LIMITS, ppeakLow: 25 });
    al.onPmaxReached(1000, 31, 31, 30);
    const rec = { ppeak: 20, vtExp: 0.5, peepe: 5, pmaxReached: true } as never;
    al.onBreath(rec, {}, 4000);
    const lista = al.list();
    expect(lista.find((a) => a.id === 'ppeakLow')!.conditionActive).toBe(true);
    expect(lista.find((a) => a.id === 'ppeakLow')!.filteredBy).toBe('pmax');
    expect(al.bar().activeCount).toBe(1);
  });

  it('tras un bloqueo, VMesp bajo y FR baja esperan 60 s aunque la condición se cumpla', () => {
    const sim = benchSim();
    runUntilBreath(sim, 3);
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    while (!sim.procedures.last.inspHold) sim.step();
    const finBloqueo = sim.simTimeMs;
    // Un límite que la ventilación incumple: con el retardo, no se anuncia hasta pasados 60 s del fin del bloqueo.
    sim.command({ type: 'setAlarmLimits', changes: { mveLow: 10 } });
    sim.run(30_000);
    expect(sim.alarms.get('mveLow')!.conditionActive).toBe(false);
    while (sim.simTimeMs < finBloqueo + 65_000) sim.step();
    expect(sim.alarms.get('mveLow')!.conditionActive).toBe(true);
  });

  it('las alarmas de FiO2 esperan 60 s tras cambiar la FiO2: el sensor tarda en seguir al mezclador', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, fio2: 0.21 } });
    runUntilBreath(sim, 2);
    sim.command({ type: 'setAlarmLimits', changes: { fio2High: 0.5 } });
    sim.command({ type: 'confirmSettings', changes: { fio2: 0.8 } });
    runUntilBreath(sim, 4);
    const t0 = sim.simTimeMs;
    while (sim.simTimeMs < t0 + 30_000) sim.step();
    expect(sim.frame().metrics.fio2!.value!).toBeGreaterThan(0.5); // el sensor ya marca sobre el límite
    expect(sim.alarms.get('fio2High')!.conditionActive).toBe(false);
    sim.run(40_000);
    expect(sim.alarms.get('fio2High')!.conditionActive).toBe(true);
  });

  it('al pasar de espera a ventilar, VTesp bajo espera 60 s y la desconexión 10', () => {
    const sim = benchSim({ alarmLimits: { ...DEFAULT_ALARM_LIMITS, vteLow: 0.6 } });
    sim.command({ type: 'enterStandby' });
    sim.run(1000);
    sim.command({ type: 'startVentilation' });
    const t0 = sim.simTimeMs;
    sim.run(40_000);
    expect(sim.alarms.get('vteLow')!.conditionActive).toBe(false);
    while (sim.simTimeMs < t0 + 75_000) sim.step();
    expect(sim.alarms.get('vteLow')!.conditionActive).toBe(true);
  });

  it('la apnea no se habilita durante un bloqueo', () => {
    const al = new AlarmEngine(DEFAULT_ALARM_LIMITS);
    al.onHoldStart('expHold');
    al.onApnea(1000, 20);
    expect(al.get('apnea')!.conditionActive).toBe(false);
    al.onHoldEnd(2000);
    al.onApnea(3000, 20);
    expect(al.get('apnea')!.conditionActive).toBe(true);
  });
});

// ALM-PLIMIT · las dos alarmas del equipo ligadas a Plimit y al volumen entregado (URM SW10 8-20 y 8-21), y su rebaja
// con la pausa de audio (nota 4 de la lista, 8-8; 8-7).
describe('ALM-PLIMIT · Plimit alcanzada y VT no entregado', () => {
  /** Banco en VC con Rinsp 60: la presión resistiva lleva la Ppico muy por encima de un Plimit de 25. */
  const limitado = () => benchSim({ patient: { ...BENCH_PATIENT, rInsp: 60 }, settings: { ...BENCH_SETTINGS, plimit: 25, pmax: 60 } });

  it('Plimit alcanzada salta en la primera respiración recortada; VT no entregado espera seis seguidas', () => {
    const sim = limitado();
    runUntilBreath(sim, 2);
    expect(sim.alarms.get('plimit')!.conditionActive).toBe(true);
    expect(sim.alarms.get('plimit')!.priority).toBe('medium');
    const b = sim.breaths.at(-1)!;
    expect(b.vtSetL).toBe(BENCH_SETTINGS.vt);
    expect(b.vtInspMeasured! / b.vtSetL!).toBeLessThan(0.8);
    expect(sim.alarms.get('vtNotDelivered')!.conditionActive).toBe(false);
    runUntilBreath(sim, 5);
    expect(sim.alarms.get('vtNotDelivered')!.conditionActive).toBe(false);
    runUntilBreath(sim, 6);
    expect(sim.alarms.get('vtNotDelivered')!.conditionActive).toBe(true);
    // Quitar el recorte: la primera respiración que entrega el VT resuelve las dos.
    sim.command({ type: 'confirmSettings', changes: { plimit: 100 } });
    runUntilBreath(sim, 8);
    expect(sim.alarms.get('plimit')!.conditionActive).toBe(false);
    expect(sim.alarms.get('vtNotDelivered')!.conditionActive).toBe(false);
  });

  it('un VT corto por menos del 20 % no cuenta; en presión control no se evalúa', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS } });
    runUntilBreath(sim, 10);
    expect(sim.alarms.get('vtNotDelivered')!.conditionActive).toBe(false);
    const pc = benchSim({ settings: { ...BENCH_SETTINGS, mode: 'AC_PC', pinsp: 3 } });
    runUntilBreath(pc, 10);
    expect(pc.breaths.at(-1)!.vtSetL).toBeNull();
    expect(pc.alarms.get('vtNotDelivered')!.conditionActive).toBe(false);
  });

  it('la pausa de audio las rebaja a prioridad baja hasta que se resuelven; las demás conservan la suya', () => {
    const sim = limitado();
    sim.command({ type: 'setAlarmLimits', changes: { vteLow: 0.45 } });
    runUntilBreath(sim, 7);
    expect(sim.alarms.get('vtNotDelivered')!.conditionActive).toBe(true);
    expect(sim.alarms.get('vteLow')!.conditionActive).toBe(true);
    sim.command({ type: 'audioPause' });
    expect(sim.alarms.get('plimit')!.priority).toBe('informational');
    expect(sim.alarms.get('vtNotDelivered')!.priority).toBe('informational');
    expect(sim.alarms.get('vteLow')!.priority).toBe('medium');
    // Resuelta y vuelta a aparecer, recupera su prioridad.
    sim.command({ type: 'confirmSettings', changes: { plimit: 100 } });
    runUntilBreath(sim, 9);
    expect(sim.alarms.get('plimit')!.conditionActive).toBe(false);
    sim.command({ type: 'confirmSettings', changes: { plimit: 25 } });
    runUntilBreath(sim, 11);
    expect(sim.alarms.get('plimit')!.conditionActive).toBe(true);
    expect(sim.alarms.get('plimit')!.priority).toBe('medium');
  });
});
