/** Banda de alarmas, diálogo de alarmas, edición de límites y audio de alarmas (dueño de AlarmAudio). */
import type { AlarmLimits, AlarmState } from '../domain/types';
import { gridValues, isOnGrid, nearestGridValue } from '../domain/validation';
import type { EngineFrame } from '../engine/simulator';
import { formatNumber as f } from '../domain/units';
import { AlarmAudio } from './audio';
import type { AppContext } from './context';
import { $, $$, btn, esc, icon, put } from './dom';
import { clock, unitText } from './format';
import { contextualHelpPanel, infoButton, infoPanel } from './helpPanels';
import { alarmBandLabel, CHANNEL, joinSentences, learnerText, PRIORITY } from './humanize';
import { stepInputValue } from './numericSteps';

export interface AlarmsUi {
  updateAlarm(): void;
  alarms(): void;
  alarmSetup(): void;
  readLimits(): string[];
  stepLimit(key: keyof AlarmLimits, direction: 1 | -1): void;
  confirmLimits(): Promise<void>;
  toggleAudio(): Promise<void>;
}

export function createAlarmsUi(ctx: AppContext): AlarmsUi {
  const audio = new AlarmAudio();
  let alarmSignature = '';
  let limitsDraft: AlarmLimits | null = null;
  ctx.dialog.onOpen(() => {
    alarmSignature = '';
  });
  ctx.dialog.onClose(() => {
    limitsDraft = null;
  });

  function alarmHTML(): string {
    const fr = ctx.frame as EngineFrame;
    // Las filtradas por otra activa no se listan, como en el equipo (URM SW10 8-25).
    const active = fr.alarms.filter((a) => a.conditionActive && !a.filteredBy),
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
      const acked = fr.alarms.filter((a) => a.conditionActive && !a.filteredBy && a.acknowledgedAtMs !== null).length;
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
    const fr = ctx.frame as EngineFrame;
    const bar = fr.alarmBar;
    const lev = bar.color === 'red' ? 'high' : bar.color === 'yellow' ? 'medium' : bar.color === 'grey' ? 'previous' : '';
    $('#alarm-band').className = 'alarm-band ' + lev;
    $('#bezel-light').className = 'bezel-light ' + (lev === 'previous' ? '' : lev);
    put('#alarm-label', alarmBandLabel(bar));
    put('#alarm-detail', alarmDetailText(fr));
    const muteLeft = fr.audioPauseUntilMs !== null ? fr.audioPauseUntilMs - fr.simTimeMs : 0;
    put('#mute-time', muteLeft > 0 ? clock(Math.ceil(muteLeft / 1000)) : '');
    const flags = ctx.lesson.flags;
    if (bar.activeCount) flags.alarmSeen = flags.alarmSeen || ctx.dialog.kind === 'alarms';
    const sig = JSON.stringify(fr.alarms.map((a) => [a.id, a.conditionActive, a.filteredBy ?? null, a.acknowledgedAtMs]));
    if (ctx.dialog.kind === 'alarms' && sig !== alarmSignature) {
      alarmSignature = sig;
      const el = document.getElementById('live-alarms');
      if (el) el.innerHTML = alarmHTML();
    }
    audio.pausedUntilMs = fr.audioPauseUntilMs;
    const top = fr.alarms
      .filter((a) => a.conditionActive && !a.filteredBy)
      .sort((a, b) => (a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0))[0];
    if (ctx.running) audio.drive(top ? top.priority : null, fr.simTimeMs);
  }
  function alarms(): void {
    ctx.lesson.flags.alarmSeen = true;
    ctx.dialog.open(
      'alarms',
      'Alarmas y reconocimiento',
      `<div class="context-help-row"><span>Información sobre alarmas</span>${infoButton('procedure.alarms', 'help-alarms')}</div>${infoPanel('procedure.alarms', 'help-alarms')}<div id="live-alarms" class="alarm-list">${alarmHTML()}</div>`,
      btn('Límites', 'alarmSetup', 'secondary-button') +
        btn('Silenciar 120 s', 'mute', 'secondary-button') +
        btn('Reconocer', 'acknowledge'),
    );
  }
  function alarmSetup(): void {
    const frame = ctx.frame;
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
      if (!k) return `<span class="settings-annotation">Pmáx ${ctx.frame?.settings.pmax}</span>`;
      const r = ctx.profile.alarmLimitRules[k];
      const v = limitsDraft![k];
      const id = `help-limit-${k}`;
      return `<div class="limit-field contextual-field"><div class="limit-input"><button class="step-button" type="button" data-limit-step="${k}" data-direction="-1" aria-label="Disminuir ${label} ${which}" aria-describedby="${id}">−</button><input class="form-control" type="number" data-limit="${k}" value="${v === 'off' ? '' : (v as number) * r.displayFactor}" placeholder="${r.allowOff ? 'Off' : ''}" step="${Math.min(...r.domain.map((s) => s.step))}" aria-label="${label} ${which}" aria-describedby="${id}"><button class="step-button" type="button" data-limit-step="${k}" data-direction="1" aria-label="Aumentar ${label} ${which}" aria-describedby="${id}">+</button></div>${contextualHelpPanel('procedure.alarms', id)}</div>`;
    };
    ctx.dialog.open(
      'alarmSetup',
      'Límites de alarma',
      `<div class="context-help-row"><span>Información sobre límites</span>${infoButton('procedure.alarms', 'help-alarm-limits')}</div>${infoPanel('procedure.alarms', 'help-alarm-limits')}<div class="alarm-edit-grid"><b>Parámetro</b><b>Bajo</b><b>Alto</b>${rows.map(([label, u, lo, hi]) => `<label>${label} <small>${u}</small></label>${cell(lo, label, 'bajo')}${cell(hi, label, 'alto')}`).join('')}</div><p class="settings-annotation">Vacío = Off (la alarma no se evalúa); VMesp y FiO₂ baja no se apagan, como en el equipo. Pmáx se ajusta en la tecla rápida y termina la inspiración.</p><div id="limits-error" class="mode-error" role="status"></div>`,
      btn('Ver alarmas', 'alarms', 'secondary-button') + btn('Confirmar límites', 'confirmLimits'),
    );
  }
  function readLimits(): string[] {
    const errors: string[] = [];
    if (!limitsDraft) return ['sin borrador'];
    for (const el of $$<HTMLInputElement>('[data-limit]')) {
      const k = el.dataset.limit as keyof AlarmLimits;
      const r = ctx.profile.alarmLimitRules[k];
      const raw = el.value.trim();
      if (raw === '' && !r.allowOff) {
        el.setAttribute('aria-invalid', 'true');
        errors.push(`${r.label}: el equipo no deja apagarla; el mínimo es ${gridValues(r)[0]} ${unitText(r.displayUnit)}.`);
        continue;
      }
      if (raw === '') {
        el.removeAttribute('aria-invalid');
        limitsDraft[k] = 'off';
        continue;
      }
      const v = Number(raw);
      if (!Number.isFinite(v) || !isOnGrid(r, v)) {
        el.setAttribute('aria-invalid', 'true');
        errors.push(
          `${r.label}: ${raw} no es un valor admitido; el más cercano es ${nearestGridValue(r, Number.isFinite(v) ? v : 0)} ${unitText(r.displayUnit)}.`,
        );
      } else {
        el.removeAttribute('aria-invalid');
        (limitsDraft as unknown as Record<string, unknown>)[k] = v / r.displayFactor;
      }
    }
    put('#limits-error', joinSentences(errors));
    const b = document.querySelector<HTMLButtonElement>('[data-action="confirmLimits"]');
    if (b) b.disabled = errors.length > 0;
    return errors;
  }
  function stepLimit(k: keyof AlarmLimits, direction: 1 | -1): void {
    const input = document.querySelector<HTMLInputElement>(`[data-limit="${k}"]`);
    if (!input) return;
    input.value = stepInputValue(ctx.profile.alarmLimitRules[k], input.value, direction);
    readLimits();
  }
  async function confirmLimits(): Promise<void> {
    const errs = readLimits();
    const frame = ctx.frame;
    if (errs.length || !limitsDraft || !frame) return;
    const changes: Partial<AlarmLimits> = {};
    for (const k of Object.keys(limitsDraft) as (keyof AlarmLimits)[])
      if (limitsDraft[k] !== frame.alarmLimits[k]) (changes as Record<string, unknown>)[k] = limitsDraft[k];
    if (!Object.keys(changes).length) {
      ctx.dialog.close();
      return;
    }
    const r = await ctx.send({ type: 'setAlarmLimits', changes });
    if (r.accepted) {
      ctx.dialog.close();
    }
  }
  async function toggleAudio(): Promise<void> {
    if (!audio.enabled) {
      const ok = await audio.enable();
      if (!ok) {
        ctx.toast(audio.blockedReason ?? 'Audio no disponible.', true);
        return;
      }
    } else {
      audio.enabled = false;
    }
    $('#sound-toggle use').setAttribute('href', `#i-${audio.enabled ? 'sound' : 'muted'}`);
    $('#sound-toggle').setAttribute('aria-checked', String(audio.enabled));
    if (ctx.frame) updateAlarm();
  }
  return { updateAlarm, alarms, alarmSetup, readLimits, stepLimit, confirmLimits, toggleAudio };
}
