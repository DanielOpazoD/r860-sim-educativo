import { describe, expect, it } from 'vitest';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';
import { EngineClient } from '../../src/app/engineClient';
import { EngineHost } from '../../src/app/engineHost';
import type { EngineToMain } from '../../src/app/protocol';
import { Simulator, defaultInit } from '../../src/engine/simulator';
import { EXP_BIAS_FLOW_LPS } from '../../src/engine/controller';
import { exportSession, importSession } from '../../src/history/session';

// Regresiones de la tercera revisión adversarial (06-09-2026): tope de flujo en PC, VTi con signo, flujo de base espiratorio,
// aviso de Plimit, Cstat con PEEPtot, validación de esfuerzo/sensores/claves/modo, versión del motor y arranque fallido visible.
const PC = { ...BENCH_SETTINGS, mode: 'AC_PC' as const, pinsp: 10, riseMs: 0 };

describe('R3-01 · tope de flujo del actuador en PC sin sobreimpulso ni Pmáx falsa', () => {
  it('C 5 mL/cmH₂O, R 0.5, Pmáx 17: la presión no supera PEEP + Pinsp y la inspiración termina por tiempo', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, crs: 0.005, rInsp: 0.5, rExp: 0.5 }, settings: { ...PC, pmax: 17 } });
    runUntilBreath(sim, 4);
    for (const b of sim.breaths) {
      expect(b.cyclingCause).toBe('time');
      expect(b.ppeak).toBeLessThanOrEqual(15 + 0.02);
      expect(b.vtInsp).toBeCloseTo(0.05, 3);
    }
    expect(sim.frame().alarms.find((a) => a.id === 'pmax')?.conditionActive).toBe(false);
  });
  it('la Ppico con tope activo no depende del paso de integración (4 ms vs 1 ms)', () => {
    const a = benchSim({ patient: { ...BENCH_PATIENT, crs: 0.01, rInsp: 0.5, rExp: 0.5 }, settings: { ...PC } });
    const b = benchSim({ patient: { ...BENCH_PATIENT, crs: 0.01, rInsp: 0.5, rExp: 0.5 }, settings: { ...PC }, dtMs: 1 });
    runUntilBreath(a, 3);
    runUntilBreath(b, 3);
    expect(Math.abs((a.breaths[2]?.ppeak ?? 0) - (b.breaths[2]?.ppeak ?? 0))).toBeLessThan(0.02);
    expect(a.breaths[2]?.ppeak ?? 99).toBeLessThanOrEqual(15.02);
  });
});

