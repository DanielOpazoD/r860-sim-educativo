/**
 * Punto de composición de la interfaz de R860 Lab sobre el motor determinista de este proyecto.
 * Estructura de interacción derivada de «R860 Lab» v1.1 (src/app.js, MIT 2026) y reescrita en TypeScript:
 * la UI sólo envía comandos tipados; los borradores viven en EditController; requestAnimationFrame sólo dibuja.
 * Aquí viven el estado de sesión (cuadro, marcha, escenario, fixture, bloqueo) y el arranque del motor; cada rasgo
 * (editor rápido, bloqueos, modos, alarmas, curvas, panel docente…) es un módulo `createX(ctx)` con su propio estado.
 */
import { EngineClient } from '../app/engineClient';
import type { Discontinuity } from '../app/protocol';
import type { Command } from '../domain/commands';
import type { EngineFrame, SimulatorInit } from '../engine/simulator';
import { ENGINE_VERSION } from '../engine/version';
import { frameFromFixture, PHOTO_FIXTURES } from '../fixtures/photoFixtures';
import { defaultInit, R860_PROFILE } from '../profiles';
import { findScenario, SCENARIOS, type Scenario } from '../scenarios';
import { createActions } from './actions';
import { createAlarmsUi } from './alarmsUi';
import type { Actor, AppContext, CommandResult, FixtureId } from './context';
import { createDialogHost } from './dialogHost';
import { $, icon, put } from './dom';
import { clock, wallDate } from './format';
import { fillStaticHelp } from './helpPanels';
import { createHoldPanel } from './holdPanel';
import { learnerText } from './humanize';
import { createInstructorPanel } from './instructorPanel';
import { bindKeyboard } from './keyboard';
import { MODE_LABEL } from './labels';
import { createLessonTracker } from './lessonTracker';
import { createMetricsView } from './metricsView';
import { createModeDialog } from './modeDialog';
import { createPlotsView } from './plotsView';
import { createQuickEditor } from './quickEditor';
import { createViews } from './views';

const PHASE_TEXT: Record<string, string> = {
  inspFlow: 'Inspiración',
  inspLimited: 'Inspiración · Plimit',
  inspPause: 'Pausa inspiratoria',
  inspPressure: 'Inspiración · presión',
  exp: 'Espiración',
  holdInsp: 'Bloqueo inspiratorio',
  holdExp: 'Bloqueo espiratorio',
  standby: 'En espera',
};
/** Plazo para recibir el primer cuadro del motor antes de avisar (ms). */
const FIRST_FRAME_TIMEOUT_MS = 5000;

export interface AppOptions {
  params: URLSearchParams;
}

