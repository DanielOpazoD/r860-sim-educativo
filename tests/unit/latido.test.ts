import { describe, expect, it } from 'vitest';
import { CARDIAC_REFERENCE } from '../../src/domain/mechanicsPresets';
import { validatePatientParams } from '../../src/domain/validation';
import { Simulator } from '../../src/engine/simulator';
import { REFERENCE_PROFILE, defaultInit } from '../../src/profiles';
import { findScenario } from '../../src/scenarios';
import { BENCH_PATIENT } from '../helpers';

// LAT · oscilación cardiogénica de los pacientes de los casos (Imanaka, Crit Care Med 2000): el latido aparece en el
// flujo y la presión de la vía aérea, la meseta se lee promediando un ciclo cardíaco y no cuenta como esfuerzo.

/** El caso con su latido, o sin él. */
function caso(id: string, conLatido: boolean): Simulator {
  const sc = findScenario(id)!;
  const base = defaultInit();
  return new Simulator(
    defaultInit({
      patient: { ...sc.patient, cardiac: conLatido ? CARDIAC_REFERENCE : { hz: CARDIAC_REFERENCE.hz, amplitude: 0 } },
      effort: sc.effort,
      sensors: sc.sensors,
      settings: { ...base.settings, ...sc.settings },
    }),
    REFERENCE_PROFILE,
  );
}
function bloqueo(sim: Simulator, kind: 'inspHold' | 'expHold', durationS: number) {
  sim.command({ type: 'requestHold', kind, durationS });
  for (let i = 0; i < 20_000 && !sim.procedures.last[kind]; i++) sim.step();
  return sim.procedures.last[kind]!;
}

describe('LAT · oscilación cardiogénica', () => {
  it('mueve el flujo al final de la espiración ≈ ±2 L/min, como el grupo sin autodisparo de Imanaka (2,0 ± 0,9)', () => {
    const sim = caso('CC-05', true);
    sim.run(20_000);
    let max = -Infinity,
      inicioExp = -1;
    for (let i = 0; i < 20_000 / 4; i++) {
      sim.step();
      const f = sim.frame();
      if (f.live.phase !== 'exp') inicioExp = -1;
      else if (inicioExp < 0) inicioExp = f.simTimeMs;
      // Último tramo de la espiración (pasado 1,5 s), cuando el vaciamiento ya casi terminó y queda sólo el latido.
      else if (f.simTimeMs - inicioExp > 1500 && f.live.flowLps > max) max = f.live.flowLps;
    }
    expect(max * 60).toBeGreaterThan(1);
    expect(max * 60).toBeLessThan(2.9);
  });

  it('la meseta y la PEEP total se leen promediando un ciclo cardíaco: el mismo número que sin latido', () => {
    const con = caso('CC-01', true),
      sin = caso('CC-01', false);
    con.run(20_000);
    sin.run(20_000);
    const a = bloqueo(con, 'inspHold', 3),
      b = bloqueo(sin, 'inspHold', 3);
    expect(a.quality).toBe('valid');
    expect(a.values.pplat!.value!).toBeCloseTo(b.values.pplat!.value!, 1);
    const pe = bloqueo(caso('CC-05', true), 'expHold', 4);
    expect(pe.quality).toBe('valid');
  });

  it('no cuenta como esfuerzo: en un paciente pasivo el bloqueo sigue siendo de mecánica pasiva', () => {
    const sim = caso('CC-01', true);
    sim.run(20_000);
    expect(bloqueo(sim, 'inspHold', 3).passiveMechanicsValid).not.toBe(false);
  });

  it('la constante de tiempo se sigue midiendo: la recta se ajusta junto con el latido', () => {
    const con = caso('CC-02', true),
      sin = caso('CC-02', false);
    con.run(40_000);
    sin.run(40_000);
    const tc = con.frame().metrics.tauExp,
      ts = sin.frame().metrics.tauExp;
    expect(tc?.quality).toBe('valid');
    expect(tc!.value! / ts!.value!).toBeGreaterThan(0.97);
    expect(tc!.value! / ts!.value!).toBeLessThan(1.03);
  });

  it('el índice de estrés se lee descontando el latido: el mismo número que sin latido, respiración a respiración', () => {
    // CC-03 con FR 16: cinco latidos por respiración, siempre en la misma fase. Sin descontarlo, el índice quedaba
    // desplazado de forma fija (0,96 → 1,02 con el pulmón lineal); con FR no múltiplo saltaba entre 0,93 y 1,10.
    const con = caso('CC-03', true),
      sin = caso('CC-03', false);
    con.run(30_000);
    sin.run(30_000);
    const ic = con.breaths.slice(-5).map((b) => b.stressIndex!),
      is = sin.breaths.slice(-5).map((b) => b.stressIndex!);
    for (let i = 0; i < 5; i++) expect(Math.abs(ic[i]! - is[i]!)).toBeLessThan(0.02);
    expect(Math.max(...ic) - Math.min(...ic)).toBeLessThan(0.02);
  });

  it('rechaza frecuencias y amplitudes fuera de rango', () => {
    expect(validatePatientParams({ ...BENCH_PATIENT, cardiac: CARDIAC_REFERENCE })).toEqual([]);
    expect(validatePatientParams({ ...BENCH_PATIENT, cardiac: { hz: 5, amplitude: 0.4 } }).join()).toMatch(/Frecuencia cardíaca/);
    expect(validatePatientParams({ ...BENCH_PATIENT, cardiac: { hz: 1.3, amplitude: 3 } }).join()).toMatch(/cardiogénica/);
  });
});
