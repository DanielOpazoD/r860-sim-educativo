/**
 * Reloj de paso fijo. El tiempo real acumulado nunca autoriza un dt gigante:
 * si el presupuesto se supera, se registra una discontinuidad y se descarta el exceso (dossier §23).
 */
export interface StepPlan {
  steps: number;
  remainderMs: number;
  droppedMs: number;
}

export function planSteps(accumulatedMs: number, dtMs: number, maxSteps: number): StepPlan {
  if (accumulatedMs < 0 || !Number.isFinite(accumulatedMs)) return { steps: 0, remainderMs: 0, droppedMs: 0 };
  let steps = Math.floor(accumulatedMs / dtMs);
  let droppedMs = 0;
  if (steps > maxSteps) {
    droppedMs = (steps - maxSteps) * dtMs;
    steps = maxSteps;
  }
  const remainderMs = accumulatedMs - steps * dtMs - droppedMs;
  return { steps, remainderMs, droppedMs };
}

export class SimClock {
  readonly dtMs: number;
  simTimeMs = 0;
  readonly startWallTimeMs: number;
  constructor(dtMs: number, startWallTimeMs: number) {
    this.dtMs = dtMs;
    this.startWallTimeMs = startWallTimeMs;
  }
  get wallTimeMs(): number {
    return this.startWallTimeMs + this.simTimeMs;
  }
  tick(): void {
    this.simTimeMs += this.dtMs;
  }
}
