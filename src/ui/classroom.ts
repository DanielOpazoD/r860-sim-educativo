import { evaluateCase, type CaseResult } from './caseEvaluation';
import { saveCaseProgress } from './caseProgress';
import { caseNodes } from './caseView';
import type { AppContext } from './context';
import { debriefNodes } from './dialogs';
import { $, $$, element, put } from './dom';
import { createLazyView } from './lazyView';

const SECTIONS = ['theory', 'questions', 'library', 'lesson', 'exam', 'results'] as const;
/** Dos espacios con un mismo contenedor: el Aula para comprender, Casos para practicar y evaluarse. */
const SPACE: Record<Section, 'aula' | 'casos'> = {
  theory: 'aula',
  questions: 'aula',
  library: 'casos',
  lesson: 'casos',
  exam: 'casos',
  results: 'casos',
};
const HEADINGS: Record<Section, { kicker: string; title: string; lead: string }> = {
  theory: { kicker: 'AULA · FUNDAMENTOS', title: 'Las presiones que mides y lo que significan', lead: '' },
  questions: { kicker: 'AULA · REFLEXIÓN', title: 'Observa y explica', lead: '' },
  library: { kicker: 'CASOS', title: 'Elige un caso', lead: 'Cada caso prepara el paciente, los ajustes iniciales y sus objetivos.' },
  lesson: { kicker: 'CASOS · CASO ACTUAL', title: 'Objetivos del caso', lead: '' },
  exam: { kicker: 'CASOS · EXAMEN', title: 'Primero estima. Después compara.', lead: '' },
  results: { kicker: 'CASOS · RESULTADOS', title: 'Resumen de tu práctica', lead: '' },
};
type Section = (typeof SECTIONS)[number];

export interface Classroom {
  init(): void;
  open(section: Section): void;
  simulator(): void;
  practice(): void;
  stopPractice(): void;
  /** Evalúa el caso clínico actual con el cuadro de ahora y revela la respuesta. */
  submitCase(): void;
  render(): void;
}

