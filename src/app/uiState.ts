import type { SettingRule } from '../domain/settingRules';
import type { SettingsKey, VcSettings } from '../domain/types';
import { isOnGrid, stepDisplayValue, validateVcSettings, type CrossLimits, type DerivedTiming } from '../domain/validation';

/**
 * Máquina de estados de edición (D patrón QRG 2020 p.8: seleccionar tecla → girar mando → pulsar mando o tecla para activar;
 * D: cambios no confirmados se cancelan al vencer un plazo; el plazo exacto es U-07 → valor configurable P).
 * Seleccionar NO aplica. Confirmar y cancelar son transacciones. El bloqueo de pantalla impide editar sin detener nada.
 */
export type EditState =
  | { kind: 'idle' }
  | { kind: 'selected'; key: SettingsKey; draftDisplay: number | 'off'; originalDisplay: number | 'off'; at: number }
  | { kind: 'editing'; key: SettingsKey; draftDisplay: number | 'off'; originalDisplay: number | 'off'; at: number };

export interface EditPreview {
  valid: boolean;
  reasons: string[];
  derived: DerivedTiming | null;
  changed: boolean;
}

export type EditEvent =
  | { type: 'confirmed'; key: SettingsKey; changes: Partial<VcSettings> }
  | { type: 'cancelled'; key: SettingsKey; reason: 'user' | 'timeout' | 'reselect' | 'locked' }
  | { type: 'rejected'; key: SettingsKey; reasons: string[] };

export class EditController {
  state: EditState = { kind: 'idle' };
  locked = false;
  private listeners: ((e: EditEvent) => void)[] = [];

  constructor(
    private readonly rules: Record<SettingsKey, SettingRule>,
    private readonly limits: CrossLimits,
    private readonly getActive: () => VcSettings,
    readonly timeoutMs: number,
  ) {}

  on(l: (e: EditEvent) => void): void {
    this.listeners.push(l);
  }
  private emit(e: EditEvent): void {
    for (const l of this.listeners) l(e);
  }

  private toDisplay(key: SettingsKey, v: unknown): number | 'off' {
    if (v === 'off') return 'off';
    if (typeof v === 'boolean') return v ? 1 : 0;
    return (v as number) * this.rules[key].displayFactor;
  }

  private toInternal(key: SettingsKey, d: number | 'off'): VcSettings[SettingsKey] {
    if (d === 'off') return 'off' as VcSettings[SettingsKey];
    if (this.rules[key].unit === 'boolean') return (d >= 0.5) as unknown as VcSettings[SettingsKey];
    return (d / this.rules[key].displayFactor) as VcSettings[SettingsKey];
  }

  /** Seleccionar carga una copia del valor activo; seleccionar otra tecla descarta el borrador anterior (P). */
  select(key: SettingsKey, now: number): boolean {
    if (this.locked) {
      this.emit({ type: 'cancelled', key, reason: 'locked' });
      return false;
    }
    if (this.state.kind !== 'idle' && this.state.key === key) {
      this.state = { ...this.state, at: now };
      return true;
    } // misma tecla: conserva el borrador
    if (this.state.kind !== 'idle' && this.state.key !== key) this.emit({ type: 'cancelled', key: this.state.key, reason: 'reselect' });
    const orig = this.toDisplay(key, this.getActive()[key]);
    this.state = { kind: 'selected', key, draftDisplay: orig, originalDisplay: orig, at: now };
    return true;
  }

  /** Un escalón del mando/flechas: sólo sobre la tecla seleccionada; la rueda sin selección no hace nada (INT-06). */
  adjust(direction: 1 | -1, now: number): boolean {
    if (this.locked || this.state.kind === 'idle') return false;
    const key = this.state.key;
    const rule = this.rules[key];
    let next: number | 'off';
    const cur = this.state.draftDisplay;
    if (rule.allowOff) {
      const min = rule.domain[0]?.min ?? 0;
      if (cur === 'off') next = direction > 0 ? min : 'off';
      else if (direction < 0 && Math.abs(cur - min) < 1e-9) next = 'off';
      else next = stepDisplayValue(rule, cur, direction);
    } else if (rule.unit === 'boolean') {
      next = direction > 0 ? 1 : 0;
    } else {
      next = stepDisplayValue(rule, cur === 'off' ? (rule.domain[0]?.min ?? 0) : cur, direction);
    }
    this.state = { kind: 'editing', key, draftDisplay: next, originalDisplay: this.state.originalDisplay, at: now };
    return true;
  }

