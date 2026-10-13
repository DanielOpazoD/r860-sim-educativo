import type { GasExchangeParams } from '../domain/types';

/**
 * Gasometría de modelo (P): CO₂ arterial y pH de un adulto virtual, para la docencia. No es un valor del monitor:
 * el equipo real no mide PaCO₂ y esta cifra nunca entra en la columna numérica.
 *
 * Balance de masa de un solo depósito de CO₂ equivalente:
 *   C · dPaCO₂/dt = 0,863 · VCO₂ − V̇A · PaCO₂
 * La producción entra de forma continua; cada respiración retira su volumen alveolar con la concentración alveolar
 * del momento. El espacio muerto de la vía aérea se sigue como un tapón que se llena y se vacía en orden (Fowler):
 * al espirar sale primero el gas inspirado que quedó en la vía aérea y después el alveolar; al inspirar, el gas
 * alveolar que quedó en la vía aérea vuelve al alvéolo antes que el fresco. Una respiración regular retira VT − VDaw;
 * el volumen que mueve un esfuerzo que no dispara (o una oscilación) es gas de la vía aérea que entra y sale, y no
 * ventila. Del gas alveolar que sale, la fracción de espacio muerto alveolar viene de unidades sin perfusión y no
 * lleva CO₂: V̇A = (VT − VDaw) · (1 − f) · FR. En equilibrio queda la ecuación de la ventilación alveolar,
 * PaCO₂ = 0,863 · VCO₂ / V̇A (D), con VCO₂ en mL/min STPD y V̇A en L/min BTPS. La constante de tiempo τ = C / V̇A
 * sale del modelo: más lenta cuanto menor es la ventilación, y en apnea la PaCO₂ sube 0,863 · VCO₂ / C mmHg/min.
 * pH por Henderson-Hasselbalch con tamponamiento agudo: el bicarbonato del paciente es el de su PaCO₂ habitual y,
 * cuando la PaCO₂ se aparta de ella, los tampones no bicarbonato lo mueven en minutos según las reglas clásicas de
 * Boston: +1 mEq/L por cada 10 mmHg de hipercapnia aguda (Brackett, N Engl J Med 1965) y −2 por cada 10 mmHg de
 * hipocapnia aguda (Arbus, N Engl J Med 1969). La compensación renal (días) no se modela: la sesión dura minutos.
 */
export const DEFAULT_GAS: GasExchangeParams = {
  /** Producción de CO₂ de un adulto en reposo (mL/min STPD), P. */
  vco2MlMin: 200,
  /**
   * Espacio muerto fisiológico = de la vía aérea + alveolar (Fletcher, Br J Anaesth 1981). Fletcher y Jonson (Br J
   * Anaesth 1984) midieron en adultos anestesiados con ventilación mecánica VDfis/VT 0,44 con VT 0,45 L y 0,31 con
   * VT 0,75 L, con el de la vía aérea constante y una fracción alveolar menor con el VT mayor. Las dos medianas fijan
   * las dos partes de este modelo: 165 mL de vía aérea (tubo y vías de conducción, en serie) y 0,12 del volumen
   * alveolar (P: la fracción real baja algo con el VT). Con el banco por omisión (VT 500 × 15) da VDfis/VT 0,41,
   * PaCO₂ 39 y pH 7,41: normocapnia sin programarla.
   */
  deadspaceL: 0.165,
  alveolarDeadspaceFrac: 0.12,
  /** Bicarbonato plasmático (mEq/L) a la PaCO₂ habitual del paciente: el componente metabólico y la compensación crónica. */
  hco3: 24,
  /** PaCO₂ habitual del paciente (mmHg), aquella a la que su bicarbonato es `hco3`: 40 en un adulto sano. */
  paco2Basal: 40,
  /**
   * Capacidad del depósito de CO₂ (L equivalentes). Elegida para que la apnea suba ≈ 4 mmHg/min y una variación de la
   * ventilación tarde ≈ 8 min en recorrer el 63 % (V̇A 5 L/min): la gasometría de control se pide a los 20–30 min. P.
   */
  storeL: 40,
};

/** Constante de la ecuación de la ventilación alveolar: (PB − PH₂O) · 273/310 / 1000 con PB 760 mmHg. D. */
export const ALVEOLAR_K = 0.863;
/** Solubilidad del CO₂ en plasma (mmol/L por mmHg) y pK del par bicarbonato/CO₂ a 37 °C. D. */
export const CO2_SOLUBILITY = 0.03;
export const PK_BICARBONATE = 6.1;

