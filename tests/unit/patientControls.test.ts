import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { REFERENCE_PROFILE, defaultInit } from '../../src/profiles';
import { findScenario } from '../../src/scenarios';
import { PHYS, physHtml } from '../../src/ui/patientControls';
import type { Command } from '../../src/domain/commands';

/** Simulador con la mecánica y los ajustes del escenario, como lo carga la interfaz. */
function simular(id: string): Simulator {
  const sc = findScenario(id)!;
  const base = defaultInit();
  return new Simulator(
    defaultInit({ patient: sc.patient, effort: sc.effort, sensors: sc.sensors, settings: { ...base.settings, ...sc.settings } }),
    REFERENCE_PROFILE,
  );
}
/** Pmus máxima en `ms` de simulación. */
function pmusMaxima(sim: Simulator, ms: number): number {
  let max = 0;
  const fin = sim.simTimeMs + ms;
  while (sim.simTimeMs < fin) {
    sim.step();
    max = Math.max(max, sim.frame().truth.pmus);
  }
  return max;
}

describe('Controles del paciente', () => {
  it('en SC-24, escribir 0 en «Esfuerzo (Pmus)» conserva el disparo reverso', () => {
    const sim = simular('SC-24');
    expect(sim.command(PHYS.effort!.cmd(0, sim.frame())).accepted).toBe(true);
    const effort = sim.frame().truth.effort;
    expect(effort.enabled).toBe(true);
    expect(effort.reverse?.amplitude).toBe(8);
    expect(pmusMaxima(sim, 6000)).toBeGreaterThan(4);
  });

  it('un paciente pasivo sigue apagado al escribir 0', () => {
    const sim = simular('SC-01');
    const cmd = PHYS.effort!.cmd(0, sim.frame()) as Extract<Command, { type: 'setEffort' }>;
    expect(cmd.params.enabled).toBe(false);
  });

  it('la variabilidad del esfuerzo muestra la mayor de las dos', () => {
    const fr = { truth: { effort: { variability: { amplitudeFrac: 0.1, periodFrac: 0.2 } } } } as never;
    expect(PHYS.effortVariability!.get(fr)).toBeCloseTo(20, 9);
  });

  it('la latencia sin disparo reverso no crea uno de amplitud 0', () => {
    const sin = { truth: { effort: { enabled: true, amplitude: 6 } } } as never;
    expect(PHYS.reverseDelay!.cmd(0.8, sin)).toEqual({ type: 'setEffort', params: {} });
    expect(PHYS.reverseDelay!.requires!.on(sin)).toBe(false);
    const con = { truth: { effort: { reverse: { amplitude: 8, delayS: 0.5, ratio: 2 } } } } as never;
    expect(PHYS.reverseDelay!.cmd(0.8, con)).toEqual({ type: 'setEffort', params: { reverse: { amplitude: 8, delayS: 0.8, ratio: 2 } } });
  });

  it('los parámetros de una función apagada piden activarla primero', () => {
    const lineal = { truth: { patient: { crs: 0.05 } } } as never;
    for (const k of ['sigmoidC', 'sigmoidD', 'recruitPOpen', 'recruitPClose', 'secondR']) {
      expect(PHYS[k]!.requires!.on(lineal)).toBe(false);
      expect(PHYS[k]!.requires!.title).toMatch(/^Activa primero /);
    }
    const completo = { truth: { patient: { crs: 0.05, sigmoid: { b: 2, c: 18, d: 5 }, recruit: {}, second: { crs: 0.02 } } } } as never;
    for (const k of ['sigmoidC', 'sigmoidD', 'recruitPOpen', 'recruitPClose', 'secondR'])
      expect(PHYS[k]!.requires!.on(completo)).toBe(true);
  });

  it('los extremos de los deslizadores llevan coma decimal', () => {
    const html = physHtml(['muscleTi', 'o2Bias'], () => '');
    expect(html).toContain('<span>0,3</span><span>3</span>');
    expect(html).toContain('<span>-20</span><span>20</span>');
  });
});
