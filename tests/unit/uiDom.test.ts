// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiHarness } from '../uiHarness';
import { $, element, iconNode } from '../../src/ui/dom';
import { createClassroom } from '../../src/ui/classroom';
import { createMetricsView } from '../../src/ui/metricsView';
import { createQuickEditor } from '../../src/ui/quickEditor';
import { createHoldPanel } from '../../src/ui/holdPanel';
import { createModeDialog } from '../../src/ui/modeDialog';
import { createAlarmsUi } from '../../src/ui/alarmsUi';
import { createTeachingView } from '../../src/ui/teachingView';
import { SCENARIOS } from '../../src/scenarios';

const hostile = '<img src=x onerror="alert(1)"> & \' " >';
let harness: ReturnType<typeof uiHarness>;
beforeEach(() => {
  harness = uiHarness();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Aula y texto recibido', () => {
  it('construye texto literal e iconos SVG sin convertir datos en etiquetas', () => {
    const node = element('div', 'test', hostile, iconNode('check'));
    expect(node.textContent).toBe(hostile);
    expect(node.querySelector('img')).toBeNull();
    expect(node.querySelector('svg')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(node.querySelector('use')?.getAttribute('href')).toBe('#i-check');
  });

  it('busca y selecciona casos, preservando IDs, categorías y descripciones literales', () => {
    const { ctx } = harness;
    const scenario = { ...ctx.scenario, id: hostile, name: hostile, category: hostile, description: hostile };
    SCENARIOS.push(scenario);
    try {
      const loadScenario = vi.fn();
      const classroom = createClassroom(ctx, { cancelQuick: vi.fn(), loadScenario, estimateCount: () => 0 });
      classroom.init();
      classroom.open('library');
      const search = $<HTMLInputElement>('#aula-search');
      search.value = hostile;
      search.dispatchEvent(new Event('input'));
      const card = $<HTMLButtonElement>('.aula-case');
      expect(card.dataset.aulaCase).toBe(hostile);
      expect(card.querySelector('strong')?.textContent).toBe(hostile);
      expect($('#aula-library-list').querySelector('img')).toBeNull();
      card.click();
      expect(loadScenario).toHaveBeenCalledWith(hostile);
      expect($('#aula-lesson').hidden).toBe(false);
      classroom.open('library');
      search.value = 'sin coincidencias zzz';
      search.dispatchEvent(new Event('input'));
      expect($('#aula-library-empty').hidden).toBe(false);
    } finally {
      SCENARIOS.pop();
    }
  });

  it('conecta lección, práctica y resultados y no evalúa sesiones importadas', () => {
    const { ctx } = harness;
    ctx.scenario.lesson = { title: hostile, text: hostile, tasks: [{ id: 'task', text: hostile, test: 'teaching' }] };
    ctx.scenario.question = hostile;
    ctx.scenario.answer = hostile;
    ctx.lesson.reset();
    expect($('#lesson-tasks').textContent).toContain(hostile);
    expect($('#lesson-tasks').querySelector('img')).toBeNull();
    const deps = { cancelQuick: vi.fn(), loadScenario: vi.fn(), estimateCount: vi.fn(() => 2) };
    const classroom = createClassroom(ctx, deps);
    classroom.init();
    classroom.open('theory');
    expect(ctx.lesson.flags.teaching).toBe(true);
    expect($('#aula-theory-host').contains($('#view-teaching'))).toBe(true);
    classroom.practice();
    expect($('#classroom').hidden).toBe(true);
    expect($('#practice-card').hidden).toBe(false);
    expect($('#practice-objective').textContent).toBe(hostile);
    ctx.lesson.done.add('task');
    ctx.lesson.render();
    classroom.render();
    expect($('#lesson-tasks use').getAttribute('href')).toBe('#i-check');
    expect($('#practice-link').dataset.action).toBe('debrief');
    classroom.open('results');
    const result = $('#aula-results-body');
    expect(result.textContent).toContain(hostile);
    expect(result.textContent).toContain('2 mediciones estimadas');
    expect(result.querySelector('img')).toBeNull();
    const first = result.firstChild;
    classroom.render();
    expect(result.firstChild).toBe(first);
    deps.estimateCount.mockReturnValue(3);
    classroom.render();
    expect(result.textContent).toContain('3 mediciones estimadas');
    ctx.lesson.setSessionImported(true);
    classroom.render();
    expect(result.textContent).toContain('Sesión importada');
    expect(result.textContent).not.toContain('mediciones estimadas');
    classroom.practice();
    expect($('#practice-card').hidden).toBe(true);
    ctx.lesson.setSessionImported(false);
    ctx.scenario = { ...ctx.scenario, id: 'nuevo' };
    $<HTMLTextAreaElement>('#reflection-notes').value = 'reflexión';
    classroom.render();
    expect($<HTMLTextAreaElement>('#reflection-notes').value).toBe('');
    classroom.stopPractice();
    expect($('#practice-stop').hidden).toBe(true);
  });
});

describe('edición, medición y navegación de diálogos', () => {
  it('mantiene el ajuste vigente hasta confirmar y permite cancelar el borrador', async () => {
    const { ctx } = harness;
    const quick = createQuickEditor(ctx);
    quick.updateQuick();
    const before = $('[data-quick-val="peep"]').textContent;
    quick.openQuick('peep');
    quick.typedQuick('8');
    expect($('[data-quick-val="peep"]').textContent).toBe(before);
    expect($<HTMLButtonElement>('[data-action="confirmEdit"]').disabled).toBe(false);
    quick.confirmQuick();
    await Promise.resolve();
    expect(ctx.send).toHaveBeenCalledWith({ type: 'confirmSettings', changes: { peep: 8 } });
    expect($('#quick-editor').hidden).toBe(true);
    quick.openQuick('peep');
    quick.typedQuick('');
    expect($<HTMLButtonElement>('[data-action="confirmEdit"]').disabled).toBe(true);
    expect($('#quick-validation').textContent).toContain('Escribe un valor');
    quick.cancelQuick();
    expect(ctx.send).toHaveBeenCalledTimes(1);
    ctx.locked = true;
    quick.openQuick('peep');
    expect($('#quick-editor').hidden).toBe(true);
  });

  it('ofrece duraciones válidas y conserva selección sin duplicar solicitudes de bloqueo', async () => {
    const { ctx } = harness;
    const quick = createQuickEditor(ctx);
    const hold = createHoldPanel(ctx, { quick });
    hold.openHold('inspHold');
    const select = $<HTMLSelectElement>('#hold-duration');
    expect(select.value).toBe('3');
    expect([...select.options].every((o) => o.textContent === `${o.value} s`)).toBe(true);
    select.value = '2';
    hold.closeHoldPanel();
    hold.openHold('expHold');
    expect(select.value).toBe('2');
    const first = hold.runHold();
    const second = hold.runHold();
    expect(ctx.send).toHaveBeenCalledTimes(1);
    expect(ctx.send).toHaveBeenCalledWith({ type: 'requestHold', kind: 'expHold', durationS: 2 });
    await Promise.all([first, second]);
    expect($<HTMLButtonElement>('#hold-run').disabled).toBe(false);
    hold.closeHoldPanel();
    expect(hold.isOpen).toBe(false);
  });

  it('selecciona modos en el equipo y descarta el borrador al cerrar', async () => {
    const { ctx } = harness;
    const modes = createModeDialog(ctx, { cancelQuick: vi.fn() });
    modes.openModes();
    expect($('#app-dialog').classList.contains('device-dialog')).toBe(true);
    modes.selectMode('AC_PC');
    expect(ctx.send).not.toHaveBeenCalled();
    await modes.confirmModes();
    expect(ctx.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'confirmSettings', changes: expect.objectContaining({ mode: 'AC_PC' }) }),
    );
    modes.openModes();
    modes.selectMode('CPAP_PS');
    ctx.dialog.close();
    await modes.confirmModes();
    expect(ctx.send).toHaveBeenCalledTimes(1);
  });

  it('valida límites de alarma antes de enviarlos y permite Off', async () => {
    const { ctx } = harness;
    const alarms = createAlarmsUi(ctx);
    alarms.alarmSetup();
    const field = $<HTMLInputElement>('[data-limit="vteLow"]');
    field.value = '999999';
    expect(alarms.readLimits().length).toBeGreaterThan(0);
    await alarms.confirmLimits();
    expect(ctx.send).not.toHaveBeenCalled();
    field.value = '';
    expect(alarms.readLimits()).toEqual([]);
    await alarms.confirmLimits();
    expect(ctx.send).toHaveBeenCalledWith({ type: 'setAlarmLimits', changes: { vteLow: 'off' } });
    expect(ctx.dialog.kind).toBe('');
  });

  it('actualiza métricas, enmascara examen y fija la referencia al abrir la estimación', () => {
    const { ctx, sim } = harness;
    while (sim.simTimeMs < 12_000) sim.step();
    ctx.frame = sim.frame();
    const metrics = createMetricsView(ctx);
    metrics.init();
    metrics.updateMetrics();
    expect($('#numeric-grid').querySelectorAll('[data-metric]').length).toBeGreaterThan(6);
    expect($('#numeric-grid [data-metric="ppeak"] .numeric-value').textContent).not.toBe('—');
    ctx.examMasked = (key) => ctx.examMode && !metrics.examEstimated(key);
    ctx.examMode = true;
    metrics.updateMetrics();
    expect($('#numeric-grid [data-metric="ppeak"] .numeric-value').textContent).toBe('?');
    metrics.metricClick('ppeak');
    metrics.submitEstimate();
    expect(metrics.examEstimateCount).toBe(0);
    $<HTMLInputElement>('#exam-estimate-input').value = '20';
    metrics.submitEstimate();
    expect(metrics.examEstimated('ppeak')).toBe(true);
    expect(metrics.examEstimateCount).toBe(1);
    metrics.mechanics('ppeak');
    expect(ctx.dialog.kind).toBe('measurement');
    metrics.resetLog();
    expect(metrics.examEstimateCount).toBe(0);
  });

  it('conserva eventos literales, orden inverso, alarma destacada y ocho entradas docentes', () => {
    const { ctx, sim } = harness;
    for (let i = 0; i < 10; i++) sim.noteEvent('scenario', 'instructor', { scenarioId: 'importado', name: `${i} ${hostile}` });
    sim.noteEvent('alarm', 'system', { apnea: hostile });
    ctx.frame = sim.frame();
    const metrics = createMetricsView(ctx);
    metrics.updateLogs();
    expect($('#device-event-log').firstElementChild?.classList.contains('alert-event')).toBe(true);
    expect($('#teacher-log').children).toHaveLength(8);
    expect($('#teacher-log').textContent).toContain(hostile);
    expect($('#teacher-log').querySelector('img')).toBeNull();
    const rows = [...$('#device-event-log').children];
    expect(rows[1]?.textContent).toContain(`9 ${hostile}`);
    const first = rows[0];
    metrics.updateLogs();
    expect($('#device-event-log').firstElementChild).toBe(first);
  });

  it('abre fundamentos con diagramas SVG y cambia de tema sin perder ocultación de examen', () => {
    const { ctx, sim } = harness;
    while (sim.simTimeMs < 12_000) sim.step();
    ctx.frame = sim.frame();
    const classroom = createClassroom(ctx, { cancelQuick: vi.fn(), loadScenario: vi.fn(), estimateCount: () => 0 });
    classroom.init();
    classroom.open('theory');
    const teaching = createTeachingView(ctx);
    teaching.render();
    expect($('#teaching-body').querySelector('svg')).not.toBeNull();
    $<HTMLButtonElement>('[data-edu-tab="proteccion"]').click();
    expect(ctx.lesson.flags['edu-proteccion']).toBe(true);
    expect($('#teaching-body').textContent).toContain('Potencia mecánica');
    ctx.examMode = true;
    ctx.examMasked = () => true;
    teaching.render();
    expect($('#teaching-body').textContent).toContain('?');
  });
});
