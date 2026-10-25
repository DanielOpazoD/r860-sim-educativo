// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { REFERENCE_PROFILE, defaultInit } from '../../src/profiles';
import { SCENARIOS, findScenario, type Scenario } from '../../src/scenarios';
import { CASE_TESTS, evaluateCase, type CaseContext, type CaseResult } from '../../src/ui/caseEvaluation';
import { updateLessonFlags } from '../../src/ui/lesson';
import { CASES_KEY, loadCaseProgress, saveCaseProgress } from '../../src/ui/caseProgress';
import { caseDevelopmentNodes } from '../../src/ui/caseView';
import type { VcSettings } from '../../src/domain/types';

/** Simulador con la mecánica y los ajustes del caso, como lo carga la interfaz. */
function simular(sc: Scenario): Simulator {
  const base = defaultInit();
  return new Simulator(
    defaultInit({ patient: sc.patient, effort: sc.effort, sensors: sc.sensors, settings: { ...base.settings, ...sc.settings } }),
    REFERENCE_PROFILE,
  );
}
const contexto = (sim: Simulator, settingsChangeMs = -1): CaseContext => ({
  frame: sim.frame(),
  scenarioId: 'CC',
  lessonStartMs: 0,
  patientChangeMs: -1,
  settingsChangeMs,
  flags: {},
});
function bloqueoInspiratorio(sim: Simulator): void {
  sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 }); // 3 s, lo que ofrece el panel por omisión
  for (let i = 0; i < 5000 && !sim.procedures.last.inspHold; i++) sim.step();
}

describe('CAS-00 · formato', () => {
  const casos = SCENARIOS.filter((s) => s.clinical);
  it('cada caso declara tema, viñeta, pregunta, criterios con pruebas existentes y referencias verificadas', () => {
    expect(casos.length).toBeGreaterThan(0);
    for (const sc of casos) {
      const c = sc.clinical!;
      expect(c.theme && c.vignette && c.question && c.reveal, sc.id).toBeTruthy();
      expect(c.references.length, sc.id).toBeGreaterThan(0);
      for (const r of c.references)
        expect(r.url, sc.id).toMatch(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$|^http:\/\/www\.ardsnet\.org\/files\/[\w.-]+\.pdf$/);
      for (const cr of c.criteria) expect(cr.test.startsWith('lesson:') || cr.test in CASE_TESTS, `${sc.id}/${cr.id}`).toBe(true);
      if (c.kind === 'diagnostico') expect(c.options?.filter((o) => o.correct)).toHaveLength(1);
    }
  });
  it('los casos no tienen lección guiada: se evalúan al entregar', () => {
    for (const sc of casos) expect(sc.lesson, sc.id).toBeUndefined();
  });
});

describe('CAS-01 · presión pico alta por resistencia', () => {
  const sc = findScenario('CC-01')!;
  it('la mecánica produce la viñeta: Ppico ≈ 29 con Pplat normal (≈ 15)', () => {
    const sim = simular(sc);
    sim.run(20_000);
    expect(sim.frame().metrics.ppeak!.value!).toBeGreaterThan(28);
    expect(sim.frame().metrics.ppeak!.value!).toBeLessThan(30);
    bloqueoInspiratorio(sim);
    const h = sim.procedures.last.inspHold!;
    expect(h.quality).toBe('valid');
    // Pplat = PEEP + auto-PEEP + VT/C: la meseta incluye la pequeña PEEP intrínseca del Te disponible.
    const peepi = sim.frame().truth.peepiEndExp;
    expect(h.values.pplat!.value!).toBeCloseTo(5 + peepi + 0.45 / 0.05, 0);
    // La auto-PEEP es pequeña: la opción «auto-PEEP» es falsa en el modelo, no sólo en el texto.
    expect(peepi).toBeLessThan(1.5);
  });
  it('sin medir la meseta no se resuelve, aunque la respuesta sea correcta', () => {
    const sim = simular(sc);
    sim.run(20_000);
    const r = evaluateCase(sc.clinical!, contexto(sim), 'r');
    expect(r.criteria[0]!.ok).toBe(false);
    expect(r.answer).toEqual({ id: 'r', ok: true });
    expect(r.passed).toBe(false);
  });
  it('midiendo y respondiendo bien se resuelve; con otra respuesta, no', () => {
    const sim = simular(sc);
    sim.run(20_000);
    bloqueoInspiratorio(sim);
    expect(evaluateCase(sc.clinical!, contexto(sim), 'r').passed).toBe(true);
    expect(evaluateCase(sc.clinical!, contexto(sim), 'c').passed).toBe(false);
  });
  it('un bloqueo anterior al último ajuste ya no cuenta', () => {
    const sim = simular(sc);
    sim.run(20_000);
    bloqueoInspiratorio(sim);
    expect(CASE_TESTS.inspHold!(contexto(sim, sim.simTimeMs + 1), {})).toBe(false);
  });
});

