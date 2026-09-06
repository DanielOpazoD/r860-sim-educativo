import { h, setClass } from './dom';

/** Bisel con teclas físicas (D QRG 2020 p.4: pausa de audio 2 min, ↑O2, captura, bloqueo, inicio, mando) y mando giratorio. */
export class Bezel {
  root: HTMLElement;
  knob: HTMLElement;
  private lockBtn: HTMLButtonElement;
  private dragAngle: number | null = null;
  private acc = 0;
  constructor(private readonly cb: { audioPause: () => void; increaseO2: () => void; snapshot: () => void; lock: () => void; home: () => void; turn: (d: 1 | -1) => void; press: () => void }) {
    this.lockBtn = h('button', { class: 'hk', type: 'button', 'aria-label': 'Bloquear/desbloquear pantalla', 'aria-pressed': 'false', onclick: () => cb.lock() }, h('span', { class: 'ico', text: '🔒' }), 'Bloqueo');
    this.knob = h('div', { class: 'knob', role: 'slider', tabindex: '0', 'aria-label': 'Mando giratorio: flechas ajustan, Enter confirma, Escape cancela', 'aria-valuenow': '0', onkeydown: (e: KeyboardEvent) => this.onKey(e), onwheel: (e: WheelEvent) => this.onWheel(e), onpointerdown: (e: PointerEvent) => this.onDown(e), onpointermove: (e: PointerEvent) => this.onMove(e), onpointerup: (e: PointerEvent) => this.onUp(e), onclick: () => { if (!this.dragged) cb.press(); this.dragged = false; } }, 'mando');
    this.root = h('div', { class: 'bezel' },
      h('button', { class: 'hk', type: 'button', 'aria-label': 'Pausa de audio 2 minutos', onclick: () => cb.audioPause() }, h('span', { class: 'ico', text: '🔔' }), 'Pausa audio', '2 min'),
      h('button', { class: 'hk', type: 'button', 'aria-label': 'Aumentar O2', onclick: () => cb.increaseO2() }, h('span', { class: 'ico', text: 'O₂' }), '↑O2'),
      h('button', { class: 'hk', type: 'button', 'aria-label': 'Captura (no implementada)', onclick: () => cb.snapshot() }, h('span', { class: 'ico', text: '📷' }), 'Captura'),
      this.lockBtn,
      h('button', { class: 'hk', type: 'button', 'aria-label': 'Inicio', onclick: () => cb.home() }, h('span', { class: 'ico', text: '⌂' }), 'Inicio'),
      this.knob,
      h('div', { class: 'brand', text: 'simulación educativa · sin marca del fabricante' }),
    );
  }
  private dragged = false;
  private onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); this.cb.turn(1); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); this.cb.turn(-1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.cb.press(); }
  }
  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.acc += e.deltaY;
    while (this.acc <= -40) { this.acc += 40; this.cb.turn(1); }
    while (this.acc >= 40) { this.acc -= 40; this.cb.turn(-1); }
  }
  private angle(e: PointerEvent): number {
    const r = this.knob.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  }
  private onDown(e: PointerEvent): void { this.knob.setPointerCapture(e.pointerId); this.dragAngle = this.angle(e); }
  private onMove(e: PointerEvent): void {
    if (this.dragAngle === null) return;
    const a = this.angle(e);
    let d = a - this.dragAngle;
    if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    const stepRad = Math.PI / 8;
    if (Math.abs(d) >= stepRad) { this.dragged = true; this.cb.turn(d > 0 ? 1 : -1); this.dragAngle = a; }
  }
  private onUp(e: PointerEvent): void { this.knob.releasePointerCapture(e.pointerId); this.dragAngle = null; }
  setArmed(on: boolean): void { setClass(this.knob, 'armed', on); }
  setLocked(on: boolean): void { this.lockBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
}