export const gasParams = (p: Partial<GasExchangeParams> | undefined): GasExchangeParams => ({ ...DEFAULT_GAS, ...p });

/** PaCO₂ de equilibrio para una ventilación alveolar (mmHg), o null si no hay ventilación alveolar. */
export function steadyPaco2(vco2MlMin: number, vaLMin: number): number | null {
  return vaLMin > 0 ? (ALVEOLAR_K * vco2MlMin) / vaLMin : null;
}

/** Respuesta aguda del bicarbonato por mmHg de PaCO₂ (mEq/L): hipercapnia (Brackett 1965) e hipocapnia (Arbus 1969). D. */
export const ACUTE_HCO3_PER_MMHG_UP = 0.1;
export const ACUTE_HCO3_PER_MMHG_DOWN = 0.2;

/** Bicarbonato a una PaCO₂ dada: el habitual del paciente más la respuesta aguda de los tampones no bicarbonato. */
export function bicarbonate(p: Pick<GasExchangeParams, 'hco3' | 'paco2Basal'>, paco2: number): number {
  const d = paco2 - p.paco2Basal;
  return p.hco3 + (d >= 0 ? ACUTE_HCO3_PER_MMHG_UP : ACUTE_HCO3_PER_MMHG_DOWN) * d;
}

/** pH arterial por Henderson-Hasselbalch. */
export function phFrom(hco3: number, paco2: number): number {
  return PK_BICARBONATE + Math.log10(hco3 / (CO2_SOLUBILITY * paco2));
}

interface AlveolarBreath {
  startS: number;
  endS: number;
  vaL: number;
  /** Segundos de bloqueo dentro de la respiración: una maniobra de medición, no parte de la ventilación programada. */
  pauseS: number;
}

/** Antigüedad máxima de las respiraciones que cuentan para la V̇A actual (s). */
const VA_WINDOW_S = 60;
/**
 * Con PaCO₂ inicial de equilibrio, éste se fija con la ventilación de los primeros segundos y no sólo con la primera
 * respiración: si hay atrapamiento, el volumen espirado tarda varios ciclos en estabilizarse y la primera respiración
 * daba un equilibrio que no era el de la ventilación programada (P).
 */
export const EQUILIBRIUM_WINDOW_S = 20;

export interface GasState {
  paco2: number;
  ph: number;
  /** Bicarbonato de ahora (mEq/L): el habitual más la respuesta aguda a la PaCO₂ de ahora. */
  hco3: number;
  /** pH hacia el que tiende con la ventilación actual (con el bicarbonato de esa PaCO₂), o null sin ventilación alveolar. */
  phTarget: number | null;
  /** Ventilación alveolar actual (L/min; últimas respiraciones), o null antes de completar una respiración. */
  vaLMin: number | null;
  /** Fracción de espacio muerto de la última respiración (1 − VA/VT pulmonar), o null sin respiración. */
  vdVt: number | null;
  /** Volumen que espiró el pulmón en la última respiración (L), o null sin respiración. */
  vtL: number | null;
  /** PaCO₂ hacia la que tiende con la ventilación actual, o null sin ventilación alveolar. */
  paco2Target: number | null;
  /** Constante de tiempo de esa aproximación (min), o null sin ventilación alveolar. */
  tauMin: number | null;
}

/**
 * Estado del CO₂. Determinista: sólo depende del volumen pulmonar que el simulador le entrega, así que una sesión
 * reproducida da la misma gasometría. No realimenta la mecánica.
 */
export class GasExchange {
  paco2: number;
  private breaths: AlveolarBreath[] = [];
  private lastVdVt: number | null = null;
  private lastVtL: number | null = null;
  /** Gas alveolar que ocupa la vía aérea de conducción (L, entre 0 y VD): al final de la espiración la llena entera. */
  private airwayAlveolarL: number | null = null;
  /** Lo que el pulmón espiró en la respiración en curso (L) y la parte de eso que fue gas alveolar. */
  private expiredL = 0;
  private alveolarOutL = 0;
  /** Con PaCO₂ inicial 'equilibrium', las respiraciones de los primeros EQUILIBRIUM_WINDOW_S fijan el equilibrio. */
  private pendingEquilibrium: boolean;

  constructor(initialPaco2: number | 'equilibrium' = 'equilibrium') {
    this.pendingEquilibrium = initialPaco2 === 'equilibrium';
    this.paco2 = initialPaco2 === 'equilibrium' ? 40 : initialPaco2;
  }

  /** Producción continua de CO₂ durante `dtS`. */
  step(dtS: number, p: GasExchangeParams): void {
    this.paco2 += (ALVEOLAR_K * p.vco2MlMin * (dtS / 60)) / p.storeL;
  }

