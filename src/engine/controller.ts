import type { BreathRecord, BreathType, ControllerPhase, CyclingCause, VcSettings } from '../domain/types';
import { deriveVcTiming, type DerivedTiming } from '../domain/validation';
import { sToMs } from '../domain/units';
import type { EffortGenerator } from './effort';
import type { PatientModel } from './patient';

/** Periodo refractario tras el inicio de la espiración antes de admitir disparo (P; inspirado en Texp mínimo 0.25 s, D). */
export const TRIGGER_REFRACTORY_S = 0.25;
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
/** Tramo final sobre el que se mide la deriva. Fijo a propósito: ver `PLATEAU_DRIFT_RATE_CMH2O_S`. */
export const PLATEAU_TAIL_S = 0.5;
/** Excursión contra la tendencia que delata una perturbación (esfuerzo, fuga, oscilación) en cmH2O. */
export const PLATEAU_REVERSAL_CMH2O = 0.3;
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
  /** Última Pva de una espiración SIN ocluir: es la PEEPe de referencia de la respiración siguiente. */
  private lastExpPaw: number | null = null;
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
    // Al salir de espera el ventilador presuriza el circuito a PEEP antes de la primera respiración (P: instantáneo).
    // Si no, el pulmón quedaría a presión ambiente mientras la interfaz declara PEEP, y la primera Cstat saldría falsa.
    if (this.phase === 'standby') this.patient.equilibrateTo(this.peepTarget);
    this.paw = this.peepTarget;
    this.lastExpPaw = this.peepTarget;
    if (this.phase !== 'standby') return;
    this.startBreath('mandatory');
  }

  enterStandby(): void {
    if (this.phase === 'standby') return;
    if (this.hold) this.finishHold(true, false, 'standby');
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
        // Si al empezar el tramo la presión del flujo ordenado ya supera algún umbral, gana el que se cruza ANTES, que
        // es el más bajo: durante la inspiración a flujo constante la presión sube de forma monótona. Antes se miraba
        // Pmáx primero sin comparar, y eso invertía la jerarquía justo donde importa: con Plimit 30 y Pmáx 40, subir la
        // resistencia de 69 a 70 cmH2O·s/L pasaba de entregar 314 mL a entregar CERO, porque se disparaba Pmáx contra
        // una presión que la máquina nunca habría alcanzado — Plimit la habría recortado a 30 antes. Plimit existe para
        // proteger sin dejar de ventilar. Con los dos umbrales iguales gana Pmáx, que es la acción de seguridad.
        if (paw0 >= Math.min(s.pmax, s.plimit)) {
          frac = 0;
          hit = s.plimit < s.pmax ? 'plimit' : 'pmax';
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
        const { dV } = p.integrateFlowSource(qCmd, used, this.pmusAt(this.simT));
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
          s.assistControl &&
          this.tPhase + h >= TRIGGER_REFRACTORY_S &&
          (s.triggerByPressure ? this.paw <= peep + s.pressureTrigger : qEnd >= s.flowTrigger)
        ) {
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
      pplatCycle: null,
      pplatReason: null,
      peepeEnd: this.paw,
      cause: 'time',
    };
    this.phase = this.settings.mode === 'AC_PC' ? 'inspPressure' : 'inspFlow';
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