describe('R3-02 · el VTi nunca es negativo en PC tras bajar la PEEP', () => {
  it('PEEP 10 → 5 con Pinsp 3: el volumen que sale cuenta como espirado', () => {
    const sim = benchSim({ settings: { ...PC, peep: 10, pinsp: 3 } });
    runUntilBreath(sim, 2);
    expect(sim.command({ type: 'confirmSettings', changes: { peep: 5 } }).accepted).toBe(true);
    runUntilBreath(sim, 5);
    for (const b of sim.breaths) {
      expect(b.vtInsp).toBeGreaterThanOrEqual(0);
      expect(b.vtExp).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('R3-03 · flujo de base espiratorio: el esfuerzo hunde la Pva y no inhala sin límite', () => {
  it('sin asistencia, un esfuerzo de 8 cmH₂O en espiración baja la Pva por debajo de PEEP y VTe − VTi queda acotado por el flujo de base', () => {
    const sim = benchSim({
      effort: { enabled: true, amplitude: 8, ratePerMin: 15, tiS: 0.8, phaseS: 2.0 },
      settings: { ...BENCH_SETTINGS, assistControl: false },
    });
    let pawMin = Infinity;
    let qMax = -Infinity;
    let prevExp = false;
    while (sim.breaths.length < 8) {
      sim.step();
      const f = sim.frame();
      const isExp = f.live.phase === 'exp';
      if (isExp && prevExp) {
        // se omite la muestra de transición (una muestra de retardo en el anillo)
        pawMin = Math.min(pawMin, f.live.paw);
        qMax = Math.max(qMax, f.live.flowLps);
      }
      prevExp = isExp;
    }
    expect(pawMin).toBeLessThan(5 - 1);
    expect(qMax).toBeLessThanOrEqual(EXP_BIAS_FLOW_LPS + 1e-9);
    for (const b of sim.breaths.slice(2)) expect(b.vtExp - b.vtInsp).toBeLessThanOrEqual(EXP_BIAS_FLOW_LPS * 3 + 1e-6);
  });
  it('con asistencia, el mismo esfuerzo sigue disparando por flujo (2 L/min)', () => {
    const sim = benchSim({
      effort: { enabled: true, amplitude: 8, ratePerMin: 15, tiS: 0.8, phaseS: 2.0 },
      settings: { ...BENCH_SETTINGS, assistControl: true, flowTrigger: 2 / 60 },
    });
    runUntilBreath(sim, 8);
    expect(sim.breaths.filter((b) => b.type === 'assisted').length).toBeGreaterThanOrEqual(4);
  });
});

describe('R3-04 · aviso «Presión limitada por Plimit»', () => {
  it('con Plimit 7 la alarma de prioridad media se activa; al subir Plimit se resuelve', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, plimit: 7 } });
    runUntilBreath(sim, 2);
    const a = sim.frame().alarms.find((x) => x.id === 'plimit');
    expect(a?.conditionActive).toBe(true);
    expect(a?.priority).toBe('medium');
    expect(sim.frame().alarmBar.color).toBe('yellow');
    sim.command({ type: 'confirmSettings', changes: { plimit: 35 } });
    runUntilBreath(sim, 4);
    expect(sim.frame().alarms.find((x) => x.id === 'plimit')?.conditionActive).toBe(false);
  });
  it('Plimit por encima de Pmáx se acepta con aviso no bloqueante', () => {
    const sim = benchSim();
    const r = sim.command({ type: 'confirmSettings', changes: { plimit: 60, pmax: 40 } });
    expect(r.accepted).toBe(true);
  });
});

describe('R3-05 · Cstat del bloqueo inspiratorio usa PEEPtot cuando hay bloqueo espiratorio válido', () => {
  it('con atrapamiento (Rexp 30, FR 30) la Cstat vuelve a 50 mL/cmH₂O tras medir PEEPtot', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, rExp: 30 }, settings: { ...BENCH_SETTINGS, rr: 30, ie: 1, pausePct: 0 } });
    runUntilBreath(sim, 12);
    expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 }).accepted).toBe(true);
    runUntilBreath(sim, 16);
    const first = sim.frame().procedure.last.inspHold!;
    expect(first.quality).toBe('valid');
    expect(first.values.cstat?.value ?? 0).toBeLessThan(0.04); // sin PEEPtot: subestimada
    expect(sim.command({ type: 'requestHold', kind: 'expHold', durationS: 5 }).accepted).toBe(true);
    runUntilBreath(sim, 20);
    expect(sim.frame().procedure.last.expHold?.quality).toBe('valid');
    expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 }).accepted).toBe(true);
    runUntilBreath(sim, 24);
    const second = sim.frame().procedure.last.inspHold!;
    expect(second.quality).toBe('valid');
    expect(second.values.cstat?.value ?? 0).toBeCloseTo(0.05, 2);
    expect(second.values.cstat?.reason).toMatch(/PEEPtot/);
  });
});

describe('R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera', () => {
  it('confirmSettings rechaza claves desconocidas y modos inexistentes sin tocar los ajustes', () => {
    const sim = benchSim();
    expect(sim.command({ type: 'confirmSettings', changes: { foo: 123 } as never }).accepted).toBe(false);
    expect(sim.command({ type: 'confirmSettings', changes: { mode: 'BILEVEL' } as never }).accepted).toBe(false);
    expect(sim.command({ type: 'confirmSettings', changes: { mode: 42 } as never }).accepted).toBe(false);
    expect((sim.frame().settings as unknown as Record<string, unknown>).foo).toBeUndefined();
    expect(sim.frame().settings.mode).toBe('AC_VC');
  });
  it('el constructor rechaza esfuerzo y sensores no finitos o fuera de rango', () => {
    expect(() => benchSim({ effort: { enabled: true, amplitude: 1e6, ratePerMin: 15, tiS: 0.8, phaseS: 0 } })).toThrow(/esfuerzo/);
    expect(() => benchSim({ sensors: { fio2TauS: Number.NaN, fio2Bias: 0 } })).toThrow(/sensores/);
    expect(() => benchSim({ sensors: { fio2TauS: 6, fio2Bias: 100 } })).toThrow(/sesgo/);
  });
  it('la duración del bloqueo debe estar en la rejilla de su tipo (insp 2–40, esp 2–60)', () => {
    const sim = benchSim();
    expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 1.5 }).accepted).toBe(false);
    expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 60 }).accepted).toBe(false);
    expect(sim.command({ type: 'requestHold', kind: 'expHold', durationS: 33 }).accepted).toBe(false);
    expect(sim.command({ type: 'requestHold', kind: 'expHold', durationS: 60 }).accepted).toBe(true);
  });
  it('pasar a espera durante un bloqueo lo cierra con motivo «cancelledByStandby», no «cancelado por el usuario»', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 10 });
    while (sim.frame().procedure.hold?.phase !== 'running') sim.step();
    for (let i = 0; i < 50; i++) sim.step();
    expect(sim.command({ type: 'enterStandby' }).accepted).toBe(true);
    expect(sim.frame().procedure.last.inspHold?.reason).toBe('cancelledByStandby');
  });
});

