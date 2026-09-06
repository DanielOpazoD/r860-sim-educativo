/** Regresiones de la segunda revisión adversarial: validación en las fronteras (comandos, importación, cliente). */
import { describe, expect, it, vi } from 'vitest';
import { EngineClient } from '../../src/app/engineClient';
import { EngineHost } from '../../src/app/engineHost';
import { exportSession, importSession, MAX_REPLAY_MS } from '../../src/history/session';
import { benchSim, runUntilBreath } from '../helpers';

describe('setAlarmLimits se valida como cualquier ajuste', () => {
  it('rechaza texto, NaN, negativos, claves desconocidas, null y bajo ≥ alto; acepta Off y valores en rejilla', () => {
    const sim = benchSim();
    for (const bad of [{ vteLow: 'banana' }, { rrHigh: NaN }, { vteLow: -5 }, { foo: 1 }, null, { vteLow: 0.5, vteHigh: 0.4 }, { vteLow: 99 }]) {
      const r = sim.command({ type: 'setAlarmLimits', changes: bad as never });
      expect(r.accepted, JSON.stringify(bad)).toBe(false);
    }
    expect(sim.frame().alarmLimits).not.toHaveProperty('foo');
    expect(sim.command({ type: 'setAlarmLimits', changes: { vteLow: 'off', mveHigh: 12.5, rrHigh: 35 } }).accepted).toBe(true);
    expect(sim.frame().alarmLimits.rrHigh).toBe(35);
  });
  it('increaseO2Start con delta negativo, NaN o > 100 % se rechaza; setSpeed no numérico se ignora', () => {
    const sim = benchSim();
    expect(sim.command({ type: 'increaseO2Start', deltaFraction: -5 }).accepted).toBe(false);
    expect(sim.command({ type: 'increaseO2Start', deltaFraction: Number.NaN }).accepted).toBe(false);
    expect(sim.command({ type: 'increaseO2Start', deltaFraction: 2 }).accepted).toBe(false);
    expect(sim.frame().settings.fio2).toBe(0.21);
    const host = new EngineHost(() => {}, () => 0);
    host.handle({ type: 'init', init: sim.init, speed: 1, running: true });
    host.handle({ type: 'setSpeed', speed: Number.NaN });
    let now = 0; for (let i = 0; i < 20; i++) { now += 20; host.tick(now); }
    host.stop();
    expect(host['speed']).toBe(1);
  });
});

describe('importación acotada', () => {
  it('rechaza finalSimTimeMs enorme, negativo o textual, breaths ausente y comandos sin carga útil', () => {
    const sim = benchSim(); runUntilBreath(sim, 1); const good = exportSession(sim);
    const variants: [string, (o: Record<string, unknown>) => void][] = [
      ['1e12', (o) => { o.finalSimTimeMs = 1e12; }], ['negativo', (o) => { o.finalSimTimeMs = -1; }], ['texto', (o) => { o.finalSimTimeMs = 'abc'; }], ['sin breaths', (o) => { delete o.breaths; }],
      ['setPatient sin params', (o) => { (o.commands as unknown[]).push({ simTimeMs: 1, actor: 'instructor', command: { type: 'setPatient' } }); }],
      ['hold inválido', (o) => { (o.commands as unknown[]).push({ simTimeMs: 1, actor: 'learner', command: { type: 'requestHold', kind: 'x', durationS: 'abc' } }); }],
    ];
    for (const [name, mutate] of variants) { const o = JSON.parse(JSON.stringify(good)) as Record<string, unknown>; mutate(o); expect(importSession(JSON.stringify(o)).ok, name).toBe(false); }
    expect(MAX_REPLAY_MS).toBe(4 * 3600_000);
    expect(importSession(JSON.stringify(good)).ok).toBe(true);
  });
});

describe('cliente del motor: fallo del Worker no es silencioso', () => {
  it('si el Worker nunca saluda, degrada al modo en página, avisa y sigue funcionando', async () => {
    class SilentWorker { onmessage: unknown = null; onerror: unknown = null; postMessage(): void {} terminate(): void {} }
    vi.stubGlobal('Worker', SilentWorker);
    const client = new EngineClient({ readyTimeoutMs: 50 });
    const reasons: string[] = []; client.onDegraded = (r) => reasons.push(r);
    await client.ready;
    expect(client.mode).toBe('inline');
    expect(reasons[0]).toMatch(/no respondió/);
    client.init(benchSim().init, 1, false);
    const r = await client.command({ type: 'acknowledgeAlarms' });
    expect(r.accepted).toBe(true);
    vi.unstubAllGlobals();
  });
});
