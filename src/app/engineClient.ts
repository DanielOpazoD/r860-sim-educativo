import type { Command } from '../domain/commands';
import type { Actor } from '../domain/types';
import type { SimulatorInit } from '../engine/simulator';
import type { SessionFile } from '../history/session';
import type { Scenario } from '../scenarios';
import { EngineHost } from './engineHost';
import type { EngineToMain, MainToEngine } from './protocol';

export type FrameListener = (m: Extract<EngineToMain, { type: 'frame' }>) => void;

/** Cliente tipado del motor. Usa un Worker; si falla (p. ej. file://), cae a un anfitrión en la página y lo declara. */
export class EngineClient {
  readonly mode: 'worker' | 'inline';
  private worker: Worker | null = null;
  private inline: EngineHost | null = null;
  private nextId = 1;
  private pending = new Map<number, (m: EngineToMain) => void>();
  private frameListeners: FrameListener[] = [];
  private readyResolve: (() => void) | null = null;
  readonly ready: Promise<void>;

  constructor(opts: { forceInline?: boolean } = {}) {
    this.ready = new Promise<void>((res) => { this.readyResolve = res; });
    let mode: 'worker' | 'inline' = 'inline';
    if (!opts.forceInline && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('../workers/engine.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e: MessageEvent<EngineToMain>) => this.dispatch(e.data);
        this.worker.onerror = () => { /* se degrada al iniciar si no llega 'ready' */ };
        mode = 'worker';
      } catch {
        this.worker = null;
      }
    }
    if (!this.worker) {
      this.inline = new EngineHost((m) => this.dispatch(m));
      queueMicrotask(() => this.dispatch({ type: 'ready' }));
    }
    this.mode = mode;
  }

  private send(m: MainToEngine): void {
    if (this.worker) this.worker.postMessage(m);
    else this.inline?.handle(m);
  }

  private dispatch(m: EngineToMain): void {
    if (m.type === 'ready') { this.readyResolve?.(); return; }
    if (m.type === 'frame') { for (const l of this.frameListeners) l(m); return; }
    const cb = this.pending.get(m.id);
    if (cb) { this.pending.delete(m.id); cb(m); }
  }

  onFrame(l: FrameListener): () => void {
    this.frameListeners.push(l);
    return () => { this.frameListeners = this.frameListeners.filter((x) => x !== l); };
  }

  init(init: SimulatorInit, speed = 1, running = true, autopauseAtMs?: number): void { this.send({ type: 'init', init, speed, running, ...(autopauseAtMs !== undefined ? { autopauseAtMs } : {}) }); }

  command(cmd: Command, actor: Actor = 'learner'): Promise<{ accepted: boolean; reason?: string }> {
    const id = this.nextId++;
    return new Promise((res) => {
      this.pending.set(id, (m) => { if (m.type === 'commandResult') res({ accepted: m.accepted, ...(m.reason ? { reason: m.reason } : {}) }); });
      this.send({ type: 'command', id, cmd, actor });
    });
  }

  pause(reason: string): void { this.send({ type: 'control', action: 'pause', reason }); }
  resume(): void { this.send({ type: 'control', action: 'resume', reason: '' }); }
  setSpeed(speed: number): void { this.send({ type: 'setSpeed', speed }); }
  visibility(hidden: boolean): void { this.send({ type: 'visibility', hidden }); }
  requestFrame(): void { this.send({ type: 'requestFrame' }); }
  loadScenario(scenario: Scenario, keepSettings = false): void { this.send({ type: 'loadScenario', scenario, keepSettings }); }

  exportSession(): Promise<SessionFile> {
    const id = this.nextId++;
    return new Promise((res) => {
      this.pending.set(id, (m) => { if (m.type === 'session') res(m.file); });
      this.send({ type: 'exportSession', id });
    });
  }

  importSession(text: string): Promise<{ ok: boolean; errors?: string[]; warnings?: string[] }> {
    const id = this.nextId++;
    return new Promise((res) => {
      this.pending.set(id, (m) => { if (m.type === 'importResult') res({ ok: m.ok, ...(m.errors ? { errors: m.errors } : {}), ...(m.warnings ? { warnings: m.warnings } : {}) }); });
      this.send({ type: 'importSession', id, text });
    });
  }
}
