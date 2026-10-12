import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import { EngineClient } from '../src/app/engineClient';
import type { AppContext } from '../src/ui/context';
import { createDialogHost } from '../src/ui/dialogHost';
import { createLessonTracker } from '../src/ui/lessonTracker';
import { SCENARIOS } from '../src/scenarios';
import { benchSim } from './helpers';

const page = readFileSync('index.html', 'utf8');

export function uiHarness(): { ctx: { -readonly [K in keyof AppContext]: AppContext[K] }; sim: ReturnType<typeof benchSim> } {
  document.documentElement.innerHTML = page;
  localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => true,
    })),
  );
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  const sim = benchSim();
  const ctx: { -readonly [K in keyof AppContext]: AppContext[K] } = {
    client: new EngineClient({ forceInline: true }),
    profile: sim.profile,
    editTimeoutMs: 15_000,
    frame: sim.frame(),
    running: true,
    fixtureId: null,
    scenario: structuredClone(SCENARIOS[0]!),
    setScenario: vi.fn((scenario) => {
      ctx.scenario = scenario;
    }),
    clearFixture: vi.fn(),
    setSpeed: vi.fn(),
    simS: () => (ctx.frame?.simTimeMs ?? 0) / 1000,
    send: vi.fn(async () => ({ accepted: true })),
    toast: vi.fn(),
    notice: vi.fn(),
    dialog: createDialogHost(),
    lesson: {
      sessionImported: false,
      flags: {},
      done: new Set(),
      reset: vi.fn(),
      render: vi.fn(),
      evaluate: vi.fn(),
      context: vi.fn(() => null),
      noteSettingsChange: vi.fn(),
      notePatientChange: vi.fn(),
      setSessionImported: vi.fn(),
    },
    view: 'waves',
    switchView: vi.fn((view) => {
      ctx.view = view as AppContext['view'];
    }),
    frozen: false,
    toggleFreeze: vi.fn(() => {
      ctx.frozen = !ctx.frozen;
    }),
    tileDensity: 13,
    setTileDensity: vi.fn(),
    locked: false,
    setLocked: vi.fn((on) => {
      ctx.locked = on;
    }),
    examMode: false,
    setExamMode: vi.fn((on) => {
      ctx.examMode = on;
    }),
    examMasked: vi.fn(() => false),
    clearLock: vi.fn(),
    markDirty: vi.fn(),
    updateUI: vi.fn(),
  };
  ctx.lesson = createLessonTracker(ctx);
  return { ctx, sim };
}
