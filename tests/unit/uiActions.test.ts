// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { uiHarness } from '../uiHarness';
import { $, element } from '../../src/ui/dom';
import { createActions } from '../../src/ui/actions';
import { createClassroom } from '../../src/ui/classroom';
import { createQuickEditor } from '../../src/ui/quickEditor';
import { createHoldPanel } from '../../src/ui/holdPanel';
import { createMetricsView } from '../../src/ui/metricsView';
import { createModeDialog } from '../../src/ui/modeDialog';
import { createAlarmsUi } from '../../src/ui/alarmsUi';
import { createPlotsView } from '../../src/ui/plotsView';
import { createInstructorPanel } from '../../src/ui/instructorPanel';
import { createCommandPalette } from '../../src/ui/commandPalette';
import { bindKeyboard } from '../../src/ui/keyboard';
import { loadPrefs } from '../../src/ui/prefs';
import { PATIENT_PROFILES } from '../../src/ui/patientProfiles';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('despacha acciones delegadas, preferencias y atajos sin activarlos al escribir', async () => {
  const { ctx } = uiHarness();
  vi.useFakeTimers();
  const documentListeners: [string, EventListenerOrEventListenerObject][] = [];
  const windowListeners: [string, EventListenerOrEventListenerObject][] = [];
  const onDocument = document.addEventListener.bind(document);
  const onWindow = window.addEventListener.bind(window);
  vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
    documentListeners.push([type, listener]);
    onDocument(type, listener, options);
  });
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    windowListeners.push([type, listener]);
    onWindow(type, listener, options);
  });
  try {
    const quick = createQuickEditor(ctx);
    const hold = createHoldPanel(ctx, { quick });
    const metrics = createMetricsView(ctx);
    const plots = createPlotsView(ctx, { teacherVisible: () => false });
    const instructor = createInstructorPanel(ctx, { quick, hold, metrics, plots, initialVisible: false });
    const classroom = createClassroom(ctx, {
      cancelQuick: quick.cancelQuick,
      loadScenario: instructor.loadScenario,
      estimateCount: () => 0,
    });
    const palette = createCommandPalette(() => []);
    const actions = createActions(ctx, {
      quick,
      hold,
      metrics,
      plots,
      instructor,
      classroom,
      modes: createModeDialog(ctx, { cancelQuick: quick.cancelQuick }),
      alarms: createAlarmsUi(ctx),
      openPalette: palette.open,
    });
    quick.updateQuick();
    metrics.init();
    instructor.init();
    instructor.updateTeacher();
    classroom.init();
    actions.bind();
    bindKeyboard(ctx, { quick, action: actions.action, palette });

    await actions.action('invalid-command');
    expect(ctx.toast).toHaveBeenLastCalledWith('Acción no disponible en esta versión.', true);
    $('[data-action="classroom"]').click();
    expect($('#classroom').hidden).toBe(false);
    await actions.action('practice');
    expect($('#practice-card').hidden).toBe(false);
    await actions.action('stopPractice');
    expect($('#practice-card').hidden).toBe(true);

    $('#wave-options-button').click();
    expect($<HTMLDialogElement>('#wave-options').open).toBe(true);
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('#wave-options [role="tab"]')];
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(tabs.at(-1)!.getAttribute('aria-selected')).toBe('true');
    $('#view-options-close').click();
    for (const id of ['variable-descriptions', 'wave-guides', 'wave-annotations']) {
      const input = $<HTMLInputElement>('#' + id);
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    expect(loadPrefs()).toMatchObject({ variableDescriptions: false, waveGuides: false, waveAnnotations: false });
    expect($('#variable-legend').hidden).toBe(true);
    expect(plots.waveGuides).toBe(false);
    ctx.fixtureId = 'P1';
    const guides = $<HTMLInputElement>('#wave-guides');
    guides.checked = true;
    guides.dispatchEvent(new Event('change', { bubbles: true }));
    expect(loadPrefs().waveGuides).toBe(false);
    ctx.fixtureId = null;

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    expect(ctx.toggleFreeze).toHaveBeenCalledOnce();
    const input = $<HTMLInputElement>('#palette-input');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    expect(ctx.toggleFreeze).toHaveBeenCalledOnce();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    expect(palette.isOpen).toBe(true);
    palette.close();

    await actions.action('lock');
    $('[data-setting-quick="peep"]').click();
    expect(quick.edit.state.kind).toBe('idle');
    expect(ctx.toast).toHaveBeenLastCalledWith('Mandos protegidos.');
    await actions.action('unlock');
    $('[data-setting-quick="peep"]').click();
    expect(quick.edit.state.kind).not.toBe('idle');
    await actions.action('editPlus');
    await actions.action('confirmEdit');
    expect(ctx.send).toHaveBeenCalledWith({ type: 'confirmSettings', changes: { peep: 6 } });
    await actions.action('manual');
    expect(ctx.send).toHaveBeenLastCalledWith({ type: 'manualBreath' });
    await actions.action('mute');
    expect(ctx.send).toHaveBeenLastCalledWith({ type: 'audioPause' });
    await actions.action('startOxygen');
    expect(ctx.send).toHaveBeenLastCalledWith({ type: 'increaseO2Start' });
    await actions.action('stopOxygen');
    expect(ctx.send).toHaveBeenLastCalledWith({ type: 'increaseO2Stop' });
    await actions.action('exam');
    expect(ctx.setExamMode).toHaveBeenLastCalledWith(true);
    for (const command of ['menu', 'scenarios', 'session', 'patient', 'tools', 'help', 'model', 'standby', 'oxygen', 'powerInfo']) {
      await actions.action(command);
      expect($<HTMLDialogElement>('#app-dialog').open).toBe(true);
      expect($('#dialog-content').childElementCount).toBeGreaterThan(0);
      await actions.action('closeDialog');
    }

    await instructor.fault('resistance');
    expect(ctx.send).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'setPatient' }), 'instructor');
    await instructor.undoEvent();
    expect(ctx.send).toHaveBeenLastCalledWith(
      { type: 'setPatient', params: { rInsp: ctx.frame!.truth.patient.rInsp, rExp: ctx.frame!.truth.patient.rExp } },
      'instructor',
    );
    await instructor.applyProfile('stiff');
    expect(ctx.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'setPatient', replace: true }), 'instructor');
    const compliance = $<HTMLInputElement>('[data-phys-number="compliance"]');
    compliance.value = '';
    await instructor.physChange(compliance);
    expect(compliance.getAttribute('aria-invalid')).toBe('true');
    compliance.value = '50';
    await instructor.physChange(compliance);
    expect(ctx.send).toHaveBeenLastCalledWith({ type: 'setPatient', params: { crs: 0.05 } }, 'instructor');
  } finally {
    for (const [type, listener] of documentListeners) document.removeEventListener(type, listener);
    for (const [type, listener] of windowListeners) window.removeEventListener(type, listener);
  }
});

