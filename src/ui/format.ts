/** Formatos de tiempo y unidades para el alumno (puros, sin DOM). */
export const clock = (tS: number): string => {
  const t = Math.max(0, Math.floor(tS || 0));
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
};
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const wallDate = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};
export const stamp = (): string => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
/** Unidades con la grafía de pantalla: cmH₂O y «mL» (nunca «ml»). */
export const unitText = (u: string): string =>
  u
    .replace('cmH2O', 'cmH₂O')
    .replace(/\bml\b/g, 'mL')
    .replace(/\bl\/min\b/g, 'L/min');
export function ieText(ratio: number): string {
  if (ratio <= 1 + 1e-9) {
    const e = Math.round((1 / ratio) * 100) / 100;
    return `1:${e}`;
  }
  return `${Math.round(ratio * 100) / 100}:1`;
}
