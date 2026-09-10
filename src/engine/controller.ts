import type { BreathRecord, BreathType, ControllerPhase, CyclingCause, VcSettings } from '../domain/types';
import { deriveVcTiming, type DerivedTiming } from '../domain/validation';
import { sToMs } from '../domain/units';
import type { EffortGenerator } from './effort';
import type { PatientModel } from './patient';

/** Periodo refractario tras el inicio de la espiración antes de admitir disparo (P; inspirado en Texp mínimo 0.25 s, D). */
export const TRIGGER_REFRACTORY_S = 0.25;
/**
 * Retardo de respuesta del disparo (s), P (U-53): del cruce del umbral a la apertura de la válvula inspiratoria. Un
 * equipo real tarda unas decenas de milisegundos en detectar, decidir y actuar; en ese lapso el paciente sigue tirando
 * del gas de la válvula espiratoria y la Pva cae por debajo de la PEEP en cuanto la demanda supera el flujo de base.
 * Esa caída es el trabajo de disparo que se enseña en la curva de presión; con respuesta instantánea no existía
 * (20 ms y 0,026 cmH2O). 80 ms está dentro del rango de banco de los ventiladores de cuidados intensivos (60–150 ms).
 */
export const TRIGGER_DELAY_S = 0.08;
/**
 * Tiempo inspiratorio máximo de una respiración soportada (s), P. El ciclado por flujo puede no llegar —esfuerzo
 * sostenido, flujo que se aplana por encima del umbral— y el soporte no puede durar indefinidamente; 3 s es un tope
 * habitual en la literatura de soporte de presión (U-52).
 */
export const SUPPORT_TI_MAX_S = 3;
/** Julios por cmH2O·litro: la energía de la ventilación se mide en presión × volumen (1 cmH2O = 98,07 Pa; 1 L = 1e-3 m³). */
export const JOULES_PER_CMH2O_L = 0.09807;
/** Frecuencia de las respiraciones de respaldo mientras dura la apnea sin frecuencia mínima programada (/min), P (U-52). */
export const APNEA_BACKUP_RATE_PER_MIN = 12;
/** Duración mínima de pausa para estimar Pplat de ciclo (P). */
export const MIN_PAUSE_FOR_PPLAT_S = 0.1;
/**
 * Deriva máxima admisible de la meseta, como TASA (cmH2O/s) medida sobre un tramo final de duración fija (P).
 *
 * Fue un valor absoluto sobre un tramo que crecía con la oclusión, y por eso el criterio no era monótono: con dos
 * unidades de constantes muy dispares, un bloqueo de 2 s pasaba como válido —con la Cstat un 40 % baja, porque el
 * pendelluft aún no había terminado— mientras que uno de 5 s se rechazaba por inestable y uno de 15 s volvía a pasar.
 * La medición peor era la que superaba el filtro. Una tasa sobre un tramo fijo responde a la pregunta correcta:
 * ¿se ha asentado ya la presión?, y su respuesta no depende de cuánto se haya esperado.
 *
 * El valor está calibrado sobre tres mecánicas, con la tasa medida al final de la oclusión (cmH2O/s):
 *
 *     oclusión        2 s     3 s     5 s    10 s    15 s
 *     dos unidades   0,845   0,717   0,516   0,227   0,099   (tau del pendelluft 6,1 s)
 *     viscoelástico  0,707   0,363   0,096   0,003   0,000   (E2 10, tau 1,5 s)
 *     un compartim.  0,000   0,000   0,000   0,000   0,000
 *
 * 0,45 separa el pulmón que ya se asentó del que sigue relajándose visiblemente: deja pasar el bloqueo de 3 s sobre
 * un pulmón viscoelástico —donde la meseta por encima de la estática es el fenómeno que se quiere enseñar— y rechaza
 * los de 2, 3 y 5 s con dos unidades muy dispares, que antes pasaban con la Cstat hasta un 40 % baja. Es una constante
 * P: lo principiado es la forma del criterio (tasa, ventana fija, monótona); el valor está calibrado, no deducido.
 */
export const PLATEAU_DRIFT_RATE_CMH2O_S = 0.45;
/**
 * Deriva máxima admitida en el bloqueo ESPIRATORIO (cmH2O/s), P. Más estrecha que la inspiratoria porque el producto
 * de la maniobra no es la presión leída sino una resta de dos presiones casi iguales: la PEEP intrínseca. Un error de
 * 0,3 cmH2O sobre una meseta de 25 es despreciable; sobre una PEEPi de 0,6 es la mitad del dato.
 *
 * Con la aproximación de primer orden `paw(t) = A − B·e^(−t/tau)`, la deriva medida sobre el tramo final de duración
 * T = PLATEAU_TAIL_S acota lo que aún falta por subir: `resto = deriva · T / (e^(T/tau) − 1)`. Medido sobre los dos
 * escenarios con redistribución lenta (resto en cmH2O frente a la asíntota a 40 s):
 *
 *     oclusión      2 s     3 s     4 s     6 s     8 s    12 s
 *     SC-17        0,111   0,080   0,057   0,029   0,015   0,004   (tau 2,7 s; resto 0,30 / 0,22 / 0,15 / 0,08 / 0,04)
 *     SC-14        0,240   0,123   0,063   0,017   0,004   0,000   (tau 1,3 s; resto 0,31 / 0,16 / 0,08 / 0,02 / 0,01)
 *     un compartim. 0,000   0,000   0,000   0,000   0,000   0,000
 *
 * 0,04 deja el resto por debajo de 0,1 cmH2O —la cifra que la pantalla muestra— en ese rango de tau: los pulmones que
 * vacían rápido siguen dando una PEEP total válida a los 2 s, y los que redistribuyen despacio exigen 6 s, que es lo
 * que de verdad tardan. Con 0,45 se certificaba a los 2 s una PEEPi de 0,33 cuando la real era 0,63.
 */
export const PLATEAU_DRIFT_RATE_EXP_CMH2O_S = 0.04;
/** Tramo final sobre el que se mide la deriva. Fijo a propósito: ver `PLATEAU_DRIFT_RATE_CMH2O_S`. */
export const PLATEAU_TAIL_S = 0.5;
/** Excursión contra la tendencia que delata una perturbación (esfuerzo, fuga, oscilación) en cmH2O. */
export const PLATEAU_REVERSAL_CMH2O = 0.3;
/**
 * Bondad mínima del ajuste de la rama espiratoria para dar por buena una constante de tiempo (P). Medido sobre los
 * escenarios, con la ventana del 5 % al 95 % de lo espirado: un compartimento lineal y el obstructivo de SC-03 dan
 * 1,0000; la espiración estrangulada de SC-16 da 0,9838 y el tejido viscoelástico de SC-14, 0,9840. 0,99 separa el
 * vaciamiento que sí es una exponencial de los dos que no lo son.
 */
