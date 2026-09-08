/** Diálogo de modo y ajustes completos: borrador local validado contra el perfil; confirmar envía sólo los cambios. */
import type { SettingRule } from '../domain/settingRules';
import type { SettingsKey, VcSettings, VentMode } from '../domain/types';
import { deriveVcTiming, validateDomains, validateVcSettings } from '../domain/validation';
import { formatNumber as f } from '../domain/units';
import type { AppContext } from './context';
import { CANCEL_BTN } from './dialogHost';
import { btn, esc, put } from './dom';
import { ieText, unitText } from './format';
import { infoButton, infoPanel } from './helpPanels';
import { joinSentences } from './humanize';
import { HELP_KEY, QUICK_LABEL } from './labels';

/** Modos ofrecidos y motivo de los no disponibles. Sólo se habilitan los declarados por el perfil. */
const MODE_OPTIONS: [VentMode, string][] = [
  ['AC_VC', 'A/C VC'],
  ['AC_PC', 'A/C PC'],
];
const OTHER_MODES: [string, string][] = [
  ['CPAP/PS', 'Próximamente: requiere validar esfuerzo, disparo, ciclaje y respaldo'],
  ['A/C PRVC', 'No disponible: el algoritmo adaptativo del fabricante no está publicado'],
  ['SIMV VC / PC', 'Próximamente'],
  ['BiLevel / APRV / NIV', 'No disponible en este simulador'],
];

export interface ModeDialog {
  openModes(): void;
  /** Pulsación de una opción de modo en el diálogo (ignorada si no hay borrador). */
  selectMode(mode: VentMode): void;
  readModeField(el: HTMLInputElement | HTMLSelectElement): void;
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
      return `<div class="full-span"><div class="parameter-label"><label class="checkline"><input type="checkbox" data-mode-field="${k}" ${v ? 'checked' : ''}> ${QUICK_LABEL[k]}</label>${infoButton(HELP_KEY[k], id)}</div>${infoPanel(HELP_KEY[k], id)}</div>`;
    if (k === 'ie')
      return `<div class="setting-field"><div class="parameter-label"><label for="setting-ie">I:E</label>${infoButton(HELP_KEY[k], id)}</div><div class="setting-input"><select id="setting-ie" data-mode-field="ie">${(rule.values ?? []).map((r) => `<option value="${r}" ${Math.abs(r - (v as number)) < 1e-6 ? 'selected' : ''}>${ieText(r)}</option>`).join('')}</select></div>${infoPanel(HELP_KEY[k], id)}</div>`;
    const segs = rule.domain;
    const min = segs[0]?.min ?? 0,
      max = segs[segs.length - 1]?.max ?? 0,
      step = Math.min(...segs.map((x) => x.step));
    const display = v === 'off' ? '' : (v as number) * rule.displayFactor;
    return `<div class="setting-field"><div class="parameter-label"><label for="setting-${k}">${QUICK_LABEL[k]}</label>${infoButton(HELP_KEY[k], id)}</div><div class="setting-input"><input id="setting-${k}" type="number" data-mode-field="${k}" value="${display}" min="${rule.allowOff ? 0 : min}" max="${max}" step="${step}" placeholder="${rule.allowOff ? 'Off' : ''}"><small>${unitText(rule.displayUnit)}</small></div>${infoPanel(HELP_KEY[k], id)}</div>`;
  }
  function modeFields(): string {
    const s = modeDraft as VcSettings;
    const pc = s.mode === 'AC_PC';
    const main: SettingsKey[] = pc
      ? ['fio2', 'peep', 'pinsp', 'rr', 'ie', 'riseMs', 'pmax']
      : ['fio2', 'peep', 'vt', 'rr', 'ie', 'pausePct', 'pmax'];
    const title = pc ? 'Asistido / controlado por presión' : 'Asistido / controlado por volumen';
    const desc = pc
      ? 'Presión objetivo = PEEP + Pinsp durante el tiempo inspiratorio, con rampa. El flujo empieza alto y decae; el volumen depende de la compliance, la resistencia, el tiempo y el esfuerzo.'
      : 'Flujo constante calculado de VT, Tinsp y pausa. Pmáx es el techo de presión: alcanzarlo termina la inspiración.';
    return `<div class="mode-description"><div class="parameter-label"><h3>${title}</h3></div><p class="settings-annotation">${desc}</p></div><div class="settings-grid">${main.map((k) => fieldHTML(k, s)).join('')}<div class="settings-subtitle">Sincronización</div>${fieldHTML('assistControl', s)}${pc ? '' : `<div class="settings-subtitle">Avanzado</div>${fieldHTML('plimit', s)}`}${fieldHTML('flowTrigger', s)}${fieldHTML('biasFlow', s)}${fieldHTML('triggerByPressure', s)}${fieldHTML('pressureTrigger', s)}</div><div id="mode-timing" class="mode-timing"></div><div id="mode-warning" class="mode-error warn" role="status"></div><div id="mode-error" class="mode-error" role="status"></div>`;
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
    const others = OTHER_MODES.map(
      ([mm, why]) => `<button class="mode-option" disabled aria-pressed="false" title="${esc(why)}"><b>${mm}</b></button>`,
    ).join('');
    ctx.dialog.open(
      'modes',
      'Modo y ajustes de ventilación',
      `<div class="mode-layout"><nav class="mode-list" aria-label="Modos ventilatorios">${options}${others}</nav><div id="mode-fields">${modeFields()}</div></div>`,
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
      `Ti ${f(t.tInspS, 2)} s · Te ${f(t.tExpS, 2)} s · ciclo ${f(t.tCycleS, 2)} s · flujo ${f(t.qTargetLps * 60, 1)} L/min`,
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
    }
    validateMode();
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
      if ('peep' in changes) ctx.lesson.flags.peepChanged = true;
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
    confirmModes,
  };
}
