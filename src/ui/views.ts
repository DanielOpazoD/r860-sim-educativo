/** Vistas del monitor (curvas, básica, bucles, datos, tendencias, registro, resumen) y escala del monitor en la ventana. */
import type { AppContext, ViewId } from './context';
import { $, $$ } from './dom';

export const VIEWS: ViewId[] = ['waves', 'basic', 'loops', 'data', 'trends', 'log', 'teaching'];

export interface Views {
  readonly view: ViewId;
  /** Cambiar de vista nunca toca el borrador de edición: el editor sigue abierto sobre la nueva vista. */
  switchView(v: string): void;
  /** Escala el monitor de 1120 px a la anchura disponible y observa cambios de tamaño. */
  initMonitorScale(): void;
}

export function createViews(ctx: AppContext): Views {
  let view: ViewId = 'waves';
  return {
    get view() {
      return view;
    },
    switchView(v) {
      if (!(VIEWS as string[]).includes(v)) return;
      view = v as ViewId;
      for (const e of $$('[data-view-panel]')) e.classList.toggle('active', e.dataset.viewPanel === v);
      for (const b of $$('[data-view]')) {
        b.classList.toggle('chosen', b.dataset.view === v);
        b.setAttribute('aria-pressed', String(b.dataset.view === v));
      }
      ctx.lesson.flags[v] = true;
      ctx.markDirty();
      ctx.updateUI();
    },
    initMonitorScale() {
      const resize = (): void => {
        const e = $('#screen-window');
        $('#monitor').style.transform = `scale(${e.clientWidth / 1120})`;
        ctx.markDirty();
      };
      new ResizeObserver(resize).observe($('#screen-window'));
      resize();
    },
  };
}
