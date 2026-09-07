/** Casillas numéricas, datos grandes, tabla de datos, registro de eventos y diálogos de mecánica / medición. */
import type { EngineFrame } from '../engine/simulator';
import { format as f } from '../render/plots';
import type { AppContext } from './context';
import { CLOSE_BTN } from './dialogHost';
import { $, $$, btn, esc, icon, put } from './dom';
import { clock } from './format';
import { helpContent, helpEntry, infoButton, infoPanel } from './helpPanels';
import { eventSentence, learnerText } from './humanize';
import {
  ALL_METRICS,
  BIG_METRICS,
  limitPair,
  METRIC_HELP,
  METRICS,
  metricInAlarm,
  metricQuality,
  metricValue,
  type MetricSpec,
} from './metricsTable';

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

export interface MetricsView {
  /** Construye las rejillas de casillas (tabindex itinerante: una sola entrada por Tab). */
  init(): void;
  updateMetrics(): void;
  updateLogs(): void;
  /** Obliga a repintar el registro en el próximo cuadro (escenario nuevo). */
  resetLog(): void;
  /** Diálogo de mecánica respiratoria o, con `metric`, la ficha de una medición. */
  mechanics(metric?: string | null): void;
}

export function createMetricsView(ctx: AppContext): MetricsView {
  let logSignature = '';
  const value = (spec: MetricSpec): number | null => metricValue(ctx.frame, spec);
  const quality = (spec: MetricSpec): string => metricQuality(ctx.frame, spec);
  return {
    init() {
      $('#numeric-grid').innerHTML = METRICS.map(
        (m, i) =>
          `<button class="numeric" data-metric="${m.key}" tabindex="${i === 0 ? 0 : -1}" title="${m.label}: información y medición" aria-label="${m.label}. Información y medición"><span class="numeric-label">${m.label}<span class="numeric-info" aria-hidden="true">${icon('info')}</span></span><strong class="numeric-value">—</strong><span class="numeric-unit">${m.unit}</span><span class="numeric-limits"></span><span class="numeric-age"></span></button>`,
      ).join('');
      $('#big-metrics').innerHTML = BIG_METRICS.map(
        ([k, l, u], i) =>
          `<button class="big-numeric" data-metric="${k}" tabindex="${i === 0 ? 0 : -1}"><span>${l}<span class="numeric-info" aria-hidden="true">${icon('info')}</span></span><b>—</b><em>${u}</em><span class="numeric-limits"></span></button>`,
      ).join('');
    },
    updateMetrics() {
      const fr = ctx.frame as EngineFrame;
      for (const m of METRICS) {
        const el = $(`#numeric-grid [data-metric="${m.key}"]`);
        put(el.querySelector('.numeric-value'), f(value(m), m.decimals));
        put(el.querySelector('.numeric-limits'), limitPair(fr, m.key));
        el.classList.toggle('alarm-value', metricInAlarm(fr, m.key));
        if (m.key === 'ppeak') el.classList.toggle('plimit-limited', fr.live.plimitLimited); // indicador discreto, no alarma (E-036)
        const h = fr.procedure.last.inspHold;
        put(
          el.querySelector('.numeric-age'),
          m.source === 'hold' && h && h.quality === 'valid' ? `Med. ${clock((h.completedAtMs ?? 0) / 1000)}` : '',
        );
      }
      for (const e of $$('#big-metrics [data-metric]')) {
        const spec = METRICS.find((m) => m.key === e.dataset.metric) as MetricSpec;
        put(e.querySelector('b'), f(value(spec), spec.decimals));
        put(e.querySelector('.numeric-limits'), limitPair(fr, spec.key));
      }
      if (ctx.view === 'data')
        $('#data-table-body').innerHTML = ALL_METRICS.map(
          (m) =>
            `<tr><td><button class="metric-name" data-metric="${m.key}">${m.label}${icon('info')}</button></td><td>${f(value(m), m.decimals)}</td><td>${m.unit}</td><td>${esc(quality(m))}</td></tr>`,
        ).join('');
    },
    updateLogs() {
      const fr = ctx.frame as EngineFrame;
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
    },
    resetLog() {
      logSignature = '';
    },
    mechanics(metric = null) {
      if (metric) {
        const entry = ALL_METRICS.find((x) => x.key === metric);
        if (!entry) return;
        ctx.dialog.open(
          'measurement',
          helpEntry(METRIC_HELP[metric] ?? '')?.title ?? entry.label,
          `<div class="measurement-summary"><strong>${f(value(entry), entry.decimals)} <small>${entry.unit}</small></strong><span>${esc(quality(entry))}</span></div><div class="measurement-explanation">${helpContent(METRIC_HELP[metric] ?? '')}</div>`,
          CLOSE_BTN,
          'compact',
        );
        return;
      }
      const rows = ALL_METRICS.filter((x) => ['pplat', 'cstat', 'driving', 'peepe', 'vti', 'vte', 'pplatCycle'].includes(x.key));
      ctx.dialog.open(
        'mechanics',
        'Mecánica respiratoria',
        `<table class="info-table"><thead><tr><th>Dato</th><th>Resultado</th><th>Medición</th></tr></thead><tbody>${rows.map((m) => `<tr><td><button class="metric-name" data-metric="${m.key}">${m.label}${icon('info')}</button></td><td>${f(value(m), m.decimals)} ${m.unit}</td><td>${esc(quality(m))}</td></tr>`).join('')}</tbody></table><div class="context-help-row"><span>Cómo se obtiene Cstat</span>${infoButton('metric.cstat', 'help-mechanics')}</div>${infoPanel('metric.cstat', 'help-mechanics')}`,
        btn('Bloqueo espiratorio', 'expiratory', 'secondary-button') + btn('Bloqueo inspiratorio', 'inspiratory'),
        'wide',
      );
    },
  };
}
