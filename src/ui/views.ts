/** Vistas del monitor (curvas, básica, bucles, datos, tendencias, registro, resumen) y escala del monitor en la ventana. */
import type { AppContext, ViewId } from './context';
import { $, $$ } from './dom';
import { isMobile } from './labels';

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
        const e = $('#screen-window'),
          m = $('#monitor');
        // El monitor mide 1120 px lógicos en escritorio; en teléfono es vertical y más estrecho (styles/07-movil-vertical.css),
        // así que la escala sale de su anchura real y no de un literal.
        const k = e.clientWidth / (m.offsetWidth || 1120);
        m.style.transform = `scale(${k})`;
        // Con el monitor vertical su alto depende del contenido: la ventana mide lo que mide el monitor escalado.
        // Se mide el rectángulo ya escalado (fraccionario): offsetHeight × k redondea y dejaba 1 px del monitor fuera.
        // La ventana lleva borde y su alto (border-box) tiene que sumarlo para que el monitor no lo pise.
        e.style.height = isMobile() ? `${m.getBoundingClientRect().height + (e.offsetHeight - e.clientHeight)}px` : '';
        ctx.markDirty();
      };
      const ro = new ResizeObserver(resize);
      ro.observe($('#screen-window'));
      ro.observe($('#monitor'));
      resize();
    },
  };
}
