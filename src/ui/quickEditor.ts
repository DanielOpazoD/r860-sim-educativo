/**
 * Teclas rápidas y editor de un ajuste (seleccionar → girar → confirmar). Dueño del EditController y del borrador:
 * la interfaz sólo envía `confirmSettings` cuando el controlador emite «confirmed».
 */
import { EditController } from '../app/uiState';
import type { SettingRule } from '../domain/settingRules';
import type { SettingsKey } from '../domain/types';
import { gridValues, isOnGrid, nearestGridValue } from '../domain/validation';
import type { EngineFrame } from '../engine/simulator';
import { formatNumber as f } from '../domain/units';
import type { AppContext } from './context';
import { $, icon, put } from './dom';
import { ieText, unitText } from './format';
import { collapseHelp, helpContent } from './helpPanels';
import { joinSentences } from './humanize';
import { displaySetting, HELP_KEY, isMobile, MODE_LABEL, QUICK_KEYS_BY_MODE, QUICK_LABEL, textoRespaldo } from './labels';

/** Últimos segundos del plazo de edición en los que se muestra la cuenta atrás. */
const COUNTDOWN_WINDOW_MS = 10_000;

export interface QuickEditor {
  readonly edit: EditController;
  /** Pinta la barra de teclas rápidas, la cinta de pendientes y la capa de espera a partir del cuadro actual. */
  updateQuick(): void;
  openQuick(k: SettingsKey, opener?: HTMLElement | null): void;
  renderQuick(): void;
  renderCountdown(now: number): void;
  stepQuick(dir: 1 | -1): void;
  typedQuick(raw: string): void;
  /** Deslizador: índice sobre la lista de pasos admitidos (0 = Off cuando procede). */
  slidQuick(index: number): void;
  confirmQuick(): void;
  cancelQuick(): void;
  placeQuickEditor(): void;
}

