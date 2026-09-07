import { describe, expect, it } from 'vitest';
import { EngineClient } from '../../src/app/engineClient';
import { EngineHost } from '../../src/app/engineHost';
import type { EngineToMain } from '../../src/app/protocol';
import { defaultInit } from '../../src/profiles';
import { benchSim } from '../helpers';

// Regresiones de fallos silenciosos (07-09-2026): casos en que el programa se quedaba quieto, o esperando para
// siempre, sin decir nada. El contrato del proyecto es que nada falla en silencio.

/** Resuelve con `TIMEOUT` si la promesa se queda colgada: es exactamente lo que hay que descartar. */
function conPlazo<T>(p: Promise<T>, ms = 500): Promise<T | 'TIMEOUT'> {
  return Promise.race([p, new Promise<'TIMEOUT'>((res) => setTimeout(() => res('TIMEOUT'), ms))]);
}

describe('R6-01 · un número que no lo es no puede congelar el motor', () => {
  it('una velocidad no finita se rechaza con motivo en vez de dejar el reloj en NaN', () => {
    // `?speed=abc` daba NaN: el acumulador del reloj se quedaba en NaN, no se ejecutaba ni un paso, y la interfaz
    // seguía diciendo «en marcha» con el tiempo simulado clavado en 0.
    const posted: EngineToMain[] = [];
    const host = new EngineHost((m) => posted.push(m));
    host.handle({ type: 'init', init: defaultInit({}), speed: Number.NaN, running: true });
    const err = posted.find((m) => m.type === 'initError');
    expect(err, JSON.stringify(posted.map((m) => m.type))).toBeDefined();
    expect((err as { reason: string }).reason).toMatch(/velocidad/);
    // Y no publica ningún cuadro: no hay simulación que aparentar.
    expect(posted.some((m) => m.type === 'frame')).toBe(false);
  });

  it('una autopausa no finita se rechaza igual', () => {
    const posted: EngineToMain[] = [];
    const host = new EngineHost((m) => posted.push(m));
    host.handle({ type: 'init', init: defaultInit({}), speed: 1, running: true, autopauseAtMs: Number.NaN });
    expect((posted.find((m) => m.type === 'initError') as { reason: string } | undefined)?.reason).toMatch(/autopausa/);
  });
});

describe('R6-02 · ninguna promesa del cliente queda colgada', () => {
  it('exportar sin simulación responde en vez de esperar para siempre', async () => {
    const client = new EngineClient({ forceInline: true });
    await client.ready;
    // Nunca se llamó a init: el anfitrión no tiene simulador que exportar.
    const r = await conPlazo(client.exportSession());
    expect(r).not.toBe('TIMEOUT');
    expect(r).toBeNull();
  });

  it('una exportación pendiente al degradar el Worker se resuelve como fallo', async () => {
    class WorkerQueMuere {
      onmessage: ((e: { data: EngineToMain }) => void) | null = null;
      onerror: ((e: { message: string }) => void) | null = null;
      postMessage(m: { type: string }): void {
        if (m.type === 'init') queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } }));
        if (m.type === 'exportSession') queueMicrotask(() => this.onerror?.({ message: 'crash' }));
      }
      terminate(): void {}
    }
    const g = globalThis as { Worker?: unknown };
    const prev = g.Worker;
    g.Worker = WorkerQueMuere;
    try {
      const client = new EngineClient({ readyTimeoutMs: 200 });
      client.init(benchSim().init, 1, false);
      await client.ready;
      const r = await conPlazo(client.exportSession());
      expect(r).not.toBe('TIMEOUT');
      expect(r).toBeNull();
      expect(client.mode).toBe('inline');
    } finally {
      if (prev === undefined) delete g.Worker;
      else g.Worker = prev;
    }
  });

  it('una importación pendiente al degradar se resuelve con el motivo, no con silencio', async () => {
    class WorkerQueMuere {
      onmessage: ((e: { data: EngineToMain }) => void) | null = null;
      onerror: ((e: { message: string }) => void) | null = null;
      postMessage(m: { type: string }): void {
        if (m.type === 'init') queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } }));
        if (m.type === 'importSession') queueMicrotask(() => this.onerror?.({ message: 'crash' }));
      }
      terminate(): void {}
    }
    const g = globalThis as { Worker?: unknown };
    const prev = g.Worker;
    g.Worker = WorkerQueMuere;
    try {
      const client = new EngineClient({ readyTimeoutMs: 200 });
      client.init(benchSim().init, 1, false);
      await client.ready;
      const r = await conPlazo(client.importSession('{}'));
      expect(r).not.toBe('TIMEOUT');
      expect((r as { ok: boolean }).ok).toBe(false);
      expect((r as { errors?: string[] }).errors?.[0]).toMatch(/degradado/);
    } finally {
      if (prev === undefined) delete g.Worker;
      else g.Worker = prev;
    }
  });
});
