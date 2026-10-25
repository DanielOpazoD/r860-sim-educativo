/**
 * Vistas del caso clínico. En el panel lateral: la lista de casos y, con un caso activo, qué debe lograr el alumno,
 * la entrega y sus referencias. Bajo el ventilador: el desarrollo, que se revela al entregar. Presentación pura.
 */
import type { SettingRule } from '../domain/settingRules';
import type { SettingsKey, VcSettings, VentMode } from '../domain/types';
import { formatTexto as f } from '../domain/units';
import { DEFAULT_GAS } from '../engine/gasExchange';
import type { EngineFrame } from '../engine/simulator';
import type { CaseStep, ClinicalCase, Scenario } from '../scenarios';
import type { CaseResult } from './caseEvaluation';
import type { CaseStatus } from './caseProgress';
import { autoPeepFigure } from './autoPeepFigure';
import { element, iconNode } from './dom';
import { unitText } from './format';
import { displaySetting, MODE_LABEL, QUICK_LABEL } from './labels';

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

/**
 * Lo que el modelo sabía y el alumno no veía: sólo tras entregar. Además de la mecánica, la variable que enseña el caso
 * cuando el modelo la tiene: el espacio muerto (CC-03, CC-05 y los EPOC) y la presión crítica de la limitación al flujo
 * (CC-02, CC-06). Con coma decimal: es texto del caso, no el monitor.
 */
function verdad(frame: EngineFrame | null): HTMLElement | null {
  if (!frame) return null;
  const t = frame.truth;
  const p = t.patient;
  const g = t.gas;
  const s = p.sigmoid && p.sigmoid.b > 0 ? p.sigmoid : null;
  const filas = [
    // Con curva sigmoidea no hay una sola compliance: se dice la máxima y dónde empieza a caer.
    s
      ? fila('Compliance', `no lineal · máxima ${f((s.b / (4 * s.d)) * 1000, 0)} mL/cmH₂O; cae sobre ≈ ${f(s.c + 1.317 * s.d, 0)} cmH₂O`)
      : fila('Compliance', `${f(p.crs * 1000, 0)} mL/cmH₂O`),
    // La del paciente: el bloqueo mide además la del tubo, que crece con el flujo.
    fila(p.r2 ? 'Resistencia insp / esp (sin el tubo)' : 'Resistencia insp / esp', `${f(p.rInsp, 0)} / ${f(p.rExp, 0)} cmH₂O·s/L`),
    fila('Auto-PEEP verdadera', `${f(t.peepiEndExp, 1)} cmH₂O`),
  ];
  if (p.efl) filas.push(fila('Presión crítica (limitación al flujo)', `${f(p.efl.pcrit, 0)} cmH₂O`));
  const gp = p.gas;
  if (gp && (gp.deadspaceL !== undefined || gp.alveolarDeadspaceFrac !== undefined)) {
    const via = (gp.deadspaceL ?? DEFAULT_GAS.deadspaceL) * 1000;
    const alveolar = gp.alveolarDeadspaceFrac ?? DEFAULT_GAS.alveolarDeadspaceFrac;
    const vdvt = g && g.vdVt !== null ? ` · VD/VT ${f(g.vdVt, 2)}` : '';
    filas.push(fila('Espacio muerto', `vía aérea ${f(via, 0)} mL · fracción alveolar ${f(alveolar, 2)}${vdvt}`));
  }
  if (t.effort.enabled)
    filas.push(
      fila('Esfuerzo del paciente', `${f(t.effort.amplitude, 0)} cmH₂O · ${f(t.effort.ratePerMin, 0)}/min · Ti ${f(t.effort.tiS, 1)} s`),
    );
  if (g && g.paco2Target !== null && g.phTarget !== null)
    filas.push(fila('PaCO₂ y pH de equilibrio', `${f(g.paco2Target, 0)} mmHg · ${f(g.phTarget, 2)}`));
  return element('div', 'case-truth', element('h3', 'aula-kicker', 'Lo que el modelo sabía'), element('dl', 'edu-gases', ...filas));
}

