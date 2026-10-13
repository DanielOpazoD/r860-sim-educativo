import { describe, expect, it, vi } from 'vitest';
import type { AlarmLimits, AlarmPriority, AlarmState } from '../../src/domain/types';
import { AlarmAudio, HIGH_ALERT_AUDIO_MS, patronAhora, type Sonido, sonidoDeAlarma } from '../../src/ui/audio';
import { BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// ALM-10: cada límite configurable dispara en su escenario bajo y alto sobre el banco (Ppico 20, VTe 500, VMe 7,5, FR 15, PEEPe 5, FiO2 según ajuste)
// y se resuelve al devolver el límite a un valor que no se viola. Colores de la banda: media → amarillo, alta → rojo.
// Prioridades del equipo (URM SW10, lista de alarmas 8-8 a 8-25): media sólo VTesp alto y bajo, FR alta y PEEPe alta.
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
  { key: 'ppeakLow', violating: 30, ok: 10, priority: 'high' },
  { key: 'vteLow', violating: 0.6, ok: 0.4, priority: 'medium', breaths: 3 }, // tres respiraciones bajo el límite
  { key: 'vteHigh', violating: 0.4, ok: 0.6, priority: 'medium' },
  { key: 'mveLow', violating: 10, ok: 5, priority: 'high', breaths: 4 },
  { key: 'mveHigh', violating: 5, ok: 10, priority: 'high', breaths: 4 },
  { key: 'rrLow', violating: 20, ok: 10, priority: 'high', breaths: 4 },
  { key: 'rrHigh', violating: 10, ok: 20, priority: 'medium', breaths: 4 },
  { key: 'peepeLow', violating: 8, ok: 3, priority: 'high' },
  { key: 'peepeHigh', violating: 5, ok: 20, priority: 'medium', peep: 10 }, // la rejilla de PEEPe alta empieza en 5
  { key: 'fio2Low', violating: 0.3, ok: 0.18, priority: 'high' },
  { key: 'fio2High', violating: 0.24, ok: 0.99, priority: 'high', fio2: 0.5 },
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

const alta = (desdeMs = 0, alerta = false): Sonido => ({ priority: 'high', desdeMs, alerta });

describe('ALM-11 · el audio suena según prioridad', () => {
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
  it('alta: ráfaga de 10 tonos; media: 3; sin alarma: nada; vuelve a sonar tras la cadencia', async () => {
    const { audio, beeps } = fakeAudio();
    expect(await audio.enable()).toBe(true);
    audio.drive(null, 0);
    expect(beeps.length).toBe(0);
    audio.drive(alta(), 0);
    expect(beeps.length).toBe(10);
    audio.drive(alta(), 1000); // dentro de la cadencia de 6 s: no repite
    expect(beeps.length).toBe(10);
    audio.drive(alta(), 7000);
    expect(beeps.length).toBe(20);
    audio.drive({ priority: 'medium', desdeMs: 20_000, alerta: false }, 20_000);
    expect(beeps.length).toBe(23);
    vi.unstubAllGlobals();
  });
});

// ALM-URM-AUDIO · lo que el manual dice del sonido (URM SW10 8-6 y 8-7; High Alert Audio de fábrica 30 s, 11-10).
describe('ALM-URM-AUDIO · sonido de alarma como el equipo', () => {
  const alarma = (id: string, priority: AlarmPriority, onsetAtMs: number, extra: Partial<AlarmState> = {}): AlarmState => ({
    id,
    priority,
    priorityEvidence: 'D',
    source: 'ventilator.flow',
    message: id,
    conditionActive: true,
    onsetAtMs,
    resolvedAtMs: null,
    acknowledgedAtMs: null,
    displayedValueAtOnset: null,
    rawValueAtOnset: null,
    threshold: null,
    conditionReason: '',
    responseAction: 'none',
    latching: true,
    filteredBy: null,
    ...extra,
  });
  const PAUSA = 120_000;

  it('suena la de más prioridad que se ve; las filtradas no suenan', () => {
    const s = sonidoDeAlarma([alarma('vteLow', 'medium', 0), alarma('mveLow', 'high', 5000)], 6000, null, PAUSA);
    expect(s).toEqual({ priority: 'high', desdeMs: 5000, alerta: false });
    expect(sonidoDeAlarma([alarma('mveLow', 'high', 0, { filteredBy: 'disconnect' })], 1000, null, PAUSA)).toBeNull();
  });

  it('una alta sin resolver ni reconocer pasa a alerta a los 30 s: más tono y más volumen', () => {
    const lista = [alarma('mveLow', 'high', 10_000)];
    expect(sonidoDeAlarma(lista, 10_000 + HIGH_ALERT_AUDIO_MS - 1, null, PAUSA)!.alerta).toBe(false);
    const s = sonidoDeAlarma(lista, 10_000 + HIGH_ALERT_AUDIO_MS, null, PAUSA)!;
    expect(s.alerta).toBe(true);
    const normal = patronAhora(null, alta(10_000), 0)!,
      alerta = patronAhora(null, s, 0)!;
    expect(alerta.frecuenciaHz).toBeGreaterThan(normal.frecuenciaHz);
    expect(alerta.volumen).toBeGreaterThan(normal.volumen);
    // Pasar a alerta dispara el patrón nuevo en el acto, sin esperar a la cadencia.
    expect(patronAhora({ ...alta(10_000), at: 39_000 }, s, 40_000)).not.toBeNull();
    // Reconocida, o con el audio pausado después de empezar, no escala; una media nunca escala.
    expect(sonidoDeAlarma([alarma('mveLow', 'high', 10_000, { acknowledgedAtMs: 12_000 })], 60_000, null, PAUSA)!.alerta).toBe(false);
    expect(sonidoDeAlarma(lista, 200_000, 15_000 + PAUSA, PAUSA)!.alerta).toBe(false);
    expect(sonidoDeAlarma([alarma('vteLow', 'medium', 0)], 60_000, null, PAUSA)!.alerta).toBe(false);
  });

  it('la pausa de audio calla todo menos la desconexión', () => {
    const otras = [alarma('mveLow', 'high', 0), alarma('vteLow', 'medium', 0)];
    expect(sonidoDeAlarma(otras, 1000, 1000 + PAUSA, PAUSA)).toBeNull();
    const con = [...otras, alarma('disconnect', 'high', 2000)];
    expect(sonidoDeAlarma(con, 3000, 1000 + PAUSA, PAUSA)).toEqual({ priority: 'high', desdeMs: 2000, alerta: false });
    // Pasada la pausa vuelve a sonar la de más prioridad.
    expect(sonidoDeAlarma(otras, 1000 + PAUSA, 1000 + PAUSA, PAUSA)!.priority).toBe('high');
  });

  it('la baja suena una vez y no se repite; alta y media se repiten', () => {
    const baja: Sonido = { priority: 'informational', desdeMs: 0, alerta: false };
    expect(patronAhora(null, baja, 0)!.tonos).toHaveLength(1);
    expect(patronAhora({ ...baja, at: 0 }, baja, 600_000)).toBeNull();
    expect(patronAhora({ ...baja, at: 0 }, { ...baja, desdeMs: 5000 }, 600_000)).not.toBeNull();
    expect(patronAhora({ ...alta(), at: 0 }, alta(), 6000)).not.toBeNull();
  });
});
