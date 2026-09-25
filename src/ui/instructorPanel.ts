/**
 * Panel docente: fisiología del paciente virtual, eventos (fallos) con deshacer, verdad del modelo, escenarios y lección.
 * Los cambios de paciente se envían como instructor; la pila de deshacer guarda los comandos inversos.
 */
import type { Command } from '../domain/commands';
import type { EngineFrame } from '../engine/simulator';
import { formatNumber as f } from '../domain/units';
import { findScenario } from '../scenarios';
import type { AppContext } from './context';
import { $, $$, icon, put } from './dom';
import type { HoldPanel } from './holdPanel';
import { infoButton, infoPanel } from './helpPanels';
import type { MetricsView } from './metricsView';
import { FAULTS, PATIENT_EXTRA, PATIENT_MAIN, PHYS, physHtml, presetsHtml, type PhysSpec } from './patientControls';
import { TISSUE_PRESETS, TUBE_PRESETS } from './mechanicsPresets';
import type { PlotsView } from './plotsView';
import type { QuickEditor } from './quickEditor';

export interface InstructorPanel {
  readonly teacherVisible: boolean;
  /** Construye controles de paciente y rejilla de eventos. */
  init(): void;
  /** Estado inicial del botón de mostrar/ocultar y pie del panel (tras medir el monitor, como en el arranque original). */
  initChrome(): void;
  updateTeacher(): void;
  setPhys(cmds: Command[], undo: Command[] | null): Promise<boolean>;
  fault(kind: string): Promise<void>;
  loadScenario(id: string): void;
  switchInstructor(tab: string): void;
  toggleTeacher(): void;
  resetPatient(): Promise<void>;
  undoEvent(): Promise<void>;
  /** Arrastre de un deslizador fisiológico: sincroniza la casilla numérica y el relleno. */
  physRangeInput(el: HTMLInputElement): void;
  /** Cambio confirmado de un control fisiológico (deslizador o número). */
  physChange(el: HTMLInputElement | HTMLSelectElement): void;
  /** Selects de presets fisiológicos (U-37): aplican los campos del preset elegido con setPatient. */
  presetChange(el: HTMLSelectElement): void;
}

