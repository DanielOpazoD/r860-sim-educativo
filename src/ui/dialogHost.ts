/** Diálogo modal único de la aplicación (#app-dialog). Dueño de `dialogKind`; avisa a los rasgos al abrir y cerrar. */
import type { DialogHost } from './context';
import { $, btn, put } from './dom';

export const CLOSE_BTN = btn('Cerrar', 'closeDialog', 'secondary-button');
export const CANCEL_BTN = btn('Cancelar', 'closeDialog', 'secondary-button');

const DEVICE_DIALOGS = new Set(['modes', 'alarmSetup', 'alarms', 'oxygen', 'standby', 'menu', 'tools', 'mechanics', 'patient']);

export function createDialogHost(): DialogHost & { bind(): void } {
  let kind = '';
  const openListeners: (() => void)[] = [];
  const closeListeners: (() => void)[] = [];
  const positionDeviceDialog = (): void => {
    if (!DEVICE_DIALOGS.has(kind)) return;
    const surface = $('.monitor-body');
    let rect = surface.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = (viewport?.offsetTop ?? 0) + 8;
    const viewportBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 8;
    if (rect.top > viewportBottom - 160 || rect.bottom < viewportTop + 160) {
      surface.scrollIntoView({ block: 'center', behavior: 'instant' });
      rect = surface.getBoundingClientRect();
    }
    const top = Math.max(rect.top, viewportTop);
    const bottom = Math.min(rect.bottom, viewportBottom);
    const dialog = $('#app-dialog');
    const next = { left: rect.left, top, width: rect.width, height: Math.max(0, bottom - top) };
    for (const [property, value] of Object.entries(next)) {
      const px = `${value}px`;
      if (dialog.style.getPropertyValue(property) !== px) dialog.style.setProperty(property, px);
    }
  };
  // Los eventos de resize/scroll no cubren los desplazamientos de maquetación (cabecera que envuelve, monitor
  // reescalado): mientras un diálogo del equipo está abierto se sigue el monitor fotograma a fotograma.
  let tracking = 0;
  const track = (): void => {
    positionDeviceDialog();
    tracking = DEVICE_DIALOGS.has(kind) ? requestAnimationFrame(track) : 0;
  };
  return {
    get kind() {
      return kind;
    },
    open(k, title, html, footer = '', size = '') {
      const device = DEVICE_DIALOGS.has(k);
      const enteringDevice = device && !DEVICE_DIALOGS.has(kind);
      kind = k;
      const d = $<HTMLDialogElement>('#app-dialog');
      d.className = 'app-dialog ' + (device ? 'device-dialog' : size);
      for (const property of ['left', 'top', 'width', 'height']) d.style.removeProperty(property);
      put('#dialog-title', title);
      $('#dialog-content').innerHTML = html;
      $('#dialog-content').scrollTop = 0;
      $('#dialog-footer').innerHTML = footer === null ? '' : footer || CLOSE_BTN;
      if (enteringDevice) $('.monitor-body').scrollIntoView({ block: 'center', behavior: 'instant' });
      positionDeviceDialog();
      if (device && !tracking) tracking = requestAnimationFrame(track);
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
      new ResizeObserver(positionDeviceDialog).observe($('.monitor-body'));
      window.addEventListener('resize', positionDeviceDialog);
      window.addEventListener('scroll', positionDeviceDialog);
      window.visualViewport?.addEventListener('resize', positionDeviceDialog);
      window.visualViewport?.addEventListener('scroll', positionDeviceDialog);
      // El cierre nativo (p. ej. Escape) debe dejar los mismos rasgos que un cierre por acción.
      $('#app-dialog').addEventListener('cancel', () => {
        kind = '';
        for (const l of closeListeners) l();
      });
    },
  };
}
