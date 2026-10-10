/** Diálogo de modo y ajustes completos: borrador local validado contra el perfil; confirmar envía sólo los cambios. */
import type { SettingRule } from '../domain/settingRules';
import type { SettingsKey, VcSettings, VentMode } from '../domain/types';
import { deriveVcTiming, gridValues, isOnGrid, validateDomains, validateVcSettings } from '../domain/validation';
import { formatNumber as f } from '../domain/units';
import type { AppContext } from './context';
import { CANCEL_BTN } from './dialogHost';
import { btn, esc, put } from './dom';
import { ieText, unitText } from './format';
import { contextualHelpPanel } from './helpPanels';
import { joinSentences } from './humanize';
import { HELP_KEY, QUICK_LABEL, textoRespaldo } from './labels';
import { ruleRangeIndex, ruleRangeValue, stepInputValue } from './numericSteps';

/** Modos ofrecidos y motivo de los no disponibles. Sólo se habilitan los declarados por el perfil. */
const MODE_OPTIONS: [VentMode, string][] = [
  ['AC_VC', 'A/C VC'],
  ['AC_PC', 'A/C PC'],
  ['CPAP_PS', 'CPAP/PS'],
];

export interface ModeDialog {
  openModes(): void;
  /** Pulsación de una opción de modo en el diálogo (ignorada si no hay borrador). */
  selectMode(mode: VentMode): void;
  readModeField(el: HTMLInputElement | HTMLSelectElement): void;
  slideModeField(el: HTMLInputElement): void;
  stepModeField(key: SettingsKey, direction: 1 | -1): void;
  confirmModes(): Promise<void>;
}

