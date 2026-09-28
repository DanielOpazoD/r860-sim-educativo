import { describe, expect, it } from 'vitest';
import { TRIGGER_DELAY_FLOW_S, TRIGGER_DELAY_PRESSURE_S } from '../../src/engine/trigger';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';
import { validateVcSettings } from '../../src/domain/validation';
import { VC_ADULT_CROSS_LIMITS } from '../../src/profiles/r860-es-photo-reference/settings';

// Cierre de U-33/U-35: flujo de base ajustable (D 2–10 L/min), disparo por presión (D −10…−0.25 cmH₂O) y resistencia de la rama espiratoria.
const effort = { enabled: true, amplitude: 6, ratePerMin: 15, tiS: 0.8, phaseS: 2.0 };
function expStats(sim: ReturnType<typeof benchSim>, breaths: number): { pawMin: number; pawMax: number; qMin: number; qMaxIn: number } {
  let pawMin = Infinity,
    pawMax = -Infinity,
    qMin = Infinity,
    qMaxIn = -Infinity,
    prevExp = false;
  while (sim.breaths.length < breaths) {
    sim.step();
    const f = sim.frame();
    const isExp = f.live.phase === 'exp';
    if (isExp && prevExp) {
      pawMin = Math.min(pawMin, f.live.paw);
      pawMax = Math.max(pawMax, f.live.paw);
      qMin = Math.min(qMin, f.live.flowLps);
      qMaxIn = Math.max(qMaxIn, f.live.flowLps);
    }
    prevExp = isExp;
  }
  return { pawMin, pawMax, qMin, qMaxIn };
}

describe('SYN-01 · flujo de base programable', () => {
  it('con flujo de base 10 L/min el paciente toma hasta 10 L/min sin hundir la Pva; con 2 L/min la hunde antes', () => {
    const hi = benchSim({ effort, settings: { ...BENCH_SETTINGS, assistControl: false, biasFlow: 10 / 60 } });
    const lo = benchSim({ effort, settings: { ...BENCH_SETTINGS, assistControl: false, biasFlow: 2 / 60 } });
    const a = expStats(hi, 6),
      b = expStats(lo, 6);
    expect(a.qMaxIn).toBeLessThanOrEqual(10 / 60 + 1e-9);
    expect(b.qMaxIn).toBeLessThanOrEqual(2 / 60 + 1e-9);
    expect(b.pawMin).toBeLessThan(a.pawMin); // menos flujo de base → deflexión de presión mayor
  });
  it('el disparo por flujo no puede superar el flujo de base (motivo legible)', () => {
    const v = validateVcSettings({ ...BENCH_SETTINGS, flowTrigger: 5 / 60, biasFlow: 2 / 60 }, VC_ADULT_CROSS_LIMITS);
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/flujo de base/);
    expect(validateVcSettings({ ...BENCH_SETTINGS, flowTrigger: 5 / 60, biasFlow: 5 / 60 }, VC_ADULT_CROSS_LIMITS).ok).toBe(true);
    expect(benchSim().command({ type: 'confirmSettings', changes: { flowTrigger: 9 / 60 } }).accepted).toBe(false);
  });
});

