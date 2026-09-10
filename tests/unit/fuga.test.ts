import { describe, expect, it } from 'vitest';
import { validatePatientParams } from '../../src/domain/validation';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// Fuga en la pieza en Y (E-088): conductancia lineal con la presión del nodo. Lo que entrega el ventilador no es lo que
// recibe el pulmón, la PEEP depende del flujo de base y el sensor de flujo ve la fuga como si fuera el paciente.

const FUGA = { ...BENCH_PATIENT, leakLpmAt10: 6 };
/** Mínimo de Pva y máximo de flujo «hacia el paciente» durante las espiraciones, tras `breaths` respiraciones. */
function espiraciones(sim: ReturnType<typeof benchSim>, breaths: number): { pawMin: number; qMax: number } {
  let pawMin = Infinity,
    qMax = -Infinity;
  while (sim.breaths.length < breaths) {
    sim.step();
    const f = sim.frame();
    if (f.live.phase === 'exp') {
      pawMin = Math.min(pawMin, f.live.paw);
      qMax = Math.max(qMax, f.live.flowLps);
    }
  }
  return { pawMin, qMax };
}

describe('LEAK-01 · lo entregado no es lo recibido', () => {
  it('VC con fuga 6 L/min a 10 cmH₂O: VTi es el programado, VTe lo que vuelve, y la diferencia es la fuga', () => {
    const sim = benchSim({ patient: FUGA, settings: { ...BENCH_SETTINGS, assistControl: true, biasFlow: 4 / 60, flowTrigger: 4 / 60 } });
    runUntilBreath(sim, 8);
    const b = sim.breaths.at(-1)!;
    expect(b.vtInsp).toBeCloseTo(0.5, 6); // el ventilador entrega lo programado, fuga incluida
    expect(b.vtExp / b.vtInsp).toBeGreaterThan(0.5);
    expect(b.vtExp / b.vtInsp).toBeLessThan(0.62);
    const m = sim.frame().metrics;
    expect(m.leakPct!.value!).toBeGreaterThan(0.35);
    // En régimen el pulmón no acumula: lo que no vuelve se fue por la fuga (VTi − VTe ≈ fuga, no ΔV).
    const prev = sim.breaths.at(-2)!;
    expect(Math.abs(b.truthVStartL - prev.truthVStartL)).toBeLessThan(0.005);
    expect(b.vtInsp - b.vtExp).toBeGreaterThan(0.15);
    // La presión pico baja: parte del flujo no llega al pulmón.
    expect(b.ppeak).toBeLessThan(18);
    expect(b.ppeak).toBeGreaterThan(14);
  });

  it('sin fuga nada cambia: el registro es el de siempre', () => {
    const con = benchSim({ patient: { ...BENCH_PATIENT, leakLpmAt10: 0 } });
    const sin = benchSim();
    runUntilBreath(con, 6);
    runUntilBreath(sin, 6);
    for (let i = 0; i < 6; i++) {
      const a = con.breaths[i]!,
        b = sin.breaths[i]!;
      expect(a.vtInsp).toBeCloseTo(b.vtInsp, 9);
      expect(a.vtExp).toBeCloseTo(b.vtExp, 9);
      expect(a.ppeak).toBeCloseTo(b.ppeak, 9);
      expect(a.peepe).toBeCloseTo(b.peepe, 9);
    }
    expect(con.frame().metrics.leakPct!.value!).toBeLessThan(1e-9);
  });
});

describe('LEAK-02 · la PEEP se sostiene mientras el flujo de base cubra la fuga', () => {
  it('con base 4 L/min y fuga de 3 a la PEEP la Pva espiratoria queda en 5; con base 2 cae por debajo de 4', () => {
    // Sin disparo asistido: se mira la espiración entera (con umbral ≤ fuga la fuga dispararía y la cortaría antes).
    const cubre = benchSim({ patient: FUGA, settings: { ...BENCH_SETTINGS, rr: 10, assistControl: false, biasFlow: 4 / 60 } });
    const noCubre = benchSim({ patient: FUGA, settings: { ...BENCH_SETTINGS, rr: 10, assistControl: false, biasFlow: 2 / 60 } });
    const a = espiraciones(cubre, 6),
      b = espiraciones(noCubre, 6);
    expect(a.pawMin).toBeGreaterThan(4.95);
    expect(cubre.breaths.at(-1)!.peepe).toBeCloseTo(5, 1);
    // Sin flujo de base suficiente el nodo baja hasta que base = G·Py: 2 L/min / (6 L/min por 10 cmH₂O) = 3,3 cmH₂O.
    // El pulmón alimenta la fuga mientras se vacía (constante C/G = 5 s), así que en 4,5 s de espiración la Pva llega a 4,4 y sigue bajando.
    expect(b.pawMin).toBeLessThan(4.5);
    expect(b.pawMin).toBeGreaterThan(3.3);
    // Una fuga grande que el flujo de base no cubre hunde la PEEP sólo hasta donde el pulmón, al vaciarse, la sostiene; mientras
    // la Pva no caiga 3 bajo la programada el disparo sigue evaluándose y la fuga dispara sin parar (sin compensación, es lo que
    // pasa). La inhibición del disparo con el circuito sin presión la comprueba LEAK-05 con la desconexión.
    const grande = benchSim({
      patient: { ...BENCH_PATIENT, leakLpmAt10: 30 },
      settings: { ...BENCH_SETTINGS, rr: 10, assistControl: true, biasFlow: 2 / 60, flowTrigger: 2 / 60 },
    });
    const c = espiraciones(grande, 8);
    expect(c.pawMin).toBeLessThan(4);
    expect(grande.breaths.filter((x) => x.type === 'assisted').length).toBeGreaterThanOrEqual(4);
  });
});

