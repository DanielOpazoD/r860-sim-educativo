import { h, setText } from './dom';
import { SCALES, SweepChannel, type ScaleSetId, type WaveformChannelSpec } from '../../render/waveforms';
import { lpsToLpm, litersToMl } from '../../domain/units';

const LINE = '#f2fbff';

export class WaveArea {
  root: HTMLElement;
  private channels: Record<'paw' | 'flow' | 'vol', SweepChannel>;
  private tickBoxes: Record<'paw' | 'flow' | 'vol', HTMLElement>;
  private scaleId: ScaleSetId = 'advanced';
  private queue: { t: Float64Array; paw: Float32Array; flow: Float32Array; vol: Float32Array }[] = [];
  readonly windowS = 12; // P: ~5 ciclos a 32/min como en P1

  constructor() {
    const mk = (id: 'paw' | 'flow' | 'vol', title: string, unit: string, spec: WaveformChannelSpec) => {
      const canvas = h('canvas', { 'aria-hidden': 'true' });
      const ticks = h('div', { class: 'ticks' });
      const btn = h('button', { class: 'scale-btn', type: 'button', title: 'Cambiar escala (P)', onclick: () => this.cycleScale() }, 'escala');
      const el = h('div', { class: 'curve', role: 'img', 'aria-label': `Curva de ${title} en ${unit}` }, h('span', { class: 'title', text: title }), h('span', { class: 'unit', text: unit }), btn, ticks, canvas);
      return { el, ch: new SweepChannel(canvas, spec, this.windowS), ticks };
    };
    const s = SCALES.advanced;
    const paw = mk('paw', 'Pva', 'cmH2O', { id: 'paw', scale: s.paw, style: { line: LINE, fill: 'rgba(232, 231, 76, .75)', baselineValue: 0 }, toDisplay: (v) => v });
    const flow = mk('flow', 'Flujo', 'l/min', { id: 'flow', scale: s.flow, style: { line: LINE, fill: 'rgba(35, 201, 139, .75)', baselineValue: 0 }, toDisplay: lpsToLpm });
    const vol = mk('vol', 'Volumen', 'ml', { id: 'vol', scale: s.vol, style: { line: LINE, fill: 'rgba(200, 230, 255, .7)', baselineValue: 0 }, toDisplay: litersToMl });
    this.channels = { paw: paw.ch, flow: flow.ch, vol: vol.ch };
    this.tickBoxes = { paw: paw.ticks, flow: flow.ticks, vol: vol.ticks };
    this.root = h('div', { class: 'curves' }, paw.el, flow.el, vol.el);
    this.renderTicks();
  }

  setScaleSet(id: ScaleSetId): void {
    this.scaleId = id;
    const s = SCALES[id];
    this.channels.paw.setScale(s.paw); this.channels.flow.setScale(s.flow); this.channels.vol.setScale(s.vol);
    this.renderTicks();
  }
  get scaleSet(): ScaleSetId { return this.scaleId; }

  private cycleScale(): void {
    const order: ScaleSetId[] = ['advanced', 'basic', 'wide'];
    this.setScaleSet(order[(order.indexOf(this.scaleId) + 1) % order.length] as ScaleSetId);
  }

  private renderTicks(): void {
    for (const id of ['paw', 'flow', 'vol'] as const) {
      const ch = this.channels[id];
      const box = this.tickBoxes[id];
      box.replaceChildren();
      const { min, max } = ch.spec.scale;
      const labels = [max, ...ch.spec.scale.ticks.filter((t) => t !== max && t !== min), min];
      for (const t of labels) {
        const f = (t - min) / (max - min);
        box.append(h('span', { style: { top: `${(1 - f) * 100}%` }, text: String(t) }));
      }
    }
  }

  enqueue(samples: { t: Float64Array; paw: Float32Array; flow: Float32Array; vol: Float32Array }): void {
    if (samples.t.length) this.queue.push(samples);
  }

  /** Llamado desde requestAnimationFrame: sólo dibuja lo encolado. */
  draw(): void {
    for (const ch of Object.values(this.channels)) ch.resize();
    for (const s of this.queue) {
      this.channels.paw.push(s.t, s.paw);
      this.channels.flow.push(s.t, s.flow);
      this.channels.vol.push(s.t, s.vol);
    }
    this.queue = [];
  }

  clear(): void {
    this.queue = [];
    for (const ch of Object.values(this.channels)) ch.clearAll();
  }

  setTitles(paw: string): void { setText(this.root.querySelector('.curve .title') as Element, paw); }
}
