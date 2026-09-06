import type { BreathRecord, BreathType, ControllerPhase, CyclingCause, VcSettings } from '../domain/types';
import { deriveVcTiming, type DerivedTiming } from '../domain/validation';
import { sToMs } from '../domain/units';
import type { EffortGenerator } from './effort';
import type { PatientModel } from './patient';

/** Periodo refractario tras el inicio de la espiración antes de admitir disparo (P; inspirado en Texp mínimo 0.25 s, D). */
export const TRIGGER_REFRACTORY_S = 0.25;
/** Duración mínima de pausa para estimar Pplat de ciclo (P). */
export const MIN_PAUSE_FOR_PPLAT_S = 0.1;
/** Estabilidad máxima (máx−mín de Paw en la ventana evaluada) para meseta válida (P). */
export const PLATEAU_STABILITY_CMH2O = 0.5;
/** Tope de flujo del actuador virtual en PC (L/s): 160 L/min, D ficha 2014 (flujo inspiratorio adulto 2–160 L/min). */
export const ACTUATOR_MAX_FLOW_LPS = 160 / 60;

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
  stability: number;
  pmaxHit: boolean;
  cancelled: boolean;
  /** Bloqueo insp: VT inspirado de esa respiración (L) y PEEPe al inicio de la inspiración. */
  vtInspL: number;
  peepeStart: number;
  /** Bloqueo esp: PEEPe medida justo antes de ocluir. */
  peepeBeforeOcclusion: number;
}

