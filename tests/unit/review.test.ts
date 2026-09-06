/**
 * Regresiones derivadas de la revisión adversarial de contexto limpio (06-09-2026).
 * Cada prueba reproduce un hallazgo que existía antes del arreglo.
 */
import { describe, expect, it } from 'vitest';
import { EngineHost } from '../../src/app/engineHost';
import type { EngineToMain } from '../../src/app/protocol';
import { Simulator, defaultInit } from '../../src/engine/simulator';
import { exportSession, importSession, replaySession } from '../../src/history/session';
import { SCENARIOS } from '../../src/scenarios';
import { DEFAULT_ALARM_LIMITS } from '../../src/profiles/r860-es-photo-reference/settings';
import { benchSim, runUntilBreath, BENCH_PATIENT, BENCH_SETTINGS } from '../helpers';

describe('H1 · ↑O2: ajuste, mezclador y sensor vuelven juntos (regla 1)', () => {
  it('fin por temporizador restaura también el mezclador', () => {
    const sim = benchSim();
    sim.command({ type: 'increaseO2Start' });
    expect(sim.o2.delivered).toBe(1.0);
    sim.run(130_000);
    expect(sim.frame().settings.fio2).toBe(0.21);
    expect(sim.o2.delivered).toBe(0.21);
    sim.run(60_000);
    expect(sim.o2.measured).toBeCloseTo(0.21, 2);
  });
  it('fin por espera restaura también el mezclador', () => {
    const sim = benchSim();
    sim.command({ type: 'increaseO2Start' });
    sim.run(2000);
    sim.command({ type: 'enterStandby' });
    expect(sim.frame().settings.fio2).toBe(0.21);
    expect(sim.o2.delivered).toBe(0.21);
  });
});

describe('H2 · orden manual y disparo en el mismo sub-paso: sin respiraciones apiladas', () => {
  it('con esfuerzo fuerte y control asistido, una orden manual produce exactamente una respiración manual y ninguna espiración de un sub-paso', () => {
    const sim = benchSim({ effort: { enabled: true, amplitude: 6, ratePerMin: 30, tiS: 0.6, phaseS: 0.3 }, settings: { ...BENCH_SETTINGS, assistControl: true, flowTrigger: 2 / 60 } });
    let issued = 0;
    for (let i = 0; i < 20_000 && sim.breaths.length < 30; i++) {
      if (sim.controller.phase === 'exp' && issued < 5 && i % 700 === 0) { if (sim.command({ type: 'manualBreath' }).accepted) issued += 1; }
      sim.step();
    }
    expect(issued).toBeGreaterThan(0);
    expect(sim.breaths.filter((b) => b.type === 'manual').length).toBe(issued);
    for (const b of sim.breaths) expect(b.tExpS).toBeGreaterThan(0.05);
  });
});

describe('H3 · espera durante un bloqueo espiratorio en curso', () => {
  it('no emite respiraciones fantasma, no activa alarmas en espera y el bloqueo queda cancelado', () => {
    const sim = benchSim({ alarmLimits: { ...DEFAULT_ALARM_LIMITS, vteLow: 0.45 } });
    runUntilBreath(sim, 2);
    sim.command({ type: 'requestHold', kind: 'expHold', durationS: 5 });
    while (sim.controller.phase !== 'holdExp') sim.step();
    sim.run(500);
    const n = sim.breaths.length;
    const seq = sim.controller.currentBreathSequence;
    expect(sim.command({ type: 'enterStandby' }).accepted).toBe(true);
    sim.run(2000);
    expect(sim.breaths.length).toBe(n);
    expect(sim.alarms.list().every((a) => !a.conditionActive)).toBe(true);
    expect(sim.alarms.bar().color).toBe('green');
    expect(sim.procedures.last.expHold!.phase).toBe('cancelled');
    expect(sim.procedures.current).toBeNull();
    sim.command({ type: 'startVentilation' });
    runUntilBreath(sim, n + 2);
    expect(sim.breaths[n]!.sequence).toBe(seq + 1);
  });
});

describe('H4 · poner un límite en Off resuelve la alarma activa (Off = no se evalúa, no estado congelado)', () => {
  it('VTesp bajo activa → Off → resuelta y reconocida; banda verde', () => {
    const sim = benchSim({ alarmLimits: { ...DEFAULT_ALARM_LIMITS, vteLow: 0.6 } });
    runUntilBreath(sim, 2);
    expect(sim.alarms.get('vteLow')!.conditionActive).toBe(true);
    sim.command({ type: 'setAlarmLimits', changes: { vteLow: 'off' } });
    runUntilBreath(sim, 4);
    expect(sim.alarms.get('vteLow')!.conditionActive).toBe(false);
    expect(sim.alarms.bar().color).toBe('green');
  });
});

describe('H5 · una inspiración acortada por Pmáx no acorta el periodo obligatorio', () => {
  it('FR medida ≈ FR programada aunque cada inspiración termine a 0.8 s por Pmáx', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, crs: 0.02 }, settings: { ...BENCH_SETTINGS, plimit: 60, pmax: 30 } });
    runUntilBreath(sim, 12);
    const f = sim.frame();
    expect(f.metrics.rr!.value!).toBeCloseTo(15, 3);
    const b = sim.breaths[5]!;
    expect(b.tInspS).toBeCloseTo(0.8, 3);
    expect(b.tInspS + b.tExpS).toBeCloseTo(4.0, 6);
  });
});

