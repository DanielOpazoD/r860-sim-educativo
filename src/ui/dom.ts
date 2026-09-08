/** Ayudas mínimas de DOM y de plantillas HTML compartidas por la interfaz. */
/**
 * Busca un elemento que TIENE que existir. Antes era `document.querySelector(s) as T`: un selector que no encontraba
 * nada devolvía `null` disfrazado de elemento, y el fallo aparecía más tarde y más lejos —«Cannot set properties of
 * null»— sin decir qué selector fallaba. Si un elemento es realmente opcional, se busca con `querySelector` a mano y
 * se comprueba; esta ayuda es para los que forman parte del contrato de la página.
 */
export const $ = <T extends HTMLElement = HTMLElement>(s: string): T => {
  const e = document.querySelector<T>(s);
  if (!e) throw new Error(`No existe el elemento «${s}» en la página`);
  return e;
};
export const $$ = <T extends HTMLElement = HTMLElement>(s: string): T[] => [...document.querySelectorAll<T>(s)];
export const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
export const icon = (n: string): string => `<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`;
export const put = (sel: string | Element | null, v: string): void => {
  const e = typeof sel === 'string' ? $(sel) : sel;
  if (e && e.textContent !== v) e.textContent = v;
};
export const btn = (label: string, action: string, cls = 'primary-button'): string =>
  `<button class="${cls}" data-action="${action}">${label}</button>`;

const FOCUSABLE =
  'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
/** Elementos enfocables visibles dentro de un contenedor (para atrapar Tab en editores no modales). */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => !e.hidden && e.offsetParent !== null);
}
/** Mantiene Tab / Shift+Tab dentro de `root`. Devuelve true si gestionó la tecla. */
export function trapTab(e: KeyboardEvent, root: HTMLElement): boolean {
  if (e.key !== 'Tab') return false;
  const items = focusableWithin(root);
  if (!items.length) return false;
  const first = items[0] as HTMLElement,
    last = items[items.length - 1] as HTMLElement;
  const active = document.activeElement as HTMLElement | null;
  const inside = !!active && root.contains(active);
  if (!inside) {
    e.preventDefault();
    first.focus();
    return true;
  }
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
    return true;
  }
  if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
    return true;
  }
  return false;
}