export const TAU_EXP_MIN_R2 = 0.99;
/**
 * Tramo del vaciado sobre el que se ajusta la recta, en fracción de lo espirado. Ancho a propósito: la curvatura que
 * delata un vaciamiento que no es una sola exponencial vive en los extremos, y un tramo central estrecho la esconde
 * —con el 25-75 % la espiración estrangulada de SC-16 ajustaba a 0,9987 y pasaba por buena—. Se recortan las puntas
 * porque el principio lo ensucia la apertura de la válvula y el final, una señal que tiende a cero.
 */
export const TAU_EXP_FIT_FROM = 0.05;
export const TAU_EXP_FIT_TO = 0.95;
/** Tope de flujo del actuador virtual en PC (L/s): 160 L/min, D ficha 2014 (flujo inspiratorio adulto 2–160 L/min). */
export const ACTUATOR_MAX_FLOW_LPS = 160 / 60;
/**
 * Tope de flujo espiratorio (L/s): la conductancia máxima de la válvula y de la rama espiratoria con la válvula
 * abierta del todo. No existía, y sin él la espiración no tenía ningún límite de máquina: con resistencia muy baja y
 * un gradiente alto el modelo llegaba a −2949 L/min, que ninguna tubuladura deja pasar. El valor es P: la ficha
 * documenta el rango inspiratorio (2–160 L/min) y no el espiratorio, así que se toma un techo por encima de todo lo
 * fisiológico (el escenario más obstructivo del simulador llega a −149 L/min) para que sólo actúe en lo irreal (U-50).
 */
export const EXP_MAX_FLOW_LPS = -200 / 60;
/** Flujo de base espiratorio por omisión (D rango 2–10 L/min ficha 2014; valor inicial P). Ajustable en `settings.biasFlow`. */
export const EXP_BIAS_FLOW_LPS = 2 / 60;
/** Apertura de la válvula espiratoria por omisión (ms): dentro del rango habitual de 20–50 ms (P, U-42). */
export const DEFAULT_EXP_VALVE_OPEN_MS = 40;
/** Resistencia equivalente de la válvula cerrada (cmH2O·s/L): el flujo arranca casi en cero al abrirse. */
const VALVE_CLOSED_R = 200;

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

interface BreathAccum {
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

interface HoldRun {
  req: HoldRequest;
  tStart: number;
  pawStart: number;
  samples: { t: number; paw: number }[];
  pmaxHit: boolean;
  peepeBefore: number;
}

const EPS = 1e-9;
const INSP_PHASES: ReadonlySet<ControllerPhase> = new Set(['inspFlow', 'inspLimited', 'inspPause', 'inspPressure', 'inspSupport']);

/**
 * Controlador de respiración A/C VC (P · dossier §13), familia de temporización «I:E, control de flujo apagado»
 * (D ficha 2014 «Familias de modos»; O en P1/P3 por la tecla I:E).
 * - Inspiración: fuente de flujo constante Q = VT/Tflow; integra V con el flujo REAL.
 * - Plimit (D JB72469XX): al alcanzarlo, el flujo se reduce para mantener Plimit el tiempo inspiratorio restante.
 * - Pmáx (D dossier [04] QRG SW10; corroborado por JB79437XX): alcanzarlo termina la inspiración y registra la causa.
 * - Pausa: oclusión (Q = 0); Pplat de ciclo sólo con pausa ≥ 0.1 s y meseta estable (P).
 * - Espiración: fuente de presión a PEEP; vaciamiento resuelto por la mecánica (auto-PEEP emergente).
 * - Bloqueos: fases ocluidas con resultado, calidad y hora (procedimiento, no dato regenerado).
 * Las transiciones se difieren al final de cada sub-paso para que la contabilidad de la respiración sea exacta.
 */
export class VcController {
  phase: ControllerPhase = 'standby';
  settings: VcSettings;
  pending: Partial<VcSettings> | null = null;
  timing: DerivedTiming;
  paw = 0;
  q = 0;
  simT = 0;
  /** Último PEEPe medido al final de una espiración (cmH2O). */
  lastPeepe: number | null = null;
  private tPhase = 0;
  private tBreath = 0;
  private breathSeq = 0;
  private breath: BreathAccum | null = null;
  private holdRequest: HoldRequest | null = null;
  /** Última Pva de una espiración SIN ocluir: es la PEEPe de referencia de la respiración siguiente. */
  private lastExpPaw: number | null = null;
  private hold: HoldRun | null = null;
  private manualRequested = false;
  /** Disparo detectado y pendiente de servir cuando pase el retardo de respuesta. */
  private triggerPending: { atS: number; next: BreathType } | null = null;
  /** CPAP/PS: se declaró apnea y el ventilador está entregando respaldo hasta que el paciente vuelva a disparar. */
  private apnea = false;
  private events: ControllerEvent[] = [];
  private transition: (() => void) | null = null;

  constructor(
    private readonly patient: PatientModel,
    private readonly effort: EffortGenerator,
    settings: VcSettings,
  ) {
    this.settings = { ...settings };
    this.timing = deriveVcTiming(this.settings);
  }

  drainEvents(): ControllerEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  get currentBreathId(): string | null {
    return this.breath?.breathId ?? null;
  }
  get currentBreathSequence(): number {
    return this.breathSeq;
  }
  get peepTarget(): number {
    return this.settings.peep === 'off' ? 0 : this.settings.peep;
  }
  get currentPpeak(): number | null {
    if (!this.breath) return null;
    return Number.isFinite(this.breath.ppeak) ? this.breath.ppeak : null;
  }
  get holdState(): { kind: HoldKind; procedureId: string; phase: 'queued' | 'running'; elapsedS: number; durationS: number } | null {
    if (this.hold)
      return {
        kind: this.hold.req.kind,
        procedureId: this.hold.req.procedureId,
        phase: 'running',
        elapsedS: this.tPhase,
        durationS: this.hold.req.durationS,
      };
    if (this.holdRequest)
      return {
        kind: this.holdRequest.kind,
        procedureId: this.holdRequest.procedureId,
        phase: 'queued',
        elapsedS: 0,
        durationS: this.holdRequest.durationS,
      };
    return null;
  }

  /** Aplica cambios: Pmáx y FiO2 de inmediato (P); el resto queda pendiente hasta la siguiente respiración (P, U-06). */
  applySettings(changes: Partial<VcSettings>): void {
    const immediate: Partial<VcSettings> = {};
    const deferred: Partial<VcSettings> = {};
    for (const [k, v] of Object.entries(changes) as [keyof VcSettings, unknown][]) {
      if (k === 'pmax' || k === 'fio2') (immediate as Record<string, unknown>)[k] = v;
      else (deferred as Record<string, unknown>)[k] = v;
    }
    if (Object.keys(immediate).length) {
      this.settings = { ...this.settings, ...immediate };
      this.events.push({ type: 'settingsApplied', changes: immediate, simTimeS: this.simT, breathId: this.breath?.breathId ?? '' });
    }
    if (Object.keys(deferred).length) {
      this.pending = { ...(this.pending ?? {}), ...deferred };
      if (this.phase === 'standby') this.flushPending('');
    }
  }

