// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { REFERENCE_PROFILE, defaultInit } from '../../src/profiles';
import { SCENARIOS, findScenario, type Scenario } from '../../src/scenarios';
import { CASE_TESTS, evaluateCase, type CaseContext } from '../../src/ui/caseEvaluation';
import { updateLessonFlags } from '../../src/ui/lesson';
import { phFrom } from '../../src/engine/gasExchange';
import { CASES_KEY, loadCaseProgress, saveCaseProgress } from '../../src/ui/caseProgress';

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
  sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
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
    this.sim.command({ type: 'requestHold', kind, durationS: 2 });
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
const phEq = (k: Caso): number => phFrom(k.gas.hco3, k.gas.paco2Target!);

describe('CAS-02 · EPOC: atrapamiento', () => {
  it('la viñeta: PEEP intrínseca ≈ 8 y alcalemia de equilibrio ≈ 7,56; no se resuelve sin tocar nada', () => {
    const k = caso('CC-02');
    k.correr(40_000);
    expect(k.sim.frame().truth.peepiEndExp).toBeGreaterThan(6.5);
    expect(k.sim.frame().truth.peepiEndExp).toBeLessThan(9);
    expect(phEq(k)).toBeCloseTo(7.56, 1);
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
      ['peepi', true],
      ['ph', true],
    ]);
    const soloIe = caso('CC-02');
    soloIe.ajustar({ ie: 1 / 4 });
    soloIe.correr(60_000);
    soloIe.bloqueo('expHold');
    expect(soloIe.resultado().criteria.find((c) => c.id === 'peepi')!.ok).toBe(false);
    const vtBajo = caso('CC-02');
    vtBajo.ajustar({ vt: 0.4, rr: 14, ie: 1 / 4 });
    vtBajo.correr(60_000);
    vtBajo.bloqueo('expHold');
    // El espacio muerto de la vía aérea se paga: con VT 400 la acidosis de equilibrio sale del rango.
    expect(vtBajo.resultado().criteria.find((c) => c.id === 'ph')!.ok).toBe(false);
  });
});

describe('CAS-03 · SDRA: VT protector', () => {
  it('la viñeta: ΔP 20 y pH 7,42 con VT 600', () => {
    const k = caso('CC-03');
    k.bloqueo('inspHold');
    expect(k.sim.procedures.last.inspHold!.values.driving!.value!).toBeCloseTo(20, 0);
    expect(phEq(k)).toBeCloseTo(7.42, 1);
    expect(k.resultado().passed).toBe(false);
  });
  it('VT 425 con FR 28 lo resuelve; VT 425 sin subir la FR deja acidosis', () => {
    const bien = caso('CC-03');
    bien.ajustar({ vt: 0.425, rr: 28 });
    bien.correr(30_000);
    bien.bloqueo('inspHold');
    const h = bien.sim.procedures.last.inspHold!;
    expect(h.values.driving!.value!).toBeCloseTo(14.2, 0);
    expect(h.values.pplat!.value!).toBeCloseTo(24.2, 0);
    expect(bien.resultado().passed).toBe(true);
    const sinFr = caso('CC-03');
    sinFr.ajustar({ vt: 0.425 });
    sinFr.correr(30_000);
    sinFr.bloqueo('inspHold');
    expect(sinFr.gas.paco2Target!).toBeCloseTo(64, -1);
    expect(sinFr.resultado().criteria.find((c) => c.id === 'ph')!.ok).toBe(false);
    // VD/VT en el rango que Nuckton midió en el SDRA (0,58 ± 0,09): más alto con el VT protector.
    expect(sinFr.gas.vdVt!).toBeGreaterThan(0.55);
    expect(sinFr.gas.vdVt!).toBeLessThan(0.65);
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
  it('la viñeta: PaCO₂ 88 y pH 7,06 de equilibrio', () => {
    const k = caso('CC-05');
    expect(k.gas.paco2Target!).toBeCloseTo(88, -1);
    expect(phEq(k)).toBeCloseTo(7.06, 1);
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
  it('como en Thille: con soporte 20 casi la mitad de los esfuerzos no dispara con VT ≈ 10 mL/kg; con 13 disparan todos con ≈ 6', () => {
    const inicio = conSoporte(null);
    expect(1 - inicio.disparan).toBeGreaterThan(0.36);
    expect(1 - inicio.disparan).toBeLessThan(0.52);
    expect(inicio.mlKg).toBeGreaterThan(9);
    expect(inicio.mlKg).toBeLessThan(11.5);
    expect(inicio.k.resultado().criteria.find((c) => c.id === 'disparo')!.ok).toBe(false);
    const bien = conSoporte(13);
    expect(bien.disparan).toBe(1);
    expect(bien.mlKg).toBeGreaterThan(5);
    expect(bien.mlKg).toBeLessThan(6.7);
    expect(bien.k.resultado().passed).toBe(true);
    const poco = conSoporte(6);
    expect(poco.k.resultado().criteria.find((c) => c.id === 'vt')!.ok).toBe(false);
  });
  it('la ventilación alveolar cambia mucho menos que el VT: con 12–13 queda en su equilibrio de EPOC y con 20 sólo algo más baja', () => {
    const inicio = conSoporte(null),
      bien = conSoporte(13);
    expect(bien.mlKg / inicio.mlKg).toBeLessThan(0.6);
    expect(bien.va / inicio.va).toBeGreaterThan(0.65);
    expect(inicio.k.gas.hco3).toBe(28);
    expect(inicio.k.gas.paco2Target!).toBeGreaterThan(28);
    expect(inicio.k.gas.paco2Target!).toBeLessThan(34);
    expect(phEq(inicio.k)).toBeLessThan(7.62);
    for (const k of [bien.k, conSoporte(12).k]) {
      expect(k.gas.paco2Target!).toBeGreaterThan(42);
      expect(k.gas.paco2Target!).toBeLessThan(50);
      expect(phEq(k)).toBeGreaterThan(7.36);
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
  it('con 4 L/min cesa el autodisparo; con 8 L/min también, pero se insensibiliza de más', () => {
    const inicio = caso('CC-07');
    expect(inicio.sim.breaths.some((b) => b.type === 'assisted')).toBe(true);
    const bien = caso('CC-07');
    bien.ajustar({ flowTrigger: 4 / 60 });
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
