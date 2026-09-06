import { planSteps } from '../engine/clock';
import { Simulator, type SimulatorInit } from '../engine/simulator';
import { exportSession, importSession, replaySession } from '../history/session';
import type { Scenario } from '../scenarios';
import type { Discontinuity, EngineToMain, MainToEngine } from './protocol';

/** Máximo de pasos por lote: 1 s de tiempo simulado con dt = 4 ms. El exceso se descarta y se registra (TIM-04). */
export const MAX_STEPS_PER_BATCH = 250;
export const TICK_MS = 20;
export const FRAME_EVERY_TICKS = 2;

/**
 * Anfitrión del motor: reloj de pared → acumulador → pasos fijos. Se ejecuta dentro de un Worker o, como respaldo, en la página.
 * requestAnimationFrame NUNCA gobierna la fisiología; aquí sólo hay setInterval + tiempo acumulado con tope.
 */
export class EngineHost {
  private sim: Simulator | null = null;
  private running = false;
  private speed = 1;
  private pauseReason: string | null = null;
  private accMs = 0;
  private lastNow: number | null = null;
  private tickCount = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private discontinuities: Discontinuity[] = [];
  private scenarioPerturbations: { atSimTimeMs: number; apply: () => void; note: string }[] = [];
  /** Pausa exacta en tiempo simulado (capturas deterministas, VIS). */
  private autopauseAtMs: number | null = null;

  constructor(
    private readonly post: (m: EngineToMain) => void,
    private readonly now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  ) {}

  handle(m: MainToEngine): void {
    switch (m.type) {
      case 'init':
        try {
          this.sim = new Simulator(m.init);
        } catch (e) {
          this.post({ type: 'commandResult', id: -1, accepted: false, reason: `init: ${(e as Error).message}` });
          return;
        }
        this.speed = m.speed;
        this.running = m.running;
        this.pauseReason = m.running ? null : 'inicio';
        this.autopauseAtMs = m.autopauseAtMs ?? null;
        this.accMs = 0;
        this.lastNow = null;
        this.discontinuities = [];
        this.scenarioPerturbations = [];
        this.startTimer();
        this.postFrame();
        break;
      case 'command': {
        if (!this.sim) {
          this.post({ type: 'commandResult', id: m.id, accepted: false, reason: 'Motor no inicializado' });
          return;
        }
        const r = this.sim.command(m.cmd, m.actor);
        this.post({ type: 'commandResult', id: m.id, accepted: r.accepted, ...(r.reason ? { reason: r.reason } : {}) });
        this.postFrame();
        break;
      }
      case 'control':
        if (m.action === 'pause') {
          this.running = false;
          this.pauseReason = m.reason;
          this.sim?.noteEvent('pause', 'system', { paused: true, reason: m.reason });
        } else {
          this.running = true;
          this.pauseReason = null;
          this.lastNow = null;
          this.accMs = 0;
          this.sim?.noteEvent('pause', 'system', { paused: false });
        }
        this.postFrame();
        break;
      case 'setSpeed':
        if (typeof m.speed === 'number' && Number.isFinite(m.speed)) this.speed = Math.max(0.1, Math.min(4, m.speed));
        break;
      case 'visibility':
        if (m.hidden && this.running) {
          this.running = false;
          this.pauseReason = 'segundo plano';
          this.sim?.noteEvent('pause', 'system', { paused: true, reason: 'pestaña oculta', wallIso: new Date().toISOString() });
        }
        // Política P: al volver la pestaña la simulación sigue pausada; la reanudación es manual y no se recupera el tiempo perdido.
        this.postFrame();
        break;
      case 'requestFrame':
        this.postFrame();
        break;
      case 'exportSession':
        if (this.sim) this.post({ type: 'session', id: m.id, file: exportSession(this.sim) });
        break;
      case 'importSession': {
        const r = importSession(m.text);
        if (!r.ok) {
          this.post({ type: 'importResult', id: m.id, ok: false, errors: r.errors });
          return;
        }
        let replayed: Simulator;
        try {
          replayed = replaySession(r.session);
        } catch (e) {
          this.post({ type: 'importResult', id: m.id, ok: false, errors: [`Reproducción fallida: ${(e as Error).message}`] });
          return;
        }
        this.sim = replayed;
        this.scenarioPerturbations = []; // una sesión importada no hereda perturbaciones del escenario previo (regla 9)
        this.discontinuities = [];
        this.running = false;
        this.pauseReason = 'sesión importada (reproducida); pulse Reanudar';
        this.accMs = 0;
        this.lastNow = null;
        this.post({ type: 'importResult', id: m.id, ok: true, warnings: r.warnings });
        this.postFrame();
        break;
      }
      case 'loadScenario':
        this.loadScenario(m.scenario, m.keepSettings);
        break;
      default:
        break;
    }
  }

