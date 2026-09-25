import type { BreathRecord, BreathType, ControllerPhase, CyclingCause, VcSettings } from '../domain/types';
import { deriveVcTiming, type DerivedTiming } from '../domain/validation';
import { sToMs } from '../domain/units';
import type { EffortGenerator } from './effort';
import type { PatientModel } from './patient';
import {
  expiratoryTimeConstant,
  PLATEAU_DRIFT_RATE_CMH2O_S,
  PLATEAU_REVERSAL_CMH2O,
  plateauQuality,
  stressIndex,
  TAU_EXP_MIN_R2,
} from './breathAnalysis';
import type { BreathAccum, ControllerEvent, HoldKind, HoldOutcome, HoldRequest, HoldRun } from './controllerTypes';
import {
  PEEP_REGULATOR_DROOP_CMH2O_S_L,
  PEEP_REGULATOR_TAU_S,
  thresholdCrossing,
  TRIGGER_MIN_PEEP_DROP_CMH2O,
  TRIGGER_REFRACTORY_S,
  triggerDelayS,
} from './trigger';

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
/** La PEEPe se lee este tiempo antes del disparo detectado (s), P: la muestra aún no lleva la caída del esfuerzo. */
export const PEEPE_PRE_TRIGGER_S = 0.15;
/** Ventana de Paw espiratoria conservada para buscar la PEEPe pre-disparo (s). */
export const PEEPE_TRACE_S = 0.6;
/** Constante de tiempo de la rampa de primer orden como fracción de riseMs: ~95 % del escalón en 3τ (P). */
export const RISE_TIME_TAU_FRACTION = 3;

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
  /** Gas comprimido en el circuito (L): con `circuitCompliance` 0 se queda siempre en 0 y todo es como antes. */
  vCirc = 0;
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
  private triggerPending: { atS: number; next: BreathType; delayS: number } | null = null;
  /** Demanda inspiratoria del paciente que el regulador de PEEP ya compensa (L/s): filtro de su acción integral (U-43). */
  private qDemandFilt = 0;
  /** Muestras (t, Paw) de la espiración en curso: de ahí sale la PEEPe anterior a la caída del esfuerzo. */
  private expPawTrace: { t: number; paw: number }[] = [];
  /** Instante en que se detectó el disparo que terminó la espiración (null si no lo hubo). */
  private lastTriggerDetectedS: number | null = null;
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
    this.qDemandFilt = 0;
    this.expPawTrace = [];
    this.lastTriggerDetectedS = null;
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
    this.qDemandFilt = 0;
    this.expPawTrace = [];
    this.lastTriggerDetectedS = null;
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
          ? Math.max(0, this.triggerPending.atS + this.triggerPending.delayS - this.simT)
          : Number.POSITIVE_INFINITY;
        const plazo = this.settings.mode === 'CPAP_PS' ? this.plazoDeRespaldo() : t.tCycleS;
        return Math.min(pendiente, Math.max(0, plazo - this.tBreath - this.tPhase));
      }
      default:
        return Number.POSITIVE_INFINITY;
    }
  }

  private pmusAt = (tS: number): number => this.effort.pmusAt(tS);

  /**
   * (De)compresión del circuito tras una fase de presión: la presión del nodo fija el objetivo `Cc·Py` y el cambio se
   * reparte a razón del tope del actuador, para que la apertura espiratoria no sea un pico infinito. Devuelve el
   * volumen transferido: el sensor de la máquina lo ve como flujo `delta/h`. No cambia Py (simplificación declarada).
   */
  private circuitTransfer(pyEnd: number, h: number, qOther = 0): number {
    const cc = this.patient.circuitComplianceL;
    if (cc <= 0 || !(h > 0)) return 0;
    // El gas comprimido comparte la válvula con el flujo del pulmón: el flujo total del sensor no supera el tope del
    // actuador, así que la transferencia se recorta al margen que deja qOther (y la descompresión tarda varios pasos).
    const cap = ACTUATOR_MAX_FLOW_LPS * h;
    const delta = Math.max(-cap - qOther * h, Math.min(cap - qOther * h, cc * pyEnd - this.vCirc));
    this.vCirc += delta;
    return delta;
  }

  /**
   * Con el circuito ocluido (pausa o bloqueo), el gas comprimido pasa del circuito al pulmón hasta equilibrar
   * presiones: py tal que `Pel(v + Cc·(py0 − py)) − Pmus = py`. El intercambio es casi instantáneo (tau = R_eq·Cc ≪ h),
   * así que se resuelve por bisección en el primer paso de la oclusión y queda estable después (simplificación
   * declarada: el flujo de transferencia no se dibuja en el sensor).
   */
  private occludeCircuit(h: number): void {
    const cc = this.patient.circuitComplianceL;
    if (cc <= 0 || !(h > 0)) return;
    const p = this.patient;
    const py0 = this.paw;
    const pm = this.pmusAt(this.simT + h);
    const f = (py: number): number => p.equilibratedPressure(p.v + cc * (py0 - py), p.v2) - pm - py;
    let lo = py0 - cc * py0 - 20,
      hi = py0 + 20;
    for (let i = 0; i < 60 && f(lo) < 0; i++) lo -= Math.max(1, Math.abs(lo));
    for (let i = 0; i < 60 && f(hi) > 0; i++) hi += Math.max(1, Math.abs(hi));
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) lo = mid;
      else hi = mid;
    }
    const py = (lo + hi) / 2;
    const dV = cc * (py0 - py);
    if (Math.abs(dV) > 1e-12) {
      p.absorbCompressed(dV);
      this.vCirc = cc * py;
    }
  }

  /** Integra hasta h segundos en la fase actual; devuelve el tiempo efectivamente integrado (menor si hubo cruce de umbral). */
  private integrate(h: number): number {
    const p = this.patient;
    const s = this.settings;
    switch (this.phase) {
      case 'standby': {
        const { qEnd } = p.integratePressureSource(0, this.pmusAt, this.simT, h);
        this.paw = 0;
        this.q = qEnd + this.circuitTransfer(0, h) / h;
        return h;
      }
      case 'inspFlow': {
        const qCmd = this.timing.qTargetLps;
        const cc = p.circuitComplianceL;
        if (cc > 0) {
          // Circuito compresible: el sensor es de la máquina, así que lo ordenado (qCmd) es flujo de pulmón más
          // compresión. El nodo Py resuelve Paw(qPulmón) = Py con qPulmón = qCmd − Cc·(Py − PyPrev)/Δt: función
          // decreciente en Py, raíz única por bisección (los límites se evalúan sobre esa misma Py).
          const pyPrev = this.paw;
          const nodo = (dt: number, vEst: number, pmus: number): number => {
            const f = (py: number): number => p.pawForFlow(qCmd - (cc * (py - pyPrev)) / dt, pmus, vEst) - py;
            let lo = Math.min(pyPrev, p.pel(vEst)) - 30,
              hi = Math.max(pyPrev, p.pel(vEst)) + 80;
            for (let i = 0; i < 60 && f(lo) < 0; i++) lo -= Math.max(1, Math.abs(lo));
            for (let i = 0; i < 60 && f(hi) > 0; i++) hi += Math.max(1, Math.abs(hi));
            for (let i = 0; i < 48; i++) {
              const mid = (lo + hi) / 2;
              if (f(mid) > 0) lo = mid;
              else hi = mid;
            }
            return (lo + hi) / 2;
          };
          const paw0 = nodo(h * 1e-3, p.v, this.pmusAt(this.simT)); // la presión de nodo casi instantánea al entrar el flujo
          const paw1 = nodo(h, p.v + qCmd * h, this.pmusAt(this.simT + h));
          const { frac, hit } = thresholdCrossing(paw0, paw1, s.plimit, s.pmax);
          const used = Math.max(0, Math.min(h, frac * h));
          const py = nodo(Math.max(used, 1e-9), p.v, this.pmusAt(this.simT + used));
          const qLung = qCmd - (cc * (py - pyPrev)) / Math.max(used, 1e-9);
          p.integrateFlowSource(qLung, used, this.pmusAt(this.simT));
          this.vCirc += cc * (py - pyPrev);
          this.paw = py;
          if (this.breath) this.breath.vtInsp += qCmd * used; // VTi de pantalla: lo que entregó la máquina
          this.q = qCmd;
          if (this.breath && used > 0) {
            this.breath.flowSamples.push({ t: this.tBreath, paw: this.paw });
            if (Math.abs(this.pmusAt(this.simT)) > 0.05) this.breath.effortInFlow = true;
          }
          if (hit === 'pmax') {
            this.paw = s.pmax;
            this.transition = () => this.onPmax();
          } else if (hit === 'plimit') {
            this.paw = s.plimit;
            this.transition = () => this.onPlimit();
          }
          return used;
        }
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
        // A/C PC (D JB72469XX: presión objetivo = PEEP + Pinsp; alto flujo inicial que decae; rampa D ficha 2014, forma exponencial P).
        // CPAP/PS: la misma fuente de presión con PEEP + PS (D ficha 2014), ciclada por la caída del flujo (más abajo).
        const rise = s.riseMs / 1000;
        const pAbove = this.breath?.pAbove ?? s.pinsp;
        // Rampa de primer orden: riseMs es el tiempo hasta ~95 % del escalón (3τ), forma P; el equipo real no publica la curva.
        const tauRise = rise / RISE_TIME_TAU_FRACTION; // 0 → escalón
        const targetAt = (tb: number): number => this.peepTarget + pAbove * (rise > 0 ? 1 - Math.exp(-tb / tauRise) : 1);
        const tb0 = this.tBreath;
        const nSub = rise > 0 && tb0 < rise ? Math.max(1, Math.ceil(h / 0.001)) : 1;
        let dVtot = 0;
        let dVLeakTot = 0;
        let qLast = 0;
        let pawLast = targetAt(tb0 + h);
        const hs = h / nSub;
        let dVexp = 0;
        for (let i = 0; i < nSub; i++) {
          const tb = tb0 + (i + 1) * hs;
          const tg = targetAt(tb);
          // Fuente de presión con tope de flujo del actuador dentro del integrador: si el tope actúa, la presión queda por debajo del objetivo.
          const r = p.integratePressureSource(tg, this.pmusAt, this.simT + i * hs, hs, false, ACTUATOR_MAX_FLOW_LPS);
          if (r.dV >= 0) dVtot += r.dV;
          else dVexp -= r.dV; // flujo negativo (válvula espiratoria activa tras bajar la PEEP): cuenta como espirado, nunca VTi negativo
          dVLeakTot += r.dVLeak;
          qLast = r.qEnd + r.qLeakEnd; // lo que mide el ventilador: al pulmón y a la fuga
          pawLast = r.clamped ? r.pyEnd : tg;
        }
        // El circuito compresible también entrega/recoge gas por el sensor de la máquina (la fuente de presión no lo mueve).
        const delta = this.circuitTransfer(pawLast, h);
        if (this.breath) {
          this.breath.vtInsp += dVtot + dVLeakTot + Math.max(0, delta); // VTi de pantalla: lo entregado, fuga incluida
          this.breath.vtExp += dVexp + Math.max(0, -delta);
        }
        this.q = qLast + delta / h;
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
          this.occludeCircuit(h);
          this.paw = p.hasSecond ? p.nodePressureForFlow(0, this.pmusAt(this.simT + h)) : p.pel() - this.pmusAt(this.simT + h);
          if (this.paw >= s.pmax) {
            this.transition = () => this.onPmax();
            return 0;
          }
          return h;
        }
        const { dV, qEnd } = p.integratePressureSource(s.plimit, this.pmusAt, this.simT, h, true); // válvula de un solo sentido: Q ≥ 0
        const delta = this.circuitTransfer(s.plimit, h);
        if (this.breath) {
          this.breath.vtInsp += dV + Math.max(0, delta);
          this.breath.vtExp += Math.max(0, -delta);
        }
        this.q = qEnd + delta / h;
        this.paw = s.plimit;
        return h;
      }
      case 'inspPause':
      case 'holdInsp':
      case 'holdExp': {
        this.q = 0;
        p.integrateFlowSource(0, h, this.pmusAt(this.simT)); // oclusión: el volumen total no cambia, pero el elemento viscoelástico relaja y el gas se redistribuye entre unidades
        this.occludeCircuit(h); // el gas comprimido en el circuito pasa al pulmón y la meseta cae un poco más
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
        // Regulador de PEEP con ancho de banda finito (U-43): si el paciente tira gas (demanda > 0) la fuente no es
        // ideal sino peep + K·demandaYaCompensada con una resistencia extra K. En álgebra, py = peep − rValve·q −
        // K·(q − qFilt): la caída es proporcional a la demanda NO compensada y desaparece en régimen cuando qFilt ≈ q.
        const K = PEEP_REGULATOR_DROOP_CMH2O_S_L;
        const qLibre = p.flowForPaw(peep, this.pmusAt(this.simT), p.v, rValve);
        const pawSrc = qLibre > 0 ? peep + K * this.qDemandFilt : peep,
          rDroop = qLibre > 0 ? K : 0;
        let dV = 0,
          dVLeak = 0,
          qEnd = 0,
          qLeakEnd = 0,
          pyEnd = peep;
        if (this.tPhase < tOpen) {
          // La válvula se abre progresivamente: su resistencia decae desde la de cerrada hasta la de la rama.
          // El flujo arranca casi nulo y la Pva parte de la presión alveolar, en vez de saltar a la PEEP.
          const nSub = Math.max(1, Math.ceil(h / 0.001));
          const hs = h / nSub;
          for (let i = 0; i < nSub; i++) {
            const u = Math.max(0, 1 - (this.tPhase + (i + 0.5) * hs) / tOpen);
            const rNow = rValve + rDroop + VALVE_CLOSED_R * u * u;
            const r = p.integratePressureSource(pawSrc, this.pmusAt, this.simT + i * hs, hs, false, s.biasFlow, rNow, EXP_MAX_FLOW_LPS);
            dV += r.dV;
            dVLeak += r.dVLeak;
            qEnd = r.qEnd;
            qLeakEnd = r.qLeakEnd;
            pyEnd = r.pyEnd;
          }
        } else {
          const r = p.integratePressureSource(pawSrc, this.pmusAt, this.simT, h, false, s.biasFlow, rValve + rDroop, EXP_MAX_FLOW_LPS);
          dV = r.dV;
          dVLeak = r.dVLeak;
          qEnd = r.qEnd;
          qLeakEnd = r.qLeakEnd;
          pyEnd = r.pyEnd;
        }
        // Acción integral del regulador: la demanda ya compensada sigue al flujo que la máquina realmente sirve
        // (q > 0 = hacia el paciente) con τ de 0,1 s. En espiración pasiva decae a 0 y la vía queda como antes.
        const qVent = Math.max(0, qEnd + qLeakEnd);
        this.qDemandFilt += Math.min(1, h / PEEP_REGULATOR_TAU_S) * (qVent - this.qDemandFilt);
        // El gas comprimido en el circuito vuelve por la válvula como un flujo más: lo ve el sensor de la máquina.
        const delta = this.circuitTransfer(pyEnd, h, qEnd + qLeakEnd);
        // VTe de pantalla: lo que vuelve por la válvula espiratoria, que es lo que sale del pulmón menos lo que se va por la fuga.
        if (this.breath) this.breath.vtExp += Math.max(0, -dV - dVLeak) + Math.max(0, -delta);
        // Flujo de pantalla: el del sensor del ventilador, que ve la fuga como si fuera el paciente.
        this.q = qEnd + qLeakEnd + delta / h;
        // La presión mostrada es la del nodo (pieza en Y): con resistencia de rama queda sobre la PEEP mientras sale gas.
        this.paw = pyEnd;
        this.lastExpPaw = this.paw;
        this.expPawTrace.push({ t: this.simT + h, paw: this.paw });
        while (this.expPawTrace.length && (this.expPawTrace[0] as { t: number }).t < this.simT + h - PEEPE_TRACE_S)
          this.expPawTrace.shift();
        if (this.manualRequested) {
          // La orden explícita del usuario tiene precedencia sobre un disparo simultáneo (P); nunca queda pendiente para otra respiración.
          this.manualRequested = false;
          this.transition = () => this.endExpiration('manual');
        } else if (
          !this.triggerPending &&
          (s.assistControl || s.mode === 'CPAP_PS') &&
          this.tPhase + h >= TRIGGER_REFRACTORY_S &&
          // Sin PEEP en el circuito (desconexión, fuga mayor que el flujo de base) no hay disparo que evaluar (P).
          this.paw > peep - TRIGGER_MIN_PEEP_DROP_CMH2O &&
          (s.triggerByPressure ? this.paw <= peep + s.pressureTrigger : this.q >= s.flowTrigger)
        ) {
          // Detectado: la respiración empieza cuando pase el retardo de respuesta; mientras tanto la espiración sigue y el
          // paciente tira del flujo de base. En CPAP/PS el disparo abre una respiración del paciente (soporte); en A/C, una asistida.
          this.triggerPending = {
            atS: this.simT + h,
            next: s.mode === 'CPAP_PS' ? 'spontaneous' : 'assisted',
            // El retardo se congela al detectar: un cambio del tipo de disparo a mitad de espera no lo altera.
            delayS: triggerDelayS(s.triggerByPressure),
          };
          this.lastTriggerDetectedS = this.simT + h;
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

  /**
   * PEEPe al final de la espiración (cmH2O): la PEEPe se toma antes de que el esfuerzo hunda la Pva,
   * como hace el ventilador real (P).
   */
  private peepeAtExpEnd(next: BreathType): number {
    if ((next !== 'spontaneous' && next !== 'assisted') || this.lastTriggerDetectedS === null) return this.paw;
    const tRef = this.lastTriggerDetectedS - PEEPE_PRE_TRIGGER_S;
    let previa: { t: number; paw: number } | null = null;
    for (const m of this.expPawTrace) {
      if (m.t <= tRef) previa = m;
      else break;
    }
    return (previa ?? this.expPawTrace[0] ?? { paw: this.paw }).paw;
  }

  /** Fin de la espiración: registra PEEPe y encadena bloqueo espiratorio o nueva respiración. */
  private endExpiration(next: BreathType): void {
    const peepe = this.peepeAtExpEnd(next);
    if (this.breath) this.breath.peepeEnd = peepe;
    this.lastExpPaw = peepe;
    this.qDemandFilt = 0; // la inspiración corta la demanda que quedara filtrada
    this.expPawTrace = [];
    this.lastTriggerDetectedS = null;
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
    this.qDemandFilt = 0;
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