describe('CAS-02 · progreso', () => {
  it('un caso resuelto no vuelve a «intentado»', () => {
    localStorage.removeItem(CASES_KEY);
    saveCaseProgress('CC-01', false);
    expect(loadCaseProgress()['CC-01']).toBe('intentado');
    saveCaseProgress('CC-01', true);
    saveCaseProgress('CC-01', false);
    expect(loadCaseProgress()['CC-01']).toBe('resuelto');
    localStorage.setItem(CASES_KEY, '{"CC-01":"otro","CC-02":"intentado"}');
    expect(loadCaseProgress()).toEqual({ 'CC-02': 'intentado' });
  });
});

/** Un caso en marcha, como lo juzga la interfaz al entregar: ajustes con su instante y banderas por cuadro. */
class Caso {
  readonly sim: Simulator;
  readonly flags: Record<string, unknown> = {};
  settingsChangeMs = -1;
  constructor(readonly sc: Scenario) {
    this.sim = simular(sc);
    this.correr(20_000);
  }
  correr(ms: number): void {
    const fin = this.sim.simTimeMs + ms;
    while (this.sim.simTimeMs < fin) {
      this.sim.run(500);
      updateLessonFlags(this.sim.frame(), this.flags);
    }
  }
  ajustar(changes: Record<string, unknown>): void {
    expect(this.sim.command({ type: 'confirmSettings', changes }).accepted).toBe(true);
    this.settingsChangeMs = this.sim.simTimeMs;
  }
  /** Bloqueo como el panel: si es válido y pasivo, anota el punto de titulación. */
  bloqueo(kind: 'inspHold' | 'expHold'): void {
    const previo = this.sim.procedures.last[kind];
    // Inspiratorio de 3 s (lo que ofrece el panel); espiratorio de 4: con latido y tejido viscoelástico 3 no se asienta.
    this.sim.command({ type: 'requestHold', kind, durationS: kind === 'expHold' ? 4 : 3 });
    for (let i = 0; i < 6000 && this.sim.procedures.last[kind] === previo; i++) this.sim.step();
    const h = this.sim.procedures.last[kind]!;
    const cstat = h.values.cstat?.value;
    if (kind === 'inspHold' && h.quality === 'valid' && h.passiveMechanicsValid !== false && typeof cstat === 'number') {
      const puntos = (this.flags.titulacion as { peep: number; cstat: number; t?: number }[] | undefined) ?? [];
      this.flags.titulacion = [...puntos, { peep: this.sim.frame().settings.peep as number, cstat: cstat * 1000, t: h.completedAtMs ?? 0 }];
    }
    updateLessonFlags(this.sim.frame(), this.flags);
  }
  resultado(answer: string | null = null) {
    const c: CaseContext = {
      frame: this.sim.frame(),
      scenarioId: this.sc.id,
      lessonStartMs: 0,
      patientChangeMs: -1,
      settingsChangeMs: this.settingsChangeMs,
      flags: this.flags,
    };
    return evaluateCase(this.sc.clinical!, c, answer);
  }
  get gas() {
    return this.sim.frame().truth.gas!;
  }
}
const caso = (id: string): Caso => new Caso(findScenario(id)!);
const phEq = (k: Caso): number => k.gas.phTarget!;

