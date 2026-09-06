/** Diálogo modal único de la aplicación (#app-dialog). Dueño de `dialogKind`; avisa a los rasgos al abrir y cerrar. */
import type { DialogHost } from './context';
import { $, btn, put } from './dom';

export const CLOSE_BTN = btn('Cerrar', 'closeDialog', 'secondary-button');
export const CANCEL_BTN = btn('Cancelar', 'closeDialog', 'secondary-button');

export function createDialogHost(): DialogHost & { bind(): void } {
  let kind = '';
  const openListeners: (() => void)[] = [];
  const closeListeners: (() => void)[] = [];
  return {
    get kind() {
      return kind;
    },
    open(k, title, html, footer = '', size = '') {
      kind = k;
      $('#app-dialog').className = 'app-dialog ' + size;
      put('#dialog-title', title);
      put('#dialog-eyebrow', 'R860 LAB · SIMULACIÓN EDUCATIVA');
      $('#dialog-content').innerHTML = html;
      $('#dialog-footer').innerHTML = footer || CLOSE_BTN;
      const d = $<HTMLDialogElement>('#app-dialog');
      if (!d.open) d.showModal();
      for (const l of openListeners) l();
    },
    close() {
      const d = $<HTMLDialogElement>('#app-dialog');
      if (d.open) d.close();
      kind = '';
      for (const l of closeListeners) l();
    },
    onOpen(l) {
      openListeners.push(l);
    },
    onClose(l) {
      closeListeners.push(l);
    },
    bind() {
      // Cierre nativo (p. ej. gesto del sistema): sólo olvida quién lo abrió; los borradores se limpian al cerrar por acción.
      $('#app-dialog').addEventListener('cancel', () => {
        kind = '';
      });
    },
  };
}
