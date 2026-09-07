import type { CmH2O, Fraction, Liters, LitersPerCmH2O, LitersPerSecond, CmH2OSecondsPerLiter } from './units';

/** Calidad de una medición. `null` como valor se muestra como «---», nunca como 0 ni como Off. */
export type Quality = 'valid' | 'stale' | 'unavailable' | 'invalid' | 'inProgress';
export type MetricSource = 'ventilator' | 'airwayModule' | 'procedure' | 'derivedModel' | 'fixture';

/** Contrato de muestra métrica (dossier §15). Cada número lleva sensor, respiración, hora y calidad. */
export interface MetricSample {
  key: string;
  value: number | null;
  unit: string;
  source: MetricSource;
  simTimeMs: number;
  breathId: string | null;
  procedureId: string | null;
  quality: Quality;
  reason: string | null;
  windowMs: number | null;
}

export type PatientType = 'adult' | 'pediatric' | 'neonatal';
export type ModeId =
  | 'AC_VC'
  | 'AC_PC'
  | 'CPAP_PS'
  | 'AC_PRVC'
  | 'SIMV_VC'
  | 'SIMV_PC'
  | 'SIMV_PRVC'
  | 'SBT'
  | 'NIV'
  | 'VS'
  | 'BILEVEL'
  | 'BILEVEL_VG'
  | 'APRV'
  | 'NCPAP'
  | 'O2_THERAPY';

export type OffOr<T> = T | 'off';

export type VentMode = 'AC_VC' | 'AC_PC';

/**
 * Ajustes programados (familia de temporización «I:E, control de flujo apagado», O en P1/P3 + D ficha 2014).
 * A/C VC usa vt/plimit/pausePct; A/C PC usa pinsp/riseMs. Los demás son comunes.
 */
export interface VcSettings {
  mode: VentMode;
  /** Fracción 0.21..1 */
  fio2: Fraction;
  /** Litros */
  vt: Liters;
  /** Respiraciones por minuto */
  rr: number;
  /** Razón I/E como número (1:1.5 -> 1/1.5). */
  ie: number;
  /** cmH2O o 'off' (Off => ambiente, decisión P). */
  peep: OffOr<CmH2O>;
  /** Presión máxima: alcanzarla termina la inspiración. */
  pmax: CmH2O;
  /** Límite de presión en VC: limita y mantiene la presión el tiempo inspiratorio restante. */
  plimit: CmH2O;
  /** Pausa inspiratoria como fracción de Tinsp (0..0.75). */
  pausePct: Fraction;
  /** Control asistido (disparo por paciente) habilitado. */
  assistControl: boolean;
  /** Trigger por flujo, L/s interno. */
  flowTrigger: LitersPerSecond;
  /** Flujo de base espiratorio, L/s interno. D ficha 2014 «2 a 10 L/min (0.5)» adulto. */
  biasFlow: LitersPerSecond;
  /** Disparo por presión en lugar de por flujo (D ficha 2014: ambos tipos existen). */
  triggerByPressure: boolean;
  /** Umbral de presión bajo PEEP (cmH2O negativos). D ficha 2014 «−10 a −3 (0.5); −3 a −0.25 (0.25)». */
  pressureTrigger: CmH2O;
  /** A/C PC: presión inspiratoria SOBRE PEEP (cmH2O). D ficha 2014 «Pinsp 1–98». */
  pinsp: CmH2O;
  /** A/C PC: rampa de presión (ms). D ficha 2014 «Tiempo de rampa 0–500 ms (50)». */
  riseMs: number;
}
export type VentSettings = VcSettings;

export type SettingsKey = Exclude<keyof VcSettings, 'mode'>;

/** Límites de alarma (D rangos ficha 2014; valores iniciales P). */
export interface AlarmLimits {
  ppeakLow: OffOr<CmH2O>;
  vteLow: OffOr<Liters>;
  vteHigh: OffOr<Liters>;
  mveLow: OffOr<number>;
  mveHigh: OffOr<number>;
  rrLow: OffOr<number>;
  rrHigh: OffOr<number>;
  fio2Low: OffOr<Fraction>;
  fio2High: OffOr<Fraction>;
  peepeLow: OffOr<CmH2O>;
  peepeHigh: OffOr<CmH2O>;
}

/** Parámetros verdaderos del paciente sintético (sólo panel docente). */
export interface PatientParams {
  crs: LitersPerCmH2O;
  rInsp: CmH2OSecondsPerLiter;
  rExp: CmH2OSecondsPerLiter;
  /** Componente no lineal de Rohrer R2·|Q| (cmH2O/(L/s)²): 0 = resistencia lineal pura. */
  r2: number;
  /**
   * Elastancia viscoelástica E2 (cmH2O/L) del modelo de dos compartimentos en serie (cuerpo de Maxwell).
   * 0 = sin relajación de esfuerzo (un solo compartimento, como hasta v0.3.8).
   */
  eVisc?: number;
  /** Constante de tiempo de la relajación viscoelástica (s). */
  tauViscS?: number;
  /**
   * Curva presión-volumen sigmoidea (Venegas): V(P) = a + b/(1 + e^(−(P−c)/d)), anclada en V(P0) = 0.
   * Ausente o b = 0 → compliance lineal Crs. Con ella aparecen el codo inferior y la sobredistensión.
   */
  sigmoid?: { b: Liters; c: CmH2O; d: CmH2O };
  /** Presión de referencia (0 en pruebas). */
  p0: CmH2O;
  /** Resistencia de la rama espiratoria + válvula (cmH2O·s/L), en serie con Rexp. D techo del sistema respiratorio; valor P. 0 = ideal. */
  rExpValve?: CmH2OSecondsPerLiter;
}