describe('CAS-02 · EPOC: atrapamiento', () => {
  it('la viñeta: PEEP intrínseca ≈ 8 y pH de equilibrio ≈ 7,49 (hipocapnia aguda tamponada); no se resuelve sin tocar nada', () => {
    const k = caso('CC-02');
    k.correr(40_000);
    expect(k.sim.frame().truth.peepiEndExp).toBeGreaterThan(6.5);
    expect(k.sim.frame().truth.peepiEndExp).toBeLessThan(9);
    expect(phEq(k)).toBeCloseTo(7.49, 1);
    k.bloqueo('expHold');
    expect(k.resultado().passed).toBe(false);
  });
  it('FR 12 e I:E 1:4 lo resuelve; alargar sólo el I:E o bajar el VT, no', () => {
    const bien = caso('CC-02');
    bien.ajustar({ rr: 12, ie: 1 / 4 });
    bien.correr(60_000);
    bien.bloqueo('expHold');
    expect(bien.resultado().criteria.map((c) => [c.id, c.ok])).toEqual([
      ['mide', true],
      ['peeptot', true],
      ['ph', true],
    ]);
    const soloIe = caso('CC-02');
    soloIe.ajustar({ ie: 1 / 4 });
    soloIe.correr(60_000);
    soloIe.bloqueo('expHold');
    expect(soloIe.resultado().criteria.find((c) => c.id === 'peeptot')!.ok).toBe(false);
    const vtBajo = caso('CC-02');
    vtBajo.ajustar({ vt: 0.4, rr: 14, ie: 1 / 4 });
    vtBajo.correr(60_000);
    vtBajo.bloqueo('expHold');
    // El espacio muerto de la vía aérea se paga: con VT 400 la acidosis de equilibrio sale del rango.
    expect(vtBajo.resultado().criteria.find((c) => c.id === 'ph')!.ok).toBe(false);
  });
});

describe('CAS-02b · EPOC con limitación al flujo: la PEEP externa hasta la presión crítica no infla', () => {
  /** PEEP total medida con FR 12 e I:E 1:4 y la PEEP externa dada. */
  const peepTot = (peep: number): number => {
    const k = caso('CC-02');
    k.ajustar({ rr: 12, ie: 1 / 4, peep });
    k.correr(60_000);
    k.bloqueo('expHold');
    return k.sim.procedures.last.expHold!.values.peepTot!.value!;
  };
  it('con PEEP 5 la PEEP total no baja de ≈ 9,6 (presión crítica 9); con 7 casi no cambia (Ranieri 1993); con 11 la suma', () => {
    const p5 = peepTot(5),
      p7 = peepTot(7),
      p11 = peepTot(11);
    expect(p5).toBeGreaterThan(9);
    expect(p5).toBeLessThan(10);
    expect(p7 - p5).toBeLessThan(0.6);
    expect(p11 - p5).toBeGreaterThan(3);
  });
});

