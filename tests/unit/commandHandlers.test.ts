import { describe, expect, it } from 'vitest';
import { COMMAND_HANDLERS, executeCommand, type CommandContext } from '../../src/engine/commandHandlers';
import { COMMAND_TYPES } from '../../src/domain/commands';
import { benchSim } from '../helpers';

describe('ARQ-02 · manejadores de comandos', () => {
  it('hay exactamente un manejador por tipo de comando declarado en el dominio', () => {
    expect(Object.keys(COMMAND_HANDLERS).sort()).toEqual([...COMMAND_TYPES].sort());
  });
  it('un tipo desconocido se rechaza sin lanzar y sin registrar', () => {
    const sim = benchSim();
    const state = sim.ventilationState;
    const r = sim.command({ type: 'hackear' } as never);
    expect(r.accepted).toBe(false);
    expect(r.reason).toMatch(/desconocido/);
    expect(sim.commandLog.at(-1)?.accepted).toBe(false);
    expect(sim.ventilationState).toBe(state);
    expect(sim.events.at(-1)?.kind).toBe('rejected'); // el rechazo sí queda en el registro, como cualquier orden no aceptada
  });
  it('los manejadores sólo ven el contexto: setVentilation y registro pasan por la interfaz', () => {
    const calls: string[] = [];
    const sim = benchSim();
    const ctx: CommandContext = {
      profile: sim.profile,
      controller: sim.controller,
      patient: sim.patient,
      effort: sim.effort,
      o2: sim.o2,
      alarms: sim.alarms,
      procedures: sim.procedures,
      metrics: sim.metrics,
      simTimeMs: 0,
      ventilation: () => 'ventilating',
      setVentilation: (v) => calls.push(`ventilation=${v}`),
      setAudioPauseUntil: (ms) => {
        calls.push(`audio=${ms}`);
        return ms;
      },
      logEvent: (k) => calls.push(`log:${k}`),
      drainController: () => calls.push('drain'),
    };
    expect(executeCommand(ctx, { type: 'enterStandby' }, 'learner').accepted).toBe(true);
    expect(calls).toEqual(['drain', 'ventilation=standby', 'log:state']);
    expect(executeCommand(ctx, { type: 'audioPause' }, 'learner').accepted).toBe(true);
    expect(calls.at(-2)).toBe(`audio=${sim.profile.audioPauseMs}`);
  });
});
