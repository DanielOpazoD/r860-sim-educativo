/**
 * Interfaz de R860 Lab sobre el motor determinista de este proyecto.
 * Estructura de interacción derivada de «R860 Lab» v1.1 (src/app.js, MIT 2026) y reescrita en TypeScript:
 * la UI sólo envía comandos tipados; los borradores viven en EditController; requestAnimationFrame sólo dibuja.
 */
import { EngineClient } from '../app/engineClient';
import type { Discontinuity } from '../app/protocol';
import { EditController } from '../app/uiState';
import type { Command } from '../domain/commands';
import type { SettingRule } from '../domain/settingRules';
import type { AlarmLimits, AlarmState, MetricSample, OffOr, ProcedureResult, SettingsKey, VcSettings } from '../domain/types';
import { isOnGrid, validateDomains, validateVcSettings, deriveVcTiming } from '../domain/validation';
import { defaultInit, type EngineFrame, type SimulatorInit } from '../engine/simulator';
import { ENGINE_VERSION } from '../engine/version';
import { frameFromFixture, PHOTO_FIXTURES } from '../fixtures/photoFixtures';
import { PROFILE } from '../profiles/r860-es-photo-reference/profile';
import { ALARM_LIMIT_RULES, EXP_HOLD_RULE, INSP_HOLD_RULE, VC_ADULT_CROSS_LIMITS, VC_ADULT_RULES } from '../profiles/r860-es-photo-reference/settings';
import { cyclePoints, drawGauge, drawLoop, drawMuscle, drawTrends, drawWave, format as f, type Point } from '../render/plots';
import { findScenario, SCENARIOS, type Scenario } from '../scenarios';
import { AlarmAudio } from './audio';
import { HELP, type HelpEntry } from './help';

type ViewId = 'waves' | 'basic' | 'loops' | 'data' | 'trends' | 'log';
const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string): T[] => [...document.querySelectorAll<T>(s)];
const esc = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const icon = (n: string): string => `<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const clock = (tS: number): string => { const t = Math.max(0, Math.floor(tS || 0)); return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`; };
const put = (sel: string | Element | null, v: string): void => { const e = typeof sel === 'string' ? $(sel) : sel; if (e && e.textContent !== v) e.textContent = v; };
const btn = (label: string, action: string, cls = 'primary-button'): string => `<button class="${cls}" data-action="${action}">${label}</button>`;
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const wallDate = (ms: number): string => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };

interface MetricSpec { key: string; label: string; unit: string; factor: number; decimals: number; source: 'metric' | 'hold' }
const METRICS: MetricSpec[] = [
  { key: 'ppeak', label: 'Ppico', unit: 'cmH₂O', factor: 1, decimals: 0, source: 'metric' }, { key: 'peepe', label: 'PEEPe', unit: 'cmH₂O', factor: 1, decimals: 0, source: 'metric' },
  { key: 'pplat', label: 'Pplat', unit: 'cmH₂O', factor: 1, decimals: 0, source: 'hold' }, { key: 'pmean', label: 'Pmedia', unit: 'cmH₂O', factor: 1, decimals: 0, source: 'metric' },
  { key: 'mve', label: 'VMesp', unit: 'L/min', factor: 1, decimals: 1, source: 'metric' }, { key: 'rr', label: 'FR', unit: '/min', factor: 1, decimals: 0, source: 'metric' },
  { key: 'vte', label: 'VTesp', unit: 'mL', factor: 1000, decimals: 0, source: 'metric' }, { key: 'fio2', label: 'FiO₂', unit: '%', factor: 100, decimals: 0, source: 'metric' },
  { key: 'mveSpont', label: 'VMesp espont', unit: 'L/min', factor: 1, decimals: 2, source: 'metric' }, { key: 'rrSpont', label: 'FR espont', unit: '/min', factor: 1, decimals: 0, source: 'metric' },
  { key: 'cstat', label: 'Cstat', unit: 'mL/cmH₂O', factor: 1000, decimals: 0, source: 'hold' }, { key: 'driving', label: 'ΔP estática', unit: 'cmH₂O', factor: 1, decimals: 1, source: 'hold' },
];
const EXTRA_METRICS: MetricSpec[] = [{ key: 'vti', label: 'VT inspirado', unit: 'mL', factor: 1000, decimals: 0, source: 'metric' }, { key: 'leakPct', label: 'Fuga volumétrica', unit: '%', factor: 100, decimals: 1, source: 'metric' }, { key: 'pplatCycle', label: 'Pplat de ciclo (pausa)', unit: 'cmH₂O', factor: 1, decimals: 0, source: 'metric' }, { key: 'vteSpont', label: 'VTesp espontáneo', unit: 'mL', factor: 1000, decimals: 0, source: 'metric' }];
const QUICK_KEYS: SettingsKey[] = ['fio2', 'vt', 'rr', 'ie', 'peep', 'pmax'];
const QUICK_LABEL: Record<SettingsKey, string> = { fio2: 'FiO₂', vt: 'Volumen tidal', rr: 'Frecuencia', ie: 'I:E', peep: 'PEEP', pmax: 'Pmáx', plimit: 'Plimit', pausePct: 'Pausa inspiratoria', assistControl: 'Disparo asistido', flowTrigger: 'Trigger de flujo' };
const HELP_KEY: Record<SettingsKey, string> = { fio2: 'setting.fio2', vt: 'setting.vt', rr: 'setting.rr', ie: 'setting.ie', peep: 'setting.peep', pmax: 'setting.pmax', plimit: 'setting.plimit', pausePct: 'setting.pause', assistControl: 'setting.assist', flowTrigger: 'setting.trigger' };
const METRIC_HELP: Record<string, string> = { ppeak: 'metric.ppeak', peepe: 'metric.peep', pplat: 'metric.pplat', pmean: 'metric.pmean', mve: 'metric.mv', rr: 'metric.rr', vte: 'metric.vte', fio2: 'setting.fio2', mveSpont: 'metric.mvSpont', rrSpont: 'metric.rrSpont', cstat: 'metric.cstat', driving: 'metric.driving', vti: 'metric.vti', leakPct: 'metric.leak', pplatCycle: 'metric.pplat', vteSpont: 'metric.vte' };
interface PhysSpec { label: string; unit: string; min: number; max: number; step: number; help: string; get: (fr: EngineFrame) => number; cmd: (v: number, fr: EngineFrame) => Command }
const PHYS: Record<string, PhysSpec> = {
  compliance: { label: 'Compliance estática (C)', unit: 'mL/cmH₂O', min: 5, max: 150, step: 1, help: 'patient.compliance', get: (fr) => fr.truth.patient.crs * 1000, cmd: (v) => ({ type: 'setPatient', params: { crs: v / 1000 } }) },
  resistance: { label: 'Resistencia inspiratoria', unit: 'cmH₂O/L/s', min: 2, max: 100, step: 1, help: 'patient.resistance', get: (fr) => fr.truth.patient.rInsp, cmd: (v) => ({ type: 'setPatient', params: { rInsp: v } }) },
  expResistance: { label: 'Resistencia espiratoria', unit: 'cmH₂O/L/s', min: 2, max: 150, step: 1, help: 'patient.expResistance', get: (fr) => fr.truth.patient.rExp, cmd: (v) => ({ type: 'setPatient', params: { rExp: v } }) },
  effort: { label: 'Intensidad del esfuerzo', unit: 'cmH₂O', min: 0, max: 30, step: 0.5, help: 'patient.effort', get: (fr) => (fr.truth.effort.enabled ? fr.truth.effort.amplitude : 0), cmd: (v) => ({ type: 'setEffort', params: { enabled: v > 0, amplitude: v } }) },
  patientRR: { label: 'Frecuencia del paciente', unit: '/min', min: 3, max: 60, step: 1, help: 'patient.patientRR', get: (fr) => fr.truth.effort.ratePerMin, cmd: (v) => ({ type: 'setEffort', params: { ratePerMin: v } }) },
  muscleTi: { label: 'Duración del esfuerzo', unit: 's', min: 0.3, max: 3, step: 0.1, help: 'patient.muscleTi', get: (fr) => fr.truth.effort.tiS, cmd: (v) => ({ type: 'setEffort', params: { tiS: v } }) },
  o2Tau: { label: 'Constante del sensor de O₂', unit: 's', min: 0.5, max: 60, step: 0.5, help: 'setting.fio2', get: (fr) => fr.truth.sensors.fio2TauS, cmd: (v) => ({ type: 'setSensors', params: { fio2TauS: v } }) },
  o2Bias: { label: 'Sesgo del sensor de O₂', unit: '%', min: -20, max: 20, step: 1, help: 'setting.fio2', get: (fr) => Math.round(fr.truth.sensors.fio2Bias * 100), cmd: (v) => ({ type: 'setSensors', params: { fio2Bias: v / 100 } }) },
};

export interface AppOptions { params: URLSearchParams }