describe('CAS-03 · SDRA: VT protector', () => {
  /** Meseta, presión motriz y Cstat de un bloqueo de 3 s tras 30 s con el ajuste dado. */
  const medir = (ajuste: Record<string, number>) => {
    const k = caso('CC-03');
    k.ajustar(ajuste);
    k.correr(30_000);
    k.bloqueo('inspHold');
    const h = k.sim.procedures.last.inspHold!;
    return { k, pplat: h.values.pplat!.value!, dp: h.values.driving!.value!, cstat: h.values.cstat!.value! };
  };
  it('la viñeta: con VT 600 la meseta pasa el codo superior (Pplat ≈ 33, ΔP ≈ 23) y el pH es 7,40', () => {
    const k = caso('CC-03');
    k.bloqueo('inspHold');
    const h = k.sim.procedures.last.inspHold!;
    expect(h.values.pplat!.value!).toBeGreaterThan(32);
    expect(h.values.pplat!.value!).toBeLessThan(35);
    expect(h.values.driving!.value!).toBeCloseTo(23.3, 0);
    expect(phEq(k)).toBeCloseTo(7.4, 1);
    expect(k.resultado().passed).toBe(false);
  });
  it('6 mL/kg todavía deja la presión motriz en 15 o más (Terragni); 400 mL con FR 28 lo resuelve; sin subir la FR, acidosis', () => {
    const seis = medir({ vt: 0.425, rr: 28 });
    expect(seis.dp).toBeGreaterThan(15.1);
    expect(seis.k.resultado().criteria.find((c) => c.id === 'dp')!.ok).toBe(false);
    const bien = medir({ vt: 0.4, rr: 28 });
    expect(bien.dp).toBeCloseTo(14.3, 0);
    expect(bien.dp).toBeLessThan(14.8);
    expect(bien.pplat).toBeCloseTo(24.4, 0);
    expect(bien.k.resultado().passed).toBe(true);
    const sinFr = caso('CC-03');
    sinFr.ajustar({ vt: 0.4 });
    sinFr.correr(30_000);
    sinFr.bloqueo('inspHold');
    expect(sinFr.gas.paco2Target!).toBeGreaterThan(68);
    expect(sinFr.resultado().criteria.find((c) => c.id === 'ph')!.ok).toBe(false);
    // VD/VT en el rango que Nuckton midió en el SDRA (0,58 ± 0,09): más alto con el VT protector.
    expect(sinFr.gas.vdVt!).toBeGreaterThan(0.55);
    expect(sinFr.gas.vdVt!).toBeLessThan(0.67);
  });
  it('curva no lineal: la Cstat cae al subir el VT o la PEEP, y la PEEP alta sube la presión motriz (Roupie, Grasso)', () => {
    const v600 = medir({}),
      v400 = medir({ vt: 0.4, rr: 28 }),
      peep14 = medir({ vt: 0.4, rr: 28, peep: 14 });
    // En un pulmón lineal la Cstat no depende del VT ni de la PEEP y la presión motriz no cambia con la PEEP.
    expect(v400.cstat - v600.cstat).toBeGreaterThan(0.0015);
    expect(v400.cstat - peep14.cstat).toBeGreaterThan(0.003);
    expect(peep14.dp - v400.dp).toBeGreaterThan(2);
    // Bajar la PEEP no es un atajo: sin oxigenación en el modelo, el caso exige la de la viñeta.
    const atajo = medir({ vt: 0.425, rr: 28, peep: 8 });
    expect(atajo.dp).toBeLessThan(15);
    expect(atajo.k.resultado().criteria.find((c) => c.id === 'peep')!.ok).toBe(false);
  });
  it('el índice de estrés sube con el VT y con la PEEP, y con el latido se lee igual que sin él', () => {
    const indice = (k: ReturnType<typeof caso>) => k.sim.frame().metrics.stressIndex!.value!;
    const v600 = medir({}),
      v400 = medir({ vt: 0.4, rr: 28 }),
      peep14 = medir({ vt: 0.4, rr: 28, peep: 14 });
    expect(indice(v600.k)).toBeGreaterThan(indice(v400.k) + 0.02);
    expect(indice(peep14.k)).toBeGreaterThan(indice(v400.k) + 0.02);
    // Rango normal de Grasso (0,9–1,1) con el VT protector.
    expect(indice(v400.k)).toBeGreaterThan(0.95);
    expect(indice(v400.k)).toBeLessThan(1.1);
    // Respiración a respiración no salta con la fase del latido.
    const ultimos = v400.k.sim.breaths.slice(-6).map((b) => b.stressIndex!);
    expect(Math.max(...ultimos) - Math.min(...ultimos)).toBeLessThan(0.03);
  });
});

describe('CAS-04 · PEEP decremental', () => {
  it('medir, abrir con PEEP 20 y volver a 11 lo resuelve; sin abrir, no', () => {
    const k = caso('CC-04');
    k.bloqueo('inspHold');
    k.ajustar({ peep: 20 });
    k.correr(30_000);
    k.ajustar({ peep: 11 });
    k.correr(20_000);
    k.bloqueo('inspHold');
    const puntos = k.flags.titulacion as { cstat: number }[];
    expect(puntos.at(-1)!.cstat / puntos[0]!.cstat).toBeGreaterThan(1.3);
    expect(k.resultado().criteria.map((c) => [c.id, c.ok])).toEqual([
      ['antes', true],
      ['abre', true],
      ['despues', true],
      ['peep', true],
    ]);
    const sinAbrir = caso('CC-04');
    sinAbrir.bloqueo('inspHold');
    sinAbrir.ajustar({ peep: 11 });
    sinAbrir.correr(20_000);
    sinAbrir.bloqueo('inspHold');
    expect(sinAbrir.resultado().passed).toBe(false);
  });
});

