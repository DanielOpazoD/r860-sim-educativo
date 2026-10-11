import { SCENARIOS } from '../scenarios';
import type { AppContext } from './context';
import { $, element } from './dom';

export function createLibraryView(ctx: AppContext): { render(): void } {
  return {
    render() {
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
    },
  };
}
