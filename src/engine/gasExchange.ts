import type { GasExchangeParams } from '../domain/types';

/**
 * Gasometría de modelo (P): CO₂ arterial y pH de un adulto virtual, para la docencia. No es un valor del monitor:
 * el equipo real no mide PaCO₂ y esta cifra nunca entra en la columna numérica.
 *
 * Balance de masa en dos compartimentos (Farhi y Rahn): el pulmón (gas alveolar y tejido pulmonar, capacidad C_p) y
 * el resto del cuerpo (sangre venosa y tejidos, C_t = C − C_p), unidos por la sangre que los recorre:
 *   C_t · dPvCO₂/dt = 0,863 · VCO₂ − G · (PvCO₂ − PACO₂)
 *   C_p · dPACO₂/dt = G · (PvCO₂ − PACO₂) − V̇A · PACO₂
 * La producción entra en los tejidos; la sangre la lleva al pulmón con una conductancia G fija (gasto cardíaco por la
 * pendiente de la curva de disociación), y cada respiración retira su volumen alveolar con la presión alveolar del
 * momento. El espacio muerto de la vía aérea se sigue como un tapón que se llena y se vacía en orden (Fowler):
 * al espirar sale primero el gas inspirado que quedó en la vía aérea y después el alveolar; al inspirar, el gas
 * alveolar que quedó en la vía aérea vuelve al alvéolo antes que el fresco. Una respiración regular retira VT − VDaw;
 * el volumen que mueve un esfuerzo que no dispara (o una oscilación) es gas de la vía aérea que entra y sale, y no
 * ventila. Del gas alveolar que sale, la fracción de espacio muerto alveolar viene de unidades sin perfusión y no
 * lleva CO₂: V̇A = (VT − VDaw) · (1 − f) · FR. En equilibrio queda la ecuación de la ventilación alveolar,
 * PaCO₂ = 0,863 · VCO₂ / V̇A (D), con VCO₂ en mL/min STPD y V̇A en L/min BTPS, y la venosa queda 0,863 · VCO₂ / G por
 * encima. En apnea el pulmón alcanza a la sangre venosa en segundos y después todo sube junto a 0,863 · VCO₂ / C
 * mmHg/min: la subida es rápida en el primer minuto y lenta después, como se mide. Tras un cambio de ventilación hay
 * un tramo rápido (el pulmón) y uno lento (los tejidos), más lento cuanto menor es la ventilación.
 * La PaCO₂ que se informa es la de una muestra arterial: la alveolar, que sube y baja con cada respiración, promediada
 * por la mezcla en la sangre y por los segundos que tarda la extracción.
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
   * Capacidad total de los depósitos de CO₂ que cuentan en minutos (L equivalentes: pulmón más sangre y tejidos). Con
   * 45 L la apnea sube 0,863 · 200 / 45 = 3,8 mmHg/min pasado el primer minuto, en medio de lo medido en anestesiados
   * con el tubo ocluido: 3,4 (Stock 1989) y 3,4–4,4 (Kobayashi 1994). P calibrado con D.
   */
  storeL: 45,
};

/** Constante de la ecuación de la ventilación alveolar: PB · (310/273) / 1000 con PB 760 mmHg (VCO₂ STPD → BTPS). D. */
export const ALVEOLAR_K = 0.863;
/** Solubilidad del CO₂ en plasma (mmol/L por mmHg) y pK del par bicarbonato/CO₂ a 37 °C. D. */
export const CO2_SOLUBILITY = 0.03;
export const PK_BICARBONATE = 6.1;

/**
 * Capacidad del compartimento pulmonar (L equivalentes): el gas alveolar a la capacidad residual funcional de un adulto
 * en decúbito y ventilado (≈ 2,5 L), más el tejido pulmonar. Fija lo poco que dura el tramo rápido y cuánto baja la
 * PACO₂ en cada respiración (≈ 4 mmHg con V̇A 4,4 a 15/min). P.
 */
export const LUNG_CO2_STORE_L = 3;
/**
 * Diferencia venoarterial de PCO₂ en reposo (mmHg): venosa mixta ≈ 46 frente a arterial 40. Fija la conductancia de
 * la sangre: G = 0,863 · 200 / 6 ≈ 29 L/min; con otra producción el gradiente cambia en proporción, como por Fick.
 * D-secundario (libro de texto).
 */