describe('CAS-05 · hipercapnia', () => {
  it('la viñeta: PaCO₂ 88 y pH 7,14 de equilibrio (con el bicarbonato de la hipercapnia aguda)', () => {
    const k = caso('CC-05');
    expect(k.gas.paco2Target!).toBeCloseTo(88, -1);
    expect(phEq(k)).toBeCloseTo(7.14, 1);
    expect(k.resultado().passed).toBe(false);
  });
  it('VT 500 con FR 14 o VT 400 con FR 22 lo resuelven; FR 18 sola no basta; VT 600 se pasa de 8 mL/kg', () => {
    const res = (changes: Record<string, unknown>) => {
      const k = caso('CC-05');
      k.ajustar(changes);
      k.correr(30_000);
      return k;
    };
    expect(res({ vt: 0.5, rr: 14 }).resultado().passed).toBe(true);
    expect(res({ vt: 0.4, rr: 22 }).resultado().passed).toBe(true);
    const fr18 = res({ rr: 18 });
    expect(fr18.gas.paco2Target!).toBeCloseTo(49, -1);
    expect(fr18.resultado().passed).toBe(false);
    expect(
      res({ vt: 0.6 })
        .resultado()
        .criteria.find((c) => c.id === 'vt')!.ok,
    ).toBe(false);
  });
});

describe('CAS-06 · esfuerzos inefectivos', () => {
  /** Respiraciones, VT espirado medio (mL/kg de peso predicho) y V̇A del último minuto con un soporte dado. */
  const conSoporte = (psupport: number | null) => {
    const k = caso('CC-06');
    k.ajustar(psupport === null ? {} : { psupport });
    k.correr(65_000);
    const ultimas = k.sim.frame().trends.filter((t) => t.tMs > k.sim.simTimeMs - 60_000);
    const vt = ultimas.reduce((s, t) => s + t.vte, 0) / ultimas.length;
    return { k, disparan: ultimas.length / k.sim.frame().truth.effort.ratePerMin, mlKg: (vt * 1000) / pbw170, va: k.gas.vaLMin! };
  };
  const pbw170 = 50 + 0.91 * (170 - 152.4);
  it('como en Thille: con soporte 20 cerca de la mitad de los esfuerzos no dispara con VT ≈ 10 mL/kg; con 13 disparan todos con ≈ 6', () => {
    // Thille 2008: inefectivos 45 % (RIC 36–52) y VT 10,2 mL/kg (7,2–11,5) con soporte 20; 0 % y 5,9 (4,9–6,7) con 13.
    const inicio = conSoporte(null);
    expect(1 - inicio.disparan).toBeGreaterThan(0.36);
    expect(1 - inicio.disparan).toBeLessThanOrEqual(0.52);
    expect(inicio.mlKg).toBeGreaterThan(7.2);
    expect(inicio.mlKg).toBeLessThan(11.5);
    expect(inicio.k.resultado().criteria.find((c) => c.id === 'disparo')!.ok).toBe(false);
    const bien = conSoporte(13);
    expect(bien.disparan).toBe(1);
    expect(bien.mlKg).toBeGreaterThan(4.9);
    expect(bien.mlKg).toBeLessThan(6.7);
    expect(bien.k.resultado().passed).toBe(true);
    const poco = conSoporte(6);
    expect(poco.k.resultado().criteria.find((c) => c.id === 'vt')!.ok).toBe(false);
  });
  it('la ventilación alveolar cambia mucho menos que el VT: con 12–13 queda en su equilibrio de EPOC y con 20 sólo algo más baja', () => {
    const inicio = conSoporte(null),
      bien = conSoporte(13);
    expect(bien.mlKg / inicio.mlKg).toBeLessThan(0.65);
    expect(bien.va / inicio.va).toBeGreaterThan(0.6);
    expect(inicio.k.sc.patient.gas?.hco3).toBe(32);
    expect(inicio.k.gas.paco2Target!).toBeGreaterThan(33);
    expect(inicio.k.gas.paco2Target!).toBeLessThan(43);
    expect(phEq(inicio.k)).toBeLessThan(7.62);
    for (const k of [bien.k, conSoporte(12).k]) {
      expect(k.gas.paco2Target!).toBeGreaterThan(46);
      expect(k.gas.paco2Target!).toBeLessThan(61);
      expect(phEq(k)).toBeGreaterThan(7.35);
      expect(phEq(k)).toBeLessThan(7.45);
    }
  });
  it('antes de un minuto tras el último ajuste no se puede juzgar la sincronía', () => {
    const k = caso('CC-06');
    k.ajustar({ psupport: 12 });
    k.correr(30_000);
    expect(k.resultado().criteria.find((c) => c.id === 'disparo')!.ok).toBe(false);
  });
});