export interface EffortParams {
  enabled: boolean;
  /** Amplitud de Pmus (positiva = esfuerzo inspiratorio). */
  amplitude: CmH2O;
  ratePerMin: number;
  /** Duración del esfuerzo (s). */
  tiS: number;
  /** Desfase inicial (s), independiente del reloj del ventilador. */
  phaseS: number;
}

export interface SensorParams {
  /** Constante de tiempo del sensor de O2 (s). Propuesta P. */
  fio2TauS: number;
  /** Sesgo aditivo del sensor de O2 (fracción). Escenario SC-12. */
  fio2Bias: Fraction;
  /**
   * Variabilidad del canal de volumen respiración a respiración (fracción, distribución uniforme ±x).
   * Ausente = valor por omisión del perfil. 0 = canal ideal (banco analítico).
   * D: la ficha 2014 acota lecturas de volumen a ±10 % o ±10 mL y la administración a ±10 % del ajuste; el valor típico ciclo a ciclo es P.
   */
  flowNoiseFraction?: Fraction;
}

export type BreathType = 'mandatory' | 'assisted' | 'manual' | 'spontaneous';
export type CyclingCause = 'time' | 'pmax' | 'standby' | 'procedureAbort';

export interface BreathRecord {
  breathId: string;
  sequence: number;
  type: BreathType;
  startSimTimeMs: number;
  endSimTimeMs: number;
  cyclingCause: CyclingCause;
  tInspS: number;
  tExpS: number;
  ppeak: CmH2O;
  pplatCycle: number | null;
  pplatCycleReason: string | null;
  peepe: CmH2O;
  pmean: CmH2O;
  vtInsp: Liters;
  vtExp: Liters;
  /** Lo que mide el sensor de flujo del ventilador (VTi/VTe de pantalla): volumen verdadero por la ganancia del sensor de esa respiración. */
  vtInspMeasured?: Liters;
  vtExpMeasured?: Liters;
  plimitReached: boolean;
  pmaxReached: boolean;
  /** Estado verdadero al inicio (docente): volumen absoluto sobre relajación. */
  truthVStartL: Liters;
}

export type ProcedureKind = 'inspHold' | 'expHold' | 'manualBreath' | 'increaseO2';
export type ProcedurePhase = 'queued' | 'running' | 'completed' | 'cancelled' | 'invalid';

export interface ProcedureResult {
  procedureId: string;
  kind: ProcedureKind;
  phase: ProcedurePhase;
  requestedAtMs: number;
  startedAtMs: number | null;
  completedAtMs: number | null;
  /** Hora de pared del resultado (ms epoch) — parte del dato, no decoración. */
  wallTimeMs: number | null;
  requestedDurationS: number | null;
  actualDurationS: number | null;
  breathId: string | null;
  quality: Quality;
  reason: string | null;
  values: Record<string, MetricSample>;
}

export type AlarmPriority = 'high' | 'medium' | 'informational';
export type AlarmResponse = 'none' | 'endInspiration' | 'enterBackup' | 'profileDefined';

export interface AlarmState {
  id: string;
  priority: AlarmPriority;
  /** Origen D/P del nivel de prioridad y del retardo. */
  priorityEvidence: 'D' | 'P' | 'U';
  source: string;
  message: string;
  conditionActive: boolean;
  onsetAtMs: number | null;
  resolvedAtMs: number | null;
  acknowledgedAtMs: number | null;
  displayedValueAtOnset: number | null;
  rawValueAtOnset: number | null;
  threshold: number | null;
  conditionReason: string;
  responseAction: AlarmResponse;
  /** Requiere reconocimiento del usuario tras resolverse (P: alta y media). */
  latching: boolean;
}

export type VentilationState = 'standby' | 'ventilating';
export type ControllerPhase = 'standby' | 'inspFlow' | 'inspLimited' | 'inspPause' | 'inspPressure' | 'holdInsp' | 'exp' | 'holdExp';

export type Actor = 'learner' | 'instructor' | 'controller' | 'scenario' | 'system';

export interface SessionEvent {
  sequence: number;
  simTimeMs: number;
  wallTimeIso: string;
  kind: 'setting' | 'alarm' | 'procedure' | 'scenario' | 'mode' | 'pause' | 'state' | 'breath' | 'audio' | 'discontinuity' | 'rejected';
  actor: Actor;
  payload: unknown;
  profileVersion: string;
  engineVersion: string;
}

export interface SettingChangeRecord {
  key: SettingsKey;
  oldValue: unknown;
  newValue: unknown;
  confirmedAtMs: number;
  appliedAtMs: number | null;
  applyPolicy: 'nextBreath' | 'immediate' | 'standbyOnly' | 'unverified';
  policyEvidence: 'D' | 'P' | 'U';
}
