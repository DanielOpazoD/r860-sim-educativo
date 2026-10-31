import type { GasExchangeParams } from '../domain/types';

/**
 * Oxigenación de modelo (P): PaO₂ y SaO₂ de un adulto virtual, para la docencia. Como la PaCO₂, no es un valor del
 * monitor y nunca entra en la columna numérica. Lee el estado del motor y no realimenta la mecánica.
 *
 * Mezcla venosa de tres clases de unidad (Riley y Cournand 1949): ideales, de V/Q bajo y shunt verdadero.
 *   PAO₂ = FiO₂ · (PB − PH₂O) − PaCO₂ / R                (ecuación del gas alveolar, unidades ideales)
 *   V/Q · (PIO₂ − PO₂) / 0,863 = C(PO₂) − CvO₂           (balance de O₂ de las unidades de V/Q bajo)
 *   CaO₂ = (1 − s − f) · C(PAO₂) + f · C(PO₂ baja) + s · CvO₂
 *   CvO₂ = CaO₂ − VO₂ / GC                               (Fick; en esta entrega el gasto cardíaco es fijo)
 *   s = shuntBase + shuntRecruitable · (1 − fracción reclutada)
 * El shunt no ve el gas inspirado, así que no responde a la FiO₂; las unidades de V/Q bajo, sí: es lo que distingue una
 * hipoxemia refractaria de una corregible. Dantzker (1979) midió en el SDRA un modo de shunt o V/Q < 0,01 que recibía
 * cerca de la mitad del gasto y que la PEEP reducía, y Gattinoni (2006) que el pulmón reclutable varía mucho de un
 * paciente a otro (13 ± 11 %) junto a un 24 % de media que no se recluta: de ahí las dos partes del shunt.
 *
 * Límites: la PAO₂ sale de una ecuación de estado estacionario, no de un balance de O₂ en la capacidad residual. En
 * apnea cae porque sube la PaCO₂, no porque el pulmón se vacíe de O₂, así que no sirve para enseñar preoxigenación ni
 * tiempos de desaturación. No hay efecto Bohr, ni atelectasia por absorción con FiO₂ alta.
 */

/** Presión barométrica y vapor de agua a 37 °C (mmHg). D. */
const PB_MMHG = 760;
const PH2O_MMHG = 47;
/** Capacidad de la hemoglobina (mL O₂/g) y solubilidad del O₂ en sangre (mL O₂/L por mmHg). D-secundario (libro de texto). */
const HUFNER_ML_G = 1.34;
const O2_SOLUBILITY_ML_L = 0.03;
/** Constante de la ecuación de V/Q: la misma 0,863 de la ventilación alveolar (STPD → BTPS). D. */
const VQ_K = 0.863;
/** Suelo de la PAO₂ (mmHg): sin él, una PaCO₂ extrema daría una presión negativa. P. */
const PAO2_MIN_MMHG = 20;
/**
 * Constante de tiempo de la PaO₂ hacia su equilibrio (s): el gas alveolar se renueva en pocas respiraciones y la muestra
 * arterial promedia unos segundos. No se acelera, a diferencia del tramo lento del CO₂: ya es rápida. P.
 */
export const PAO2_TAU_S = 30;
/** Cada cuánto se resuelve el equilibrio (s de simulación): basta y evita resolverlo en cada paso de 4 ms. P. */
const PERIODO_EQUILIBRIO_S = 0.25;

/** Curva de disociación estándar: S = ((PO₂³ + 150·PO₂)⁻¹ · 23400 + 1)⁻¹, Severinghaus 1979, ec. 1. D. */
export function saturation(po2: number): number {
  return po2 <= 0 ? 0 : 1 / (23400 / (po2 * po2 * po2 + 150 * po2) + 1);
}

