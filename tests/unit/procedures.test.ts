import { describe, expect, it } from 'vitest';
import { benchSim, runUntilBreath, BENCH_SETTINGS } from '../helpers';
import { cstatFromSamples } from '../../src/domain/consistency';
import type { Simulator } from '../../src/engine/simulator';

const phaseOf = (sim: Simulator): string => sim.controller.phase;

describe('PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado', () => {
  it('PRC-01: el resultado del bloqueo conserva su hora y valores tras muchas respiraciones (abrir/cerrar ventana)', () => {
    const sim = benchSim();
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    runUntilBreath(sim, 2);
    const r1 = sim.procedures.last.inspHold!;
    expect(r1.phase).toBe('completed');
    expect(r1.actualDurationS).toBeCloseTo(3, 6);
    const wall = r1.wallTimeMs!;
    runUntilBreath(sim, 30);
    for (let i = 0; i < 100; i++) sim.frame();
    const r2 = sim.frame().procedure.last.inspHold!;
    expect(r2.procedureId).toBe(r1.procedureId);
    expect(r2.wallTimeMs).toBe(wall);
    expect(r2.values.pplat!.value).toBe(r1.values.pplat!.value);
    // Bloqueo pedido en t=0 (inspiración de b1, Tinsp 1 s): ocluye de 1.0 a 4.0 s → 18-Ago-2026 21:04:05 (UTC-4) + 4.000 s
    expect(new Date(wall).toISOString()).toBe('2026-08-19T01:04:09.000Z');
  });
  it('PRC-02: bloqueo con esfuerzo del escenario (SC-10) resulta inválido por meseta perturbada; sin Cstat fabricada', () => {
    const sim = benchSim({
      effort: { enabled: true, amplitude: 8, ratePerMin: 30, tiS: 0.8, phaseS: 0.2 },
      settings: { ...BENCH_SETTINGS, assistControl: false },
    });
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    runUntilBreath(sim, 2);
    const r = sim.procedures.last.inspHold!;
    expect(r.quality).toBe('invalid');
    expect(r.reason).toBe('mesetaPerturbada');
    expect(r.values.pplat!.value).toBeNull();
    expect(r.values.cstat!.value).toBeNull();
  });
  it('PRC-03: cancelar dos veces es seguro; ↑O2 restaura una sola vez y respeta una edición del usuario', () => {
    const sim = benchSim();
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 5 });
    expect(sim.command({ type: 'cancelProcedure' }).accepted).toBe(true);
    expect(sim.command({ type: 'cancelProcedure' }).accepted).toBe(false);
    expect(sim.procedures.current).toBeNull();
    // ↑O2: +100 % → 1.0; parar → restaura 0.21 exactamente una vez.
    expect(sim.command({ type: 'increaseO2Start' }).accepted).toBe(true);
    expect(sim.frame().settings.fio2).toBe(1.0);
    expect(sim.command({ type: 'increaseO2Start' }).accepted).toBe(false);
    expect(sim.command({ type: 'increaseO2Stop' }).accepted).toBe(true);
    expect(sim.frame().settings.fio2).toBe(0.21);
    expect(sim.o2.delivered).toBe(0.21); // el mezclador también (H1)
    expect(sim.command({ type: 'increaseO2Stop' }).accepted).toBe(false);
    expect(sim.frame().settings.fio2).toBe(0.21);
    // Edición del usuario durante ↑O2: prevalece (no se sobrescribe con el valor viejo).
    sim.command({ type: 'increaseO2Start' });
    sim.command({ type: 'confirmSettings', changes: { fio2: 0.4 } });
    sim.run(130_000);
    expect(sim.procedures.o2!.active).toBe(false);
    expect(sim.procedures.o2!.endCause).toBe('timer');
    expect(sim.frame().settings.fio2).toBe(0.4);
    expect(sim.procedures.last.increaseO2!.reason).toMatch(/FiO2EditadaPorUsuario/);
  });
  it('PRC-05: un segundo bloqueo mientras hay uno en cola se rechaza con motivo', () => {
    const sim = benchSim();
    expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 }).accepted).toBe(true);
    const r = sim.command({ type: 'requestHold', kind: 'expHold', durationS: 3 });
    expect(r.accepted).toBe(false);
    expect(r.reason).toMatch(/PRC-05/);
  });
  it('un bloqueo cancelado en curso deja resultado «cancelled» con duración parcial y no borra el válido anterior del historial', () => {
    const sim = benchSim();
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    runUntilBreath(sim, 2);
    const ok = sim.procedures.last.inspHold!;
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 10 });
    while (phaseOf(sim) !== 'holdInsp') sim.step();
    sim.run(1000);
    sim.command({ type: 'cancelProcedure' });
    const c = sim.procedures.last.inspHold!;
    expect(c.phase).toBe('cancelled');
    expect(c.actualDurationS!).toBeLessThan(2);
    expect(c.procedureId).not.toBe(ok.procedureId);
    const hist = sim.events.filter((e) => e.kind === 'procedure');
    expect(hist.length).toBeGreaterThan(3);
  });
  it('resp manual: elegible sólo en espiración; produce una respiración de tipo manual', () => {
    const sim = benchSim();
    while (phaseOf(sim) !== 'exp') sim.step();
    sim.run(500);
    expect(sim.command({ type: 'manualBreath' }).accepted).toBe(true);
    runUntilBreath(sim, 2);
    expect(sim.breaths[1]!.type).toBe('manual');
    while (phaseOf(sim) !== 'inspFlow') sim.step();
    expect(sim.command({ type: 'manualBreath' }).accepted).toBe(false);
  });
  it('DAT-04: el comparador rechaza combinar Pplat y VT de respiraciones distintas', () => {
    const sim = benchSim();
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    runUntilBreath(sim, 3);
    const hold = sim.procedures.last.inspHold!;
    const f = sim.frame();
    const bad = cstatFromSamples(f.metrics.vti!, hold.values.pplat!, f.metrics.peepe!);
    expect(bad.ok).toBe(false);
    const vtSame = { ...f.metrics.vti!, breathId: hold.breathId, value: hold.values.pplat!.value !== null ? 0.5 : null };
    const good = cstatFromSamples(vtSame, hold.values.pplat!, { ...f.metrics.peepe!, value: 5 });
    expect(good.ok).toBe(true);
  });
});

describe('espera (standby) como transacción', () => {
  it('entrar en espera detiene la entrega, las métricas pasan a no disponibles y la numeración continúa al reanudar', () => {
    const sim = benchSim();
    runUntilBreath(sim, 3);
    expect(sim.command({ type: 'enterStandby' }).accepted).toBe(true);
    expect(sim.command({ type: 'enterStandby' }).accepted).toBe(false);
    sim.run(5000);
    const f = sim.frame();
    expect(f.ventilation).toBe('standby');
    expect(f.live.paw).toBe(0);
    expect(f.metrics.ppeak!.quality).toBe('unavailable');
    expect(f.metrics.ppeak!.value).toBeNull();
    expect(sim.command({ type: 'startVentilation' }).accepted).toBe(true);
    runUntilBreath(sim, 5);
    expect(sim.breaths[4]!.sequence).toBeGreaterThan(4);
  });
});