export function startApp(opts: AppOptions): void {
  const params = opts.params;
  const client = new EngineClient({ forceInline: params.get('inline') === '1' });
  const audio = new AlarmAudio();
  let frame: EngineFrame | null = null;
  let running = true, speed = 1, pauseReason: string | null = null, discontinuities: Discontinuity[] = [];
  let points: Point[] = [], view: ViewId = 'waves', waveWindow = 12, waveStyle: 'sweep' | 'scroll' = 'sweep';
  let frozen = false, frozenPoints: Point[] = [], freezeEnd = 0, reviewEnd = 0, cursorTime: number | null = null, loopReference: Point[] | null = null;
  let locked = false, teacherVisible = params.get('instructor') !== '0', holdType: 'inspHold' | 'expHold' = 'inspHold', dialogKind = '';
  let scenario: Scenario = findScenario(params.get('scenario') ?? 'SC-01') ?? (SCENARIOS[0] as Scenario);
  let fixtureId: 'P1' | 'P3' | null = null;
  const lessonDone = new Set<string>(); const flags: Record<string, unknown> = {};
  let lessonStartMs = 0, patientChangeMs = -1, settingsChangeMs = -1, holdSeenIds = new Set<string>();
  const eventUndo: Command[][] = [];
  let dirty = true, lastPlot = 0, knobAngle = 0, logSignature = '', alarmSignature = '', lastQuickSig = '';
  let modeDraft: VcSettings | null = null; let limitsDraft: AlarmLimits | null = null;
  const editTimeoutMs = params.get('editTimeout') ? Number(params.get('editTimeout')) : PROFILE.editTimeoutMs;
  const edit = new EditController(VC_ADULT_RULES, VC_ADULT_CROSS_LIMITS, () => (frame ? { ...frame.settings, ...(frame.pending ?? {}) } : defaultInit().settings), editTimeoutMs);

  // ---------- utilidades ----------
  function toast(message: string, warn = false): void { const e = document.createElement('div'); e.className = 'toast' + (warn ? ' warn' : ''); e.textContent = message; const stack = $('#toast-stack'); stack.append(e); while (stack.children.length > 2) stack.firstElementChild?.remove(); setTimeout(() => e.remove(), 4200); }
  function notice(message: string): void { put('#global-notice', message); $('#global-notice').hidden = false; }
  async function send(cmd: Command, actor: 'learner' | 'instructor' = 'learner'): Promise<{ accepted: boolean; reason?: string }> { const r = await client.command(cmd, actor); if (!r.accepted) toast(r.reason ?? 'No se pudo aplicar.', true); return r; }
  function download(blob: Blob, name: string): void { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
  const stamp = (): string => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const simS = (): number => (frame?.simTimeMs ?? 0) / 1000;
  const helpEntry = (key: string): HelpEntry | null => HELP[key] ?? null;
  function helpContent(key: string): string { const h = helpEntry(key); if (!h) return ''; return `<h3>${esc(h.title)}</h3>${h.text.map((t) => `<p>${esc(t)}</p>`).join('')}${h.equation ? `<div class="help-equation">${esc(h.equation)}</div>` : ''}`; }
  function infoButton(key: string, id: string): string { const h = helpEntry(key); return `<button type="button" class="info-button" data-help-key="${esc(key)}" data-help-target="${esc(id)}" aria-controls="${esc(id)}" aria-expanded="false" aria-label="Información sobre ${esc(h?.title ?? key)}" title="Información">${icon('info')}</button>`; }
  const infoPanel = (key: string, id: string): string => `<div id="${esc(id)}" class="parameter-help" hidden>${helpContent(key)}</div>`;
  function collapseHelp(): boolean { let any = false; for (const b of $$('[data-help-target][aria-expanded="true"]')) { const panel = document.getElementById(b.dataset.helpTarget as string); if (panel) panel.hidden = true; b.setAttribute('aria-expanded', 'false'); any = true; } return any; }
  function toggleHelp(button: HTMLElement): void { const panel = document.getElementById(button.dataset.helpTarget as string); if (!panel) return; const show = panel.hidden; collapseHelp(); panel.hidden = !show; button.setAttribute('aria-expanded', String(show)); }

  // ---------- valores ----------
  const ruleOf = (k: SettingsKey): SettingRule => VC_ADULT_RULES[k];
  const unitText = (u: string): string => u.replace('cmH2O', 'cmH₂O');
  function displaySetting(k: SettingsKey, v: VcSettings[SettingsKey]): string { if (v === 'off') return 'Off'; if (typeof v === 'boolean') return v ? 'On' : 'Off'; if (k === 'ie') return ieText(v as number); return ((v as number) * ruleOf(k).displayFactor).toFixed(ruleOf(k).decimals); }
  function ieText(ratio: number): string { if (ratio <= 1 + 1e-9) { const e = Math.round((1 / ratio) * 100) / 100; return `1:${e}`; } return `${Math.round(ratio * 100) / 100}:1`; }
  function metricSample(key: string): MetricSample | null {
    if (!frame) return null;
    if (key === 'pplat' || key === 'cstat' || key === 'driving') { const h = frame.procedure.last.inspHold; return h?.values[key] ?? null; }
    return frame.metrics[key] ?? null;
  }
  function metricValue(spec: MetricSpec): number | null { if (!frame || frame.ventilation === 'standby') return null; const s = metricSample(spec.key); return s && s.value !== null ? s.value * spec.factor : null; }
  function metricQuality(spec: MetricSpec): string {
    if (!frame) return ''; if (frame.ventilation === 'standby') return 'En espera';
    const s = metricSample(spec.key); if (!s) return 'Sin dato';
    if (spec.source === 'hold') { const h = frame.procedure.last.inspHold; if (!h) return 'Requiere bloqueo inspiratorio válido'; return `Bloqueo a ${clock((h.completedAtMs ?? 0) / 1000)} · hace ${clock(simS() - (h.completedAtMs ?? 0) / 1000)}${s.quality !== 'valid' ? ` · ${s.reason ?? 'no válido'}` : ''}`; }
    const q = { valid: 'válido', stale: 'antiguo', unavailable: 'no disponible', invalid: 'inválido', inProgress: 'en curso' }[s.quality];
    return `${q}${s.reason ? ' · ' + s.reason : ''} · ${s.source === 'ventilator' ? 'sensor del ventilador' : s.source}${s.breathId ? ' · ciclo ' + s.breathId : ''}${s.windowMs ? ' · ventana ' + (s.windowMs / 1000).toFixed(1) + ' s' : ''}`;
  }

  // ---------- DOM inicial ----------
  function initDOM(): void {
    $('#numeric-grid').innerHTML = METRICS.map((m) => `<button class="numeric" data-metric="${m.key}" title="${m.label}: información y medición" aria-label="${m.label}. Información y medición"><span class="numeric-label">${m.label}<span class="numeric-info" aria-hidden="true">${icon('info')}</span></span><strong class="numeric-value">—</strong><span class="numeric-unit">${m.unit}</span><span class="numeric-limits"></span><span class="numeric-age"></span></button>`).join('');
    $('#big-metrics').innerHTML = [['fio2', 'FiO₂', '%'], ['peepe', 'PEEPe', 'cmH₂O'], ['ppeak', 'Presión pico', 'cmH₂O'], ['mve', 'Volumen minuto', 'L/min'], ['vte', 'Volumen tidal', 'mL'], ['rr', 'Frecuencia resp.', '/min']].map(([k, l, u]) => `<button class="big-numeric" data-metric="${k}"><span>${l}<span class="numeric-info" aria-hidden="true">${icon('info')}</span></span><b>—</b><em>${u}</em></button>`).join('');
    const physHtml = (keys: string[]): string => keys.map((k) => { const sp = PHYS[k] as PhysSpec; const id = `help-phys-${k}`; return `<div class="phys-field"><div class="phys-field-header"><div class="parameter-label"><label for="phys-${k}">${sp.label}</label>${infoButton(sp.help, id)}</div><div class="phys-value"><input id="phys-${k}" data-phys-number="${k}" type="number" min="${sp.min}" max="${sp.max}" step="${sp.step}" aria-label="${sp.label}"><small>${sp.unit}</small></div></div><input type="range" data-phys-range="${k}" min="${sp.min}" max="${sp.max}" step="${sp.step}" aria-label="Deslizador ${sp.label}"><div class="phys-range-labels"><span>${sp.min}</span><span>${sp.max}</span></div>${infoPanel(sp.help, id)}</div>`; }).join('');
    $('#patient-controls').innerHTML = physHtml(['compliance', 'resistance', 'expResistance', 'effort']);
    $('#patient-extra-controls').innerHTML = physHtml(['patientRR', 'muscleTi', 'o2Tau', 'o2Bias']) + `<p class="settings-annotation">Fuga en Y, desconexión y compensaciones: no modeladas en esta etapa.</p>`;
    $('#fault-grid').innerHTML = [['resistance', 'wave', 'Resistencia ×2', 'Aumenta la carga resistiva'], ['compliance', 'lung', 'C ÷2', 'Aumenta la carga elástica'], ['apnea', 'pause', 'Apnea', 'Interrumpe el esfuerzo'], ['obstruction', 'lock', 'Oclusión', 'Resistencia extrema (Pmáx)'], ['leak', 'wave', 'Fuga', 'No modelada en esta etapa'], ['disconnect', 'plug', 'Desconexión', 'No modelada en esta etapa']].map(([id, i, l, d]) => `<button data-event="${id}" id="event-${id}" ${id === 'leak' || id === 'disconnect' ? 'disabled' : ''}>${icon(i as string)}<b>${l}</b><small>${d}</small></button>`).join('');
    for (const b of $$('[data-help-key]')) { const panel = document.getElementById(b.dataset.helpTarget as string); if (panel && !panel.innerHTML.trim()) panel.innerHTML = helpContent(b.dataset.helpKey as string); }
    const resize = (): void => { const e = $('#screen-window'); $('#monitor').style.transform = `scale(${e.clientWidth / 1120})`; dirty = true; };
    new ResizeObserver(resize).observe($('#screen-window')); resize();
    $('#workspace').classList.toggle('teacher-hidden', !teacherVisible);
    $('#teacher-toggle').innerHTML = icon('eye') + `<span>${teacherVisible ? 'Ocultar' : 'Mostrar'} panel docente</span>`;
    put('#version-tag', `v${ENGINE_VERSION} · Offline · ${client.mode === 'worker' ? 'Worker' : 'en página'}`);
    put('#instructor-footer-text', ''); $('#instructor-footer-text').innerHTML = `${SCENARIOS.length} escenarios · A/C VC adulto<br><b>Modelo mecánico, no paciente completo</b>`;
  }

  // ---------- lecciones ----------
  function lessonReset(): void { lessonDone.clear(); for (const k of Object.keys(flags)) delete flags[k]; lessonStartMs = frame?.simTimeMs ?? 0; patientChangeMs = -1; settingsChangeMs = -1; holdSeenIds = new Set(); renderLesson(); }
  function renderLesson(): void {
    const l = scenario.lesson; put('#lesson-title', l?.title ?? scenario.name); put('#lesson-text', l?.text ?? scenario.description); put('#reflection-question', scenario.question ?? '¿Qué observar?'); put('#reflection-answer', scenario.answer ?? scenario.observe);
    const tasks = l?.tasks ?? []; put('#lesson-count', `${lessonDone.size} de ${tasks.length} objetivos`);
    $('#lesson-tasks').innerHTML = tasks.map((task, i) => `<div class="task ${lessonDone.has(task.id) ? 'complete' : ''}"><span class="task-check">${lessonDone.has(task.id) ? icon('check') : i + 1}</span><span>${esc(task.text)}</span></div>`).join('');
    $('#lesson-feedback').hidden = tasks.length === 0 || lessonDone.size !== tasks.length;
  }
  function evaluateLesson(): void {
    const fr = frame; if (!fr || !scenario.lesson || fixtureId) return;
    const h = fr.procedure.last.inspHold, e = fr.procedure.last.expHold;
    const after = (r: ProcedureResult | null, since: number): boolean => !!r && (r.completedAtMs ?? -1) >= since;
    const timing = deriveVcTiming(fr.settings);
    const tests: Record<string, () => boolean> = {
      validInsp: () => !!h && h.quality === 'valid' && after(h, lessonStartMs) && (scenario.id !== 'SC-P' || Math.abs((h.requestedDurationS ?? 0) - 3) < 0.02),
      validExp: () => !!e && e.quality === 'valid' && after(e, lessonStartMs),
      r20: () => fr.truth.patient.rInsp >= 20,
      holdAfterPatient: () => !!h && h.quality === 'valid' && patientChangeMs >= 0 && (h.completedAtMs ?? 0) > patientChangeMs,
      holdAfter20: () => !!h && h.quality === 'valid' && (h.completedAtMs ?? 0) > 20_000,
      peepChanged: () => settingsChangeMs >= 0 && !!flags.peepChanged,
      te3: () => timing.tExpS >= 3,
      expAfterSettings: () => !!e && e.quality === 'valid' && settingsChangeMs >= 0 && (e.completedAtMs ?? 0) > settingsChangeMs,
      vteBelowSet: () => (fr.metrics.vte?.value ?? 1) < fr.settings.vt * 0.9,
      plimitChanged: () => !!flags.plimitChanged,
      trigger1: () => Math.abs(fr.settings.flowTrigger * 60 - 1) < 1e-6,
      assisted: () => (fr.metrics.rr?.value ?? 0) > fr.settings.rr + 0.5,
      anyHold: () => !!h && after(h, lessonStartMs),
      alarmSeen: () => !!flags.alarmSeen, acknowledged: () => fr.alarms.some((a) => a.acknowledgedAtMs !== null),
      alarmCleared: () => !!flags.alarmSeen && fr.alarmBar.color === 'green',
      invalidHold: () => !!h && h.quality !== 'valid' && after(h, lessonStartMs),
      noEffort: () => !fr.truth.effort.enabled || fr.truth.effort.amplitude === 0,
      fio2Gap: () => fr.settings.fio2 >= 0.99 && (fr.metrics.fio2?.value ?? 1) < 0.985,
      fio2Alarm: () => fr.alarms.some((a) => a.id === 'fio2Low' && a.conditionActive),
      biasZero: () => !!flags.biasWasSet && fr.truth.sensors.fio2Bias === 0,
      basic: () => !!flags.basic, loops: () => !!flags.loops, referenceLoop: () => !!flags.referenceLoop, snapshot: () => !!flags.snapshot,
    };
    if (fr.truth.sensors.fio2Bias !== 0) flags.biasWasSet = true;
    if (fr.alarms.some((a) => a.conditionActive)) flags.alarmActiveSeen = true;
    for (const task of scenario.lesson.tasks) { if (lessonDone.has(task.id)) continue; if (tests[task.test]?.()) { lessonDone.add(task.id); renderLesson(); toast(`Objetivo realizado: ${task.text}`); } break; }
  }

  // ---------- teclas rápidas ----------
  function updateQuick(): void {
    const fr = frame as EngineFrame;
    if (lastQuickSig !== 'vc') { lastQuickSig = 'vc'; $('#quick-controls').innerHTML = `<button class="device-key quick-key mode-key" data-action="modes"><small>Modo actual</small><b id="quick-mode">A/C VC</b></button>` + QUICK_KEYS.map((k) => `<button class="device-key quick-key" data-setting-quick="${k}" data-key="${k}" aria-pressed="false"><small>${k === 'vt' ? 'Volumen tidal' : QUICK_LABEL[k]}</small><b data-quick-val="${k}"></b><em>${k === 'ie' ? '' : unitText(ruleOf(k).displayUnit)}</em></button>`).join('') + `<button class="device-key quick-key standby-key" data-action="standby"><small>EN ESPERA</small>${icon('hand')}</button><button class="device-key quick-key power-key" data-action="powerInfo" aria-label="Estado de alimentación virtual">${icon('plug')}</button>`; }
    const st = edit.state;
    for (const k of QUICK_KEYS) {
      const b = $(`[data-setting-quick="${k}"]`); const sel = st.kind !== 'idle' && st.key === k;
      put(`[data-quick-val="${k}"]`, sel && st.kind === 'editing' ? (st.draftDisplay === 'off' ? 'Off' : k === 'ie' ? ieText(st.draftDisplay) : st.draftDisplay.toFixed(ruleOf(k).decimals)) : displaySetting(k, fr.settings[k]));
      b.classList.toggle('editing', sel); b.setAttribute('aria-pressed', String(sel)); b.classList.toggle('pending', !!fr.pending && k in fr.pending);
    }
    $('#pending-ribbon').hidden = !fr.pending; $('#standby-overlay').hidden = fr.ventilation !== 'standby';
    $('.standby-key').classList.toggle('active-standby', fr.ventilation === 'standby');
  }

  // ---------- editor rápido ----------
  function placeQuickEditor(): void { const editor = $('#quick-editor'), mobile = window.matchMedia('(max-width:700px)').matches; const parent = mobile ? document.body : $('#monitor'); if (editor.parentElement !== parent) parent.append(editor); editor.classList.toggle('mobile-editor', mobile); }
  function openQuick(k: SettingsKey): void {
    if (locked) { toast('Desbloquea los controles para modificar ajustes.'); return; }
    if (!frame) return;
    if (edit.state.kind !== 'idle' && edit.state.key === k) return;
    edit.select(k, performance.now()); collapseHelp();
    const rule = ruleOf(k), input = $<HTMLInputElement>('#quick-value'), range = $<HTMLInputElement>('#quick-range');
    put('#quick-editor-title', QUICK_LABEL[k]); put('#quick-unit', unitText(rule.displayUnit));
    const segs = rule.domain; const min = segs[0]?.min ?? 0, max = segs[segs.length - 1]?.max ?? 0, step = Math.min(...segs.map((s) => s.step));
    if (k === 'ie') { input.type = 'text'; input.readOnly = true; range.disabled = true; range.min = '0'; range.max = String((rule.values?.length ?? 1) - 1); range.step = '1'; }
    else { input.type = 'number'; input.readOnly = false; range.disabled = false; input.min = range.min = String(rule.allowOff ? min - 1 : min); input.max = range.max = String(max); input.step = range.step = String(step); }
    const b = $('#quick-help-button'); b.dataset.helpKey = HELP_KEY[k]; b.setAttribute('aria-expanded', 'false'); $('#quick-explanation').innerHTML = helpContent(HELP_KEY[k]) + '<p id="quick-timing" class="help-timing"></p>'; $('#quick-explanation').hidden = true;
    placeQuickEditor(); $('#quick-editor').hidden = false; renderQuick(); input.focus({ preventScroll: true }); if (k !== 'ie') input.select();
  }
  let typing = false;
  function renderQuick(): void {
    const st = edit.state; if (st.kind === 'idle') { $('#quick-editor').hidden = true; updateQuick(); return; }
    const k = st.key, input = $<HTMLInputElement>('#quick-value'), range = $<HTMLInputElement>('#quick-range');
    const d = st.draftDisplay;
    if (k === 'ie') { input.value = d === 'off' ? '' : ieText(d); range.value = String(Math.max(0, (ruleOf(k).values ?? []).findIndex((v) => Math.abs(v - (d as number)) < 1e-6))); }
    else if (!typing) { input.value = d === 'off' ? '' : String(Math.round(d * 1000) / 1000); range.value = d === 'off' ? range.min : String(d); }
    else range.value = d === 'off' ? range.min : String(d);
    typing = false;
    put('#quick-unit', d === 'off' ? 'Off' : unitText(ruleOf(k).displayUnit));
    const p = edit.preview();
    put('#quick-validation', p.valid ? '' : p.reasons.join(' ')); $('#quick-validation').hidden = p.valid; $('#quick-validation').classList.toggle('invalid', !p.valid);
    const t = p.derived; put('#quick-timing', p.valid && t ? `Con este ajuste: Ti ${f(t.tInspS, 2)} s · Te ${f(t.tExpS, 2)} s · flujo ${f(t.qTargetLps * 60, 1)} L/min` : '');
    ($('[data-action="confirmEdit"]') as HTMLButtonElement).disabled = !p.valid || !p.changed;
    $('#trim-knob').style.setProperty('--knob-angle', `${knobAngle}deg`);
    updateQuick();
  }
  function stepQuick(dir: 1 | -1): void { if (edit.state.kind === 'idle') { toast('Selecciona primero uno de los parámetros inferiores.'); return; } edit.adjust(dir, performance.now()); knobAngle += dir * 12; renderQuick(); }
  function typedQuick(raw: string): void { if (edit.state.kind === 'idle' || edit.state.key === 'ie') return; typing = true; const v = raw.trim() === '' ? NaN : Number(raw); const rule = ruleOf(edit.state.key); const min = rule.domain[0]?.min ?? 0; if (rule.allowOff && (v < min || raw.trim().toLowerCase() === 'off')) edit.setDraftDisplay('off', performance.now()); else edit.setDraftDisplay(Number.isFinite(v) ? v : NaN, performance.now()); renderQuick(); }
  function confirmQuick(): void { if (edit.state.kind === 'idle') return; edit.confirm(); renderQuick(); }
  function cancelQuick(): void { if (edit.state.kind !== 'idle') edit.cancel(); $('#quick-editor').hidden = true; collapseHelp(); if (frame) updateQuick(); }
  edit.on((e) => {
    if (e.type === 'confirmed') { void send({ type: 'confirmSettings', changes: e.changes }).then((r) => { if (r.accepted) { $('#quick-editor').hidden = true; if ('peep' in e.changes) flags.peepChanged = true; if ('plimit' in e.changes) flags.plimitChanged = true; settingsChangeMs = frame?.simTimeMs ?? 0; toast('Ajuste confirmado. Se aplica en la próxima respiración.'); } }); }
    if (e.type === 'rejected') toast(e.reasons.join(' '), true);
    if (e.type === 'cancelled') { $('#quick-editor').hidden = true; if (e.reason === 'timeout') toast('Ajuste cancelado por vencimiento del plazo de edición.', true); if (frame) updateQuick(); }
  });

  // ---------- bloqueos ----------
  function holdOptions(kind: 'inspHold' | 'expHold'): number[] { const r = kind === 'inspHold' ? INSP_HOLD_RULE : EXP_HOLD_RULE; const out: number[] = []; for (const seg of r.domain) for (let v = seg.min; v <= seg.max + 1e-9; v += seg.step) if (!out.includes(v)) out.push(v); return out.filter((v) => [2, 3, 4, 5, 8, 10, 15, 20, 30, 40, 60].includes(v)); }
  function openHold(kind: 'inspHold' | 'expHold'): void { const fr = frame; const active = fr?.procedure.hold; holdType = active ? active.kind : kind; cancelQuick(); const sel = $<HTMLSelectElement>('#hold-duration'); const cur = sel.value; sel.innerHTML = holdOptions(holdType).map((v) => `<option value="${v}" ${v === (Number(cur) || 3) ? 'selected' : ''}>${v} s</option>`).join(''); $('#hold-panel').hidden = false; updateHold(); closeDialog(); }
  function updateHold(): void {
    const fr = frame; if ($('#hold-panel').hidden || !fr) return;
    const active = fr.procedure.hold; if (active) holdType = active.kind;
    const insp = holdType === 'inspHold', key = insp ? 'procedure.inspiratory' : 'procedure.expiratory';
    put('#hold-title', `Bloqueo ${insp ? 'inspiratorio' : 'espiratorio'}`); put('#hold-value-label', insp ? 'Pplat' : 'PEEP total'); put('#hold-second-label', insp ? 'Cstat' : 'PEEPi'); put('#hold-second-unit', insp ? 'mL/cmH₂O' : 'cmH₂O');
    const help = $('#hold-help-button'); if (help.dataset.helpKey !== key) { help.dataset.helpKey = key; $('#hold-help').innerHTML = helpContent(key); $('#hold-help').hidden = true; help.setAttribute('aria-expanded', 'false'); }
    const h = !active ? fr.procedure.last[holdType] : null;
    const v1 = insp ? h?.values.pplat : h?.values.peepTot, v2 = insp ? h?.values.cstat : h?.values.peepi;
    put('#hold-value', h?.quality === 'valid' && v1?.value != null ? f(v1.value, 0) : '—'); put('#hold-second', h?.quality === 'valid' && v2?.value != null ? f(insp ? v2.value * 1000 : v2.value, insp ? 0 : 1) : '—');
    $('#hold-run').innerHTML = icon(active ? 'close' : 'play'); const lbl = active ? 'Cancelar bloqueo' : !running ? 'Reanudar e iniciar bloqueo' : 'Iniciar bloqueo'; $('#hold-run').setAttribute('aria-label', lbl); $('#hold-run').title = lbl; ($('#hold-duration') as HTMLSelectElement).disabled = !!active;
    let text = !running ? 'Pulsa iniciar para reanudar y medir.' : 'Selecciona tiempo y pulsa iniciar.';
    if (active?.phase === 'running') text = `${!running ? 'Pausado · ' : 'Oclusión · '}${f(active.durationS - active.elapsedS, 1)} s restantes`;
    else if (active?.phase === 'queued') text = `Esperando fin de ${insp ? 'inspiración' : 'espiración'}${!running ? ' · simulación pausada' : ''}`;
    else if (h) text = h.quality === 'valid' ? `Medido · ${wallDate(h.wallTimeMs ?? 0)}` : `No válida: ${h.reason ?? ''} · ${wallDate(h.wallTimeMs ?? 0)}`;
    put('#hold-status', text); $('#hold-status').classList.toggle('invalid', !!h && h.quality !== 'valid'); $('#hold-panel').classList.toggle('is-occluding', active?.phase === 'running'); $('#hold-panel').dataset.phase = active?.phase === 'running' ? 'occluding' : active ? 'waiting' : h ? 'measured' : 'ready';
  }

  // ---------- métricas / alarmas / docente / registro ----------
  function limitPair(fr: EngineFrame, key: string): string {
    const L = fr.alarmLimits; const fmt = (v: OffOr<number>, factor: number, d: number): string => (v === 'off' ? 'Off' : (v * factor).toFixed(d));
    switch (key) {
      case 'vte': return `${fmt(L.vteHigh, 1000, 0)}\n${fmt(L.vteLow, 1000, 0)}`;
      case 'mve': return `${fmt(L.mveHigh, 1, 1)}\n${fmt(L.mveLow, 1, 1)}`;
      case 'rr': return `${fmt(L.rrHigh, 1, 0)}\n${fmt(L.rrLow, 1, 0)}`;
      case 'peepe': return L.peepeHigh === 'off' && L.peepeLow === 'off' ? 'Off' : `${fmt(L.peepeHigh, 1, 0)}\n${fmt(L.peepeLow, 1, 0)}`;
      case 'ppeak': return `${fr.settings.pmax}\n${fmt(L.ppeakLow, 1, 0)}`;
      case 'fio2': return `${fmt(L.fio2High, 100, 0)}\n${fmt(L.fio2Low, 100, 0)}`;
      default: return '';
    }
  }
  function updateMetrics(): void {
    const fr = frame as EngineFrame;
    for (const m of METRICS) {
      const el = $(`#numeric-grid [data-metric="${m.key}"]`); put(el.querySelector('.numeric-value'), f(metricValue(m), m.decimals)); put(el.querySelector('.numeric-limits'), limitPair(fr, m.key));
      const lim: Record<string, string[]> = { vte: ['vteLow', 'vteHigh'], mve: ['mveLow', 'mveHigh'], rr: ['rrLow', 'rrHigh'], peepe: ['peepeLow', 'peepeHigh'], ppeak: ['pmax', 'ppeakLow'], fio2: ['fio2Low', 'fio2High'] };
      el.classList.toggle('alarm-value', !!lim[m.key] && fr.alarms.some((a) => a.conditionActive && (lim[m.key] as string[]).includes(a.id)));
      const h = fr.procedure.last.inspHold; put(el.querySelector('.numeric-age'), m.source === 'hold' && h && h.quality === 'valid' ? `Med. ${clock((h.completedAtMs ?? 0) / 1000)}` : '');
    }
    for (const e of $$('#big-metrics [data-metric]')) { const spec = METRICS.find((m) => m.key === e.dataset.metric) as MetricSpec; put(e.querySelector('b'), f(metricValue(spec), spec.decimals)); }
    if (view === 'data') $('#data-table-body').innerHTML = [...METRICS, ...EXTRA_METRICS].map((m) => `<tr><td><button class="metric-name" data-metric="${m.key}">${m.label}${icon('info')}</button></td><td>${f(metricValue(m), m.decimals)}</td><td>${m.unit}</td><td>${esc(metricQuality(m))}</td></tr>`).join('');
  }
  function alarmHTML(): string {
    const fr = frame as EngineFrame; const active = fr.alarms.filter((a) => a.conditionActive), pending = fr.alarms.filter((a) => !a.conditionActive && a.latching && a.resolvedAtMs !== null && a.acknowledgedAtMs === null);
    const row = (a: AlarmState): string => `<div class="alarm-row ${a.conditionActive ? (a.priority === 'high' ? 'high' : 'medium') : 'resolved'}"><span class="alarm-priority">${icon(a.conditionActive ? 'bell' : 'check')}</span><div><b>${esc(a.message)}</b><p>${esc(a.conditionReason)} · canal ${esc(a.source)}${a.rawValueAtOnset !== null ? ` · valor bruto ${f(a.rawValueAtOnset, 2)}` : ''}</p><small>${a.conditionActive ? 'ACTIVA' : 'RESUELTA · PENDIENTE DE RECONOCER'} · ${clock((a.onsetAtMs ?? 0) / 1000)}${a.acknowledgedAtMs !== null ? ' · reconocida' : ''} · prioridad ${a.priority}</small></div></div>`;
    const items = [...active, ...pending]; return items.length ? items.map(row).join('') : '<p class="empty-note">No hay alarmas activas ni eventos pendientes de reconocimiento.</p>';
  }
  function updateAlarm(): void {
    const fr = frame as EngineFrame; const bar = fr.alarmBar; const lev = bar.color === 'red' ? 'high' : bar.color === 'yellow' ? 'medium' : bar.color === 'grey' ? 'previous' : '';
    $('#alarm-band').className = 'alarm-band ' + lev; $('#bezel-light').className = 'bezel-light ' + (lev === 'previous' ? '' : lev);
    put('#alarm-label', bar.color === 'grey' ? 'Alarmas resueltas' : bar.message);
    const audioTxt = audio.enabled ? 'audio habilitado' : 'audio apagado';
    put('#alarm-detail', fr.ventilation === 'standby' ? 'En espera' : bar.activeCount ? `${bar.activeCount} activa${bar.activeCount === 1 ? '' : 's'} · ${audioTxt}` : bar.pendingAckCount ? 'Reconocer eventos anteriores' : `${audioTxt[0]!.toUpperCase() + audioTxt.slice(1)} · Simulación`);
    const muteLeft = fr.audioPauseUntilMs !== null ? fr.audioPauseUntilMs - fr.simTimeMs : 0; put('#mute-time', muteLeft > 0 ? clock(Math.ceil(muteLeft / 1000)) : '');
    if (bar.activeCount) flags.alarmSeen = flags.alarmSeen || dialogKind === 'alarms';
    const sig = JSON.stringify(fr.alarms.map((a) => [a.id, a.conditionActive, a.acknowledgedAtMs])); if (dialogKind === 'alarms' && sig !== alarmSignature) { alarmSignature = sig; const el = document.getElementById('live-alarms'); if (el) el.innerHTML = alarmHTML(); }
    audio.pausedUntilMs = fr.audioPauseUntilMs; const top = fr.alarms.filter((a) => a.conditionActive).sort((a, b) => (a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0))[0]; if (running) audio.drive(top ? top.priority : null, fr.simTimeMs);
  }
  function updateTeacher(): void {
    const fr = frame as EngineFrame;
    for (const [k, sp] of Object.entries(PHYS)) { const n = $<HTMLInputElement>(`[data-phys-number="${k}"]`), r = $<HTMLInputElement>(`[data-phys-range="${k}"]`); const v = sp.get(fr); if (document.activeElement !== n && document.activeElement !== r) { n.value = String(Math.round(v * 100) / 100); r.value = String(v); } r.style.setProperty('--fill', `${(100 * (Number(r.value) - sp.min)) / (sp.max - sp.min)}%`); }
    const p = fr.truth.patient; put('#truth-tau', `${f(p.rExp * p.crs, 2)} s`); put('#truth-auto', `${f(fr.truth.peepiEndExp, 1)} cmH₂O`); put('#truth-vabs', `${f(fr.truth.vAbsL * 1000, 0)} mL`); put('#truth-o2', `${f(fr.truth.fio2Delivered * 100, 0)} / ${f((fr.metrics.fio2?.value ?? 0) * 100, 1)} %`); put('#muscle-value', `${f(fr.truth.pmus, 1)} cmH₂O`);
    for (const [id, on] of [['apnea', !fr.truth.effort.enabled || fr.truth.effort.amplitude === 0], ['obstruction', fr.truth.patient.rInsp >= 300]] as [string, boolean][]) { const e = document.getElementById(`event-${id}`); e?.classList.toggle('active', on); e?.setAttribute('aria-pressed', String(on)); }
    ($('#undo-event') as HTMLButtonElement).disabled = eventUndo.length === 0;
  }
  function eventText(e: EngineFrame['eventsTail'][number]): string { const p = e.payload as Record<string, unknown>; return `${e.actor} · ${JSON.stringify(p).slice(0, 140)}`; }
  function updateLogs(): void {
    const fr = frame as EngineFrame; const last = fr.eventsTail[fr.eventsTail.length - 1]; const sig = `${fr.eventsTail.length}:${last?.sequence}`; if (sig === logSignature) return; logSignature = sig;
    const events = [...fr.eventsTail].reverse();
    $('#device-event-log').innerHTML = events.map((e) => `<div class="event-log-row ${e.kind === 'alarm' ? 'alert-event' : ''}"><time>${clock(e.simTimeMs / 1000)}</time><span>${esc(e.kind)}</span><span>${esc(eventText(e))}</span></div>`).join('');
    put('#log-count', `${events.length} eventos visibles`); $('#teacher-log').innerHTML = events.slice(0, 8).map((e) => `<div class="teacher-event"><time>${clock(e.simTimeMs / 1000)}</time><span>${esc(e.kind)} · ${esc(JSON.stringify(e.payload).slice(0, 80))}</span></div>`).join('');
  }
  function updateUI(): void {
    const fr = frame; if (!fr) return;
    put('#scenario-name', fixtureId ? `Referencia fotográfica ${fixtureId} (transcripción, sin motor)` : scenario.name); put('#scenario-sub', `Adulto virtual · A/C VC${fr.pending ? ' · ajustes pendientes' : ''}`);
    const phase: Record<string, string> = { inspFlow: 'Inspiración', inspLimited: 'Inspiración · Plimit', inspPause: 'Pausa inspiratoria', exp: 'Espiración', holdInsp: 'Bloqueo inspiratorio', holdExp: 'Bloqueo espiratorio', standby: 'En espera' };
    put('#phase-status', !running ? `SIMULACIÓN PAUSADA${pauseReason ? ' · ' + pauseReason : ''}` : fr.ventilation === 'standby' ? 'En espera' : phase[fr.live.phase] ?? fr.live.phase);
    put('#monitor-clock', clock(fr.simTimeMs / 1000)); put('#simulation-clock', `Sesión ${clock(fr.simTimeMs / 1000)} · ${speed}×${!running ? ' · pausada' : ''}${discontinuities.length ? ` · ${discontinuities.length} discontinuidad(es)` : ''}`);
    $('#live-dot').classList.toggle('paused', !running); $('#sim-pause').innerHTML = icon(running ? 'pause' : 'play') + `<span>${running ? 'Pausar' : 'Reanudar'}</span>`; $('#sim-pause').setAttribute('aria-label', running ? 'Pausar simulación' : 'Reanudar simulación'); ($('#sim-speed') as HTMLSelectElement).value = String(speed);
    const o2 = fr.procedure.o2; $('#o2-key').classList.toggle('o2-active', !!o2?.active); put('#o2-time', o2?.active ? clock(Math.ceil((o2.endsAtMs - fr.simTimeMs) / 1000)) : '');
    updateMetrics(); updateQuick(); updateAlarm(); updateHold(); updateTeacher(); updateLogs(); evaluateLesson();
  }

  // ---------- ingesta de cuadros ----------
  function ingest(fr: EngineFrame, m: { running: boolean; speed: number; pauseReason: string | null; discontinuities: Discontinuity[] }): void {
    const prev = frame; frame = fr; running = m.running; speed = m.speed; pauseReason = m.pauseReason; discontinuities = m.discontinuities;
    const s = fr.samples; const lastT = points[points.length - 1]?.[0] ?? -1;
    for (let i = 0; i < s.t.length; i += 5) { const t = (s.t[i] as number) / 1000; if (t <= lastT) continue; points.push([t, s.paw[i] as number, (s.flow[i] as number) * 60, (s.vol[i] as number) * 1000, s.pmus[i] as number, s.breath[i] as number]); }
    if (points.length > 6000) points.splice(0, points.length - 6000);
    if (prev && JSON.stringify(prev.truth.patient) !== JSON.stringify(fr.truth.patient)) patientChangeMs = fr.simTimeMs;
    if (prev && prev.simTimeMs > fr.simTimeMs) { points = []; loopReference = null; }
    dirty = true; updateUI();
  }
  function activeTrace(): { pts: Point[]; end: number } { return { pts: frozen ? frozenPoints : points, end: frozen ? reviewEnd : simS() }; }
  function renderPlots(): void {
    const fr = frame; if (!fr) return; const { pts, end } = activeTrace(); const peep = fr.settings.peep === 'off' ? 0 : fr.settings.peep, vtMl = fr.settings.vt * 1000;
    if (view === 'waves') drawWave($<HTMLCanvasElement>('#waves-canvas'), pts, end, peep, vtMl, { window: waveWindow, style: waveStyle, frozen, cursorTime });
    else if (view === 'basic') drawWave($<HTMLCanvasElement>('#basic-wave-canvas'), pts, end, peep, vtMl, { window: waveWindow, style: waveStyle, single: true, frozen });
    else if (view === 'loops') { drawLoop($<HTMLCanvasElement>('#pv-canvas'), pts, loopReference, peep, vtMl, 'pv'); drawLoop($<HTMLCanvasElement>('#fv-canvas'), pts, loopReference, peep, vtMl, 'fv'); }
    else if (view === 'trends') drawTrends($<HTMLCanvasElement>('#trends-canvas'), fr.trends.map((t) => ({ t: t.tMs / 1000, ppeak: t.ppeak, peep: t.peepe, vte: t.vte * 1000, rr: t.rr })), simS());
    drawGauge($<HTMLCanvasElement>('#gauge-canvas'), { paw: fr.live.paw, pmax: fr.settings.pmax, ppeak: fr.metrics.ppeak?.value ?? fr.live.ppeakCurrent, peep, standby: fr.ventilation === 'standby', vteMl: fr.metrics.vte?.value == null ? null : fr.metrics.vte.value * 1000, fio2Pct: fr.metrics.fio2?.value == null ? null : fr.metrics.fio2.value * 100 });
    if (teacherVisible) drawMuscle($<HTMLCanvasElement>('#muscle-canvas'), points, simS());
  }
  function tick(now: number): void { if (frame && !document.hidden && now - lastPlot > 32 && dirty) { lastPlot = now; renderPlots(); dirty = false; } requestAnimationFrame(tick); }
  function switchView(v: string): void { if (!['waves', 'basic', 'loops', 'data', 'trends', 'log'].includes(v)) return; view = v as ViewId; for (const e of $$('[data-view-panel]')) e.classList.toggle('active', e.dataset.viewPanel === v); for (const b of $$('[data-view]')) { b.classList.toggle('chosen', b.dataset.view === v); b.setAttribute('aria-pressed', String(b.dataset.view === v)); } flags[v] = true; dirty = true; updateUI(); }
  function switchInstructor(tab: string): void { for (const e of $$('[data-instructor]')) { const on = e.dataset.instructor === tab; e.classList.toggle('active', on); e.setAttribute('aria-selected', String(on)); } for (const id of ['patient', 'learn', 'events']) $('#instructor-' + id).classList.toggle('active', id === tab); }
  function toggleFreeze(): void { frozen = !frozen; cursorTime = null; if (frozen) { frozenPoints = points.map((x) => [...x] as Point); freezeEnd = simS(); reviewEnd = freezeEnd; ($('#history-slider') as HTMLInputElement).value = '1000'; put('#inspector-label', 'Curvas congeladas; los números siguen en vivo. Arrastra la historia o mueve el cursor sobre una curva.'); } else frozenPoints = []; $('#signal-inspector').hidden = !frozen; $('#frozen-ribbon').hidden = !frozen; $('#freeze-button').innerHTML = icon(frozen ? 'play' : 'pause') + `<span>${frozen ? 'Reanudar curvas' : 'Congelar curvas'}</span>`; $('#freeze-button').classList.toggle('active', frozen); dirty = true; }

  // ---------- diálogos ----------
  function openDialog(kind: string, title: string, html: string, footer = '', size = ''): void { dialogKind = kind; $('#app-dialog').className = 'app-dialog ' + size; put('#dialog-title', title); put('#dialog-eyebrow', 'R860 LAB · SIMULACIÓN EDUCATIVA'); $('#dialog-content').innerHTML = html; $('#dialog-footer').innerHTML = footer || btn('Cerrar', 'closeDialog', 'secondary-button'); const d = $<HTMLDialogElement>('#app-dialog'); if (!d.open) d.showModal(); alarmSignature = ''; }
  function closeDialog(): void { const d = $<HTMLDialogElement>('#app-dialog'); if (d.open) d.close(); dialogKind = ''; modeDraft = null; limitsDraft = null; }
  function menu(): void { openDialog('menu', 'Menú', `<div class="menu-grid">${[['modes', 'wave', 'Modo y ajustes', 'Volumen, límites de presión y sincronización'], ['alarmSetup', 'bell', 'Alarmas', 'Límites y condiciones activas'], ['tools', 'lung', 'Mecánica y procedimientos', 'Bloqueos y mediciones'], ['patient', 'person', 'Adulto virtual', 'Perfil sintético'], ['session', 'download', 'Sesión y archivos', 'Guardar, continuar y exportar'], ['scenarios', 'grid', 'Escenarios', 'Prácticas guiadas'], ['help', 'book', 'Guía y alcance', 'Uso, modelo y fuentes']].map(([a, i, l, d]) => `<button class="menu-entry" data-action="${a}">${icon(i as string)}<span><b>${l}</b><small>${d}</small></span>${icon('arrow')}</button>`).join('')}</div>`); }
  function fieldHTML(k: SettingsKey, s: VcSettings): string {
    const rule = ruleOf(k), id = `help-setting-${k}`, v = s[k];
    if (rule.unit === 'boolean') return `<div class="full-span"><div class="parameter-label"><label class="checkline"><input type="checkbox" data-mode-field="${k}" ${v ? 'checked' : ''}> ${QUICK_LABEL[k]}</label>${infoButton(HELP_KEY[k], id)}</div>${infoPanel(HELP_KEY[k], id)}</div>`;
    if (k === 'ie') return `<div class="setting-field"><div class="parameter-label"><label for="setting-ie">I:E</label>${infoButton(HELP_KEY[k], id)}</div><div class="setting-input"><select id="setting-ie" data-mode-field="ie">${(rule.values ?? []).map((r) => `<option value="${r}" ${Math.abs(r - (v as number)) < 1e-6 ? 'selected' : ''}>${ieText(r)}</option>`).join('')}</select></div>${infoPanel(HELP_KEY[k], id)}</div>`;
    const segs = rule.domain; const min = segs[0]?.min ?? 0, max = segs[segs.length - 1]?.max ?? 0, step = Math.min(...segs.map((x) => x.step));
    const display = v === 'off' ? '' : (v as number) * rule.displayFactor;
    return `<div class="setting-field"><div class="parameter-label"><label for="setting-${k}">${QUICK_LABEL[k]}</label>${infoButton(HELP_KEY[k], id)}</div><div class="setting-input"><input id="setting-${k}" type="number" data-mode-field="${k}" value="${display}" min="${rule.allowOff ? 0 : min}" max="${max}" step="${step}" placeholder="${rule.allowOff ? 'Off' : ''}"><small>${unitText(rule.displayUnit)}</small></div>${infoPanel(HELP_KEY[k], id)}</div>`;
  }
  function modeFields(): string { const s = modeDraft as VcSettings; const main: SettingsKey[] = ['fio2', 'peep', 'vt', 'rr', 'ie', 'pausePct', 'plimit', 'pmax']; return `<div class="mode-description"><div class="parameter-label"><h3>Asistido / controlado por volumen</h3></div><p class="settings-annotation">Flujo constante calculado de VT, Tinsp y pausa. Plimit sostiene la presión el resto de la inspiración; Pmáx termina la inspiración.</p></div><div class="settings-grid">${main.map((k) => fieldHTML(k, s)).join('')}<div class="settings-subtitle">Sincronización</div>${fieldHTML('flowTrigger', s)}${fieldHTML('assistControl', s)}</div><div id="mode-timing" class="mode-timing"></div><div id="mode-error" class="mode-error" role="status"></div>`; }
  function openModes(): void { if (!frame) return; modeDraft = { ...frame.settings, ...(frame.pending ?? {}) }; cancelQuick(); renderModes(); }
  function renderModes(): void {
    const others = [['A/C PC', 'Pendiente de banco (BM-03 con rampa real)'], ['CPAP/PS', 'Pendiente de banco (esfuerzo, disparo, ciclaje, respaldo)'], ['A/C PRVC', 'Algoritmo adaptativo no publicado'], ['SIMV VC / PC', 'Fase siguiente'], ['BiLevel / APRV / NIV', 'Opciones y versión no verificadas']];
    openDialog('modes', 'Modo y ajustes de ventilación', `<div class="mode-layout"><nav class="mode-list" aria-label="Modos ventilatorios"><button class="mode-option selected" data-mode="AC_VC"><b>A/C VC</b></button>${others.map(([m, why]) => `<button class="mode-option" disabled title="${esc(why)}"><b>${m}</b><small>${esc(why)}</small></button>`).join('')}</nav><div id="mode-fields">${modeFields()}</div></div>`, btn('Cancelar', 'closeDialog', 'secondary-button') + btn('Confirmar ajustes', 'confirmModes'), 'wide'); validateMode();
  }
  function validateMode(): { ok: boolean; errors: string[] } { const s = modeDraft; if (!s) return { ok: false, errors: [] }; const errors = [...validateDomains(s, VC_ADULT_RULES), ...validateVcSettings(s, VC_ADULT_CROSS_LIMITS).reasons]; const t = deriveVcTiming(s); put('#mode-timing', `Ti ${f(t.tInspS, 2)} s · Te ${f(t.tExpS, 2)} s · ciclo ${f(t.tCycleS, 2)} s · flujo ${f(t.qTargetLps * 60, 1)} L/min`); put('#mode-error', errors.join(' ')); const b = document.querySelector<HTMLButtonElement>('[data-action="confirmModes"]'); if (b) b.disabled = errors.length > 0; return { ok: errors.length === 0, errors }; }
  function readModeField(el: HTMLInputElement | HTMLSelectElement): void { const k = el.dataset.modeField as SettingsKey; if (!modeDraft) return; const rule = ruleOf(k); if (rule.unit === 'boolean') (modeDraft as unknown as Record<string, unknown>)[k] = (el as HTMLInputElement).checked; else if (k === 'ie') modeDraft.ie = Number(el.value); else { const raw = el.value.trim(); if (rule.allowOff && (raw === '' || Number(raw) <= 0)) (modeDraft as unknown as Record<string, unknown>)[k] = 'off'; else (modeDraft as unknown as Record<string, unknown>)[k] = Number(raw) / rule.displayFactor; } validateMode(); }
  function showScenarios(): void { openDialog('scenarios', 'Elige un escenario de entrenamiento', `<p class="dialog-lead">Pulmones sintéticos y secuencias de práctica. Cargar uno inicia una sesión nueva; guarda la actual antes de reemplazarla.</p><div class="scenario-grid">${SCENARIOS.map((s) => `<button class="scenario-card ${scenario.id === s.id ? 'selected' : ''}" data-scenario="${s.id}"><div><span>${esc(s.category ?? 'Escenario')}</span><small>Nivel ${s.level ?? 1}</small></div><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><footer>A/C VC · C ${Math.round(s.patient.crs * 1000)} · R ${s.patient.rInsp}/${s.patient.rExp}</footer></button>`).join('')}</div>`, btn('Cancelar', 'closeDialog', 'secondary-button'), 'wide'); }
  function loadScenario(id: string): void { const sc = findScenario(id); if (!sc) return; scenario = sc; fixtureId = null; closeDialog(); cancelQuick(); $('#hold-panel').hidden = true; locked = false; $('#lock-overlay').hidden = true; eventUndo.length = 0; logSignature = ''; points = []; loopReference = null; if (frozen) toggleFreeze(); client.loadScenario(sc, false); lessonReset(); switchView('waves'); $('#global-notice').hidden = true; toast(`${sc.name}: ${sc.observe}`); }
  async function setPhys(cmds: Command[], undo: Command[] | null): Promise<boolean> { let ok = true; for (const c of cmds) { const r = await send(c, 'instructor'); ok = ok && r.accepted; } if (ok && undo) eventUndo.push(undo); return ok; }
  async function fault(kind: string): Promise<void> {
    const fr = frame; if (!fr) return; const p = fr.truth.patient, e = fr.truth.effort;
    if (kind === 'resistance') await setPhys([{ type: 'setPatient', params: { rInsp: Math.min(100, p.rInsp * 2), rExp: Math.min(150, p.rExp * 2) } }], [{ type: 'setPatient', params: { rInsp: p.rInsp, rExp: p.rExp } }]);
    else if (kind === 'compliance') await setPhys([{ type: 'setPatient', params: { crs: Math.max(0.005, p.crs / 2) } }], [{ type: 'setPatient', params: { crs: p.crs } }]);
    else if (kind === 'apnea') { const on = e.enabled && e.amplitude > 0; await setPhys([{ type: 'setEffort', params: on ? { enabled: false } : { enabled: true, amplitude: e.amplitude > 0 ? e.amplitude : 6 } }], [{ type: 'setEffort', params: { enabled: e.enabled, amplitude: e.amplitude } }]); }
    else if (kind === 'obstruction') { const on = p.rInsp >= 300; await setPhys([{ type: 'setPatient', params: { rInsp: on ? 10 : 400 } }], [{ type: 'setPatient', params: { rInsp: p.rInsp } }]); }
    else toast('Fuga y desconexión no están modeladas en esta etapa.', true);
  }
  function alarms(): void { flags.alarmSeen = true; openDialog('alarms', 'Alarmas y reconocimiento', `<div class="context-help-row"><span>Información sobre alarmas</span>${infoButton('procedure.alarms', 'help-alarms')}</div>${infoPanel('procedure.alarms', 'help-alarms')}<div id="live-alarms" class="alarm-list">${alarmHTML()}</div>`, btn('Límites', 'alarmSetup', 'secondary-button') + btn('Silenciar 120 s', 'mute', 'secondary-button') + btn('Reconocer', 'acknowledge')); }
  function alarmSetup(): void {
    if (!frame) return; limitsDraft = { ...frame.alarmLimits };
    const rows: [string, string, keyof AlarmLimits | null, keyof AlarmLimits | null][] = [['VTesp', 'mL', 'vteLow', 'vteHigh'], ['VMesp', 'L/min', 'mveLow', 'mveHigh'], ['Frecuencia', '/min', 'rrLow', 'rrHigh'], ['PEEPe', 'cmH₂O', 'peepeLow', 'peepeHigh'], ['FiO₂', '%', 'fio2Low', 'fio2High'], ['Ppico', 'cmH₂O', 'ppeakLow', null]];
    const cell = (k: keyof AlarmLimits | null, label: string, which: string): string => { if (!k) return `<span class="settings-annotation">Pmáx ${frame?.settings.pmax}</span>`; const r = ALARM_LIMIT_RULES[k]; const v = limitsDraft![k]; return `<input class="form-control" type="number" data-limit="${k}" value="${v === 'off' ? '' : (v as number) * r.displayFactor}" placeholder="Off" step="${Math.min(...r.domain.map((s) => s.step))}" aria-label="${label} ${which}">`; };
    openDialog('alarmSetup', 'Límites de alarma', `<div class="context-help-row"><span>Información sobre límites</span>${infoButton('procedure.alarms', 'help-alarm-limits')}</div>${infoPanel('procedure.alarms', 'help-alarm-limits')}<div class="alarm-edit-grid"><b>Parámetro</b><b>Bajo</b><b>Alto</b>${rows.map(([label, u, lo, hi]) => `<label>${label}<small>${u}</small></label>${cell(lo, label, 'bajo')}${cell(hi, label, 'alto')}`).join('')}</div><p class="settings-annotation">Vacío = Off (la alarma no se evalúa). Pmáx se ajusta en la tecla rápida y termina la inspiración.</p><div id="limits-error" class="mode-error" role="status"></div>`, btn('Ver alarmas', 'alarms', 'secondary-button') + btn('Confirmar límites', 'confirmLimits'));
  }
  function readLimits(): string[] { const errors: string[] = []; if (!limitsDraft) return ['sin borrador']; for (const el of $$<HTMLInputElement>('[data-limit]')) { const k = el.dataset.limit as keyof AlarmLimits; const r = ALARM_LIMIT_RULES[k]; const raw = el.value.trim(); if (raw === '') { limitsDraft[k] = 'off'; continue; } const v = Number(raw); if (!Number.isFinite(v) || !isOnGrid(r, v)) errors.push(`${r.label}: ${raw} fuera de rango o rejilla`); else (limitsDraft as unknown as Record<string, unknown>)[k] = v / r.displayFactor; } put('#limits-error', errors.join(' ')); const b = document.querySelector<HTMLButtonElement>('[data-action="confirmLimits"]'); if (b) b.disabled = errors.length > 0; return errors; }
  function patientDialog(): void { openDialog('patient', 'Paciente virtual · adulto', `<p class="dialog-lead">Perfil sintético de referencia (ID SIM-0001). No introduzcas información de personas reales.</p><div class="info-box">Población adulta · A/C VC · sin talla, peso ni tipo de tubo en esta etapa.</div><p class="settings-annotation">Esta versión no implementa perfiles pediátricos o neonatales, humidificador, tubo endotraqueal ni caja torácica separada.</p>`, btn('Cerrar', 'closeDialog', 'secondary-button'), 'compact'); }
  function standbyDialog(): void { if (frame?.ventilation === 'standby') { void send({ type: 'startVentilation' }); return; } openDialog('standby', '¿Pasar a espera virtual?', `<div class="notice-box">Se detendrá la entrega de respiraciones y la monitorización. El pulmón se vacía hacia presión ambiente; no se simulan consecuencias clínicas.</div><p><b>Pausar simulación</b> detiene el reloj completo. <b>Congelar curvas</b> detiene sólo el dibujo. <b>En espera</b> detiene la ventilación virtual, no el reloj.</p>`, btn('Cancelar', 'closeDialog', 'secondary-button') + btn('Pasar a espera', 'confirmStandby'), 'compact'); }
  function oxygenDialog(): void { const o2 = frame?.procedure.o2; openDialog('oxygen', 'Oxígeno temporal', `<div class="info-box">${o2?.active ? `Activo: ${Math.round(o2.targetFio2 * 100)} % · quedan ${clock(Math.ceil((o2.endsAtMs - (frame?.simTimeMs ?? 0)) / 1000))}.` : 'Elevar temporalmente FiO₂ al 100 % durante 120 segundos de simulación.'}</div><p>Al terminar regresa al ajuste vigente. Si confirmas otra FiO₂ durante el procedimiento, esa edición prevalece. El sensor de O₂ responde con retardo; no se calcula saturación.</p>`, btn('Cancelar', 'closeDialog', 'secondary-button') + (o2?.active ? btn('Finalizar incremento', 'stopOxygen') : btn('Iniciar 100 % · 120 s', 'startOxygen')), 'compact'); }
  function tools(): void { openDialog('tools', 'Mecánica y procedimientos', `<div class="tools-grid">${[['inspiratory', 'Bloqueo inspiratorio', 'Mide Pplat y estima Cstat cuando la meseta es válida.'], ['expiratory', 'Bloqueo espiratorio', 'Mide la presión total al final de la espiración y la PEEPi.'], ['manual', 'Respiración manual', 'Solicita una respiración obligatoria adicional durante la espiración.'], ['mechanics', 'Mecánica respiratoria', 'Consulta la última maniobra, su calidad y su hora.']].map(([a, l, t]) => `<button class="tool-card" data-action="${a}"><h3>${l}</h3><p>${t}</p>${icon('arrow')}</button>`).join('')}</div>`); }
  function mechanics(metric: string | null = null): void {
    if (metric) { const entry = [...METRICS, ...EXTRA_METRICS].find((x) => x.key === metric); if (!entry) return; openDialog('measurement', helpEntry(METRIC_HELP[metric] ?? '')?.title ?? entry.label, `<div class="measurement-summary"><strong>${f(metricValue(entry), entry.decimals)} <small>${entry.unit}</small></strong><span>${esc(metricQuality(entry))}</span></div><div class="measurement-explanation">${helpContent(METRIC_HELP[metric] ?? '')}</div>`, btn('Cerrar', 'closeDialog', 'secondary-button'), 'compact'); return; }
    const rows = [...METRICS, ...EXTRA_METRICS].filter((x) => ['pplat', 'cstat', 'driving', 'peepe', 'vti', 'vte', 'pplatCycle'].includes(x.key));
    openDialog('mechanics', 'Mecánica respiratoria', `<table class="info-table"><thead><tr><th>Dato</th><th>Resultado</th><th>Medición</th></tr></thead><tbody>${rows.map((m) => `<tr><td><button class="metric-name" data-metric="${m.key}">${m.label}${icon('info')}</button></td><td>${f(metricValue(m), m.decimals)} ${m.unit}</td><td>${esc(metricQuality(m))}</td></tr>`).join('')}</tbody></table><div class="context-help-row"><span>Cómo se obtiene Cstat</span>${infoButton('metric.cstat', 'help-mechanics')}</div>${infoPanel('metric.cstat', 'help-mechanics')}`, btn('Bloqueo espiratorio', 'expiratory', 'secondary-button') + btn('Bloqueo inspiratorio', 'inspiratory'), 'wide');
  }
  function sessionDialog(): void { openDialog('session', 'Sesión y exportaciones', `<p class="dialog-lead">Los archivos contienen exclusivamente el escenario virtual y sus acciones. Todo se procesa en este navegador; no hay servidor ni telemetría.</p><div class="session-actions">${[['exportSession', 'download', 'Guardar sesión JSON', 'Inicialización y comandos para reproducir exactamente la sesión.'], ['importSession', 'upload', 'Abrir sesión JSON', 'Se valida y se reproduce en pausa; no ejecuta código.'], ['csv', 'table', 'Exportar tendencias CSV', 'Un registro por ciclo completo.'], ['signalCSV', 'wave', 'Exportar señal CSV', 'Hasta 120 s de presión, flujo, volumen y esfuerzo a 50 Hz.'], ['snapshot', 'camera', 'Captura PNG', 'Monitor renderizado con marca de simulación.'], ['debrief', 'book', 'Resumen de práctica', 'Objetivos, ajustes y cronología de la sesión.']].map(([a, i, l, d]) => `<button class="menu-entry" data-action="${a}">${icon(i as string)}<span><b>${l}</b><small>${d}</small></span></button>`).join('')}</div><div class="session-facts"><span>Escenario: <b>${esc(scenario.name)}</b></span><span>Tiempo: <b>${clock(simS())}</b></span><span>Motor ${ENGINE_VERSION} · perfil ${PROFILE.profileVersion}</span></div>`, btn('Cerrar', 'closeDialog', 'secondary-button'), 'wide'); }
  async function exportSession(): Promise<void> { const file = await client.exportSession(); download(new Blob([JSON.stringify(file)], { type: 'application/json' }), `R860_sesion_${stamp()}.json`); toast(`Sesión guardada (${file.commands.length} comandos, ${file.breaths.length} respiraciones).`); }
  function csvCell(v: unknown): string { if (v === null || v === undefined) return ''; return `"${String(v).replace(/"/g, '""')}"`; }
  function exportCSV(signal: boolean): void {
    const fr = frame; if (!fr) return; let header: string[], rows: unknown[][];
    if (signal) { header = ['tiempo_s', 'Paw_cmH2O', 'flujo_L_min', 'volumen_mL', 'Pmus_cmH2O', 'ciclo']; rows = points.map((p) => [...p]); }
    else { header = ['tiempo_s', 'tipo', 'Ppico_cmH2O', 'PEEPe_cmH2O', 'VTi_mL', 'VTe_mL', 'FR_min', 'VM_L_min', 'Pplat_bloqueo_cmH2O', 'Cstat_bloqueo_mL_cmH2O']; rows = fr.trends.map((t) => [t.tMs / 1000, t.type, t.ppeak, t.peepe, t.vti * 1000, t.vte * 1000, t.rr, t.mve, t.pplatHold, t.cstatHold === null ? null : t.cstatHold * 1000]); }
    download(new Blob(['﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `R860_${signal ? 'senal' : 'tendencias'}_${stamp()}.csv`); toast(`${rows.length} filas exportadas.`);
  }
  function snapshot(): void {
    const fr = frame; if (!fr) return; renderPlots();
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1050; const ctx = c.getContext('2d') as CanvasRenderingContext2D; ctx.scale(1600 / 1120, 1050 / 735);
    const bg = ctx.createLinearGradient(0, 0, 1120, 735); bg.addColorStop(0, '#004bae'); bg.addColorStop(1, '#0349a1'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 1120, 735);
    const txt = (s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', weight = 'normal'): void => { ctx.fillStyle = color; ctx.textAlign = align; ctx.font = `${weight} ${size}px Arial,sans-serif`; ctx.fillText(s, x, y); };
    const bar = fr.alarmBar; ctx.fillStyle = bar.color === 'red' ? '#b91d36' : bar.color === 'yellow' ? '#ba891c' : bar.color === 'grey' ? '#738090' : '#119c78'; ctx.fillRect(8, 7, 1104, 70); txt(bar.message, 30, 33, 17, '#f4fff6'); txt('SIMULACIÓN EDUCATIVA · NO USO CLÍNICO', 30, 60, 10, '#d0f2e1');
    const wc = $<HTMLCanvasElement>(view === 'basic' ? '#basic-wave-canvas' : '#waves-canvas'); ctx.drawImage(wc, 0, 0, wc.width, wc.height, 8, 88, 608, view === 'basic' ? 138 : 488);
    METRICS.forEach((m, i) => { const x = 645 + (i % 2) * 147, y = 110 + Math.floor(i / 2) * 77; txt(m.label, x, y, 12, '#a8defb'); txt(f(metricValue(m), m.decimals), x, y + 33, 32, '#eeffff', 'left', '600'); txt(m.unit, x, y + 50, 9, '#a8ddf5'); });
    const g = $<HTMLCanvasElement>('#gauge-canvas'); ctx.drawImage(g, 0, 0, g.width, g.height, 971, 87, 140, 488);
    const h = fr.procedure.last.inspHold; if (h && !$('#hold-panel').hidden) { ctx.fillStyle = '#246caf'; ctx.fillRect(750, 89, 354, 112); ctx.strokeStyle = '#91c6e7'; ctx.strokeRect(750, 89, 354, 112); txt('Bloqueo inspiratorio', 765, 109, 12, '#dcf5ff'); txt(h.quality === 'valid' ? `Pplat ${f(h.values.pplat?.value ?? null, 0)} cmH₂O · Cstat ${f((h.values.cstat?.value ?? 0) * 1000, 0)} mL/cmH₂O` : `No válida: ${h.reason ?? ''}`, 765, 140, 16, '#eefcff'); txt(wallDate(h.wallTimeMs ?? 0), 765, 170, 12, '#c3e5f7'); }
    ctx.fillStyle = '#072d63'; ctx.fillRect(8, 583, 1104, 56); txt(`Tiempo simulado ${clock(simS())} · ${scenario.name}`, 27, 615, 13, '#acd0e6'); txt('R860 LAB · datos de un modelo sintético · no reproduce firmware GE', 1100, 615, 12, '#c0e4f4', 'right');
    let x = 8; const items: [string, string][] = [['Modo actual', 'A/C VC'], ...QUICK_KEYS.map((k) => [QUICK_LABEL[k], displaySetting(k, fr.settings[k]) + (k === 'ie' ? '' : ' ' + unitText(ruleOf(k).displayUnit))] as [string, string])];
    items.forEach((v, i) => { const width = i === 0 ? 169 : 155; const gr = ctx.createLinearGradient(0, 645, 0, 725); gr.addColorStop(0, '#266aac'); gr.addColorStop(1, '#0b3977'); ctx.fillStyle = gr; ctx.fillRect(x, 645, width, 80); txt(v[0], x + width / 2, 662, 11, '#acddfc', 'center'); txt(v[1], x + width / 2, 700, 24, '#edffff', 'center', '600'); x += width + 2; });
    c.toBlob((blob) => { if (!blob) { toast('No se pudo crear la imagen.', true); return; } download(blob, `R860_monitor_${stamp()}.png`); flags.snapshot = true; evaluateLesson(); toast('Captura guardada.'); }, 'image/png');
  }
  function debriefText(): string { const fr = frame as EngineFrame; const tasks = scenario.lesson?.tasks ?? []; return `R860 LAB · RESUMEN DE PRÁCTICA\nSIMULACIÓN EDUCATIVA · NO USO CLÍNICO\n\nEscenario: ${scenario.name}\nTiempo simulado: ${clock(simS())}\nModo: A/C VC\nObjetivos de interfaz: ${lessonDone.size}/${tasks.length}\n\n${tasks.map((x) => `${lessonDone.has(x.id) ? '[Realizado]' : '[Pendiente]'} ${x.text}`).join('\n')}\n\nAJUSTES\n${JSON.stringify(fr.settings, null, 2)}\n\nMODELO SINTÉTICO\n${JSON.stringify(fr.truth.patient, null, 2)}\n\nÚLTIMOS EVENTOS\n${fr.eventsTail.map((e) => `${clock(e.simTimeMs / 1000)} ${e.kind}: ${JSON.stringify(e.payload)}`).join('\n')}\n\nNo evalúa competencia clínica ni seguridad de ventilación en pacientes.\n`; }
  function debrief(): void { const tasks = scenario.lesson?.tasks ?? []; openDialog('debrief', 'Resumen de práctica', `<div class="debrief-stat-grid"><div><b>${lessonDone.size}/${tasks.length}</b><span>Objetivos de interfaz</span></div><div><b>${clock(simS())}</b><span>Tiempo simulado</span></div><div><b>${frame?.breathCount ?? 0}</b><span>Ciclos completos</span></div></div><h3>${esc(scenario.lesson?.title ?? scenario.name)}</h3><div class="lesson-tasks">${tasks.map((x) => `<div class="task ${lessonDone.has(x.id) ? 'complete' : ''}"><span class="task-check">${icon(lessonDone.has(x.id) ? 'check' : 'minus')}</span><span>${esc(x.text)}</span></div>`).join('')}</div><div class="info-box"><b>${esc(scenario.question ?? '')}</b><p>${esc(scenario.answer ?? '')}</p></div><div class="notice-box">Este resumen registra acciones del simulador; no puntúa seguridad clínica ni acredita competencia.</div>`, btn('Cerrar', 'closeDialog', 'secondary-button') + btn('Guardar resumen TXT', 'exportDebrief')); }
  const SOURCES: [string, string, string][] = [
    ['GE HealthCare · Quick Reference Guide JB77395XX (2020)', 'Interfaz, perilla, vistas, alarmas, ↑O2 y espera. Leída íntegra; hash en evidence.json.', 'https://s7d9.scene7.com/is/content/gehealthcare/1-1_quick-reference-guidepdf-3'],
    ['GE HealthCare · Troubleshooting Guide JB79437XX (2020)', 'VT no alcanzado por Plimit; alarma de Ppico evaluada antes de refrescar pantalla.', 'https://s7d9.scene7.com/is/content/gehealthcare/2-5_trouble-shooting-guidepdf-1'],
    ['GE Healthcare · Especificaciones técnicas JB23840CO (2014)', 'Rangos, escalones, bloqueos, familias de temporización y límites de alarma.', 'https://www.pvequip.cl/wp-content/uploads/2019/08/EETT-Ventilador-Carescape-R860.pdf'],
    ['GE HealthCare · Modos de ventilación invasiva JB72469XX (ES, 2020)', 'Comportamiento de Plimit en VC; cotas de PRVC.', 'https://landing1.gehealthcare.com/rs/005-SHS-767/images/CARESCAPE%20R860%20Modes%20Invasivos_Spanish.pdf'],
    ['MDN · Web Workers', 'Motor temporal separado de la interfaz.', 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers'],
  ];
  function help(tab = 'start'): void {
    const texts: Record<string, string> = {
      start: `<p class="dialog-lead">Un ventilador virtual para explorar la relación entre lo que ajustas, lo que hace el pulmón sintético y lo que muestra el monitor.</p><div class="help-list"><div><b>01 · Ventila</b><p>La sesión ya está ventilando. Selecciona un parámetro de la barra inferior. Ajusta con el deslizador, el número, las flechas o la perilla y <b>confirma</b>. Cancelar conserva el valor previo. El cambio se aplica en la próxima respiración.</p></div><div><b>02 · Cambia el pulmón</b><p>El panel derecho controla C, R, esfuerzo y sensor de O₂. Estos cambios actúan sobre el modelo, no sobre los ajustes del equipo. En «Eventos» puedes provocar y deshacer alteraciones.</p></div><div><b>03 · Mide y compara</b><p>Bloqueo insp/esp abre la maniobra; pulsa ▶ para solicitarla. El motor espera una fase elegible. Revisa el resultado, su validez y su hora. En Bucles, guarda un ciclo de referencia.</p></div><div><b>04 · Entrena y guarda</b><p>«Entrenar» contiene tres objetivos por escenario. Guarda JSON para reproducir y CSV/PNG para analizar. No hay subida de archivos a internet.</p></div></div><div class="info-box"><b>Tres acciones distintas:</b> Pausar detiene el reloj; Congelar curvas conserva una imagen mientras el motor sigue; En espera suspende la ventilación virtual. Al ocultar la pestaña se pausa la simulación y se reanuda manualmente.</div>`,
      model: `<p class="dialog-lead">Mecánica consistente, alcance explícitamente limitado.</p><div class="equation">Paw + Pmus = V / C + R × Q<br>τesp = Rexp × C</div><p>Un compartimento lineal con resistencia inspiratoria y espiratoria independientes; volumen pulmonar continuo (no se reinicia al cambiar PEEP); esfuerzo muscular periódico; sensor de O₂ con retardo. Integración a paso fijo de 4 ms con sub-pasos exactos en los eventos y localización de los cruces de Plimit/Pmáx dentro del paso; muestras a 50 Hz para las curvas.</p><p><b>Modo:</b> A/C VC adulto. Plimit sostiene la presión el resto de la inspiración; Pmáx la termina. Otros modos se incorporarán sólo tras sus pruebas de banco.</p><p><b>Mediciones estáticas:</b> esfuerzo, Pmáx, duración insuficiente o cancelación invalidan una maniobra; el resultado conserva su hora y su motivo. FR y VMesp usan las últimas ocho respiraciones.</p><div class="notice-box"><b>No modela:</b> intercambio gaseoso, SpO₂, PaCO₂, hemodinámica, reclutamiento, fuga, circuito ni tubo. FiO₂ cambia su sensor virtual, no una saturación inventada. No predice respuestas de pacientes ni controla equipos.</div><p>El firmware del equipo fotografiado no está identificado. Cada regla lleva su marca de evidencia (documentado / observado / propuesto / no resuelto) en los archivos evidence.json y gaps.json del proyecto.</p>`,
      keys: `<table class="info-table"><tbody>${[['Espacio', 'Pausar o reanudar el reloj de simulación'], ['C', 'Congelar o reanudar curvas'], ['F', 'Guardar captura PNG'], ['A', 'Abrir alarmas'], ['H', 'Vista principal de curvas'], ['?', 'Abrir esta guía'], ['↑ / ↓', 'Cambiar el parámetro seleccionado'], ['Enter', 'Confirmar un ajuste rápido'], ['Esc', 'Cancelar ajuste o cerrar ventana'], ['Rueda sobre perilla', 'Modificar el parámetro seleccionado']].map(([k, d]) => `<tr><td><kbd class="keyboard-key">${k}</kbd></td><td>${d}</td></tr>`).join('')}</tbody></table><div class="info-box">El audio está apagado inicialmente. Actívalo desde el icono superior. Los tonos son sintéticos. La pausa de audio dura 120 segundos del reloj simulado.</div>`,
      sources: `<p class="dialog-lead">Fuentes primarias consultadas; se abren en internet sólo al seleccionarlas. El funcionamiento del simulador es completamente local.</p>${SOURCES.map(([title, desc, url]) => `<div class="source-entry"><a href="${url}" target="_blank" rel="noopener noreferrer">${title} ${icon('arrow')}</a><p>${desc}</p></div>`).join('')}<p>Referencia visual: las tres fotografías aportadas por el usuario (P1, P2, P3). Sistema visual e interacción derivados de «R860 Lab» (MIT).</p>`,
    };
    openDialog('help', 'Guía del simulador', `<div class="help-tabs">${[['start', 'Primeros pasos'], ['model', 'Modelo y límites'], ['keys', 'Atajos y controles'], ['sources', 'Fuentes']].map(([k, l]) => `<button data-help-tab="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}</div>${texts[tab] ?? texts.start}`, btn('Cerrar', 'closeDialog', 'secondary-button'), 'wide');
  }
  async function toggleAudio(): Promise<void> { if (!audio.enabled) { const ok = await audio.enable(); if (!ok) { toast(audio.blockedReason ?? 'Audio no disponible.', true); return; } toast('Audio de alarmas activado. Tonos sintéticos de entrenamiento.'); } else { audio.enabled = false; toast('Audio de alarmas apagado. Las alarmas visuales continúan.'); } $('#sound-toggle').innerHTML = icon(audio.enabled ? 'sound' : 'muted'); $('#sound-toggle').setAttribute('aria-pressed', String(audio.enabled)); if (frame) updateAlarm(); }

  // ---------- acciones ----------
  async function action(a: string): Promise<void> {
    switch (a) {
      case 'home': closeDialog(); switchView('waves'); break;
      case 'menu': menu(); break;
      case 'modes': openModes(); break;
      case 'confirmModes': { const r = validateMode(); if (r.ok && modeDraft && frame) { const changes: Partial<VcSettings> = {}; const base = { ...frame.settings, ...(frame.pending ?? {}) }; for (const k of Object.keys(modeDraft) as (keyof VcSettings)[]) if (modeDraft[k] !== base[k]) (changes as Record<string, unknown>)[k] = modeDraft[k]; if (Object.keys(changes).length) { const res = await send({ type: 'confirmSettings', changes }); if (res.accepted) { if ('plimit' in changes) flags.plimitChanged = true; if ('peep' in changes) flags.peepChanged = true; settingsChangeMs = frame.simTimeMs; closeDialog(); toast('Ajustes confirmados. Se aplican en la próxima respiración.'); } } else closeDialog(); } break; }
      case 'scenarios': showScenarios(); break;
      case 'teacher': teacherVisible = !teacherVisible; $('#workspace').classList.toggle('teacher-hidden', !teacherVisible); $('#teacher-toggle').innerHTML = icon('eye') + `<span>${teacherVisible ? 'Ocultar' : 'Mostrar'} panel docente</span>`; break;
      case 'pause': if (running) client.pause('usuario'); else client.resume(); $('#global-notice').hidden = true; break;
      case 'freeze': toggleFreeze(); break;
      case 'sound': await toggleAudio(); break;
      case 'fullscreen': try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('No se pudo activar pantalla completa.', true); } break;
      case 'alarms': alarms(); break;
      case 'alarmSetup': alarmSetup(); break;
      case 'confirmLimits': { const errs = readLimits(); if (!errs.length && limitsDraft && frame) { const changes: Partial<AlarmLimits> = {}; for (const k of Object.keys(limitsDraft) as (keyof AlarmLimits)[]) if (limitsDraft[k] !== frame.alarmLimits[k]) (changes as Record<string, unknown>)[k] = limitsDraft[k]; if (Object.keys(changes).length) { const r = await send({ type: 'setAlarmLimits', changes }); if (r.accepted) { closeDialog(); toast('Límites de alarma actualizados.'); } } else closeDialog(); } break; }
      case 'mute': await send({ type: 'audioPause' }); toast('Audio en pausa durante 120 s de simulación. Las condiciones activas siguen visibles.'); break;
      case 'acknowledge': await send({ type: 'acknowledgeAlarms' }); toast('Reconocimiento registrado; las condiciones activas permanecen.'); break;
      case 'inspiratory': openHold('inspHold'); break;
      case 'expiratory': openHold('expHold'); break;
      case 'closeHold': if (frame?.procedure.hold) await send({ type: 'cancelProcedure' }); $('#hold-panel').hidden = true; break;
      case 'runHold': if (frame?.procedure.hold) await send({ type: 'cancelProcedure' }); else { const r = await send({ type: 'requestHold', kind: holdType, durationS: Number(($('#hold-duration') as HTMLSelectElement).value) }); if (r.accepted) { if (frozen) toggleFreeze(); if (!['waves', 'basic'].includes(view)) switchView('waves'); if (!running) client.resume(); collapseHelp(); } } break;
      case 'manual': { const r = await send({ type: 'manualBreath' }); if (r.accepted) toast('Respiración manual solicitada.'); closeDialog(); break; }
      case 'oxygen': oxygenDialog(); break;
      case 'startOxygen': await send({ type: 'increaseO2Start' }); closeDialog(); break;
      case 'stopOxygen': await send({ type: 'increaseO2Stop' }); closeDialog(); break;
      case 'cancelEdit': cancelQuick(); break;
      case 'confirmEdit': confirmQuick(); break;
      case 'editMinus': stepQuick(-1); break;
      case 'editPlus': stepQuick(1); break;
      case 'knob': if (edit.state.kind !== 'idle') confirmQuick(); else toast('Selecciona un parámetro inferior; gira con la rueda y pulsa para confirmar.'); break;
      case 'lock': locked = !locked; $('#lock-overlay').hidden = !locked; $('#lock-key').setAttribute('aria-pressed', String(locked)); edit.setLocked(locked); cancelQuick(); break;
      case 'unlock': locked = false; $('#lock-overlay').hidden = true; $('#lock-key').setAttribute('aria-pressed', 'false'); edit.setLocked(false); break;
      case 'standby': standbyDialog(); break;
      case 'confirmStandby': await send({ type: 'enterStandby' }); closeDialog(); break;
      case 'startVentilation': await send({ type: 'startVentilation' }); closeDialog(); break;
      case 'powerInfo': openDialog('power', 'Entorno de simulación', `<div class="info-box">Ejecución local en tu navegador. Sin conexión a un ventilador, red hospitalaria, USB ni puertos físicos.</div><p>Este icono conserva la referencia visual de alimentación. No simula baterías, consumo eléctrico ni autonomía.</p>`, '', 'compact'); break;
      case 'patient': patientDialog(); break;
      case 'resetPatient': await setPhys([{ type: 'setPatient', params: { ...scenario.patient } }, { type: 'setEffort', params: { ...scenario.effort } }, { type: 'setSensors', params: { ...scenario.sensors } }], null); toast('Mecánica inicial restablecida. Los ajustes ventilatorios se mantienen.'); break;
      case 'undoEvent': { const u = eventUndo.pop(); if (u) await setPhys(u, null); else toast('No hay eventos para deshacer.'); break; }
      case 'loopReference': { const cyc = cyclePoints(points); if (cyc.length < 3) { toast('Espera un ciclo completo.', true); break; } loopReference = cyc.map((x) => [...x] as Point); put('#loop-reference-label', `Referencia ${clock(cyc[0]![0])}`); flags.referenceLoop = true; dirty = true; evaluateLesson(); toast('Ciclo de referencia guardado para comparación.'); break; }
      case 'clearLoop': loopReference = null; put('#loop-reference-label', 'Sin referencia'); dirty = true; break;
      case 'tools': tools(); break;
      case 'mechanics': mechanics(); break;
      case 'session': sessionDialog(); break;
      case 'exportSession': await exportSession(); break;
      case 'importSession': $('#session-input').click(); break;
      case 'csv': exportCSV(false); break;
      case 'signalCSV': exportCSV(true); break;
      case 'snapshot': snapshot(); break;
      case 'debrief': debrief(); break;
      case 'exportDebrief': download(new Blob([debriefText()], { type: 'text/plain;charset=utf-8' }), `R860_practica_${stamp()}.txt`); break;
      case 'help': help('start'); break;
      case 'model': help('model'); break;
      case 'closeDialog': closeDialog(); break;
      default: toast('Acción no disponible en esta versión.', true);
    }
  }

  // ---------- eventos DOM ----------
  function bind(): void {
    document.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action],[data-view],[data-instructor],[data-setting-quick],[data-scenario],[data-event],[data-metric],[data-help-tab],[data-help-target]'); if (!el) return;
      e.preventDefault();
      if (el.dataset.helpTarget) { toggleHelp(el); return; }
      if (locked && el.closest('#monitor') && !['mute', 'alarms', 'unlock', 'closeHold'].includes(el.dataset.action ?? '')) { toast('Controles bloqueados.'); return; }
      if (el.dataset.action) { void action(el.dataset.action).catch((err: Error) => notice(err.message)); return; }
      if (el.dataset.view) switchView(el.dataset.view);
      if (el.dataset.instructor) switchInstructor(el.dataset.instructor);
      if (el.dataset.settingQuick) openQuick(el.dataset.settingQuick as SettingsKey);
      if (el.dataset.scenario) loadScenario(el.dataset.scenario);
      if (el.dataset.event) void fault(el.dataset.event);
      if (el.dataset.metric) mechanics(el.dataset.metric);
      if (el.dataset.helpTab) help(el.dataset.helpTab);
    });
    document.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.id === 'quick-value') typedQuick(el.value);
      if (el.id === 'quick-range') { if (edit.state.kind !== 'idle' && edit.state.key === 'ie') { const vals = ruleOf('ie').values ?? []; edit.setDraftDisplay(vals[Number(el.value)] ?? (vals[0] as number), performance.now()); renderQuick(); } else typedQuick(el.value); }
      if (el.dataset.physRange) { const k = el.dataset.physRange; $<HTMLInputElement>(`[data-phys-number="${k}"]`).value = el.value; const sp = PHYS[k] as PhysSpec; el.style.setProperty('--fill', `${(100 * (Number(el.value) - sp.min)) / (sp.max - sp.min)}%`); }
      if (el.dataset.modeField) readModeField(el);
      if (el.dataset.limit) readLimits();
      if (el.id === 'history-slider') { const start = Math.min(freezeEnd, frozenPoints[0]?.[0] ?? freezeEnd); reviewEnd = Math.min(freezeEnd, start + waveWindow + (freezeEnd - start - waveWindow) * Number(el.value) / 1000); cursorTime = null; put('#inspector-label', `Historia congelada · final de ventana ${clock(reviewEnd)}. Los números del monitor siguen en vivo.`); dirty = true; }
    });
    document.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement | HTMLSelectElement;
      if ((el as HTMLInputElement).dataset.physRange || (el as HTMLInputElement).dataset.physNumber) { const k = ((el as HTMLInputElement).dataset.physRange ?? (el as HTMLInputElement).dataset.physNumber) as string; const sp = PHYS[k] as PhysSpec; if (frame) void setPhys([sp.cmd(Number(el.value), frame)], null).then(() => { el.blur(); if (frame) updateTeacher(); }); }
      if (el.id === 'sim-speed') { speed = Number(el.value); client.setSpeed(speed); }
      if (el.id === 'wave-window') { waveWindow = Number(el.value); dirty = true; }
      if (el.id === 'wave-style') { waveStyle = el.value as 'sweep' | 'scroll'; dirty = true; }
      if ((el as HTMLInputElement).dataset.modeField) readModeField(el as HTMLInputElement);
    });
    $('#session-input').addEventListener('change', async (e) => { const input = e.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return; if (file.size > 2 * 1024 * 1024) { toast('Archivo demasiado grande (máximo 2 MB).', true); return; } const text = await file.text(); const r = await client.importSession(text); if (r.ok) { points = []; loopReference = null; fixtureId = null; closeDialog(); toast(`Sesión importada y reproducida en pausa. ${r.warnings?.join(' ') ?? ''} Pulsa Reanudar.`); } else toast(`Rechazada: ${r.errors?.join(' · ')}`, true); });
    $('#trim-knob').addEventListener('wheel', (e) => { e.preventDefault(); stepQuick((e as WheelEvent).deltaY < 0 ? 1 : -1); }, { passive: false });
    $('#app-dialog').addEventListener('cancel', () => { dialogKind = ''; });
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape' && collapseHelp()) { e.preventDefault(); e.stopPropagation(); return; }
      const t = e.target as HTMLElement;
      if (edit.state.kind !== 'idle' && (!t.closest('button') || e.key === 'Escape') && ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) { e.preventDefault(); if (e.key === 'ArrowUp') stepQuick(1); if (e.key === 'ArrowDown') stepQuick(-1); if (e.key === 'Enter') confirmQuick(); if (e.key === 'Escape') cancelQuick(); return; }
      if (t.closest('input,select,textarea,button,summary,a') || $<HTMLDialogElement>('#app-dialog').open) return;
      const map: Record<string, string> = { ' ': 'pause', c: 'freeze', f: 'snapshot', a: 'alarms', h: 'home', '?': 'help' }; const key = e.key.toLowerCase(); if (map[key]) { e.preventDefault(); void action(map[key] as string); }
    });
    $('#waves-canvas').addEventListener('pointermove', (e) => { if (!frozen || !frozenPoints.length) return; const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); const x = ((e.clientX - rect.left) / rect.width) * 608; const ratio = Math.max(0, Math.min(1, (x - 45) / (608 - 60))); if (waveStyle === 'sweep') { const cycle = Math.floor(reviewEnd / waveWindow) * waveWindow; cursorTime = cycle + ratio * waveWindow; if (cursorTime > reviewEnd) cursorTime -= waveWindow; } else cursorTime = reviewEnd - waveWindow + ratio * waveWindow; const ct = cursorTime; const nearest = frozenPoints.reduce((best, p) => (Math.abs(p[0] - ct) < Math.abs(best[0] - ct) ? p : best), frozenPoints[0] as Point); put('#inspector-label', `t ${f(nearest[0], 2)} s · Paw ${f(nearest[1], 1)} cmH₂O · Flujo ${f(nearest[2], 1)} L/min · Volumen ${f(nearest[3], 0)} mL · datos del sensor`); dirty = true; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && frame && running && !fixtureId) { client.visibility(true); notice('Simulación pausada al ocultar la pestaña. Pulsa Reanudar para continuar sin saltos de tiempo.'); } });
    setInterval(() => edit.tick(performance.now()), 500);
    window.addEventListener('resize', () => { if (edit.state.kind !== 'idle') placeQuickEditor(); });
  }

  // ---------- arranque ----------
  function startEngine(): void {
    const t0 = params.get('t0');
    const init: SimulatorInit = defaultInit({ ...(t0 ? { startWallTimeMs: new Date(t0).getTime() } : { startWallTimeMs: Date.now() }), ...(params.get('seed') ? { seed: Number(params.get('seed')) } : {}), ...(params.get('dt') ? { dtMs: Number(params.get('dt')) } : {}), patient: { ...scenario.patient }, effort: { ...scenario.effort }, sensors: { ...scenario.sensors }, settings: { ...defaultInit().settings, ...(scenario.settings ?? {}) }, alarmLimits: { ...defaultInit().alarmLimits, ...(scenario.alarmLimits ?? {}) }, initialV: scenario.initialV ?? 'equilibrium' });
    speed = params.get('speed') ? Number(params.get('speed')) : 1; ($('#sim-speed') as HTMLSelectElement).value = String(speed);
    const autopause = params.get('autopause') ? Number(params.get('autopause')) : undefined;
    client.init(init, speed, params.get('paused') !== '1', autopause);
    if (scenario.perturbations.length) client.loadScenario(scenario, false);
  }
  initDOM(); bind(); renderLesson();
  client.onFrame((m) => { if (fixtureId) return; ingest(m.frame, m); });
  requestAnimationFrame(tick);
  void client.ready.then(() => {
    startEngine();
    const fx = params.get('fixture');
    if (fx === 'P1' || fx === 'P3') { setTimeout(() => { fixtureId = fx; client.pause('fixture visual'); const fr = frameFromFixture(PHOTO_FIXTURES[fx]); frame = fr; running = false; pauseReason = 'fixture visual'; switchView(fx === 'P1' ? 'waves' : 'basic'); points = []; dirty = true; updateUI(); if (fx === 'P1') openHold('inspHold'); }, 80); }
    const v = params.get('view'); if (v) switchView(v);
  });
  (window as unknown as { __r860: unknown }).__r860 = { get frame() { return frame; }, get edit() { return edit.state; }, get view() { return view; }, get mode() { return client.mode; }, get running() { return running; }, get points() { return points.length; } };
}