describe('SYN-02 · disparo por presión', () => {
  it('con umbral −2 cmH₂O el esfuerzo dispara asistidas; con −10 no llega y las respiraciones siguen siendo mandatorias', () => {
    const easy = benchSim({ effort, settings: { ...BENCH_SETTINGS, assistControl: true, triggerByPressure: true, pressureTrigger: -2 } });
    runUntilBreath(easy, 10);
    expect(easy.breaths.filter((b) => b.type === 'assisted').length).toBeGreaterThanOrEqual(4);
    const hard = benchSim({ effort, settings: { ...BENCH_SETTINGS, assistControl: true, triggerByPressure: true, pressureTrigger: -10 } });
    runUntilBreath(hard, 10);
    expect(hard.breaths.every((b) => b.type === 'mandatory')).toBe(true);
  });
  it('todo el rango de umbral admitido dispara cuando el esfuerzo lo alcanza (regresión: −3 o menos quedaban inertes)', () => {
    // La guardia anti-desconexión exigía Pva > PEEP−3 en el INSTANTE del disparo, así que un umbral de −3 o más
    // profundo nunca podía cumplirla: no disparaba aunque el esfuerzo hundiera la Pva más allá del umbral.
    // Ahora la guardia mira si la espiración sostuvo PEEP (dwell), y con Pmus 12 el valle llega a ≈ −5 cmH₂O.
    const profundo = { ...effort, amplitude: 12 };
    for (const umbral of [-0.5, -3, -5, -10]) {
      const sim = benchSim({
        effort: profundo,
        settings: { ...BENCH_SETTINGS, assistControl: true, triggerByPressure: true, pressureTrigger: umbral },
      });
      runUntilBreath(sim, 10);
      expect(sim.breaths.some((b) => b.type === 'assisted')).toBe(true);
    }
  });
  it('con el circuito abierto la espiración nunca sostiene PEEP y el esfuerzo no dispara (guarda LEAK-05)', () => {
    // Desconectado la Pva queda en ≈0 toda la espiración: la bandera de PEEP demostrada no se iza y la caída del
    // esfuerzo (que sí cumple el umbral −5: 0 ≤ 5−5) no dispara — la separación que reemplaza a la guardia de
    // instante conserva la protección contra la tormenta de autodisparos.
    const sim = benchSim({
      effort: { ...effort, amplitude: 12 },
      settings: { ...BENCH_SETTINGS, assistControl: true, triggerByPressure: true, pressureTrigger: -5 },
    });
    runUntilBreath(sim, 3);
    expect(sim.command({ type: 'setPatient', params: { disconnected: true } }).accepted).toBe(true);
    const n = sim.breaths.length;
    runUntilBreath(sim, n + 5);
    // La primera respiración tras la orden puede venir de un disparo detectado antes de desconectar
    // (el retardo de respuesta lo arma y se entrega aunque el circuito ya esté abierto): se salta.
    expect(sim.breaths.slice(n + 1).every((b) => b.type === 'mandatory')).toBe(true);
  });
  it('el disparo por presión ignora el umbral de flujo (flujo de disparo alto no bloquea)', () => {
    const sim = benchSim({
      effort,
      settings: {
        ...BENCH_SETTINGS,
        assistControl: true,
        triggerByPressure: true,
        pressureTrigger: -1,
        flowTrigger: 9 / 60,
        biasFlow: 10 / 60,
      },
    });
    runUntilBreath(sim, 10);
    expect(sim.breaths.some((b) => b.type === 'assisted')).toBe(true);
  });
});

describe('SYN-03 · resistencia de la rama espiratoria', () => {
  it('con 3 cmH₂O·s/L la Pva queda por encima de PEEP al inicio de la espiración y el flujo pico espiratorio baja; el VT espirado se conserva', () => {
    const ideal = benchSim();
    const valve = benchSim({ patient: { ...BENCH_PATIENT, rExpValve: 3 } });
    const a = expStats(ideal, 4),
      b = expStats(valve, 4);
    expect(a.pawMax).toBeCloseTo(5, 6);
    expect(b.pawMax).toBeGreaterThan(5.5);
    expect(Math.abs(b.qMin)).toBeLessThan(Math.abs(a.qMin));
    // Ppico teórico espiratorio: (Pplat − PEEP)/(Rexp + Rválvula) = 10/13 L/s
    expect(Math.abs(b.qMin)).toBeCloseTo(10 / 13, 1);
    expect(valve.breaths[3]?.vtExp ?? 0).toBeCloseTo(0.5, 2);
  });
  it('se valida en 0–6 y se conserva en la sesión', () => {
    expect(benchSim().command({ type: 'setPatient', params: { rExpValve: 7 } }).accepted).toBe(false);
    expect(benchSim().command({ type: 'setPatient', params: { rExpValve: 2.5 } }).accepted).toBe(true);
    expect(() => benchSim({ patient: { ...BENCH_PATIENT, rExpValve: -1 } })).toThrow(/rama espiratoria/);
  });
});

