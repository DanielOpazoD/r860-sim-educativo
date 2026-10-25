// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { uiHarness } from '../uiHarness';
import { $ } from '../../src/ui/dom';
import { createActions } from '../../src/ui/actions';
import { createCaseSpace } from '../../src/ui/caseSpace';
import { createQuickEditor } from '../../src/ui/quickEditor';
import { createHoldPanel } from '../../src/ui/holdPanel';
import { createMetricsView } from '../../src/ui/metricsView';
import { createModeDialog } from '../../src/ui/modeDialog';
import { createAlarmsUi } from '../../src/ui/alarmsUi';
import { createPlotsView } from '../../src/ui/plotsView';
import { createInstructorPanel } from '../../src/ui/instructorPanel';
import { createCommandPalette } from '../../src/ui/commandPalette';
import { bindKeyboard } from '../../src/ui/keyboard';

// Los oyentes del documento sobreviven entre pruebas del mismo archivo: se quitan al terminar cada una.
const listeners: [string, EventListenerOrEventListenerObject][] = [];
beforeEach(() => {
  const add = document.addEventListener.bind(document);
  vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
    listeners.push([type, listener]);
    add(type, listener, options);
  });
});
afterEach(() => {
  for (const [type, listener] of listeners.splice(0)) document.removeEventListener(type, listener);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const tecla = (target: Element, key: string): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
};

it('ATA · los atajos de letra funcionan con el foco en un botón; Espacio no, y nada al escribir', () => {
  const { ctx } = uiHarness();
  const action = vi.fn<(a: string) => Promise<void>>(async () => {});
  bindKeyboard(ctx, { quick: createQuickEditor(ctx), action, palette: createCommandPalette(() => []) });
  const boton = $('#wave-aids-toggle');
  tecla(boton, 'c');
  tecla(boton, 'h');
  tecla(boton, '?');
  expect(action.mock.calls.map(([a]) => a)).toEqual(['freeze', 'home', 'help']);
  action.mockClear();
  tecla(boton, ' ');
  tecla($('#reflection-notes'), 'c');
  tecla($('#palette-input'), 'a');
  expect(action).not.toHaveBeenCalled();
  tecla(document.body, ' ');
  expect(action).toHaveBeenLastCalledWith('pause');
});

it('MEN · el menú «…» se recorre con flechas, Inicio y Fin', () => {
  const { ctx } = uiHarness();
  const quick = createQuickEditor(ctx);
  const hold = createHoldPanel(ctx, { quick });
  const metrics = createMetricsView(ctx);
  const plots = createPlotsView(ctx, { teacherVisible: () => false });
  const instructor = createInstructorPanel(ctx, { quick, hold, metrics, plots, initialVisible: false });
  const cases = createCaseSpace(ctx, { loadScenario: instructor.loadScenario, switchTab: instructor.switchInstructor });
  createActions(ctx, {
    quick,
    hold,
    metrics,
    plots,
    instructor,
    cases,
    modes: createModeDialog(ctx, { cancelQuick: quick.cancelQuick }),
    alarms: createAlarmsUi(ctx),
    openPalette: vi.fn(),
  }).bind();
  $('#more-button').click();
  const items = [...document.querySelectorAll<HTMLElement>('#more-menu [role^="menuitem"]')];
  expect(document.activeElement).toBe(items[0]);
  tecla(items[0]!, 'ArrowDown');
  expect(document.activeElement).toBe(items[1]);
  tecla(items[1]!, 'End');
  expect(document.activeElement).toBe(items.at(-1));
  tecla(items.at(-1)!, 'ArrowDown');
  expect(document.activeElement).toBe(items[0]);
  tecla(items[0]!, 'ArrowUp');
  expect(document.activeElement).toBe(items.at(-1));
  tecla(items.at(-1)!, 'Home');
  expect(document.activeElement).toBe(items[0]);
});

it('CUR · cinta y cursores sólo donde hay curvas congeladas', () => {
  const { ctx } = uiHarness();
  const plots = createPlotsView(ctx, { teacherVisible: () => false });
  const visibles = () => ({ cinta: !$('#frozen-ribbon').hidden, cursores: !$('#signal-inspector').hidden });
  for (const [view, esperado] of [
    ['waves', { cinta: true, cursores: true }],
    ['basic', { cinta: true, cursores: false }],
    ['loops', { cinta: true, cursores: false }],
    ['trends', { cinta: false, cursores: false }],
    ['data', { cinta: false, cursores: false }],
    ['log', { cinta: false, cursores: false }],
  ] as const) {
    ctx.view = view;
    plots.toggleFreeze();
    expect(visibles(), view).toEqual(esperado);
    plots.toggleFreeze();
    expect(visibles(), view).toEqual({ cinta: false, cursores: false });
  }
});

it('CUR · quitar la comparación impide que vuelva sola al cambiar el paciente; sin ayudas el botón dice por qué', () => {
  const { ctx, sim } = uiHarness();
  const plots = createPlotsView(ctx, { teacherVisible: () => false });
  let prev = sim.frame();
  plots.ingest(null, prev);
  const avanzar = (ms: number): void => {
    sim.run(ms);
    const fr = sim.frame();
    plots.ingest(prev, fr);
    prev = fr;
  };
  avanzar(12_000);
  sim.command({ type: 'setPatient', params: { crs: 0.03 } }, 'instructor');
  avanzar(4_000);
  expect(plots.waveRefAt).not.toBeNull();

  plots.clearWaveReference();
  sim.command({ type: 'setPatient', params: { crs: 0.06 } }, 'instructor');
  avanzar(4_000);
  expect(plots.waveRefAt).toBeNull();
  plots.saveWaveReference();
  expect(plots.waveRefAt).not.toBeNull();

  const boton = $<HTMLButtonElement>('#wave-ref-button');
  plots.setWaveAids(false);
  expect(boton.disabled).toBe(true);
  expect(boton.title).toBe('Enciende las ayudas sobre las curvas para comparar');
  plots.setWaveAids(true);
  expect(boton.title).toBe('Quita la respiración de referencia');
});
