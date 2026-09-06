import type { AlarmLimits, MetricSample, OffOr } from '../../domain/types';
import type { EngineFrame } from '../../engine/simulator';
import { h, setClass, setText } from './dom';
import { fmtLimit, fmtSample, NA } from './format';

interface CellSpec { key: string; label: string; unit: string; factor: number; decimals: number; big?: boolean; limits?: (l: AlarmLimits, f: EngineFrame) => [string, string] | null }

function limitPair(high: OffOr<number>, low: OffOr<number>, factor: number, decimals: number, showOff: boolean): [string, string] | null {
  if (high === 'off' && low === 'off') return showOff ? ['Off', ''] : null;
  return [fmtLimit(high, factor, decimals), fmtLimit(low, factor, decimals)];
}
function mvFmt(v: OffOr<number>): string {
  if (v === 'off') return 'Off';
  return v >= 10 ? String(Math.round(v)) : v.toFixed(1); // O: «20» y «5.0» en P1
}

class Cell {
  el: HTMLElement;
  private value: HTMLElement;
  private hi: HTMLElement;
  private lo: HTMLElement;
  constructor(readonly spec: CellSpec) {
    this.value = h('span', { class: 'value', text: NA });
    this.hi = h('span', { text: '' });
    this.lo = h('span', { text: '' });
    this.el = h('div', { class: `cell${spec.big ? ' big' : ''}`, role: 'group', 'aria-label': spec.label },
      h('span', { class: 'label', text: spec.label }),
      this.value,
      h('span', { class: 'limits', 'aria-label': 'límites de alarma' }, this.hi, this.lo),
      h('span', { class: 'unit', text: spec.unit }),
    );
  }
  update(sample: MetricSample | undefined, limits: [string, string] | null): void {
    setText(this.value, fmtSample(sample, this.spec.factor, this.spec.decimals));
    setClass(this.value, 'stale', sample?.quality === 'stale');
    setClass(this.value, 'na', !sample || sample.value === null);
    const title = sample ? `${sample.key} · calidad ${sample.quality}${sample.reason ? ' (' + sample.reason + ')' : ''} · sensor ${sample.source} · resp ${sample.breathId ?? '—'} · t=${sample.simTimeMs} ms` : '';
    if (this.value.title !== title) this.value.title = title;
    setText(this.hi, limits ? limits[0] : '');
    setText(this.lo, limits ? limits[1] : '');
  }
}

/** Panel denso de la vista avanzada (O · P1). */
export class AdvancedPanel {
  root: HTMLElement;
  private cells: Cell[];
  private leak: HTMLElement;
  constructor() {
    const specs: CellSpec[] = [
      { key: 'ppeak', label: 'Ppico', unit: 'cmH2O', factor: 1, decimals: 0, limits: (l, f) => [String(f.settings.pmax), fmtLimit(l.ppeakLow, 1, 0)] },
      { key: 'peepe', label: 'PEEPe', unit: 'cmH2O', factor: 1, decimals: 0, limits: (l) => limitPair(l.peepeHigh, l.peepeLow, 1, 0, false) },
      { key: 'pplatCycle', label: 'Pplat', unit: 'cmH2O', factor: 1, decimals: 0 },
      { key: 'pmean', label: 'Pmedia', unit: 'cmH2O', factor: 1, decimals: 0 },
      { key: 'mve', label: 'VMesp', unit: 'l/min', factor: 1, decimals: 1, limits: (l) => (l.mveHigh === 'off' && l.mveLow === 'off') ? null : [mvFmt(l.mveHigh), mvFmt(l.mveLow)] },
      { key: 'rr', label: 'FR', unit: '/min', factor: 1, decimals: 0, limits: (l) => limitPair(l.rrHigh, l.rrLow, 1, 0, false) },
      { key: 'vte', label: 'VTesp', unit: 'ml', factor: 1000, decimals: 0, limits: (l) => limitPair(l.vteHigh, l.vteLow, 1000, 0, false) },
      { key: 'fio2', label: 'FiO2', unit: '%', factor: 100, decimals: 0, limits: (l) => limitPair(l.fio2High, l.fio2Low, 100, 0, false) },
      { key: 'mveSpont', label: 'VMesp espont', unit: 'l/min', factor: 1, decimals: 2 },
      { key: 'rrSpont', label: 'FR espont', unit: '/min', factor: 1, decimals: 0 },
      { key: 'vteSpont', label: 'VTesp espont', unit: 'ml', factor: 1000, decimals: 0 },
    ];
    this.cells = specs.map((s) => new Cell(s));
    this.leak = h('div', { class: 'row-leak', text: 'Fuga % ---' });
    const [ppeak, peepe, pplat, pmean, mve, rr, vte, fio2, mves, rrs, vtes] = this.cells as [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];
    this.root = h('div', { class: 'panel', 'aria-label': 'Datos medidos' }, ppeak.el, peepe.el, pplat.el, pmean.el, this.leak, mve.el, rr.el, vte.el, fio2.el, mves.el, rrs.el, vtes.el);
  }
  update(f: EngineFrame): void {
    for (const c of this.cells) c.update(f.metrics[c.spec.key], c.spec.limits ? c.spec.limits(f.alarmLimits, f) : null);
    const leak = f.metrics.leakPct;
    setText(this.leak, `Fuga % ${leak && leak.value !== null ? Math.round(leak.value * 100) : NA}`);
  }
}

/** Seis valores grandes de la vista de curvas básicas (O · P3). */
export class BasicPanel {
  root: HTMLElement;
  private cells: Cell[];
  constructor() {
    const specs: CellSpec[] = [
      { key: 'fio2', label: 'FiO2', unit: '%', factor: 100, decimals: 0, big: true, limits: (l) => limitPair(l.fio2High, l.fio2Low, 100, 0, true) },
      { key: 'peepe', label: 'PEEPe', unit: 'cmH2O', factor: 1, decimals: 0, big: true, limits: (l) => limitPair(l.peepeHigh, l.peepeLow, 1, 0, true) },
      { key: 'ppeak', label: 'Presión pico', unit: 'cmH2O', factor: 1, decimals: 0, big: true, limits: (l, f) => [String(f.settings.pmax), fmtLimit(l.ppeakLow, 1, 0)] },
      { key: 'mve', label: 'Volumen minuto', unit: 'l/min', factor: 1, decimals: 1, big: true, limits: (l) => [mvFmt(l.mveHigh), mvFmt(l.mveLow)] },
      { key: 'vte', label: 'Volumen tidal', unit: 'ml', factor: 1000, decimals: 0, big: true, limits: (l) => limitPair(l.vteHigh, l.vteLow, 1000, 0, true) },
      { key: 'rr', label: 'Frecuencia resp.', unit: '/min', factor: 1, decimals: 0, big: true, limits: (l) => limitPair(l.rrHigh, l.rrLow, 1, 0, true) },
    ];
    this.cells = specs.map((s) => new Cell(s));
    this.root = h('div', { class: 'panel basic', 'aria-label': 'Datos medidos (vista básica)' }, ...this.cells.map((c) => c.el));
  }
  update(f: EngineFrame): void {
    for (const c of this.cells) c.update(f.metrics[c.spec.key], c.spec.limits ? c.spec.limits(f.alarmLimits, f) : null);
  }
}
