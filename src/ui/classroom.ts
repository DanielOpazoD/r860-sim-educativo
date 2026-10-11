import { SCENARIOS } from '../scenarios';
import type { AppContext } from './context';
import { debriefNodes } from './dialogs';
import { $, $$, element, put } from './dom';

const SECTIONS = ['lesson', 'theory', 'questions', 'exam', 'results', 'library'] as const;
const HEADINGS: Record<Section, { kicker: string; title: string; lead: string }> = {
  lesson: {
    kicker: 'R860 LAB · APRENDIZAJE',
    title: 'Comprender. Practicar. Reflexionar.',
    lead: 'Un espacio para aprender, conectado con tu simulación.',
  },
  theory: { kicker: 'FUNDAMENTOS', title: 'Las presiones que mides y lo que significan', lead: '' },
  questions: { kicker: 'REFLEXIÓN', title: 'Observa y explica', lead: '' },
  exam: { kicker: 'EXAMEN', title: 'Primero estima. Después compara.', lead: '' },
  results: { kicker: 'RESULTADOS', title: 'Resumen de tu práctica', lead: '' },
  library: {
    kicker: 'BIBLIOTECA',
    title: 'Casos para practicar',
    lead: 'Elegir un caso prepara paciente, ajustes iniciales y objetivos nuevos.',
  },
};
type Section = (typeof SECTIONS)[number];

export interface Classroom {
  init(): void;
  open(section?: Section): void;
  simulator(): void;
  practice(): void;
  stopPractice(): void;
  render(): void;
}

