/**
 * Unidades internas del motor: litros (L), segundos (s) y cmH2O.
 * Toda conversión hacia la presentación es explícita y pasa por aquí (BM-05).
 * Nunca reinyectar un valor redondeado al cálculo.
 */
export type Liters = number;
export type LitersPerSecond = number;
export type Seconds = number;
export type Milliseconds = number;
export type CmH2O = number;
/** Distensibilidad en L/cmH2O (interna). */
export type LitersPerCmH2O = number;
/** Resistencia en cmH2O·s/L (interna). */
export type CmH2OSecondsPerLiter = number;
/** Fracción 0..1 (interna) para FiO2, pausa, etc. */
export type Fraction = number;

export const ML_PER_L = 1000;
export const S_PER_MIN = 60;
export const MS_PER_S = 1000;

export const litersToMl = (v: Liters): number => v * ML_PER_L;
export const mlToLiters = (v: number): Liters => v / ML_PER_L;
export const lpsToLpm = (q: LitersPerSecond): number => q * S_PER_MIN;
export const lpmToLps = (q: number): LitersPerSecond => q / S_PER_MIN;
export const complianceToMlPerCmH2O = (c: LitersPerCmH2O): number => c * ML_PER_L;
export const complianceFromMlPerCmH2O = (c: number): LitersPerCmH2O => c / ML_PER_L;
export const fractionToPercent = (f: Fraction): number => f * 100;
export const percentToFraction = (p: number): Fraction => p / 100;
export const msToS = (ms: Milliseconds): Seconds => ms / MS_PER_S;
export const sToMs = (s: Seconds): Milliseconds => s * MS_PER_S;
export const rrToCycleS = (rrPerMin: number): Seconds => S_PER_MIN / rrPerMin;

/** Comparación con tolerancia para valores en unidades internas. */
export const approxEqual = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol;
