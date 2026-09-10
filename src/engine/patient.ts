import type { PatientParams } from '../domain/types';

/** Constante de tiempo viscoelástica por omisión (s) cuando se activa E2 sin declararla. */
export const DEFAULT_TAU_VISC_S = 1.2;
/** Fracción de la capacidad del sigmoide donde se cambia a extensión lineal tangente (evita presiones infinitas). */
const SIGMOID_GUARD = 0.005;

export interface SigmoidPV {
  b: number;
  c: number;
  d: number;
}
/** Desplazamiento que ancla la sigmoide en V(P0) = 0, la convención de volumen del modelo. */
const sigmoidA = (s: SigmoidPV, p0: number): number => -s.b / (1 + Math.exp(-(p0 - s.c) / s.d));
/** Compliance local (pendiente dV/dP) en la fracción u = (V − a)/b de la capacidad. */
const sigmoidSlope = (s: SigmoidPV, u: number): number => (s.b / s.d) * u * (1 - u);
/** Presión a la que la sigmoide alcanza la fracción u de su capacidad. */
const sigmoidAt = (s: SigmoidPV, u: number): number => s.c + s.d * Math.log(u / (1 - u));
/**
 * Volumen de equilibrio a una presión dada: el INVERSO EXACTO de `sigmoidPressure`, prolongación por la tangente
 * incluida. Antes era la sigmoide cruda, así que por encima del codo superior las dos curvas discrepaban y el pulmón
 * arrancaba a una presión distinta de la PEEP programada: con la sigmoide de SC-15 y PEEP 50, en Pel 47,8 en vez de
 * 50, y hasta 27 cmH2O de diferencia con sigmoides estrechas que el panel docente admite. Un solo elástico o ninguno.
 */
export function sigmoidVolume(s: SigmoidPV, p0: number, paw: number): number {
  const a = sigmoidA(s, p0);
  const pBaja = sigmoidAt(s, SIGMOID_GUARD);
  const pAlta = sigmoidAt(s, 1 - SIGMOID_GUARD);
  if (paw <= pBaja) return a + SIGMOID_GUARD * s.b + (paw - pBaja) * sigmoidSlope(s, SIGMOID_GUARD);
  if (paw >= pAlta) return a + (1 - SIGMOID_GUARD) * s.b + (paw - pAlta) * sigmoidSlope(s, 1 - SIGMOID_GUARD);
  return a + s.b / (1 + Math.exp(-(paw - s.c) / s.d));
}
/**
 * Presión elástica de la sigmoide. Fuera del intervalo útil se prolonga con la tangente del borde:
 * el modelo nunca devuelve infinitos aunque el ventilador insista por encima de la capacidad.
 */
export function sigmoidPressure(s: SigmoidPV, p0: number, v: number): number {
  const a = sigmoidA(s, p0);
  const u = (v - a) / s.b;
  if (u <= SIGMOID_GUARD) return sigmoidAt(s, SIGMOID_GUARD) + (v - (a + SIGMOID_GUARD * s.b)) / sigmoidSlope(s, SIGMOID_GUARD);
  if (u >= 1 - SIGMOID_GUARD)
    return sigmoidAt(s, 1 - SIGMOID_GUARD) + (v - (a + (1 - SIGMOID_GUARD) * s.b)) / sigmoidSlope(s, 1 - SIGMOID_GUARD);
  return sigmoidAt(s, u);
}
/** Compliance local del sistema respiratorio a un volumen dado (L/cmH2O). */
export function sigmoidCompliance(s: SigmoidPV, p0: number, v: number): number {
  const u = Math.min(1 - SIGMOID_GUARD, Math.max(SIGMOID_GUARD, (v - sigmoidA(s, p0)) / s.b));
  return sigmoidSlope(s, u);
}
/** Volumen de equilibrio pasivo a una presión dada, con el modelo elástico que declare el paciente. */
/** Conductancia con la que se representa el circuito abierto (L/s por cmH2O): 0,5 L/s bajan el nodo a 0,25 cmH2O (P). */
export const DISCONNECT_CONDUCTANCE_LPS_PER_CMH2O = 2;