describe('CAS-07 · autodisparo por fuga', () => {
  it('fuga y latido: con 5 L/min sigue el autodisparo, con 6 cesa; con 8 L/min también, pero se insensibiliza de más', () => {
    const inicio = caso('CC-07');
    expect(inicio.sim.breaths.some((b) => b.type === 'assisted')).toBe(true);
    const corto = caso('CC-07');
    corto.ajustar({ flowTrigger: 5 / 60 });
    corto.correr(30_000);
    expect(corto.resultado().criteria.find((c) => c.id === 'auto')!.ok).toBe(false);
    const bien = caso('CC-07');
    bien.ajustar({ flowTrigger: 6 / 60 });
    bien.correr(30_000);
    expect(bien.resultado().passed).toBe(true);
    const demas = caso('CC-07');
    demas.ajustar({ biasFlow: 10 / 60, flowTrigger: 8 / 60 }); // el disparo no puede superar el flujo de base
    demas.correr(30_000);
    const r = demas.resultado();
    expect(r.criteria.find((c) => c.id === 'auto')!.ok).toBe(true);
    expect(r.criteria.find((c) => c.id === 'trig')!.ok).toBe(false);
  });
});

describe('CAS-08 · ciclado tardío', () => {
  it('con 5 % el ventilador insufla ≈ 1 s de más; con 25 % termina con la paciente y disparan todos', () => {
    const inicio = caso('CC-08');
    inicio.ajustar({});
    inicio.correr(65_000);
    const tiMec =
      inicio.sim
        .frame()
        .trends.slice(-10)
        .reduce((s, t) => s + t.tInspS, 0) / 10;
    expect(tiMec - inicio.sim.frame().truth.effort.tiS).toBeGreaterThan(0.6);
    expect(inicio.resultado().passed).toBe(false);
    const bien = caso('CC-08');
    bien.ajustar({ expTriggerPct: 0.25 });
    bien.correr(65_000);
    expect(bien.resultado().passed).toBe(true);
  });
});

describe('CAS-SOL · la solución que muestra el desarrollo resuelve el caso', () => {
  const casos = SCENARIOS.filter((s) => s.clinical);
  /** Los pasos de la solución, como los haría el alumno; con `alternativa`, ésta sustituye los cambios del último ajuste. */
  const resolver = (sc: Scenario, alternativa?: Partial<VcSettings>) => {
    const k = new Caso(sc);
    const pasos = sc.clinical!.solution.steps;
    const ultimo = pasos.map((p) => p.kind).lastIndexOf('ajuste');
    pasos.forEach((p, i) => {
      if (p.kind === 'bloqueo') k.bloqueo(p.which);
      else {
        k.ajustar(alternativa && i === ultimo ? alternativa : p.changes);
        k.correr(p.waitS * 1000);
      }
    });
    return k.resultado(sc.clinical!.options?.find((o) => o.correct)?.id ?? null);
  };
  it('cada caso declara pasos, y los de ajuste cambian la programación', () => {
    for (const sc of casos) {
      const pasos = sc.clinical!.solution.steps;
      expect(pasos.length, sc.id).toBeGreaterThan(0);
      if (sc.clinical!.kind === 'ajuste')
        expect(
          pasos.some((p) => p.kind === 'ajuste'),
          sc.id,
        ).toBe(true);
      if (sc.clinical!.solution.alternatives)
        expect(
          pasos.some((p) => p.kind === 'ajuste'),
          sc.id,
        ).toBe(true);
    }
  });
  for (const sc of casos)
    it(`${sc.id}: la solución y sus alternativas aprueban todos los criterios`, () => {
      const r = resolver(sc);
      expect(r.criteria.filter((c) => !c.ok).map((c) => c.id)).toEqual([]);
      expect(r.passed).toBe(true);
      for (const alt of sc.clinical!.solution.alternatives ?? []) expect(resolver(sc, alt).passed, JSON.stringify(alt)).toBe(true);
    });
});