export function createClassroom(
  ctx: AppContext,
  deps: { cancelQuick(): void; loadScenario(id: string): void; estimateCount(): number },
): Classroom {
  let section: Section = 'theory';
  let practicing = false;
  let scenarioId = ctx.scenario.id;
  let resultsSignature = '';
  let caseSignature = '';
  const theory = createLazyView(
    $('#aula-theory'),
    () => !$('#classroom').hidden && section === 'theory',
    async () => (await import('./teachingView')).createTeachingView(ctx),
  );
  const library = createLazyView(
    $('#aula-library'),
    () => !$('#classroom').hidden && section === 'library',
    async () => (await import('./libraryView')).createLibraryView(ctx),
  );

  function render(): void {
    theory.render();
    if (scenarioId !== ctx.scenario.id) {
      scenarioId = ctx.scenario.id;
      practicing = false;
      $<HTMLTextAreaElement>('#reflection-notes').value = '';
      $<HTMLDetailsElement>('#reflection').open = false;
    }
    if (ctx.lesson.sessionImported || ctx.fixtureId) practicing = false;
    put('#aula-scenario', `${ctx.scenario.id} · ${ctx.scenario.category ?? 'Práctica guiada'}`);
    put('#classroom-session', ctx.running ? 'Simulación en marcha' : 'Simulación en pausa');
    const clinical = ctx.scenario.clinical;
    const caseResult = (ctx.lesson.flags.caseResult as CaseResult | undefined) ?? null;
    const caseAnswer = (ctx.lesson.flags.caseAnswer as string | undefined) ?? null;
    const tasks = ctx.scenario.lesson?.tasks ?? [];
    const next = tasks.find((task) => !ctx.lesson.done.has(task.id));
    $('#practice-card').hidden = !practicing;
    $('#practice-stop').hidden = !practicing;
    const link = $<HTMLButtonElement>('#practice-link');
    if (clinical) {
      // El caso clínico acompaña al ventilador con su pregunta y se entrega desde aquí o desde Caso actual.
      put('#practice-progress', `${ctx.scenario.id} · ${caseResult ? 'Caso entregado' : 'Caso clínico'}`);
      put('#practice-objective', clinical.question);
      link.textContent = 'Ver caso';
      link.dataset.action = 'caseObjectives';
      $('#practice-submit').hidden = !!caseResult;
      $('#practice-card').classList.toggle('complete', !!caseResult);
    } else {
      put('#practice-progress', `${ctx.lesson.done.size}/${tasks.length} · ${next ? 'Práctica activa' : 'Práctica completada'}`);
      put('#practice-objective', next?.text ?? 'Objetivos completados. Revisa qué cambió en tus resultados.');
      link.textContent = next ? 'Ver objetivos' : 'Ver resultados';
      link.dataset.action = next ? 'caseObjectives' : 'debrief';
      $('#practice-submit').hidden = true;
      $('#practice-card').classList.toggle('complete', !next);
    }
    // Mientras el caso no se entrega, la mecánica del paciente y sus eventos no se muestran: es lo que se diagnostica.
    const oculto = !!clinical && !caseResult;
    $('#instructor').classList.toggle('case-locked', oculto);
    $('#case-lock-note').hidden = !oculto;
    $('#aula-case').hidden = !clinical;
    $('#aula-guided').hidden = !!clinical;
    if (clinical && !$('#classroom').hidden && section === 'lesson') {
      const firma = JSON.stringify([ctx.scenario.id, caseAnswer, caseResult?.atSimMs ?? null]);
      if (firma !== caseSignature) {
        caseSignature = firma;
        $('#aula-case').replaceChildren(...caseNodes(ctx.scenario, ctx.frame, caseAnswer, caseResult));
      }
    }
    for (const button of $$<HTMLButtonElement>('[data-action="practice"]'))
      button.disabled = ctx.lesson.sessionImported || !!ctx.fixtureId || (!tasks.length && !clinical);
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

  function open(next: Section): void {
    deps.cancelQuick();
    ctx.dialog.close();
    const entering = $('#classroom').hidden;
    section = next;
    $('#workspace').hidden = true;
    $('#classroom').hidden = false;
    document.body.classList.add('in-classroom');
    const space = SPACE[next];
    $('#space-simulator').removeAttribute('aria-current');
    $(space === 'aula' ? '#space-cases' : '#space-classroom').removeAttribute('aria-current');
    $(space === 'aula' ? '#space-classroom' : '#space-cases').setAttribute('aria-current', 'page');
    $('#aula-nav').setAttribute('aria-label', space === 'aula' ? 'Secciones del Aula' : 'Secciones de Casos');
    // Cada espacio muestra sólo sus secciones: el Aula no ofrece evaluarse y Casos no repite la teoría.
    for (const button of $$('[data-aula-section]')) {
      button.hidden = button.dataset.space !== space;
      if (button.dataset.aulaSection === next) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    for (const id of SECTIONS) $(`#aula-${id}`).hidden = id !== next;
    const heading = HEADINGS[next];
    put('#classroom-kicker', heading.kicker);
    put('#classroom-title', next === 'lesson' && ctx.scenario.clinical ? 'Caso clínico' : heading.title);
    put('#classroom-lead', heading.lead);
    $('#classroom-lead').hidden = !heading.lead;
    $('#classroom').classList.toggle('compact', next !== 'lesson' && next !== 'library');
    if (next === 'theory') ctx.lesson.flags.teaching = true;
    if (next === 'theory') void theory.open();
    if (next === 'library') void library.open();
    resultsSignature = '';
    caseSignature = '';
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
    $('#space-cases').removeAttribute('aria-current');
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
        const option = button?.dataset.caseOption;
        if (option && ctx.scenario.clinical && !ctx.lesson.flags.caseResult) {
          ctx.lesson.flags.caseAnswer = option;
          render();
        }
        const id = button?.dataset.aulaCase;
        if (id) {
          if (id !== ctx.scenario.id) deps.loadScenario(id);
          open('lesson');
        }
      });
      $('#aula-search').addEventListener('input', () => library.render());
    },
    open,
    simulator,
    practice() {
      if (ctx.lesson.sessionImported || ctx.fixtureId || (!ctx.scenario.lesson?.tasks.length && !ctx.scenario.clinical)) return;
      practicing = true;
      render();
      simulator();
    },
    stopPractice() {
      practicing = false;
      render();
    },
    submitCase() {
      const spec = ctx.scenario.clinical;
      if (!spec || ctx.lesson.flags.caseResult) return;
      const contexto = ctx.lesson.context();
      if (!contexto) return;
      const answer = (ctx.lesson.flags.caseAnswer as string | undefined) ?? null;
      if (spec.kind === 'diagnostico' && !answer) {
        ctx.toast('Elige una respuesta antes de entregar.');
        open('lesson');
        return;
      }
      const result = evaluateCase(spec, contexto, answer);
      ctx.lesson.flags.caseResult = result;
      saveCaseProgress(ctx.scenario.id, result.passed);
      practicing = false;
      ctx.toast(result.passed ? 'Caso resuelto.' : 'Caso entregado: revisa la explicación.');
      open('lesson');
    },
    render,
  };
}