export type ControllerEvent =
  | { type: 'breathStart'; breathId: string; breathType: BreathType; simTimeS: number; vStartL: number }
  | { type: 'stepGuardExhausted'; simTimeS: number; phase: ControllerPhase }
  | { type: 'breathEnd'; record: BreathRecord }
  | { type: 'plimitReached'; breathId: string; simTimeS: number; paw: number }
  | { type: 'pmaxReached'; breathId: string; simTimeS: number; paw: number }
  | { type: 'trigger'; breathId: string; simTimeS: number; qLps: number }
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
  pplatCycle: number | null;
  pplatReason: string | null;
  peepeEnd: number;
  cause: CyclingCause;
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
const INSP_PHASES: ReadonlySet<ControllerPhase> = new Set(['inspFlow', 'inspLimited', 'inspPause', 'inspPressure']);

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
  private hold: HoldRun | null = null;
  private manualRequested = false;
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
    if (this.phase !== 'standby') return;
    this.startBreath('mandatory');
  }

  enterStandby(): void {
    if (this.phase === 'standby') return;
    if (this.hold) this.finishHold(true, false);
    this.holdRequest = null;
    this.manualRequested = false;
    this.breath = null; // la respiración en curso se descarta (causa standby); no se registra como completa
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

  /** Avanza un paso fijo dt (s). Los eventos programados se resuelven con sub-pasos exactos. */
  step(dt: number): void {
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
    if (INSP_PHASES.has(this.phase)) b.ppeak = Math.max(b.ppeak, this.paw);
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
        return Math.max(0, t.tInspS - this.tBreath);
      case 'holdInsp':
      case 'holdExp':
        return Math.max(0, (this.hold?.req.durationS ?? 0) - this.tPhase);
      // El temporizador de FR gobierna la siguiente obligatoria: el tiempo no usado por una inspiración acortada (Pmáx) va a la espiración (P).
      case 'exp':
        return Math.max(0, t.tCycleS - this.tBreath - this.tPhase);
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
        let frac = 1;
        let hit: 'plimit' | 'pmax' | null = null;
        if (paw0 >= s.pmax) {
          frac = 0;
          hit = 'pmax';
        } else if (paw0 >= s.plimit) {
          frac = 0;
          hit = 'plimit';
        } else {
          if (paw1 >= s.pmax) {
            frac = (s.pmax - paw0) / (paw1 - paw0);
            hit = 'pmax';
          }
          if (paw1 >= s.plimit) {
            const f = (s.plimit - paw0) / (paw1 - paw0);
            if (f < frac) {
              frac = f;
              hit = 'plimit';
            }
          }
        }
        const used = Math.max(0, Math.min(h, frac * h));
        const { dV } = p.integrateFlowSource(qCmd, used);
        if (this.breath) this.breath.vtInsp += dV;
        this.q = qCmd;
        this.paw = p.pawForFlow(qCmd, this.pmusAt(this.simT + used), p.v);
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
      case 'inspPressure': {
        // A/C PC (D JB72469XX: presión objetivo = PEEP + Pinsp; alto flujo inicial que decae; rampa D ficha 2014, forma lineal P).
        const rise = s.riseMs / 1000;
        const targetAt = (tb: number): number => this.peepTarget + s.pinsp * (rise > 0 ? Math.min(1, tb / rise) : 1);
        const tb0 = this.tBreath;
        const nSub = rise > 0 && tb0 < rise ? Math.max(1, Math.ceil(h / 0.001)) : 1;
        let dVtot = 0;
        let qLast = 0;
        let pawLast = targetAt(tb0 + h);
        const hs = h / nSub;
        for (let i = 0; i < nSub; i++) {
          const tb = tb0 + (i + 1) * hs;
          const tg = targetAt(tb);
          const qFree = p.flowForPaw(tg, this.pmusAt(this.simT + i * hs), p.v);
          if (qFree > ACTUATOR_MAX_FLOW_LPS) {
            // El actuador no alcanza: fuente de flujo al tope; la presión queda por debajo del objetivo.
            const { dV } = p.integrateFlowSource(ACTUATOR_MAX_FLOW_LPS, hs);
            dVtot += dV;
            qLast = ACTUATOR_MAX_FLOW_LPS;
            pawLast = p.pawForFlow(qLast, this.pmusAt(this.simT + (i + 1) * hs), p.v);
          } else {
            const { dV, qEnd } = p.integratePressureSource(tg, this.pmusAt, this.simT + i * hs, hs);
            dVtot += dV;
            qLast = qEnd;
            pawLast = tg;
          }
        }
        if (this.breath) this.breath.vtInsp += dVtot;
        this.q = qLast;
        this.paw = pawLast;
        if (this.paw >= s.pmax) this.transition = () => this.onPmax();
        return h;
      }
      case 'inspLimited': {
        const qCheck = p.flowForPaw(s.plimit, this.pmusAt(this.simT), p.v);
        if (qCheck <= 0) {
          // La válvula inspiratoria no admite flujo negativo: sistema ocluido a presión elástica.
          this.q = 0;
          this.paw = p.pel() - this.pmusAt(this.simT + h);
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
        this.paw = p.pel() - this.pmusAt(this.simT + h);
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
        const { dV, qEnd } = p.integratePressureSource(peep, this.pmusAt, this.simT, h);
        if (this.breath) this.breath.vtExp += Math.max(0, -dV);
        this.q = qEnd;
        this.paw = peep;
        if (this.manualRequested) {
          // La orden explícita del usuario tiene precedencia sobre un disparo simultáneo (P); nunca queda pendiente para otra respiración.
          this.manualRequested = false;
          this.transition = () => this.endExpiration('manual');
        } else if (s.assistControl && this.tPhase + h >= TRIGGER_REFRACTORY_S && qEnd >= s.flowTrigger) {
          const bid = this.breath?.breathId ?? '';
          this.transition = () => {
            this.events.push({ type: 'trigger', breathId: bid, simTimeS: this.simT, qLps: qEnd });
            this.endExpiration('assisted');
          };
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
      case 'holdInsp':
        this.finishHold(false);
        break;
      case 'exp':
        this.endExpiration('mandatory');
        break;
      case 'holdExp':
        this.finishHold(false);
        break;
      default:
        break;
    }
  }

  private endInspiration(cause: CyclingCause): void {
    const b = this.breath;
    if (b) {
      if (this.phase === 'inspPause') this.evaluateCyclePlateau(b);
      else if (this.phase === 'inspPressure')
        b.pplatReason = 'noOcclusion'; // en PC el fin de inspiración no es una meseta válida sin oclusión (dossier §11)
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
    const stab = stabilityOf(b.pauseSamples, tPause);
    if (stab === null) {
      b.pplatCycle = null;
      b.pplatReason = 'insufficientSamples';
      return;
    }
    if (stab > PLATEAU_STABILITY_CMH2O) {
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
    this.hold = { req, tStart: this.simT, pawStart: this.paw, samples: [], pmaxHit: false, peepeBefore: this.paw };
    this.phase = req.kind === 'inspHold' ? 'holdInsp' : 'holdExp';
    this.tPhase = 0;
    this.events.push({ type: 'holdStarted', procedureId: req.procedureId, kind: req.kind, simTimeS: this.simT });
  }

  private finishHold(cancelled: boolean, resume = true): void {
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
      stability: stabilityOf(hold.samples, this.simT - hold.tStart) ?? Number.POSITIVE_INFINITY,
      pmaxHit: hold.pmaxHit,
      cancelled,
      vtInspL: b.vtInsp,
      peepeStart: b.pawStart,
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
    this.breathSeq += 1;
    const breathId = `b${this.breathSeq}`;
    this.flushPending(breathId);
    this.breath = {
      breathId,
      sequence: this.breathSeq,
      type,
      startSimT: this.simT,
      vStart: this.patient.v,
      pawStart: this.paw,
      ppeak: -Infinity,
      pawIntegral: 0,
      vtInsp: 0,
      vtExp: 0,
      tInspActual: 0,
      tExpActual: 0,
      plimitReached: false,
      pmaxReached: false,
      pauseSamples: [],
      pplatCycle: null,
      pplatReason: null,
      peepeEnd: this.paw,
      cause: 'time',
    };
    this.phase = this.settings.mode === 'AC_PC' ? 'inspPressure' : 'inspFlow';
    this.tPhase = 0;
    this.tBreath = 0;
    this.events.push({ type: 'breathStart', breathId, breathType: type, simTimeS: this.simT, vStartL: this.patient.v });
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
      truthVStartL: b.vStart,
    };
    this.events.push({ type: 'breathEnd', record });
  }
}

/**
 * Estabilidad de meseta (P): máx−mín de Paw en toda la ventana tras un arranque de min(0.5 s, 30 % de la ventana),
 * para que un esfuerzo o una fuga en cualquier punto del bloqueo invaliden el resultado (PRC-02).
 */
export function stabilityOf(samples: { t: number; paw: number }[], windowS: number): number | null {
  if (samples.length < 2) return null;
  const tFrom = Math.min(0.5, windowS * 0.3);
  const tail = samples.filter((s) => s.t >= tFrom - 1e-9);
  if (tail.length < 2) return null;
  let mn = Infinity,
    mx = -Infinity;
  for (const s of tail) {
    mn = Math.min(mn, s.paw);
    mx = Math.max(mx, s.paw);
  }
  return mx - mn;
}
