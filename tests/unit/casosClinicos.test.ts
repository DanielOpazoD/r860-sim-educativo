// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { REFERENCE_PROFILE, defaultInit } from '../../src/profiles';
import { SCENARIOS, findScenario, type Scenario } from '../../src/scenarios';
import { CASE_TESTS, evaluateCase, type CaseContext } from '../../src/ui/caseEvaluation';
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
  it('cada caso declara tema, viñeta, pregunta, criterios con pruebas existentes y referencias de PubMed', () => {
    expect(casos.length).toBeGreaterThan(0);
    for (const sc of casos) {
      const c = sc.clinical!;
      expect(c.theme && c.vignette && c.question && c.reveal, sc.id).toBeTruthy();
      expect(c.references.length, sc.id).toBeGreaterThan(0);
      for (const r of c.references) expect(r.url, sc.id).toMatch(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/);
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
