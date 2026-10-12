/**
 * Casos clínicos en la misma pantalla del ventilador. El panel lateral elige el caso y dice qué lograr; bajo el equipo,
 * con scroll, está el espacio educativo: el desarrollo del caso (al entregar), los Fundamentos y la reflexión.
 */
import { SCENARIOS } from '../scenarios';
import { evaluateCase, type CaseResult } from './caseEvaluation';
import { loadCaseProgress, saveCaseProgress } from './caseProgress';
import { caseBriefNodes, caseDevelopmentNodes, caseListNodes } from './caseView';
import type { AppContext } from './context';
import { $ } from './dom';
import { createGasView } from './gasView';
import { createLazyView } from './lazyView';

export type LearnBlock = 'case' | 'theory' | 'reflection';

export interface CaseSpace {
  init(): void;
  render(): void;
  /** El panel muestra la lista de casos. */
  list(): void;
  /** El panel muestra el caso actual (si es un caso clínico). */
  brief(): void;
  /** Evalúa el caso con el cuadro de ahora y revela su desarrollo. */
  submitCase(): void;
  /** Desplaza la página al bloque del espacio educativo, cargando los Fundamentos si hace falta. */
  scrollTo(block: LearnBlock): void;
}

export function createCaseSpace(
  ctx: AppContext,
  deps: { loadScenario(id: string): void; switchTab(tab: 'patient' | 'case'): void },
): CaseSpace {
  const cases = SCENARIOS.filter((sc) => sc.clinical);
  let scenarioId = '';
  let listing = !ctx.scenario.clinical;
  let paneSignature = '';
  const gas = createGasView(ctx);
  // El espacio educativo vive bajo el equipo: sus Fundamentos se cargan y se pintan sólo cuando se acercan a la vista.
  let learnInView = typeof IntersectionObserver === 'undefined';
  const theory = createLazyView(
    $('#aula-theory-host'),
    () => learnInView,
    async () => (await import('./teachingView')).createTeachingView(ctx),
  );

  const caseAnswer = (): string | null => (ctx.lesson.flags.caseAnswer as string | undefined) ?? null;
  const caseResult = (): CaseResult | null => (ctx.lesson.flags.caseResult as CaseResult | undefined) ?? null;

  function render(): void {
    theory.render();
    if (scenarioId !== ctx.scenario.id) {
      scenarioId = ctx.scenario.id;
      listing = !ctx.scenario.clinical;
      // Un caso abre en su pestaña; sin caso, el panel vuelve a Paciente.
      deps.switchTab(ctx.scenario.clinical ? 'case' : 'patient');
      $<HTMLTextAreaElement>('#reflection-notes').value = '';
      $<HTMLDetailsElement>('#reflection').open = false;
    }
    const clinical = ctx.scenario.clinical;
    const answer = caseAnswer();
    const result = caseResult();
    // El panel Paciente queda siempre a mano; durante un caso sin entregar, una línea recuerda que cambiarlo altera el caso.
    $('#case-lock-note').hidden = !clinical || !!result;
    gas.render();
    const firma = JSON.stringify([ctx.scenario.id, listing, answer, result?.atSimMs ?? null, ctx.lesson.sessionImported]);
    if (firma === paneSignature) return;
    paneSignature = firma;
    $('#instructor-case').replaceChildren(
      ...(listing || !clinical
        ? caseListNodes(cases, ctx.scenario.id, loadCaseProgress())
        : caseBriefNodes(ctx.scenario, answer, result, ctx.lesson.sessionImported)),
    );
    $('#learn-case').hidden = !clinical;
    if (clinical) $('#learn-case-body').replaceChildren(...caseDevelopmentNodes(ctx.scenario, ctx.frame, result));
  }

  function show(nextListing: boolean): void {
    listing = nextListing || !ctx.scenario.clinical;
    render();
  }

  function scrollTo(block: LearnBlock): void {
    if (block === 'theory') {
      ctx.lesson.flags.teaching = true;
      learnInView = true;
      void theory.open();
    }
    const target = $(`#learn-${block}`);
    const quieto = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView?.({ behavior: quieto ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  }

  return {
    init() {
      const teaching = $('#view-teaching');
      teaching.classList.remove('device-view');
      $('#aula-theory-host').append(teaching);
      for (const id of ['learn-case', 'learn-theory', 'learn-reflection']) $(`#${id}`).tabIndex = -1;
      if (typeof IntersectionObserver !== 'undefined')
        new IntersectionObserver((entries) => {
          learnInView = entries.some((e) => e.isIntersecting);
          if (learnInView) {
            ctx.lesson.flags.teaching = true;
            void theory.open();
          }
        }).observe($('#learn-theory'));
      $('#instructor-case').addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
        if (!button || button.disabled) return;
        const option = button.dataset.caseOption;
        if (option && ctx.scenario.clinical && !caseResult()) {
          ctx.lesson.flags.caseAnswer = option;
          render();
        }
        const id = button.dataset.caseId;
        if (!id) return;
        // Volver al caso en curso no lo reinicia; elegir otro carga su paciente y su programación.
        if (id === ctx.scenario.id) show(false);
        else deps.loadScenario(id);
      });
      render();
    },
    render,
    list: () => show(true),
    brief: () => show(false),
    submitCase() {
      const spec = ctx.scenario.clinical;
      if (!spec || caseResult()) return;
      const contexto = ctx.lesson.context();
      if (!contexto) return;
      const answer = caseAnswer();
      if (spec.kind === 'diagnostico' && !answer) {
        ctx.toast('Elige una respuesta antes de entregar.');
        show(false);
        return;
      }
      const result = evaluateCase(spec, contexto, answer);
      ctx.lesson.flags.caseResult = result;
      saveCaseProgress(ctx.scenario.id, result.passed);
      ctx.toast(result.passed ? 'Caso resuelto.' : 'Caso entregado: revisa el desarrollo.');
      show(false);
    },
    scrollTo,
  };
}