export function equilibriumVolumeFor(params: { crs: number; p0: number; sigmoid?: SigmoidPV }, paw: number): number {
  const s = params.sigmoid;
  return s && s.b > 0 ? sigmoidVolume(s, params.p0, paw) : params.crs * (paw - params.p0);
}

/**
 * Modelo mecánico del sistema respiratorio (P · dossier §12):
 *   Paw + Pmus = P0 + Pel(V, Vve) + R(Q)·Q,   Q = dV/dt,   R(Q) = R1 + R2·|Q|
 *
 * Elástico: un compartimento estático (Crs) más un cuerpo de Maxwell opcional (E2 en serie con un amortiguador),
 * el modelo clásico de relajación de esfuerzo (Mount; Bates; D'Angelo):
 *   Pel = P0 + V/Crs + E2·(V − Vve),    dVve/dt = (V − Vve)/tauVisc
 * Con E2 = 0 se reduce exactamente al compartimento único. Con E2 > 0, tras ocluir la presión cae de inmediato
 * lo resistivo (Ppico → P1) y luego decae con tauVisc hasta la meseta estática P2 = P0 + V/Crs.
 * Resistivo: término de Rohrer R2·|Q| sobre la resistencia lineal, distinta en inspiración y espiración.
 *
 * V es el volumen ABSOLUTO sobre el volumen de relajación (V = 0 cuando Pel = P0).
 * No se reinicia al cambiar PEEP, al cambiar de vista ni al empezar una maniobra.
 */
export class PatientModel {
  params: PatientParams;
  /** Volumen absoluto sobre relajación (L). */
  v: number;
  /** Volumen que ya atravesó el amortiguador viscoelástico (L). Sin E2 sigue pegado a `v`. */
  vVisc: number;
  /** Volumen de la segunda unidad alveolar (L), si el paciente la declara. */
  v2: number;

  constructor(params: PatientParams, initialV = 0) {
    this.params = { ...params };
    this.v = initialV;
    this.vVisc = initialV; // arranca relajado: Pel(0) = P0
    const sec = params.second;
    // La segunda unidad arranca en equilibrio a la misma presión que la principal.
    this.v2 = sec ? sec.crs * (this.pelStatic(initialV) - params.p0) : 0;
  }

  private get e2(): number {
    const e = this.params.eVisc ?? 0;
    return Number.isFinite(e) && e > 0 ? e : 0;
  }
  private get tauVisc(): number {
    return Math.max(1e-3, this.params.tauViscS ?? DEFAULT_TAU_VISC_S);
  }
  /** Presión que aporta el elemento viscoelástico ahora mismo (cmH2O); 0 sin E2. */
  get pVisc(): number {
    return this.e2 <= 0 ? 0 : this.e2 * (this.v - this.vVisc); // sin elemento no hay aporte: 0·NaN sería NaN
  }

  /**
   * Avanza el elemento viscoelástico un tramo con flujo constante. Solución exacta de dVve/dt = (V − Vve)/tau
   * con V(t) = v0 + q·t, así que la relajación durante una oclusión (q = 0) es exacta a cualquier paso.
   */
  private relax(q: number, dt: number, v0: number): void {
    if (!(dt > 0) || !Number.isFinite(q)) return; // un tramo de duración nula no avanza nada; dividir por él daría NaN
    if (this.e2 <= 0) {
      this.vVisc = v0 + q * dt; // sin componente: si el instructor la activa después, no hay salto de presión
      return;
    }
    const tau = this.tauVisc;
    const k = Math.exp(-dt / tau);
    this.vVisc = v0 + q * dt - q * tau + (this.vVisc - v0 + q * tau) * k;
  }