  private loadScenario(sc: Scenario, keepSettings: boolean): void {
    const prev = this.sim;
    const base: SimulatorInit = prev ? { ...prev.init } : ({} as SimulatorInit);
    const init: SimulatorInit = {
      ...base,
      patient: { ...sc.patient },
      effort: { ...sc.effort },
      sensors: { ...sc.sensors },
      settings: keepSettings && prev ? { ...prev.controller.settings } : { ...base.settings, ...(sc.settings ?? {}) },
      alarmLimits: { ...base.alarmLimits, ...(sc.alarmLimits ?? {}) },
      initialV: sc.initialV ?? 'equilibrium',
      startVentilating: true,
    };
    this.sim = new Simulator(init);
    this.sim.noteEvent('scenario', 'instructor', { scenarioId: sc.id, name: sc.name, synthetic: true });
    this.scenarioPerturbations = sc.perturbations.map((p) => ({
      atSimTimeMs: p.atSimTimeMs,
      note: p.note,
      apply: () => {
        if (p.patient) this.sim?.command({ type: 'setPatient', params: p.patient }, 'scenario');
        if (p.effort) this.sim?.command({ type: 'setEffort', params: p.effort }, 'scenario');
        if (p.sensors) this.sim?.command({ type: 'setSensors', params: p.sensors }, 'scenario');
      },
    }));
    this.running = true;
    this.pauseReason = null;
    this.accMs = 0;
    this.lastNow = null;
    this.postFrame();
  }

  private startTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Un tic del reloj de pared: acumula tiempo real × velocidad y ejecuta pasos fijos con tope. */
  tick(nowOverride?: number): void {
    const sim = this.sim;
    if (!sim) return;
    const now = nowOverride ?? this.now();
    if (this.running) {
      if (this.lastNow !== null) this.accMs += (now - this.lastNow) * this.speed;
      this.lastNow = now;
      const plan = planSteps(this.accMs, sim.clock.dtMs, MAX_STEPS_PER_BATCH);
      if (plan.droppedMs > 0) {
        const d: Discontinuity = {
          atSimTimeMs: sim.simTimeMs,
          droppedMs: plan.droppedMs,
          reason: 'presupuesto de cómputo superado o temporizador retenido',
          wallIso: new Date().toISOString(),
        };
        this.discontinuities.push(d);
        if (this.discontinuities.length > 50) this.discontinuities.shift();
        sim.noteEvent('discontinuity', 'system', d);
      }
      let steps = plan.steps;
      if (this.autopauseAtMs !== null) {
        const left = Math.max(0, Math.round((this.autopauseAtMs - sim.simTimeMs) / sim.clock.dtMs));
        steps = Math.min(steps, left);
      }
      for (let i = 0; i < steps; i++) {
        this.applyDuePerturbations();
        sim.step();
      }
      this.accMs = plan.remainderMs;
      if (this.autopauseAtMs !== null && sim.simTimeMs >= this.autopauseAtMs) {
        this.running = false;
        this.pauseReason = `pausa automática en t = ${sim.simTimeMs} ms (captura)`;
        this.autopauseAtMs = null;
        sim.noteEvent('pause', 'system', { paused: true, reason: 'autopause' });
        this.postFrame();
      }
    } else {
      this.lastNow = now;
    }
    this.tickCount += 1;
    if (this.running && this.tickCount % FRAME_EVERY_TICKS === 0) this.postFrame();
  }

  private applyDuePerturbations(): void {
    const sim = this.sim;
    if (!sim || !this.scenarioPerturbations.length) return;
    const due = this.scenarioPerturbations.filter((p) => p.atSimTimeMs <= sim.simTimeMs);
    if (!due.length) return;
    this.scenarioPerturbations = this.scenarioPerturbations.filter((p) => p.atSimTimeMs > sim.simTimeMs);
    for (const p of due) p.apply();
  }

  private postFrame(): void {
    if (!this.sim) return;
    this.post({
      type: 'frame',
      frame: this.sim.frame(),
      running: this.running,
      speed: this.speed,
      pauseReason: this.pauseReason,
      discontinuities: [...this.discontinuities],
    });
  }
}
