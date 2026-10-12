import { describe, expect, it } from 'vitest';
import { validatePatientParams } from '../../src/domain/validation';
import { ALVEOLAR_K, DEFAULT_GAS, GasExchange, phFrom, steadyPaco2 } from '../../src/engine/gasExchange';
import { exportSession, importSession, replaySession } from '../../src/history/session';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// Gasometría de modelo (P). Oráculo: la ecuación de la ventilación alveolar, PaCO₂ = 0,863·VCO₂/V̇A, y
// Henderson-Hasselbalch. Banco SC-01: VT 0,5 L a 15/min con espacio muerto 0,15 L → V̇A = 0,35·15 = 5,25 L/min,
// PaCO₂ de equilibrio 0,863·200/5,25 = 32,9 mmHg.

const minutos = (sim: ReturnType<typeof benchSim>, min: number): void => sim.run(Math.round(min * 60_000));
const gas = (sim: ReturnType<typeof benchSim>) => sim.frame().truth.gas!;

describe('GAS-01 · ecuaciones', () => {
  it('equilibrio alveolar y pH de referencia', () => {
    expect(steadyPaco2(200, 5.25)).toBeCloseTo(32.88, 2);
    expect(steadyPaco2(200, 0)).toBeNull();
    expect(phFrom(24, 40)).toBeCloseTo(7.4, 2);
    // Duplicar la PaCO₂ con bicarbonato fijo baja el pH en log10(2).
    expect(phFrom(24, 40) - phFrom(24, 80)).toBeCloseTo(Math.log10(2), 9);
  });

  it('en apnea la PaCO₂ sube 0,863·VCO₂/C mmHg por minuto', () => {
    const g = new GasExchange(40);
    for (let i = 0; i < 60_000 / 4; i++) g.step(0.004, DEFAULT_GAS);
    expect(g.paco2 - 40).toBeCloseTo((ALVEOLAR_K * DEFAULT_GAS.vco2MlMin) / DEFAULT_GAS.storeL, 6);
    expect(g.state(60, DEFAULT_GAS).vaLMin).toBeNull();
  });

  it('una respiración menor que el espacio muerto no ventila el alvéolo', () => {
    const g = new GasExchange(40);
    g.onBreath(4, 4, 0.12, DEFAULT_GAS);
    expect(g.paco2).toBe(40);
    expect(g.state(4, DEFAULT_GAS).vaLMin).toBe(0);
  });
});

describe('GAS-05 · V̇A del último minuto', () => {
  const regular = (g: GasExchange, hasta: number): void => {
    for (let t = 4; t <= hasta; t += 4) g.onBreath(t, 4, 0.5, DEFAULT_GAS);
  };
  it('una ventilación regular da (VT − VD)·FR en cualquier fase del ciclo', () => {
    const g = new GasExchange(40);
    regular(g, 120);
    for (const ahora of [120, 121, 122.5, 123.9]) expect(g.vaLMin(ahora)!).toBeCloseTo(0.35 * 15, 9);
  });
  it('en apnea la V̇A baja y llega a 0 cuando las respiraciones salen de la ventana', () => {
    const g = new GasExchange(40);
    regular(g, 120);
    const a = g.vaLMin(150)!,
      b = g.vaLMin(170)!;
    expect(a).toBeLessThan(0.35 * 15);
    expect(b).toBeLessThan(a);
    expect(g.vaLMin(181)).toBe(0);
  });
});