export function createModeDialog(ctx: AppContext, deps: { cancelQuick: () => void }): ModeDialog {
  const ruleOf = (k: SettingsKey): SettingRule => ctx.profile.rules[k];
  let modeDraft: VcSettings | null = null;
  ctx.dialog.onClose(() => {
    modeDraft = null;
  });

  function fieldHTML(k: SettingsKey, s: VcSettings): string {
    const rule = ruleOf(k),
      id = `help-setting-${k}`,
      v = s[k];
    if (rule.unit === 'boolean')
      return `<div class="setting-field full-span contextual-field"><label class="checkline"><input type="checkbox" role="switch" data-mode-field="${k}" aria-describedby="${id}" ${v ? 'checked' : ''}> ${QUICK_LABEL[k]}</label>${contextualHelpPanel(HELP_KEY[k], id)}</div>`;
    if (k === 'ie')
      return `<div class="setting-field contextual-field"><div class="parameter-label"><label for="setting-ie">I:E</label></div><div class="setting-input"><select id="setting-ie" data-mode-field="ie" aria-describedby="${id}">${(rule.values ?? []).map((r) => `<option value="${r}" ${Math.abs(r - (v as number)) < 1e-6 ? 'selected' : ''}>${ieText(r)}</option>`).join('')}</select></div>${contextualHelpPanel(HELP_KEY[k], id)}</div>`;
    const values = gridValues(rule);
    const min = values[0] ?? 0,
      max = values[values.length - 1] ?? 0,
      step = Math.min(...rule.domain.map((x) => x.step));
    const display = typeof v === 'number' ? v * rule.displayFactor : '';
    const rangeMax = values.length - 1 + (rule.allowOff ? 1 : 0);
    const rangeValue = v === 'off' ? ruleRangeIndex(rule, 'off') : typeof v === 'number' ? ruleRangeIndex(rule, v * rule.displayFactor) : 0;
    return `<div class="setting-field contextual-field"><div class="parameter-label"><label for="setting-${k}">${QUICK_LABEL[k]}</label></div><div class="setting-input"><button class="step-button" type="button" data-mode-step="${k}" data-direction="-1" aria-label="Disminuir ${QUICK_LABEL[k]}" aria-describedby="${id}">−</button><input id="setting-${k}" type="number" data-mode-field="${k}" aria-describedby="${id}" value="${display}" min="${rule.allowOff ? 0 : min}" max="${max}" step="${step}" placeholder="${rule.allowOff ? 'Off' : ''}"><button class="step-button" type="button" data-mode-step="${k}" data-direction="1" aria-label="Aumentar ${QUICK_LABEL[k]}" aria-describedby="${id}">+</button><small>${unitText(rule.displayUnit)}</small></div><input class="setting-range" type="range" data-mode-range="${k}" min="0" max="${rangeMax}" value="${rangeValue}" aria-label="Deslizador ${QUICK_LABEL[k]}" aria-describedby="${id}">${contextualHelpPanel(HELP_KEY[k], id)}</div>`;
  }
  function modeFields(): string {
    const s = modeDraft as VcSettings;
    const pc = s.mode === 'AC_PC',
      ps = s.mode === 'CPAP_PS';
    const main: SettingsKey[] = ps
      ? ['fio2', 'peep', 'psupport', 'riseMs', 'expTriggerPct', 'pmax']
      : pc
        ? ['fio2', 'peep', 'pinsp', 'rr', 'ie', 'riseMs', 'pmax']
        : ['fio2', 'peep', 'vt', 'rr', 'ie', 'pausePct', 'pmax'];
    const title = ps ? 'Presión de soporte sobre CPAP' : pc ? 'Asistido / controlado por presión' : 'Asistido / controlado por volumen';
    const desc = ps
      ? 'El paciente dispara cada respiración y decide su frecuencia; el ventilador sube a PEEP + PS con rampa y cicla cuando el flujo cae al porcentaje programado de su pico. Sin esfuerzo no hay respiración: la frecuencia mínima y el tiempo de apnea son el respaldo.'
      : pc
        ? 'Presión objetivo = PEEP + Pinsp durante el tiempo inspiratorio, con rampa. El flujo empieza alto y decae; el volumen depende de la compliance, la resistencia, el tiempo y el esfuerzo.'
        : 'Flujo constante calculado de VT, Tinsp y pausa. Pmáx es el techo de presión: alcanzarlo termina la inspiración.';
    const sync = `${ps ? '' : fieldHTML('assistControl', s)}${pc || ps ? '' : `<div class="settings-subtitle">Avanzado</div>${fieldHTML('plimit', s)}`}${fieldHTML('flowTrigger', s)}${fieldHTML('biasFlow', s)}${fieldHTML('triggerByPressure', s)}${fieldHTML('pressureTrigger', s)}`;
    const respaldo = ps
      ? `<div class="settings-subtitle">Respaldo</div>${fieldHTML('minRate', s)}${fieldHTML('backupPinsp', s)}${fieldHTML('backupTinspS', s)}${fieldHTML('apneaTimeS', s)}`
      : '';
    return `<div class="mode-description"><div class="parameter-label"><h3>${title}</h3></div><p class="settings-annotation">${desc}</p></div><div class="settings-grid">${main.map((k) => fieldHTML(k, s)).join('')}<div class="settings-subtitle">Sincronización</div>${sync}${respaldo}</div><div id="mode-timing" class="mode-timing"></div><div id="mode-warning" class="mode-error warn" role="status"></div><div id="mode-error" class="mode-error" role="status"></div>`;
  }
  function openModes(): void {
    if (!ctx.frame) return;
    modeDraft = { ...ctx.frame.settings, ...(ctx.frame.pending ?? {}) };
    deps.cancelQuick();
    renderModes();
  }
  function renderModes(): void {
    const m = (modeDraft as VcSettings).mode;
    const enabled = ctx.profile.enabledModes as readonly string[];
    const options = MODE_OPTIONS.map(([id, label]) => {
      const on = enabled.includes(id);
      const why = on ? '' : 'Pendiente de banco de pruebas en este perfil';
      return `<button class="mode-option ${m === id ? 'selected' : ''}" data-mode="${id}" aria-pressed="${m === id}" ${m === id ? 'aria-current="true"' : ''} ${on ? '' : `disabled title="${esc(why)}"`}><b>${label}</b>${on ? '' : `<small>${esc(why)}</small>`}</button>`;
    }).join('');
    ctx.dialog.open(
      'modes',
      'Modo y ajustes de ventilación',
      `<div class="mode-layout"><div class="mode-selector"><nav class="mode-list" aria-label="Modos ventilatorios">${options}</nav><p class="mode-other-note">Otros modos del R860 (PRVC, SIMV, BiLevel, APRV, NIV) no se simulan.</p></div><div id="mode-fields">${modeFields()}</div></div>`,
      CANCEL_BTN + btn('Confirmar ajustes', 'confirmModes'),
      'wide',
    );
    validateMode();
  }
  function validateMode(): { ok: boolean; errors: string[] } {
    const s = modeDraft;
    if (!s) return { ok: false, errors: [] };
    const cross = validateVcSettings(s, ctx.profile.crossLimits);
    const errors = [...validateDomains(s, ctx.profile.rules), ...cross.reasons];
    const warnings = (cross as { warnings?: string[] }).warnings ?? [];
    const t = deriveVcTiming(s);
    put(
      '#mode-timing',
      s.mode === 'CPAP_PS'
        ? textoRespaldo(s)
        : `Ti ${f(t.tInspS, 2)} s · Te ${f(t.tExpS, 2)} s · ciclo ${f(t.tCycleS, 2)} s · flujo ${f(t.qTargetLps * 60, 1)} L/min`,
    );
    put('#mode-error', joinSentences(errors));
    put('#mode-warning', joinSentences(warnings));
    const b = document.querySelector<HTMLButtonElement>('[data-action="confirmModes"]');
    if (b) b.disabled = errors.length > 0;
    return { ok: errors.length === 0, errors };
  }
  function readModeField(el: HTMLInputElement | HTMLSelectElement): void {
    const k = el.dataset.modeField as SettingsKey;
    if (!modeDraft) return;
    const rule = ruleOf(k);
    if (rule.unit === 'boolean') (modeDraft as unknown as Record<string, unknown>)[k] = (el as HTMLInputElement).checked;
    else if (k === 'ie') modeDraft.ie = Number(el.value);
    else {
      const raw = el.value.trim();
      if (rule.allowOff && (raw === '' || Number(raw) <= 0)) (modeDraft as unknown as Record<string, unknown>)[k] = 'off';
      else (modeDraft as unknown as Record<string, unknown>)[k] = Number(raw) / rule.displayFactor;
      const range = document.querySelector<HTMLInputElement>(`[data-mode-range="${k}"]`);
      if (range && (raw === '' || (Number.isFinite(Number(raw)) && isOnGrid(rule, Number(raw))))) {
        const current = raw === '' ? 'off' : Number(raw);
        range.value = String(ruleRangeIndex(rule, current));
      }
    }
    validateMode();
  }
  function slideModeField(el: HTMLInputElement): void {
    const k = el.dataset.modeRange as SettingsKey;
    const rule = ruleOf(k);
    const value = ruleRangeValue(rule, Number(el.value));
    const input = document.querySelector<HTMLInputElement>(`[data-mode-field="${k}"]`);
    if (!input || input.type !== 'number') return;
    input.value = value === 'off' ? '' : String(value);
    readModeField(input);
  }
  function stepModeField(k: SettingsKey, direction: 1 | -1): void {
    const input = document.querySelector<HTMLInputElement>(`[data-mode-field="${k}"]`);
    if (!input || input.type !== 'number') return;
    input.value = stepInputValue(ruleOf(k), input.value, direction);
    readModeField(input);
  }
  async function confirmModes(): Promise<void> {
    const r = validateMode();
    const frame = ctx.frame;
    if (!r.ok || !modeDraft || !frame) return;
    const changes: Partial<VcSettings> = {};
    const base = { ...frame.settings, ...(frame.pending ?? {}) };
    for (const k of Object.keys(modeDraft) as (keyof VcSettings)[])
      if (modeDraft[k] !== base[k]) (changes as Record<string, unknown>)[k] = modeDraft[k];
    if (!Object.keys(changes).length) {
      ctx.dialog.close();
      return;
    }
    const res = await ctx.send({ type: 'confirmSettings', changes });
    if (res.accepted) {
      if ('plimit' in changes) ctx.lesson.flags.plimitChanged = true;
      if ('peep' in changes) ctx.lesson.flags.peepChangedMs = ctx.frame?.simTimeMs ?? 0;
      ctx.lesson.noteSettingsChange();
      ctx.dialog.close();
    }
  }
  return {
    openModes,
    selectMode(mode) {
      if (!modeDraft) return;
      modeDraft.mode = mode;
      renderModes();
    },
    readModeField,
    slideModeField,
    stepModeField,
    confirmModes,
  };
}