describe('R3-07 · sesiones: PC se reimporta; versiones de motor aceptadas o rechazadas de forma explícita', () => {
  it('una sesión en A/C PC exporta e importa sin error', () => {
    const sim = benchSim({ settings: { ...PC } });
    runUntilBreath(sim, 3);
    const r = importSession(JSON.stringify(exportSession(sim)));
    expect(r.ok).toBe(true);
  });
  it('engineVersion 0.2.0 se acepta con aviso; 0.1.0 se rechaza; esfuerzo absurdo en init se rechaza', () => {
    const sim = benchSim();
    runUntilBreath(sim, 1);
    const good = exportSession(sim);
    const old = { ...good, engineVersion: '0.2.0' };
    const r1 = importSession(JSON.stringify(old));
    expect(r1.ok).toBe(true);
    expect(((r1 as { warnings?: string[] }).warnings ?? []).join(' ')).toMatch(/0\.2\.0/);
    expect(importSession(JSON.stringify({ ...good, engineVersion: '0.1.0' })).ok).toBe(false);
    const bad = { ...good, init: { ...good.init, effort: { ...good.init.effort, amplitude: 1e6 } } };
    expect(importSession(JSON.stringify(bad)).ok).toBe(false);
    const nan = { ...good, init: { ...good.init, sensors: { fio2TauS: 6, fio2Bias: 100 } } };
    expect(importSession(JSON.stringify(nan)).ok).toBe(false);
  });
});

describe('R3-08 · un arranque fallido nunca es silencioso', () => {
  it('el anfitrión responde initError y el cliente lo notifica por onDegraded', async () => {
    const posted: EngineToMain[] = [];
    const host = new EngineHost((m) => posted.push(m));
    host.handle({ type: 'init', init: { ...defaultInit({}), dtMs: 100 }, speed: 1, running: true });
    expect(posted[0]?.type).toBe('initError');
    const client = new EngineClient({ forceInline: true });
    const reasons: string[] = [];
    client.onDegraded = (r) => reasons.push(r);
    await client.ready;
    client.init({ ...defaultInit({}), dtMs: 100 }, 1, true);
    expect(reasons[0]).toMatch(/no se pudo iniciar/);
    expect(reasons[0]).toMatch(/dtMs/);
  });
  it('una orden pendiente al degradar el Worker se responde como rechazada en vez de quedar colgada', async () => {
    class DeadWorker {
      onmessage: ((e: { data: EngineToMain }) => void) | null = null;
      onerror: ((e: { message: string }) => void) | null = null;
      postMessage(m: { type: string }): void {
        if (m.type === 'init') queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } }));
        if (m.type === 'command') queueMicrotask(() => this.onerror?.({ message: 'crash' }));
      }
      terminate(): void {}
    }
    const g = globalThis as { Worker?: unknown };
    const prev = g.Worker;
    g.Worker = DeadWorker;
    try {
      const client = new EngineClient({ readyTimeoutMs: 200 });
      client.init(benchSim().init, 1, false);
      await client.ready;
      const r = await Promise.race([
        client.command({ type: 'acknowledgeAlarms' }),
        new Promise<{ accepted: boolean; reason?: string }>((res) => setTimeout(() => res({ accepted: true, reason: 'TIMEOUT' }), 500)),
      ]);
      expect(r.reason).not.toBe('TIMEOUT');
      expect(r.accepted).toBe(false);
      expect(r.reason).toMatch(/degradado/);
      expect(client.mode).toBe('inline');
    } finally {
      g.Worker = prev;
    }
  });
});

// Reemplaza al test que citaba E-032: el bloqueo inspiratorio pedido cuando Pmáx termina la inspiración deja resultado inválido con motivo.
describe('R3-09 · bloqueo inspiratorio rechazado por Pmáx queda registrado', () => {
  it('SC-09-like (Rinsp 400): resultado inválido, con motivo y hora', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, rInsp: 400 }, settings: { ...BENCH_SETTINGS, plimit: 60 } });
    runUntilBreath(sim, 2);
    expect(sim.breaths[1]?.cyclingCause).toBe('pmax');
    expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 }).accepted).toBe(true);
    runUntilBreath(sim, 4);
    const h = sim.frame().procedure.last.inspHold;
    expect(h?.quality).toBe('invalid');
    expect(h?.reason).toBeTruthy();
    expect(h?.wallTimeMs).not.toBeNull();
    expect(new Simulator(sim.init).init).toBeTruthy();
  });
});
