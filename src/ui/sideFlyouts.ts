/**
 * Paneles desplegables laterales del panel Paciente: «Mecánica avanzada» y «Datos del modelo» salen del borde de la
 * barra lateral, encima del área del equipo, en vez de alargar la barra hacia abajo. Uno a la vez; se cierran con ✕,
 * con Esc o al ocultar la barra o cambiar de pestaña. No se cierran al tocar el equipo: se puede ajustar el ventilador
 * mirando los datos del modelo. En móvil ocupan la pantalla, sobre la hoja del panel.
 */
import type { AppContext } from './context';
import { $, $$ } from './dom';
import { isMobile } from './labels';

export type FlyoutId = 'advanced' | 'model';

export interface SideFlyouts {
  init(): void;
  readonly openId: FlyoutId | null;
  toggle(id: FlyoutId): void;
  close(): void;
  /** Elige el grupo visible de «Mecánica avanzada». */
  showGroup(id: string): void;
}

const GAP_PX = 8;

export function createSideFlyouts(ctx: AppContext): SideFlyouts {
  let openId: FlyoutId | null = null;
  let group = '';
  let pending = 0;

  const panel = (id: FlyoutId): HTMLElement => $(`#flyout-${id}`);
  const launcher = (id: FlyoutId): HTMLElement => $(`[data-flyout="${id}"]`);

  /** Junto al borde derecho de la barra; la barra es fija al desplazar, así que se sigue su caja. */
  function position(): void {
    pending = 0;
    if (!openId) return;
    const el = panel(openId);
    el.classList.toggle('mobile', isMobile());
    if (isMobile()) {
      el.style.removeProperty('left');
      el.style.removeProperty('top');
      el.style.removeProperty('height');
      return;
    }
    // Arranca a la altura de la barra y usa todo el alto disponible: su contenido no depende de lo larga que sea la barra.
    const caja = $('#instructor').getBoundingClientRect();
    const top = Math.max(caja.top, GAP_PX);
    el.style.left = `${Math.round(caja.right + GAP_PX)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.height = `${Math.round(innerHeight - top - GAP_PX)}px`;
  }
  const schedule = (): void => {
    if (openId && !pending) pending = requestAnimationFrame(position);
  };

  function close(): void {
    if (!openId) return;
    const id = openId;
    openId = null;
    panel(id).hidden = true;
    launcher(id).setAttribute('aria-expanded', 'false');
    launcher(id).classList.remove('active');
    if (panel(id).contains(document.activeElement)) launcher(id).focus();
  }

  function open(id: FlyoutId): void {
    if (openId) close();
    openId = id;
    panel(id).hidden = false;
    launcher(id).setAttribute('aria-expanded', 'true');
    launcher(id).classList.add('active');
    if (id === 'model') ctx.lesson.flags.truthOpen = true;
    // El esfuerzo muscular y su bucle sólo se dibujan si el panel está a la vista: con la simulación en pausa no llega
    // ningún cuadro nuevo que los pinte, y se abrían vacíos hasta reanudar.
    ctx.markDirty();
    position();
    $<HTMLElement>(`#flyout-${id}-title`).focus({ preventScroll: true });
  }

  function showGroup(id: string): void {
    group = id;
    for (const tab of $$<HTMLButtonElement>('#advanced-tabs [data-group]')) {
      const on = tab.dataset.group === id;
      tab.classList.toggle('chosen', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    for (const section of $$('#patient-extra-controls [data-group]')) section.hidden = section.dataset.group !== id;
  }

  return {
    init() {
      for (const id of ['advanced', 'model'] as const) {
        launcher(id).addEventListener('click', () => (openId === id ? close() : open(id)));
        panel(id).addEventListener('keydown', (event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          close();
        });
      }
      for (const button of $$('[data-flyout-close]')) button.addEventListener('click', close);
      $('#advanced-tabs').addEventListener('click', (event) => {
        const tab = (event.target as HTMLElement).closest<HTMLElement>('[data-group]');
        if (tab?.dataset.group) showGroup(tab.dataset.group);
      });
      const first = $$<HTMLElement>('#advanced-tabs [data-group]')[0];
      if (first?.dataset.group) showGroup(group || first.dataset.group);
      addEventListener('resize', schedule);
      addEventListener('scroll', schedule, { passive: true });
    },
    get openId() {
      return openId;
    },
    toggle: (id) => (openId === id ? close() : open(id)),
    close,
    showGroup,
  };
}
