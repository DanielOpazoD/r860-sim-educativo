/**
 * Renderizado exclusivamente visual (canvas). Nunca modifica el estado de la simulación.
 * Estilo de curvas, bucles, manómetro, tendencias y esfuerzo derivado de «R860 Lab» v1.1 (src/plots.js, MIT 2026),
 * portado a TypeScript sobre las muestras del motor de este proyecto.
 * Punto de señal: [t s, Paw cmH2O, flujo L/min, volumen mL, Pmus cmH2O, ciclo].
 *
 * Fachada: cada parte vive en su módulo y aquí se reexporta, para que quien dibuja importe de un solo sitio.
 */
export { canvasLogicalWidth } from './canvas';
export * from './signal';
export * from './waves';
export * from './loops';
export * from './gauge';
export * from './effortCharts';
export * from './trends';
