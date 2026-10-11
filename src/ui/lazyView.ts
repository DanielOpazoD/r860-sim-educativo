import { element } from './dom';

export interface LazyView {
  open(): Promise<void>;
  render(): void;
}

export function createLazyView(host: HTMLElement, visible: () => boolean, load: () => Promise<{ render(): void }>): LazyView {
  let view: { render(): void } | undefined;
  let pending: Promise<void> | undefined;
  let failed = false;
  const message = element('span');
  const reload = element('button', '', 'Recargar página');
  reload.type = 'button';
  const status = element('p', 'aula-load-status', message, ' ', reload);
  status.setAttribute('role', 'status');
  status.hidden = true;
  host.prepend(status);
  reload.addEventListener('click', () => location.reload());

  function render(): void {
    if (visible()) view?.render();
  }

  function open(): Promise<void> {
    if (view) {
      render();
      return Promise.resolve();
    }
    if (pending) return pending;
    if (failed) return Promise.resolve();
    status.hidden = false;
    reload.hidden = true;
    message.textContent = 'Cargando…';
    pending = load()
      .then((loaded) => {
        view = loaded;
        status.hidden = true;
        render();
      })
      .catch(() => {
        failed = true;
        message.textContent = 'No se pudo cargar esta sección. Recargar reiniciará la simulación.';
        reload.hidden = false;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  }

  return { open, render };
}