  private flushPending(breathId: string): void {
    if (!this.pending) return;
    const changes = this.pending;
    this.pending = null;
    this.settings = { ...this.settings, ...changes };
    this.timing = deriveVcTiming(this.settings);
    this.events.push({ type: 'settingsApplied', changes, simTimeS: this.simT, breathId });
  }

  startVentilation(): void {
    // Al salir de espera el ventilador presuriza el circuito a PEEP antes de la primera respiración (P: instantáneo).
    // Si no, el pulmón quedaría a presión ambiente mientras la interfaz declara PEEP, y la primera Cstat saldría falsa.
    if (this.phase === 'standby') this.patient.equilibrateTo(this.peepTarget);
    this.paw = this.peepTarget;
    this.lastExpPaw = this.peepTarget;
    if (this.phase !== 'standby') return;
    if (this.settings.mode === 'CPAP_PS') {
      // Sin frecuencia programada no hay respiración que entregar: se espera al disparo del paciente o al respaldo.
      this.esperarDisparo();
      return;
    }
    this.startBreath('mandatory');
  }

  /** CPAP/PS: espiración sin respiración en curso, a la espera del paciente; los temporizadores de respaldo corren desde aquí. */
  private esperarDisparo(): void {
    this.triggerPending = null;
    this.breath = null;
    this.phase = 'exp';
    this.tPhase = 0;
    this.tBreath = 0;
  }

  enterStandby(): void {
    if (this.phase === 'standby') return;
    if (this.hold) this.finishHold(true, false, 'standby');
    this.holdRequest = null;
    this.manualRequested = false;
    this.breath = null; // la respiración en curso se descarta (causa standby); no se registra como completa
    this.apnea = false;
    this.triggerPending = null;
    this.phase = 'standby';
    this.tPhase = 0;
    this.paw = 0;
    this.q = 0;
  }

  requestHold(req: HoldRequest): { accepted: boolean; reason?: string } {
    if (this.phase === 'standby') return { accepted: false, reason: 'En espera: no hay ventilación' };
    if (this.hold || this.holdRequest) return { accepted: false, reason: 'Ya hay un bloqueo en cola o en curso' };
    this.holdRequest = req;
    return { accepted: true };
  }

  /** Cancelación idempotente: sin bloqueo en cola ni en curso no hace nada y devuelve false. */
  cancelHold(): boolean {
    if (this.hold) {
      this.finishHold(true, true);
      return true;
    }
    if (this.holdRequest) {
      this.holdRequest = null;
      return true;
    }
    return false;
  }

  requestManualBreath(): { accepted: boolean; reason?: string } {
    if (this.phase === 'standby') return { accepted: false, reason: 'En espera: no hay ventilación' };
    if (this.phase !== 'exp') return { accepted: false, reason: 'Sólo elegible durante la espiración (P)' };
    if (this.hold || this.holdRequest) return { accepted: false, reason: 'Bloqueo en cola o en curso' };
    this.manualRequested = true;
    return { accepted: true };
  }

  /**
   * Muestras de los instantes en que se resolvió un evento dentro del paso fijo. El anillo de la curva sólo guarda una
   * muestra por paso, al final, así que un cruce de Pmáx o de Plimit a mitad de paso quedaba fuera del dibujo: la
   * métrica Ppico publicaba un valor que no aparecía en ninguna muestra de la pantalla. Con Pmáx 7 y PEEP 5 el equipo
   * mostraba Ppico 7 con la curva plana en 5. Aquí se recogen esos instantes para que el simulador los dibuje.
   */
  readonly substepSamples: { tS: number; paw: number; q: number; vAbsL: number }[] = [];

  /** Avanza un paso fijo dt (s). Los eventos programados se resuelven con sub-pasos exactos. */
  step(dt: number): void {
    this.substepSamples.length = 0;
    let remaining = dt;
    let guard = 0;
    while (remaining > EPS && guard++ < 128) {
      if (guard === 128) {
        this.events.push({ type: 'stepGuardExhausted', simTimeS: this.simT, phase: this.phase });
        this.simT += remaining;
        break;
      }
      const tEvent = this.timeToScheduledEvent();
      const h = Math.min(remaining, tEvent);
      const used = this.integrate(h);
      this.account(used);
      remaining -= used;
      // Sólo los cortes interiores: el final del paso lo publica el simulador como muestra regular.
      if (remaining > EPS) this.substepSamples.push({ tS: this.simT, paw: this.paw, q: this.q, vAbsL: this.patient.vTotal });
      if (this.transition) {
        const fn = this.transition;
        this.transition = null;
        fn();
        continue;
      }
      if (this.timeToScheduledEvent() <= EPS) this.onScheduledEvent();
    }
  }

  /** Contabilidad exacta del sub-paso integrado sobre la fase y la respiración vigentes. */
  private account(used: number): void {
    this.simT += used;
    this.tPhase += used;
    if (INSP_PHASES.has(this.phase)) this.tBreath += used;
    const b = this.breath;
    if (!b) return;
    b.pawIntegral += this.paw * used;
    if (this.phase === 'exp' || this.phase === 'holdExp') b.tExpActual += used;
    else if (INSP_PHASES.has(this.phase)) b.tInspActual += used;
    if (INSP_PHASES.has(this.phase)) {
      b.ppeak = Math.max(b.ppeak, this.paw);
      // Energía entregada: presión de vía aérea por el volumen que entra en este sub-paso (Gattinoni 2016 define la
      // potencia mecánica como esa integral por la frecuencia). El gas que sale por la válvula durante una
      // inspiración por presión (flujo negativo) no cuenta: no es trabajo sobre el pulmón.
      if (this.q > 0) b.energyInsp += this.paw * this.q * used;
    }
    // Mientras entra gas se va guardando el par (Paw, Q) del instante. Cuando la fase deja de dar flujo, lo último
    // guardado es exactamente lo que había justo antes de ocluir, que es lo que la resistencia necesita: el salto de
    // presión que desaparece al parar el flujo, dividido por ese flujo.
    if (this.phase === 'inspFlow' || this.phase === 'inspLimited' || this.phase === 'inspPressure' || this.phase === 'inspSupport') {
      b.pawAtFlowEnd = this.paw;
      b.qAtFlowEnd = this.q;
    }
    // Espiración: el par (volumen que queda, flujo que sale). En un vaciamiento pasivo de un compartimento son
    // proporcionales, y la constante de proporcionalidad es el tiempo que tarda en salir el 63 %.
    if (this.phase === 'exp') {
      b.expSamples.push({ vAbsL: this.patient.vTotal, qLps: this.q });
      if (Math.abs(this.pmusAt(this.simT)) > 0.05) b.effortInExp = true;
    }
  }