describe('LEAK-03 · autodisparo: el sensor ve la fuga como si fuera el paciente', () => {
  it('paciente pasivo, fuga 3 L/min a la PEEP y umbral 2: asistidas; umbral 4: ninguna', () => {
    const auto = benchSim({ patient: FUGA, settings: { ...BENCH_SETTINGS, assistControl: true, biasFlow: 4 / 60, flowTrigger: 2 / 60 } });
    runUntilBreath(auto, 8);
    expect(auto.breaths.filter((b) => b.type === 'assisted').length).toBeGreaterThanOrEqual(5);
    expect(auto.frame().metrics.rr!.value!).toBeGreaterThan(17); // programadas 15/min
    const { qMax } = espiraciones(auto, 10);
    expect(qMax * 60).toBeGreaterThanOrEqual(2); // el flujo medido en espiración es la fuga
    const quieto = benchSim({ patient: FUGA, settings: { ...BENCH_SETTINGS, assistControl: true, biasFlow: 4 / 60, flowTrigger: 4 / 60 } });
    runUntilBreath(quieto, 8);
    expect(quieto.breaths.every((b) => b.type === 'mandatory')).toBe(true);
  });
});

describe('LEAK-04 · en soporte la fuga retrasa el ciclado: el flujo medido no cae al umbral', () => {
  it('la inspiración soportada dura más con fuga que sin ella', () => {
    const PS = {
      ...BENCH_SETTINGS,
      mode: 'CPAP_PS' as const,
      psupport: 10,
      expTriggerPct: 0.25,
      riseMs: 100,
      biasFlow: 4 / 60,
      flowTrigger: 3 / 60,
      backupPinsp: 12,
      backupTinspS: 1,
      apneaTimeS: 20,
    };
    const esfuerzo = { enabled: true, amplitude: 8, ratePerMin: 15, tiS: 0.8, phaseS: 0.5 };
    const ti = (patient: typeof BENCH_PATIENT): number => {
      const sim = benchSim({ effort: esfuerzo, settings: PS, patient });
      runUntilBreath(sim, 8);
      const b = sim.breaths.slice(3).filter((x) => x.type === 'spontaneous');
      expect(b.length).toBeGreaterThan(2);
      return b.reduce((a, x) => a + x.tInspS, 0) / b.length;
    };
    // El sensor ve el flujo del paciente más la fuga (9 L/min a 15 cmH₂O): tarda más en caer al 25 % del pico.
    expect(ti(FUGA)).toBeGreaterThan(ti(BENCH_PATIENT) + 0.03);
  });
});

describe('LEAK-05 · desconexión: sin presión, sin volumen, alarma alta que se resuelve al reconectar', () => {
  it('con el circuito abierto Ppico < 1 y VTe ≈ 0; la alarma se activa, y al cerrar el circuito se resuelve y queda por reconocer', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, assistControl: true, biasFlow: 4 / 60, flowTrigger: 2 / 60 } });
    runUntilBreath(sim, 3);
    expect(sim.command({ type: 'setPatient', params: { disconnected: true } }).accepted).toBe(true);
    runUntilBreath(sim, 6);
    const b = sim.breaths.at(-1)!;
    expect(b.ppeak).toBeLessThan(1);
    expect(b.vtExp).toBeLessThan(0.005);
    expect(b.type).toBe('mandatory'); // sin PEEP en el circuito no se evalúa el disparo: nada de tormenta de autodisparos
    const a = sim.alarms.get('disconnect')!;
    expect(a.conditionActive).toBe(true);
    expect(a.priority).toBe('high');
    expect(sim.alarms.bar().color).toBe('red');
    expect(sim.alarms.get('vteLow')!.conditionActive).toBe(true);
    expect(sim.command({ type: 'setPatient', params: { disconnected: false } }).accepted).toBe(true);
    runUntilBreath(sim, 9);
    expect(sim.alarms.get('disconnect')!.conditionActive).toBe(false);
    expect(sim.alarms.get('disconnect')!.resolvedAtMs).not.toBeNull();
    expect(sim.breaths.at(-1)!.vtExp).toBeGreaterThan(0.45);
    expect(sim.alarms.bar().color).toBe('grey');
    sim.command({ type: 'acknowledgeAlarms' });
    expect(sim.alarms.bar().color).toBe('green');
  });

  it('la fuga se valida en 0–60 L/min y la desconexión es booleana', () => {
    expect(validatePatientParams({ ...BENCH_PATIENT, leakLpmAt10: 70 }).join(' ')).toMatch(/Fuga/);
    expect(validatePatientParams({ ...BENCH_PATIENT, leakLpmAt10: 6 })).toEqual([]);
    expect(benchSim().command({ type: 'setPatient', params: { disconnected: 'sí' as unknown as boolean } }).accepted).toBe(false);
  });
});
