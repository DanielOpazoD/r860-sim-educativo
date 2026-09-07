import type { Command } from '../domain/commands';
import type { Actor } from '../domain/types';
import type { SimulatorInit } from '../engine/simulator';
import type { SessionFile } from '../history/session';
import type { Scenario } from '../scenarios';
import { EngineHost } from './engineHost';
import type { EngineToMain, MainToEngine } from './protocol';

export type FrameListener = (m: Extract<EngineToMain, { type: 'frame' }>) => void;

/** Tiempo máximo de espera del saludo «ready» del Worker antes de degradar al modo en página (ms). */
export const WORKER_READY_TIMEOUT_MS = 4000;

/**
 * Cliente tipado del motor. Usa un Worker; si el Worker falla o no saluda a tiempo, cae a un anfitrión en la página,
 * cambia `mode` a 'inline' y lo notifica por `onDegraded` para que la interfaz lo muestre.
 */
export class EngineClient {
  mode: 'worker' | 'inline';
  degradedReason: string | null = null;
  onDegraded: ((reason: string) => void) | null = null;
  private worker: Worker | null = null;
  private inline: EngineHost | null = null;
  private nextId = 1;
  private pending = new Map<number, (m: EngineToMain) => void>();
  private frameListeners: FrameListener[] = [];
  private readyResolve: (() => void) | null = null;
  readonly ready: Promise<void>;

  constructor(opts: { forceInline?: boolean; readyTimeoutMs?: number } = {}) {
    this.ready = new Promise<void>((res) => {
      this.readyResolve = res;
    });
    let mode: 'worker' | 'inline' = 'inline';
    if (!opts.forceInline && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('../workers/engine.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e: MessageEvent<EngineToMain>) => this.dispatch(e.data);
        this.worker.onerror = (e) => this.degrade(`error del Worker: ${(e as ErrorEvent).message || 'desconocido'}`);
        mode = 'worker';
        const timer = setTimeout(() => {
          if (!this.readyDone) this.degrade('el Worker no respondió a tiempo');
        }, opts.readyTimeoutMs ?? WORKER_READY_TIMEOUT_MS);
        void this.ready.then(() => clearTimeout(timer));
      } catch (e) {
        this.worker = null;
        this.degradedReason = `no se pudo crear el Worker: ${(e as Error).message}`;
      }
    }
    if (!this.worker) {
      this.inline = new EngineHost((m) => this.dispatch(m));
      queueMicrotask(() => this.dispatch({ type: 'ready' }));
    }
    this.mode = mode;
  }

  private readyDone = false;

  /** Degradación explícita: se cierra el Worker y se sigue en la página. Nunca silenciosa. */
  private degrade(reason: string): void {
    if (this.mode === 'inline') return;
    this.worker?.terminate();
    this.worker = null;
    this.mode = 'inline';
    this.degradedReason = reason;
    this.inline = new EngineHost((m) => this.dispatch(m));
    // Las órdenes pendientes no pueden quedar colgadas: se responden como rechazadas con el motivo.
    const pend = [...this.pending.values()];
    this.pending.clear();
    for (const cb of pend) cb({ type: 'commandResult', id: -1, accepted: false, reason: `motor degradado: ${reason}` });
    this.onDegraded?.(reason);
    if (!this.readyDone) this.dispatch({ type: 'ready' });
  }

  private send(m: MainToEngine): void {
    if (this.worker) this.worker.postMessage(m);
    else this.inline?.handle(m);
  }

  private dispatch(m: EngineToMain): void {
    if (m.type === 'ready') {
      this.readyDone = true;
      this.readyResolve?.();
      return;
    }
    if (m.type === 'frame') {
      for (const l of this.frameListeners) l(m);
      return;
    }
    if (m.type === 'initError') {
      this.degradedReason = m.reason;
      this.onDegraded?.(this.degradedReason);
      return;
    }
    const cb = this.pending.get(m.id);
    if (cb) {
      this.pending.delete(m.id);
      cb(m);
    }
  }

  onFrame(l: FrameListener): () => void {
    this.frameListeners.push(l);
    return () => {
      this.frameListeners = this.frameListeners.filter((x) => x !== l);
    };
  }

  init(init: SimulatorInit, speed = 1, running = true, autopauseAtMs?: number, warmUp = true): void {
    this.send({ type: 'init', init, speed, running, warmUp, ...(autopauseAtMs !== undefined ? { autopauseAtMs } : {}) });
  }

  command(cmd: Command, actor: Actor = 'learner'): Promise<{ accepted: boolean; reason?: string }> {
    const id = this.nextId++;
    return new Promise((res) => {
      this.pending.set(id, (m) => {
        if (m.type === 'commandResult') res({ accepted: m.accepted, ...(m.reason ? { reason: m.reason } : {}) });
      });
      this.send({ type: 'command', id, cmd, actor });
    });
  }

  pause(reason: string): void {
    this.send({ type: 'control', action: 'pause', reason });
  }
  resume(): void {
    this.send({ type: 'control', action: 'resume', reason: '' });
  }
  setSpeed(speed: number): void {
    this.send({ type: 'setSpeed', speed });
  }
  visibility(hidden: boolean): void {
    this.send({ type: 'visibility', hidden });
  }
  requestFrame(): void {
    this.send({ type: 'requestFrame' });
  }
  loadScenario(scenario: Scenario, keepSettings = false): void {
    this.send({ type: 'loadScenario', scenario, keepSettings });
  }

  exportSession(): Promise<SessionFile> {
    const id = this.nextId++;
    return new Promise((res) => {
      this.pending.set(id, (m) => {
        if (m.type === 'session') res(m.file);
      });
      this.send({ type: 'exportSession', id });
    });
  }

  importSession(text: string): Promise<{ ok: boolean; errors?: string[]; warnings?: string[] }> {
    const id = this.nextId++;
    return new Promise((res) => {
      this.pending.set(id, (m) => {
        if (m.type === 'importResult')
          res({ ok: m.ok, ...(m.errors ? { errors: m.errors } : {}), ...(m.warnings ? { warnings: m.warnings } : {}) });
      });
      this.send({ type: 'importSession', id, text });
    });
  }
}
