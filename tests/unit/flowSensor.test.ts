import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOW_NOISE, FlowSensor, mulberry32 } from '../../src/engine/sensors';
import { exportSession, replaySession } from '../../src/history/session';
import { BENCH_SENSORS, benchSim, runUntilBreath } from '../helpers';

// SEN-01: el volumen que muestra el ventilador varía ciclo a ciclo como el de un sensor real (D: la ficha 2014 acota
// lecturas de volumen a ±10 % o ±10 mL; el valor típico ±2,5 % es P), sin tocar el volumen verdadero del modelo.
describe('SEN-01 · variabilidad del canal de volumen', () => {
  it('el generador es determinista y acotado: misma semilla, misma secuencia; ganancia dentro de ±fracción', () => {
    const a = new FlowSensor(7);
    const b = new FlowSensor(7);
    const gains = Array.from({ length: 200 }, () => a.gain(0.025));
    expect(gains).toEqual(Array.from({ length: 200 }, () => b.gain(0.025)));
    for (const g of gains) expect(Math.abs(g - 1)).toBeLessThanOrEqual(0.025 + 1e-12);
    const spread = Math.max(...gains) - Math.min(...gains);
    expect(spread).toBeGreaterThan(0.03); // recorre el rango, no se queda en el centro
    expect(new FlowSensor(8).gain(0.025)).not.toBe(gains[0]);
    expect(mulberry32(1)()).toBeGreaterThanOrEqual(0);
  });
  it('fracción 0 devuelve ganancia exacta y no altera la secuencia posterior', () => {
    const s = new FlowSensor(3);
    expect(s.gain(0)).toBe(1);
    const withSkip = s.gain(0.02);
    const fresh = new FlowSensor(3);
    fresh.gain(0.02);
    expect(withSkip).toBe(fresh.gain(0.02)); // consume un número por respiración aunque el ruido esté apagado
  });
  it('el VTe mostrado varía ~±2,5 % entre ciclos mientras el volumen verdadero del modelo no cambia', () => {
    const sim = benchSim({ sensors: { ...BENCH_SENSORS, flowNoiseFraction: DEFAULT_FLOW_NOISE } });
    runUntilBreath(sim, 14);
    const truth = sim.breaths.map((b) => b.vtExp);
    const shown = sim.breaths.map((b) => b.vtExpMeasured as number);
    // El modelo sigue siendo exacto y estable; lo que varía es la lectura.
    expect(Math.max(...truth) - Math.min(...truth)).toBeLessThan(2e-3);
    expect(new Set(shown.map((v) => Math.round(v * 1e6))).size).toBeGreaterThan(8); // valores distintos en cada ciclo
    sim.breaths.forEach((b, i) => expect(Math.abs(shown[i]! / truth[i]! - 1)).toBeLessThanOrEqual(0.026));
    const spread = Math.max(...shown) - Math.min(...shown);
    expect(spread).toBeGreaterThan(0.01); // > 10 mL de dispersión visible
  });
  it('VTi y VTe comparten la ganancia del sensor: la fuga mostrada sigue siendo nula', () => {
    const sim = benchSim({ sensors: { ...BENCH_SENSORS, flowNoiseFraction: DEFAULT_FLOW_NOISE } });
    runUntilBreath(sim, 6);
    for (const b of sim.breaths.slice(1))
      expect((b.vtInspMeasured as number) / (b.vtExpMeasured as number)).toBeCloseTo(b.vtInsp / b.vtExp, 9);
    expect(sim.frame().metrics.leakPct?.value ?? 0).toBeLessThan(1e-9);
  });
  it('el banco analítico no lleva ruido: VTe mostrado = VTe verdadero', () => {
    const sim = benchSim();
    runUntilBreath(sim, 4);
    for (const b of sim.breaths) expect(b.vtExpMeasured).toBe(b.vtExp);
  });
  it('la reproducción de una sesión repite las mismas lecturas (mismo semilla, misma secuencia)', () => {
    const sim = benchSim({ sensors: { ...BENCH_SENSORS, flowNoiseFraction: DEFAULT_FLOW_NOISE } });
    runUntilBreath(sim, 8);
    const again = replaySession(exportSession(sim));
    expect(again.breaths.map((b) => b.vtExpMeasured)).toEqual(sim.breaths.map((b) => b.vtExpMeasured));
  });
  it('las alarmas de volumen comparan el valor medido, no el verdadero', () => {
    const sim = benchSim({ sensors: { ...BENCH_SENSORS, flowNoiseFraction: 0.05 } });
    runUntilBreath(sim, 3);
    // Umbral justo por encima de todo VTe medido posible (0.4988 · 1.05 = 0.5237): siempre bajo.
    sim.command({ type: 'setAlarmLimits', changes: { vteLow: 0.6 } });
    runUntilBreath(sim, 6);
    const a = sim.frame().alarms.find((x) => x.id === 'vteLow');
    expect(a?.conditionActive).toBe(true);
    const medidos = sim.breaths.map((b) => b.vtExpMeasured as number);
    expect(medidos).toContain(a?.rawValueAtOnset as number);
    expect(sim.breaths.map((b) => b.vtExp)).not.toContain(a?.rawValueAtOnset as number);
  });
  it('una variabilidad fuera de 0–10 % se rechaza', () => {
    expect(() => benchSim({ sensors: { ...BENCH_SENSORS, flowNoiseFraction: 0.5 } })).toThrow(/variabilidad/);
    expect(benchSim().command({ type: 'setSensors', params: { flowNoiseFraction: -0.1 } }).accepted).toBe(false);
  });
});