/** Un ajuste de la programación, el modo incluido: el alumno puede resolver (o no) cambiando de modo. */
type Clave = keyof VcSettings;
type Valor = VcSettings[Clave];
// «Volumen corriente», el término de los casos, aunque la tecla rápida diga otro.
const rotulo = (k: Clave): string => (k === 'mode' ? 'Modo' : k === 'vt' ? 'Volumen corriente' : QUICK_LABEL[k]);

/** Un ajuste con su unidad, como en la tecla rápida pero con coma decimal: «500 mL», «1:2,5», «6 L/min». */
function valorAjuste(rules: Record<SettingsKey, SettingRule>, k: Clave, v: Valor): string {
  if (k === 'mode') return MODE_LABEL[v as VentMode];
  const texto = displaySetting(rules, k, v as VcSettings[SettingsKey]).replace(/\./g, ',');
  const unidad = typeof v === 'number' && k !== 'ie' ? unitText(rules[k].displayUnit) : '';
  return unidad ? `${texto} ${unidad}` : texto;
}

/** Programación que deja la solución: la del inicio con cada ajuste encima, en orden; con `ultimo`, éste sustituye al último. */
function programacionFinal(inicial: VcSettings, pasos: CaseStep[], ultimo?: Partial<VcSettings>): VcSettings {
  const ajustes = pasos.filter((p) => p.kind === 'ajuste');
  return ajustes.reduce<VcSettings>((s, p, i) => ({ ...s, ...(ultimo && i === ajustes.length - 1 ? ultimo : p.changes) }), { ...inicial });
}

const ESPERA = (s: number): string => (s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);
const BLOQUEO = { inspHold: 'Bloqueo inspiratorio', expHold: 'Bloqueo espiratorio' } as const;

/**
 * Cómo se resuelve, de un vistazo: una tabla con cada ajuste que importa —al inicio, el que entregó el alumno y el de la
 * solución (y el de otra solución válida, si la hay)— y debajo los pasos en orden, con lo que mide cada bloqueo y cuánto
 * esperar. Las filas son los ajustes que la solución cambia y los que el alumno cambió: así se ve qué tocó de más o de menos.
 */
function solucion(c: ClinicalCase, result: CaseResult, inicial: VcSettings, rules: Record<SettingsKey, SettingRule>): HTMLElement {
  const pasos = c.solution.steps;
  const final = programacionFinal(inicial, pasos);
  const otras = (c.solution.alternatives ?? []).map((alt) => programacionFinal(inicial, pasos, alt));
  // Un resultado guardado antes de que la entrega registrara la programación no la trae: entonces no hay columna.
  const entregado = result.settings as VcSettings | undefined;
  // Se compara lo que se muestra, no el número interno: deshacer un cambio con el editor no deja una fila fantasma.
  const distinto = (k: Clave, v: Valor): boolean => valorAjuste(rules, k, v) !== valorAjuste(rules, k, inicial[k]);
  const claves = new Set<Clave>();
  for (const p of pasos) if (p.kind === 'ajuste') for (const k of Object.keys(p.changes) as Clave[]) claves.add(k);
  for (const alt of c.solution.alternatives ?? []) for (const k of Object.keys(alt) as Clave[]) claves.add(k);
  if (entregado) for (const k of Object.keys(inicial) as Clave[]) if (distinto(k, entregado[k])) claves.add(k);

  const nodos: HTMLElement[] = [element('h3', 'aula-kicker', 'Cómo se resuelve')];
  if (claves.size) {
    const celda = (k: Clave, v: Valor, clase: string): HTMLElement => {
      const cambia = distinto(k, v);
      const flecha = cambia && typeof v === 'number' && typeof inicial[k] === 'number' ? (v > (inicial[k] as number) ? ' ↑' : ' ↓') : '';
      return element(
        'td',
        `${clase}${cambia ? ' cambia' : ''}`,
        valorAjuste(rules, k, v),
        flecha ? element('span', 'case-arrow', flecha) : '',
      );
    };
    const columnas: [string, string][] = [
      ['Ajuste', ''],
      ['Al inicio', ''],
      ...(entregado ? ([['Tu entrega', '']] as [string, string][]) : []),
      ['Solución', 'sol'],
      ...otras.map((): [string, string] => ['También vale', 'sol alt']),
    ];
    const cabeza = element('thead', '', element('tr', '', ...columnas.map(([t, clase]) => element('th', clase, t))));
    const filas = [...claves].map((k) =>
      element(
        'tr',
        '',
        element('th', '', rotulo(k)),
        element('td', 'inicio', valorAjuste(rules, k, inicial[k])),
        ...(entregado ? [celda(k, entregado[k], 'tuyo')] : []),
        celda(k, final[k], 'sol'),
        ...otras.map((o) => celda(k, o[k], 'sol alt')),
      ),
    );
    const tabla = element('table', 'case-solution-table', cabeza, element('tbody', '', ...filas));
    tabla.setAttribute('aria-label', 'Ajustes al inicio, en tu entrega y en la solución');
    nodos.push(element('div', 'case-solution-scroll', tabla));
  } else nodos.push(element('p', 'aula-caption', 'No hace falta cambiar la programación: el caso se resuelve midiendo.'));

  let previa: VcSettings = { ...inicial };
  const lista = element(
    'ol',
    'case-steps',
    ...pasos.map((p) => {
      if (p.kind === 'bloqueo') return element('li', '', element('b', '', BLOQUEO[p.which]), element('span', 'case-step-note', p.note));
      const cambios = (Object.keys(p.changes) as Clave[]).map(
        (k) => `${rotulo(k)} ${valorAjuste(rules, k, previa[k])} → ${valorAjuste(rules, k, p.changes[k] as Valor)}`,
      );
      previa = { ...previa, ...p.changes };
      return element(
        'li',
        '',
        element('b', '', cambios.join(' · ')),
        element('span', 'case-step-note', [p.note, `espera ≈ ${ESPERA(p.waitS)}`].filter(Boolean).join(' · ')),
      );
    }),
  );
  nodos.push(lista);
  return element('section', 'case-solution', ...nodos);
}