export function startApp(opts: AppOptions): void {
  const params = opts.params;
  const client = new EngineClient({ forceInline: params.get('inline') === '1' });
  const profile = R860_PROFILE;
  // ---------- estado de sesión ----------
  let frame: EngineFrame | null = null;
  let running = true,
    speed = 1,
    pauseReason: string | null = null,
    discontinuities: Discontinuity[] = [],
    generation = -1;
  let locked = false;
  let scenario: Scenario = findScenario(params.get('scenario') ?? 'SC-01') ?? (SCENARIOS[0] as Scenario);
  let fixtureId: FixtureId | null = null;

  // ---------- utilidades ----------
  function toast(message: string, warn = false): void {
    const e = document.createElement('div');
    e.className = 'toast' + (warn ? ' warn' : '');
    e.textContent = learnerText(message);
    const stack = $('#toast-stack');
    stack.append(e);
    while (stack.children.length > 2) stack.firstElementChild?.remove();
    setTimeout(() => e.remove(), 4200);
  }
  function notice(message: string): void {
    put('#global-notice', message);
    $('#global-notice').hidden = false;
  }
  /** Aviso persistente sobre el estado del motor (sin Worker o sin arrancar). */
  function engineBanner(message: string | null): void {
    const b = $('#engine-banner');
    b.hidden = !message;
    put(b, message ?? '');
  }
  function versionTag(): void {
    const how = client.mode === 'worker' ? 'Worker' : client.degradedReason ? 'en página (sin Worker)' : 'en página';
    put('#version-tag', `v${ENGINE_VERSION} · Offline · ${how}`);
  }
  async function send(cmd: Command, actor: Actor = 'learner'): Promise<CommandResult> {
    const r = await client.command(cmd, actor);
    if (!r.accepted) toast(r.reason ?? 'No se pudo aplicar.', true);
    return r;
  }
  function setLocked(on: boolean): void {
    locked = on;
    $('#lock-overlay').hidden = !on;
    $('#lock-key').setAttribute('aria-pressed', String(on));
    quick.edit.setLocked(on);
    if (on) quick.cancelQuick();
  }

  // ---------- contexto y rasgos (los accesores se resuelven en uso, nunca durante la construcción) ----------
  const ctx: AppContext = {
    client,
    profile,
    editTimeoutMs: params.get('editTimeout') ? Number(params.get('editTimeout')) : profile.editTimeoutMs,
    get frame() {
      return frame;
    },
    get running() {
      return running;
    },
    get fixtureId() {
      return fixtureId;
    },
    get scenario() {
      return scenario;
    },
    setScenario(sc) {
      scenario = sc;
      fixtureId = null;
    },
    clearFixture() {
      fixtureId = null;
    },
    setSpeed(s) {
      speed = s;
      client.setSpeed(speed);
    },
    simS: () => (frame?.simTimeMs ?? 0) / 1000,
    send,
    toast,
    notice,
    get dialog() {
      return dialog;
    },
    get lesson() {
      return lesson;
    },
    get view() {
      return views.view;
    },
    switchView: (v) => views.switchView(v),
    get frozen() {
      return plots.frozen;
    },
    toggleFreeze: () => plots.toggleFreeze(),
    get locked() {
      return locked;
    },
    setLocked,
    clearLock() {
      locked = false;
      $('#lock-overlay').hidden = true;
    },
    markDirty: () => plots.markDirty(),
    updateUI,
  };
  const dialog = createDialogHost();
  const lesson = createLessonTracker(ctx);
  const views = createViews(ctx);
  const quick = createQuickEditor(ctx);
  const hold = createHoldPanel(ctx, { quick });
  const modes = createModeDialog(ctx, { cancelQuick: () => quick.cancelQuick() });
  const alarms = createAlarmsUi(ctx);
  const metrics = createMetricsView(ctx);
  const plots = createPlotsView(ctx, { teacherVisible: () => instructor.teacherVisible });
  const instructor = createInstructorPanel(ctx, { quick, hold, metrics, plots, initialVisible: params.get('instructor') !== '0' });
  const actions = createActions(ctx, { quick, hold, modes, alarms, metrics, plots, instructor });

  // ---------- pintado ----------
  function updateUI(): void {
    const fr = frame;
    if (!fr) return;
    put('#scenario-name', fixtureId ? `Referencia fotográfica ${fixtureId} (transcripción, sin motor)` : scenario.name);
    put('#scenario-sub', `Adulto virtual · ${MODE_LABEL[fr.settings.mode]}${fr.pending ? ' · ajustes pendientes' : ''}`);
    put(
      '#phase-status',
      !running
        ? `SIMULACIÓN PAUSADA${pauseReason ? ' · ' + pauseReason : ''}`
        : fr.ventilation === 'standby'
          ? 'En espera'
          : (PHASE_TEXT[fr.live.phase] ?? fr.live.phase),
    );
    put('#monitor-clock', wallDate(fr.wallTimeMs).slice(-8, -3));
    put(
      '#simulation-clock',
      `Sesión ${clock(fr.simTimeMs / 1000)} · ${speed}×${!running ? ' · pausada' : ''}${discontinuities.length ? ` · ${discontinuities.length} discontinuidad(es)` : ''}`,
    );
    $('#live-dot').classList.toggle('paused', !running);
    $('#sim-pause').innerHTML = icon(running ? 'pause' : 'play') + `<span>${running ? 'Pausar' : 'Reanudar'}</span>`;
    $('#sim-pause').setAttribute('aria-label', running ? 'Pausar simulación' : 'Reanudar simulación');
    ($('#sim-speed') as HTMLSelectElement).value = String(speed);
    const o2 = fr.procedure.o2;
    $('#o2-key').classList.toggle('o2-active', !!o2?.active);
    put('#o2-time', o2?.active ? clock(Math.ceil((o2.endsAtMs - fr.simTimeMs) / 1000)) : '');
    metrics.updateMetrics();
    quick.updateQuick();
    alarms.updateAlarm();
    hold.updateHold();
    instructor.updateTeacher();
    metrics.updateLogs();
    lesson.evaluate();
  }
  function ingest(
    fr: EngineFrame,
    m: { running: boolean; speed: number; pauseReason: string | null; discontinuities: Discontinuity[]; generation: number },
  ): void {
    const prev = frame;
    const newSession = m.generation !== generation;
    generation = m.generation;
    frame = fr;
    running = m.running;
    speed = m.speed;
    pauseReason = m.pauseReason;
    discontinuities = m.discontinuities;
    if (newSession) plots.reset();
    plots.ingest(prev, fr);
    if (newSession) {
      lesson.reset(); // la lección arranca con el primer cuadro de la sesión nueva, nunca con cuadros de la anterior
      $('#monitor').classList.remove('loading');
    } else if (prev && JSON.stringify(prev.truth.patient) !== JSON.stringify(fr.truth.patient)) lesson.notePatientChange(fr.simTimeMs);
    updateUI();
  }

  // ---------- arranque ----------
  /** Degradación del motor (sin Worker o sin arrancar): aviso persistente y etiqueta de versión honesta. */
  function onDegraded(reason: string): void {
    const text = learnerText(reason);
    const failedInit = /inici|init|par[áa]metro|inv[áa]lid|\bdt\b/i.test(reason);
    engineBanner(
      failedInit && frame === null
        ? `No se pudo iniciar la simulación: ${text}. Revisa los parámetros de la dirección o recarga la página.`
        : `El motor de simulación se ejecuta sin Worker: ${text}. La simulación continúa en la página; puede perder fluidez.`,
    );
    versionTag();
  }
  function wireDegraded(): void {
    // Compatibilidad con ambas formas de la interfaz: propiedad asignable o método de suscripción.
    const c = client as unknown as { onDegraded: unknown };
    if (typeof c.onDegraded === 'function') (c.onDegraded as (cb: (r: string) => void) => void).call(client, onDegraded);
    else c.onDegraded = onDegraded;
    if (client.degradedReason) onDegraded(client.degradedReason);
  }
  function startEngine(): void {
    const t0 = params.get('t0');
    const init: SimulatorInit = defaultInit({
      ...(t0 ? { startWallTimeMs: new Date(t0).getTime() } : { startWallTimeMs: Date.now() }),
      ...(params.get('seed') ? { seed: Number(params.get('seed')) } : {}),
      ...(params.get('dt') ? { dtMs: Number(params.get('dt')) } : {}),
      patient: { ...scenario.patient },
      effort: { ...scenario.effort },
      sensors: { ...scenario.sensors },
      settings: { ...defaultInit().settings, ...(scenario.settings ?? {}) },
      alarmLimits: { ...defaultInit().alarmLimits, ...(scenario.alarmLimits ?? {}) },
      initialV: scenario.initialV ?? 'equilibrium',
    });
    speed = params.get('speed') ? Number(params.get('speed')) : 1;
    ($('#sim-speed') as HTMLSelectElement).value = String(speed);
    const autopause = params.get('autopause') ? Number(params.get('autopause')) : undefined;
    client.init(init, speed, params.get('paused') !== '1', autopause);
    if (scenario.perturbations.length) client.loadScenario(scenario, false);
    setTimeout(() => {
      if (frame === null && !fixtureId) {
        engineBanner(
          'No se pudo iniciar la simulación: el motor no envió ningún dato en 5 segundos. Recarga la página o revisa los parámetros de la dirección.',
        );
        put('#phase-status', 'Motor sin respuesta');
      }
    }, FIRST_FRAME_TIMEOUT_MS);
  }
  function showFixture(fx: FixtureId): void {
    fixtureId = fx;
    client.pause('fixture visual');
    frame = frameFromFixture(PHOTO_FIXTURES[fx]);
    running = false;
    pauseReason = 'fixture visual';
    views.switchView(fx === 'P1' ? 'waves' : 'basic');
    plots.clearPoints();
    updateUI();
    if (fx === 'P1') hold.openHold('inspHold');
  }

  metrics.init();
  instructor.init();
  fillStaticHelp();
  views.initMonitorScale();
  instructor.initChrome();
  versionTag();
  dialog.bind();
  actions.bind();
  bindKeyboard(ctx, { quick, action: actions.action });
  lesson.render();
  wireDegraded();
  client.onFrame((m) => {
    if (fixtureId) return;
    ingest(m.frame, m);
  });
  plots.start();
  void client.ready.then(() => {
    startEngine();
    const fx = params.get('fixture');
    if (fx === 'P1' || fx === 'P3') setTimeout(() => showFixture(fx), 80);
    const v = params.get('view');
    if (v) views.switchView(v);
  });
  (window as unknown as { __r860: unknown }).__r860 = {
    get frame() {
      return frame;
    },
    get gaugePaw() {
      return plots.gaugePaw;
    },
    get edit() {
      return quick.edit.state;
    },
    get view() {
      return views.view;
    },
    get mode() {
      return client.mode;
    },
    get running() {
      return running;
    },
    get points() {
      return plots.points.length;
    },
    get degraded() {
      return client.degradedReason;
    },
  };
}