  /** Cambio del volumen pulmonar en un paso (L; negativo al espirar). Sólo el gas alveolar que sale de la boca ventila. */
  move(dvL: number, p: GasExchangeParams): void {
    const vd = p.deadspaceL;
    const enVia = Math.min(vd, this.airwayAlveolarL ?? vd);
    if (dvL < 0) {
      const sale = -dvL;
      this.alveolarOutL += Math.max(0, sale - (vd - enVia));
      this.expiredL += sale;
      this.airwayAlveolarL = Math.min(vd, enVia + sale);
    } else this.airwayAlveolarL = Math.max(0, enVia - dvL);
  }

  /**
   * Fin de una respiración: retira el CO₂ del gas alveolar que salió en ella, salvo el de las unidades sin perfusión.
   * `pauseS` es el tiempo de bloqueo dentro de ella: la PaCO₂ sí sube durante el bloqueo (la producción no para), pero
   * la V̇A —y el equilibrio que se muestra y se evalúa— es la de la ventilación programada, sin la maniobra.
   */
  onBreath(endS: number, durationS: number, p: GasExchangeParams, pauseS = 0): void {
    const vaL = this.alveolarOutL * (1 - p.alveolarDeadspaceFrac);
    this.lastVtL = this.expiredL > 0 ? this.expiredL : null;
    this.lastVdVt = this.expiredL > 0 ? Math.min(1, 1 - vaL / this.expiredL) : null;
    this.expiredL = 0;
    this.alveolarOutL = 0;
    this.breaths.push({ startS: endS - durationS, endS, vaL, pauseS: Math.min(pauseS, durationS) });
    while (this.breaths.length && this.breaths[0]!.endS < endS - VA_WINDOW_S) this.breaths.shift();
    if (this.pendingEquilibrium) {
      if (endS >= EQUILIBRIUM_WINDOW_S) this.pendingEquilibrium = false;
      // La V̇A de las últimas respiraciones (el atrapamiento ya asentado), o de la primera si es la única.
      const va = this.vaLMin(endS);
      const target = va === null ? null : steadyPaco2(p.vco2MlMin, va);
      if (target !== null) {
        this.paco2 = target;
        return;
      }
    }
    // Exacto para el lavado de una fracción vaL/C del depósito: nunca deja la PaCO₂ negativa.
    this.paco2 *= Math.exp(-vaL / p.storeL);
  }

  /**
   * V̇A actual: el volumen alveolar de las últimas respiraciones (hasta tres, terminadas en el último minuto) sobre el
   * tiempo que cubren. Responde en pocas respiraciones a un cambio de programación —el equilibrio que se muestra y se
   * evalúa es el de la ventilación de ahora, no un promedio con la anterior— y una ventilación regular da exactamente
   * (VT − VD)·FR sin depender de la fase. Una respiración en curso no cuenta como pausa; si pasa más de un ciclo medio
   * sin respiraciones (apnea), ese tiempo sí cuenta y la V̇A cae hasta 0 cuando la última sale del minuto. El tiempo de
   * los bloqueos no cuenta: medir la meseta no cambia el equilibrio de la ventilación programada.
   */
  vaLMin(nowS: number): number | null {
    if (!this.breaths.length) return null;
    const recientes = this.breaths.filter((b) => b.endS >= nowS - VA_WINDOW_S).slice(-3);
    if (!recientes.length) return 0;
    const desde = recientes[0]!.startS,
      pausas = recientes.reduce((s, b) => s + b.pauseS, 0),
      cubierto = recientes.at(-1)!.endS - desde - pausas,
      cicloMedio = cubierto / recientes.length;
    const span = Math.max(cubierto, nowS - desde - pausas - cicloMedio);
    return span > 0 ? (recientes.reduce((s, b) => s + b.vaL, 0) * 60) / span : null;
  }

  state(nowS: number, p: GasExchangeParams): GasState {
    const va = this.vaLMin(nowS);
    const objetivo = va === null ? null : steadyPaco2(p.vco2MlMin, va);
    return {
      paco2: this.paco2,
      ph: phFrom(bicarbonate(p, this.paco2), this.paco2),
      hco3: bicarbonate(p, this.paco2),
      vaLMin: va,
      vdVt: this.lastVdVt,
      vtL: this.lastVtL,
      paco2Target: objetivo,
      phTarget: objetivo === null ? null : phFrom(bicarbonate(p, objetivo), objetivo),
      tauMin: va !== null && va > 0 ? p.storeL / va : null,
    };
  }
}