describe('CAS-SOL · el desarrollo muestra la solución en una tabla', () => {
  const rules = REFERENCE_PROFILE.rules;
  const inicial = (sc: Scenario): VcSettings => ({ ...REFERENCE_PROFILE.defaults.settings, ...sc.settings });
  const entregar = (sc: Scenario, cambios: Partial<VcSettings>): CaseResult => ({
    criteria: [],
    answer: null,
    passed: false,
    atSimMs: 0,
    settings: { ...inicial(sc), ...cambios },
  });
  const celdas = (fila: Element): string[] => [...fila.children].map((c) => c.textContent!.trim());
  it('CC-05: inicio, tu entrega, la solución y la otra válida, con los pasos en orden', () => {
    const sc = findScenario('CC-05')!;
    const raiz = document.createElement('div');
    raiz.append(...caseDevelopmentNodes(sc, null, entregar(sc, { rr: 18 }), inicial(sc), rules));
    const tabla = raiz.querySelector('.case-solution table')!;
    expect(celdas(tabla.querySelector('thead tr')!)).toEqual(['Ajuste', 'Al inicio', 'Tu entrega', 'Solución', 'También vale']);
    const filas = [...tabla.querySelectorAll('tbody tr')].map(celdas);
    expect(filas).toEqual([
      ['Volumen tidal', '400 mL', '400 mL', '500 mL ↑', '400 mL'],
      ['Frecuencia', '10 /min', '18 /min ↑', '14 /min ↑', '22 /min ↑'],
    ]);
    // Lo que cambió el alumno se marca, igual que lo que cambia la solución.
    expect(tabla.querySelector('tbody tr:nth-child(2) td.tuyo')!.classList.contains('cambia')).toBe(true);
    const pasos = [...raiz.querySelectorAll('.case-steps li')].map((li) => [...li.children].map((c) => c.textContent));
    expect(pasos).toEqual([
      ['Volumen tidal 400 mL → 500 mL · Frecuencia 10 /min → 14 /min', 'más VT con casi el mismo volumen minuto · espera ≈ 30 s'],
    ]);
    // La solución va antes de la explicación: es lo primero que se revisa.
    expect(raiz.querySelector('.case-solution')!.compareDocumentPosition(raiz.querySelector('.case-reveal')!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  it('CC-02: la auto-PEEP y cómo medirla se ven desde el inicio, con su esquema; la solución sólo al entregar', () => {
    const sc = findScenario('CC-02')!;
    const antes = document.createElement('div');
    antes.append(...caseDevelopmentNodes(sc, null, null, inicial(sc), rules));
    expect(antes.querySelector('.case-concept h3')!.textContent).toBe('La auto-PEEP: qué es y cómo se mide');
    expect(antes.querySelector('.case-concept svg[role="img"]')!.getAttribute('aria-label')).toContain('PEEP total');
    expect(antes.querySelectorAll('.case-concept li')).toHaveLength(5);
    expect(antes.querySelector('.case-solution')).toBeNull();
    const despues = document.createElement('div');
    despues.append(...caseDevelopmentNodes(sc, null, entregar(sc, {}), inicial(sc), rules));
    expect(despues.querySelector('.case-solution')).not.toBeNull();
    expect(despues.querySelector('.case-concept')).not.toBeNull();
  });
  it('CC-04: los pasos dicen el camino (5 → 20 → 11) y la tabla, la PEEP final', () => {
    const sc = findScenario('CC-04')!;
    const raiz = document.createElement('div');
    raiz.append(...caseDevelopmentNodes(sc, null, entregar(sc, {}), inicial(sc), rules));
    expect([...raiz.querySelectorAll('.case-solution tbody tr')].map(celdas)).toEqual([['PEEP', '5 cmH₂O', '5 cmH₂O', '11 cmH₂O ↑']]);
    expect([...raiz.querySelectorAll('.case-steps li b')].map((b) => b.textContent)).toEqual([
      'Bloqueo inspiratorio',
      'PEEP 5 cmH₂O → 20 cmH₂O',
      'PEEP 20 cmH₂O → 11 cmH₂O',
      'Bloqueo inspiratorio',
    ]);
  });
  it('CC-01: sin ajustes que cambiar, lo dice y deja sólo la medición; un cambio de modo del alumno aparece', () => {
    const sc = findScenario('CC-01')!;
    const raiz = document.createElement('div');
    raiz.append(...caseDevelopmentNodes(sc, null, entregar(sc, {}), inicial(sc), rules));
    expect(raiz.querySelector('.case-solution table')).toBeNull();
    expect(raiz.querySelector('.case-solution')!.textContent).toContain('se resuelve midiendo');
    const otro = document.createElement('div');
    otro.append(...caseDevelopmentNodes(sc, null, entregar(sc, { mode: 'AC_PC' }), inicial(sc), rules));
    expect([...otro.querySelectorAll('.case-solution tbody tr')].map(celdas)).toEqual([['Modo', 'A/C VC', 'A/C PC', 'A/C VC']]);
  });
});