  /** Presión elástica del sistema respiratorio (cmH2O), estática más viscoelástica. */
  pel(v: number = this.v, vVisc: number = this.vVisc): number {
    return this.pelStatic(v) + (this.e2 <= 0 ? 0 : this.e2 * (v - vVisc));
  }
  /** Presión elástica estática (sin el término viscoelástico): la meseta a la que tiende una oclusión larga. */
  pelStatic(v: number = this.v): number {
    const s = this.params.sigmoid;
    return s && s.b > 0 ? sigmoidPressure(s, this.params.p0, v) : this.params.p0 + v / this.params.crs;
  }

  /** Volumen de equilibrio pasivo bajo una presión de vía aérea constante. */
  equilibriumVolume(paw: number): number {
    return equilibriumVolumeFor(this.params, paw);
  }

  /** Volumen total del pulmón (todas las unidades) sobre el volumen de relajación. */
  get vTotal(): number {
    return this.v + (this.hasSecond ? this.v2 : 0);
  }
  /**
   * Presión que alcanzaría el sistema si se ocluyera hasta equilibrar todas las unidades: la auto-PEEP verdadera.
   * Con una sola unidad es la presión elástica estática; con dos se resuelve por bisección sobre el volumen total.
   */
  equilibratedPressure(v: number = this.v, v2: number = this.v2): number {
    if (!this.hasSecond) return this.pelStatic(v);
    // Se busca el reparto de volumen que iguala las presiones ESTÁTICAS de las dos unidades. Se resuelve sobre el
    // volumen y no sobre la presión para usar exactamente `pelStatic` (con su extensión tangente) y no una segunda
    // definición del mismo elástico, que discreparían por encima de la capacidad de la sigmoide.
    const total = v + v2;
    const dif = (v1: number): number => this.pelStatic(v1) - this.pel2(total - v1);
    let lo = Math.min(0, total) - 5,
      hi = Math.max(0, total) + 5;
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      if (dif(mid) < 0) lo = mid;
      else hi = mid;
    }
    return this.pelStatic((lo + hi) / 2);
  }

  /**
   * Fija el volumen ABSOLUTO del pulmón dejando el estado interno coherente: reparte entre unidades hasta igualar
   * presiones y deja el elemento viscoelástico relajado. Es una orden de banco, no un fenómeno físico.
   */
  setAbsoluteVolume(total: number): void {
    if (!this.hasSecond) {
      this.v = total;
      this.vVisc = total;
      return;
    }
    const dif = (v1: number): number => this.pelStatic(v1) - this.pel2(total - v1);
    let lo = Math.min(0, total) - 5,
      hi = Math.max(0, total) + 5;
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      if (dif(mid) < 0) lo = mid;
      else hi = mid;
    }
    this.v = (lo + hi) / 2;
    this.vVisc = this.v;
    this.v2 = total - this.v;
  }

  /** Lleva todas las unidades al equilibrio pasivo a una presión dada y deja relajado el elemento viscoelástico. */
  equilibrateTo(paw: number): void {
    const c2 = this.hasSecond ? (this.params.second?.crs ?? 0) : 0;
    this.setAbsoluteVolume(equilibriumVolumeFor(this.params, paw) + c2 * (paw - this.params.p0));
  }

  /**
   * Cambia los parámetros conservando la masa de gas: si el instructor quita la segunda unidad, su volumen pasa a la
   * principal en vez de desaparecer; si la añade, arranca en equilibrio con la presión actual.
   */
  /**
   * Cambia los parámetros conservando el gas. Conmutar la segunda unidad es una acción docente, no un suceso físico:
   * el pulmón no gana ni pierde volumen por ello. Quitarla une su gas al que queda; añadirla reparte el que hay entre
   * las dos hasta igualar presiones. Antes, añadirla creaba gas de la nada (unos 150 mL) porque le daba a la unidad
   * nueva su propio volumen de equilibrio sin quitárselo a la principal.
   */
  applyParams(next: PatientParams): void {
    const teniaSegunda = this.hasSecond;
    const totalPrevio = this.vTotal;
    this.params = { ...next };
    const tieneSegunda = this.hasSecond;
    if (teniaSegunda && !tieneSegunda) {
      this.v = totalPrevio;
      this.v2 = 0;
      if (this.e2 <= 0) this.vVisc = this.v;
    } else if (!teniaSegunda && tieneSegunda) {
      this.setAbsoluteVolume(totalPrevio);
    } else if (this.e2 <= 0) {
      this.vVisc = this.v;
    }
  }

  /** Compliance local de la unidad principal (pendiente de su curva P-V). */
  complianceMain(v: number = this.v): number {
    const s = this.params.sigmoid;
    return s && s.b > 0 ? sigmoidCompliance(s, this.params.p0, v) : this.params.crs;
  }
  /** Compliance local del sistema completo: la suma de las unidades, que es lo que mediría una oclusión larga. */
  compliance(v: number = this.v): number {
    return this.complianceMain(v) + (this.hasSecond ? (this.params.second?.crs ?? 0) : 0);
  }
  /** Constante de tiempo más corta de las ramas: fija el sub-paso de los integradores. */
  private minBranchTau(): number {
    const t1 = Math.min(this.params.rInsp, this.params.rExp) * Math.max(1e-5, this.complianceMain());
    const sec = this.params.second;
    return sec && sec.crs > 0 ? Math.min(t1, Math.min(sec.rInsp, sec.rExp) * sec.crs) : t1;
  }

  /** Resistencia lineal según el sentido del flujo; la espiratoria puede crecer al vaciarse el pulmón. */
  private r1For(q: number, v: number = this.v): number {
    if (q >= 0) return this.params.rInsp;
    const d = this.params.rExpVolumeDep;
    if (!d || d.gain <= 0) return this.params.rExp;
    return this.params.rExp * (1 + d.gain * Math.max(0, 1 - v / Math.max(1e-6, d.vRefL)));
  }
  /** Resistencia espiratoria efectiva al volumen indicado (cmH2O·s/L). */
  expiratoryResistance(v: number = this.v): number {
    return this.r1For(-1, v);
  }

  /**
   * Flujo espiratorio máximo por estrangulamiento (resistor de Starling), o infinito si no hay limitación.
   * Depende sólo del retroceso elástico y de la resistencia aguas arriba: por eso es independiente del esfuerzo
   * espiratorio y de cuánto se baje la presión aguas abajo.
   */
  maxExpiratoryFlow(paw: number, v: number = this.v): number {
    const e = this.params.efl;
    if (!e || paw >= e.pcrit) return Number.POSITIVE_INFINITY; // con la vía aérea por encima del punto crítico no colapsa
    const rus = Math.max(1e-3, e.rusFraction * this.expiratoryResistance(v));
    return Math.max(0, (this.pel(v) - e.pcrit) / rus);
  }

  get hasSecond(): boolean {
    return !!this.params.second && this.params.second.crs > 0;
  }
  /**
   * Conductancia de la fuga en la pieza en Y (L/s por cmH2O): Qfuga = G · Py, lineal con la presión del nodo (P). El
   * instructor la fija como litros por minuto a 10 cmH2O; la desconexión es una fuga tan grande que el nodo queda a
   * presión ambiente sea cual sea el flujo que entregue el ventilador.
   */
  get leakG(): number {
    if (this.params.disconnected) return DISCONNECT_CONDUCTANCE_LPS_PER_CMH2O;
    const lpm = this.params.leakLpmAt10 ?? 0;
    return lpm > 0 ? lpm / 60 / 10 : 0;
  }
  /** Flujo que escapa por la fuga a la presión de nodo dada (L/s; negativo si el nodo queda bajo el ambiente). */
  leakFlow(py: number): number {
    return this.leakG * py;
  }
  /** Presión elástica de la segunda unidad (lineal: sin sigmoide ni viscoelástico, simplificación declarada). */
  pel2(v2: number = this.v2): number {
    return this.params.p0 + v2 / Math.max(1e-6, this.params.second?.crs ?? 1);
  }
  /** Flujo de la segunda unidad para una presión de nodo dada. */
  branch2Flow(paw: number, pmus: number, v2: number = this.v2): number {
    const sec = this.params.second;
    if (!sec || sec.crs <= 0) return 0;
    const dp = paw + pmus - this.pel2(v2);
    return dp / (dp >= 0 ? sec.rInsp : sec.rExp);
  }

  /** Resolver Q para una Paw impuesta (fuente de presión). Con dos unidades devuelve el flujo TOTAL del nodo. */
  flowForPaw(paw: number, pmus: number, v: number = this.v, rSeries = 0, v2: number = this.v2): number {
    const q1 = this.branch1Flow(paw, pmus, v, rSeries);
    return this.hasSecond ? q1 + this.branch2Flow(paw, pmus, v2) : q1;
  }
  /** Flujo sólo de la unidad principal (la que lleva Rohrer, limitación al flujo y dependencia del volumen). */
  branch1Flow(paw: number, pmus: number, v: number = this.v, rSeries = 0): number {
    const dp = paw + pmus - this.pel(v);
    const r1 = this.r1For(dp >= 0 ? 1 : -1, v) + rSeries;
    const r2 = this.params.r2;
    const q = r2 <= 0 ? dp / r1 : Math.sign(dp) * ((-r1 + Math.sqrt(r1 * r1 + 4 * r2 * Math.abs(dp))) / (2 * r2));
    if (q >= 0) return q;
    const qMax = this.maxExpiratoryFlow(paw, v);
    return Number.isFinite(qMax) ? -Math.min(-q, qMax) : q;
  }
  /**
   * Estado del nodo de la vía aérea. La resistencia en serie del circuito y el tope de flujo del ventilador son
   * restricciones del NODO, no de una rama: con una sola unidad esto equivale a sumar rSeries a su resistencia,
   * pero con dos hay que resolverlas antes de repartir, o la segunda unidad quedaría conectada a una fuente ideal.
   */
  nodeState(
    paw: number,
    pmus: number,
    rSeries: number,
    maxFlow: number,
    nonNegativeFlow: boolean,
    v: number = this.v,
    v2: number = this.v2,
    minFlow: number = Number.NEGATIVE_INFINITY,
  ): { py: number; q1: number; q2: number; qLeak: number; clamped: boolean } {
    const g = this.leakG;
    const ramas = (py: number): { q1: number; q2: number } => ({
      q1: this.branch1Flow(py, pmus, v),
      q2: this.hasSecond ? this.branch2Flow(py, pmus, v2) : 0,
    });
    let py = rSeries > 0 ? this.nodePressureWithSeries(paw, pmus, rSeries, v, v2) : paw;
    let { q1, q2 } = ramas(py);
    let clamped = false;
    // Lo que el ventilador entrega o admite es el flujo de las ramas MÁS la fuga: los topes se aplican a esa suma.
    const fijarTotal = (qTotal: number): void => {
      py = this.nodePressureForFlow(qTotal, pmus, v, v2);
      ({ q1, q2 } = ramas(py));
    };
    const qVent = q1 + q2 + g * py;
    if (qVent > maxFlow) {
      clamped = true;
      fijarTotal(maxFlow);
    } else if (qVent < minFlow) {
      clamped = true;
      fijarTotal(minFlow);
    } else if (nonNegativeFlow && qVent < 0) {
      fijarTotal(0); // válvula inspiratoria de un solo sentido: el circuito queda ocluido (lo que sale del pulmón se va por la fuga)
    }
    return { py, q1, q2, qLeak: g * py, clamped };
  }

  /** Las dos ramas son lineales por tramos en la presión del nodo: entonces el nodo se resuelve en forma cerrada. */
  private branchesLinear(): boolean {
    const d = this.params.rExpVolumeDep;
    return this.params.r2 <= 0 && !this.params.efl && !(d && d.gain > 0);
  }
  /**
   * Resuelve Σ q_i(py) + pendiente·py + término = objetivo en forma cerrada. Cada rama cambia de resistencia al
   * invertirse su flujo, así que la suma es lineal a trozos con un corte por rama; se prueba cada tramo y se acepta
   * la solución que cae dentro de él. Devuelve null si las ramas no son lineales (Rohrer, limitación al flujo…).
   */
  private solveNodeLinear(pmus: number, v: number, v2: number, pendiente: number, termino: number, objetivo: number): number | null {
    if (!this.branchesLinear()) return null;
    const sec = this.params.second;
    if (!sec || sec.crs <= 0) {
      // Una sola rama lineal: q1 = (py − p1)/r con r según el sentido del flujo; se prueba cada sentido.
      const p1 = this.pel(v) - pmus;
      for (const r of [this.params.rInsp, this.params.rExp]) {
        const a = 1 / r + pendiente;
        if (Math.abs(a) < 1e-12) continue;
        const py = (objetivo - (termino - p1 / r)) / a;
        const dp = py - p1;
        if ((r === this.params.rInsp && dp >= -1e-9) || (r === this.params.rExp && dp <= 1e-9)) return py;
      }
      return null;
    }
    const p1 = this.pel(v) - pmus,
      p2 = this.pel2(v2) - pmus;
    const cortes = [p1, p2].sort((a, b) => a - b);
    const tramos: [number, number][] = [
      [Number.NEGATIVE_INFINITY, cortes[0] as number],
      [cortes[0] as number, cortes[1] as number],
      [cortes[1] as number, Number.POSITIVE_INFINITY],
    ];
    for (const [lo, hi] of tramos) {
      const dentro = (lo + Math.min(hi, lo + 1)) / 2; // punto de referencia del tramo para elegir resistencias
      const r1 = dentro >= p1 ? this.params.rInsp : this.params.rExp;
      const r2b = dentro >= p2 ? sec.rInsp : sec.rExp;
      const a = 1 / r1 + 1 / r2b + pendiente;
      const b = -p1 / r1 - p2 / r2b + termino;
      if (Math.abs(a) < 1e-12) continue;
      const py = (objetivo - b) / a;
      if (py >= lo - 1e-9 && py <= hi + 1e-9) return py;
    }
    return null;
  }

  /**
   * Evaluaciones del solucionador del nodo desde que se creó el modelo. Cuesta un entero por evaluación y da un
   * guardián de rendimiento determinista: contar el trabajo no depende de la máquina ni de la instrumentación de
   * cobertura, al revés que medir tiempo de reloj. Las ramas lineales se resuelven en forma cerrada y no lo mueven.
   */
  solverEvals = 0;

  /** Presión del nodo cuando el circuito interpone una resistencia en serie: por ella pasa el flujo total de las ramas. */
  nodePressureWithSeries(paw: number, pmus: number, rSeries: number, v: number = this.v, v2: number = this.v2): number {
    if (!(rSeries > 0)) return paw;
    const gFuga = this.leakG;
    if (this.hasSecond || gFuga > 0) {
      const exacto = this.solveNodeLinear(pmus, v, v2, 1 / rSeries + gFuga, -paw / rSeries, 0);
      if (exacto !== null) return exacto;
    }
    const g = (py: number): number => {
      this.solverEvals++;
      return this.branch1Flow(py, pmus, v) + (this.hasSecond ? this.branch2Flow(py, pmus, v2) : 0) + gFuga * py - (paw - py) / rSeries;
    };
    let lo = Math.min(paw, this.pel(v), this.hasSecond ? this.pel2(v2) : paw) - pmus - 1;
    let hi = Math.max(paw, this.pel(v), this.hasSecond ? this.pel2(v2) : paw) - pmus + 1;
    for (let i = 0; i < 60 && g(lo) > 0; i++) lo -= Math.max(1, Math.abs(lo));
    for (let i = 0; i < 60 && g(hi) < 0; i++) hi += Math.max(1, Math.abs(hi));
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      if (g(mid) < 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /**
   * Presión del nodo de la vía aérea que produce un flujo total dado, resuelta por bisección: las ramas pueden ser
   * no lineales (Rohrer, limitación al flujo), pero el flujo total crece de forma monótona con la presión del nodo.
   */
  nodePressureForFlow(qTotal: number, pmus: number, v: number = this.v, v2: number = this.v2): number {
    const gFuga = this.leakG;
    if (this.hasSecond || gFuga > 0) {
      const exacto = this.solveNodeLinear(pmus, v, v2, gFuga, 0, qTotal);
      if (exacto !== null) return exacto;
    }
    const f = (py: number): number => {
      this.solverEvals++;
      return this.branch1Flow(py, pmus, v) + this.branch2Flow(py, pmus, v2) + gFuga * py;
    };
    let lo = Math.min(this.pel(v), this.pel2(v2)) - pmus - 1;
    let hi = Math.max(this.pel(v), this.pel2(v2)) - pmus + 1;
    for (let i = 0; i < 60 && f(lo) > qTotal; i++) lo -= Math.max(1, Math.abs(lo));
    for (let i = 0; i < 60 && f(hi) < qTotal; i++) hi += Math.max(1, Math.abs(hi));
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < qTotal) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /** Paw resultante para un flujo impuesto (fuente de flujo). */
  pawForFlow(q: number, pmus: number, v: number = this.v): number {
    // Con dos unidades, con limitación al flujo o con fuga la relación no es invertible en forma cerrada: se resuelve el nodo.
    if (this.hasSecond || this.params.efl || this.leakG > 0) return this.nodePressureForFlow(q, pmus, v);
    const r = this.r1For(q, v) + this.params.r2 * Math.abs(q);
    return this.pel(v) + r * q - pmus;
  }

  /**
   * Integra un tramo con Paw impuesta constante y Pmus dada por función del tiempo (RK2/Heun, con sub-pasos si dt/tau es grande).
   * Devuelve el cambio de volumen (∫Q dt exacto por definición) y el flujo al final.
   */
  integratePressureSource(
    paw: number,
    pmusAt: (tS: number) => number,
    t0: number,
    dt: number,
    nonNegativeFlow = false,
    maxFlow = Number.POSITIVE_INFINITY,
    rSeries = 0,
    minFlow = Number.NEGATIVE_INFINITY,
  ): { dV: number; qEnd: number; clamped: boolean; dVLeak: number; qLeakEnd: number; pyEnd: number } {
    if (!(dt > 0)) {
      const n = this.nodeState(paw, pmusAt(t0), rSeries, maxFlow, nonNegativeFlow, this.v, this.v2, minFlow);
      return { dV: 0, qEnd: n.q1 + n.q2, clamped: false, dVLeak: 0, qLeakEnd: n.qLeak, pyEnd: n.py };
    }
    const tauMin = this.minBranchTau();
    const nSub = Math.min(1000, Math.max(1, Math.ceil(dt / (0.2 * Math.max(1e-6, tauMin)))));
    // El tope de flujo (válvula/actuador) se aplica dentro de cada etapa del RK2, no en un paso aparte: así no hay
    // sobreimpulso dependiente de dt cuando el flujo libre cruza el tope a mitad de paso (revisión E24).
    const f = (pw: number, pm: number, vv: number): number => {
      const q = this.flowForPaw(pw, pm, vv, rSeries);
      return Math.min(maxFlow, Math.max(minFlow, nonNegativeFlow ? Math.max(0, q) : q));
    };
    const h = dt / nSub;
    const v0 = this.v;
    const v20 = this.v2;
    let v = v0;
    let v2 = v20;
    let t = t0;
    let q = 0;
    // Con dos unidades o con fuga el nodo se resuelve primero (circuito, fuga y tope del ventilador) y después se reparte.
    const nodo = (pm: number, vv: number, vv2: number): { py: number; q1: number; q2: number; qLeak: number; clamped: boolean } =>
      this.nodeState(paw, pm, rSeries, maxFlow, nonNegativeFlow, vv, vv2, minFlow);
    const porNodo = this.hasSecond || this.leakG > 0;
    let clampedAlguna = false;
    let dVLeak = 0;
    for (let i = 0; i < nSub; i++) {
      const vSub = v;
      if (porNodo) {
        const a = nodo(pmusAt(t), v, v2);
        const b = nodo(pmusAt(t + h), v + h * a.q1, v2 + h * a.q2);
        v += (h / 2) * (a.q1 + b.q1);
        v2 += (h / 2) * (a.q2 + b.q2);
        dVLeak += (h / 2) * (a.qLeak + b.qLeak);
        q = b.q1 + b.q2;
        clampedAlguna = clampedAlguna || a.clamped || b.clamped;
      } else {
        const k1 = f(paw, pmusAt(t), v);
        const k2 = f(paw, pmusAt(t + h), v + h * k1);
        v += (h / 2) * (k1 + k2);
        q = k2;
      }
      // El elemento viscoelástico se congela dentro del sub-paso (tauVisc ≫ h) y avanza con el flujo medio del tramo.
      this.relax((v - vSub) / h, h, vSub);
      t += h;
    }
    this.v = v;
    this.v2 = v2;
    if (porNodo) {
      const fin = nodo(pmusAt(t), v, v2);
      const qFin = fin.q1 + fin.q2;
      return {
        dV: v - v0 + (v2 - v20),
        qEnd: Number.isFinite(qFin) ? qFin : q,
        clamped: fin.clamped || clampedAlguna,
        dVLeak,
        qLeakEnd: fin.qLeak,
        pyEnd: fin.py,
      };
    }
    const qFree = this.flowForPaw(paw, pmusAt(t), v, rSeries, v2);
    const qFin = f(paw, pmusAt(t), v);
    const qEnd = Number.isFinite(qFin) ? qFin : q;
    const clamped = qFree > maxFlow || qFree < minFlow;
    // Sin fuga la presión del nodo es la impuesta menos la caída en la resistencia en serie (o la del flujo topado).
    const pyEnd = clamped ? this.pawForFlow(qEnd, pmusAt(t), v) : paw - rSeries * qEnd;
    return { dV: v - v0, qEnd, clamped, dVLeak: 0, qLeakEnd: 0, pyEnd };
  }

  /**
   * Integra un tramo con flujo TOTAL impuesto. Con una sola unidad es exacto (V lineal en t). Con dos unidades el
   * reparto entre ramas cambia dentro del tramo, así que se sub-divide y en cada sub-paso se resuelve la presión
   * del nodo: con q = 0 eso es exactamente el pendelluft (el gas pasa de una unidad a la otra con el circuito cerrado).
   */
  integrateFlowSource(q: number, dt: number, pmus = 0): { dV: number } {
    if (!(dt > 0)) return { dV: 0 };
    if (!this.hasSecond && this.leakG <= 0) {
      const v0 = this.v;
      const dV = q * dt;
      this.v += dV;
      this.relax(q, dt, v0);
      return { dV };
    }
    const tauMin = this.minBranchTau();
    const nSub = Math.min(1000, Math.max(1, Math.ceil(dt / (0.2 * Math.max(1e-6, tauMin)))));
    const h = dt / nSub;
    for (let i = 0; i < nSub; i++) {
      const before = this.v;
      // El esfuerzo es común a las dos unidades: desplaza la presión del nodo pero no el reparto entre ramas.
      // Aun así entra en el cálculo porque la limitación al flujo se conmuta comparando la Pva REAL con la presión crítica.
      const py1 = this.nodePressureForFlow(q, pmus, this.v, this.v2);
      const k1a = this.branch1Flow(py1, pmus, this.v),
        k1b = this.branch2Flow(py1, pmus, this.v2);
      const py2 = this.nodePressureForFlow(q, pmus, this.v + h * k1a, this.v2 + h * k1b);
      const k2a = this.branch1Flow(py2, pmus, this.v + h * k1a),
        k2b = this.branch2Flow(py2, pmus, this.v2 + h * k1b);
      this.v += (h / 2) * (k1a + k2a);
      this.v2 += (h / 2) * (k1b + k2b);
      this.relax((this.v - before) / h, h, before);
    }
    return { dV: q * dt }; // lo que entrega el ventilador lo fija el flujo impuesto; el reparto entre unidades (y la fuga) es interno
  }
}
