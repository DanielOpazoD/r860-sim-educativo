export type Child = Node | string | null | undefined | false;

/** Crea elementos HTML reales (etiquetas y controles en HTML, no imágenes). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v as Record<string, string>);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v as Record<string, string>);
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}
export function setClass(el: Element, cls: string, on: boolean): void {
  if (on !== el.classList.contains(cls)) el.classList.toggle(cls, on);
}
