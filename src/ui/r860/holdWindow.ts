import type { SettingRule } from '../../domain/settingRules';
import { stepDisplayValue } from '../../domain/validation';
import type { EngineFrame } from '../../engine/simulator';
import type { ProcedureResult } from '../../domain/types';
import { h, setClass, setText } from './dom';
import { fmtDate, fmtNumber, fmtTime, NA } from './format';

/**
 * Ventana de bloqueo (O · P1/P2/P3): Tiempo, ▶, Pplat/Cstat (insp) o PEEPtot/PEEPi (esp, P), fecha y hora.
 * Es un objeto de procedimiento persistente: al reabrirla muestra el último resultado con su hora, no cifras regeneradas.
 */
export class HoldWindow {
  root: HTMLElement;
  private timeKey: HTMLButtonElement;
  private startBtn: HTMLButtonElement;
  private v1: HTMLElement; private v2: HTMLElement; private date: HTMLElement; private time: HTMLElement; private status: HTMLElement;
  private draft: number | null = null;
  private selected = false;
  private lastResultId: string | null = null;
  durationS: number;

  constructor(readonly kind: 'inspHold' | 'expHold', private readonly rule: SettingRule, private readonly cb: { start: (durationS: number) => void; cancel: () => void }) {
    this.durationS = kind === 'inspHold' ? 3 : 3; // O: «Tiempo 3 s» en P1/P2/P3 (insp); esp: P
    this.timeKey = h('button', { class: 'time-key', type: 'button', 'aria-label': 'Tiempo de bloqueo', onclick: () => this.onTimeKey() }, String(this.durationS));
    this.startBtn = h('button', { class: 'start', type: 'button', 'aria-label': 'Iniciar bloqueo', onclick: () => this.onStart() }, '▶');
    this.v1 = h('span', { class: 'value', text: NA }); this.v2 = h('span', { class: 'value', text: NA });
    this.date = h('span', { text: '' }); this.time = h('span', { text: '' });
    this.status = h('div', { class: 'status', text: '' });
    const l1 = kind === 'inspHold' ? 'Pplat' : 'PEEPtot (P)';
    const l2 = kind === 'inspHold' ? 'Cstat' : 'PEEPi (P)';
    const u2 = kind === 'inspHold' ? 'ml/cmH2O' : 'cmH2O';
    this.root = h('div', { class: 'holdwin', role: 'dialog', 'aria-label': kind === 'inspHold' ? 'Bloqueo inspiratorio' : 'Bloqueo espiratorio' },
      h('div', { class: 'row' },
        h('div', { class: 'field' }, h('span', { class: 'label', text: 'Tiempo' }), this.timeKey, h('span', { class: 'unit', text: 's' })),
        h('div', { class: 'field' }, h('span', { class: 'label', text: ' ' }), this.startBtn),
        h('div', { class: 'field' }, h('span', { class: 'label', text: l1 }), this.v1, h('span', { class: 'unit', text: 'cmH2O' })),
        h('div', { class: 'field' }, h('span', { class: 'label', text: l2 }), this.v2, h('span', { class: 'unit', text: u2 })),
      ),
      h('div', { class: 'stamp' }, this.date, this.time),
      this.status,
    );
    this.root.hidden = true;
  }

  get isEditing(): boolean { return this.selected; }

  private onTimeKey(): void {
    if (!this.selected) { this.selected = true; this.draft = this.durationS; this.render(); return; }
    this.confirm();
  }
  adjust(direction: 1 | -1): void {
    if (!this.selected || this.draft === null) return;
    this.draft = stepDisplayValue(this.rule, this.draft, direction);
    this.render();
  }
  confirm(): void {
    if (!this.selected) return;
    if (this.draft !== null) this.durationS = this.draft;
    this.selected = false; this.draft = null; this.render();
  }
  cancelEdit(): void { this.selected = false; this.draft = null; this.render(); }

  private running = false;
  private onStart(): void {
    if (this.selected) this.confirm();
    if (this.running) this.cb.cancel(); else this.cb.start(this.durationS);
  }

  private render(): void {
    setText(this.timeKey, String(this.draft ?? this.durationS));
    setClass(this.timeKey, 'selected', this.selected && this.draft === this.durationS);
    setClass(this.timeKey, 'draft', this.selected && this.draft !== this.durationS);
  }

  update(f: EngineFrame): void {
    const hold = f.procedure.hold;
    const mine = hold && hold.kind === this.kind ? hold : null;
    this.running = !!mine;
    setText(this.startBtn, mine ? '■' : '▶');
    setClass(this.startBtn, 'running', !!mine);
    this.startBtn.setAttribute('aria-label', mine ? 'Cancelar bloqueo' : 'Iniciar bloqueo');
    const last: ProcedureResult | null = f.procedure.last[this.kind];
    if (mine) {
      setText(this.status, mine.phase === 'queued' ? 'en cola: espera la fase elegible' : `en curso ${mine.elapsedS.toFixed(1)} / ${mine.durationS} s`);
      setClass(this.status, 'invalid', false);
    } else if (last) {
      const ok = last.quality === 'valid';
      setText(this.status, ok ? '' : `resultado ${last.phase}: ${last.reason ?? ''}`);
      setClass(this.status, 'invalid', !ok);
    } else {
      setText(this.status, 'sin resultado previo');
      setClass(this.status, 'invalid', false);
    }
    if (last && last.procedureId !== this.lastResultId) {
      this.lastResultId = last.procedureId;
      if (this.kind === 'inspHold') {
        setText(this.v1, fmtNumber(last.values.pplat?.value ?? null, 0));
        const c = last.values.cstat?.value;
        setText(this.v2, c === null || c === undefined ? NA : fmtNumber(c * 1000, 0));
      } else {
        setText(this.v1, fmtNumber(last.values.peepTot?.value ?? null, 0));
        setText(this.v2, fmtNumber(last.values.peepi?.value ?? null, 1));
      }
      setText(this.date, last.wallTimeMs === null ? '' : fmtDate(last.wallTimeMs));
      setText(this.time, last.wallTimeMs === null ? '' : fmtTime(last.wallTimeMs));
      this.v1.title = last.values.pplat ? JSON.stringify(last.values.pplat) : '';
    }
  }
  toggle(show?: boolean): void { this.root.hidden = show === undefined ? !this.root.hidden : !show; if (this.root.hidden) this.cancelEdit(); }
  get visible(): boolean { return !this.root.hidden; }
}
