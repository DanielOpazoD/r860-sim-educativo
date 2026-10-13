/**
 * Vistas del caso clínico. En el panel lateral: la lista de casos y, con un caso activo, qué debe lograr el alumno,
 * la entrega y sus referencias. Bajo el ventilador: el desarrollo, que se revela al entregar. Presentación pura.
 */
import { formatNumber as f } from '../domain/units';
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

/** «Hess, Respir Care 2014» → «Hess 2014»: autor y año a la vista; la cita completa, en la ayuda emergente. */
export function refCorta(short: string): string {
  const año = /(\d{4})\s*$/.exec(short)?.[1];
  return año ? `${short.split(',')[0]!.trim()} ${año}` : short;
}

/** Referencias en una línea: autor y año enlazados a la fuente. */
function referencias(c: ClinicalCase): HTMLElement {
  const nodos: (Node | string)[] = [element('span', 'case-refs-label', 'Referencias')];
  c.references.forEach((r, i) => {
    const a = element('a', '', refCorta(r.short));
    a.href = r.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = r.citation;
    nodos.push(i === 0 ? ' ' : ' · ', a);
  });
  return element('p', 'case-refs', ...nodos);
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

/**
 * Caso activo en el panel, compacto para leerse entero sin desplazarse: tema, título en una línea, viñeta, objetivo
 * (cada consigna ya nombra sus criterios), respuestas si es diagnóstico, entrega y referencias. Tras entregar, el
 * veredicto por criterio ocupa el lugar que antes no hacía falta.
 */
export function caseBriefNodes(sc: Scenario, answer: string | null, result: CaseResult | null, imported = false): HTMLElement[] {
  const c = sc.clinical!;
  const volver = boton('case-back', '←', 'scenarios');
  volver.setAttribute('aria-label', 'Todos los casos');
  volver.title = 'Todos los casos';
  const titulo = element('h2', 'case-title', sc.name);
  titulo.title = sc.name;
  const nodos: HTMLElement[] = [
    element('div', 'case-top', volver, element('span', 'aula-kicker', `${sc.id} · ${c.theme}`)),
    titulo,
    element('p', 'case-vignette', c.vignette),
    element('div', 'case-goal', element('span', 'aula-kicker', 'Objetivo'), element('p', '', c.question)),
  ];
  if (c.kind === 'diagnostico' && c.options) {
    // Entregado, ya no se elige: quedan sólo la respuesta del alumno y la correcta.
    const visibles = result ? c.options.filter((o) => o.correct || o.id === answer) : c.options;
    const opciones = element(
      'div',
      'case-options',
      ...visibles.map((o) => {
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
  if (result) {
    const item = (ok: boolean, texto: string): HTMLElement =>
      element('li', ok ? 'ok' : 'no', element('span', 'case-check', ok ? iconNode('check') : '×'), element('span', '', texto));
    const items = c.criteria.map((cr) => item(result.criteria.find((x) => x.id === cr.id)?.ok ?? false, cr.text));
    if (c.kind === 'diagnostico') items.push(item(!!result.answer?.ok, 'Tu respuesta'));
    nodos.push(
      element(
        'div',
        'case-criteria',
        element('p', `case-verdict ${result.passed ? 'ok' : 'revisar'}`, result.passed ? 'Caso resuelto' : 'Revisa lo que faltó'),
        element('ul', 'case-checks', ...items),
      ),
    );
  }
  const acciones = element('div', 'case-actions');
  // Una sesión importada no dice de qué caso es: evaluarla juzgaría al alumno por algo que no hizo aquí.
  if (imported && !result) {
    nodos.push(element('p', 'case-panel-lead', 'Sesión importada: no se evalúa como este caso.'));
    acciones.append(boton('button secondary-button', 'Reiniciar el caso', 'restartCase'));
  } else if (!result) {
    const entregar = boton('primary-button', 'Entregar', 'submitCase');
    entregar.disabled = c.kind === 'diagnostico' && !answer;
    acciones.append(entregar);
  } else acciones.append(boton('button secondary-button', 'Repetir', 'restartCase'));
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
  if (g && g.paco2Target !== null && g.phTarget !== null)
    filas.push(fila('PaCO₂ y pH de equilibrio', `${f(g.paco2Target, 0)} mmHg · ${f(g.phTarget, 2)}`));
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