  private timeToScheduledEvent(): number {
    const t = this.timing;
    switch (this.phase) {
      case 'inspFlow':
        return Math.max(0, t.tFlowS - this.tBreath);
      case 'inspLimited':
        return Math.max(0, t.tInspS - this.tBreath);
      case 'inspPause':
        return Math.max(0, t.tInspS - this.tBreath);
      case 'inspPressure':
      case 'inspSupport':
        return Math.max(0, (this.breath?.tInspTargetS ?? t.tInspS) - this.tBreath);
      case 'holdInsp':
      case 'holdExp':
        return Math.max(0, (this.hold?.req.durationS ?? 0) - this.tPhase);
      // El temporizador de FR gobierna la siguiente obligatoria: el tiempo no usado por una inspiración acortada (Pmáx) va a la espiración (P).
      case 'exp': {
        const pendiente = this.triggerPending
          ? Math.max(0, this.triggerPending.atS + TRIGGER_DELAY_S - this.simT)
          : Number.POSITIVE_INFINITY;
        const plazo = this.settings.mode === 'CPAP_PS' ? this.plazoDeRespaldo() : t.tCycleS;
        return Math.min(pendiente, Math.max(0, plazo - this.tBreath - this.tPhase));
      }
      default:
        return Number.POSITIVE_INFINITY;
    }
  }

  private pmusAt = (tS: number): number => this.effort.pmusAt(tS);

  /** Integra hasta h segundos en la fase actual; devuelve el tiempo efectivamente integrado (menor si hubo cruce de umbral). */
  private integrate(h: number): number {
    const p = this.patient;
    const s = this.settings;
    switch (this.phase) {
      case 'standby': {
        const { qEnd } = p.integratePressureSource(0, this.pmusAt, this.simT, h);
        this.paw = 0;
        this.q = qEnd;
        return h;
      }
      case 'inspFlow': {
        const qCmd = this.timing.qTargetLps;
        const paw0 = p.pawForFlow(qCmd, this.pmusAt(this.simT), p.v);
        const paw1 = p.pawForFlow(qCmd, this.pmusAt(this.simT + h), p.v + qCmd * h);
        const { frac, hit } = thresholdCrossing(paw0, paw1, s.plimit, s.pmax);
        const used = Math.max(0, Math.min(h, frac * h));
        const { dV } = p.integrateFlowSource(qCmd, used, this.pmusAt(this.simT));
        if (this.breath) this.breath.vtInsp += dV;
        this.q = qCmd;
        this.paw = p.pawForFlow(qCmd, this.pmusAt(this.simT + used), p.v);
        if (this.breath && used > 0) {
          this.breath.flowSamples.push({ t: this.tBreath, paw: this.paw });
          if (Math.abs(this.pmusAt(this.simT)) > 0.05) this.breath.effortInFlow = true;
        }
        // En el instante del cruce la presión de vía aérea es exactamente el umbral: la válvula actúa allí (no se registra
        // la presión hipotética que habría producido el flujo completo).
        if (hit === 'pmax') {
          this.paw = s.pmax;
          this.transition = () => this.onPmax();
        } else if (hit === 'plimit') {
          this.paw = s.plimit;
          this.transition = () => this.onPlimit();
        }
        return used;
      }
      case 'inspPressure':
      case 'inspSupport': {
        // A/C PC (D JB72469XX: presión objetivo = PEEP + Pinsp; alto flujo inicial que decae; rampa D ficha 2014, forma lineal P).
        // CPAP/PS: la misma fuente de presión con PEEP + PS (D ficha 2014), ciclada por la caída del flujo (más abajo).
        const rise = s.riseMs / 1000;
        const pAbove = this.breath?.pAbove ?? s.pinsp;
        const targetAt = (tb: number): number => this.peepTarget + pAbove * (rise > 0 ? Math.min(1, tb / rise) : 1);
        const tb0 = this.tBreath;
        const nSub = rise > 0 && tb0 < rise ? Math.max(1, Math.ceil(h / 0.001)) : 1;
        let dVtot = 0;
        let qLast = 0;
        let pawLast = targetAt(tb0 + h);
        const hs = h / nSub;
        let dVexp = 0;
        for (let i = 0; i < nSub; i++) {
          const tb = tb0 + (i + 1) * hs;
          const tg = targetAt(tb);
          // Fuente de presión con tope de flujo del actuador dentro del integrador: si el tope actúa, la presión queda por debajo del objetivo.
          const { dV, qEnd, clamped } = p.integratePressureSource(tg, this.pmusAt, this.simT + i * hs, hs, false, ACTUATOR_MAX_FLOW_LPS);
          if (dV >= 0) dVtot += dV;
          else dVexp -= dV; // flujo negativo (válvula espiratoria activa tras bajar la PEEP): cuenta como espirado, nunca VTi negativo
          qLast = qEnd;
          pawLast = clamped ? p.pawForFlow(qEnd, this.pmusAt(this.simT + (i + 1) * hs), p.v) : tg;
        }
        if (this.breath) {
          this.breath.vtInsp += dVtot;
          this.breath.vtExp += dVexp;
        }
        this.q = qLast;
        this.paw = pawLast;
        if (this.paw >= s.pmax) this.transition = () => this.onPmax();
        else if (this.phase === 'inspSupport' && this.breath) {
          // Ciclado por flujo (D ficha 2014 «Trigger Espiratorio: % de flujo pico»): pasada la rampa se registra el flujo pico y
          // la inspiración termina cuando el flujo ya cayó al porcentaje programado. Con el flujo aún subiendo no hay pico
          // que comparar; el tope de tiempo (SUPPORT_TI_MAX_S) lo pone el temporizador de la fase.
          const b = this.breath;
          if (tb0 + h >= rise) b.qPeak = Math.max(b.qPeak, qLast);
          if (b.qPeak > 1e-6 && qLast < b.qPeak - 1e-9 && qLast <= s.expTriggerPct * b.qPeak)
            this.transition = () => this.endInspiration('flow');
        }
        return h;
      }
      case 'inspLimited': {
        const qCheck = p.flowForPaw(s.plimit, this.pmusAt(this.simT), p.v);
        if (qCheck <= 0) {
          // La válvula inspiratoria no admite flujo negativo: sistema ocluido. Misma física que una pausa, así que
          // el elemento viscoelástico relaja y el gas se redistribuye igual que allí.
          this.q = 0;
          p.integrateFlowSource(0, h, this.pmusAt(this.simT));
          this.paw = p.hasSecond ? p.nodePressureForFlow(0, this.pmusAt(this.simT + h)) : p.pel() - this.pmusAt(this.simT + h);
          if (this.paw >= s.pmax) {
            this.transition = () => this.onPmax();
            return 0;
          }
          return h;
        }
        const { dV, qEnd } = p.integratePressureSource(s.plimit, this.pmusAt, this.simT, h, true); // válvula de un solo sentido: Q ≥ 0
        if (this.breath) this.breath.vtInsp += dV;
        this.q = qEnd;
        this.paw = s.plimit;
        return h;
      }
      case 'inspPause':
      case 'holdInsp':
      case 'holdExp': {
        this.q = 0;
        p.integrateFlowSource(0, h, this.pmusAt(this.simT)); // oclusión: el volumen total no cambia, pero el elemento viscoelástico relaja y el gas se redistribuye entre unidades
        // Con dos unidades la presión de la vía aérea es la del NODO (media ponderada por conductancias), no la de una de ellas.
        this.paw = p.hasSecond ? p.nodePressureForFlow(0, this.pmusAt(this.simT + h)) : p.pel() - this.pmusAt(this.simT + h);
        if (this.phase === 'inspPause' && this.breath) this.breath.pauseSamples.push({ t: this.tPhase + h, paw: this.paw });
        if (this.hold) {
          this.hold.samples.push({ t: this.tPhase + h, paw: this.paw });
          if (this.paw >= s.pmax) this.hold.pmaxHit = true;
        }
        if (this.phase === 'inspPause' && this.paw >= s.pmax) this.transition = () => this.onPmax();
        return h;
      }
      case 'exp': {
        const peep = this.peepTarget;
        // La válvula espiratoria mantiene la PEEP hasta el flujo de base programado (D 2–10 L/min); un esfuerzo mayor hunde la Pva.
        // La rama espiratoria + válvula añaden una resistencia en serie (D techo ≤ 6 cmH2O a 60 L/min; valor P): la Pva en la pieza en Y
        // queda por encima de PEEP mientras sale gas, proporcional al flujo espiratorio.
        const rValve = p.params.rExpValve ?? 0;
        const tOpen = Math.max(0, (p.params.expValveOpenMs ?? DEFAULT_EXP_VALVE_OPEN_MS) / 1000);
        let dV = 0,
          qEnd = 0,
          clamped = false,
          rNow = rValve;
        if (this.tPhase < tOpen) {
          // La válvula se abre progresivamente: su resistencia decae desde la de cerrada hasta la de la rama.
          // El flujo arranca casi nulo y la Pva parte de la presión alveolar, en vez de saltar a la PEEP.
          const nSub = Math.max(1, Math.ceil(h / 0.001));
          const hs = h / nSub;
          for (let i = 0; i < nSub; i++) {
            const u = Math.max(0, 1 - (this.tPhase + (i + 0.5) * hs) / tOpen);
            rNow = rValve + VALVE_CLOSED_R * u * u;
            const r = p.integratePressureSource(peep, this.pmusAt, this.simT + i * hs, hs, false, s.biasFlow, rNow, EXP_MAX_FLOW_LPS);
            dV += r.dV;
            qEnd = r.qEnd;
            clamped = r.clamped;
          }
        } else {
          const r = p.integratePressureSource(peep, this.pmusAt, this.simT, h, false, s.biasFlow, rValve, EXP_MAX_FLOW_LPS);
          dV = r.dV;
          qEnd = r.qEnd;
          clamped = r.clamped;
        }
        if (this.breath) this.breath.vtExp += Math.max(0, -dV);
        this.q = qEnd;
        this.paw = clamped ? p.pawForFlow(qEnd, this.pmusAt(this.simT + h), p.v) + rNow * qEnd : peep - rNow * qEnd;
        this.lastExpPaw = this.paw;
        if (this.manualRequested) {
          // La orden explícita del usuario tiene precedencia sobre un disparo simultáneo (P); nunca queda pendiente para otra respiración.
          this.manualRequested = false;
          this.transition = () => this.endExpiration('manual');
        } else if (
          !this.triggerPending &&
          (s.assistControl || s.mode === 'CPAP_PS') &&
          this.tPhase + h >= TRIGGER_REFRACTORY_S &&
          (s.triggerByPressure ? this.paw <= peep + s.pressureTrigger : qEnd >= s.flowTrigger)
        ) {
          // Detectado: la respiración empieza cuando pase el retardo de respuesta; mientras tanto la espiración sigue y el
          // paciente tira del flujo de base. En CPAP/PS el disparo abre una respiración del paciente (soporte); en A/C, una asistida.
          this.triggerPending = { atS: this.simT + h, next: s.mode === 'CPAP_PS' ? 'spontaneous' : 'assisted' };
          this.events.push({ type: 'trigger', breathId: this.breath?.breathId ?? '', simTimeS: this.simT + h, qLps: qEnd });
        }
        return h;
      }
      default:
        return h;
    }
  }

