import type { AlarmLimits, AlarmState, OffOr, SettingsKey, VcSettings } from '../../domain/types';
import { ModeMenuDraft } from '../../app/uiState';
import { stepDisplayValue } from '../../domain/validation';
import { ALARM_LIMIT_RULES, VC_ADULT_CROSS_LIMITS, VC_ADULT_RULES } from '../../profiles/r860-es-photo-reference/settings';
import { h } from './dom';
import { fmtIE, fmtLimit } from './format';

export type DialogResult<T> = Promise<T>;

/** Capa de diálogos dentro de la pantalla simulada: cada diálogo es una transacción (confirmar/cancelar). */
export class Dialogs {
  root: HTMLElement;
  private layer: HTMLElement;
  constructor() {
    this.layer = h('div', { class: 'dialog-layer' });
    this.root = this.layer;
    this.layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
  }
  get open(): boolean { return this.layer.classList.contains('show'); }
  private resolver: ((v: unknown) => void) | null = null;
  private show<T>(content: HTMLElement): Promise<T> {
    this.layer.replaceChildren(content);
    this.layer.classList.add('show');
    const first = content.querySelector<HTMLElement>('button, [tabindex]');
    first?.focus();
    return new Promise<T>((res) => { this.resolver = res as (v: unknown) => void; });
  }
  close(value: unknown = null): void {
    this.layer.classList.remove('show');
    this.layer.replaceChildren();
    const r = this.resolver; this.resolver = null; r?.(value);
  }