export function createInstructorPanel(
  ctx: AppContext,
  deps: { quick: QuickEditor; hold: HoldPanel; metrics: MetricsView; plots: PlotsView; initialVisible: boolean },
): InstructorPanel {
  let teacherVisible = deps.initialVisible;
  const eventUndo: Command[][] = [];
  let apneaApplied = false;

  function renderToggle(): void {
    $('#workspace').classList.toggle('teacher-hidden', !teacherVisible);
    const tb = $('#teacher-toggle');
    tb.setAttribute('aria-pressed', String(teacherVisible));
    tb.setAttribute('aria-label', `${teacherVisible ? 'Ocultar' : 'Mostrar'} panel docente`);
    tb.setAttribute('title', `${teacherVisible ? 'Ocultar' : 'Mostrar'} panel docente`);
  }
  function updateTeacher(): void {
    const fr = ctx.frame as EngineFrame;
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
    syncPreset(
      $<HTMLSelectElement>('#preset-tissue'),
      TISSUE_PRESETS,
      (pre) => Math.abs((p.eVisc ?? 0) - pre.eVisc) < 1e-6 && Math.abs((p.tauViscS ?? 1.2) - pre.tauViscS) < 1e-6,
      (pre) => pre.note,
    );
    syncPreset(
      $<HTMLSelectElement>('#preset-tube'),
      TUBE_PRESETS,
      (pre) => Math.abs(p.r2 - pre.r2) < 1e-6,
      () => '',
    );
    put('#truth-tauin', `${f(p.rInsp * p.crs, 2)} s`);
    put('#truth-tau', `${f(p.rExp * p.crs, 2)} s`);
    put('#truth-auto', `${f(fr.truth.peepiEndExp, 1)} cmH₂O`);
    put('#truth-vabs', `${f(fr.truth.vAbsL * 1000, 0)} mL`);
    put('#truth-o2', `${f(fr.truth.fio2Delivered * 100, 0)} / ${f((fr.metrics.fio2?.value ?? 0) * 100, 1)} %`);
    put('#truth-pvisc', `${f(fr.truth.pVisc, 2)} cmH₂O`);
    put('#truth-clocal', `${f(fr.truth.cLocal * 1000, 1)} mL/cmH₂O`);
    const sg = fr.truth.patient.sigmoid;
    put('#truth-knees', sg ? `${f(sg.c - 1.317 * sg.d, 0)} / ${f(sg.c + 1.317 * sg.d, 0)} cmH₂O` : 'curva lineal');
    put('#muscle-value', `${f(fr.truth.pmus, 1)} cmH₂O`);
    // Inventario honesto del modelo activo: qué piezas opcionales están encendidas en este paciente.
    const opciones: string[] = [];
    if ((p.eVisc ?? 0) > 0) opciones.push('viscoelástica');
    if ((p.sigmoid?.b ?? 0) > 0) opciones.push('P-V sigmoidea');
    if (p.r2 > 0) opciones.push('Rohrer');
    if (p.efl) opciones.push('limitación flujo esp.');
    if ((p.rExpVolumeDep?.gain ?? 0) > 0) opciones.push('Rexp(V)');
    if (p.second) opciones.push('2.ª unidad');
    if ((p.leakLpmAt10 ?? 0) > 0) opciones.push('fuga');
    if ((p.rExpValve ?? 0) > 0) opciones.push('rama esp.');
    if ((p.circuitComplianceLPerCmH2O ?? 0) > 0) opciones.push('circuito compresible');
    if ((fr.truth.effort.expAmplitude ?? 0) > 0) opciones.push('espiración activa');
    if (fr.truth.effort.variability) opciones.push('esfuerzo variable');
    put('#truth-opciones', opciones.length ? opciones.join(', ') : 'lineal, un compartimento');
    const vcircCell = document.getElementById('truth-vcirc-cell');
    if (vcircCell) {
      const cc = p.circuitComplianceLPerCmH2O ?? 0;
      vcircCell.hidden = !(cc > 0);
      put('#truth-vcirc', `${f(fr.truth.vCircL * 1000, 0)} mL`);
    }
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
  async function setPhys(cmds: Command[], undo: Command[] | null): Promise<boolean> {
    let ok = true;
    for (const c of cmds) {
      const r = await ctx.send(c, 'instructor');
      ok = ok && r.accepted;
    }
    if (ok && undo) eventUndo.push(undo);
    return ok;
  }
  async function fault(kind: string): Promise<void> {
    const fr = ctx.frame;
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
    } else if (kind === 'leak')
      await setPhys(
        [{ type: 'setPatient', params: { leakLpmAt10: 6 } }],
        [{ type: 'setPatient', params: { leakLpmAt10: p.leakLpmAt10 ?? 0 } }],
      );
    else if (kind === 'disconnect')
      await setPhys(
        [{ type: 'setPatient', params: { disconnected: true } }],
        [{ type: 'setPatient', params: { disconnected: !!p.disconnected } }],
      );
  }
  function switchInstructor(tab: string): void {
    for (const e of $$('[data-instructor]')) {
      const on = e.dataset.instructor === tab;
      e.classList.toggle('active', on);
      e.setAttribute('aria-selected', String(on));
    }
    for (const id of ['patient', 'learn', 'events']) $('#instructor-' + id).classList.toggle('active', id === tab);
  }
  /** Select de preset reflejando el estado: preset coincidente (tolerancia 1e-6) o «Personalizado», con su nota. */
  function syncPreset<T extends { id: string }>(
    sel: HTMLSelectElement,
    presets: readonly T[],
    coincide: (p: T) => boolean,
    nota: (p: T) => string,
  ): void {
    const activo = presets.find(coincide) ?? null;
    if (document.activeElement !== sel) sel.value = activo?.id ?? 'custom';
    put(`#${sel.id}-note`, activo ? nota(activo) : '');
  }
  function loadScenario(id: string): void {
    const sc = findScenario(id);
    if (!sc) return;
    ctx.setScenario(sc);
    ctx.lesson.setSessionImported(false);
    // Lo primero que necesita quien abre un escenario es qué tiene que hacer en él.
    switchInstructor('learn');
    ctx.dialog.close();
    deps.quick.cancelQuick();
    deps.hold.closeHoldPanel();
    ctx.clearLock();
    eventUndo.length = 0;
    deps.metrics.resetLog();
    deps.plots.reset();
    if (ctx.frozen) ctx.toggleFreeze();
    $('#monitor').classList.add('loading');
    ctx.client.loadScenario(sc, false); // la lección se reinicia al llegar el primer cuadro de la sesión nueva
    ctx.switchView('waves');
    $('#global-notice').hidden = true;
  }
  return {
    get teacherVisible() {
      return teacherVisible;
    },
    init() {
      $('#patient-controls').innerHTML = physHtml(PATIENT_MAIN, infoButton, infoPanel);
      $('#patient-extra-controls').innerHTML =
        // Los presets de referencia (U-37) van pegados a los deslizadores que rellenan: tras 'rohrer'.
        physHtml(PATIENT_EXTRA.slice(0, PATIENT_EXTRA.indexOf('rohrer') + 1), infoButton, infoPanel) +
        presetsHtml(infoButton, infoPanel) +
        physHtml(PATIENT_EXTRA.slice(PATIENT_EXTRA.indexOf('rohrer') + 1), infoButton, infoPanel) +
        `<p class="settings-annotation">La fuga se modela en la pieza en Y, lineal con la presión; sin compensación de fuga ni distensibilidad del circuito.</p>`;
      $('#fault-grid').innerHTML = FAULTS.map(
        ([id, i, l, d, off]) =>
          `<button data-event="${id}" id="event-${id}" ${off ? 'disabled' : ''}>${icon(i)}<b>${l}</b><small>${d}</small></button>`,
      ).join('');
    },
    initChrome() {
      renderToggle();
    },
    updateTeacher,
    setPhys,
    fault,
    loadScenario,
    switchInstructor,
    toggleTeacher() {
      teacherVisible = !teacherVisible;
      renderToggle();
    },
    async resetPatient() {
      const scenario = ctx.scenario;
      await setPhys(
        [
          { type: 'setPatient', params: { ...scenario.patient } },
          { type: 'setEffort', params: { ...scenario.effort } },
          { type: 'setSensors', params: { ...scenario.sensors } },
        ],
        null,
      );
    },
    async undoEvent() {
      const u = eventUndo.pop();
      if (u) await setPhys(u, null);
      else ctx.toast('No hay eventos para deshacer.');
    },
    physRangeInput(el) {
      const k = el.dataset.physRange as string;
      $<HTMLInputElement>(`[data-phys-number="${k}"]`).value = el.value;
      const sp = PHYS[k] as PhysSpec;
      el.style.setProperty('--fill', `${(100 * (Number(el.value) - sp.min)) / (sp.max - sp.min)}%`);
    },
    physChange(el) {
      const k = ((el as HTMLInputElement).dataset.physRange ?? (el as HTMLInputElement).dataset.physNumber) as string;
      const sp = PHYS[k] as PhysSpec;
      const frame = ctx.frame;
      if (frame)
        void setPhys([sp.cmd(Number(el.value), frame)], null).then(() => {
          el.blur();
          if (ctx.frame) updateTeacher();
        });
    },
    presetChange(el) {
      const frame = ctx.frame;
      if (!frame) return;
      const cmds =
        el.dataset.physPreset === 'tissue'
          ? (() => {
              const pre = TISSUE_PRESETS.find((x) => x.id === el.value);
              return pre ? [{ type: 'setPatient' as const, params: { eVisc: pre.eVisc, tauViscS: pre.tauViscS } }] : [];
            })()
          : (() => {
              const pre = TUBE_PRESETS.find((x) => x.id === el.value);
              return pre ? [{ type: 'setPatient' as const, params: { r2: pre.r2 } }] : [];
            })();
      if (cmds.length) void setPhys(cmds, null).then(() => ctx.frame && updateTeacher());
    },
  };
}
