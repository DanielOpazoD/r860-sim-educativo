import { describe, expect, it, vi } from 'vitest';
import type { AlarmLimits } from '../../src/domain/types';
import { AlarmAudio } from '../../src/ui/audio';
import { BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// ALM-10: cada límite configurable dispara en su escenario bajo y alto sobre el banco (Ppico 20, VTe 500, VMe 7,5, FR 15, PEEPe 5, FiO2 según ajuste)
// y se resuelve al devolver el límite a un valor que no se viola. Colores de la banda: media → amarillo, alta → rojo.
type Case = {
  key: keyof AlarmLimits;
  violating: number;
  ok: number;
  priority: 'medium' | 'high';
  fio2?: number;
  peep?: number;
  breaths?: number;
};
const CASES: Case[] = [
  { key: 'ppeakLow', violating: 30, ok: 10, priority: 'medium' },
  { key: 'vteLow', violating: 0.6, ok: 0.4, priority: 'medium' },
  { key: 'vteHigh', violating: 0.4, ok: 0.6, priority: 'medium' },
  { key: 'mveLow', violating: 10, ok: 5, priority: 'high', breaths: 4 },
  { key: 'mveHigh', violating: 5, ok: 10, priority: 'medium', breaths: 4 },
  { key: 'rrLow', violating: 20, ok: 10, priority: 'medium', breaths: 4 },
  { key: 'rrHigh', violating: 10, ok: 20, priority: 'medium', breaths: 4 },
  { key: 'peepeLow', violating: 8, ok: 3, priority: 'medium' },
  { key: 'peepeHigh', violating: 5, ok: 20, priority: 'medium', peep: 10 }, // la rejilla de PEEPe alta empieza en 5
  { key: 'fio2Low', violating: 0.3, ok: 0.18, priority: 'medium' },
  { key: 'fio2High', violating: 0.24, ok: 0.99, priority: 'medium', fio2: 0.5 },
];

describe('ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve', () => {
  for (const c of CASES) {
    it(`${c.key}: ${c.violating} dispara (${c.priority}); ${c.ok} resuelve`, () => {
      const sim = benchSim({ settings: { ...BENCH_SETTINGS, fio2: c.fio2 ?? BENCH_SETTINGS.fio2, peep: c.peep ?? BENCH_SETTINGS.peep } });
      runUntilBreath(sim, 2);
      expect(sim.command({ type: 'setAlarmLimits', changes: { [c.key]: c.violating } }).accepted).toBe(true);
      runUntilBreath(sim, 2 + (c.breaths ?? 2));
      const a = sim.frame().alarms.find((x) => x.id === c.key);
      expect(a?.conditionActive, `${c.key} debería estar activa`).toBe(true);
      expect(a?.priority).toBe(c.priority);
      expect(sim.frame().alarmBar.color).toBe(c.priority === 'high' ? 'red' : 'yellow');
      expect(sim.frame().alarmBar.activeCount).toBeGreaterThanOrEqual(1);
      expect(sim.command({ type: 'setAlarmLimits', changes: { [c.key]: c.ok } }).accepted).toBe(true);
      runUntilBreath(sim, sim.breaths.length + (c.breaths ?? 2));
      expect(sim.frame().alarms.find((x) => x.id === c.key)?.conditionActive, `${c.key} debería resolverse`).toBe(false);
    });
  }
  it('Pmáx: bajar el techo por debajo de la presión alcanzada activa la alarma alta y termina la inspiración', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    sim.command({ type: 'confirmSettings', changes: { pmax: 15 } });
    runUntilBreath(sim, 5);
    expect(sim.frame().alarms.find((x) => x.id === 'pmax')?.conditionActive).toBe(true);
    expect(sim.frame().alarmBar.color).toBe('red');
    expect(sim.breaths.at(-1)?.cyclingCause).toBe('pmax');
  });
  it('los límites configurados se conservan al cargar otro escenario', async () => {
    const { EngineHost } = await import('../../src/app/engineHost');
    const { findScenario } = await import('../../src/scenarios');
    const frames: { frame: { alarmLimits: AlarmLimits } }[] = [];
    const host = new EngineHost((m) => {
      if (m.type === 'frame') frames.push(m as never);
    });
    host.handle({ type: 'init', init: benchSim().init, speed: 1, running: false });
    host.handle({ type: 'command', id: 1, cmd: { type: 'setAlarmLimits', changes: { vteLow: 0.6 } }, actor: 'learner' });
    host.handle({ type: 'loadScenario', scenario: findScenario('SC-03')!, keepSettings: false });
    expect(frames.at(-1)?.frame.alarmLimits.vteLow).toBe(0.6);
    host.stop();
  });
});

describe('ALM-11 · el audio suena según prioridad y respeta la pausa', () => {
  function fakeAudio(): { audio: AlarmAudio; beeps: number[] } {
    const beeps: number[] = [];
    class Osc {
      frequency = { value: 0 };
      type = '';
      connect() {
        return this;
      }
      start(at: number) {
        beeps.push(at);
      }
      stop() {}
    }
    class Gain {
      gain = { setValueAtTime() {}, linearRampToValueAtTime() {} };
      connect() {
        return this;
      }
    }
    class AC {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume() {
        return Promise.resolve();
      }
      createOscillator() {
        return new Osc();
      }
      createGain() {
        return new Gain();
      }
    }
    vi.stubGlobal('window', { AudioContext: AC });
    vi.stubGlobal('document', { hidden: false });
    return { audio: new AlarmAudio(), beeps };
  }
  it('alta: ráfaga de 10 tonos; media: 3; sin alarma: nada; en pausa de audio: nada; vuelve a sonar tras la cadencia', async () => {
    const { audio, beeps } = fakeAudio();
    expect(await audio.enable()).toBe(true);
    audio.drive(null, 0);
    expect(beeps.length).toBe(0);
    audio.drive('high', 0);
    expect(beeps.length).toBe(10);
    audio.drive('high', 1000); // dentro de la cadencia de 6 s: no repite
    expect(beeps.length).toBe(10);
    audio.drive('high', 7000);
    expect(beeps.length).toBe(20);
    audio.drive('medium', 20_000);
    expect(beeps.length).toBe(23);
    audio.pausedUntilMs = 60_000;
    audio.drive('high', 40_000);
    expect(beeps.length).toBe(23);
    audio.drive('high', 61_000);
    expect(beeps.length).toBe(33);
    vi.unstubAllGlobals();
  });
});
