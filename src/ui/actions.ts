/**
 * Despacho de acciones (`data-action`) y oyentes delegados del documento (click / input / change).
 * Cada caso reenvía a su rasgo; aquí sólo viven las acciones sin dueño propio (sesión, exportaciones, espera, O₂).
 */
import { ENGINE_VERSION } from '../engine/version';
import { SCENARIOS } from '../scenarios';
import type { AlarmsUi } from './alarmsUi';
import type { AppContext } from './context';
import type { Classroom } from './classroom';
import { CANCEL_BTN, CLOSE_BTN } from './dialogHost';
import {
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
import { type CommandId, isCommandId } from './commands';
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
import { clearPrefs, savePrefs } from './prefs';
import type { MetricsView } from './metricsView';
import type { ModeDialog } from './modeDialog';
import type { PlotsView } from './plotsView';
import type { QuickEditor } from './quickEditor';
import type { AlarmLimits, SettingsKey, VentMode } from '../domain/types';
import { segmentedValue } from './segmented';

export interface Features {
  classroom: Classroom;
  quick: QuickEditor;
  hold: HoldPanel;
  modes: ModeDialog;
  alarms: AlarmsUi;
  metrics: MetricsView;
  plots: PlotsView;
  instructor: InstructorPanel;
  openPalette(): void;
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
    downloadBlob(sessionBlob(file), `Ventila_sesion_${stamp()}.json`);
    ctx.toast(`Sesión guardada (${file.commands.length} comandos, ${file.breaths.length} respiraciones).`);
  }
  function exportCSV(signal: boolean): void {
    const fr = ctx.frame;
    if (!fr) return;
    const rows = signal ? signalRows(plots.points) : trendsRows(fr);
    downloadBlob(csvBlob(signal ? SIGNAL_HEADER : TRENDS_HEADER, rows), `Ventila_${signal ? 'senal' : 'tendencias'}_${stamp()}.csv`);
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
      downloadBlob(blob, `Ventila_monitor_${stamp()}.png`);
      ctx.lesson.flags.snapshot = true;
      ctx.lesson.evaluate();
    }, 'image/png');
  }
  const openHelp = (tab: string): void => ctx.dialog.open('help', 'Guía del simulador', helpHTML(tab), CLOSE_BTN, 'wide');

  const handlers: Record<CommandId, () => void | Promise<unknown>> = {
    classroom: () => fx.classroom.open(),
    simulator: () => fx.classroom.simulator(),
    practice: () => fx.classroom.practice(),
    stopPractice: () => fx.classroom.stopPractice(),
    palette: () => fx.openPalette(),
    home: () => {
      ctx.dialog.close();
      ctx.switchView('waves');
    },
    menu: () => ctx.dialog.open('menu', 'Menú', menuHTML()),
    modes: () => modes.openModes(),
    confirmModes: () => modes.confirmModes(),
    scenarios: () => {
      ctx.dialog.open(
        'scenarios',
        'Escenarios y paciente',
        scenariosHTML(SCENARIOS, ctx.scenario.id, modeLabel, Boolean(ctx.fixtureId)),
        CLOSE_BTN,
        'scenario-dialog',
      );
    },
    'welcome-free': () => ctx.dialog.close(),
    'welcome-guided': async () => {
      ctx.dialog.close();
      await action('scenarios');
    },
    teacher: () => {
      fx.classroom.simulator();
      instructor.toggleTeacher();
    },
    pause: () => {
      if (ctx.running) ctx.client.pause('usuario');
      else ctx.client.resume();
      $('#global-notice').hidden = true;
    },
    freeze: () => ctx.toggleFreeze(),
    sound: () => alarms.toggleAudio(),
    fullscreen: async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        ctx.toast('No se pudo activar pantalla completa.', true);
      }
    },
    alarms: () => alarms.alarms(),
    alarmSetup: () => alarms.alarmSetup(),
    confirmLimits: () => alarms.confirmLimits(),
    mute: () => ctx.send({ type: 'audioPause' }),
    acknowledge: () => ctx.send({ type: 'acknowledgeAlarms' }),
    inspiratory: () => hold.openHold('inspHold'),
    expiratory: () => hold.openHold('expHold'),
    closeHold: async () => {
      if (ctx.frame?.procedure.hold) await ctx.send({ type: 'cancelProcedure' });
      hold.closeHoldPanel();
    },
    runHold: () => hold.runHold(),
    cancelHold: () => hold.cancelHold(),
    manual: async () => {
      await ctx.send({ type: 'manualBreath' });
      ctx.dialog.close();
    },
    oxygen: () => oxygenDialog(),
    startOxygen: async () => {
      await ctx.send({ type: 'increaseO2Start' });
      ctx.dialog.close();
    },
    stopOxygen: async () => {
      await ctx.send({ type: 'increaseO2Stop' });
      ctx.dialog.close();
    },
    cancelEdit: () => quick.cancelQuick(),
    confirmEdit: () => quick.confirmQuick(),
    editMinus: () => quick.stepQuick(-1),
    editPlus: () => quick.stepQuick(1),
    knob: () => {
      if (quick.edit.state.kind !== 'idle') quick.confirmQuick();
      else ctx.toast('Selecciona primero un parámetro de la barra inferior.');
    },
    lock: () => ctx.setLocked(!ctx.locked),
    unlock: () => ctx.setLocked(false),
    standby: () => standbyDialog(),
    confirmStandby: async () => {
      await ctx.send({ type: 'enterStandby' });
      ctx.dialog.close();
    },
    startVentilation: async () => {
      await ctx.send({ type: 'startVentilation' });
      ctx.dialog.close();
    },
    powerInfo: () => ctx.dialog.open('power', 'Entorno de simulación', powerHTML(), '', 'compact'),
    patient: () => ctx.dialog.open('patient', 'Paciente virtual · adulto', patientHTML(), CLOSE_BTN, 'compact'),
    resetPatient: () => instructor.resetPatient(),
    undoEvent: () => instructor.undoEvent(),
    loopReference: () => plots.saveLoopReference(),
    clearLoop: () => plots.clearLoopReference(),
    waveReference: () => {
      if (plots.waveRefAt !== null) plots.clearWaveReference();
      else plots.saveWaveReference();
    },
    exam: () => ctx.setExamMode(!ctx.examMode),
    examSubmit: () => metrics.submitEstimate(),
    tools: () => ctx.dialog.open('tools', 'Mecánica y procedimientos', toolsHTML()),
    mechanics: () => metrics.mechanics(),
    session: () => {
      ctx.dialog.open(
        'session',
        'Sesión y exportaciones',
        sessionHTML(ctx.scenario.name, ctx.simS(), ENGINE_VERSION, ctx.profile.profileVersion),
        CLOSE_BTN,
        'wide',
      );
    },
    resetPrefs: () => {
      clearPrefs();
      ctx.dialog.close();
      ctx.toast('Preferencias restablecidas: se aplican al recargar');
    },
    exportSession: () => exportSession(),
    importSession: () => $('#session-input').click(),
    csv: () => exportCSV(false),
    signalCSV: () => exportCSV(true),
    snapshot: () => snapshot(),
    debrief: () => fx.classroom.open('results'),
    exportDebrief: () => {
      if (ctx.frame) downloadBlob(textBlob(debriefText(debriefInput(), ctx.frame)), `Ventila_practica_${stamp()}.txt`);
    },
    help: () => openHelp('start'),
    model: () => openHelp('model'),
    closeDialog: () => ctx.dialog.close(),
  };
  async function action(a: string): Promise<void> {
    if (!isCommandId(a)) {
      ctx.toast('Acción no disponible en esta versión.', true);
      return;
    }
    await handlers[a]();
  }

  function bind(): void {
    const viewDialog = $<HTMLDialogElement>('#wave-options');
    const viewButton = $('#wave-options-button');
    viewButton.addEventListener('click', () => {
      viewDialog.showModal();
      viewButton.setAttribute('aria-expanded', 'true');
      viewDialog.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    });
    viewDialog.addEventListener('close', () => {
      viewButton.setAttribute('aria-expanded', 'false');
      viewButton.focus();
    });
    $('#view-options-close').addEventListener('click', () => viewDialog.close());
    const viewTabs = [...viewDialog.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const selectViewTab = (tab: HTMLButtonElement): void => {
      const selectedTab = viewTabs.find((item) => item.getAttribute('aria-selected') === 'true');
      if (selectedTab !== tab) viewDialog.querySelector<HTMLElement>('.view-settings-body')!.scrollTop = 0;
      for (const item of viewTabs) {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        $('#' + item.getAttribute('aria-controls')).hidden = !selected;
      }
      tab.focus();
    };
    for (const [index, tab] of viewTabs.entries()) {
      tab.addEventListener('click', () => selectViewTab(tab));
      tab.addEventListener('keydown', (e) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const next =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? viewTabs.length - 1
              : (index + (e.key === 'ArrowLeft' ? -1 : 1) + viewTabs.length) % viewTabs.length;
        selectViewTab(viewTabs[next]!);
      });
    }
    const morePopover = { button: $<HTMLButtonElement>('#more-button'), panel: $('#more-menu') };
    const popovers = [morePopover];
    const setPopoverOpen = (popover: (typeof popovers)[number], open: boolean, returnFocus = false): void => {
      popover.panel.hidden = !open;
      popover.button.setAttribute('aria-expanded', String(open));
      if (returnFocus) popover.button.focus();
    };
    for (const popover of popovers) {
      popover.button.addEventListener('click', () => {
        const open = popover.panel.hidden;
        for (const other of popovers) setPopoverOpen(other, false);
        if (open) {
          setPopoverOpen(popover, true);
          popover.panel.querySelector<HTMLElement>('button, input')?.focus();
        }
      });
    }
    const speedOptions = $('#speed-options');
    speedOptions.addEventListener('click', (e) => {
      const option = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-speed]');
      if (!option) return;
      ctx.setSpeed(Number(option.dataset.speed));
    });
    speedOptions.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
      const options = [...speedOptions.querySelectorAll<HTMLButtonElement>('[data-speed]:not(:disabled)')];
      const current = options.indexOf(document.activeElement as HTMLButtonElement);
      const index =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? options.length - 1
            : (current + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
      const next = options[index];
      if (!next) return;
      e.preventDefault();
      next.focus();
      next.click();
    });
    morePopover.panel.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[role="menuitem"], [role="menuitemcheckbox"]')) setPopoverOpen(morePopover, false, true);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const open = popovers.find((popover) => !popover.panel.hidden);
      if (!open) return;
      e.preventDefault();
      setPopoverOpen(open, false, true);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Home' && e.key !== 'End') return;
      const group = (e.target as HTMLElement).closest<HTMLElement>('.inline-segment');
      if (!group) return;
      const choices = [...group.querySelectorAll<HTMLInputElement>('input[type="radio"]:not(:disabled)')];
      const choice = e.key === 'Home' ? choices[0] : choices[choices.length - 1];
      if (!choice) return;
      e.preventDefault();
      choice.focus();
      choice.click();
    });
    document.addEventListener('click', (e) => {
      const target = e.target as Node;
      for (const popover of popovers) {
        if (!popover.panel.hidden && !popover.panel.contains(target) && !popover.button.contains(target)) setPopoverOpen(popover, false);
      }
    });
    document.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-action],[data-view],[data-instructor],[data-setting-quick],[data-scenario],[data-scenario-view],[data-profile],[data-event],[data-metric],[data-help-tab],[data-help-target],[data-mode],[data-mode-step],[data-phys-step],[data-limit-step]',
      );
      if (!el) return;
      e.preventDefault();
      if (el.dataset.helpTarget) {
        toggleHelp(el);
        return;
      }
      if (el.dataset.scenarioView) {
        for (const view of ['start', 'all', 'profiles']) $('#scenario-' + view).hidden = view !== el.dataset.scenarioView;
        $('#scenario-scope').hidden = el.dataset.scenarioView === 'profiles';
        for (const button of document.querySelectorAll<HTMLElement>('[data-scenario-view]'))
          button.setAttribute('aria-pressed', String(button.dataset.scenarioView === el.dataset.scenarioView));
        $('#dialog-content').scrollTop = 0;
        return;
      }
      if (el.dataset.profile) {
        if (!(el as HTMLButtonElement).disabled) void instructor.applyProfile(el.dataset.profile);
        return;
      }
      if (el.dataset.modeStep) {
        modes.stepModeField(el.dataset.modeStep as SettingsKey, el.dataset.direction === '-1' ? -1 : 1);
        return;
      }
      if (el.dataset.physStep) {
        void instructor.stepPhys(el.dataset.physStep, el.dataset.direction === '-1' ? -1 : 1);
        return;
      }
      if (el.dataset.limitStep) {
        alarms.stepLimit(el.dataset.limitStep as keyof AlarmLimits, el.dataset.direction === '-1' ? -1 : 1);
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
      if (el.dataset.modeRange) modes.slideModeField(el);
      if (el.dataset.modeField) modes.readModeField(el);
      if (el.dataset.limit) alarms.readLimits();
      if (el.id === 'history-slider') plots.slideHistory(Number(el.value));
      if (el.id === 'cursor-slider') plots.slideCursor(Number(el.value), 'A');
      if (el.id === 'cursor-b-slider') plots.slideCursor(Number(el.value), 'B');
    });
    document.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement | HTMLSelectElement;
      if (el instanceof HTMLInputElement && el.id === 'variable-descriptions') {
        $('#variable-legend').hidden = !el.checked;
        if (!ctx.fixtureId) savePrefs({ variableDescriptions: el.checked });
      }
      if (el instanceof HTMLInputElement && el.id === 'wave-guides') {
        plots.setWaveGuides(el.checked);
        if (!ctx.fixtureId) savePrefs({ waveGuides: el.checked });
        ctx.updateUI();
      }
      if (el instanceof HTMLInputElement && el.id === 'wave-annotations') {
        plots.setWaveAnnotations(el.checked);
        if (!ctx.fixtureId) savePrefs({ waveAnnotations: el.checked });
      }
      if ((el as HTMLInputElement).dataset.physRange || (el as HTMLInputElement).dataset.physNumber) instructor.physChange(el);
      if (el.dataset.physPreset) instructor.presetChange(el as HTMLSelectElement);
      if (el.id === 'scenario-topic') {
        for (const group of document.querySelectorAll<HTMLElement>('[data-scenario-topic]'))
          group.hidden = !!el.value && group.dataset.scenarioTopic !== el.value;
        $('#scenario-all .scenario-reference').hidden = !!el.value;
      }
      if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
        const value = segmentedValue(el.name);
        if (value !== null && el.name === 'numeric-density' && (value === '6' || value === '13'))
          ctx.setTileDensity(Number(value) as 6 | 13);
        if (value !== null && el.name === 'wave-window') plots.setWaveWindow(Number(value));
        if (value !== null && el.name === 'wave-style') plots.setWaveStyle(value as 'sweep' | 'scroll');
        if (value !== null && el.name === 'wave-scale') plots.setWaveScaleMode(value as 'auto' | 'fixed');
        if (!ctx.fixtureId && value !== null && el.name === 'wave-window') savePrefs({ waveWindow: value as '6' | '12' | '24' });
        if (!ctx.fixtureId && value !== null && el.name === 'wave-style') savePrefs({ waveStyle: value as 'sweep' | 'scroll' });
        if (!ctx.fixtureId && value !== null && el.name === 'wave-scale') savePrefs({ waveScale: value as 'auto' | 'fixed' });
      }
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
