import type { BreathRecord, BreathType, ControllerPhase, CyclingCause, VcSettings } from '../domain/types';

export type HoldKind = 'inspHold' | 'expHold';
export interface HoldRequest {
  procedureId: string;
  kind: HoldKind;
  durationS: number;
}

export interface HoldOutcome {
  procedureId: string;
  kind: HoldKind;
  breathId: string;
  startSimTimeS: number;
  endSimTimeS: number;
  actualDurationS: number;
  requestedDurationS: number;
  pawStart: number;
  pawEnd: number;
  /** máx−mín de Paw en la ventana evaluada (toda la ventana tras un arranque de min(0.5 s, 30 %)). */
  /** Deriva (máx − mín) en el tramo final de la oclusión: mide si la presión ya se asentó. */
  /** Velocidad a la que aún se movía la presión en el tramo final de la oclusión, en cmH2O/s. */
  driftRate: number;
  /** Mayor excursión contra la tendencia en toda la ventana: 0 en una relajación monótona, alta con esfuerzo. */
  reversal: number;
  pmaxHit: boolean;
  cancelled: boolean;
  /** Motivo de la cancelación (usuario o paso a espera). */
  cancelReason: 'user' | 'standby' | null;
  /** Bloqueo insp: VT inspirado de esa respiración (L) y PEEPe al inicio de la inspiración. */
  vtInspL: number;
  peepeStart: number;
  /** Paw y flujo en el último instante en que aún entraba gas: numerador y denominador de la resistencia inspiratoria. */
  pawAtFlowEnd: number;
  qAtFlowEndLps: number;
  /** La rampa fue a flujo constante y sin esfuerzo: sin eso, (Ppico − Pplat)/Q no mide una resistencia. */
  constantFlowInsp: boolean;
  /** Bloqueo esp: PEEPe medida justo antes de ocluir. */
  peepeBeforeOcclusion: number;
}

export type ControllerEvent =
  | { type: 'breathStart'; breathId: string; breathType: BreathType; simTimeS: number; vStartL: number; v2StartL: number }
  | { type: 'stepGuardExhausted'; simTimeS: number; phase: ControllerPhase }
  | { type: 'breathEnd'; record: BreathRecord }
  | { type: 'plimitReached'; breathId: string; simTimeS: number; paw: number }
  | { type: 'pmaxReached'; breathId: string; simTimeS: number; paw: number }
  | { type: 'trigger'; breathId: string; simTimeS: number; qLps: number }
  | { type: 'apnea'; simTimeS: number; apneaS: number }
  | { type: 'apneaEnded'; simTimeS: number; breathId: string }
  | { type: 'holdStarted'; procedureId: string; kind: HoldKind; simTimeS: number }
  | { type: 'holdEnded'; outcome: HoldOutcome }
  | { type: 'settingsApplied'; changes: Partial<VcSettings>; simTimeS: number; breathId: string }
  | { type: 'rejected'; what: string; reason: string; simTimeS: number };

export interface BreathAccum {
  breathId: string;
  sequence: number;
  type: BreathType;
  startSimT: number;
  vStart: number;
  pawStart: number;
  ppeak: number;
  pawIntegral: number;
  vtInsp: number;
  vtExp: number;
  tInspActual: number;
  tExpActual: number;
  plimitReached: boolean;
  pmaxReached: boolean;
  pauseSamples: { t: number; paw: number }[];
  /** Muestras de la rampa a flujo constante: de su forma sale el índice de estrés. */
  flowSamples: { t: number; paw: number }[];
  /** Paw y flujo en el ÚLTIMO instante en que aún entraba gas: el numerador y el denominador de la resistencia. */
  pawAtFlowEnd: number;
  qAtFlowEnd: number;
  /** Volumen absoluto y flujo a lo largo de la espiración: de su pendiente sale la constante de tiempo espiratoria. */
  expSamples: { vAbsL: number; qLps: number }[];
  /** Hubo esfuerzo muscular durante la espiración: entonces el vaciamiento no es pasivo y la pendiente no es del pulmón. */
  effortInExp: boolean;
  /** Si el paciente hizo fuerza durante esa rampa, la forma ya no es sólo del pulmón. */
  effortInFlow: boolean;
  pplatCycle: number | null;
  pplatReason: string | null;
  peepeEnd: number;
  cause: CyclingCause;
  /** ∫ Pva·dV de la inspiración (cmH2O·L): lo que el ventilador entrega al sistema respiratorio en esa respiración. */
  energyInsp: number;
  /** Flujo inspiratorio máximo de la respiración (L/s): la referencia del ciclado por flujo del soporte. */
  qPeak: number;
  /** Presión objetivo sobre PEEP de una respiración por presión: Pinsp, Pinsp de respaldo o PS. */
  pAbove: number;
  /** Duración de una inspiración por presión: Tinsp programado, Tinsp de respaldo o tope del soporte. */
  tInspTargetS: number;
}

export interface HoldRun {
  req: HoldRequest;
  tStart: number;
  pawStart: number;
  samples: { t: number; paw: number }[];
  pmaxHit: boolean;
  peepeBefore: number;
}
