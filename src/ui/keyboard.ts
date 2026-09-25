/** Teclado: Escape de fuera hacia dentro (diálogo → ayuda → editor), Tab atrapado en el editor, flechas en rejillas, atajos. */
import type { AppContext } from './context';
import { $, trapTab } from './dom';
import { collapseHelp } from './helpPanels';
import type { QuickEditor } from './quickEditor';

/** Flechas dentro de una rejilla de casillas con tabindex itinerante (numéricas y datos grandes). */
export function roveGrid(e: KeyboardEvent, t: HTMLElement): boolean {
  const grid = t.closest<HTMLElement>('#numeric-grid,#big-metrics');
  if (!grid || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return false;
  // Sólo las casillas visibles navegan: en densidad de seis el resto está oculto con display:none.
  const tiles = [...grid.querySelectorAll<HTMLElement>('[data-metric]')].filter((x) => x.offsetParent !== null);
  const i = tiles.indexOf(t);
  if (i < 0) return false;
  const cols = grid.classList.contains('six') ? 1 : 2;
  const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols };
  let j = e.key === 'Home' ? 0 : e.key === 'End' ? tiles.length - 1 : i + (step[e.key] ?? 0);
  j = Math.max(0, Math.min(tiles.length - 1, j));
  for (const x of tiles) x.tabIndex = -1;
  const target = tiles[j] as HTMLElement;
  target.tabIndex = 0;
  target.focus();
  e.preventDefault();
  return true;
}

const SHORTCUTS: Record<string, string> = { ' ': 'pause', c: 'freeze', f: 'snapshot', a: 'alarms', h: 'home', '?': 'help' };

export function bindKeyboard(ctx: AppContext, deps: { quick: QuickEditor; action: (a: string) => Promise<void> }): void {
  const { quick } = deps;
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && $<HTMLDialogElement>('#app-dialog').open) {
      e.preventDefault();
      ctx.dialog.close();
      return;
    } // lo más externo primero
    if (e.key === 'Escape' && collapseHelp()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const t = e.target as HTMLElement;
    const editing = quick.edit.state.kind !== 'idle';
    // El editor rápido atrapa Tab mientras está abierto (como el diálogo modal).
    if (editing && !$('#quick-editor').hidden && trapTab(e, $('#quick-editor'))) return;
    if (editing && (!t.closest('button') || e.key === 'Escape') && ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'ArrowUp') quick.stepQuick(1);
      if (e.key === 'ArrowDown') quick.stepQuick(-1);
      if (e.key === 'Enter') quick.confirmQuick();
      if (e.key === 'Escape') quick.cancelQuick();
      return;
    }
    if (t.dataset.metric && roveGrid(e, t)) return;
    if (t.closest('input,select,textarea,button,summary,a') || $<HTMLDialogElement>('#app-dialog').open) return;
    const key = e.key.toLowerCase();
    if (SHORTCUTS[key]) {
      e.preventDefault();
      void deps.action(SHORTCUTS[key] as string);
    }
  });
}