export function createClassroom(
  ctx: AppContext,
  deps: { cancelQuick(): void; loadScenario(id: string): void; estimateCount(): number },
): Classroom {
  let section: Section = 'lesson';
  let practicing = false;
  let scenarioId = ctx.scenario.id;
  let resultsSignature = '';

  function library(): void {
    const query = $<HTMLInputElement>('#aula-search').value.trim().toLocaleLowerCase();
    const cases = SCENARIOS.filter(
      (sc) => sc.id !== 'SC-P' && `${sc.name} ${sc.category ?? ''} ${sc.id}`.toLocaleLowerCase().includes(query),
    );
    const groups = new Map<string, typeof cases>();
    for (const sc of cases) {
      const key = sc.category ?? 'Práctica';
      groups.set(key, [...(groups.get(key) ?? []), sc]);
    }
    $('#aula-library-list').replaceChildren(
      ...[...groups].map(([category, items]) =>
        element(
          'section',
          'aula-group',
          element('h3', 'aula-kicker', `${category} · ${items.length}`),
          element(
            'div',
            'aula-library-list',
            ...items.map((sc) => {
              const button = element(
                'button',
                `aula-case${sc.id === ctx.scenario.id ? ' current' : ''}`,
                element('span', 'aula-kicker', `${sc.id}${sc.id === ctx.scenario.id ? ' · Caso actual' : ''}`),
                element('strong', '', sc.name),
                element('span', '', sc.description),
              );
              button.dataset.aulaCase = sc.id;
              return button;
            }),
          ),
        ),
      ),
    );
    $('#aula-library-empty').hidden = cases.length > 0;
  }

  function render(): void {
    if (scenarioId !== ctx.scenario.id) {
      scenarioId = ctx.scenario.id;
      practicing = false;
      $<HTMLTextAreaElement>('#reflection-notes').value = '';
      $<HTMLDetailsElement>('#reflection').open = false;
    }
    if (ctx.lesson.sessionImported || ctx.fixtureId) practicing = false;
    put('#aula-scenario', `${ctx.scenario.id} · ${ctx.scenario.category ?? 'Práctica guiada'}`);
    put('#classroom-session', ctx.running ? 'Simulación en marcha' : 'Simulación en pausa');
    const tasks = ctx.scenario.lesson?.tasks ?? [];
    const next = tasks.find((task) => !ctx.lesson.done.has(task.id));
    $('#practice-card').hidden = !practicing;
    $('#practice-stop').hidden = !practicing;
    put('#practice-progress', `${ctx.lesson.done.size}/${tasks.length} · ${next ? 'Práctica activa' : 'Práctica completada'}`);
    put('#practice-objective', next?.text ?? 'Objetivos completados. Revisa qué cambió en tus resultados.');
    const link = $<HTMLButtonElement>('#practice-link');
    link.textContent = next ? 'Ver lección' : 'Ver resultados';
    link.dataset.action = next ? 'classroom' : 'debrief';
    $('#practice-card').classList.toggle('complete', !next);
    for (const button of $$<HTMLButtonElement>('[data-action="practice"]'))
      button.disabled = ctx.lesson.sessionImported || !!ctx.fixtureId || !tasks.length;
    if (!$('#classroom').hidden && section === 'results') {
      const signature = JSON.stringify([scenarioId, [...ctx.lesson.done], ctx.lesson.sessionImported, deps.estimateCount()]);
      if (signature !== resultsSignature) {
        resultsSignature = signature;
        $('#aula-results-body').replaceChildren(
          ...(ctx.lesson.sessionImported
            ? [
                element(
                  'p',
                  '',
                  'Sesión importada: no está vinculada a los objetivos de este caso. Elige un caso de la biblioteca para iniciar una práctica evaluable.',
                ),
              ]
            : debriefNodes({
                scenario: ctx.scenario,
                tasks,
                done: ctx.lesson.done,
                simS: ctx.simS(),
                breathCount: ctx.frame?.breathCount ?? 0,
              })),
        );
        if (!ctx.lesson.sessionImported)
          $('#aula-results-body').append(element('p', '', `${deps.estimateCount()} mediciones estimadas en el escenario actual.`));
      }
    }
  }

  function open(next: Section = 'lesson'): void {
    deps.cancelQuick();
    ctx.dialog.close();
    const entering = $('#classroom').hidden;
    section = next;
    $('#workspace').hidden = true;
    $('#classroom').hidden = false;
    document.body.classList.add('in-classroom');
    $('#space-simulator').removeAttribute('aria-current');
    $('#space-classroom').setAttribute('aria-current', 'page');
    for (const button of $$('[data-aula-section]')) {
      if (button.dataset.aulaSection === next) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    for (const id of SECTIONS) $(`#aula-${id}`).hidden = id !== next;
    const heading = HEADINGS[next];
    put('#classroom-kicker', heading.kicker);
    put('#classroom-title', heading.title);
    put('#classroom-lead', heading.lead);
    $('#classroom-lead').hidden = !heading.lead;
    $('#classroom').classList.toggle('compact', next !== 'lesson');
    if (next === 'theory') ctx.lesson.flags.teaching = true;
    if (next === 'library') library();
    resultsSignature = '';
    render();
    ctx.updateUI();
    if (entering) $('#classroom-title').focus();
  }

  function simulator(): void {
    const leaving = !$('#classroom').hidden;
    $('#classroom').hidden = true;
    $('#workspace').hidden = false;
    document.body.classList.remove('in-classroom');
    $('#space-classroom').removeAttribute('aria-current');
    $('#space-simulator').setAttribute('aria-current', 'page');
    ctx.markDirty();
    if (leaving) $('#monitor').focus();
  }

  return {
    init() {
      const teaching = $('#view-teaching');
      teaching.classList.remove('device-view');
      $('#aula-theory-host').append(teaching);
      $('#classroom').addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest<HTMLElement>('button');
        const tab = button?.dataset.aulaSection;
        if (tab && SECTIONS.includes(tab as Section)) open(tab as Section);
        const id = button?.dataset.aulaCase;
        if (id) {
          if (id !== ctx.scenario.id) deps.loadScenario(id);
          open('lesson');
        }
      });
      $('#aula-search').addEventListener('input', library);
    },
    open,
    simulator,
    practice() {
      if (ctx.lesson.sessionImported || ctx.fixtureId || !ctx.scenario.lesson?.tasks.length) return;
      practicing = true;
      render();
      simulator();
    },
    stopPractice() {
      practicing = false;
      render();
    },
    render,
  };
}