  private onPlimit(): void {
    if (!this.breath) return;
    this.breath.plimitReached = true;
    this.events.push({ type: 'plimitReached', breathId: this.breath.breathId, simTimeS: this.simT, paw: this.paw });
    this.phase = 'inspLimited';
  }

  private onPmax(): void {
    if (!this.breath) return;
    this.breath.pmaxReached = true;
    this.events.push({ type: 'pmaxReached', breathId: this.breath.breathId, simTimeS: this.simT, paw: this.paw });
    this.endInspiration('pmax');
  }

  private onScheduledEvent(): void {
    switch (this.phase) {
      case 'inspFlow':
        if (this.timing.tPauseS > EPS) {
          this.phase = 'inspPause';
          this.tPhase = 0;
        } else this.endInspiration('time');
        break;
      case 'inspLimited':
      case 'inspPause':
      case 'inspPressure':
        this.endInspiration('time');
        break;
      case 'inspSupport':
        this.endInspiration('tiMax'); // el flujo no cayó al umbral: el tope de tiempo del soporte corta la inspiración (P)
        break;
      case 'holdInsp':
        this.finishHold(false);
        break;
      case 'exp':
        // Un disparo pendiente se sirve al vencer su retardo; si el temporizador del modo llega antes, la respiración es igualmente del paciente.
        if (this.triggerPending) {
          const pendiente = this.triggerPending;
          this.triggerPending = null;
          this.endExpiration(pendiente.next);
        } else if (this.settings.mode === 'CPAP_PS') this.onPlazoDeRespaldo();
        else this.endExpiration('mandatory');
        break;
      case 'holdExp':
        this.finishHold(false);
        break;
      default:
        break;
    }
  }

  /**
   * CPAP/PS: segundos desde el inicio de la última respiración (o de la ventilación) tras los que el ventilador respira por
   * el paciente: la frecuencia mínima si está programada, el tiempo de apnea, y durante la apnea la cadencia del respaldo.
   */
  private plazoDeRespaldo(): number {
    const s = this.settings;
    const minimo = s.minRate === 'off' ? Number.POSITIVE_INFINITY : 60 / s.minRate;
    return Math.min(minimo, this.apnea ? 60 / APNEA_BACKUP_RATE_PER_MIN : s.apneaTimeS);
  }

  /** Venció un plazo de la espiración en CPAP/PS: apnea (alarma y respaldo) o frecuencia mínima (respiración por presión). */
  private onPlazoDeRespaldo(): void {
    const elapsed = this.tBreath + this.tPhase;
    const plazoApnea = this.apnea ? 60 / APNEA_BACKUP_RATE_PER_MIN : this.settings.apneaTimeS;
    if (elapsed + EPS >= plazoApnea) {
      if (!this.apnea) {
        this.apnea = true;
        this.events.push({ type: 'apnea', simTimeS: this.simT, apneaS: this.settings.apneaTimeS });
      }
      this.endExpiration('backup');
    } else this.endExpiration('mandatory');
  }