/** Inversa de la curva por bisección: la curva es monótona y así vale para cualquier saturación. */
export function po2FromSaturation(s: number): number {
  let lo = 0.1,
    hi = 2000;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (saturation(m) < s) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** Contenido de O₂ de la sangre (mL/L): unido a la hemoglobina más disuelto. */
function contenido(po2: number, hbGdL: number): number {
  return HUFNER_ML_G * hbGdL * 10 * saturation(po2) + O2_SOLUBILITY_ML_L * po2;
}

/** PO₂ de una sangre con ese contenido (mL/L). */
function po2DeContenido(c: number, hbGdL: number): number {
  let lo = 0.1,
    hi = 2000;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (contenido(m, hbGdL) < c) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** PO₂ de las unidades de V/Q bajo: donde el O₂ que les entra por la ventilación iguala al que toma su sangre. */
function po2VqBajo(p: GasExchangeParams, pio2: number, techo: number, cvo2: number): number {
  let lo = 0.1,
    hi = techo;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if ((p.lowVqRatio * (pio2 - m)) / VQ_K > contenido(m, p.hbGdL) - cvo2) lo = m;
    else hi = m;
  }
  return lo;
}

export interface OxygenEquilibrium {
  /** PO₂ alveolar de las unidades ideales (mmHg). */
  pAO2: number;
  pao2: number;
  sao2: number;
  shunt: number;
  /** PO₂ venosa mixta (mmHg). */
  pvo2: number;
  cao2MlL: number;
  cvo2MlL: number;
}

/** Equilibrio del intercambio de O₂ para una FiO₂, una PaCO₂ y una fracción reclutada. Puro y determinista. */
export function oxygenEquilibrium(p: GasExchangeParams, fio2: number, paco2: number, recruited: number): OxygenEquilibrium {
  const r = p.vco2MlMin / p.vo2MlMin;
  const pio2 = fio2 * (PB_MMHG - PH2O_MMHG);
  const pAO2 = Math.max(PAO2_MIN_MMHG, pio2 - paco2 / r);
  const shunt = p.shuntBase + p.shuntRecruitable * (1 - recruited);
  const extraccion = p.vo2MlMin / p.cardiacOutputLMin;
  const capilar = contenido(pAO2, p.hbGdL);
  // CvO₂ depende de CaO₂ y al revés: punto fijo amortiguado. Con shunt alto el paso sin amortiguar oscila.
  let cao2 = capilar;
  for (let i = 0; i < 40; i++) {
    const cvo2 = Math.max(0, cao2 - extraccion);
    const bajo = p.lowVqFrac > 0 ? contenido(po2VqBajo(p, pio2, pAO2, cvo2), p.hbGdL) : 0;
    const nuevo = (1 - shunt - p.lowVqFrac) * capilar + p.lowVqFrac * bajo + shunt * cvo2;
    const hecho = Math.abs(nuevo - cao2) < 1e-7;
    cao2 += 0.6 * (nuevo - cao2);
    if (hecho) break;
  }
  const cvo2 = Math.max(0, cao2 - extraccion);
  const pao2 = po2DeContenido(cao2, p.hbGdL);
  return { pAO2, pao2, sao2: saturation(pao2), shunt, pvo2: po2DeContenido(cvo2, p.hbGdL), cao2MlL: cao2, cvo2MlL: cvo2 };
}

export interface OxygenState {
  pao2: number;
  sao2: number;
  /** PaO₂/FiO₂ (mmHg) con la FiO₂ que entrega el mezclador. */
  pafi: number;
  /** PaO₂ y PaO₂/FiO₂ hacia las que tiende con la ventilación y el reclutamiento de ahora; null sin ventilación alveolar. */
  pao2Target: number | null;
  pafiTarget: number | null;
  pAO2: number;
  shunt: number;
  lowVqFrac: number;
  pvo2: number;
}

/** Estado de la PaO₂: sigue a su equilibrio con PAO2_TAU_S. Sólo depende de lo que le entrega el simulador. */
export class Oxygenation {
  pao2: number | null = null;
  private equilibrio = 0;
  private desdeUltimoS = Number.POSITIVE_INFINITY;

  /** `fijar` lleva la PaO₂ a su equilibrio sin retraso: mientras la gasometría fija el estado inicial, lo de ahora es lo basal. */
  step(dtS: number, p: GasExchangeParams, fio2: number, paco2: number, recruited: number, fijar: boolean): void {
    this.desdeUltimoS += dtS;
    if (this.desdeUltimoS >= PERIODO_EQUILIBRIO_S) {
      this.desdeUltimoS = 0;
      this.equilibrio = oxygenEquilibrium(p, fio2, paco2, recruited).pao2;
    }
    if (this.pao2 === null || fijar) this.pao2 = this.equilibrio;
    else this.pao2 += (this.equilibrio - this.pao2) * (1 - Math.exp(-dtS / PAO2_TAU_S));
  }

  /** La parte que describe al paciente (shunt, PAO₂, venosa) es la de ahora; `paco2Target` da el equilibrio con la ventilación actual. */
  state(p: GasExchangeParams, fio2: number, paco2: number, paco2Target: number | null, recruited: number): OxygenState {
    const ahora = oxygenEquilibrium(p, fio2, paco2, recruited);
    const pao2 = this.pao2 ?? ahora.pao2;
    const objetivo = paco2Target === null ? null : oxygenEquilibrium(p, fio2, paco2Target, recruited).pao2;
    return {
      pao2,
      sao2: saturation(pao2),
      pafi: pao2 / fio2,
      pao2Target: objetivo,
      pafiTarget: objetivo === null ? null : objetivo / fio2,
      pAO2: ahora.pAO2,
      shunt: ahora.shunt,
      lowVqFrac: p.lowVqFrac,
      pvo2: ahora.pvo2,
    };
  }
}