const FIGURAS = { autoPeep: autoPeepFigure } as const;

/** El concepto del caso con su esquema: qué buscar y cómo medirlo, a la vista antes y después de entregar. */
function concepto(c: ClinicalCase): HTMLElement | null {
  if (!c.concept) return null;
  const nodos: HTMLElement[] = [element('h3', 'aula-kicker', c.concept.title)];
  if (c.concept.figure) {
    const figura = element('div', 'edu-diagram case-concept-figure');
    figura.innerHTML = FIGURAS[c.concept.figure](); // esquema constante, sin datos del usuario
    nodos.push(figura);
  }
  nodos.push(element('ul', 'case-concept-points', ...c.concept.points.map((p) => element('li', '', p))));
  return element('section', 'case-concept', ...nodos);
}

/**
 * Desarrollo del caso bajo el ventilador. El concepto que el caso pide medir se ve desde el inicio; la respuesta, la
 * solución, la explicación y la verdad del modelo, sólo al entregar.
 */
export function caseDevelopmentNodes(
  sc: Scenario,
  frame: EngineFrame | null,
  result: CaseResult | null,
  inicial: VcSettings,
  rules: Record<SettingsKey, SettingRule>,
): HTMLElement[] {
  const c = sc.clinical!;
  const idea = concepto(c);
  if (!result)
    return [
      ...(idea ? [idea] : []),
      element('p', 'aula-caption', 'Se revela al entregar el caso: la explicación, la respuesta y lo que el modelo sabía.'),
    ];
  const elegida = c.options?.find((o) => o.id === result.answer?.id);
  const correcta = c.options?.find((o) => o.correct);
  const nodos: HTMLElement[] = [
    element('h2', 'learn-title', sc.name),
    element('div', `case-verdict ${result.passed ? 'ok' : 'revisar'}`, result.passed ? 'Caso resuelto' : 'Revisa lo que faltó'),
  ];
  if (elegida) nodos.push(element('p', 'aula-caption', `Tu respuesta: ${elegida.text}. ${elegida.why}`));
  if (correcta && correcta !== elegida) nodos.push(element('p', 'aula-caption', `Correcta: ${correcta.text}. ${correcta.why}`));
  nodos.push(solucion(c, result, inicial, rules), element('p', 'case-reveal', c.reveal));
  if (idea) nodos.push(idea);
  const v = verdad(frame);
  if (v) nodos.push(v);
  return nodos;
}
