import type { Command } from '../domain/commands';
import type { Actor } from '../domain/types';
import type { EngineFrame, SimulatorInit } from '../engine/simulator';
import type { SessionFile } from '../history/session';
import type { Scenario } from '../scenarios';

export interface Discontinuity {
  atSimTimeMs: number;
  droppedMs: number;
  reason: string;
  wallIso: string;
}

export type MainToEngine =
  | { type: 'init'; init: SimulatorInit; speed: number; running: boolean; autopauseAtMs?: number }
  | { type: 'command'; id: number; cmd: Command; actor: Actor }
  | { type: 'control'; action: 'pause' | 'resume'; reason: string }
  | { type: 'setSpeed'; speed: number }
  | { type: 'visibility'; hidden: boolean }
  | { type: 'requestFrame' }
  | { type: 'exportSession'; id: number }
  | { type: 'importSession'; id: number; text: string }
  | { type: 'loadScenario'; scenario: Scenario; keepSettings: boolean };

export type EngineToMain =
  | { type: 'frame'; frame: EngineFrame; running: boolean; speed: number; pauseReason: string | null; discontinuities: Discontinuity[] }
  | { type: 'commandResult'; id: number; accepted: boolean; reason?: string }
  | { type: 'session'; id: number; file: SessionFile }
  | { type: 'importResult'; id: number; ok: boolean; errors?: string[]; warnings?: string[] }
  | { type: 'ready' }
  | { type: 'initError'; reason: string };