export function createQuickEditor(ctx: AppContext): QuickEditor {
  const ruleOf = (k: SettingsKey): SettingRule => ctx.profile.rules[k];
  const edit = new EditController(
    ctx.profile.rules,
    ctx.profile.crossLimits,
    () => (ctx.frame ? { ...ctx.frame.settings, ...(ctx.frame.pending ?? {}) } : { ...ctx.profile.defaults.settings }),
    ctx.editTimeoutMs,
  );
  /** Tecla rápida que abrió el editor: recibe el foco al confirmar o cancelar. */
  let quickOpener: HTMLElement | null = null;
  let lastQuickSig = '';
  let knobAngle = 0;
  let typing = false;

  function updateQuick(): void {
    const fr = ctx.frame as EngineFrame;
    const QUICK_KEYS = QUICK_KEYS_BY_MODE[fr.settings.mode];
    if (lastQuickSig !== fr.settings.mode) {
      lastQuickSig = fr.settings.mode;
      $('#quick-controls').style.setProperty('--nkeys', String(QUICK_KEYS.length));
      $('#quick-controls').innerHTML =
        `<button class="device-key quick-key mode-key" data-action="modes"><small>Modo actual</small><b id="quick-mode">${MODE_LABEL[fr.settings.mode]}</b></button>` +
        QUICK_KEYS.map(
          (k) =>
            `<button class="device-key quick-key" data-setting-quick="${k}" data-key="${k}" aria-pressed="false"><small>${QUICK_LABEL[k]}</small><b data-quick-val="${k}"></b><em>${k === 'ie' ? '' : unitText(ruleOf(k).displayUnit)}</em><i data-quick-next="${k}" hidden></i></button>`,
        ).join('') +
        `<button class="device-key quick-key standby-key" data-action="standby"><small>EN ESPERA</small>${icon('hand')}</button><button class="device-key quick-key power-key" data-action="powerInfo" aria-label="Estado de alimentación virtual">${icon('plug')}</button>`;
    }
    const st = edit.state;
    for (const k of QUICK_KEYS) {
      const b = $(`[data-setting-quick="${k}"]`);
      const sel = st.kind !== 'idle' && st.key === k;
      // La cara del equipo muestra SIEMPRE lo que el ventilador está entregando. El borrador vive en el editor, que
      // está abierto al lado y lo enseña en grande; pintarlo también aquí hacía que la tecla dijera «PEEP 99» —un
      // valor rechazado— con el mismo tratamiento que un ajuste vigente, que es lo contrario de «seleccionar ≠ aplicar».
      put(`[data-quick-val="${k}"]`, displaySetting(ctx.profile.rules, k, fr.settings[k]));
      // Un cambio confirmado y aún sin aplicar sí se anuncia, pero como lo que es: una propuesta, con su flecha.
      const propuesto = fr.pending && k in fr.pending;
      const next = $(`[data-quick-next="${k}"]`);
      next.hidden = !propuesto;
      if (propuesto)
        put(`[data-quick-next="${k}"]`, `→ ${displaySetting(ctx.profile.rules, k, (fr.pending as Record<string, unknown>)[k] as never)}`);
      b.classList.toggle('editing', sel);
      b.setAttribute('aria-pressed', String(sel));
      b.classList.toggle('pending', !!propuesto);
    }
    $('#standby-overlay').hidden = fr.ventilation !== 'standby';
    $('.standby-key').classList.toggle('active-standby', fr.ventilation === 'standby');
    // La tecla se explica sola: qué hace al pulsarla según el estado en que está.
    const esperaTexto =
      fr.ventilation === 'standby'
        ? 'En espera: pulsa para iniciar la ventilación'
        : 'Pasar a espera: detiene la ventilación virtual, el reloj sigue';
    $('.standby-key').setAttribute('title', esperaTexto);
    $('.standby-key').setAttribute('aria-label', esperaTexto);
  }
  function placeQuickEditor(): void {
    const editor = $('#quick-editor'),
      mobile = isMobile();
    const parent = mobile ? document.body : $('#monitor');
    if (editor.parentElement !== parent) parent.append(editor);
    editor.classList.toggle('mobile-editor', mobile);
  }
  /** Oculta el editor y devuelve el foco a la tecla que lo abrió (accesibilidad de teclado). */
  function hideQuickEditor(restoreFocus = true): void {
    const editor = $('#quick-editor');
    const hadFocus = editor.contains(document.activeElement);
    editor.hidden = true;
    put('#quick-countdown', '');
    put('#quick-announce', '');
    if (restoreFocus && hadFocus && quickOpener?.isConnected) quickOpener.focus({ preventScroll: true });
    quickOpener = null;
  }
  function openQuick(k: SettingsKey, opener: HTMLElement | null = null): void {
    if (ctx.locked) {
      ctx.toast('Desprotege los mandos para modificar ajustes.');
      return;
    }
    if (!ctx.frame) return;
    if (edit.state.kind !== 'idle' && edit.state.key === k) return;
    edit.select(k, performance.now());
    quickOpener = opener ?? $(`[data-setting-quick="${k}"]`);
    collapseHelp();
    const rule = ruleOf(k),
      input = $<HTMLInputElement>('#quick-value'),
      range = $<HTMLInputElement>('#quick-range');
    put('#quick-editor-title', QUICK_LABEL[k]);
    put('#quick-unit', unitText(rule.displayUnit));
    // El deslizador recorre SÓLO valores admitidos (índice sobre la lista de pasos, con Off como primer paso si procede); el campo numérico acepta escritura libre y se valida.
    const vals = gridValues(rule);
    const min = vals[0] ?? 0,
      max = vals[vals.length - 1] ?? 0;
    range.disabled = false;
    range.min = '0';
    range.max = String(vals.length - 1 + (rule.allowOff ? 1 : 0));
    range.step = '1';
    if (k === 'ie') {
      input.type = 'text';
      input.readOnly = true;
    } else {
      input.type = 'number';
      input.readOnly = false;
      input.min = String(rule.allowOff ? 0 : min);
      input.max = String(max);
      input.step = String(Math.min(...rule.domain.map((s) => s.step)));
    }
    const b = $('#quick-help-button');
    b.dataset.helpKey = HELP_KEY[k];
    b.setAttribute('aria-expanded', 'false');
    $('#quick-explanation').innerHTML = helpContent(HELP_KEY[k]) + '<p id="quick-timing" class="help-timing"></p>';
    $('#quick-explanation').hidden = true;
    placeQuickEditor();
    $('#quick-editor').hidden = false;
    renderQuick();
    input.focus({ preventScroll: true });
    if (k !== 'ie') input.select();
  }
  function renderQuick(): void {
    const st = edit.state;
    if (st.kind === 'idle') {
      hideQuickEditor();
      updateQuick();
      return;
    }
    const k = st.key,
      input = $<HTMLInputElement>('#quick-value'),
      range = $<HTMLInputElement>('#quick-range');
    const d = st.draftDisplay;
    const vals = gridValues(ruleOf(k));
    const off = ruleOf(k).allowOff ? 1 : 0;
    const idx = d === 'off' ? 0 : off + vals.findIndex((v) => Math.abs(v - nearestGridValue(ruleOf(k), d)) < 1e-9);
    if (k === 'ie') input.value = d === 'off' ? '' : ieText(d);
    else if (!typing) input.value = d === 'off' ? '' : String(Math.round(d * 1000) / 1000);
    range.value = String(Math.max(0, idx));
    typing = false;
    put('#quick-unit', d === 'off' ? 'Off' : unitText(ruleOf(k).displayUnit));
    const p = edit.preview();
    let msg = joinSentences(p.reasons);
    if (typeof d === 'number' && Number.isNaN(d)) msg = 'Escribe un valor.';
    else if (!p.valid && typeof d === 'number' && k !== 'ie' && !isOnGrid(ruleOf(k), d))
      msg = `${d} no es un valor admitido; el más cercano es ${nearestGridValue(ruleOf(k), d)} ${unitText(ruleOf(k).displayUnit)}.`;
    const warnings = [...((p as { warnings?: string[] }).warnings ?? [])];
    // Pmáx es el techo que termina la inspiración; si Plimit está recortando la presión, subir Pmáx no cambia la Ppico.
    if (k === 'pmax' && ctx.frame?.live.plimitLimited)
      warnings.push(
        `La presión está limitada por Plimit (${ctx.frame.settings.plimit} cmH₂O, ajuste avanzado del menú de modo): subir Pmáx no la eleva.`,
      );
    const v = $('#quick-validation');
    put(v, p.valid ? joinSentences(warnings) : msg);
    v.hidden = p.valid && warnings.length === 0;
    v.classList.toggle('invalid', !p.valid);
    v.classList.toggle('warn', p.valid && warnings.length > 0);
    const t = p.derived;
    put(
      '#quick-timing',
      !p.valid || !t
        ? ''
        : p.candidate?.mode === 'CPAP_PS'
          ? `Con este ajuste: ${textoRespaldo(p.candidate)}`
          : `Con este ajuste: Ti ${f(t.tInspS, 2)} s · Te ${f(t.tExpS, 2)} s · flujo ${f(t.qTargetLps * 60, 1)} L/min`,
    );
    ($('[data-action="confirmEdit"]') as HTMLButtonElement).disabled = !p.valid || !p.changed;
    $('#trim-knob').style.setProperty('--knob-angle', `${knobAngle}deg`);
    updateQuick();
  }
  /**
   * Cuenta atrás visible en los últimos segundos del plazo de edición. El texto visible cambia cada segundo; la región
   * viva para lectores de pantalla se escribe UNA vez al entrar en la ventana (antes leía cada segundo en voz alta).
   */
  function renderCountdown(now: number): void {
    const st = edit.state;
    if (st.kind === 'idle') return;
    const left = ctx.editTimeoutMs - (now - st.at);
    const enVentana = left <= COUNTDOWN_WINDOW_MS;
    put('#quick-countdown', enVentana ? `Se cancela por inactividad en ${Math.max(1, Math.ceil(left / 1000))} s` : '');
    if (!enVentana) put('#quick-announce', '');
    else if (!$('#quick-announce').textContent)
      put('#quick-announce', `Quedan ${Math.max(1, Math.ceil(left / 1000))} s para confirmar o cancelar el ajuste`);
  }
  function stepQuick(dir: 1 | -1): void {
    if (edit.state.kind === 'idle') {
      ctx.toast('Selecciona primero un parámetro de la barra inferior.');
      return;
    }
    edit.adjust(dir, performance.now());
    knobAngle += dir * 12;
    renderQuick();
  }
  function typedQuick(raw: string): void {
    if (edit.state.kind === 'idle' || edit.state.key === 'ie') return;
    typing = true;
    const v = raw.trim() === '' ? NaN : Number(raw);
    const rule = ruleOf(edit.state.key);
    const min = rule.domain[0]?.min ?? 0;
    // «Off» sólo si el usuario lo escribe o marca 0: un valor fuera de rango se rechaza con su motivo, no se convierte
    // en silencio a Off, que es un ajuste clínico muy distinto.
    const pideOff = rule.allowOff && (raw.trim().toLowerCase() === 'off' || v === 0);
    if (pideOff) edit.setDraftDisplay('off', performance.now());
    else edit.setDraftDisplay(Number.isFinite(v) ? v : NaN, performance.now());
    void min;
    renderQuick();
  }
  function slidQuick(i: number): void {
    if (edit.state.kind === 'idle') return;
    const rule = ruleOf(edit.state.key);
    const vals = gridValues(rule);
    const v: number | 'off' = rule.allowOff ? (i === 0 ? 'off' : (vals[i - 1] as number)) : (vals[i] as number);
    edit.setDraftDisplay(v, performance.now());
    renderQuick();
  }
  function confirmQuick(): void {
    if (edit.state.kind === 'idle') return;
    edit.confirm();
    renderQuick();
  }
  function cancelQuick(): void {
    if (edit.state.kind !== 'idle') edit.cancel();
    hideQuickEditor();
    collapseHelp();
    if (ctx.frame) updateQuick();
  }
  edit.on((e) => {
    if (e.type === 'confirmed') {
      void ctx.send({ type: 'confirmSettings', changes: e.changes }).then((r) => {
        if (r.accepted) {
          hideQuickEditor();
          if ('peep' in e.changes) ctx.lesson.flags.peepChangedMs = ctx.frame?.simTimeMs ?? 0;
          if ('plimit' in e.changes) ctx.lesson.flags.plimitChanged = true;
          ctx.lesson.noteSettingsChange();
          ctx.toast('Ajuste confirmado. Se aplica en la próxima respiración.');
        }
      });
    }
    if (e.type === 'rejected') ctx.toast(joinSentences(e.reasons), true);
    if (e.type === 'cancelled') {
      hideQuickEditor();
      if (e.reason === 'timeout') ctx.toast('El ajuste se canceló por inactividad. El valor anterior se mantiene.', true);
      if (ctx.frame) updateQuick();
    }
  });
  return {
    edit,
    updateQuick,
    openQuick,
    renderQuick,
    renderCountdown,
    stepQuick,
    typedQuick,
    slidQuick,
    confirmQuick,
    cancelQuick,
    placeQuickEditor,
  };
}
