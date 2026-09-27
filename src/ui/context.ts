/**
 * Contrato compartido por las piezas de la interfaz. Cada módulo de rasgo (`createX(ctx)`) recibe este contexto
 * y es dueño de su propio estado y de su porción del DOM; lo que necesita de otros lo pide por aquí, nunca por variables ajenas.
 * El estado de sesión (cuadro, marcha, escenario, fixture, bloqueo) es del punto de composición (app.ts).
 */
import type { EngineClient } from '../app/engineClient';
import type { Command } from '../domain/commands';
import type { ProfileSpec } from '../domain/profile';
import type { EngineFrame } from '../engine/simulator';
import type { Scenario } from '../scenarios';

export type ViewId = 'waves' | 'basic' | 'loops' | 'data' | 'trends' | 'log' | 'teaching';
export type FixtureId = 'P1' | 'P3';
export type Actor = 'learner' | 'instructor';
export interface CommandResult {
  accepted: boolean;
  reason?: string;
}

/** Diálogo modal único (#app-dialog): quién lo abrió y avisos para que cada rasgo limpie su borrador al cerrarse. */
export interface DialogHost {
  readonly kind: string;
  open(kind: string, title: string, html: string, footer?: string, size?: string): void;
  close(): void;
  onOpen(listener: () => void): void;
  onClose(listener: () => void): void;
}

/** Seguimiento de objetivos de la lección: banderas que los rasgos marcan y evaluación por cuadro. */
export interface LessonTracker {
  readonly flags: Record<string, unknown>;
  readonly done: Set<string>;
  reset(): void;
  render(): void;
  evaluate(): void;
  noteSettingsChange(): void;
  notePatientChange(simTimeMs: number): void;
  /** Una sesión importada no dice de qué escenario es: mientras dure, los objetivos no se evalúan. */
  setSessionImported(value: boolean): void;
}

export interface AppContext {
  readonly client: EngineClient;
  readonly profile: ProfileSpec;
  /** Plazo de cancelación del borrador (perfil, o `editTimeout` de la URL en pruebas). */
  readonly editTimeoutMs: number;
  readonly frame: EngineFrame | null;
  readonly running: boolean;
  readonly fixtureId: FixtureId | null;
  readonly scenario: Scenario;
  /** Cambia el escenario activo y abandona el modo fixture. */
  setScenario(sc: Scenario): void;
  clearFixture(): void;
  setSpeed(speed: number): void;
  simS(): number;
  send(cmd: Command, actor?: Actor): Promise<CommandResult>;
  toast(message: string, warn?: boolean): void;
  notice(message: string): void;
  readonly dialog: DialogHost;
  readonly lesson: LessonTracker;
  readonly view: ViewId;
  switchView(v: string): void;
  readonly frozen: boolean;
  toggleFreeze(): void;
  /** Densidad de la columna numérica: 6 casillas grandes (como el equipo) u 13 completas. Persiste en localStorage. */
  readonly tileDensity: 6 | 13;
  setTileDensity(d: 6 | 13): void;
  readonly locked: boolean;
  setLocked(on: boolean): void;
  /** Modo examen: los valores medidos muestran «?» hasta que el alumno los estima. */
  readonly examMode: boolean;
  setExamMode(on: boolean): void;
  /** Sólo quita el bloqueo visual (carga de escenario), sin tocar el editor: mismo comportamiento que la versión monolítica. */
  clearLock(): void;
  /** Pide un redibujado de las curvas en el próximo cuadro de animación. */
  markDirty(): void;
  /** Vuelve a pintar toda la interfaz a partir del cuadro actual. */
  updateUI(): void;
}
