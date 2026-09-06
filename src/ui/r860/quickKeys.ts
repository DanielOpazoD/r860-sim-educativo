import type { SettingsKey, VcSettings } from '../../domain/types';
import type { EngineFrame } from '../../engine/simulator';
import type { EditController } from '../../app/uiState';
import { VC_ADULT_RULES } from '../../profiles/r860-es-photo-reference/settings';
import { h, setClass, setText } from './dom';
import { fmtIE } from './format';

const KEYS: { key: SettingsKey; label: string; unit: string }[] = [
  { key: 'fio2', label: 'FiO2', unit: '%' },
  { key: 'vt', label: 'VT', unit: 'ml' },
  { key: 'rr', label: 'Frecuencia', unit: '/min' },
  { key: 'ie', label: 'I:E', unit: '' },
  { key: 'peep', label: 'PEEP', unit: 'cmH2O' },
  { key: 'pmax', label: 'Pmáx', unit: 'cmH2O' },
];

export function displayValue(key: SettingsKey, v: VcSettings[SettingsKey]): string {
  if (v === 'off') return 'Off';
  if (key === 'ie') return fmtIE(v as number);
  const r = VC_ADULT_RULES[key];
  if (typeof v === 'boolean') return v ? 'On' : 'Off';
  return ((v as number) * r.displayFactor).toFixed(r.decimals);
}
export function displayDraft(key: SettingsKey, d: number | 'off'): string {
  if (d === 'off') return 'Off';
  if (key === 'ie') return fmtIE(d);
  return d.toFixed(VC_ADULT_RULES[key].decimals);
}

/** Teclas rápidas (O · P1/P3): Modo actual, FiO2, VT, Frecuencia, I:E, PEEP, Pmáx, EN ESPERA, Energía. */
export class QuickKeys {
  root: HTMLElement;
  private valueEls = new Map<SettingsKey, HTMLElement>();
  private keyEls = new Map<SettingsKey, HTMLButtonElement>();
  private modeEl: HTMLButtonElement;
  private standbyEl: HTMLButtonElement;
  private standbyValue: HTMLElement;

  constructor(private readonly edit: EditController, private readonly cb: { onMode: () => void; onStandby: () => void; onPower: () => void; onConfirm: (key: SettingsKey) => void }) {
    this.modeEl = h('button', { class: 'qk mode', type: 'button', 'aria-label': 'Modo actual', onclick: () => cb.onMode() }, h('span', { class: 'label', text: 'Modo actual' }), h('span', { class: 'value', text: 'A/C VC' }), h('span', { class: 'unit', text: '' }));
    const keys = KEYS.map((k) => {
      const value = h('span', { class: 'value', text: '' });
      const btn = h('button', { class: 'qk', type: 'button', 'aria-label': `${k.label}`, dataset: { key: k.key }, onclick: () => this.onKey(k.key) }, h('span', { class: 'label', text: k.label }), value, h('span', { class: 'unit', text: k.unit }));
      this.valueEls.set(k.key, value); this.keyEls.set(k.key, btn);
      return btn;
    });
    this.standbyValue = h('span', { class: 'value', text: 'EN ESPERA' });
    this.standbyEl = h('button', { class: 'qk standby', type: 'button', 'aria-label': 'EN ESPERA', onclick: () => cb.onStandby() }, h('span', { class: 'label', text: '' }), this.standbyValue, h('span', { class: 'unit', text: '✋' }));
    const power = h('button', { class: 'qk power', type: 'button', 'aria-label': 'Energía', onclick: () => cb.onPower() }, h('span', { class: 'label', text: 'Energía' }), h('span', { class: 'value', text: '⏻' }), h('span', { class: 'unit', text: '' }));
    this.root = h('div', { class: 'quickkeys', role: 'toolbar', 'aria-label': 'Teclas rápidas' }, this.modeEl, ...keys, this.standbyEl, power);
  }

  private onKey(key: SettingsKey): void {
    const st = this.edit.state;
    if (st.kind !== 'idle' && st.key === key) { this.cb.onConfirm(key); return; } // pulsar la tecla seleccionada activa el cambio (D QRG p.8)
    this.edit.select(key, performance.now());
    this.keyEls.get(key)?.focus();
    this.render(null);
  }

  render(f: EngineFrame | null): void {
    const st = this.edit.state;
    for (const k of KEYS) {
      const btn = this.keyEls.get(k.key)!; const val = this.valueEls.get(k.key)!;
      const isSel = st.kind !== 'idle' && st.key === k.key;
      setClass(btn, 'selected', isSel && st.kind === 'selected');
      setClass(btn, 'editing', isSel && st.kind === 'editing');
      btn.setAttribute('aria-pressed', isSel ? 'true' : 'false');
      if (isSel && st.kind === 'editing') setText(val, displayDraft(k.key, st.draftDisplay));
      else if (f) setText(val, displayValue(k.key, f.settings[k.key]));
      setClass(btn, 'pending', !!f?.pending && k.key in (f.pending as object));
    }
    if (f) {
      setClass(this.standbyEl, 'armed', f.ventilation === 'standby');
      setText(this.standbyValue, f.ventilation === 'standby' ? 'EN ESPERA ·' : 'EN ESPERA');
    }
  }
}