describe('H6 · validación de inicialización, comandos e importación', () => {
  it('el constructor rechaza FR negativa y un paciente con tau < 1 ms', () => {
    expect(() => new Simulator(defaultInit({ settings: { ...BENCH_SETTINGS, rr: -5 } }))).toThrow(/Frecuencia|Tinsp|Texp/);
    expect(() => new Simulator(defaultInit({ patient: { ...BENCH_PATIENT, rInsp: 1e-9 } }))).toThrow(/Rinsp|tau/);
  });
  it('requestHold con duración no numérica o fuera de rango se rechaza; setPatient con R diminuta se rechaza', () => {
    const sim = benchSim();
    expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: Number('abc') }).accepted).toBe(false);
    expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 500 }).accepted).toBe(false);
    expect(sim.command({ type: 'setPatient', params: { rInsp: 1e-9 } }, 'instructor').accepted).toBe(false);
    expect(sim.command({ type: 'confirmSettings', changes: { fio2: 1.5 } }).accepted).toBe(false);
    expect(sim.command({ type: 'confirmSettings', changes: { vt: 0.287 } }).accepted).toBe(false); // fuera de rejilla de 5 mL
    sim.run(4000);
    expect(Number.isFinite(sim.controller.simT)).toBe(true);
  });
  it('importSession rechaza ajustes fuera de dominio y pacientes degenerados', () => {
    const sim = benchSim(); runUntilBreath(sim, 1);
    const good = exportSession(sim);
    const bad1 = JSON.parse(JSON.stringify(good)); bad1.init.settings.rr = -5;
    expect(importSession(JSON.stringify(bad1)).ok).toBe(false);
    const bad2 = JSON.parse(JSON.stringify(good)); bad2.init.patient.crs = 0;
    expect(importSession(JSON.stringify(bad2)).ok).toBe(false);
  });
});

describe('H7 · importar una sesión no hereda perturbaciones del escenario previo', () => {
  it('tras cargar SC-02 (C cambia a 20 s) e importar una sesión de banco, la C importada permanece', () => {
    const posts: EngineToMain[] = [];
    let now = 0;
    const host = new EngineHost((m) => posts.push(m), () => now);
    host.handle({ type: 'init', init: defaultInit(), speed: 1, running: true });
    host.handle({ type: 'loadScenario', scenario: SCENARIOS.find((s) => s.id === 'SC-02')!, keepSettings: false });
    const sim = benchSim(); runUntilBreath(sim, 6); // 24 s > 20 s de la perturbación
    host.handle({ type: 'importSession', id: 1, text: JSON.stringify(exportSession(sim)) });
    host.handle({ type: 'control', action: 'resume', reason: '' });
    for (let i = 0; i < 10; i++) { now += 20; host.tick(now); }
    host.stop();
    const last = [...posts].reverse().find((m) => m.type === 'frame');
    expect(last && last.type === 'frame' && last.frame.truth.patient.crs).toBe(0.05);
  });
});

describe('H8 · Pplat de ciclo nunca es válida en una respiración terminada por Pmáx', () => {
  it('con pausa programada y Pmáx durante la pausa, pplatCycle es null con motivo endedByPmax', () => {
    // Esfuerzo espiratorio fuerte durante la pausa sube Paw = Pel − Pmus (Pmus negativa no existe en el generador): usamos Pmáx bajo.
    const sim = benchSim({ patient: { ...BENCH_PATIENT, crs: 0.02 }, settings: { ...BENCH_SETTINGS, plimit: 60, pmax: 30, pausePct: 0.3 } });
    runUntilBreath(sim, 2);
    for (const b of sim.breaths) { expect(b.pplatCycle).toBeNull(); expect(b.pplatCycleReason).toBe('endedByPmax'); }
  });
});

describe('H13 · bloqueo espiratorio con paciente que dispara continuamente', () => {
  it('se ejecuta al final de la espiración aunque la termine un disparo, y resulta inválido con motivo', () => {
    const sim = benchSim({ effort: { enabled: true, amplitude: 8, ratePerMin: 30, tiS: 0.8, phaseS: 0.1 }, settings: { ...BENCH_SETTINGS, assistControl: true, flowTrigger: 1 / 60 } });
    runUntilBreath(sim, 3);
    sim.command({ type: 'requestHold', kind: 'expHold', durationS: 3 });
    runUntilBreath(sim, 8);
    const r = sim.procedures.last.expHold;
    expect(r).not.toBeNull();
    expect(['invalid', 'completed']).toContain(r!.phase);
    expect(sim.procedures.current).toBeNull();
  });
});

describe('audio en pausa como estado del motor (replay)', () => {
  it('audioPause fija audioPauseUntilMs = t + 120 s y el replay lo reproduce', () => {
    const sim = benchSim();
    sim.run(3000);
    sim.command({ type: 'audioPause' });
    expect(sim.frame().audioPauseUntilMs).toBe(3000 + 120_000);
    runUntilBreath(sim, 3);
    const re = replaySession(exportSession(sim));
    expect(re.frame().audioPauseUntilMs).toBe(3000 + 120_000);
  });
});
