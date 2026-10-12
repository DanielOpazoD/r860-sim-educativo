/**
 * Vistas del caso clínico. En el panel lateral: la lista de casos y, con un caso activo, qué debe lograr el alumno,
 * cómo se evalúa y sus referencias. Bajo el ventilador: el desarrollo, que se revela al entregar. Presentación pura.
 */
import { formatNumber as f } from '../domain/units';
import { phFrom } from '../engine/gasExchange';
import type { EngineFrame } from '../engine/simulator';
import type { ClinicalCase, Scenario } from '../scenarios';
import type { CaseResult } from './caseEvaluation';
import type { CaseStatus } from './caseProgress';
import { element, iconNode } from './dom';

function boton(clase: string, texto: string, action: string): HTMLButtonElement {
  const b = element('button', clase, texto);
  b.dataset.action = action;
  return b;
}

function referencias(c: ClinicalCase): HTMLElement {
  return element(
    'div',
    'case-refs',
    element('h3', 'aula-kicker', 'Referencias'),
    element(
      'ul',
      '',
      ...c.references.map((r) => {
        const a = element('a', '', r.short);
        a.href = r.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title = r.citation;
        return element('li', '', a);
      }),
    ),
  );
}

/** Lista de casos del panel: código, tema, título y estado. */
export function caseListNodes(cases: Scenario[], currentId: string, progress: Record<string, CaseStatus>): HTMLElement[] {
  return [
    element('p', 'case-panel-lead', 'Elige un caso. Cada uno prepara el paciente y el ventilador, y te dice qué debes lograr.'),
    element(
      'div',
      'case-list',
      ...cases.map((sc) => {
        const estado = progress[sc.id] === 'resuelto' ? 'Resuelto' : progress[sc.id] === 'intentado' ? 'Intentado' : '';
        const b = element(
          'button',
          `case-item${sc.id === currentId ? ' current' : ''}${estado === 'Resuelto' ? ' solved' : ''}`,
          element('span', 'aula-kicker', [sc.id, sc.clinical!.theme, estado].filter(Boolean).join(' · ')),
          element('strong', '', sc.name),
        );
        b.dataset.caseId = sc.id;
        return b;
      }),
    ),
  ];
}

/** Caso activo en el panel: qué lograr, cómo se evalúa y, tras entregar, el veredicto por criterio. */
export function caseBriefNodes(sc: Scenario, answer: string | null, result: CaseResult | null, imported = false): HTMLElement[] {
  const c = sc.clinical!;
  const nodos: HTMLElement[] = [
    boton('case-back', '← Todos los casos', 'scenarios'),
    element('p', 'aula-kicker', `${sc.id} · ${c.theme}`),
    element('h2', 'case-title', sc.name),
    element('p', 'case-vignette', c.vignette),
    element('div', 'case-goal', element('span', 'aula-kicker', 'Qué debes lograr'), element('p', '', c.question)),
  ];
  if (c.kind === 'diagnostico' && c.options) {
    const opciones = element(
      'div',
      'case-options',
      ...c.options.map((o) => {
        const b = element('button', `case-option${answer === o.id ? ' chosen' : ''}${result && o.correct ? ' correct' : ''}`, o.text);
        b.dataset.caseOption = o.id;
        b.setAttribute('aria-pressed', String(answer === o.id));
        b.disabled = !!result;
        return b;
      }),
    );
    opciones.setAttribute('role', 'group');
    opciones.setAttribute('aria-label', 'Respuestas posibles');
    nodos.push(opciones);
  }
  const marca = (ok: boolean | null, i: number): HTMLElement =>
    element('span', 'task-check', ok === null ? String(i + 1) : ok ? iconNode('check') : '×');
  const criterios = c.criteria.map((cr, i) => {
    const ok = result ? (result.criteria.find((x) => x.id === cr.id)?.ok ?? false) : null;
    return element('div', `task${ok ? ' complete' : ''}`, marca(ok, i), element('span', '', cr.text));
  });
  if (c.kind === 'diagnostico')
    criterios.push(
      element(
        'div',
        `task${result?.answer?.ok ? ' complete' : ''}`,
        marca(result ? !!result.answer?.ok : null, c.criteria.length),
        element('span', '', 'Tu respuesta'),
      ),
    );
  nodos.push(
    element(
      'div',
      'case-criteria',
      element('span', 'aula-kicker', result ? (result.passed ? 'Caso resuelto' : 'Revisa lo que faltó') : 'Qué se evalúa al entregar'),
      element('div', 'lesson-tasks', ...criterios),
    ),
  );
  const acciones = element('div', 'case-actions');
  // Una sesión importada no dice de qué caso es: evaluarla juzgaría al alumno por algo que no hizo aquí.
  if (imported && !result) {
    nodos.push(element('p', 'case-panel-lead', 'Sesión importada: no se evalúa como este caso.'));
    acciones.append(boton('button secondary-button', 'Reiniciar el caso', 'restartCase'));
  } else if (!result) {
    const entregar = boton('primary-button', 'Entregar', 'submitCase');
    entregar.disabled = c.kind === 'diagnostico' && !answer;
    acciones.append(entregar);
  } else acciones.append(boton('button secondary-button', 'Repetir el caso', 'restartCase'));
  acciones.append(
    boton('case-link', result ? 'Ver desarrollo ↓' : 'Desarrollo ↓', 'caseDevelopment'),
    boton('case-link', 'Aula ↓', 'classroom'),
  );
  nodos.push(acciones, referencias(c));
  return nodos;
}

