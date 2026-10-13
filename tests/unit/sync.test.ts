import { describe, expect, it } from 'vitest';
import { TRIGGER_DELAY_S } from '../../src/engine/trigger';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';
import { validateVcSettings } from '../../src/domain/validation';
import { VC_ADULT_CROSS_LIMITS } from '../../src/profiles/adulto-referencia/settings';

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

  it('la respiración empieza 40 ms después de cruzar el umbral, por flujo o por presión; en ese lapso la Pva cae bajo PEEP', () => {
    for (const over of [{}, { triggerByPressure: true, pressureTrigger: -2 }]) {
      const d = disparos(over);
      expect(d.length).toBeGreaterThanOrEqual(5);
      for (const x of d) expect(Math.abs(x.retardoMs - TRIGGER_DELAY_S * 1000)).toBeLessThanOrEqual(4);
    }
    for (const x of disparos({}).slice(2)) {
      expect(x.caida).toBeGreaterThan(0.3);
      expect(x.caida).toBeLessThan(2);
    }
  });

  it('del inicio del esfuerzo a la presurización, como el banco de Thille 2009: < 50 ms con esfuerzo fuerte, más con débil o por presión', () => {
    // Banco de Thille: PS 10, PEEP 5, disparo por flujo en su máxima sensibilidad (≈ 1 L/min); esfuerzo débil P0,1 2 y
    // fuerte P0,1 6 cmH₂O (rampa casi lineal: aquí un cuarto de seno de 0,5 s). Media de 13 equipos 58 ms (42–88), Engström < 50.
    const retardo = (amplitude: number, over: Partial<typeof BENCH_SETTINGS> = {}): number => {
      const ef = { enabled: true, amplitude, ratePerMin: 15, tiS: 0.5, phaseS: 0.5, shape: 'riseRelax' as const };
      const sim = benchSim({
        effort: ef,
        settings: { ...BENCH_SETTINGS, mode: 'CPAP_PS', psupport: 10, peep: 5, flowTrigger: 1 / 60, minRate: 'off', ...over },
      });
      sim.run(30_000);
      const dts = sim.breaths
        .filter((b) => b.startSimTimeMs > 8000)
        .map((b) => {
          const t = b.startSimTimeMs / 1000;
          return (t - (ef.phaseS + Math.floor((t - ef.phaseS) / 4) * 4)) * 1000;
        });
      return dts.reduce((s, x) => s + x, 0) / dts.length;
    };
    const fuerte = retardo(19),
      debil = retardo(6.4),
      presion = retardo(6.4, { triggerByPressure: true, pressureTrigger: -1 });
    expect(fuerte).toBeLessThan(50);
    expect(debil).toBeGreaterThan(fuerte);
    expect(debil).toBeLessThan(70);
    expect(presion).toBeGreaterThan(debil + 30);
  });

  it('más flujo de base o menos esfuerzo, menos trabajo de disparo; el disparo por presión lo multiplica', () => {
    const base = disparos({}).at(-1)!.caida;
    expect(disparos({ biasFlow: 10 / 60 }).at(-1)!.caida).toBeLessThan(base - 0.5);
    expect(disparos({}, 4).at(-1)!.caida).toBeLessThan(base - 0.5);
    // Con disparo por presión a −2 la Pva ya está 2 por debajo al detectar y sigue cayendo durante el retardo.
    expect(disparos({ triggerByPressure: true, pressureTrigger: -2 }).at(-1)!.caida).toBeGreaterThan(2 * base);
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

describe('SYN-05 · presurización del soporte como en el banco de Thille 2009: el lazo de presión tiene ganancia finita', () => {
  // Banco de Thille (Intensive Care Med 2009): pulmón de C 100 mL/cmH₂O y R 5, PEEP 5, disparo por flujo en su máxima
  // sensibilidad (≈ 1 L/min), presurización en la más rápida, soporte 5–20 y tres esfuerzos que piden un flujo
  // decreciente de 0,1, 0,6 y 1,2 L/s desde el inicio. Aquí el esfuerzo sube en 0,1 s y relaja en 0,4 s, con la amplitud
  // que pide ese mismo flujo pico; la rama y la válvula espiratorias son las del equipo, no las del banco analítico.
  const ESFUERZOS = [0.56, 3.4, 6.8] as const;
  const SOPORTES = [5, 10, 15, 20] as const;
  /** Retardo inspiratorio (ms con la Pva bajo PEEP desde el inicio del esfuerzo) y PTP de 0,3 s (cmH₂O·s), por esfuerzo. */
  function banco(ps: number, amplitude: number, pressureLoopGain?: number): { di: number; dt: number; ptp: number } {
    const ef = { enabled: true, amplitude, ratePerMin: 15, tiS: 0.1, relaxTauS: 0.4, phaseS: 0.5, shape: 'riseRelax' as const };
    const sim = benchSim({
      patient: { crs: 0.1, rInsp: 5, rExp: 5, r2: 0, p0: 0, ...(pressureLoopGain === undefined ? {} : { pressureLoopGain }) },
      effort: ef,
      settings: { ...BENCH_SETTINGS, mode: 'CPAP_PS', psupport: ps, peep: 5, flowTrigger: 1 / 60, biasFlow: 2 / 60, riseMs: 0 },
    });
    sim.run(8000);
    const r = { di: 0, dt: 0, ptp: 0 };
    for (let k = 0; k < 3; k++) {
      const inicio = ef.phaseS + (Math.floor((sim.simTimeMs / 1000 - ef.phaseS) / 4) + 1) * 4;
      while (sim.simTimeMs / 1000 < inicio - 0.002) sim.step();
      const t0 = sim.simTimeMs;
      let di = 0,
        dt = -1,
        ptp = 0;
      while (sim.simTimeMs - t0 < 300) {
        sim.step();
        const f = sim.frame();
        ptp += (f.live.paw - 5) * 0.004;
        if (f.live.paw < 5 - 0.05) di = sim.simTimeMs - t0;
        if (dt < 0 && f.live.phase !== 'exp') dt = sim.simTimeMs - t0;
      }
      r.di = Math.max(r.di, di);
      r.dt = Math.max(r.dt, dt);
      r.ptp += ptp / 3;
    }
    return r;
  }
  const tabla = SOPORTES.map((ps) => ESFUERZOS.map((a) => banco(ps, a)));
  const media = (f: (x: { di: number; dt: number; ptp: number }) => number): number =>
    tabla.flat().reduce((s, x) => s + f(x), 0) / tabla.flat().length;

  it('retardo inspiratorio medio bajo 70 ms y bajo 100 ms en el peor caso, como el Engström (media de 13 equipos: 94 ms)', () => {
    expect(media((x) => x.di)).toBeLessThan(70);
    expect(media((x) => x.di)).toBeGreaterThan(54); // el mejor equipo del banco
    expect(tabla[0]![2]!.di).toBeLessThan(100); // soporte 5 con esfuerzo muy fuerte
  });

  it('la Pva tarda más en volver sobre la PEEP cuanto más tira el paciente y menos cuanto mayor es el soporte', () => {
    for (const fila of tabla) expect(fila[2]!.di).toBeGreaterThanOrEqual(fila[1]!.di);
    expect(tabla[0]![2]!.di).toBeGreaterThan(tabla[0]![1]!.di + 10);
    // Con el esfuerzo fuerte y el muy fuerte el retardo cae al subir el soporte (Thille: 122 ms con 5, 80 con 20).
    for (const e of [1, 2]) expect(tabla[0]![e]!.di).toBeGreaterThan(tabla[3]![e]!.di);
    // Lo que se alarga es la presurización tras el disparo, no el disparo: con esfuerzo muy fuerte y soporte 5
    // la presión sigue bajo PEEP decenas de ms después de que empezó la respiración.
    expect(tabla[0]![2]!.di - tabla[0]![2]!.dt).toBeGreaterThan(25);
  });

  it('el producto presión-tiempo de 0,3 s queda en el rango del banco y sube con el soporte', () => {
    // Thille: media 1,6 cmH₂O·s (0,1 el peor equipo, 2,6 el mejor); mayor con el esfuerzo fuerte que con el muy fuerte.
    expect(media((x) => x.ptp)).toBeGreaterThan(1.6);
    expect(media((x) => x.ptp)).toBeLessThan(2.6);
    for (const e of [1, 2]) for (let i = 1; i < 4; i++) expect(tabla[i]![e]!.ptp).toBeGreaterThan(tabla[i - 1]![e]!.ptp);
    const porEsfuerzo = (e: number): number => tabla.reduce((s, fila) => s + fila[e]!.ptp, 0) / tabla.length;
    expect(porEsfuerzo(2)).toBeLessThan(porEsfuerzo(1));
  });

  it('la fuente ideal (ganancia 0, banco analítico) vuelve sobre la PEEP en el mismo instante del disparo', () => {
    const ideal = banco(5, 6.8, 0);
    expect(ideal.di).toBeLessThanOrEqual(ideal.dt);
  });
});
