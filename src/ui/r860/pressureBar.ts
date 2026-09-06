import type { EngineFrame } from '../../engine/simulator';
import { h, setText } from './dom';
import { fmtSample } from './format';

/** Barra de presión (O · P1/P3): Pmáx rojo, Ppico blanco, PEEP y llenado con la Paw viva. Escala 0–60 cmH2O (P). */
export class PressureBar {
  root: HTMLElement;
  private fill: HTMLElement;
  private mPmax: HTMLElement;
  private mPpeak: HTMLElement;
  private mPeep: HTMLElement;
  private vte: HTMLElement;
  private fio2: HTMLElement;
  readonly min = 0;
  readonly max = 60;
  constructor() {
    this.fill = h('div', { class: 'fill' });
    this.mPmax = h('div', { class: 'mark pmax' }, h('span', { class: 'lbl', text: 'Pmáx' }));
    this.mPpeak = h('div', { class: 'mark ppeak' }, h('span', { class: 'lbl', text: 'Ppico' }));
    this.mPeep = h('div', { class: 'mark peep' }, h('span', { class: 'lbl', text: 'PEEP' }));
    const ticks = [0, 20, 40].map((t) => h('span', { class: 'tick', style: { top: `${this.pct(t)}%` }, text: String(t) }));
    this.vte = h('span', { class: 'value', text: '---' });
    this.fio2 = h('span', { class: 'value', text: '---' });
    this.root = h('div', { class: 'barcol', role: 'group', 'aria-label': 'Barra de presión' },
      h('div', { class: 'pbar' }, h('div', { class: 'track' }, this.fill), ...ticks, this.mPmax, this.mPpeak, this.mPeep),
      h('div', { class: 'below' },
        h('div', { class: 'cell' }, h('span', { class: 'label', text: 'VTesp' }), this.vte, h('span', { class: 'limits' }), h('span', { class: 'unit', text: 'ml' })),
        h('div', { class: 'cell' }, h('span', { class: 'label', text: 'FiO2' }), this.fio2, h('span', { class: 'limits' }), h('span', { class: 'unit', text: '%' })),
      ),
    );
  }
  private pct(v: number): number {
    const f = (v - this.min) / (this.max - this.min);
    return (1 - Math.min(1, Math.max(0, f))) * 100;
  }
  private place(el: HTMLElement, v: number | null): void {
    if (v === null) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.style.top = `calc(${this.pct(v)}% )`;
  }
  update(f: EngineFrame): void {
    const paw = f.live.paw;
    this.fill.style.height = `${100 - this.pct(paw)}%`;
    this.place(this.mPmax, f.settings.pmax);
    const ppeak = f.metrics.ppeak?.value ?? f.live.ppeakCurrent;
    this.place(this.mPpeak, ppeak ?? null);
    this.place(this.mPeep, f.settings.peep === 'off' ? 0 : f.settings.peep);
    setText(this.vte, fmtSample(f.metrics.vte, 1000, 0));
    setText(this.fio2, fmtSample(f.metrics.fio2, 100, 0));
  }
}
