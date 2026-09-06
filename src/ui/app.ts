/**
 * Interfaz de R860 Lab sobre el motor determinista de este proyecto.
 * Estructura de interacción derivada de «R860 Lab» v1.1 (src/app.js, MIT 2026) y reescrita en TypeScript:
 * la UI sólo envía comandos tipados; los borradores viven en EditController; requestAnimationFrame sólo dibuja.
 * Las piezas puras viven aparte: metricsTable (mediciones), lesson (objetivos), exports (CSV/PNG/JSON), dialogs (plantillas).
 */
import { EngineClient } from '../app/engineClient';
import type { Discontinuity } from '../app/protocol';
import { EditController } from '../app/uiState';
import type { Command } from '../domain/commands';
import type { SettingRule } from '../domain/settingRules';
import type { AlarmLimits, AlarmState, SettingsKey, VcSettings, VentMode } from '../domain/types';
import { gridValues, isOnGrid, nearestGridValue, validateDomains, validateVcSettings, deriveVcTiming } from '../domain/validation';
import { defaultInit, type EngineFrame, type SimulatorInit } from '../engine/simulator';
import { ENGINE_VERSION } from '../engine/version';
import { frameFromFixture, PHOTO_FIXTURES } from '../fixtures/photoFixtures';
import { PROFILE } from '../profiles/r860-es-photo-reference/profile';
import {
  ALARM_LIMIT_RULES,
  EXP_HOLD_RULE,
  INSP_HOLD_RULE,
  VC_ADULT_CROSS_LIMITS,
  VC_ADULT_RULES,
} from '../profiles/r860-es-photo-reference/settings';
import { cyclePoints, drawGauge, drawLoop, drawMuscle, drawTrends, drawWave, format as f, type Point } from '../render/plots';
import { findScenario, SCENARIOS, type Scenario } from '../scenarios';
import { AlarmAudio } from './audio';
import {
  debriefHTML,
  debriefText,
  helpHTML,
  menuHTML,
  oxygenHTML,
  patientHTML,
  powerHTML,
  scenariosHTML,
  sessionHTML,
  standbyHTML,
  toolsHTML,
} from './dialogs';
import { $, $$, btn, esc, icon, put, trapTab } from './dom';
import {
  csvBlob,
  downloadBlob,
  paintSnapshot,
  sessionBlob,
  signalRows,
  SIGNAL_HEADER,
  textBlob,
  TRENDS_HEADER,
  trendsRows,
} from './exports';
import { clock, ieText, stamp, unitText, wallDate } from './format';
import { HELP, type HelpEntry } from './help';
import { CHANNEL, eventSentence, humanReason, joinSentences, learnerText, PRIORITY } from './humanize';
import { nextCompletedTask } from './lesson';
import {
  ALL_METRICS,
  BIG_METRICS,
  limitPair,
  METRIC_HELP,
  METRICS,
  metricInAlarm,
  metricQuality as metricQualityOf,
  metricValue as metricValueOf,
  type MetricSpec,
} from './metricsTable';
import { FAULTS, PATIENT_EXTRA, PATIENT_MAIN, PHYS, physHtml, type PhysSpec } from './patientControls';

type ViewId = 'waves' | 'basic' | 'loops' | 'data' | 'trends' | 'log';
const VIEWS: ViewId[] = ['waves', 'basic', 'loops', 'data', 'trends', 'log'];
const QUICK_KEYS_BY_MODE: Record<VentMode, SettingsKey[]> = {
  AC_VC: ['fio2', 'vt', 'rr', 'ie', 'peep', 'pmax'],
  AC_PC: ['fio2', 'pinsp', 'rr', 'ie', 'peep', 'pmax'],
};
const MODE_LABEL: Record<VentMode, string> = { AC_VC: 'A/C VC', AC_PC: 'A/C PC' };
const modeLabel = (m: string): string => MODE_LABEL[m as VentMode] ?? m;
const QUICK_LABEL: Record<SettingsKey, string> = {
  fio2: 'FiO₂',
  vt: 'Volumen tidal',
  rr: 'Frecuencia',
  ie: 'I:E',
  peep: 'PEEP',
  pmax: 'Pmáx',
  plimit: 'Plimit',
  pausePct: 'Pausa inspiratoria',
  assistControl: 'Disparo asistido',
  flowTrigger: 'Disparo por flujo',
  biasFlow: 'Flujo de base',
  triggerByPressure: 'Disparo por presión (en vez de flujo)',
  pressureTrigger: 'Umbral de presión',
  pinsp: 'Pinsp',
  riseMs: 'Rampa',
};
const HELP_KEY: Record<SettingsKey, string> = {
  fio2: 'setting.fio2',
  vt: 'setting.vt',
  rr: 'setting.rr',
  ie: 'setting.ie',
  peep: 'setting.peep',
  pmax: 'setting.pmax',
  plimit: 'setting.plimit',
  pausePct: 'setting.pause',
  assistControl: 'setting.assist',
  flowTrigger: 'setting.trigger',
  biasFlow: 'setting.biasFlow',
  triggerByPressure: 'setting.triggerType',
  pressureTrigger: 'setting.triggerPressure',
  pinsp: 'setting.pinsp',
  riseMs: 'setting.rise',
};
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
const PHASE_TEXT: Record<string, string> = {
  inspFlow: 'Inspiración',
  inspLimited: 'Inspiración · Plimit',
  inspPause: 'Pausa inspiratoria',
  inspPressure: 'Inspiración · presión',
  exp: 'Espiración',
  holdInsp: 'Bloqueo inspiratorio',
  holdExp: 'Bloqueo espiratorio',
  standby: 'En espera',
};
const EVENT_KIND: Record<string, string> = {
  setting: 'ajuste',
  alarm: 'alarma',
  procedure: 'maniobra',
  breath: 'ciclo',
  state: 'estado',
  scenario: 'escenario',
  pause: 'reloj',
  audio: 'audio',
  discontinuity: 'reloj',
  rejected: 'rechazo',
  mode: 'modo',
};
/** Plazo para recibir el primer cuadro del motor antes de avisar (ms). */
const FIRST_FRAME_TIMEOUT_MS = 5000;
/** Últimos segundos del plazo de edición en los que se muestra la cuenta atrás. */
const COUNTDOWN_WINDOW_MS = 10_000;
const isMobile = (): boolean => window.matchMedia('(max-width:700px)').matches;

export interface AppOptions {
  params: URLSearchParams;
}

