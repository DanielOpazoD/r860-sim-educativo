import { SCENARIOS, type Scenario } from '../scenarios';
import { loadCaseProgress } from './caseProgress';
import type { AppContext } from './context';
import { $, element } from './dom';

/** Tarjeta de un caso o práctica: código, título y una línea (descripción o referencias). */
function tarjeta(ctx: AppContext, sc: Scenario, linea: string, estado?: string): HTMLButtonElement {
  const actual = sc.id === ctx.scenario.id;
  const kicker = [sc.clinical ? `${sc.id} · ${sc.clinical.theme}` : sc.id, actual ? 'Caso actual' : '', estado ?? '']
    .filter(Boolean)
    .join(' · ');
  const button = element(
    'button',
    `aula-case${actual ? ' current' : ''}${estado === 'Resuelto' ? ' solved' : ''}`,
    element('span', 'aula-kicker', kicker),
    element('strong', '', sc.name),
    element('span', '', linea),
  );
  button.dataset.aulaCase = sc.id;
  return button;
}

export function createLibraryView(ctx: AppContext): { render(): void } {
  return {
    render() {
      const query = $<HTMLInputElement>('#aula-search').value.trim().toLocaleLowerCase();
      const coincide = (sc: Scenario): boolean =>
        `${sc.name} ${sc.category ?? ''} ${sc.id} ${sc.clinical?.theme ?? ''}`.toLocaleLowerCase().includes(query);
      const clinicos = SCENARIOS.filter((sc) => sc.clinical && coincide(sc));
      const guiadas = SCENARIOS.filter((sc) => !sc.clinical && sc.id !== 'SC-P' && coincide(sc));
      const progreso = loadCaseProgress();
      const groups = new Map<string, Scenario[]>();
      for (const sc of guiadas) {
        const key = sc.category ?? 'Práctica';
        groups.set(key, [...(groups.get(key) ?? []), sc]);
      }
      const secciones: HTMLElement[] = [];
      if (clinicos.length)
        secciones.push(
          element(
            'section',
            'aula-clinical',
            element('h2', 'aula-section-title', 'Casos clínicos'),
            element(
              'div',
              'aula-clinical-grid',
              ...clinicos.map((sc) =>
                tarjeta(
                  ctx,
                  sc,
                  sc.clinical!.references.map((r) => r.short).join(' · '),
                  progreso[sc.id] === 'resuelto' ? 'Resuelto' : progreso[sc.id] === 'intentado' ? 'Intentado' : undefined,
                ),
              ),
            ),
          ),
        );
      if (guiadas.length)
        secciones.push(
          element('h2', 'aula-section-title', 'Prácticas guiadas'),
          element(
            'div',
            'aula-library',
            ...[...groups].map(([category, items]) =>
              element(
                'section',
                'aula-group',
                element('h3', 'aula-kicker', `${category} · ${items.length}`),
                element('div', 'aula-library-list', ...items.map((sc) => tarjeta(ctx, sc, sc.description))),
              ),
            ),
          ),
        );
      $('#aula-library-list').replaceChildren(...secciones);
      $('#aula-library-empty').hidden = clinicos.length + guiadas.length > 0;
    },
  };
}
