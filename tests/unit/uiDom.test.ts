// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiHarness } from '../uiHarness';
import { $, element, iconNode } from '../../src/ui/dom';
import { createCaseSpace } from '../../src/ui/caseSpace';
import { estadoPh, minutosAlEquilibrio } from '../../src/ui/gasView';
import { createMetricsView } from '../../src/ui/metricsView';
import { createQuickEditor } from '../../src/ui/quickEditor';
import { createHoldPanel } from '../../src/ui/holdPanel';
import { createModeDialog } from '../../src/ui/modeDialog';
import { createAlarmsUi } from '../../src/ui/alarmsUi';
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

describe('Casos, Aula y texto recibido', () => {
  it('construye texto literal e iconos SVG sin convertir datos en etiquetas', () => {
    const node = element('div', 'test', hostile, iconNode('check'));
    expect(node.textContent).toBe(hostile);
    expect(node.querySelector('img')).toBeNull();
    expect(node.querySelector('svg')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(node.querySelector('use')?.getAttribute('href')).toBe('#i-check');
  });

  it('lista y elige casos en el panel, preservando IDs, temas y viñetas literales', () => {
    const { ctx } = harness;
    const base = SCENARIOS.find((s) => s.clinical?.kind === 'diagnostico')!;
    const scenario = {
      ...base,
      id: hostile,
      name: hostile,
      clinical: {
        ...base.clinical!,
        theme: hostile,
        vignette: hostile,
        question: hostile,
        reveal: hostile,
        options: base.clinical!.options!.map((o) => ({ ...o, text: hostile })),
      },
    };
    SCENARIOS.push(scenario);
    try {
      const loadScenario = vi.fn();
      const cases = createCaseSpace(ctx, { loadScenario, switchTab: vi.fn() });
      cases.init();
      // Sin caso clínico en curso, el panel ofrece la lista.
      const card = [...document.querySelectorAll<HTMLButtonElement>('#instructor-case [data-case-id]')].find(
        (b) => b.dataset.caseId === hostile,
      )!;
      expect(card.querySelector('strong')?.textContent).toBe(hostile);
      expect($('#instructor-case').querySelector('img')).toBeNull();
      expect($('#learn-case').hidden).toBe(true);
      card.click();
      expect(loadScenario).toHaveBeenCalledWith(hostile);

      // Con el caso cargado, el panel dice qué lograr y oculta la mecánica hasta entregar.
      ctx.scenario = scenario;
      cases.render();
      expect($('#instructor-case .case-title').textContent).toBe(hostile);
      expect($('#instructor-case .case-vignette').textContent).toBe(hostile);
      expect($('#instructor').classList.contains('case-locked')).toBe(true);
      expect($('#learn-case').hidden).toBe(false);
      expect($('#learn-case-body').textContent).toContain('Se revela al entregar');
      expect($<HTMLButtonElement>('#instructor-case [data-action="submitCase"]').disabled).toBe(true);
      $<HTMLButtonElement>('#instructor-case [data-case-option]').click();
      expect(ctx.lesson.flags.caseAnswer).toBe(base.clinical!.options![0]!.id);
      expect($<HTMLButtonElement>('#instructor-case [data-action="submitCase"]').disabled).toBe(false);

      cases.submitCase();
      expect(ctx.lesson.flags.caseResult).toMatchObject({ answer: { id: base.clinical!.options![0]!.id } });
      expect($('#instructor').classList.contains('case-locked')).toBe(false);
      expect($('#learn-case-body .case-reveal').textContent).toBe(hostile);
      expect($('#learn-case-body').querySelector('img')).toBeNull();
      expect($('#instructor-case [data-action="restartCase"]')).not.toBeNull();

      // «Todos los casos» vuelve a la lista sin reiniciar el caso; elegirlo de nuevo vuelve a su ficha.
      cases.list();
      expect($('#instructor-case .case-item.current').dataset.caseId).toBe(hostile);
      $<HTMLButtonElement>('#instructor-case .case-item.current').click();
      expect(loadScenario).toHaveBeenCalledTimes(1);
      expect($('#instructor-case .case-title').textContent).toBe(hostile);
    } finally {
      SCENARIOS.pop();
    }
  });

  it('muestra la gasometría del modelo, limpia la reflexión al cambiar de caso y no evalúa sesiones importadas', () => {
    const { ctx } = harness;
    const cases = createCaseSpace(ctx, { loadScenario: vi.fn(), switchTab: vi.fn() });
    cases.init();
    // Inicio, ahora y hacia dónde tiende, rotulado como del modelo.
    expect([...document.querySelectorAll('#case-gas thead th')].map((th) => th.textContent)).toEqual(['Inicio', 'Ahora', 'Tiende a']);
    expect($('#case-gas').textContent).toContain('PaCO₂');
    expect($('#case-gas .gas-tag').textContent).toBe('modelo');
    $<HTMLTextAreaElement>('#reflection-notes').value = 'reflexión';
    ctx.scenario = { ...SCENARIOS.find((s) => s.clinical)!, question: hostile };
    ctx.lesson.render();
    cases.render();
    expect($<HTMLTextAreaElement>('#reflection-notes').value).toBe('');
    expect($('#reflection-question').textContent).toBe(hostile);
    expect($('#reflection-question').querySelector('img')).toBeNull();
    ctx.lesson.setSessionImported(true);
    cases.submitCase();
    expect(ctx.lesson.flags.caseResult).toBeUndefined();
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

  it('conserva eventos literales, orden inverso y alarma destacada', () => {
    const { ctx, sim } = harness;
    for (let i = 0; i < 10; i++) sim.noteEvent('scenario', 'instructor', { scenarioId: 'importado', name: `${i} ${hostile}` });
    sim.noteEvent('alarm', 'system', { apnea: hostile });
    ctx.frame = sim.frame();
    const metrics = createMetricsView(ctx);
    metrics.updateLogs();
    expect($('#device-event-log').firstElementChild?.classList.contains('alert-event')).toBe(true);
    const rows = [...$('#device-event-log').children];
    expect(rows[1]?.textContent).toContain(`9 ${hostile}`);
    const first = rows[0];
    metrics.updateLogs();
    expect($('#device-event-log').firstElementChild).toBe(first);
  });

  it('abre fundamentos con diagramas SVG y cambia de tema sin perder ocultación de examen', async () => {
    const { ctx, sim } = harness;
    while (sim.simTimeMs < 12_000) sim.step();
    ctx.frame = sim.frame();
    const cases = createCaseSpace(ctx, { loadScenario: vi.fn(), switchTab: vi.fn() });
    cases.init();
    cases.scrollTo('theory');
    expect($('#aula-theory-host').contains($('#view-teaching'))).toBe(true);
    await vi.waitFor(() => expect($('#teaching-body').querySelector('svg')).not.toBeNull());
    $<HTMLButtonElement>('[data-edu-tab="proteccion"]').click();
    expect(ctx.lesson.flags['edu-proteccion']).toBe(true);
    expect($('#teaching-body').textContent).toContain('Potencia mecánica');
    ctx.examMode = true;
    ctx.examMasked = () => true;
    cases.render();
    expect($('#teaching-body').textContent).toContain('?');
  });
});

describe('gasometría del panel', () => {
  it('nombra el pH como lo haría un clínico y estima el tiempo al equilibrio con su constante de tiempo', () => {
    expect(estadoPh(7.3)).toBe('acidemia');
    expect(estadoPh(7.4)).toBeNull();
    expect(estadoPh(7.5)).toBe('alcalemia');
    expect(minutosAlEquilibrio(40, 40.5, 3)).toBe(0);
    // A 12 mmHg del equilibrio con τ 3 min: 3 · ln 12 ≈ 7,5 min hasta quedar a 1 mmHg.
    expect(minutosAlEquilibrio(40, 52, 3)).toBeCloseTo(3 * Math.log(12), 6);
  });
});
