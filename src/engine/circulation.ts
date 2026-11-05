import type { CirculationParams } from '../domain/types';

/**
 * Corazón-pulmón de modelo (P): gasto cardíaco y presión arterial media de un adulto virtual, para la docencia. Como la
 * gasometría, no es un valor del monitor del ventilador. Lee la presión media de la vía aérea y no realimenta la
 * mecánica.
 *
 * Retorno venoso de Guyton: el gasto es el gradiente entre la presión media de llenado sistémico (Pmsf) y la de la
 * aurícula derecha (Pad), dividido por la resistencia al retorno venoso:
 *   GC = (Pmsf − Pad) / Rrv
 * La ventilación con presión positiva sube la presión pleural, y con ella la Pad, que frena el retorno. Sólo llega a la
 * pleura una fracción de la presión alveolar: la que deja la pared torácica,
 *   ΔPpl / ΔPalv = Cpulmón / (Cpulmón + Cpared)
 * así que un pulmón rígido (SDRA) transmite menos y la misma PEEP cuesta menos gasto (Mahmood y Pinsky 2018: con el
 * pulmón poco distensible el efecto «a menudo se amortigua»). El diafragma, al bajar, sube la presión abdominal y con
 * ella la Pmsf: una parte de la subida de la Pad queda compensada.
 *   Pad = Pad₀ + ΔPpl          Pmsf = Pmsf₀ + fabd · ΔPpl          PAM = Pad + GC · Rvs
 * La volemia es la Pmsf₀: el paciente hipovolémico tiene menos gradiente que perder y cae más en proporción.
 *
 * Límites: no modela la poscarga del ventrículo derecho ni la interdependencia ventricular, el mecanismo al que Jardin
 * (1981) atribuyó la caída del gasto con la PEEP en el SDRA; en un SDRA el modelo subestima esa caída. Tampoco hay
 * reflejos (frecuencia cardíaca, tono venoso), variación latido a latido ni curva arterial.
 */
export const DEFAULT_CIRCULATION: CirculationParams = {
  /**
   * Pmsf, Pad₀ y Rrv dan con el banco por omisión (presión media de la vía aérea ≈ 8 cmH₂O, compliance 50 mL/cmH₂O) un
   * gasto de 5 L/min, una Pad de 4 mmHg y un gradiente de retorno de ≈ 8,8 mmHg, en el extremo alto de los 4–8 mmHg que
   * citan Mahmood y Pinsky. P calibrado.
   */
  pmsfMmHg: 11,
  praBaseMmHg: 2.5,
  rvrMmHgMinL: 1.55,
  /** Compliance de la pared torácica de un adulto (L/cmH₂O). D-secundario (libro de texto). */
  chestWallComplianceL: 0.2,
  /** Fracción de la subida de la presión pleural que la presión abdominal devuelve a la Pmsf. P. */
  abdominalFraction: 0.5,
  /** Resistencia vascular sistémica (mmHg·min/L): PAM ≈ 89 mmHg con el banco. P calibrado. */
  svrMmHgMinL: 17,
};

/** mmHg por cmH₂O. */
const CMH2O_A_MMHG = 0.7356;
/** Suelo del gasto (L/min): con un gradiente nulo, el modelo no da un gasto negativo. P. */
const GASTO_MIN_LMIN = 0.5;
/** Constante de tiempo del gasto hacia su equilibrio (s): el retorno se ajusta en pocos latidos. P. */
export const GASTO_TAU_S = 10;

export const circulationParams = (p: Partial<CirculationParams> | undefined): CirculationParams => ({ ...DEFAULT_CIRCULATION, ...p });

/** Fracción de la presión alveolar que llega a la pleura: Cpulmón / (Cpulmón + Cpared), con Cpulmón de la del sistema. */
export function pleuralTransmission(crsL: number, chestWallL: number): number {
  // 1/Crs = 1/Cpulmón + 1/Cpared. Un sistema más distensible que la propia pared no tiene sentido: se acota.
  const inversa = 1 / crsL - 1 / chestWallL;
  if (!(inversa > 0)) return 0.9;
  const pulmon = 1 / inversa;
  return pulmon / (pulmon + chestWallL);
}

export interface CirculationEquilibrium {
  transmission: number;
  /** Subida de la presión pleural media (mmHg). */
  pplMmHg: number;
  pmsfMmHg: number;
  praMmHg: number;
  cardiacOutputLMin: number;
  mapMmHg: number;
}

/** Equilibrio del retorno venoso para una presión media de la vía aérea (cmH₂O). Puro y determinista. */
export function circulationEquilibrium(c: CirculationParams, crsL: number, pmeanCmH2O: number): CirculationEquilibrium {
  const transmission = pleuralTransmission(crsL, c.chestWallComplianceL);
  const pplMmHg = transmission * Math.max(0, pmeanCmH2O) * CMH2O_A_MMHG;
  const pmsfMmHg = c.pmsfMmHg + c.abdominalFraction * pplMmHg;
  const praMmHg = c.praBaseMmHg + pplMmHg;
  const cardiacOutputLMin = Math.max(GASTO_MIN_LMIN, (pmsfMmHg - praMmHg) / c.rvrMmHgMinL);
  return { transmission, pplMmHg, pmsfMmHg, praMmHg, cardiacOutputLMin, mapMmHg: praMmHg + cardiacOutputLMin * c.svrMmHgMinL };
}

export interface CirculationState {
  cardiacOutputLMin: number;
  mapMmHg: number;
  praMmHg: number;
  pmsfMmHg: number;
  /** Fracción de la presión alveolar que llega a la pleura. */
  transmission: number;
  /** Entrega de O₂: GC × CaO₂ (mL/min). */
  do2MlMin: number;
  /** La entrega hacia la que tiende, con el gasto y la PaO₂ de equilibrio; null sin ventilación alveolar. */
  do2TargetMlMin: number | null;
}

/** Estado del gasto: sigue a su equilibrio con GASTO_TAU_S. Sólo depende de lo que le entrega el simulador en cada paso. */
export class Circulation {
  /** Gasto cardíaco (L/min); antes del primer paso, el de reposo por omisión. */
  cardiacOutputLMin = 5;
  private equilibrio: CirculationEquilibrium | null = null;

  /** `fijar` lleva el gasto a su equilibrio sin retraso: el estado inicial ya está asentado. */
  step(dtS: number, c: CirculationParams, crsL: number, pmeanCmH2O: number, fijar: boolean): void {
    this.equilibrio = circulationEquilibrium(c, crsL, pmeanCmH2O);
    const meta = this.equilibrio.cardiacOutputLMin;
    if (fijar) this.cardiacOutputLMin = meta;
    else this.cardiacOutputLMin += (meta - this.cardiacOutputLMin) * (1 - Math.exp(-dtS / GASTO_TAU_S));
  }

  /** `cao2MlL`: contenido arterial de O₂ de ahora, y el de equilibrio (mL/L). null antes del primer paso. */
  state(c: CirculationParams, cao2MlL: number, cao2TargetMlL: number | null): CirculationState | null {
    const e = this.equilibrio;
    if (!e) return null;
    const gc = this.cardiacOutputLMin;
    return {
      cardiacOutputLMin: gc,
      mapMmHg: e.praMmHg + gc * c.svrMmHgMinL,
      praMmHg: e.praMmHg,
      pmsfMmHg: e.pmsfMmHg,
      transmission: e.transmission,
      do2MlMin: gc * cao2MlL,
      do2TargetMlMin: cao2TargetMlL === null ? null : e.cardiacOutputLMin * cao2TargetMlL,
    };
  }
}