export const VENOARTERIAL_PCO2_MMHG = 6;
const BLOOD_CO2_CONDUCTANCE_L_MIN = (ALVEOLAR_K * DEFAULT_GAS.vco2MlMin) / VENOARTERIAL_PCO2_MMHG;
/**
 * Constante de tiempo de la muestra arterial (s): la sangre del pulmón llega a la arteria mezclada, y una gasometría
 * se extrae en unos segundos. Promedia la oscilación alveolar de cada respiración (queda en ±0,1 mmHg) sin retrasar
 * la apnea más que unos segundos. P.
 */
export const ARTERIAL_SAMPLE_TAU_S = 10;

export const gasParams = (p: Partial<GasExchangeParams> | undefined): GasExchangeParams => ({ ...DEFAULT_GAS, ...p });

/** PaCO₂ de equilibrio para una ventilación alveolar (mmHg), o null si no hay ventilación alveolar. */
export function steadyPaco2(vco2MlMin: number, vaLMin: number): number | null {
  return vaLMin > 0 ? (ALVEOLAR_K * vco2MlMin) / vaLMin : null;
}

/**
 * Constante de tiempo del tramo lento hacia el equilibrio (min), o null sin ventilación alveolar: la menor de las dos
 * raíces del sistema de dos compartimentos. Cerca de C_t · (1/V̇A + 1/G): más lenta cuanto menos se ventila.
 */
export function slowTauMin(storeL: number, vaLMin: number): number | null {
  if (!(vaLMin > 0)) return null;
  const g = BLOOD_CO2_CONDUCTANCE_L_MIN,
    cp = LUNG_CO2_STORE_L,
    ct = storeL - cp;
  const suma = (g + vaLMin) / cp + g / ct,
    producto = (g * vaLMin) / (cp * ct);
  const lenta = (suma - Math.sqrt(suma * suma - 4 * producto)) / 2;
  return 1 / lenta;
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
  /** Constante de tiempo del tramo lento de esa aproximación (min), o null sin ventilación alveolar. */
  tauMin: number | null;
}

/**
 * Estado del CO₂. Determinista: sólo depende del volumen pulmonar que el simulador le entrega, así que una sesión
 * reproducida da la misma gasometría. No realimenta la mecánica.
 */
export class GasExchange {
  /** PaCO₂ de la muestra arterial (mmHg): la que se informa. */
  paco2: number;
  /** PCO₂ alveolar (mmHg): el compartimento pulmonar, que baja con cada respiración y se repone desde la sangre. */
  alveolar: number;
  /** PCO₂ venosa mixta (mmHg): el compartimento de la sangre venosa y los tejidos, donde entra la producción. */
  venosa: number;
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

  /** Con un valor numérico, el alvéolo y la muestra parten de él y la venosa, de su equilibrio con la producción por omisión. */
  constructor(initialPaco2: number | 'equilibrium' = 'equilibrium') {
    this.pendingEquilibrium = initialPaco2 === 'equilibrium';
    this.paco2 = initialPaco2 === 'equilibrium' ? 40 : initialPaco2;
    this.alveolar = this.paco2;
    this.venosa = this.paco2 + VENOARTERIAL_PCO2_MMHG;
  }

  /** Producción continua de CO₂ durante `dtS`, su transporte al pulmón y la mezcla en la muestra arterial. */
  step(dtS: number, p: GasExchangeParams): void {
    const ct = p.storeL - LUNG_CO2_STORE_L;
    const transporte = (BLOOD_CO2_CONDUCTANCE_L_MIN * (this.venosa - this.alveolar) * dtS) / 60;
    this.venosa += ((ALVEOLAR_K * p.vco2MlMin * dtS) / 60 - transporte) / ct;
    this.alveolar += transporte / LUNG_CO2_STORE_L;
    this.paco2 += (this.alveolar - this.paco2) * (1 - Math.exp(-dtS / ARTERIAL_SAMPLE_TAU_S));
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
        // Al terminar la respiración el alvéolo está en el valle de su oscilación: la media del ciclo es el equilibrio.
        this.paco2 = target;
        this.alveolar = target * Math.exp(-vaL / (2 * LUNG_CO2_STORE_L));
        this.venosa = target + (ALVEOLAR_K * p.vco2MlMin) / BLOOD_CO2_CONDUCTANCE_L_MIN;
        return;
      }
    }
    // Exacto para el lavado de una fracción vaL/C_p del pulmón: nunca deja la PCO₂ negativa.
    this.alveolar *= Math.exp(-vaL / LUNG_CO2_STORE_L);
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
      tauMin: va === null ? null : slowTauMin(p.storeL, va),
    };
  }
}