export function startApp(opts: AppOptions): void {
  const params = opts.params;
  const client = new EngineClient({ forceInline: params.get('inline') === '1' });
  const audio = new AlarmAudio();
  let frame: EngineFrame | null = null;
  let running = true,
    speed = 1,
    pauseReason: string | null = null,
    discontinuities: Discontinuity[] = [];
  let points: Point[] = [],
    view: ViewId = 'waves',
    waveWindow = 12,
    waveStyle: 'sweep' | 'scroll' = 'sweep';
  let frozen = false,
    frozenPoints: Point[] = [],
    freezeEnd = 0,
    reviewEnd = 0,
    cursorTime: number | null = null,
    loopReference: Point[] | null = null;
  let locked = false,
    teacherVisible = params.get('instructor') !== '0',
    holdType: 'inspHold' | 'expHold' = 'inspHold',
    dialogKind = '';
  let scenario: Scenario = findScenario(params.get('scenario') ?? 'SC-01') ?? (SCENARIOS[0] as Scenario);
  let fixtureId: 'P1' | 'P3' | null = null;
  const lessonDone = new Set<string>();
  const flags: Record<string, unknown> = {};
  let lessonStartMs = 0,
    patientChangeMs = -1,
    settingsChangeMs = -1;
  const eventUndo: Command[][] = [];
  let apneaApplied = false;
  let dirty = true,
    lastPlot = 0,
    knobAngle = 0,
    logSignature = '',
    alarmSignature = '',
    lastQuickSig = '';
  let modeDraft: VcSettings | null = null;
  let limitsDraft: AlarmLimits | null = null;
  const editTimeoutMs = params.get('editTimeout') ? Number(params.get('editTimeout')) : PROFILE.editTimeoutMs;
  const edit = new EditController(
    VC_ADULT_RULES,
    VC_ADULT_CROSS_LIMITS,
    () => (frame ? { ...frame.settings, ...(frame.pending ?? {}) } : defaultInit().settings),
    editTimeoutMs,
  );
  /** Tecla rápida que abrió el editor: recibe el foco al confirmar o cancelar. */
  let quickOpener: HTMLElement | null = null;

  // ---------- utilidades ----------
  function toast(message: string, warn = false): void {
    const e = document.createElement('div');
    e.className = 'toast' + (warn ? ' warn' : '');
    e.textContent = learnerText(message);
    const stack = $('#toast-stack');
    stack.append(e);
    while (stack.children.length > 2) stack.firstElementChild?.remove();
    setTimeout(() => e.remove(), 4200);
  }
  function notice(message: string): void {
    put('#global-notice', message);
    $('#global-notice').hidden = false;
  }
  /** Aviso persistente sobre el estado del motor (sin Worker o sin arrancar). */
  function engineBanner(message: string | null): void {
    const b = $('#engine-banner');
    b.hidden = !message;
    put(b, message ?? '');
  }
  function versionTag(): void {
    const how = client.mode === 'worker' ? 'Worker' : client.degradedReason ? 'en página (sin Worker)' : 'en página';
    put('#version-tag', `v${ENGINE_VERSION} · Offline · ${how}`);
  }
  async function send(cmd: Command, actor: 'learner' | 'instructor' = 'learner'): Promise<{ accepted: boolean; reason?: string }> {
    const r = await client.command(cmd, actor);
    if (!r.accepted) toast(r.reason ?? 'No se pudo aplicar.', true);
    return r;
  }
  const simS = (): number => (frame?.simTimeMs ?? 0) / 1000;
  const helpEntry = (key: string): HelpEntry | null => HELP[key] ?? null;
  function helpContent(key: string): string {
    const h = helpEntry(key);
    if (!h) return '';
    return `<h3>${esc(h.title)}</h3>${h.text.map((t) => `<p>${esc(t)}</p>`).join('')}${h.equation ? `<div class="help-equation">${esc(h.equation)}</div>` : ''}`;
  }
  function infoButton(key: string, id: string): string {
    const h = helpEntry(key);
    return `<button type="button" class="info-button" data-help-key="${esc(key)}" data-help-target="${esc(id)}" aria-controls="${esc(id)}" aria-expanded="false" aria-label="Información sobre ${esc(h?.title ?? key)}" title="Información">${icon('info')}</button>`;
  }
  const infoPanel = (key: string, id: string): string => `<div id="${esc(id)}" class="parameter-help" hidden>${helpContent(key)}</div>`;
  function collapseHelp(): boolean {
    let any = false;
    for (const b of $$('[data-help-target][aria-expanded="true"]')) {
      const panel = document.getElementById(b.dataset.helpTarget as string);
      if (panel) panel.hidden = true;
      b.setAttribute('aria-expanded', 'false');
      any = true;
    }
    return any;
  }
  function toggleHelp(button: HTMLElement): void {
    const panel = document.getElementById(button.dataset.helpTarget as string);
    if (!panel) return;
    const show = panel.hidden;
    collapseHelp();
    panel.hidden = !show;
    button.setAttribute('aria-expanded', String(show));
  }

  // ---------- valores ----------
  const ruleOf = (k: SettingsKey): SettingRule => VC_ADULT_RULES[k];
  function displaySetting(k: SettingsKey, v: VcSettings[SettingsKey]): string {
    if (v === 'off') return 'Off';
    if (typeof v === 'boolean') return v ? 'On' : 'Off';
    if (k === 'ie') return ieText(v as number);
    return ((v as number) * ruleOf(k).displayFactor).toFixed(ruleOf(k).decimals);
  }
  const metricValue = (spec: MetricSpec): number | null => metricValueOf(frame, spec);
  const metricQuality = (spec: MetricSpec): string => metricQualityOf(frame, spec);

  // ---------- DOM inicial ----------
  function initDOM(): void {
    // Casillas numéricas: un solo punto de entrada por Tab (tabindex itinerante); las flechas recorren las demás.
    $('#numeric-grid').innerHTML = METRICS.map(
      (m, i) =>
        `<button class="numeric" data-metric="${m.key}" tabindex="${i === 0 ? 0 : -1}" title="${m.label}: información y medición" aria-label="${m.label}. Información y medición"><span class="numeric-label">${m.label}<span class="numeric-info" aria-hidden="true">${icon('info')}</span></span><strong class="numeric-value">—</strong><span class="numeric-unit">${m.unit}</span><span class="numeric-limits"></span><span class="numeric-age"></span></button>`,
    ).join('');
    $('#big-metrics').innerHTML = BIG_METRICS.map(
      ([k, l, u], i) =>
        `<button class="big-numeric" data-metric="${k}" tabindex="${i === 0 ? 0 : -1}"><span>${l}<span class="numeric-info" aria-hidden="true">${icon('info')}</span></span><b>—</b><em>${u}</em><span class="numeric-limits"></span></button>`,
    ).join('');
    $('#patient-controls').innerHTML = physHtml(PATIENT_MAIN, infoButton, infoPanel);
    $('#patient-extra-controls').innerHTML =
      physHtml(PATIENT_EXTRA, infoButton, infoPanel) +
      `<p class="settings-annotation">Fuga en Y, desconexión y compensaciones: no modeladas en esta etapa.</p>`;
    $('#fault-grid').innerHTML = FAULTS.map(
      ([id, i, l, d, off]) =>
        `<button data-event="${id}" id="event-${id}" ${off ? 'disabled' : ''}>${icon(i)}<b>${l}</b><small>${d}</small></button>`,
    ).join('');
    for (const b of $$('[data-help-key]')) {
      const panel = document.getElementById(b.dataset.helpTarget as string);
      if (panel && !panel.innerHTML.trim()) panel.innerHTML = helpContent(b.dataset.helpKey as string);
    }
    const resize = (): void => {
      const e = $('#screen-window');
      $('#monitor').style.transform = `scale(${e.clientWidth / 1120})`;
      dirty = true;
    };
    new ResizeObserver(resize).observe($('#screen-window'));
    resize();
    $('#workspace').classList.toggle('teacher-hidden', !teacherVisible);
    $('#teacher-toggle').innerHTML = icon('eye') + `<span>${teacherVisible ? 'Ocultar' : 'Mostrar'} panel docente</span>`;
    versionTag();
    put('#instructor-footer-text', '');
    $('#instructor-footer-text').innerHTML =
      `${SCENARIOS.length} escenarios · A/C VC adulto<br><b>Modelo mecánico, no paciente completo</b>`;
  }

  // ---------- lecciones ----------
  function lessonReset(): void {
    lessonDone.clear();
    for (const k of Object.keys(flags)) delete flags[k];
    lessonStartMs = frame?.simTimeMs ?? 0;
    patientChangeMs = -1;
    settingsChangeMs = -1;
    renderLesson();
  }
  function renderLesson(): void {
    const l = scenario.lesson;
    put('#lesson-title', l?.title ?? scenario.name);
    put('#lesson-text', l?.text ?? scenario.description);
    put('#reflection-question', scenario.question ?? '¿Qué observar?');
    put('#reflection-answer', scenario.answer ?? scenario.observe);
    const tasks = l?.tasks ?? [];
    put('#lesson-count', `${lessonDone.size} de ${tasks.length} objetivos`);
    $('#lesson-tasks').innerHTML = tasks
      .map(
        (task, i) =>
          `<div class="task ${lessonDone.has(task.id) ? 'complete' : ''}"><span class="task-check">${lessonDone.has(task.id) ? icon('check') : i + 1}</span><span>${esc(task.text)}</span></div>`,
      )
      .join('');
    $('#lesson-feedback').hidden = tasks.length === 0 || lessonDone.size !== tasks.length;
  }
  function evaluateLesson(): void {
    if (!frame || !scenario.lesson || fixtureId) return;
    const task = nextCompletedTask(scenario.lesson.tasks, lessonDone, {
      frame,
      scenarioId: scenario.id,
      lessonStartMs,
      patientChangeMs,
      settingsChangeMs,
      flags,
    });
    if (!task) return;
    lessonDone.add(task.id);
    renderLesson();
    toast(`Objetivo realizado: ${task.text}`);
  }

  // ---------- teclas rápidas ----------
  function updateQuick(): void {
    const fr = frame as EngineFrame;
    const QUICK_KEYS = QUICK_KEYS_BY_MODE[fr.settings.mode];
    if (lastQuickSig !== fr.settings.mode) {
      lastQuickSig = fr.settings.mode;
      $('#quick-controls').innerHTML =
        `<button class="device-key quick-key mode-key" data-action="modes"><small>Modo actual</small><b id="quick-mode">${MODE_LABEL[fr.settings.mode]}</b></button>` +
        QUICK_KEYS.map(
          (k) =>
            `<button class="device-key quick-key" data-setting-quick="${k}" data-key="${k}" aria-pressed="false"><small>${QUICK_LABEL[k]}</small><b data-quick-val="${k}"></b><em>${k === 'ie' ? '' : unitText(ruleOf(k).displayUnit)}</em></button>`,
        ).join('') +
        `<button class="device-key quick-key standby-key" data-action="standby"><small>EN ESPERA</small>${icon('hand')}</button><button class="device-key quick-key power-key" data-action="powerInfo" aria-label="Estado de alimentación virtual">${icon('plug')}</button>`;
    }
    const st = edit.state;
    for (const k of QUICK_KEYS) {
      const b = $(`[data-setting-quick="${k}"]`);
      const sel = st.kind !== 'idle' && st.key === k;
      put(
        `[data-quick-val="${k}"]`,
        sel && st.kind === 'editing'
          ? st.draftDisplay === 'off'
            ? 'Off'
            : k === 'ie'
              ? ieText(st.draftDisplay)
              : st.draftDisplay.toFixed(ruleOf(k).decimals)
          : displaySetting(k, fr.settings[k]),
      );
      b.classList.toggle('editing', sel);
      b.setAttribute('aria-pressed', String(sel));
      b.classList.toggle('pending', !!fr.pending && k in fr.pending);
    }
    $('#pending-ribbon').hidden = !fr.pending;
    $('#standby-overlay').hidden = fr.ventilation !== 'standby';
    $('.standby-key').classList.toggle('active-standby', fr.ventilation === 'standby');
  }

  // ---------- editor rápido ----------
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
    if (restoreFocus && hadFocus && quickOpener?.isConnected) quickOpener.focus({ preventScroll: true });
    quickOpener = null;
  }
  function openQuick(k: SettingsKey, opener: HTMLElement | null = null): void {
    if (locked) {
      toast('Desbloquea los controles para modificar ajustes.');
      return;
    }
    if (!frame) return;
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
  let typing = false;
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
    const warnings = (p as { warnings?: string[] }).warnings ?? [];
    const v = $('#quick-validation');
    put(v, p.valid ? joinSentences(warnings) : msg);
    v.hidden = p.valid && warnings.length === 0;
    v.classList.toggle('invalid', !p.valid);
    v.classList.toggle('warn', p.valid && warnings.length > 0);
    const t = p.derived;
    put(
      '#quick-timing',
      p.valid && t ? `Con este ajuste: Ti ${f(t.tInspS, 2)} s · Te ${f(t.tExpS, 2)} s · flujo ${f(t.qTargetLps * 60, 1)} L/min` : '',
    );
    ($('[data-action="confirmEdit"]') as HTMLButtonElement).disabled = !p.valid || !p.changed;
    $('#trim-knob').style.setProperty('--knob-angle', `${knobAngle}deg`);
    updateQuick();
  }
  /** Cuenta atrás visible en los últimos segundos del plazo de edición. */
  function renderCountdown(now: number): void {
    const st = edit.state;
    if (st.kind === 'idle') return;
    const left = editTimeoutMs - (now - st.at);
    put('#quick-countdown', left <= COUNTDOWN_WINDOW_MS ? `Se cancela por inactividad en ${Math.max(1, Math.ceil(left / 1000))} s` : '');
  }
  function stepQuick(dir: 1 | -1): void {
    if (edit.state.kind === 'idle') {
      toast('Selecciona primero un parámetro de la barra inferior.');
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
    if (rule.allowOff && (v < min || raw.trim().toLowerCase() === 'off')) edit.setDraftDisplay('off', performance.now());
    else edit.setDraftDisplay(Number.isFinite(v) ? v : NaN, performance.now());
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
    if (frame) updateQuick();
  }
  edit.on((e) => {
    if (e.type === 'confirmed') {
      void send({ type: 'confirmSettings', changes: e.changes }).then((r) => {
        if (r.accepted) {
          hideQuickEditor();
          if ('peep' in e.changes) flags.peepChanged = true;
          if ('plimit' in e.changes) flags.plimitChanged = true;
          settingsChangeMs = frame?.simTimeMs ?? 0;
          toast('Ajuste confirmado. Se aplica en la próxima respiración.');
        }
      });
    }
    if (e.type === 'rejected') toast(joinSentences(e.reasons), true);
    if (e.type === 'cancelled') {
      hideQuickEditor();
      if (e.reason === 'timeout') toast('El ajuste se canceló por inactividad. El valor anterior se mantiene.', true);
      if (frame) updateQuick();
    }
  });

  // ---------- bloqueos ----------
  const holdRule = (kind: 'inspHold' | 'expHold'): SettingRule => (kind === 'inspHold' ? INSP_HOLD_RULE : EXP_HOLD_RULE);
  let lastHoldToastId: string | null = null;
  let holdOpenedAtMs = 0;
  /** Solicitud en vuelo: ▶ es idempotente mientras se espera la respuesta del motor. */
  let holdRequestInFlight = false;
  function placeHoldPanel(): void {
    const panel = $('#hold-panel'),
      mobile = isMobile();
    const parent = mobile ? document.body : $('.monitor-body');
    if (panel.parentElement !== parent) parent.append(panel);
    panel.classList.toggle('mobile-hold', mobile);
    document.body.classList.toggle('hold-open', !panel.hidden && mobile);
  }
  function openHold(kind: 'inspHold' | 'expHold'): void {
    const fr = frame;
    const active = fr?.procedure.hold;
    holdType = active ? active.kind : kind;
    if (edit.state.kind !== 'idle') {
      cancelQuick();
      toast('Ajuste cancelado al abrir el bloqueo. El valor anterior se mantiene.', true);
    }
    holdOpenedAtMs = fr?.simTimeMs ?? 0;
    lastHoldToastId = fr?.procedure.last[holdType]?.procedureId ?? null;
    const sel = $<HTMLSelectElement>('#hold-duration');
    const cur = sel.value;
    sel.innerHTML = gridValues(holdRule(holdType))
      .map((v) => `<option value="${v}" ${v === (Number(cur) || 3) ? 'selected' : ''}>${v} s</option>`)
      .join('');
    $('#hold-panel').hidden = false;
    placeHoldPanel();
    updateHold();
    closeDialog();
  }
  function closeHoldPanel(): void {
    $('#hold-panel').hidden = true;
    document.body.classList.remove('hold-open');
  }
  function updateHold(): void {
    const fr = frame;
    if ($('#hold-panel').hidden || !fr) return;
    const active = fr.procedure.hold;
    if (active) holdType = active.kind;
    const insp = holdType === 'inspHold',
      key = insp ? 'procedure.inspiratory' : 'procedure.expiratory';
    put('#hold-title', `Bloqueo ${insp ? 'inspiratorio' : 'espiratorio'}`);
    put('#hold-value-label', insp ? 'Pplat' : 'PEEP total');
    put('#hold-second-label', insp ? 'Cstat' : 'PEEPi');
    put('#hold-second-unit', insp ? 'mL/cmH₂O' : 'cmH₂O');
    const helpBtn = $('#hold-help-button');
    if (helpBtn.dataset.helpKey !== key) {
      helpBtn.dataset.helpKey = key;
      $('#hold-help').innerHTML = helpContent(key);
      $('#hold-help').hidden = true;
      helpBtn.setAttribute('aria-expanded', 'false');
    }
    const h = !active ? fr.procedure.last[holdType] : null;
    const v1 = insp ? h?.values.pplat : h?.values.peepTot,
      v2 = insp ? h?.values.cstat : h?.values.peepi;
    put('#hold-value', h?.quality === 'valid' && v1?.value != null ? f(v1.value, 0) : '—');
    put('#hold-second', h?.quality === 'valid' && v2?.value != null ? f(insp ? v2.value * 1000 : v2.value, insp ? 0 : 1) : '—');
    // ▶ sólo inicia; mientras hay una solicitud en cola o en curso queda deshabilitado y aparece «Cancelar».
    const run = $<HTMLButtonElement>('#hold-run');
    const busy = !!active || holdRequestInFlight;
    const lbl = active
      ? active.phase === 'queued'
        ? 'Solicitud en cola'
        : 'Bloqueo en curso'
      : !running
        ? 'Reanudar e iniciar bloqueo'
        : 'Iniciar bloqueo';
    run.setAttribute('aria-label', lbl);
    run.title = lbl;
    run.disabled = busy;
    run.setAttribute('aria-disabled', String(busy));
    const cancel = $<HTMLButtonElement>('#hold-cancel');
    cancel.hidden = !active;
    put(cancel.querySelector('span'), active?.phase === 'queued' ? 'Cancelar solicitud' : 'Cancelar bloqueo');
    ($('#hold-duration') as HTMLSelectElement).disabled = !!active;
    let text = !running ? 'Pulsa iniciar para reanudar y medir.' : 'Selecciona tiempo y pulsa iniciar.';
    if (active?.phase === 'running')
      text = `${!running ? 'Pausado · ' : 'Oclusión · '}${f(active.durationS - active.elapsedS, 1)} s restantes`;
    else if (active?.phase === 'queued')
      text = `Esperando fin de ${insp ? 'inspiración' : 'espiración'}${!running ? ' · simulación pausada' : ''}`;
    else if (h)
      text =
        h.quality === 'valid'
          ? `Medido · ${wallDate(h.wallTimeMs ?? 0)}`
          : `No válida: ${humanReason(h.reason)} · ${wallDate(h.wallTimeMs ?? 0)}`;
    if (h && h.procedureId !== lastHoldToastId && (h.completedAtMs ?? 0) > holdOpenedAtMs) {
      lastHoldToastId = h.procedureId;
      toast(
        h.quality === 'valid'
          ? `Bloqueo medido: ${insp ? 'Pplat' : 'PEEP total'} ${f(v1?.value ?? null, 0)} cmH₂O`
          : `Bloqueo no válido: ${humanReason(h.reason)}`,
        h.quality !== 'valid',
      );
    }
    put('#hold-status', learnerText(text));
    $('#hold-status').classList.toggle('invalid', !!h && h.quality !== 'valid');
    $('#hold-panel').classList.toggle('is-occluding', active?.phase === 'running');
    $('#hold-panel').dataset.phase = active?.phase === 'running' ? 'occluding' : active ? 'waiting' : h ? 'measured' : 'ready';
  }
  async function runHold(): Promise<void> {
    // Idempotente: repeticiones mientras hay solicitud en vuelo, en cola o en curso se ignoran (no cancelan).
    if (holdRequestInFlight || frame?.procedure.hold) return;
    holdRequestInFlight = true;
    updateHold();
    try {
      const r = await send({
        type: 'requestHold',
        kind: holdType,
        durationS: Number(($('#hold-duration') as HTMLSelectElement).value),
      });
      if (r.accepted) {
        if (frozen) toggleFreeze();
        if (!['waves', 'basic'].includes(view)) switchView('waves');
        if (!running) client.resume();
        collapseHelp();
      }
    } finally {
      holdRequestInFlight = false;
      updateHold();
    }
  }
  async function cancelHold(): Promise<void> {
    const active = frame?.procedure.hold;
    if (!active) return;
    const r = await send({ type: 'cancelProcedure' });
    if (r.accepted) toast(active.phase === 'queued' ? 'Solicitud de bloqueo cancelada.' : 'Bloqueo cancelado.');
  }

  // ---------- métricas / alarmas / docente / registro ----------
  function updateMetrics(): void {
    const fr = frame as EngineFrame;
    for (const m of METRICS) {
      const el = $(`#numeric-grid [data-metric="${m.key}"]`);
      put(el.querySelector('.numeric-value'), f(metricValue(m), m.decimals));
      put(el.querySelector('.numeric-limits'), limitPair(fr, m.key));
      el.classList.toggle('alarm-value', metricInAlarm(fr, m.key));
      const h = fr.procedure.last.inspHold;
      put(
        el.querySelector('.numeric-age'),
        m.source === 'hold' && h && h.quality === 'valid' ? `Med. ${clock((h.completedAtMs ?? 0) / 1000)}` : '',
      );
    }
    for (const e of $$('#big-metrics [data-metric]')) {
      const spec = METRICS.find((m) => m.key === e.dataset.metric) as MetricSpec;
      put(e.querySelector('b'), f(metricValue(spec), spec.decimals));
      put(e.querySelector('.numeric-limits'), limitPair(fr, spec.key));
    }
    if (view === 'data')
      $('#data-table-body').innerHTML = ALL_METRICS.map(
        (m) =>
          `<tr><td><button class="metric-name" data-metric="${m.key}">${m.label}${icon('info')}</button></td><td>${f(metricValue(m), m.decimals)}</td><td>${m.unit}</td><td>${esc(metricQuality(m))}</td></tr>`,
      ).join('');
  }
  function alarmHTML(): string {
    const fr = frame as EngineFrame;
    const active = fr.alarms.filter((a) => a.conditionActive),
      pending = fr.alarms.filter((a) => !a.conditionActive && a.latching && a.resolvedAtMs !== null && a.acknowledgedAtMs === null);
    const row = (a: AlarmState): string =>
      `<div class="alarm-row ${a.conditionActive ? (a.priority === 'high' ? 'high' : 'medium') : 'resolved'}"><span class="alarm-priority">${icon(a.conditionActive ? 'bell' : 'check')}</span><div><b>${esc(learnerText(a.message))}</b><p>${esc(CHANNEL[a.source] ?? a.source)}${a.rawValueAtOnset !== null ? ` · valor al inicio ${f(a.rawValueAtOnset, 1)}` : ''}${a.threshold !== null ? ` · umbral ${f(a.threshold, 1)}` : ''}</p><small>${a.conditionActive ? 'ACTIVA' : 'RESUELTA · PENDIENTE DE RECONOCER'} · ${clock((a.onsetAtMs ?? 0) / 1000)}${a.acknowledgedAtMs !== null ? ' · reconocida' : ''} · prioridad ${PRIORITY[a.priority] ?? a.priority}</small></div></div>`;
    const items = [...active, ...pending];
    return items.length
      ? items.map(row).join('')
      : '<p class="empty-note">No hay alarmas activas ni eventos pendientes de reconocimiento.</p>';
  }
  /** Segunda línea de la banda: cuenta de activas y, si ya se reconocieron, lo dice sin ocultar que la condición sigue. */
  function alarmDetailText(fr: EngineFrame): string {
    const bar = fr.alarmBar;
    const audioTxt = audio.enabled ? 'audio habilitado' : 'audio apagado';
    if (fr.ventilation === 'standby') return 'En espera';
    if (bar.activeCount) {
      const acked = fr.alarms.filter((a) => a.conditionActive && a.acknowledgedAtMs !== null).length;
      const n = bar.activeCount;
      if (acked === n)
        return `${n} reconocida${n === 1 ? '' : 's'} · ${n === 1 ? 'condición sigue activa' : 'condiciones siguen activas'} · ${audioTxt}`;
      const ack = acked ? ` · ${acked} reconocida${acked === 1 ? '' : 's'}` : '';
      return `${n} activa${n === 1 ? '' : 's'}${ack} · ${audioTxt}`;
    }
    if (bar.pendingAckCount) return 'Reconocer eventos anteriores';
    return `${audioTxt[0]!.toUpperCase() + audioTxt.slice(1)} · Simulación`;
  }
  function updateAlarm(): void {
    const fr = frame as EngineFrame;
    const bar = fr.alarmBar;
    const lev = bar.color === 'red' ? 'high' : bar.color === 'yellow' ? 'medium' : bar.color === 'grey' ? 'previous' : '';
    $('#alarm-band').className = 'alarm-band ' + lev;
    $('#bezel-light').className = 'bezel-light ' + (lev === 'previous' ? '' : lev);
    put('#alarm-label', bar.color === 'grey' ? 'Alarmas resueltas' : learnerText(bar.message));
    put('#alarm-detail', alarmDetailText(fr));
    const muteLeft = fr.audioPauseUntilMs !== null ? fr.audioPauseUntilMs - fr.simTimeMs : 0;
    put('#mute-time', muteLeft > 0 ? clock(Math.ceil(muteLeft / 1000)) : '');
    if (bar.activeCount) flags.alarmSeen = flags.alarmSeen || dialogKind === 'alarms';
    const sig = JSON.stringify(fr.alarms.map((a) => [a.id, a.conditionActive, a.acknowledgedAtMs]));
    if (dialogKind === 'alarms' && sig !== alarmSignature) {
      alarmSignature = sig;
      const el = document.getElementById('live-alarms');
      if (el) el.innerHTML = alarmHTML();
    }
    audio.pausedUntilMs = fr.audioPauseUntilMs;
    const top = fr.alarms.filter((a) => a.conditionActive).sort((a, b) => (a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0))[0];
    if (running) audio.drive(top ? top.priority : null, fr.simTimeMs);
  }
  function updateTeacher(): void {
    const fr = frame as EngineFrame;
    for (const [k, sp] of Object.entries(PHYS)) {
      const n = $<HTMLInputElement>(`[data-phys-number="${k}"]`),
        r = $<HTMLInputElement>(`[data-phys-range="${k}"]`);
      const v = sp.get(fr);
      if (document.activeElement !== n && document.activeElement !== r) {
        n.value = String(Math.round(v * 100) / 100);
        r.value = String(v);
      }
      r.style.setProperty('--fill', `${(100 * (Number(r.value) - sp.min)) / (sp.max - sp.min)}%`);
    }
    const p = fr.truth.patient;
    put('#truth-tau', `${f(p.rExp * p.crs, 2)} s`);
    put('#truth-auto', `${f(fr.truth.peepiEndExp, 1)} cmH₂O`);
    put('#truth-vabs', `${f(fr.truth.vAbsL * 1000, 0)} mL`);
    put('#truth-o2', `${f(fr.truth.fio2Delivered * 100, 0)} / ${f((fr.metrics.fio2?.value ?? 0) * 100, 1)} %`);
    put('#muscle-value', `${f(fr.truth.pmus, 1)} cmH₂O`);
    for (const [id, on] of [
      ['apnea', apneaApplied && (!fr.truth.effort.enabled || fr.truth.effort.amplitude === 0)],
      ['obstruction', fr.truth.patient.rInsp >= 300],
    ] as [string, boolean][]) {
      const e = document.getElementById(`event-${id}`);
      e?.classList.toggle('active', on);
      e?.setAttribute('aria-pressed', String(on));
    }
    ($('#undo-event') as HTMLButtonElement).disabled = eventUndo.length === 0;
  }
  function updateLogs(): void {
    const fr = frame as EngineFrame;
    const last = fr.eventsTail[fr.eventsTail.length - 1];
    const sig = `${fr.eventsTail.length}:${last?.sequence}`;
    if (sig === logSignature) return;
    logSignature = sig;
    const events = [...fr.eventsTail].reverse();
    $('#device-event-log').innerHTML = events
      .map(
        (e) =>
          `<div class="event-log-row ${e.kind === 'alarm' ? 'alert-event' : ''}"><time>${clock(e.simTimeMs / 1000)}</time><span>${esc(EVENT_KIND[e.kind] ?? e.kind)}</span><span>${esc(learnerText(eventSentence(e)))}</span></div>`,
      )
      .join('');
    put('#log-count', `${events.length} eventos visibles`);
    $('#teacher-log').innerHTML = events
      .filter((e) => e.kind !== 'breath')
      .slice(0, 8)
      .map(
        (e) =>
          `<div class="teacher-event"><time>${clock(e.simTimeMs / 1000)}</time><span>${esc(learnerText(eventSentence(e)))}</span></div>`,
      )
      .join('');
  }
  function updateUI(): void {
    const fr = frame;
    if (!fr) return;
    put('#scenario-name', fixtureId ? `Referencia fotográfica ${fixtureId} (transcripción, sin motor)` : scenario.name);
    put('#scenario-sub', `Adulto virtual · ${MODE_LABEL[fr.settings.mode]}${fr.pending ? ' · ajustes pendientes' : ''}`);
    put(
      '#phase-status',
      !running
        ? `SIMULACIÓN PAUSADA${pauseReason ? ' · ' + pauseReason : ''}`
        : fr.ventilation === 'standby'
          ? 'En espera'
          : (PHASE_TEXT[fr.live.phase] ?? fr.live.phase),
    );
    put('#monitor-clock', wallDate(fr.wallTimeMs).slice(-8, -3));
    put(
      '#simulation-clock',
      `Sesión ${clock(fr.simTimeMs / 1000)} · ${speed}×${!running ? ' · pausada' : ''}${discontinuities.length ? ` · ${discontinuities.length} discontinuidad(es)` : ''}`,
    );
    $('#live-dot').classList.toggle('paused', !running);
    $('#sim-pause').innerHTML = icon(running ? 'pause' : 'play') + `<span>${running ? 'Pausar' : 'Reanudar'}</span>`;
    $('#sim-pause').setAttribute('aria-label', running ? 'Pausar simulación' : 'Reanudar simulación');
    ($('#sim-speed') as HTMLSelectElement).value = String(speed);
    const o2 = fr.procedure.o2;
    $('#o2-key').classList.toggle('o2-active', !!o2?.active);
    put('#o2-time', o2?.active ? clock(Math.ceil((o2.endsAtMs - fr.simTimeMs) / 1000)) : '');
    updateMetrics();
    updateQuick();
    updateAlarm();
    updateHold();
    updateTeacher();
    updateLogs();
    evaluateLesson();
  }

  // ---------- ingesta de cuadros ----------
  function ingest(
    fr: EngineFrame,
    m: { running: boolean; speed: number; pauseReason: string | null; discontinuities: Discontinuity[] },
  ): void {
    const prev = frame;
    frame = fr;
    running = m.running;
    speed = m.speed;
    pauseReason = m.pauseReason;
    discontinuities = m.discontinuities;
    const s = fr.samples;
    const lastT = points[points.length - 1]?.[0] ?? -1;
    for (let i = 0; i < s.t.length; i += 5) {
      const t = (s.t[i] as number) / 1000;
      if (t <= lastT) continue;
      points.push([
        t,
        s.paw[i] as number,
        (s.flow[i] as number) * 60,
        (s.vol[i] as number) * 1000,
        s.pmus[i] as number,
        s.breath[i] as number,
      ]);
    }
    if (points.length > 6000) points.splice(0, points.length - 6000);
    if (prev && JSON.stringify(prev.truth.patient) !== JSON.stringify(fr.truth.patient)) patientChangeMs = fr.simTimeMs;
    if (prev && prev.simTimeMs > fr.simTimeMs) {
      points = [];
      loopReference = null;
    }
    dirty = true;
    updateUI();
  }
  function activeTrace(): { pts: Point[]; end: number } {
    return { pts: frozen ? frozenPoints : points, end: frozen ? reviewEnd : simS() };
  }
  function renderPlots(): void {
    const fr = frame;
    if (!fr) return;
    const { pts, end } = activeTrace();
    const peep = fr.settings.peep === 'off' ? 0 : fr.settings.peep,
      vtMl = fr.settings.vt * 1000;
    if (view === 'waves')
      drawWave($<HTMLCanvasElement>('#waves-canvas'), pts, end, peep, vtMl, { window: waveWindow, style: waveStyle, frozen, cursorTime });
    else if (view === 'basic')
      drawWave($<HTMLCanvasElement>('#basic-wave-canvas'), pts, end, peep, vtMl, { window: waveWindow, style: waveStyle, frozen });
    else if (view === 'loops') {
      drawLoop($<HTMLCanvasElement>('#pv-canvas'), pts, loopReference, peep, vtMl, 'pv');
      drawLoop($<HTMLCanvasElement>('#fv-canvas'), pts, loopReference, peep, vtMl, 'fv');
    } else if (view === 'trends')
      drawTrends(
        $<HTMLCanvasElement>('#trends-canvas'),
        fr.trends.map((t) => ({ t: t.tMs / 1000, ppeak: t.ppeak, peep: t.peepe, vte: t.vte * 1000, rr: t.rr })),
        simS(),
      );
    drawGauge($<HTMLCanvasElement>('#gauge-canvas'), {
      paw: fr.live.paw,
      pmax: fr.settings.pmax,
      ppeak: fr.metrics.ppeak?.value ?? fr.live.ppeakCurrent,
      peep,
      standby: fr.ventilation === 'standby',
      vteMl: fr.metrics.vte?.value == null ? null : fr.metrics.vte.value * 1000,
      fio2Pct: fr.metrics.fio2?.value == null ? null : fr.metrics.fio2.value * 100,
    });
    if (teacherVisible) drawMuscle($<HTMLCanvasElement>('#muscle-canvas'), points, simS());
  }
  function tick(now: number): void {
    if (frame && !document.hidden && now - lastPlot > 32 && dirty) {
      lastPlot = now;
      renderPlots();
      dirty = false;
    }
    requestAnimationFrame(tick);
  }
  /** Cambiar de vista nunca toca el borrador de edición: el editor sigue abierto sobre la nueva vista. */
  function switchView(v: string): void {
    if (!(VIEWS as string[]).includes(v)) return;
    view = v as ViewId;
    for (const e of $$('[data-view-panel]')) e.classList.toggle('active', e.dataset.viewPanel === v);
    for (const b of $$('[data-view]')) {
      b.classList.toggle('chosen', b.dataset.view === v);
      b.setAttribute('aria-pressed', String(b.dataset.view === v));
    }
    flags[v] = true;
    dirty = true;
    updateUI();
  }
  function switchInstructor(tab: string): void {
    for (const e of $$('[data-instructor]')) {
      const on = e.dataset.instructor === tab;
      e.classList.toggle('active', on);
      e.setAttribute('aria-selected', String(on));
    }
    for (const id of ['patient', 'learn', 'events']) $('#instructor-' + id).classList.toggle('active', id === tab);
  }
  function toggleFreeze(): void {
    frozen = !frozen;
    cursorTime = null;
    if (frozen) {
      frozenPoints = points.map((x) => [...x] as Point);
      freezeEnd = simS();
      reviewEnd = freezeEnd;
      ($('#history-slider') as HTMLInputElement).value = '1000';
      put('#inspector-label', 'Curvas congeladas; los números siguen en vivo. Arrastra la historia o mueve el cursor sobre una curva.');
    } else frozenPoints = [];
    $('#signal-inspector').hidden = !frozen;
    $('#frozen-ribbon').hidden = !frozen;
    $('#freeze-button').innerHTML = icon(frozen ? 'play' : 'pause') + `<span>${frozen ? 'Reanudar curvas' : 'Congelar curvas'}</span>`;
    $('#freeze-button').classList.toggle('active', frozen);
    dirty = true;
  }

  // ---------- diálogos ----------
  function openDialog(kind: string, title: string, html: string, footer = '', size = ''): void {
    dialogKind = kind;
    $('#app-dialog').className = 'app-dialog ' + size;
    put('#dialog-title', title);
    put('#dialog-eyebrow', 'R860 LAB · SIMULACIÓN EDUCATIVA');
    $('#dialog-content').innerHTML = html;
    $('#dialog-footer').innerHTML = footer || btn('Cerrar', 'closeDialog', 'secondary-button');
    const d = $<HTMLDialogElement>('#app-dialog');
    if (!d.open) d.showModal();
    alarmSignature = '';
  }
  function closeDialog(): void {
    const d = $<HTMLDialogElement>('#app-dialog');
    if (d.open) d.close();
    dialogKind = '';
    modeDraft = null;
    limitsDraft = null;
  }
  const closeBtn = btn('Cerrar', 'closeDialog', 'secondary-button');
  const cancelBtn = btn('Cancelar', 'closeDialog', 'secondary-button');
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
      : ['fio2', 'peep', 'vt', 'rr', 'ie', 'pausePct', 'plimit', 'pmax'];
    const title = pc ? 'Asistido / controlado por presión' : 'Asistido / controlado por volumen';
    const desc = pc
      ? 'Presión objetivo = PEEP + Pinsp durante el tiempo inspiratorio, con rampa. El flujo empieza alto y decae; el volumen depende de la compliance, la resistencia, el tiempo y el esfuerzo.'
      : 'Flujo constante calculado de VT, Tinsp y pausa. Plimit sostiene la presión el resto de la inspiración; Pmáx termina la inspiración.';
    return `<div class="mode-description"><div class="parameter-label"><h3>${title}</h3></div><p class="settings-annotation">${desc}</p></div><div class="settings-grid">${main.map((k) => fieldHTML(k, s)).join('')}<div class="settings-subtitle">Sincronización</div>${fieldHTML('assistControl', s)}${fieldHTML('flowTrigger', s)}${fieldHTML('biasFlow', s)}${fieldHTML('triggerByPressure', s)}${fieldHTML('pressureTrigger', s)}</div><div id="mode-timing" class="mode-timing"></div><div id="mode-warning" class="mode-error warn" role="status"></div><div id="mode-error" class="mode-error" role="status"></div>`;
  }
  function openModes(): void {
    if (!frame) return;
    modeDraft = { ...frame.settings, ...(frame.pending ?? {}) };
    cancelQuick();
    renderModes();
  }
  function renderModes(): void {
    const m = (modeDraft as VcSettings).mode;
    const enabled = PROFILE.enabledModes as readonly string[];
    const options = MODE_OPTIONS.map(([id, label]) => {
      const on = enabled.includes(id);
      const why = on ? '' : 'Pendiente de banco de pruebas en este perfil';
      return `<button class="mode-option ${m === id ? 'selected' : ''}" data-mode="${id}" aria-pressed="${m === id}" ${m === id ? 'aria-current="true"' : ''} ${on ? '' : `disabled title="${esc(why)}"`}><b>${label}</b>${on ? '' : `<small>${esc(why)}</small>`}</button>`;
    }).join('');
    const others = OTHER_MODES.map(
      ([mm, why]) =>
        `<button class="mode-option" disabled aria-pressed="false" title="${esc(why)}"><b>${mm}</b><small>${esc(why)}</small></button>`,
    ).join('');
    openDialog(
      'modes',
      'Modo y ajustes de ventilación',
      `<div class="mode-layout"><nav class="mode-list" aria-label="Modos ventilatorios">${options}${others}</nav><div id="mode-fields">${modeFields()}</div></div>`,
      cancelBtn + btn('Confirmar ajustes', 'confirmModes'),
      'wide',
    );
    validateMode();
  }
  function validateMode(): { ok: boolean; errors: string[] } {
    const s = modeDraft;
    if (!s) return { ok: false, errors: [] };
    const cross = validateVcSettings(s, VC_ADULT_CROSS_LIMITS);
    const errors = [...validateDomains(s, VC_ADULT_RULES), ...cross.reasons];
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
  function loadScenario(id: string): void {
    const sc = findScenario(id);
    if (!sc) return;
    scenario = sc;
    fixtureId = null;
    closeDialog();
    cancelQuick();
    closeHoldPanel();
    locked = false;
    $('#lock-overlay').hidden = true;
    eventUndo.length = 0;
    logSignature = '';
    points = [];
    loopReference = null;
    if (frozen) toggleFreeze();
    client.loadScenario(sc, false);
    lessonReset();
    switchView('waves');
    $('#global-notice').hidden = true;
    toast(`${sc.name}: ${sc.observe}`);
  }
  async function setPhys(cmds: Command[], undo: Command[] | null): Promise<boolean> {
    let ok = true;
    for (const c of cmds) {
      const r = await send(c, 'instructor');
      ok = ok && r.accepted;
    }
    if (ok && undo) eventUndo.push(undo);
    return ok;
  }
  async function fault(kind: string): Promise<void> {
    const fr = frame;
    if (!fr) return;
    const p = fr.truth.patient,
      e = fr.truth.effort;
    if (kind === 'resistance')
      await setPhys(
        [{ type: 'setPatient', params: { rInsp: Math.min(100, p.rInsp * 2), rExp: Math.min(150, p.rExp * 2) } }],
        [{ type: 'setPatient', params: { rInsp: p.rInsp, rExp: p.rExp } }],
      );
    else if (kind === 'compliance')
      await setPhys(
        [{ type: 'setPatient', params: { crs: Math.max(0.005, p.crs / 2) } }],
        [{ type: 'setPatient', params: { crs: p.crs } }],
      );
    else if (kind === 'apnea') {
      const on = e.enabled && e.amplitude > 0;
      apneaApplied = on;
      await setPhys(
        [{ type: 'setEffort', params: on ? { enabled: false } : { enabled: true, amplitude: e.amplitude > 0 ? e.amplitude : 6 } }],
        [{ type: 'setEffort', params: { enabled: e.enabled, amplitude: e.amplitude } }],
      );
    } else if (kind === 'obstruction') {
      const on = p.rInsp >= 300;
      await setPhys([{ type: 'setPatient', params: { rInsp: on ? 10 : 400 } }], [{ type: 'setPatient', params: { rInsp: p.rInsp } }]);
    } else toast('Fuga y desconexión no están modeladas en esta etapa.', true);
  }
  function alarms(): void {
    flags.alarmSeen = true;
    openDialog(
      'alarms',
      'Alarmas y reconocimiento',
      `<div class="context-help-row"><span>Información sobre alarmas</span>${infoButton('procedure.alarms', 'help-alarms')}</div>${infoPanel('procedure.alarms', 'help-alarms')}<div id="live-alarms" class="alarm-list">${alarmHTML()}</div>`,
      btn('Límites', 'alarmSetup', 'secondary-button') +
        btn('Silenciar 120 s', 'mute', 'secondary-button') +
        btn('Reconocer', 'acknowledge'),
    );
  }
  function alarmSetup(): void {
    if (!frame) return;
    limitsDraft = { ...frame.alarmLimits };
    const rows: [string, string, keyof AlarmLimits | null, keyof AlarmLimits | null][] = [
      ['VTesp', 'mL', 'vteLow', 'vteHigh'],
      ['VMesp', 'L/min', 'mveLow', 'mveHigh'],
      ['Frecuencia', '/min', 'rrLow', 'rrHigh'],
      ['PEEPe', 'cmH₂O', 'peepeLow', 'peepeHigh'],
      ['FiO₂', '%', 'fio2Low', 'fio2High'],
      ['Ppico', 'cmH₂O', 'ppeakLow', null],
    ];
    const cell = (k: keyof AlarmLimits | null, label: string, which: string): string => {
      if (!k) return `<span class="settings-annotation">Pmáx ${frame?.settings.pmax}</span>`;
      const r = ALARM_LIMIT_RULES[k];
      const v = limitsDraft![k];
      return `<input class="form-control" type="number" data-limit="${k}" value="${v === 'off' ? '' : (v as number) * r.displayFactor}" placeholder="Off" step="${Math.min(...r.domain.map((s) => s.step))}" aria-label="${label} ${which}">`;
    };
    openDialog(
      'alarmSetup',
      'Límites de alarma',
      `<div class="context-help-row"><span>Información sobre límites</span>${infoButton('procedure.alarms', 'help-alarm-limits')}</div>${infoPanel('procedure.alarms', 'help-alarm-limits')}<div class="alarm-edit-grid"><b>Parámetro</b><b>Bajo</b><b>Alto</b>${rows.map(([label, u, lo, hi]) => `<label>${label}<small>${u}</small></label>${cell(lo, label, 'bajo')}${cell(hi, label, 'alto')}`).join('')}</div><p class="settings-annotation">Vacío = Off (la alarma no se evalúa). Pmáx se ajusta en la tecla rápida y termina la inspiración.</p><div id="limits-error" class="mode-error" role="status"></div>`,
      btn('Ver alarmas', 'alarms', 'secondary-button') + btn('Confirmar límites', 'confirmLimits'),
    );
  }
  function readLimits(): string[] {
    const errors: string[] = [];
    if (!limitsDraft) return ['sin borrador'];
    for (const el of $$<HTMLInputElement>('[data-limit]')) {
      const k = el.dataset.limit as keyof AlarmLimits;
      const r = ALARM_LIMIT_RULES[k];
      const raw = el.value.trim();
      if (raw === '') {
        limitsDraft[k] = 'off';
        continue;
      }
      const v = Number(raw);
      if (!Number.isFinite(v) || !isOnGrid(r, v))
        errors.push(
          `${r.label}: ${raw} no es un valor admitido; el más cercano es ${nearestGridValue(r, Number.isFinite(v) ? v : 0)} ${unitText(r.displayUnit)}.`,
        );
      else (limitsDraft as unknown as Record<string, unknown>)[k] = v / r.displayFactor;
    }
    put('#limits-error', joinSentences(errors));
    const b = document.querySelector<HTMLButtonElement>('[data-action="confirmLimits"]');
    if (b) b.disabled = errors.length > 0;
    return errors;
  }
  function standbyDialog(): void {
    if (frame?.ventilation === 'standby') {
      void send({ type: 'startVentilation' });
      return;
    }
    openDialog('standby', '¿Pasar a espera virtual?', standbyHTML(), cancelBtn + btn('Pasar a espera', 'confirmStandby'), 'compact');
  }
  function oxygenDialog(): void {
    const o2 = frame?.procedure.o2;
    openDialog(
      'oxygen',
      'Oxígeno temporal',
      oxygenHTML(o2, frame?.simTimeMs ?? 0),
      cancelBtn + (o2?.active ? btn('Finalizar incremento', 'stopOxygen') : btn('Iniciar 100 % · 120 s', 'startOxygen')),
      'compact',
    );
  }
  function mechanics(metric: string | null = null): void {
    if (metric) {
      const entry = ALL_METRICS.find((x) => x.key === metric);
      if (!entry) return;
      openDialog(
        'measurement',
        helpEntry(METRIC_HELP[metric] ?? '')?.title ?? entry.label,
        `<div class="measurement-summary"><strong>${f(metricValue(entry), entry.decimals)} <small>${entry.unit}</small></strong><span>${esc(metricQuality(entry))}</span></div><div class="measurement-explanation">${helpContent(METRIC_HELP[metric] ?? '')}</div>`,
        closeBtn,
        'compact',
      );
      return;
    }
    const rows = ALL_METRICS.filter((x) => ['pplat', 'cstat', 'driving', 'peepe', 'vti', 'vte', 'pplatCycle'].includes(x.key));
    openDialog(
      'mechanics',
      'Mecánica respiratoria',
      `<table class="info-table"><thead><tr><th>Dato</th><th>Resultado</th><th>Medición</th></tr></thead><tbody>${rows.map((m) => `<tr><td><button class="metric-name" data-metric="${m.key}">${m.label}${icon('info')}</button></td><td>${f(metricValue(m), m.decimals)} ${m.unit}</td><td>${esc(metricQuality(m))}</td></tr>`).join('')}</tbody></table><div class="context-help-row"><span>Cómo se obtiene Cstat</span>${infoButton('metric.cstat', 'help-mechanics')}</div>${infoPanel('metric.cstat', 'help-mechanics')}`,
      btn('Bloqueo espiratorio', 'expiratory', 'secondary-button') + btn('Bloqueo inspiratorio', 'inspiratory'),
      'wide',
    );
  }
  const debriefInput = () => ({
    scenario,
    tasks: scenario.lesson?.tasks ?? [],
    done: lessonDone,
    simS: simS(),
    breathCount: frame?.breathCount ?? 0,
  });
  async function exportSession(): Promise<void> {
    const file = await client.exportSession();
    downloadBlob(sessionBlob(file), `R860_sesion_${stamp()}.json`);
    toast(`Sesión guardada (${file.commands.length} comandos, ${file.breaths.length} respiraciones).`);
  }
  function exportCSV(signal: boolean): void {
    const fr = frame;
    if (!fr) return;
    const rows = signal ? signalRows(points) : trendsRows(fr);
    downloadBlob(csvBlob(signal ? SIGNAL_HEADER : TRENDS_HEADER, rows), `R860_${signal ? 'senal' : 'tendencias'}_${stamp()}.csv`);
    toast(`${rows.length} filas exportadas.`);
  }
  function snapshot(): void {
    const fr = frame;
    if (!fr) return;
    renderPlots();
    const quickItems: [string, string][] = [
      ['Modo actual', MODE_LABEL[fr.settings.mode]],
      ...QUICK_KEYS_BY_MODE[fr.settings.mode].map(
        (k) =>
          [QUICK_LABEL[k], displaySetting(k, fr.settings[k]) + (k === 'ie' ? '' : ' ' + unitText(ruleOf(k).displayUnit))] as [
            string,
            string,
          ],
      ),
    ];
    const c = paintSnapshot(document.createElement('canvas'), {
      frame: fr,
      view,
      waveCanvas: $<HTMLCanvasElement>(view === 'basic' ? '#basic-wave-canvas' : '#waves-canvas'),
      gaugeCanvas: $<HTMLCanvasElement>('#gauge-canvas'),
      holdVisible: !$('#hold-panel').hidden,
      scenarioName: scenario.name,
      quickItems,
    });
    c.toBlob((blob) => {
      if (!blob) {
        toast('No se pudo crear la imagen.', true);
        return;
      }
      downloadBlob(blob, `R860_monitor_${stamp()}.png`);
      flags.snapshot = true;
      evaluateLesson();
      toast('Captura guardada.');
    }, 'image/png');
  }
  async function toggleAudio(): Promise<void> {
    if (!audio.enabled) {
      const ok = await audio.enable();
      if (!ok) {
        toast(audio.blockedReason ?? 'Audio no disponible.', true);
        return;
      }
      toast('Audio de alarmas activado. Tonos sintéticos de entrenamiento.');
    } else {
      audio.enabled = false;
      toast('Audio de alarmas apagado. Las alarmas visuales continúan.');
    }
    $('#sound-toggle').innerHTML = icon(audio.enabled ? 'sound' : 'muted');
    $('#sound-toggle').setAttribute('aria-pressed', String(audio.enabled));
    if (frame) updateAlarm();
  }

  // ---------- acciones ----------
  async function confirmModes(): Promise<void> {
    const r = validateMode();
    if (!r.ok || !modeDraft || !frame) return;
    const changes: Partial<VcSettings> = {};
    const base = { ...frame.settings, ...(frame.pending ?? {}) };
    for (const k of Object.keys(modeDraft) as (keyof VcSettings)[])
      if (modeDraft[k] !== base[k]) (changes as Record<string, unknown>)[k] = modeDraft[k];
    if (!Object.keys(changes).length) {
      closeDialog();
      return;
    }
    const res = await send({ type: 'confirmSettings', changes });
    if (res.accepted) {
      if ('plimit' in changes) flags.plimitChanged = true;
      if ('peep' in changes) flags.peepChanged = true;
      settingsChangeMs = frame.simTimeMs;
      closeDialog();
      toast('Ajustes confirmados. Se aplican en la próxima respiración.');
    }
  }
  async function confirmLimits(): Promise<void> {
    const errs = readLimits();
    if (errs.length || !limitsDraft || !frame) return;
    const changes: Partial<AlarmLimits> = {};
    for (const k of Object.keys(limitsDraft) as (keyof AlarmLimits)[])
      if (limitsDraft[k] !== frame.alarmLimits[k]) (changes as Record<string, unknown>)[k] = limitsDraft[k];
    if (!Object.keys(changes).length) {
      closeDialog();
      return;
    }
    const r = await send({ type: 'setAlarmLimits', changes });
    if (r.accepted) {
      closeDialog();
      toast('Límites de alarma actualizados.');
    }
  }
  function setLocked(on: boolean): void {
    locked = on;
    $('#lock-overlay').hidden = !on;
    $('#lock-key').setAttribute('aria-pressed', String(on));
    edit.setLocked(on);
    if (on) cancelQuick();
  }
  async function action(a: string): Promise<void> {
    switch (a) {
      case 'home':
        closeDialog();
        switchView('waves');
        break;
      case 'menu':
        openDialog('menu', 'Menú', menuHTML());
        break;
      case 'modes':
        openModes();
        break;
      case 'confirmModes':
        await confirmModes();
        break;
      case 'scenarios':
        openDialog('scenarios', 'Elige un escenario de entrenamiento', scenariosHTML(SCENARIOS, scenario.id, modeLabel), cancelBtn, 'wide');
        break;
      case 'teacher':
        teacherVisible = !teacherVisible;
        $('#workspace').classList.toggle('teacher-hidden', !teacherVisible);
        $('#teacher-toggle').innerHTML = icon('eye') + `<span>${teacherVisible ? 'Ocultar' : 'Mostrar'} panel docente</span>`;
        break;
      case 'pause':
        if (running) client.pause('usuario');
        else client.resume();
        $('#global-notice').hidden = true;
        break;
      case 'freeze':
        toggleFreeze();
        break;
      case 'sound':
        await toggleAudio();
        break;
      case 'fullscreen':
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
        } catch {
          toast('No se pudo activar pantalla completa.', true);
        }
        break;
      case 'alarms':
        alarms();
        break;
      case 'alarmSetup':
        alarmSetup();
        break;
      case 'confirmLimits':
        await confirmLimits();
        break;
      case 'mute':
        await send({ type: 'audioPause' });
        toast('Audio en pausa durante 120 s de simulación. Las condiciones activas siguen visibles.');
        break;
      case 'acknowledge':
        await send({ type: 'acknowledgeAlarms' });
        toast('Reconocimiento registrado; las condiciones activas permanecen.');
        break;
      case 'inspiratory':
        openHold('inspHold');
        break;
      case 'expiratory':
        openHold('expHold');
        break;
      case 'closeHold':
        if (frame?.procedure.hold) await send({ type: 'cancelProcedure' });
        closeHoldPanel();
        break;
      case 'runHold':
        await runHold();
        break;
      case 'cancelHold':
        await cancelHold();
        break;
      case 'manual': {
        const r = await send({ type: 'manualBreath' });
        if (r.accepted) toast('Respiración manual solicitada.');
        closeDialog();
        break;
      }
      case 'oxygen':
        oxygenDialog();
        break;
      case 'startOxygen':
        await send({ type: 'increaseO2Start' });
        closeDialog();
        break;
      case 'stopOxygen':
        await send({ type: 'increaseO2Stop' });
        closeDialog();
        break;
      case 'cancelEdit':
        cancelQuick();
        break;
      case 'confirmEdit':
        confirmQuick();
        break;
      case 'editMinus':
        stepQuick(-1);
        break;
      case 'editPlus':
        stepQuick(1);
        break;
      case 'knob':
        if (edit.state.kind !== 'idle') confirmQuick();
        else toast('Selecciona primero un parámetro de la barra inferior.');
        break;
      case 'lock':
        setLocked(!locked);
        break;
      case 'unlock':
        setLocked(false);
        break;
      case 'standby':
        standbyDialog();
        break;
      case 'confirmStandby':
        await send({ type: 'enterStandby' });
        closeDialog();
        break;
      case 'startVentilation':
        await send({ type: 'startVentilation' });
        closeDialog();
        break;
      case 'powerInfo':
        openDialog('power', 'Entorno de simulación', powerHTML(), '', 'compact');
        break;
      case 'patient':
        openDialog('patient', 'Paciente virtual · adulto', patientHTML(), closeBtn, 'compact');
        break;
      case 'resetPatient':
        await setPhys(
          [
            { type: 'setPatient', params: { ...scenario.patient } },
            { type: 'setEffort', params: { ...scenario.effort } },
            { type: 'setSensors', params: { ...scenario.sensors } },
          ],
          null,
        );
        toast('Mecánica inicial restablecida. Los ajustes ventilatorios se mantienen.');
        break;
      case 'undoEvent': {
        const u = eventUndo.pop();
        if (u) await setPhys(u, null);
        else toast('No hay eventos para deshacer.');
        break;
      }
      case 'loopReference': {
        const cyc = cyclePoints(points);
        if (cyc.length < 3) {
          toast('Espera un ciclo completo.', true);
          break;
        }
        loopReference = cyc.map((x) => [...x] as Point);
        put('#loop-reference-label', `Referencia ${clock(cyc[0]![0])}`);
        flags.referenceLoop = true;
        dirty = true;
        evaluateLesson();
        toast('Ciclo de referencia guardado para comparación.');
        break;
      }
      case 'clearLoop':
        loopReference = null;
        put('#loop-reference-label', 'Sin referencia');
        dirty = true;
        break;
      case 'tools':
        openDialog('tools', 'Mecánica y procedimientos', toolsHTML());
        break;
      case 'mechanics':
        mechanics();
        break;
      case 'session':
        openDialog(
          'session',
          'Sesión y exportaciones',
          sessionHTML(scenario.name, simS(), ENGINE_VERSION, PROFILE.profileVersion),
          closeBtn,
          'wide',
        );
        break;
      case 'exportSession':
        await exportSession();
        break;
      case 'importSession':
        $('#session-input').click();
        break;
      case 'csv':
        exportCSV(false);
        break;
      case 'signalCSV':
        exportCSV(true);
        break;
      case 'snapshot':
        snapshot();
        break;
      case 'debrief':
        openDialog('debrief', 'Resumen de práctica', debriefHTML(debriefInput()), closeBtn + btn('Guardar resumen TXT', 'exportDebrief'));
        break;
      case 'exportDebrief':
        if (frame) downloadBlob(textBlob(debriefText(debriefInput(), frame)), `R860_practica_${stamp()}.txt`);
        break;
      case 'help':
        openDialog('help', 'Guía del simulador', helpHTML('start'), closeBtn, 'wide');
        break;
      case 'model':
        openDialog('help', 'Guía del simulador', helpHTML('model'), closeBtn, 'wide');
        break;
      case 'closeDialog':
        closeDialog();
        break;
      default:
        toast('Acción no disponible en esta versión.', true);
    }
  }

  // ---------- eventos DOM ----------
  /** Flechas dentro de una rejilla de casillas con tabindex itinerante (numéricas y datos grandes). */
  function roveGrid(e: KeyboardEvent, t: HTMLElement): boolean {
    const grid = t.closest<HTMLElement>('#numeric-grid,#big-metrics');
    if (!grid || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return false;
    const tiles = [...grid.querySelectorAll<HTMLElement>('[data-metric]')];
    const i = tiles.indexOf(t);
    if (i < 0) return false;
    const cols = 2;
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols };
    let j = e.key === 'Home' ? 0 : e.key === 'End' ? tiles.length - 1 : i + (step[e.key] ?? 0);
    j = Math.max(0, Math.min(tiles.length - 1, j));
    for (const x of tiles) x.tabIndex = -1;
    const target = tiles[j] as HTMLElement;
    target.tabIndex = 0;
    target.focus();
    e.preventDefault();
    return true;
  }
  function bind(): void {
    document.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-action],[data-view],[data-instructor],[data-setting-quick],[data-scenario],[data-event],[data-metric],[data-help-tab],[data-help-target],[data-mode]',
      );
      if (!el) return;
      e.preventDefault();
      if (el.dataset.helpTarget) {
        toggleHelp(el);
        return;
      }
      if (locked && el.closest('#monitor') && !['mute', 'alarms', 'unlock', 'closeHold'].includes(el.dataset.action ?? '')) {
        toast('Controles bloqueados.');
        return;
      }
      if (el.dataset.action) {
        void action(el.dataset.action).catch((err: Error) => notice(err.message));
        return;
      }
      if (el.dataset.view) switchView(el.dataset.view);
      if (el.dataset.instructor) switchInstructor(el.dataset.instructor);
      if (el.dataset.settingQuick) openQuick(el.dataset.settingQuick as SettingsKey, el);
      if (el.dataset.scenario) loadScenario(el.dataset.scenario);
      if (el.dataset.mode && modeDraft && !(el as HTMLButtonElement).disabled) {
        modeDraft.mode = el.dataset.mode as VentMode;
        renderModes();
      }
      if (el.dataset.event) void fault(el.dataset.event);
      if (el.dataset.metric) mechanics(el.dataset.metric);
      if (el.dataset.helpTab) openDialog('help', 'Guía del simulador', helpHTML(el.dataset.helpTab), closeBtn, 'wide');
    });
    document.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.id === 'quick-value') typedQuick(el.value);
      if (el.id === 'quick-range' && edit.state.kind !== 'idle') {
        const rule = ruleOf(edit.state.key);
        const vals = gridValues(rule);
        const i = Number(el.value);
        const v: number | 'off' = rule.allowOff ? (i === 0 ? 'off' : (vals[i - 1] as number)) : (vals[i] as number);
        edit.setDraftDisplay(v, performance.now());
        renderQuick();
      }
      if (el.dataset.physRange) {
        const k = el.dataset.physRange;
        $<HTMLInputElement>(`[data-phys-number="${k}"]`).value = el.value;
        const sp = PHYS[k] as PhysSpec;
        el.style.setProperty('--fill', `${(100 * (Number(el.value) - sp.min)) / (sp.max - sp.min)}%`);
      }
      if (el.dataset.modeField) readModeField(el);
      if (el.dataset.limit) readLimits();
      if (el.id === 'history-slider') {
        const start = Math.min(freezeEnd, frozenPoints[0]?.[0] ?? freezeEnd);
        reviewEnd = Math.min(freezeEnd, start + waveWindow + ((freezeEnd - start - waveWindow) * Number(el.value)) / 1000);
        cursorTime = null;
        put('#inspector-label', `Historia congelada · final de ventana ${clock(reviewEnd)}. Los números del monitor siguen en vivo.`);
        dirty = true;
      }
    });
    document.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement | HTMLSelectElement;
      if ((el as HTMLInputElement).dataset.physRange || (el as HTMLInputElement).dataset.physNumber) {
        const k = ((el as HTMLInputElement).dataset.physRange ?? (el as HTMLInputElement).dataset.physNumber) as string;
        const sp = PHYS[k] as PhysSpec;
        if (frame)
          void setPhys([sp.cmd(Number(el.value), frame)], null).then(() => {
            el.blur();
            if (frame) updateTeacher();
          });
      }
      if (el.id === 'sim-speed') {
        speed = Number(el.value);
        client.setSpeed(speed);
      }
      if (el.id === 'wave-window') {
        waveWindow = Number(el.value);
        dirty = true;
      }
      if (el.id === 'wave-style') {
        waveStyle = el.value as 'sweep' | 'scroll';
        dirty = true;
      }
      if ((el as HTMLInputElement).dataset.modeField) readModeField(el as HTMLInputElement);
    });
    $('#session-input').addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        toast('Archivo demasiado grande (máximo 2 MB).', true);
        return;
      }
      const text = await file.text();
      const r = await client.importSession(text);
      if (r.ok) {
        points = [];
        loopReference = null;
        fixtureId = null;
        closeDialog();
        toast(`Sesión importada y reproducida en pausa. ${r.warnings?.join(' ') ?? ''} Pulsa Reanudar.`);
      } else toast(`Rechazada: ${r.errors?.join(' · ')}`, true);
    });
    $('#trim-knob').addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        stepQuick((e as WheelEvent).deltaY < 0 ? 1 : -1);
      },
      { passive: false },
    );
    $('#app-dialog').addEventListener('cancel', () => {
      dialogKind = '';
    });
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape' && $<HTMLDialogElement>('#app-dialog').open) {
        e.preventDefault();
        closeDialog();
        return;
      } // lo más externo primero
      if (e.key === 'Escape' && collapseHelp()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const t = e.target as HTMLElement;
      // El editor rápido atrapa Tab mientras está abierto (como el diálogo modal).
      if (edit.state.kind !== 'idle' && !$('#quick-editor').hidden && trapTab(e, $('#quick-editor'))) return;
      if (
        edit.state.kind !== 'idle' &&
        (!t.closest('button') || e.key === 'Escape') &&
        ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)
      ) {
        e.preventDefault();
        if (e.key === 'ArrowUp') stepQuick(1);
        if (e.key === 'ArrowDown') stepQuick(-1);
        if (e.key === 'Enter') confirmQuick();
        if (e.key === 'Escape') cancelQuick();
        return;
      }
      if (t.dataset.metric && roveGrid(e, t)) return;
      if (t.closest('input,select,textarea,button,summary,a') || $<HTMLDialogElement>('#app-dialog').open) return;
      const map: Record<string, string> = { ' ': 'pause', c: 'freeze', f: 'snapshot', a: 'alarms', h: 'home', '?': 'help' };
      const key = e.key.toLowerCase();
      if (map[key]) {
        e.preventDefault();
        void action(map[key] as string);
      }
    });
    $('#waves-canvas').addEventListener('pointermove', (e) => {
      if (!frozen || !frozenPoints.length) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 608;
      const ratio = Math.max(0, Math.min(1, (x - 45) / (608 - 60)));
      if (waveStyle === 'sweep') {
        const cycle = Math.floor(reviewEnd / waveWindow) * waveWindow;
        cursorTime = cycle + ratio * waveWindow;
        if (cursorTime > reviewEnd) cursorTime -= waveWindow;
      } else cursorTime = reviewEnd - waveWindow + ratio * waveWindow;
      const ct = cursorTime;
      const nearest = frozenPoints.reduce((best, p) => (Math.abs(p[0] - ct) < Math.abs(best[0] - ct) ? p : best), frozenPoints[0] as Point);
      put(
        '#inspector-label',
        `t ${f(nearest[0], 2)} s · Paw ${f(nearest[1], 1)} cmH₂O · Flujo ${f(nearest[2], 1)} L/min · Volumen ${f(nearest[3], 0)} mL · datos del sensor`,
      );
      dirty = true;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && frame && running && !fixtureId) {
        client.visibility(true);
        notice('Simulación pausada al ocultar la pestaña. Pulsa Reanudar para continuar sin saltos de tiempo.');
      }
    });
    setInterval(() => {
      const now = performance.now();
      edit.tick(now);
      renderCountdown(now);
    }, 500);
    window.addEventListener('resize', () => {
      if (edit.state.kind !== 'idle') placeQuickEditor();
      if (!$('#hold-panel').hidden) placeHoldPanel();
    });
  }

  // ---------- arranque ----------
  /** Degradación del motor (sin Worker o sin arrancar): aviso persistente y etiqueta de versión honesta. */
  function onDegraded(reason: string): void {
    const text = learnerText(reason);
    const failedInit = /inici|init|par[áa]metro|inv[áa]lid|\bdt\b/i.test(reason);
    engineBanner(
      failedInit && frame === null
        ? `No se pudo iniciar la simulación: ${text}. Revisa los parámetros de la dirección o recarga la página.`
        : `El motor de simulación se ejecuta sin Worker: ${text}. La simulación continúa en la página; puede perder fluidez.`,
    );
    versionTag();
  }
  function wireDegraded(): void {
    // Compatibilidad con ambas formas de la interfaz: propiedad asignable o método de suscripción.
    const c = client as unknown as { onDegraded: unknown };
    if (typeof c.onDegraded === 'function') (c.onDegraded as (cb: (r: string) => void) => void).call(client, onDegraded);
    else c.onDegraded = onDegraded;
    if (client.degradedReason) onDegraded(client.degradedReason);
  }
  function startEngine(): void {
    const t0 = params.get('t0');
    const init: SimulatorInit = defaultInit({
      ...(t0 ? { startWallTimeMs: new Date(t0).getTime() } : { startWallTimeMs: Date.now() }),
      ...(params.get('seed') ? { seed: Number(params.get('seed')) } : {}),
      ...(params.get('dt') ? { dtMs: Number(params.get('dt')) } : {}),
      patient: { ...scenario.patient },
      effort: { ...scenario.effort },
      sensors: { ...scenario.sensors },
      settings: { ...defaultInit().settings, ...(scenario.settings ?? {}) },
      alarmLimits: { ...defaultInit().alarmLimits, ...(scenario.alarmLimits ?? {}) },
      initialV: scenario.initialV ?? 'equilibrium',
    });
    speed = params.get('speed') ? Number(params.get('speed')) : 1;
    ($('#sim-speed') as HTMLSelectElement).value = String(speed);
    const autopause = params.get('autopause') ? Number(params.get('autopause')) : undefined;
    client.init(init, speed, params.get('paused') !== '1', autopause);
    if (scenario.perturbations.length) client.loadScenario(scenario, false);
    setTimeout(() => {
      if (frame === null && !fixtureId) {
        engineBanner(
          'No se pudo iniciar la simulación: el motor no envió ningún dato en 5 segundos. Recarga la página o revisa los parámetros de la dirección.',
        );
        put('#phase-status', 'Motor sin respuesta');
      }
    }, FIRST_FRAME_TIMEOUT_MS);
  }
  initDOM();
  bind();
  renderLesson();
  wireDegraded();
  client.onFrame((m) => {
    if (fixtureId) return;
    ingest(m.frame, m);
  });
  requestAnimationFrame(tick);
  void client.ready.then(() => {
    startEngine();
    const fx = params.get('fixture');
    if (fx === 'P1' || fx === 'P3') {
      setTimeout(() => {
        fixtureId = fx;
        client.pause('fixture visual');
        const fr = frameFromFixture(PHOTO_FIXTURES[fx]);
        frame = fr;
        running = false;
        pauseReason = 'fixture visual';
        switchView(fx === 'P1' ? 'waves' : 'basic');
        points = [];
        dirty = true;
        updateUI();
        if (fx === 'P1') openHold('inspHold');
      }, 80);
    }
    const v = params.get('view');
    if (v) switchView(v);
  });
  (window as unknown as { __r860: unknown }).__r860 = {
    get frame() {
      return frame;
    },
    get edit() {
      return edit.state;
    },
    get view() {
      return view;
    },
    get mode() {
      return client.mode;
    },
    get running() {
      return running;
    },
    get points() {
      return points.length;
    },
    get degraded() {
      return client.degradedReason;
    },
  };
}