function fila(label: string, valor: string): HTMLElement {
  return element('div', '', element('dt', '', label), element('dd', '', valor));
}

/** Lo que el modelo sabía y el alumno no veía: sólo tras entregar. */
function verdad(frame: EngineFrame | null): HTMLElement | null {
  if (!frame) return null;
  const t = frame.truth;
  const p = t.patient;
  const g = t.gas;
  const filas = [
    fila('Distensibilidad', `${f(p.crs * 1000, 0)} mL/cmH₂O`),
    fila('Resistencia insp / esp', `${f(p.rInsp, 0)} / ${f(p.rExp, 0)} cmH₂O·s/L`),
    fila('Auto-PEEP verdadera', `${f(t.peepiEndExp, 1)} cmH₂O`),
  ];
  if (t.effort.enabled)
    filas.push(
      fila('Esfuerzo del paciente', `${f(t.effort.amplitude, 0)} cmH₂O · ${f(t.effort.ratePerMin, 0)}/min · Ti ${f(t.effort.tiS, 1)} s`),
    );
  if (g && g.paco2Target !== null)
    filas.push(fila('PaCO₂ y pH de equilibrio', `${f(g.paco2Target, 0)} mmHg · ${f(phFrom(g.hco3, g.paco2Target), 2)}`));
  return element('div', 'case-truth', element('h3', 'aula-kicker', 'Lo que el modelo sabía'), element('dl', 'edu-gases', ...filas));
}

/** Desarrollo del caso bajo el ventilador: oculto hasta entregar; después, respuesta, explicación y verdad del modelo. */
export function caseDevelopmentNodes(sc: Scenario, frame: EngineFrame | null, result: CaseResult | null): HTMLElement[] {
  const c = sc.clinical!;
  if (!result)
    return [element('p', 'aula-caption', 'Se revela al entregar el caso: la explicación, la respuesta y lo que el modelo sabía.')];
  const elegida = c.options?.find((o) => o.id === result.answer?.id);
  const correcta = c.options?.find((o) => o.correct);
  const nodos: HTMLElement[] = [
    element('h2', 'learn-title', sc.name),
    element('div', `case-verdict ${result.passed ? 'ok' : 'revisar'}`, result.passed ? 'Caso resuelto' : 'Revisa lo que faltó'),
  ];
  if (elegida) nodos.push(element('p', 'aula-caption', `Tu respuesta: ${elegida.text}. ${elegida.why}`));
  if (correcta && correcta !== elegida) nodos.push(element('p', 'aula-caption', `Correcta: ${correcta.text}. ${correcta.why}`));
  nodos.push(element('p', 'case-reveal', c.reveal));
  const v = verdad(frame);
  if (v) nodos.push(v);
  return nodos;
}
