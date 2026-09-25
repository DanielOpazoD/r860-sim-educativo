/** Casillas numéricas, datos grandes, tabla de datos, registro de eventos y diálogos de mecánica / medición. */
import type { EngineFrame } from '../engine/simulator';
import { formatNumber as f } from '../domain/units';
import type { AppContext } from './context';
import { CLOSE_BTN } from './dialogHost';
import { $, $$, btn, esc, icon, put } from './dom';
import { clock } from './format';
import { helpContent, helpEntry, infoButton, infoPanel } from './helpPanels';
import { eventSentence, humanReason, learnerText } from './humanize';
import {
  ALL_METRICS,
  BIG_METRICS,
  limitPair,
  METRIC_HELP,
  METRICS,
  metricInAlarm,
  metricQuality,
  metricSample,
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

/**
 * Celda de valor de la tabla. El dato ausente se marca como ausencia y no como un número: un guión del tamaño de la
 * cifra se leía como una regla o como una muestra de leyenda.
 */
function celdaValor(texto: string, unidad: string): string {
  if (texto === '—') return `<span class="sin-dato">sin dato</span>`;
  return `${texto}${unidad ? `<small>${unidad}</small>` : ''}`;
}

export function createMetricsView(ctx: AppContext): MetricsView {
  let logSignature = '';
  const value = (spec: MetricSpec): number | null => metricValue(ctx.frame, spec);
  const quality = (spec: MetricSpec): string => metricQuality(ctx.frame, spec);
  return {
    init() {
      $('#numeric-grid').innerHTML = METRICS.map(
        (m, i) =>
          `<button class="numeric" data-metric="${m.key}" tabindex="${i === 0 ? 0 : -1}" title="${m.label}: información y medición" aria-label="${m.label}. Información y medición"><span class="numeric-label">${m.label}<span class="numeric-info" aria-hidden="true">${icon('info')}</span></span><strong class="numeric-value">—</strong><span class="numeric-unit">${m.unit}</span><span class="numeric-limits" title="Límites de alarma: alto / bajo"></span><span class="numeric-age"></span></button>`,
      ).join('');
      $('#big-metrics').innerHTML = BIG_METRICS.map(
        ([k, l, u], i) =>
          `<button class="big-numeric" data-metric="${k}" tabindex="${i === 0 ? 0 : -1}"><span>${l}<span class="numeric-info" aria-hidden="true">${icon('info')}</span></span><b>—</b><em>${u}</em><span class="numeric-limits" title="Límites de alarma: alto / bajo"></span></button>`,
      ).join('');
    },
    updateMetrics() {
      const fr = ctx.frame as EngineFrame;
      for (const m of METRICS) {
        const el = $(`#numeric-grid [data-metric="${m.key}"]`);
        const valor = el.querySelector('.numeric-value') as HTMLElement;
        const h = fr.procedure.last.inspHold;
        // El guión sin explicación enseñaba que el dato faltaba, no por qué: el motivo ocupa el sitio de la cifra.
        let motivo = '';
        if (metricValue(fr, m) === null && fr.ventilation !== 'standby') {
          const s = metricSample(fr, m.key);
          const razon = humanReason(s?.reason);
          if (m.source === 'hold' && !h) motivo = 'sin bloqueo';
          else if (m.source === 'hold' && h && h.quality !== 'valid') motivo = 'bloqueo no válido';
          else if (!razon) motivo = 'sin dato';
          else motivo = razon.length > 16 ? razon.slice(0, 16) + '…' : razon;
        }
        if (motivo) valor.innerHTML = `<span class="sin-dato">${esc(motivo)}</span>`;
        else put(valor, f(value(m), m.decimals));
        put(el.querySelector('.numeric-limits'), limitPair(fr, m.key));
        el.classList.toggle('alarm-value', metricInAlarm(fr, m.key));
        if (m.key === 'ppeak') el.classList.toggle('plimit-limited', fr.live.plimitLimited); // indicador discreto, no alarma (E-036)
        // Con dos unidades en paralelo la Cstat/R son aproximadas: el aviso va pegado a la unidad porque la línea de
        // edad (fija en una celda de alto limitado) no tiene sitio para otra fila sin pintarse sobre la de abajo.
        put(
          el.querySelector('.numeric-unit'),
          metricSample(fr, m.key)?.reason?.startsWith('twoCompartments') ? `${m.unit} · aprox.` : m.unit,
        );
        put(
          el.querySelector('.numeric-age'),
          m.source === 'hold' && h && h.quality === 'valid' && metricSample(fr, m.key)?.value !== null
            ? `Med. ${clock((h.completedAtMs ?? 0) / 1000)}`
            : '',
        );
      }
      for (const e of $$('#big-metrics [data-metric]')) {
        const spec = METRICS.find((m) => m.key === e.dataset.metric) as MetricSpec;
        put(e.querySelector('b'), f(value(spec), spec.decimals));
        put(e.querySelector('.numeric-limits'), limitPair(fr, spec.key));
      }
      if (ctx.view === 'data') {
        // Dos tablas en paralelo. Con una sola, diecisiete filas de 47 px no cabían en los 425 disponibles y nueve
        // quedaban bajo el pliegue sin ninguna señal: entre ellas la Cstat, la ΔP y el índice de estrés, que son el
        // núcleo docente. La unidad se pega al valor, como en la columna numérica, para dejar sitio a la procedencia.
        const fila = (m: (typeof ALL_METRICS)[number]): string =>
          `<tr><td><button class="metric-name" data-metric="${m.key}">${m.label}${icon('info')}</button></td>` +
          `<td>${celdaValor(f(value(m), m.decimals), m.unit)}</td><td>${esc(quality(m))}</td></tr>`;
        const mitad = Math.ceil(ALL_METRICS.length / 2);
        $('#data-table-body').innerHTML = ALL_METRICS.slice(0, mitad).map(fila).join('');
        $('#data-table-body-2').innerHTML = ALL_METRICS.slice(mitad).map(fila).join('');
      }
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