  private endInspiration(cause: CyclingCause): void {
    const b = this.breath;
    if (b) {
      if (this.phase === 'inspPause') this.evaluateCyclePlateau(b);
      else if (this.phase === 'inspPressure' || this.phase === 'inspSupport')
        b.pplatReason = 'noOcclusion'; // en PC y en soporte el fin de inspiración no es una meseta válida sin oclusión (dossier §11)
      else if (b.pplatCycle === null && b.pplatReason === null)
        b.pplatReason = b.plimitReached && this.timing.tPauseS > EPS ? 'plimitReached' : 'noPause';
      if (cause === 'pmax') {
        b.pplatCycle = null;
        b.pplatReason = 'endedByPmax';
      }
      b.cause = cause;
    }
    if (this.holdRequest?.kind === 'inspHold') {
      if (cause === 'pmax') {
        const req = this.holdRequest;
        this.holdRequest = null;
        this.events.push({
          type: 'rejected',
          what: `hold:${req.procedureId}`,
          reason: 'Inspiración terminada por Pmáx: bloqueo no elegible (P)',
          simTimeS: this.simT,
        });
      } else {
        this.beginHold();
        return;
      }
    }
    this.phase = 'exp';
    this.tPhase = 0;
  }

  /** Fin de la espiración: registra PEEPe y encadena bloqueo espiratorio o nueva respiración. */
  private endExpiration(next: BreathType): void {
    if (this.breath) this.breath.peepeEnd = this.paw;
    if (this.apnea && (next === 'spontaneous' || next === 'assisted')) {
      this.apnea = false;
      this.events.push({ type: 'apneaEnded', simTimeS: this.simT, breathId: `b${this.breathSeq + 1}` });
    }
    // El bloqueo espiratorio en cola ocluye al final de la espiración, la termine el temporizador, un disparo o una orden manual (P):
    // con esfuerzo la meseta será inestable y el resultado inválido con motivo, en vez de esperar indefinidamente.
    if (this.holdRequest?.kind === 'expHold') {
      this.beginHold();
      return;
    }
    this.startBreath(next);
  }

  private evaluateCyclePlateau(b: BreathAccum): void {
    const tPause = this.timing.tPauseS;
    if (tPause < MIN_PAUSE_FOR_PPLAT_S) {
      b.pplatCycle = null;
      b.pplatReason = 'pauseTooShort';
      return;
    }
    const q = plateauQuality(b.pauseSamples, tPause);
    if (q === null) {
      b.pplatCycle = null;
      b.pplatReason = 'insufficientSamples';
      return;
    }
    if (q.reversal > PLATEAU_REVERSAL_CMH2O) {
      b.pplatCycle = null;
      b.pplatReason = 'disturbed';
      return;
    }
    if (q.driftRate > PLATEAU_DRIFT_RATE_CMH2O_S) {
      b.pplatCycle = null;
      b.pplatReason = 'unstable';
      return;
    }
    b.pplatCycle = this.paw;
    b.pplatReason = null;
  }

  private beginHold(): void {
    const req = this.holdRequest;
    if (!req || !this.breath) return;
    this.holdRequest = null;
    this.triggerPending = null; // la oclusión anula un disparo detectado: no hay gas que servir
    this.hold = { req, tStart: this.simT, pawStart: this.paw, samples: [], pmaxHit: false, peepeBefore: this.paw };
    this.phase = req.kind === 'inspHold' ? 'holdInsp' : 'holdExp';
    this.tPhase = 0;
    this.events.push({ type: 'holdStarted', procedureId: req.procedureId, kind: req.kind, simTimeS: this.simT });
  }

  private finishHold(cancelled: boolean, resume = true, cancelReason: 'user' | 'standby' | null = cancelled ? 'user' : null): void {
    const hold = this.hold;
    const b = this.breath;
    if (!hold || !b) {
      this.hold = null;
      if (!hold) return;
      this.phase = 'exp';
      this.tPhase = 0;
      return;
    }
    this.hold = null;
    // Una sola evaluación: antes se llamaba dos veces con los mismos argumentos, una por campo.
    const calidad = plateauQuality(hold.samples, this.simT - hold.tStart);
    const outcome: HoldOutcome = {
      procedureId: hold.req.procedureId,
      kind: hold.req.kind,
      breathId: b.breathId,
      startSimTimeS: hold.tStart,
      endSimTimeS: this.simT,
      actualDurationS: this.simT - hold.tStart,
      requestedDurationS: hold.req.durationS,
      pawStart: hold.pawStart,
      pawEnd: this.paw,
      driftRate: calidad?.driftRate ?? Number.POSITIVE_INFINITY,
      reversal: calidad?.reversal ?? Number.POSITIVE_INFINITY,
      pmaxHit: hold.pmaxHit,
      cancelled,
      cancelReason,
      vtInspL: b.vtInsp,
      peepeStart: b.pawStart,
      pawAtFlowEnd: b.pawAtFlowEnd,
      qAtFlowEndLps: b.qAtFlowEnd,
      // Sólo la rampa a flujo constante de VC sirve: en PC el flujo decae y no hay un caudal único que dividir, y si
      // Plimit recortó la entrega la presión dejó de ser la que el flujo pedía. El esfuerzo mete a los músculos en la
      // resta y el resultado ya no es del pulmón.
      constantFlowInsp: b.flowSamples.length > 0 && !b.plimitReached && !b.effortInFlow,
      peepeBeforeOcclusion: hold.peepeBefore,
    };
    this.events.push({ type: 'holdEnded', outcome });
    if (!resume) return; // espera: el llamador fija la fase
    if (hold.req.kind === 'inspHold') {
      this.phase = 'exp';
      this.tPhase = 0;
    } else this.startBreath('mandatory');
  }

  private startBreath(type: BreathType): void {
    const prev = this.breath;
    if (prev) this.finishBreath(prev);
    const breathId = `b${this.breathSeq + 1}`;
    this.triggerPending = null;
    const modeBefore = this.settings.mode;
    this.flushPending(breathId);
    const s = this.settings;
    const cpap = s.mode === 'CPAP_PS';
    if (cpap && modeBefore !== 'CPAP_PS' && type === 'mandatory') {
      // Al cambiar a CPAP/PS, la respiración que iba a entregar el temporizador de A/C no existe en el modo nuevo: se espera al paciente.
      this.esperarDisparo();
      return;
    }
    // Un disparo resuelto en un modo y entregado en otro (el cambio de modo se aplica aquí) lleva el nombre del modo que lo entrega.
    if (cpap && type === 'assisted') type = 'spontaneous';
    else if (!cpap && type === 'spontaneous') type = 'assisted';
    else if (!cpap && type === 'backup') type = 'mandatory';
    this.breathSeq += 1;
    this.breath = {
      breathId,
      sequence: this.breathSeq,
      type,
      startSimT: this.simT,
      vStart: this.patient.v,
      // La PEEPe de la respiración se toma de la espiración sin ocluir: si acaba de terminar un bloqueo espiratorio,
      // `this.paw` todavía es la presión de la oclusión (PEEP total) y contaminaría el ΔP y la Cstat.
      pawStart: this.lastExpPaw ?? this.paw,
      ppeak: -Infinity,
      pawIntegral: 0,
      vtInsp: 0,
      vtExp: 0,
      tInspActual: 0,
      tExpActual: 0,
      plimitReached: false,
      pmaxReached: false,
      pauseSamples: [],
      flowSamples: [],
      pawAtFlowEnd: this.paw,
      qAtFlowEnd: 0,
      expSamples: [],
      effortInExp: false,
      effortInFlow: false,
      pplatCycle: null,
      pplatReason: null,
      peepeEnd: this.paw,
      cause: 'time',
      energyInsp: 0,
      qPeak: 0,
      pAbove: cpap ? (type === 'spontaneous' ? s.psupport : s.backupPinsp) : s.pinsp,
      tInspTargetS: cpap ? (type === 'spontaneous' ? SUPPORT_TI_MAX_S : s.backupTinspS) : this.timing.tInspS,
    };
    this.phase = cpap ? (type === 'spontaneous' ? 'inspSupport' : 'inspPressure') : s.mode === 'AC_PC' ? 'inspPressure' : 'inspFlow';
    this.tPhase = 0;
    this.tBreath = 0;
    this.events.push({
      type: 'breathStart',
      breathId,
      breathType: type,
      simTimeS: this.simT,
      vStartL: this.patient.v,
      v2StartL: this.patient.v2,
    });
  }

