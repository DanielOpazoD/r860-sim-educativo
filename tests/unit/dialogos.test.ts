import { describe, expect, it } from 'vitest';
import { REFERENCE_PROFILE } from '../../src/profiles';
import { CLINICAL_CASES } from '../../src/scenarios/cases';
import type { CaseResult } from '../../src/ui/caseEvaluation';
import { debriefText, SOURCES } from '../../src/ui/dialogs';
import { benchSim, runUntilBreath } from '../helpers';

describe('resumen de práctica TXT', () => {
  it('lo fallado sale «No cumplido», la respuesta con su texto y los ajustes en unidades clínicas', () => {
    const scenario = CLINICAL_CASES.find((c) => c.clinical?.kind === 'diagnostico')!;
    const c = scenario.clinical!;
    const mala = c.options!.find((o) => !o.correct)!;
    const sim = benchSim();
    runUntilBreath(sim, 2);
    const fr = sim.frame();
    const result: CaseResult = {
      criteria: c.criteria.map((cr) => ({ id: cr.id, text: cr.text, ok: false })),
      answer: { id: mala.id, ok: false },
      passed: false,
      atSimMs: fr.simTimeMs,
      settings: { ...fr.settings },
    };
    const txt = debriefText({ scenario, simS: fr.simTimeMs / 1000, result }, fr, REFERENCE_PROFILE.rules);
    expect(txt).not.toContain('[Pendiente]');
    expect(txt).toContain(`[No cumplido] Respuesta elegida: ${mala.text}`);
    expect(txt).toContain(`Volumen corriente: ${Math.round(fr.settings.vt * 1000)} mL`);
    expect(txt).toContain(`FiO₂: ${Math.round(fr.settings.fio2 * 100)} %`);
    expect(txt).not.toContain('"vt"');
    expect(txt).toContain(`ÚLTIMOS EVENTOS (${fr.eventsTail.length})`);
  });
});

describe('fuentes de la guía', () => {
  it('son las referencias clínicas del modelo y de los casos, sin repetir', () => {
    const titulos = SOURCES.map(([t]) => t);
    expect(titulos.join()).not.toMatch(/MDN|Web Workers/);
    for (const autor of ['Akoumianaki', 'Baedorf Kassis', "D'Angelo", 'Pinède', 'Gattinoni']) expect(titulos.join()).toContain(autor);
    for (const r of CLINICAL_CASES.flatMap((c) => c.clinical?.references ?? []))
      expect(SOURCES.some(([, , url]) => url === r.url)).toBe(true);
    expect(new Set(SOURCES.map(([, , url]) => url)).size).toBe(SOURCES.length);
  });
});