  /** D QRG 2020 p.14: Standby → Pause Ventilation; Cancel continúa ventilando. */
  confirmStandby(): Promise<boolean> {
    const d = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pausar ventilación' },
      h('h2', { text: '¿Entrar en espera?' }),
      h('div', { text: 'La ventilación y la monitorización simuladas se detendrán. Pulsar la tecla no basta: esta confirmación es la transición.' }),
      h('div', { class: 'note', text: 'D: guía rápida 2020 p.14 «Select Standby → Pause Ventilation; Cancel to continue». Texto en español: P.' }),
      h('div', { class: 'actions' }, h('button', { type: 'button', onclick: () => this.close(false) }, 'Cancelar'), h('button', { type: 'button', class: 'danger', onclick: () => this.close(true) }, 'Pausar ventilación')),
    );
    return this.show<boolean>(d);
  }

  info(title: string, lines: string[]): Promise<void> {
    const d = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h2', { text: title }), ...lines.map((l) => h('div', { class: 'note', text: l })), h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: () => this.close() }, 'Cerrar')));
    return this.show<void>(d);
  }

  /** Menú de modo: lista de modos (sólo A/C VC habilitado) y ajustes como transacción única. */
  modeMenu(active: VcSettings): Promise<Partial<VcSettings> | null> {
    const draft = new ModeMenuDraft(VC_ADULT_RULES, VC_ADULT_CROSS_LIMITS, active);
    const rows: { key: SettingsKey; label: string; val: HTMLElement }[] = [];
    const preview = h('div', { class: 'note' });
    const reasons = h('div', { class: 'reasons' });
    const confirmBtn = h('button', { type: 'button', class: 'primary', onclick: () => this.close(draft.changes()) }, 'Confirmar');
    const render = () => {
      for (const r of rows) {
        const v = draft.draft[r.key];
        r.val.textContent = r.key === 'ie' ? fmtIE(v as number) : v === 'off' ? 'Off' : typeof v === 'boolean' ? (v ? 'On' : 'Off') : ((v as number) * VC_ADULT_RULES[r.key].displayFactor).toFixed(VC_ADULT_RULES[r.key].decimals);
      }
      const v = draft.validate();
      preview.textContent = `Derivados: Tinsp ${v.derived.tInspS.toFixed(2)} s · Texp ${v.derived.tExpS.toFixed(2)} s · pausa ${v.derived.tPauseS.toFixed(2)} s · flujo ${(v.derived.qTargetLps * 60).toFixed(1)} L/min (RR e I:E controlan; Tinsp/Texp/flujo se recalculan, P)`;
      reasons.textContent = v.ok ? '' : v.reasons.join(' · ');
      confirmBtn.disabled = !v.ok;
    };
    const specs: { key: SettingsKey; label: string; unit: string }[] = [
      { key: 'vt', label: 'VT', unit: 'ml' }, { key: 'rr', label: 'Frecuencia', unit: '/min' }, { key: 'ie', label: 'I:E', unit: '' }, { key: 'pausePct', label: 'Pausa insp (P)', unit: '% Tinsp' },
      { key: 'peep', label: 'PEEP', unit: 'cmH2O' }, { key: 'fio2', label: 'FiO2', unit: '%' }, { key: 'pmax', label: 'Pmáx', unit: 'cmH2O' }, { key: 'plimit', label: 'Plimit (P)', unit: 'cmH2O' },
      { key: 'assistControl', label: 'Control asistido (P)', unit: '' }, { key: 'flowTrigger', label: 'Trigger flujo (P)', unit: 'L/min' },
    ];
    const table = h('table', {}, h('thead', {}, h('tr', {}, h('th', { text: 'Ajuste' }), h('th', { text: 'Valor' }), h('th', { text: 'Unidad' }), h('th', { text: 'Evidencia' }))), h('tbody', {}, ...specs.map((s) => {
      const val = h('td', { class: 'num' });
      rows.push({ key: s.key, label: s.label, val });
      const rule = VC_ADULT_RULES[s.key];
      return h('tr', {}, h('td', { text: s.label }), h('td', {}, h('span', { class: 'stepper' }, h('button', { type: 'button', 'aria-label': `${s.label} menos`, onclick: () => { draft.adjust(s.key, -1); render(); } }, '−'), val, h('button', { type: 'button', 'aria-label': `${s.label} más`, onclick: () => { draft.adjust(s.key, 1); render(); } }, '+'))), h('td', { text: s.unit }), h('td', { text: `${rule.evidence.status} rango · ${rule.policyEvidence.status} aplicación`, title: `${rule.evidence.locator} — ${rule.policyEvidence.note}` }));
    })));
    const modes = h('div', { class: 'list' },
      h('div', { class: 'item' }, h('strong', { text: 'A/C VC' }), h('span', { text: 'habilitado · adulto · P0' })),
      ...[['A/C PC', 'no habilitado: pendiente de pruebas de banco PC (BM-03 con rampa real)'], ['CPAP/PS', 'no habilitado: exige esfuerzo/disparo/ciclaje validados y respaldo (PHY-03)'], ['A/C PRVC', 'no habilitado: algoritmo adaptativo no publicado (U-09)'], ['SIMV VC / SIMV PC', 'no habilitado: fase P1 del proyecto'], ['BiLevel / APRV / NIV / nCPAP / O₂ Therapy', 'no habilitado: opciones y versión no verificadas (U-15)']].map(([m, why]) => h('div', { class: 'item disabled-item' }, h('span', { text: m }), h('span', { class: 'why', text: why }))),
    );
    const d = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Menú de modo' },
      h('h2', { text: 'Modo actual · ajustes de A/C VC (transacción)' }), modes, h('div', { style: { height: '8px' } }), table, preview, reasons,
      h('div', { class: 'actions' }, h('button', { type: 'button', onclick: () => this.close(null) }, 'Cancelar'), confirmBtn),
    );
    render();
    return this.show<Partial<VcSettings> | null>(d);
  }

  /** Configuración de alarmas: límites (D rangos ficha 2014) como transacción; Auto Limits y apnea deshabilitados con motivo. */
  alarmSetup(limits: AlarmLimits, pmax: number): Promise<Partial<AlarmLimits> | null> {
    const draft: AlarmLimits = { ...limits };
    const rows: { key: keyof AlarmLimits; val: HTMLElement }[] = [];
    const render = () => { for (const r of rows) { const rule = ALARM_LIMIT_RULES[r.key]; r.val.textContent = fmtLimit(draft[r.key], rule.displayFactor, rule.decimals); } };
    const adj = (key: keyof AlarmLimits, dir: 1 | -1) => {
      const rule = ALARM_LIMIT_RULES[key];
      const cur = draft[key];
      const min = rule.domain[0]!.min;
      if (cur === 'off') { if (dir > 0) draft[key] = (min / rule.displayFactor) as never; }
      else {
        const d = (cur as number) * rule.displayFactor;
        if (dir < 0 && Math.abs(d - min) < 1e-9) draft[key] = 'off' as never;
        else draft[key] = (stepDisplayValue(rule, d, dir) / rule.displayFactor) as never;
      }
      render();
    };
    const spec: { key: keyof AlarmLimits; label: string }[] = [
      { key: 'ppeakLow', label: 'Ppico baja' }, { key: 'vteHigh', label: 'VTesp alto' }, { key: 'vteLow', label: 'VTesp bajo' }, { key: 'mveHigh', label: 'VMesp alto' }, { key: 'mveLow', label: 'VMesp bajo' },
      { key: 'rrHigh', label: 'FR alta' }, { key: 'rrLow', label: 'FR baja' }, { key: 'fio2High', label: 'FiO2 alta' }, { key: 'fio2Low', label: 'FiO2 baja' }, { key: 'peepeHigh', label: 'PEEPe alta' }, { key: 'peepeLow', label: 'PEEPe baja' },
    ];
    const table = h('table', {}, h('thead', {}, h('tr', {}, h('th', { text: 'Alarma' }), h('th', { text: 'Límite' }), h('th', { text: 'Unidad' }), h('th', { text: 'Prioridad (P)' }))), h('tbody', {},
      h('tr', {}, h('td', { text: 'Ppico alta (= Pmáx)' }), h('td', { class: 'num', text: String(pmax) }), h('td', { text: 'cmH2O' }), h('td', { text: 'alta · fin de inspiración (D)' })),
      ...spec.map((s) => {
        const val = h('span', { class: 'num' });
        rows.push({ key: s.key, val });
        const rule = ALARM_LIMIT_RULES[s.key];
        return h('tr', {}, h('td', { text: s.label }), h('td', {}, h('span', { class: 'stepper' }, h('button', { type: 'button', 'aria-label': `${s.label} menos`, onclick: () => adj(s.key, -1) }, '−'), val, h('button', { type: 'button', 'aria-label': `${s.label} más`, onclick: () => adj(s.key, 1) }, '+'))), h('td', { text: rule.displayUnit }), h('td', { text: s.key === 'mveLow' ? 'alta (P)' : 'media (P)' }));
      })));
    const d = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Configuración de alarmas' },
      h('h2', { text: 'Config. de alarmas (transacción)' }), table,
      h('div', { class: 'note', text: 'Off no es cero: con Off la alarma no se evalúa. Límites automáticos, tiempo de apnea y High Alert Audio: deshabilitados (fórmula/tiempos no verificados, U-11).' }),
      h('div', { class: 'actions' }, h('button', { type: 'button', onclick: () => this.close(null) }, 'Cancelar'), h('button', { type: 'button', class: 'primary', onclick: () => { const out: Partial<AlarmLimits> = {}; for (const k of Object.keys(draft) as (keyof AlarmLimits)[]) if (draft[k] !== limits[k]) (out as Record<string, OffOr<number>>)[k] = draft[k]; this.close(out); } }, 'Confirmar')),
    );
    render();
    return this.show<Partial<AlarmLimits> | null>(d);
  }

  /** Lista de alarmas: activas y previas pendientes de reconocimiento (D banda gris). */
  alarmList(alarms: AlarmState[], onAck: (id?: string) => void, wallNowMs: number, simNowMs: number): Promise<void> {
    const active = alarms.filter((a) => a.conditionActive);
    const pending = alarms.filter((a) => !a.conditionActive && a.latching && a.resolvedAtMs !== null && a.acknowledgedAtMs === null);
    const row = (a: AlarmState) => h('div', { class: `item alarm-row ${a.priority}` },
      h('div', {}, h('strong', { text: a.message }), h('div', { class: 'note', text: `${a.conditionActive ? 'ACTIVA' : 'resuelta'}${a.acknowledgedAtMs !== null ? ' · reconocida' : ' · sin reconocer'} · prioridad ${a.priority} (${a.priorityEvidence}) · canal ${a.source} · inicio t+${a.onsetAtMs === null ? '—' : ((a.onsetAtMs) / 1000).toFixed(1)} s · bruto ${a.rawValueAtOnset === null ? '—' : a.rawValueAtOnset.toFixed(2)} · mostrado ${a.displayedValueAtOnset ?? '—'} · umbral ${a.threshold ?? '—'}` })),
      h('button', { type: 'button', onclick: () => { onAck(a.id); this.close(); } }, 'Reconocer'));
    const d = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Alarmas' },
      h('h2', { text: `Alarmas · t = ${(simNowMs / 1000).toFixed(1)} s` }),
      h('div', { class: 'list' }, ...(active.length ? active.map(row) : [h('div', { class: 'note', text: 'Sin alarmas activas' })])),
      pending.length ? h('h2', { text: 'Previas pendientes de reconocimiento' }) : null,
      pending.length ? h('div', { class: 'list' }, ...pending.map(row)) : null,
      h('div', { class: 'note', text: 'Reconocer no resuelve la condición física; resolver no reconoce. La pausa de audio (2 min, D) no borra condiciones.' }),
      h('div', { class: 'actions' }, h('button', { type: 'button', onclick: () => { onAck(); this.close(); } }, 'Reconocer todas'), h('button', { type: 'button', class: 'primary', onclick: () => this.close() }, 'Cerrar')),
    );
    void wallNowMs;
    return this.show<void>(d);
  }

  /** Menú principal: procedimientos habilitados y funciones desactivadas con motivo (CFG-05). */
  mainMenu(cb: { inspHold: () => void; expHold: () => void; manualBreath: () => void; increaseO2: () => void; lock: () => void }): Promise<void> {
    const item = (label: string, why: string | null, fn?: () => void) => h('div', { class: `item${why ? ' disabled-item' : ''}` }, h('span', { text: label }), why ? h('span', { class: 'why', text: why }) : h('button', { type: 'button', onclick: () => { this.close(); fn?.(); } }, 'Abrir'));
    const d = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Menú' },
      h('h2', { text: 'Menú' }),
      h('div', { class: 'list' },
        item('Procedimientos · Bloqueo inspiratorio', null, cb.inspHold),
        item('Procedimientos · Bloqueo espiratorio', null, cb.expHold),
        item('Procedimientos · Respiración manual', null, cb.manualBreath),
        item('Procedimientos · ↑O2 (2 min, +100 % adulto, D)', null, cb.increaseO2),
        item('Procedimientos · Aspiración', 'no habilitado: secuencia y desconexión del circuito no modeladas en esta etapa'),
        item('Nebulizador (Aerogen / neumático)', 'no habilitado: sin submodelo de flujo añadido'),
        item('Sistema · Fuente de datos', 'fijo: ventilador (sin módulo de vía aérea simulado)'),
        item('Sistema · Idioma', 'es-CL (etiquetas observadas; traducciones no vistas: P)'),
        item('Bloqueo de pantalla', null, cb.lock),
        item('Pasado / Futuro (tendencias, soporte de decisiones)', 'no habilitado: etapa 4 de la hoja de ruta'),
      ),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: () => this.close() }, 'Cerrar')),
    );
    return this.show<void>(d);
  }
}