  private finishBreath(b: BreathAccum): void {
    const duration = Math.max(EPS, this.simT - b.startSimT);
    this.lastPeepe = b.peepeEnd;
    const record: BreathRecord = {
      breathId: b.breathId,
      sequence: b.sequence,
      type: b.type,
      startSimTimeMs: sToMs(b.startSimT),
      endSimTimeMs: sToMs(this.simT),
      cyclingCause: b.cause,
      ...indiceDeEstres(b),
      ...constanteEspiratoria(b),
      tInspS: b.tInspActual,
      tExpS: b.tExpActual,
      ppeak: b.ppeak,
      pplatCycle: b.pplatCycle,
      pplatCycleReason: b.pplatReason,
      peepe: b.peepeEnd,
      pmean: b.pawIntegral / duration,
      vtInsp: b.vtInsp,
      vtExp: b.vtExp,
      plimitReached: b.plimitReached,
      pmaxReached: b.pmaxReached,
      energyInspJ: b.energyInsp * JOULES_PER_CMH2O_L,
      truthVStartL: b.vStart,
    };
    this.events.push({ type: 'breathEnd', record });
  }
}

/**
 * Cuál de los dos techos de presión actúa dentro de un tramo, y en qué fracción de él.
 *
 * Durante la inspiración a flujo constante la presión sube de forma monótona, así que **gana el umbral que se cruza
 * antes, que es el más bajo**. Vive aparte del `switch` porque es aritmética pura y porque es la jerarquía de
 * seguridad del ventilador: aquí estuvo el peor defecto que ha tenido este proyecto. Se miraba Pmáx primero, sin
 * compararlo con Plimit, y contra la presión que produciría el flujo ORDENADO en vez de la que la máquina dejaría
 * alcanzar; con Plimit 30 y Pmáx 40, subir la resistencia de 69 a 70 cmH2O·s/L pasaba de entregar 314 mL a entregar
 * CERO, porque saltaba Pmáx contra una presión que Plimit habría recortado a 30. Plimit existe para proteger sin
 * dejar de ventilar.
 *
 * Con los dos umbrales iguales gana Pmáx, que es la acción de seguridad: terminar la inspiración.
 *
 * @param paw0 presión de vía aérea al empezar el tramo, con el flujo ordenado
 * @param paw1 la misma al terminarlo
 * @returns `frac` en 0..1 del tramo que se puede integrar antes de que actúe el techo, y cuál actúa (`null` si ninguno)
 */
export function thresholdCrossing(
  paw0: number,
  paw1: number,
  plimit: number,
  pmax: number,
): { frac: number; hit: 'plimit' | 'pmax' | null } {
  const primero = plimit < pmax ? 'plimit' : 'pmax';
  if (paw0 >= Math.min(pmax, plimit)) return { frac: 0, hit: primero };
  let frac = 1;
  let hit: 'plimit' | 'pmax' | null = null;
  const cruce = (umbral: number): number => (paw1 - paw0 > 0 ? (umbral - paw0) / (paw1 - paw0) : 1);
  if (paw1 >= pmax) {
    frac = cruce(pmax);
    hit = 'pmax';
  }
  if (paw1 >= plimit) {
    const f = cruce(plimit);
    if (f < frac) {
      frac = f;
      hit = 'plimit';
    }
  }
  return { frac, hit };
}

/** El índice de estrés de una respiración y, si no lo hay, por qué. La forma sólo habla del pulmón si nadie más la tocó. */
function indiceDeEstres(b: BreathAccum): { stressIndex: number | null; stressIndexReason: string | null } {
  if (b.effortInFlow) return { stressIndex: null, stressIndexReason: 'esfuerzoDuranteLaRampa' };
  if (b.plimitReached || b.pmaxReached) return { stressIndex: null, stressIndexReason: 'presionRecortadaPorElTecho' };
  const v = stressIndex(b.flowSamples);
  return v === null ? { stressIndex: null, stressIndexReason: 'sinRampaAFlujoConstante' } : { stressIndex: v, stressIndexReason: null };
}

/**
 * La constante de tiempo espiratoria de una respiración y, si no la hay, por qué.
 *
 * El umbral de bondad del ajuste es P y es el corazón del asunto: por debajo de 0,98 la rama espiratoria ya no es una
 * recta, y eso significa que el pulmón no se vacía como un solo compartimento. Medido sobre los escenarios: un
 * compartimento lineal da 1,000; el obstructivo SC-03 da 1,000 con tau larga; dos unidades dispares y la espiración
 * estrangulada de SC-16 caen por debajo, que es exactamente lo que esos escenarios enseñan.
 */
function constanteEspiratoria(b: BreathAccum): { tauExpS: number | null; tauExpReason: string | null } {
  if (b.effortInExp) return { tauExpS: null, tauExpReason: 'esfuerzoDuranteLaEspiracion' };
  const r = expiratoryTimeConstant(b.expSamples);
  if (r === null) return { tauExpS: null, tauExpReason: 'espiracionInsuficienteParaAjustar' };
  if (r.r2 < TAU_EXP_MIN_R2) return { tauExpS: null, tauExpReason: 'vaciamientoNoExponencial' };
  return { tauExpS: r.tau, tauExpReason: null };
}

/**
 * Constante de tiempo espiratoria medida sobre la propia rama espiratoria (Brunner, «RCexp»), en segundos.
 *
 * En un vaciamiento pasivo de un compartimento, el flujo que sale es proporcional al volumen que todavía queda por
 * salir: Q = −(V − V∞)/tau. Es decir, la rama espiratoria del bucle flujo-volumen es una RECTA cuya pendiente es
 * −1/tau. No hace falta ninguna oclusión: el número está en la curva que ya se dibuja.
 *
 * Se ajusta sobre el grueso del vaciado, recortando las puntas: el principio lo ensucia la apertura de la válvula y
 * el final, una señal que tiende a cero.
 *
 * Devuelve también la bondad del ajuste. Es lo más docente del asunto: cuando el pulmón NO se vacía como una sola
 * exponencial —un tejido que sigue relajando, o una vía aérea que se estrangula al bajar la presión— la recta deja de
 * ajustar, y eso es un hallazgo, no un fallo de la medición.
 *
 * Lo que este número NO es: la constante del pulmón entero cuando hay dos unidades muy dispares. Si una vacía en dos
 * décimas y la otra en diez segundos, en el tiempo espiratorio disponible sale casi todo por la rápida y la recta
 * ajusta perfectamente: lo medido es la constante de LO QUE SE ESTÁ VACIANDO. Es la misma limitación que tiene la
 * medida de cabecera, y la unidad lenta se delata por otro camino —la meseta que sigue bajando al alargar la oclusión—.
 */
export function expiratoryTimeConstant(muestras: { vAbsL: number; qLps: number }[]): { tau: number; r2: number } | null {
  if (muestras.length < 12) return null;
  const vInicio = (muestras[0] as { vAbsL: number }).vAbsL;
  const vFinal = (muestras[muestras.length - 1] as { vAbsL: number }).vAbsL;
  const espirado = vInicio - vFinal;
  if (!(espirado > 0.02)) return null; // menos de 20 mL: no hay vaciamiento del que sacar una pendiente
  const tramo = muestras.filter((m) => {
    const f = (vInicio - m.vAbsL) / espirado;
    return f >= TAU_EXP_FIT_FROM && f <= TAU_EXP_FIT_TO && m.qLps < 0;
  });
  if (tramo.length < 6) return null;
  // Regresión de Q sobre el volumen que queda: Q = pendiente · restante, con pendiente = −1/tau.
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0,
    syy = 0;
  const n = tramo.length;
  for (const m of tramo) {
    const x = m.vAbsL - vFinal;
    const y = m.qLps;
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
  }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-12) return null;
  const pendiente = (n * sxy - sx * sy) / den;
  if (!(pendiente < -1e-9)) return null; // pendiente no negativa: no es un vaciamiento
  const varY = n * syy - sy * sy;
  const r2 = varY > 1e-12 ? Math.pow(n * sxy - sx * sy, 2) / (den * varY) : 0;
  const tau = -1 / pendiente;
  return Number.isFinite(tau) && tau > 0 ? { tau, r2 } : null;
}