  /** Valor escrito directamente (campo numérico o deslizador). Se valida en preview(); no se aproxima en silencio. */
  setDraftDisplay(value: number | 'off', now: number): boolean {
    if (this.locked || this.state.kind === 'idle') return false;
    this.state = { kind: 'editing', key: this.state.key, draftDisplay: value, originalDisplay: this.state.originalDisplay, at: now };
    return true;
  }

  /** Vista previa antes de confirmar: valida rango, rejilla y consecuencias cruzadas (Tinsp, flujo). */
  preview(): EditPreview {
    if (this.state.kind === 'idle') return { valid: false, reasons: [], derived: null, changed: false };
    const { key, draftDisplay, originalDisplay } = this.state;
    const rule = this.rules[key];
    const reasons: string[] = [];
    if (draftDisplay !== 'off' && rule.unit !== 'boolean' && !isOnGrid(rule, draftDisplay))
      reasons.push(`${rule.label}: ${draftDisplay} no está en la rejilla de escalones`);
    if (draftDisplay === 'off' && !rule.allowOff) reasons.push(`${rule.label}: Off no permitido`);
    const candidate: VcSettings = { ...this.getActive(), [key]: this.toInternal(key, draftDisplay) } as VcSettings;
    const v = validateVcSettings(candidate, this.limits);
    reasons.push(...v.reasons);
    const changed = draftDisplay !== originalDisplay;
    return { valid: reasons.length === 0, reasons, derived: v.derived, changed };
  }

  /** Confirmar: transacción única; un valor inválido produce explicación, no aproximación silenciosa. */
  confirm(): boolean {
    if (this.state.kind === 'idle') return false;
    const key = this.state.key;
    const p = this.preview();
    if (!p.valid) {
      this.emit({ type: 'rejected', key, reasons: p.reasons });
      return false;
    }
    const changes = { [key]: this.toInternal(key, this.state.draftDisplay) } as Partial<VcSettings>;
    this.state = { kind: 'idle' };
    if (p.changed) this.emit({ type: 'confirmed', key, changes });
    return true;
  }

  cancel(reason: 'user' | 'timeout' = 'user'): boolean {
    if (this.state.kind === 'idle') return false;
    const key = this.state.key;
    this.state = { kind: 'idle' };
    this.emit({ type: 'cancelled', key, reason });
    return true;
  }

  /** Vencimiento del borrador (plazo P, configurable). */
  tick(now: number): void {
    if (this.state.kind === 'idle') return;
    if (now - this.state.at >= this.timeoutMs) this.cancel('timeout');
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
    if (locked && this.state.kind !== 'idle') this.cancel('user');
  }
}

/** Borrador transaccional del menú de modo: varios ajustes a la vez; cancelar restaura todo. */
export class ModeMenuDraft {
  draft: VcSettings;
  constructor(
    private readonly rules: Record<SettingsKey, SettingRule>,
    private readonly limits: CrossLimits,
    readonly original: VcSettings,
  ) {
    this.draft = { ...original };
  }
  adjust(key: SettingsKey, direction: 1 | -1): void {
    const rule = this.rules[key];
    const cur = this.draft[key];
    if (rule.unit === 'boolean') {
      (this.draft as unknown as Record<string, unknown>)[key] = direction > 0;
      return;
    }
    if (rule.allowOff) {
      const min = rule.domain[0]?.min ?? 0;
      if (cur === 'off') {
        if (direction > 0) (this.draft as unknown as Record<string, unknown>)[key] = min / rule.displayFactor;
        return;
      }
      const d = (cur as number) * rule.displayFactor;
      if (direction < 0 && Math.abs(d - min) < 1e-9) {
        (this.draft as unknown as Record<string, unknown>)[key] = 'off';
        return;
      }
      (this.draft as unknown as Record<string, unknown>)[key] = stepDisplayValue(rule, d, direction) / rule.displayFactor;
      return;
    }
    (this.draft as unknown as Record<string, unknown>)[key] =
      stepDisplayValue(rule, (cur as number) * rule.displayFactor, direction) / rule.displayFactor;
  }
  validate() {
    return validateVcSettings(this.draft, this.limits);
  }
  changes(): Partial<VcSettings> {
    const out: Partial<VcSettings> = {};
    for (const k of Object.keys(this.draft) as (keyof VcSettings)[])
      if (this.draft[k] !== this.original[k]) (out as Record<string, unknown>)[k] = this.draft[k];
    return out;
  }
}
