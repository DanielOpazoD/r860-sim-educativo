/**
 * Despacho de acciones (`data-action`) y oyentes delegados del documento (click / input / change).
 * Cada caso reenvía a su rasgo; aquí sólo viven las acciones sin dueño propio (sesión, exportaciones, espera, O₂).
 */
import { ENGINE_VERSION } from '../engine/version';
import { SCENARIOS } from '../scenarios';
import type { AlarmsUi } from './alarmsUi';
import type { AppContext } from './context';
import { CANCEL_BTN, CLOSE_BTN } from './dialogHost';
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
import { $, btn } from './dom';
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
import { stamp, unitText } from './format';
import { toggleHelp } from './helpPanels';
import type { HoldPanel } from './holdPanel';
import type { InstructorPanel } from './instructorPanel';
import { displaySetting, modeLabel, MODE_LABEL, QUICK_KEYS_BY_MODE, QUICK_LABEL } from './labels';
import type { MetricsView } from './metricsView';
import type { ModeDialog } from './modeDialog';
import type { PlotsView } from './plotsView';
import type { QuickEditor } from './quickEditor';
import type { SettingsKey, VentMode } from '../domain/types';

export interface Features {
  quick: QuickEditor;
  hold: HoldPanel;
  modes: ModeDialog;
  alarms: AlarmsUi;
  metrics: MetricsView;
  plots: PlotsView;
  instructor: InstructorPanel;
}

export interface Actions {
  action(a: string): Promise<void>;
  /** Oyentes delegados de click / input / change, importación de sesión, rueda del mando, visibilidad y reubicación. */
  bind(): void;
}