/**
 * Índice de estrés: el exponente b del ajuste Paw(t) = a·t^b + c sobre la rampa de INSPIRACIÓN A FLUJO CONSTANTE
 * (Grasso, Ranieri). Con flujo constante el volumen crece con el tiempo, así que la forma de Paw frente a t es la
 * forma de la presión elástica frente al volumen dentro del volumen corriente:
 *
 *   b ≈ 1  recta: la distensibilidad no cambia mientras entra el volumen
 *   b < 1  cóncava hacia abajo: la distensibilidad MEJORA al insuflar (sigue reclutándose)
 *   b > 1  cóncava hacia arriba: la distensibilidad EMPEORA al insuflar (sobredistensión)
 *
 * El término constante c es la presión al abrirse el flujo, PEEP + R·Q: con flujo constante la caída resistiva no
 * cambia durante la rampa, así que restarla deja sólo el elástico. Con eso el ajuste es una regresión lineal sobre
 * log(Paw − c) frente a log(t), sin iteraciones ni valores iniciales que elegir.
 *
 * Devuelve null cuando la forma no significa lo que se cree: pocas muestras, presión recortada por un techo, o un
 * esfuerzo del paciente durante la rampa —entonces la curva es del paciente y del ventilador, no del pulmón—.
 */
export function stressIndex(muestras: { t: number; paw: number }[]): number | null {
  if (muestras.length < 12) return null;
  const t0 = muestras[0]!.t;
  const c = muestras[0]!.paw;
  const tFin = muestras[muestras.length - 1]!.t - t0;
  if (!(tFin > 0)) return null;
  // Se descarta el primer 10 % del tramo: ahí el logaritmo es singular y el escalón resistivo aún se está formando.
  let n = 0,
    sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (const m of muestras) {
    const t = m.t - t0;
    const y = m.paw - c;
    if (t < 0.1 * tFin || !(y > 1e-6)) continue;
    const lx = Math.log(t),
      ly = Math.log(y);
    n += 1;
    sx += lx;
    sy += ly;
    sxx += lx * lx;
    sxy += lx * ly;
  }
  if (n < 8) return null;
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-12) return null;
  const b = (n * sxy - sx * sy) / den;
  return Number.isFinite(b) ? b : null;
}

/**
 * Estabilidad de meseta (P): máx−mín de Paw en toda la ventana tras un arranque de min(0.5 s, 30 % de la ventana),
 * para que un esfuerzo o una fuga en cualquier punto del bloqueo invaliden el resultado (PRC-02).
 */
export function plateauQuality(samples: { t: number; paw: number }[], windowS: number): { driftRate: number; reversal: number } | null {
  if (samples.length < 2) return null;
  const tFrom = Math.min(0.5, windowS * 0.3);
  const win = samples.filter((s) => s.t >= tFrom - 1e-9);
  if (win.length < 2) return null;
  // Deriva: tasa sobre un tramo final de duración fija. Una relajación todavía cae al principio de la oclusión y eso
  // no la invalida; lo que importa es si la presión ya se asentó cuando se lee la meseta, y eso es una velocidad.
  const tEnd = (win[win.length - 1] as { t: number }).t;
  const tramo = Math.min(PLATEAU_TAIL_S, (tEnd - (win[0] as { t: number }).t) / 2);
  const tail = win.filter((s) => s.t >= tEnd - tramo - 1e-9);
  const usadas = tail.length >= 2 ? tail : win;
  const span = (usadas[usadas.length - 1] as { t: number }).t - (usadas[0] as { t: number }).t;
  let mn = Infinity,
    mx = -Infinity;
  for (const s of usadas) {
    mn = Math.min(mn, s.paw);
    mx = Math.max(mx, s.paw);
  }
  // Excursión contra la tendencia: una relajación (monótona hacia abajo) o un llenado de PEEP total (monótono hacia
  // arriba) dan 0; un esfuerzo, una fuga o una oscilación mueven la presión en ambos sentidos y dan un valor alto.
  let runMin = Infinity,
    runMax = -Infinity,
    maxRise = 0,
    maxFall = 0;
  for (const s of win) {
    runMin = Math.min(runMin, s.paw);
    runMax = Math.max(runMax, s.paw);
    maxRise = Math.max(maxRise, s.paw - runMin);
    maxFall = Math.max(maxFall, runMax - s.paw);
  }
  return { driftRate: span > 1e-9 ? (mx - mn) / span : 0, reversal: Math.min(maxRise, maxFall) };
}
