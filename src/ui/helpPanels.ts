/** Paneles de ayuda contextual (botón «i» + panel plegable) sobre el catálogo estático de HELP. */
import { $$, esc, icon } from './dom';
import { HELP, type HelpEntry } from './help';

export const helpEntry = (key: string): HelpEntry | null => HELP[key] ?? null;
export function helpContent(key: string): string {
  const h = helpEntry(key);
  if (!h) return '';
  return `<h3>${esc(h.title)}</h3>${h.text.map((t) => `<p>${esc(t)}</p>`).join('')}${h.equation ? `<div class="help-equation">${esc(h.equation)}</div>` : ''}`;
}
export function infoButton(key: string, id: string): string {
  const h = helpEntry(key);
  return `<button type="button" class="info-button" data-help-key="${esc(key)}" data-help-target="${esc(id)}" aria-controls="${esc(id)}" aria-expanded="false" aria-label="Información sobre ${esc(h?.title ?? key)}" title="Información">${icon('info')}</button>`;
}
export const infoPanel = (key: string, id: string): string =>
  `<div id="${esc(id)}" class="parameter-help" hidden>${helpContent(key)}</div>`;
/** Pliega todos los paneles abiertos; devuelve true si había alguno. */
export function collapseHelp(): boolean {
  let any = false;
  for (const b of $$('[data-help-target][aria-expanded="true"]')) {
    const panel = document.getElementById(b.dataset.helpTarget as string);
    if (panel) panel.hidden = true;
    b.setAttribute('aria-expanded', 'false');
    any = true;
  }
  return any;
}
export function toggleHelp(button: HTMLElement): void {
  const panel = document.getElementById(button.dataset.helpTarget as string);
  if (!panel) return;
  const show = panel.hidden;
  collapseHelp();
  panel.hidden = !show;
  button.setAttribute('aria-expanded', String(show));
}
/** Rellena los paneles declarados en el HTML estático que aún no tienen contenido. */
export function fillStaticHelp(): void {
  for (const b of $$('[data-help-key]')) {
    const panel = document.getElementById(b.dataset.helpTarget as string);
    if (panel && !panel.innerHTML.trim()) panel.innerHTML = helpContent(b.dataset.helpKey as string);
  }
}