export function createActions(ctx: AppContext, fx: Features): Actions {
  const { quick, hold, modes, alarms, metrics, plots, instructor } = fx;
  const debriefInput = () => ({
    scenario: ctx.scenario,
    tasks: ctx.scenario.lesson?.tasks ?? [],
    done: ctx.lesson.done,
    simS: ctx.simS(),
    breathCount: ctx.frame?.breathCount ?? 0,
  });
  function standbyDialog(): void {
    if (ctx.frame?.ventilation === 'standby') {
      void ctx.send({ type: 'startVentilation' });
      return;
    }
    ctx.dialog.open('standby', '¿Pasar a espera virtual?', standbyHTML(), CANCEL_BTN + btn('Pasar a espera', 'confirmStandby'), 'compact');
  }
  function oxygenDialog(): void {
    const o2 = ctx.frame?.procedure.o2;
    ctx.dialog.open(
      'oxygen',
      'Oxígeno temporal',
      oxygenHTML(o2, ctx.frame?.simTimeMs ?? 0),
      CANCEL_BTN + (o2?.active ? btn('Finalizar incremento', 'stopOxygen') : btn('Iniciar 100 % · 120 s', 'startOxygen')),
      'compact',
    );
  }
  async function exportSession(): Promise<void> {
    const file = await ctx.client.exportSession();
    if (!file) {
      ctx.toast('No se pudo guardar la sesión: el motor no la entregó.', true);
      return;
    }
    downloadBlob(sessionBlob(file), `R860_sesion_${stamp()}.json`);
    ctx.toast(`Sesión guardada (${file.commands.length} comandos, ${file.breaths.length} respiraciones).`);
  }
  function exportCSV(signal: boolean): void {
    const fr = ctx.frame;
    if (!fr) return;
    const rows = signal ? signalRows(plots.points) : trendsRows(fr);
    downloadBlob(csvBlob(signal ? SIGNAL_HEADER : TRENDS_HEADER, rows), `R860_${signal ? 'senal' : 'tendencias'}_${stamp()}.csv`);
    ctx.toast(`${rows.length} filas exportadas.`);
  }
  function snapshot(): void {
    const fr = ctx.frame;
    if (!fr) return;
    plots.renderPlots();
    const rules = ctx.profile.rules;
    const quickItems: [string, string][] = [
      ['Modo actual', MODE_LABEL[fr.settings.mode]],
      ...QUICK_KEYS_BY_MODE[fr.settings.mode].map(
        (k) =>
          [QUICK_LABEL[k], displaySetting(rules, k, fr.settings[k]) + (k === 'ie' ? '' : ' ' + unitText(rules[k].displayUnit))] as [
            string,
            string,
          ],
      ),
    ];
    const view = ctx.view;
    const c = paintSnapshot(document.createElement('canvas'), {
      frame: fr,
      view,
      waveCanvas: $<HTMLCanvasElement>(view === 'basic' ? '#basic-wave-canvas' : '#waves-canvas'),
      gaugeCanvas: $<HTMLCanvasElement>('#gauge-canvas'),
      holdVisible: hold.isOpen,
      scenarioName: ctx.scenario.name,
      quickItems,
    });
    c.toBlob((blob) => {
      if (!blob) {
        ctx.toast('No se pudo crear la imagen.', true);
        return;
      }
      downloadBlob(blob, `R860_monitor_${stamp()}.png`);
      ctx.lesson.flags.snapshot = true;
      ctx.lesson.evaluate();
    }, 'image/png');
  }
  const openHelp = (tab: string): void => ctx.dialog.open('help', 'Guía del simulador', helpHTML(tab), CLOSE_BTN, 'wide');

  async function action(a: string): Promise<void> {
    switch (a) {
      case 'home':
        ctx.dialog.close();
        ctx.switchView('waves');
        break;
      case 'menu':
        ctx.dialog.open('menu', 'Menú', menuHTML());
        break;
      case 'modes':
        modes.openModes();
        break;
      case 'confirmModes':
        await modes.confirmModes();
        break;
      case 'scenarios':
        ctx.dialog.open(
          'scenarios',
          'Elige un escenario de entrenamiento',
          scenariosHTML(SCENARIOS, ctx.scenario.id, modeLabel),
          CANCEL_BTN,
          'wide',
        );
        break;
      case 'teacher':
        instructor.toggleTeacher();
        break;
      case 'pause':
        if (ctx.running) ctx.client.pause('usuario');
        else ctx.client.resume();
        $('#global-notice').hidden = true;
        break;
      case 'freeze':
        ctx.toggleFreeze();
        break;
      case 'density':
        ctx.setTileDensity(ctx.tileDensity === 6 ? 13 : 6);
        break;
      case 'sound':
        await alarms.toggleAudio();
        break;
      case 'fullscreen':
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
        } catch {
          ctx.toast('No se pudo activar pantalla completa.', true);
        }
        break;
      case 'alarms':
        alarms.alarms();
        break;
      case 'alarmSetup':
        alarms.alarmSetup();
        break;
      case 'confirmLimits':
        await alarms.confirmLimits();
        break;
      case 'mute':
        await ctx.send({ type: 'audioPause' });
        break;
      case 'acknowledge':
        await ctx.send({ type: 'acknowledgeAlarms' });
        break;
      case 'inspiratory':
        hold.openHold('inspHold');
        break;
      case 'expiratory':
        hold.openHold('expHold');
        break;
      case 'closeHold':
        if (ctx.frame?.procedure.hold) await ctx.send({ type: 'cancelProcedure' });
        hold.closeHoldPanel();
        break;
      case 'runHold':
        await hold.runHold();
        break;
      case 'cancelHold':
        await hold.cancelHold();
        break;
      case 'manual': {
        await ctx.send({ type: 'manualBreath' });
        ctx.dialog.close();
        break;
      }
      case 'oxygen':
        oxygenDialog();
        break;
      case 'startOxygen':
        await ctx.send({ type: 'increaseO2Start' });
        ctx.dialog.close();
        break;
      case 'stopOxygen':
        await ctx.send({ type: 'increaseO2Stop' });
        ctx.dialog.close();
        break;
      case 'cancelEdit':
        quick.cancelQuick();
        break;
      case 'confirmEdit':
        quick.confirmQuick();
        break;
      case 'editMinus':
        quick.stepQuick(-1);
        break;
      case 'editPlus':
        quick.stepQuick(1);
        break;
      case 'knob':
        if (quick.edit.state.kind !== 'idle') quick.confirmQuick();
        else ctx.toast('Selecciona primero un parámetro de la barra inferior.');
        break;
      case 'lock':
        ctx.setLocked(!ctx.locked);
        break;
      case 'unlock':
        ctx.setLocked(false);
        break;
      case 'standby':
        standbyDialog();
        break;
      case 'confirmStandby':
        await ctx.send({ type: 'enterStandby' });
        ctx.dialog.close();
        break;
      case 'startVentilation':
        await ctx.send({ type: 'startVentilation' });
        ctx.dialog.close();
        break;
      case 'powerInfo':
        ctx.dialog.open('power', 'Entorno de simulación', powerHTML(), '', 'compact');
        break;
      case 'patient':
        ctx.dialog.open('patient', 'Paciente virtual · adulto', patientHTML(), CLOSE_BTN, 'compact');
        break;
      case 'resetPatient':
        await instructor.resetPatient();
        break;
      case 'undoEvent':
        await instructor.undoEvent();
        break;
      case 'loopReference':
        plots.saveLoopReference();
        break;
      case 'clearLoop':
        plots.clearLoopReference();
        break;
      case 'waveReference':
        plots.saveWaveReference();
        break;
      case 'clearWaveRef':
        plots.clearWaveReference();
        break;
      case 'exam':
        ctx.setExamMode(!ctx.examMode);
        break;
      case 'examSubmit':
        metrics.submitEstimate();
        break;
      case 'tools':
        ctx.dialog.open('tools', 'Mecánica y procedimientos', toolsHTML());
        break;
      case 'mechanics':
        metrics.mechanics();
        break;
      case 'session':
        ctx.dialog.open(
          'session',
          'Sesión y exportaciones',
          sessionHTML(ctx.scenario.name, ctx.simS(), ENGINE_VERSION, ctx.profile.profileVersion),
          CLOSE_BTN,
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
        ctx.dialog.open(
          'debrief',
          'Resumen de práctica',
          debriefHTML(debriefInput()),
          CLOSE_BTN + btn('Guardar resumen TXT', 'exportDebrief'),
        );
        break;
      case 'exportDebrief':
        if (ctx.frame) downloadBlob(textBlob(debriefText(debriefInput(), ctx.frame)), `R860_practica_${stamp()}.txt`);
        break;
      case 'help':
        openHelp('start');
        break;
      case 'model':
        openHelp('model');
        break;
      case 'closeDialog':
        ctx.dialog.close();
        break;
      default:
        ctx.toast('Acción no disponible en esta versión.', true);
    }
  }

  function bind(): void {
    document.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-action],[data-view],[data-instructor],[data-setting-quick],[data-scenario],[data-scenario-view],[data-event],[data-metric],[data-help-tab],[data-help-target],[data-mode]',
      );
      if (!el) return;
      e.preventDefault();
      if (el.dataset.helpTarget) {
        toggleHelp(el);
        return;
      }
      if (el.dataset.scenarioView) {
        const start = el.dataset.scenarioView === 'start';
        $('#scenario-start').hidden = !start;
        $('#scenario-all').hidden = start;
        for (const button of document.querySelectorAll<HTMLElement>('[data-scenario-view]'))
          button.setAttribute('aria-pressed', String(button.dataset.scenarioView === el.dataset.scenarioView));
        $('#dialog-content').scrollTop = 0;
        return;
      }
      if (ctx.locked && el.closest('#monitor') && !['mute', 'alarms', 'unlock', 'closeHold'].includes(el.dataset.action ?? '')) {
        ctx.toast('Mandos protegidos.');
        return;
      }
      if (el.dataset.action) {
        void action(el.dataset.action).catch((err: Error) => ctx.notice(err.message));
        return;
      }
      if (el.dataset.view) ctx.switchView(el.dataset.view);
      if (el.dataset.instructor) instructor.switchInstructor(el.dataset.instructor);
      if (el.dataset.settingQuick) quick.openQuick(el.dataset.settingQuick as SettingsKey, el);
      if (el.dataset.scenario) instructor.loadScenario(el.dataset.scenario);
      if (el.dataset.mode && !(el as HTMLButtonElement).disabled) modes.selectMode(el.dataset.mode as VentMode);
      if (el.dataset.event) void instructor.fault(el.dataset.event);
      if (el.dataset.metric) metrics.metricClick(el.dataset.metric);
      if (el.dataset.helpTab) openHelp(el.dataset.helpTab);
    });
    document.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.id === 'quick-value') quick.typedQuick(el.value);
      if (el.id === 'quick-range') quick.slidQuick(Number(el.value));
      if (el.dataset.physRange) instructor.physRangeInput(el);
      if (el.dataset.modeField) modes.readModeField(el);
      if (el.dataset.limit) alarms.readLimits();
      if (el.id === 'history-slider') plots.slideHistory(Number(el.value));
      if (el.id === 'cursor-slider') plots.slideCursor(Number(el.value), 'A');
      if (el.id === 'cursor-b-slider') plots.slideCursor(Number(el.value), 'B');
    });
    document.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement | HTMLSelectElement;
      if ((el as HTMLInputElement).dataset.physRange || (el as HTMLInputElement).dataset.physNumber) instructor.physChange(el);
      if (el.dataset.physPreset) instructor.presetChange(el as HTMLSelectElement);
      if (el.id === 'scenario-topic') {
        for (const group of document.querySelectorAll<HTMLElement>('[data-scenario-topic]'))
          group.hidden = !!el.value && group.dataset.scenarioTopic !== el.value;
        $('#scenario-all .scenario-reference').hidden = !!el.value;
      }
      if (el.id === 'sim-speed') ctx.setSpeed(Number(el.value));
      if (el.id === 'wave-window') plots.setWaveWindow(Number(el.value));
      if (el.id === 'wave-style') plots.setWaveStyle(el.value as 'sweep' | 'scroll');
      if (el.id === 'wave-scale') plots.setWaveScaleMode(el.value as 'auto' | 'fixed');
      if ((el as HTMLInputElement).dataset.modeField) modes.readModeField(el as HTMLInputElement);
    });
    $('#session-input').addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        ctx.toast('Archivo demasiado grande (máximo 2 MB).', true);
        return;
      }
      const text = await file.text();
      // Antes de esperar la respuesta: el motor manda el primer cuadro de la sesión reproducida justo después de ella, y
      // los objetivos del escenario anterior no deben evaluarse contra él ni un cuadro.
      ctx.lesson.setSessionImported(true);
      const r = await ctx.client.importSession(text);
      if (r.ok) {
        plots.reset();
        ctx.clearFixture();
        ctx.dialog.close();
        ctx.toast(`Sesión importada y reproducida en pausa. ${r.warnings?.join(' ') ?? ''} Pulsa Reanudar.`);
      } else {
        ctx.lesson.setSessionImported(false);
        ctx.toast(`Rechazada: ${r.errors?.join(' · ')}`, true);
      }
    });
    $('#truth-details').addEventListener('toggle', () => {
      if ($<HTMLDetailsElement>('#truth-details').open) ctx.lesson.flags.truthOpen = true;
    });
    $('#trim-knob').addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        quick.stepQuick((e as WheelEvent).deltaY < 0 ? 1 : -1);
      },
      { passive: false },
    );
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && ctx.frame && ctx.running && !ctx.fixtureId) {
        ctx.client.visibility(true);
      }
    });
    setInterval(() => {
      const now = performance.now();
      quick.edit.tick(now);
      quick.renderCountdown(now);
    }, 500);
    window.addEventListener('resize', () => {
      if (quick.edit.state.kind !== 'idle') quick.placeQuickEditor();
      if (hold.isOpen) hold.placeHoldPanel();
    });
  }
  return { action, bind };
}