describe('SYN-04 · retardo de respuesta del disparo: el trabajo de disparo aparece en la curva de presión', () => {
  /** Por respiración asistida: retardo entre la detección y el inicio, y caída máxima de Pva bajo PEEP en ese lapso. */
  function disparos(over: Partial<typeof BENCH_SETTINGS>, amplitude = 8): { retardoMs: number; caida: number }[] {
    const sim = benchSim({
      effort: { enabled: true, amplitude, ratePerMin: 15, tiS: 0.8, phaseS: 0.5 },
      settings: { ...BENCH_SETTINGS, assistControl: true, rr: 10, biasFlow: 4 / 60, flowTrigger: 2 / 60, ...over },
    });
    const out: { retardoMs: number; caida: number }[] = [];
    let deteccionMs: number | null = null,
      pawMin = Infinity,
      enExp = false;
    while (sim.breaths.length < 10) {
      sim.step();
      const f = sim.frame();
      const ultimo = f.eventsTail.filter((e) => e.kind === 'breath' && (e.payload as { trigger?: number }).trigger !== undefined).at(-1);
      if (ultimo && ultimo.simTimeMs !== deteccionMs) {
        deteccionMs = ultimo.simTimeMs;
        pawMin = Infinity;
      }
      const exp = f.live.phase === 'exp';
      if (exp && deteccionMs !== null) pawMin = Math.min(pawMin, f.live.paw);
      // Empieza una inspiración: si hubo detección hace poco, es la respiración que ese disparo pidió.
      if (enExp && !exp && deteccionMs !== null && f.simTimeMs - deteccionMs < 500) {
        out.push({ retardoMs: f.simTimeMs - deteccionMs, caida: 5 - pawMin });
        deteccionMs = null;
      }
      enExp = exp;
    }
    return out;
  }

  it('la respiración empieza 80 ms después de cruzar el umbral, y en ese lapso la Pva cae ≈ 2 cmH₂O con Pmus 8 y flujo de base 4', () => {
    const d = disparos({});
    expect(d.length).toBeGreaterThanOrEqual(5);
    for (const x of d) expect(Math.abs(x.retardoMs - TRIGGER_DELAY_FLOW_S * 1000)).toBeLessThanOrEqual(4);
    for (const x of d.slice(2)) {
      expect(x.caida).toBeGreaterThan(1);
      expect(x.caida).toBeLessThan(3);
    }
  });

  it('el disparo por presión es más lento que el de flujo: la respiración empieza ≈ 110 ms tras cruzar el umbral', () => {
    const d = disparos({ triggerByPressure: true, pressureTrigger: -2 });
    expect(d.length).toBeGreaterThanOrEqual(5);
    for (const x of d) expect(Math.abs(x.retardoMs - TRIGGER_DELAY_PRESSURE_S * 1000)).toBeLessThanOrEqual(4);
  });

  it('más flujo de base o menos esfuerzo, menos trabajo de disparo; el disparo por presión lo duplica', () => {
    const base = disparos({}).at(-1)!.caida;
    expect(disparos({ biasFlow: 10 / 60 }).at(-1)!.caida).toBeLessThan(base - 0.5);
    expect(disparos({}, 4).at(-1)!.caida).toBeLessThan(base - 0.5);
    // Con disparo por presión a −2 la Pva ya está 2 por debajo al detectar y sigue cayendo durante el retardo.
    expect(disparos({ triggerByPressure: true, pressureTrigger: -2 }).at(-1)!.caida).toBeGreaterThan(3);
  });

  it('sin disparo asistido la espiración termina por el temporizador y la caída del esfuerzo queda contenida', () => {
    const sim = benchSim({
      effort: { enabled: true, amplitude: 2, ratePerMin: 15, tiS: 0.8, phaseS: 0.5 },
      settings: { ...BENCH_SETTINGS, assistControl: false, biasFlow: 10 / 60 },
    });
    let pawMin = Infinity;
    while (sim.breaths.length < 8) {
      sim.step();
      if (sim.frame().live.phase === 'exp') pawMin = Math.min(pawMin, sim.frame().live.paw);
    }
    expect(sim.breaths.every((b) => b.type === 'mandatory')).toBe(true);
    // Con Pmus 2 la demanda nunca supera la PEEP intrínseca (pel − peep ≈ 7–9 con este alineamiento de fase), así que
    // el regulador no entra en juego y la vía es idéntica a la del regulador ideal: la Pva no baja de PEEP. La caída
    // de U-43 aparece cuando el esfuerzo tira gas de verdad (véase BM-RP y ASI-02).
    expect(pawMin).toBeCloseTo(5, 6);
  });
});