it('la paleta conserva texto literal, búsqueda, foco, selección y cancelación', () => {
  uiHarness();
  const run = vi.fn();
  const hostile = '<img src=x onerror="alert(1)"> & \' " >';
  const palette = createCommandPalette(() => [
    { id: 'literal', group: 'Acciones', label: hostile, shortcut: 'F', run },
    { id: 'next', group: 'Vistas', label: 'Presiones', run },
  ]);
  const origin = element('button', '', 'Origen');
  document.body.append(origin);
  origin.focus();
  palette.open();
  const input = $<HTMLInputElement>('#palette-input');
  expect($('#palette-list').textContent).toContain(hostile);
  expect($('#palette-list').querySelector('img')).toBeNull();
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
  expect(input.getAttribute('aria-activedescendant')).toBe('palette-opt-1');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  expect(run).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(origin);
  palette.open();
  input.value = 'no existe';
  input.dispatchEvent(new Event('input'));
  expect($('#palette-list').textContent).toBe('Sin resultados');
  expect(input.hasAttribute('aria-activedescendant')).toBe(false);
  $('#command-palette').dispatchEvent(new Event('cancel', { cancelable: true }));
  expect(palette.isOpen).toBe(false);
});

it('los perfiles mantienen sus etiquetas como texto y sus botones conservan ARIA', () => {
  const { ctx } = uiHarness();
  const profile = PATIENT_PROFILES[0]!;
  const original = profile.label;
  profile.label = '<img src=x> & " perfil';
  try {
    const quick = createQuickEditor(ctx);
    const hold = createHoldPanel(ctx, { quick });
    const metrics = createMetricsView(ctx);
    const plots = createPlotsView(ctx, { teacherVisible: () => false });
    const instructor = createInstructorPanel(ctx, { quick, hold, metrics, plots, initialVisible: false });
    instructor.init();
    expect($('#patient-profiles b').textContent).toBe(profile.label);
    expect($('#patient-profiles').querySelector('img')).toBeNull();
    expect($('#patient-profiles button').getAttribute('aria-pressed')).toBe('false');
    expect($('#fault-grid use').getAttribute('href')).toBe('#i-wave');
  } finally {
    profile.label = original;
  }
});
