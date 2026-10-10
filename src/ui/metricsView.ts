/** Casillas numéricas, datos grandes, tabla de datos, registro de eventos y diálogos de mecánica / medición. */
import type { EngineFrame } from '../engine/simulator';
import { formatNumber as f } from '../domain/units';
import type { AppContext } from './context';
import { CANCEL_BTN, CLOSE_BTN } from './dialogHost';
import { $, $$, btn, esc, icon, put } from './dom';
import { clock } from './format';
import { helpContent, helpEntry, infoButton, infoPanel } from './helpPanels';
import { eventSentence, humanReason, learnerText } from './humanize';
import {
  ALL_METRICS,
  BIG_METRICS,
  CORE_METRICS,
  DATA_TABLE_GROUPS,
  limitPair,
  METRIC_HELP,
  METRICS,
  metricInAlarm,
  metricQuality,
  metricSample,
  metricStatus,
  metricValue,
  type MetricSpec,
  veredictoEstimacion,
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

function setAttributeIfChanged(el: Element, name: string, value: string): void {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

export interface MetricsView {
  /** Construye las rejillas de casillas (tabindex itinerante: una sola entrada por Tab). */
  init(): void;
  updateMetrics(): void;
  updateLogs(): void;
  /** Obliga a repintar el registro en el próximo cuadro (escenario nuevo). */
  resetLog(): void;
  /** Diálogo de mecánica respiratoria o, con `metric`, la ficha de una medición. */
  mechanics(metric?: string | null): void;
  /** Clic sobre una medición: en examen sin estimar abre el diálogo de estimación; si no, su ficha. */
  metricClick(metric: string): void;
  /** Registra la estimación escrita en el diálogo y muestra el valor real con el error cometido. */
  submitEstimate(): void;
  /** Cuántas mediciones ya estimó el alumno en el escenario actual. */
  readonly examEstimateCount: number;
  /** La medición ya fue estimada en este examen (el resto de vistas la destapa con `ctx.examMasked`). */
  examEstimated(key: string): boolean;
}

/**
 * Celda de valor de la tabla. El dato ausente se marca como ausencia y no como un número: un guión del tamaño de la
 * cifra se leía como una regla o como una muestra de leyenda.
 */
function celdaValor(texto: string, unidad: string): string {
  if (texto === '—') return `<span class="sin-dato">—</span>`;
  return `${esc(texto)}${unidad ? `<small>${esc(unidad)}</small>` : ''}`;
}

export function createMetricsView(ctx: AppContext): MetricsView {
  let logSignature = '';
  /** Estimaciones del alumno en modo examen: la medición tapada se revela sólo tras escribir una cifra. */
  const examEstimates = new Map<string, { guess: number; actual: number }>();
  // La referencia se fija al abrir la pregunta: si la simulación sigue corriendo, el valor no se mueve mientras
  // el alumno piensa su respuesta (auditoría).
  let examPending: { key: string; actual: number } | null = null;
  const value = (spec: MetricSpec): number | null => metricValue(ctx.frame, spec);
  const quality = (spec: MetricSpec): string => metricQuality(ctx.frame, spec);
  /** El dato existe pero en examen todavía no se estimó: la casilla enseña «?» en su lugar. */
  const oculto = (key: string): boolean => ctx.examMasked(key);
  return {
    init() {
      $('#variable-legend').innerHTML =
        '<h2>Variables del monitor</h2><dl>' +
        METRICS.map(
          (m) =>
            `<div><dt>${esc(m.label)}</dt><dd>${esc(helpEntry(METRIC_HELP[m.key] ?? '')?.text[0] ?? 'Descripción no disponible.')}</dd></div>`,
        ).join('') +
        '</dl>';
      $('#numeric-grid').innerHTML = METRICS.map(
        (m, i) =>
          `<button class="numeric" data-metric="${m.key}" data-core="${CORE_METRICS.includes(m.key)}" tabindex="${i === 0 ? 0 : -1}" title="${m.label}: información y medición" aria-label="${m.label}. Información y medición"><span class="numeric-label">${m.label}</span><strong class="numeric-value"><span>—</span></strong><span class="numeric-unit">${m.unit}</span><span class="numeric-limits" title="Límites de alarma: alto / bajo"></span><span class="numeric-age"></span></button>`,
      ).join('');
      $('#big-metrics').innerHTML = BIG_METRICS.map(
        ([k, l, u], i) =>
          `<button class="big-numeric" data-metric="${k}" tabindex="${i === 0 ? 0 : -1}"><span>${l}</span><b>—</b><em>${u}</em><span class="numeric-limits" title="Límites de alarma: alto / bajo"></span></button>`,
      ).join('');
    },
    updateMetrics() {
      const fr = ctx.frame as EngineFrame;
      for (const m of METRICS) {
        const el = $(`#numeric-grid [data-metric="${m.key}"]`);
        const valor = el.querySelector('.numeric-value > span') as HTMLElement;
        const h = fr.procedure.last.inspHold;
        const medido = metricValue(fr, m);
        const sinDato = medido === null;
        const muestra = metricSample(fr, m.key);
        const razon = humanReason(muestra?.reason);
        let motivoCompleto = '';
        let motivoCorto = '';
        if (sinDato && fr.ventilation !== 'standby') {
          if (m.source === 'hold' && !h) {
            motivoCompleto = 'requiere un bloqueo inspiratorio';
            motivoCorto = 'Requiere bloqueo';
          } else if (m.source === 'hold' && h && h.quality !== 'valid') {
            motivoCompleto = razon || 'bloqueo no válido';
            motivoCorto = 'Bloqueo no válido';
          } else {
            motivoCompleto = razon || 'sin dato';
            motivoCorto = razon ? (razon.length > 16 ? `${razon.slice(0, 16)}…` : razon) : 'Sin dato';
          }
          valor.classList.add('sin-dato');
          put(valor, '—');
          const accesible = `${m.label}: ${motivoCompleto}. Información y medición`;
          setAttributeIfChanged(el, 'title', accesible);
          setAttributeIfChanged(el, 'aria-label', accesible);
        } else {
          valor.classList.remove('sin-dato');
          put(valor, oculto(m.key) ? '?' : f(medido, m.decimals));
          setAttributeIfChanged(el, 'title', `${m.label}: información y medición`);
          setAttributeIfChanged(el, 'aria-label', `${m.label}. Información y medición`);
        }
        el.classList.toggle('exam-masked', !sinDato && oculto(m.key));
        put(el.querySelector('.numeric-limits'), limitPair(fr, m.key));
        el.classList.toggle('alarm-value', metricInAlarm(fr, m.key));
        if (m.key === 'ppeak') el.classList.toggle('plimit-limited', fr.live.plimitLimited); // indicador discreto, no alarma (E-036)
        // Con dos unidades en paralelo la Cstat/R son aproximadas: el aviso va pegado a la unidad porque la línea de
        // edad (fija en una celda de alto limitado) no tiene sitio para otra fila sin pintarse sobre la de abajo.
        put(
          el.querySelector('.numeric-unit'),
          metricSample(fr, m.key)?.reason?.startsWith('twoCompartments') ? `${m.unit} · aprox.` : m.unit,
        );
        const est = examEstimates.get(m.key);
        put(
          el.querySelector('.numeric-age'),
          motivoCorto ||
            (est
              ? `Est. ${f(est.guess, m.decimals)}`
              : m.source === 'hold' && h && h.quality === 'valid' && metricSample(fr, m.key)?.value !== null
                ? `Med. ${clock((h.completedAtMs ?? 0) / 1000)}`
                : ''),
        );
      }
      for (const e of $$('#big-metrics [data-metric]')) {
        const spec = METRICS.find((m) => m.key === e.dataset.metric) as MetricSpec;
        put(e.querySelector('b'), oculto(spec.key) && value(spec) !== null ? '?' : f(value(spec), spec.decimals));
        put(e.querySelector('.numeric-limits'), limitPair(fr, spec.key));
      }
      if (ctx.view === 'data') {
        const fila = (key: string): string => {
          const m = ALL_METRICS.find((candidate) => candidate.key === key);
          if (!m) return '';
          const est = examEstimates.get(m.key);
          const status = metricStatus(ctx.frame, m);
          const valor = oculto(m.key) && value(m) !== null ? '?' : f(value(m), m.decimals);
          const estado =
            `<span class="q-chip q-${status.tone}">${esc(status.label)}</span>` +
            (status.source ? `<span class="q-src">${esc(status.source)}</span>` : '');
          return (
            `<tr data-row="${esc(m.key)}"><td><button class="metric-name" data-metric="${esc(m.key)}">${esc(m.label)}${icon('info')}</button></td>` +
            `<td>${celdaValor(valor, m.unit)}</td>` +
            `<td class="metric-status" title="${esc(status.detail)}">${
              est ? `<span class="q-estimate">${esc(`Estimaste ${f(est.guess, m.decimals)} · `)}</span>` : ''
            }${estado}</td></tr>`
          );
        };
        const grupos = (items: (typeof DATA_TABLE_GROUPS)[number]): string =>
          items
            .map(
              (group) =>
                `<tr class="group-row"><th colspan="3" scope="colgroup">${esc(group.title)}</th></tr>${group.keys.map(fila).join('')}`,
            )
            .join('');
        $('#data-table-body').innerHTML = grupos(DATA_TABLE_GROUPS[0]!);
        $('#data-table-body-2').innerHTML = grupos(DATA_TABLE_GROUPS[1]!);
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
      examEstimates.clear(); // las respuestas del examen son del escenario, no de la sesión
    },
    get examEstimateCount() {
      return examEstimates.size;
    },
    examEstimated(key) {
      return examEstimates.has(key);
    },
    metricClick(metric: string): void {
      const spec = ALL_METRICS.find((m) => m.key === metric);
      if (!spec) return;
      const actual = value(spec);
      if (oculto(metric) && actual !== null) {
        examPending = { key: metric, actual };
        ctx.dialog.open(
          'examEstimate',
          `Estimar ${spec.label}`,
          `<div class="exam-estimate-body"><p>¿Cuánto crees que marca ${spec.label} ahora mismo? Escribe tu estimación y se revela el valor medido.</p><div class="editor-value"><input type="number" id="exam-estimate-input" inputmode="decimal" step="any" aria-label="Tu estimación de ${spec.label}"><span>${spec.unit}</span></div></div>`,
          CANCEL_BTN + btn('Comprobar', 'examSubmit', 'primary-button'),
          'compact',
        );
        setTimeout(() => $('#exam-estimate-input').focus(), 0);
        return;
      }
      this.mechanics(metric);
    },
    submitEstimate(): void {
      const pending = examPending;
      const spec = pending && ALL_METRICS.find((m) => m.key === pending.key);
      const input = $<HTMLInputElement>('#exam-estimate-input');
      if (!spec || !pending || !input) return;
      const texto = input.value.trim();
      // El campo vacío no vale como «0»: `Number('')` lo devuelve y la auditoría lo cazó como acierto gratis.
      const guess = texto === '' ? Number.NaN : Number(texto.replace(',', '.'));
      if (!Number.isFinite(guess)) {
        ctx.toast('Escribe un número para estimar.', true);
        return;
      }
      const actual = pending.actual;
      examEstimates.set(spec.key, { guess, actual });
      examPending = null;
      ctx.lesson.flags.examEstimate = true;
      ctx.lesson.evaluate();
      ctx.dialog.close();
      const veredicto = veredictoEstimacion(guess, actual, spec.decimals, spec.unit);
      ctx.toast(
        `${spec.label}: estimaste ${f(guess, spec.decimals)} y el monitor marcaba ${f(actual, spec.decimals)} ${spec.unit} (${veredicto}).`,
      );
      ctx.updateUI();
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
        `<table class="info-table"><thead><tr><th>Dato</th><th>Resultado</th><th>Medición</th></tr></thead><tbody>${rows.map((m) => `<tr><td><button class="metric-name" data-metric="${m.key}">${m.label}${icon('info')}</button></td><td>${oculto(m.key) && value(m) !== null ? '?' : f(value(m), m.decimals)} ${m.unit}</td><td>${esc(quality(m))}</td></tr>`).join('')}</tbody></table><div class="context-help-row"><span>Cómo se obtiene Cstat</span>${infoButton('metric.cstat', 'help-mechanics')}</div>${infoPanel('metric.cstat', 'help-mechanics')}`,
        btn('Bloqueo espiratorio', 'expiratory', 'secondary-button') + btn('Bloqueo inspiratorio', 'inspiratory'),
        'wide',
      );
    },
  };
}
