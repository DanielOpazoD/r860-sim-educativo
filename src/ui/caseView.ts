/**
 * Caso actual de un caso clínico: viñeta, pregunta, opciones, qué se evalúa y, tras entregar, el veredicto, la verdad
 * del modelo y la explicación. Las referencias están siempre a la vista. Presentación pura sobre el escenario y el estado.
 */
import { formatNumber as f } from '../domain/units';
import { phFrom } from '../engine/gasExchange';
import type { EngineFrame } from '../engine/simulator';
import type { ClinicalCase, Scenario } from '../scenarios';
import type { CaseResult } from './caseEvaluation';
import { element, iconNode } from './dom';

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
        return element('li', '', a, element('small', '', r.citation));
      }),
    ),
  );
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

export function caseNodes(sc: Scenario, frame: EngineFrame | null, answer: string | null, result: CaseResult | null): HTMLElement[] {
  const c = sc.clinical!;
  const intro = element(
    'article',
    'aula-intro',
    element('p', 'aula-kicker', `${sc.id} · ${c.theme}`),
    element('h2', 'lesson-title', sc.name),
    element('p', 'lesson-text', c.vignette),
    element('p', 'case-question', c.question),
  );
  if (c.kind === 'diagnostico' && c.options) {
    const opciones = element(
      'div',
      'case-options',
      ...c.options.map((o) => {
        const elegida = answer === o.id;
        const b = element('button', `case-option${elegida ? ' chosen' : ''}`, o.text);
        b.dataset.caseOption = o.id;
        b.setAttribute('aria-pressed', String(elegida));
        b.disabled = !!result;
        if (result) b.classList.toggle('correct', o.correct);
        return b;
      }),
    );
    opciones.setAttribute('role', 'group');
    opciones.setAttribute('aria-label', 'Respuestas posibles');
    intro.append(opciones);
  }
  const acciones = element('div', 'case-actions');
  if (!result) {
    const ir = element('button', 'primary-button', 'Ir al ventilador ', element('span', '', '→'));
    ir.dataset.action = 'practice';
    const entregar = element('button', 'button secondary-button', 'Entregar');
    entregar.dataset.action = 'submitCase';
    entregar.disabled = c.kind === 'diagnostico' && !answer;
    acciones.append(ir, entregar);
  } else {
    const repetir = element('button', 'button secondary-button', 'Repetir el caso');
    repetir.dataset.action = 'restartCase';
    acciones.append(repetir);
  }
  intro.append(acciones, referencias(c));

  const papel = element('article', 'aula-paper');
  if (!result) {
    papel.append(
      element('div', 'lesson-count', 'Qué se evalúa al entregar'),
      element(
        'div',
        'lesson-tasks',
        ...c.criteria.map((cr, i) => element('div', 'task', element('span', 'task-check', String(i + 1)), element('span', '', cr.text))),
        ...(c.kind === 'diagnostico'
          ? [element('div', 'task', element('span', 'task-check', String(c.criteria.length + 1)), element('span', '', 'Tu respuesta'))]
          : []),
      ),
      element('p', 'aula-caption', 'La mecánica del paciente queda oculta hasta entregar.'),
    );
  } else {
    const elegida = c.options?.find((o) => o.id === result.answer?.id);
    const correcta = c.options?.find((o) => o.correct);
    papel.append(
      element('div', `case-verdict ${result.passed ? 'ok' : 'revisar'}`, result.passed ? 'Caso resuelto' : 'Revisa lo que faltó'),
      element(
        'div',
        'lesson-tasks',
        ...result.criteria.map((cr) =>
          element(
            'div',
            `task${cr.ok ? ' complete' : ''}`,
            element('span', 'task-check', cr.ok ? iconNode('check') : '×'),
            element('span', '', cr.text),
          ),
        ),
        ...(c.kind === 'diagnostico'
          ? [
              element(
                'div',
                `task${result.answer?.ok ? ' complete' : ''}`,
                element('span', 'task-check', result.answer?.ok ? iconNode('check') : '×'),
                element('span', '', `Tu respuesta: ${elegida?.text ?? 'sin respuesta'}`),
              ),
            ]
          : []),
      ),
      ...(elegida ? [element('p', 'aula-caption', elegida.why)] : []),
      ...(correcta && correcta !== elegida ? [element('p', 'aula-caption', `Correcta: ${correcta.text}. ${correcta.why}`)] : []),
      element('p', 'case-reveal', c.reveal),
    );
    const v = verdad(frame);
    if (v) papel.append(v);
  }
  return [intro, papel];
}