describe('GAS-02 · banco SC-01: la ventilación del pulmón fija la PaCO₂', () => {
  it('la primera respiración fija el equilibrio y la PaCO₂ se mantiene', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    const inicio = gas(sim).paco2;
    expect(inicio).toBeCloseTo(32.9, 0);
    minutos(sim, 5);
    const g = gas(sim);
    expect(Math.abs(g.paco2 - inicio)).toBeLessThan(0.6);
    expect(g.vaLMin!).toBeCloseTo(5.25, 1);
    // Sin depender de en qué punto del ciclo se lea.
    for (let i = 0; i < 4; i++) {
      sim.run(1000);
      expect(gas(sim).vaLMin!).toBeCloseTo(g.vaLMin!, 2);
    }
    expect(g.paco2Target!).toBeCloseTo(32.9, 0);
    expect(g.vdVt!).toBeCloseTo(0.3, 2);
    expect(g.ph).toBeCloseTo(phFrom(24, g.paco2), 9);
  });

  it('el CO₂ no realimenta la mecánica: presiones y volúmenes idénticos con otra gasometría', () => {
    const a = benchSim();
    const b = benchSim({ patient: { ...BENCH_PATIENT, gas: { vco2MlMin: 400, deadspaceL: 0.3 } } });
    runUntilBreath(a, 6);
    runUntilBreath(b, 6);
    expect(b.breaths.map((x) => [x.ppeak, x.vtExp])).toEqual(a.breaths.map((x) => [x.ppeak, x.vtExp]));
    expect(gas(b).paco2).toBeGreaterThan(gas(a).paco2 * 2);
  });
});

describe('GAS-03 · cinética: la PaCO₂ sigue a la ventilación con τ = C/V̇A', () => {
  it('duplicar la frecuencia lleva la PaCO₂ hacia la mitad y recorre ≈ 63 % en una τ', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    const p0 = gas(sim).paco2;
    sim.command({ type: 'confirmSettings', changes: { rr: 30 } });
    // Un minuto después la ventana de V̇A ya sólo contiene respiraciones a 30/min: desde ahí la aproximación es una
    // exponencial pura hacia el nuevo equilibrio.
    minutos(sim, 1);
    const g = gas(sim);
    const objetivo = g.paco2Target!;
    expect(objetivo).toBeLessThan(p0 * 0.6);
    expect(g.vaLMin!).toBeGreaterThan(1.8 * 5.25);
    const tau = g.tauMin!;
    expect(tau).toBeCloseTo(DEFAULT_GAS.storeL / g.vaLMin!, 9);
    const p1 = g.paco2;
    minutos(sim, tau);
    const recorrido = (p1 - gas(sim).paco2) / (p1 - objetivo);
    expect(recorrido).toBeCloseTo(1 - Math.exp(-1), 1);
    expect(sim.simTimeMs).toBeGreaterThan((1 + tau) * 60_000);
  });

  it('más espacio muerto con el mismo VT sube la PaCO₂ de equilibrio', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    sim.command({ type: 'setPatient', params: { gas: { deadspaceL: 0.25 } } }, 'instructor');
    minutos(sim, 1);
    expect(gas(sim).paco2Target!).toBeCloseTo((ALVEOLAR_K * 200) / (0.25 * 15), 0);
  });
});

describe('GAS-04 · validación y reproducción', () => {
  it('rechaza valores fuera de rango y claves desconocidas', () => {
    expect(validatePatientParams({ ...BENCH_PATIENT, gas: { deadspaceL: 0.15 } })).toEqual([]);
    expect(validatePatientParams({ ...BENCH_PATIENT, gas: { deadspaceL: 1 } })).toContain('Espacio muerto fuera de 0–600 mL');
    expect(validatePatientParams({ ...BENCH_PATIENT, gas: { vco2: 200 } as never }).join()).toMatch(/clave desconocida/);
    expect(validatePatientParams({ ...BENCH_PATIENT, gas: { hco3: Number.NaN } })).toContain('Bicarbonato fuera de 5–50 mEq/L');
  });

  it('la sesión reproducida da la misma gasometría', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS } });
    runUntilBreath(sim, 3);
    sim.command({ type: 'confirmSettings', changes: { rr: 20 } });
    sim.command({ type: 'setPatient', params: { gas: { vco2MlMin: 250 } } }, 'instructor');
    runUntilBreath(sim, 12);
    const imp = importSession(JSON.stringify(exportSession(sim)));
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    const re = replaySession(imp.session);
    expect(re.frame().truth.gas).toEqual(sim.frame().truth.gas);
  });
});
