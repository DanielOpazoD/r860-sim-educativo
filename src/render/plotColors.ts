/**
 * Colores del texto pequeño de ejes, ticks y rótulos dibujados en canvas, centralizados para medir su contraste de una
 * vez (CTR-03 en tests/unit/contrastePlots.test.ts). El fondo sobre el que se pintan es el azul pizarra del monitor
 * (#1b3350 → #2c405a → #3b4f68, medido en las capturas del manual SW10); #dbe3ec da 6,5:1 sobre su extremo más claro.
 * Las alarmas no entran aquí: no son texto fijo del trazado.
 */
export const PLOT_TEXT_COLORS = {
  /** Ticks de las curvas Pva/flujo/volumen. */
  tickCurvas: '#dbe3ec',
  /** Escala de tiempo bajo las curvas. */
  ejeTiempo: '#dbe3ec',
  /** Ticks de los bucles P-V y F-V. */
  tickBucles: '#dbe3ec',
  /** Ticks de las tendencias. */
  tickTendencias: '#dbe3ec',
  /** Anotaciones de fase sobre las curvas («Inicio», «Ciclado», «Fin esp.»). */
  anotacion: '#c4e5f2',
  /** Rótulo de la curva previa («Antes») y de la referencia. */
  antes: '#f3d593',
  /** Marca de Pplat sobre la curva. */
  marcaPplat: '#ffe49a',
  /** Marca de Ppico y rótulo de la línea de Pmáx. */
  marcaPpico: '#ffc9c4',
  /** Marca de esfuerzo del paciente. */
  marcaEsfuerzo: '#e3cdff',
  /** Rótulo de la línea de PEEP. */
  lineaPeep: '#ffd66e',
  /** Rótulo de la línea de VT en los bucles. */
  lineaVt: '#9fd7ff',
} as const;

/** Escala tipográfica del canvas: ninguna anotación baja de 10 px (mismo mínimo que el CSS del monitor). */
export const PLOT_TYPE = {
  rotulo: 13,
  tick: 11,
  unidad: 10,
  nota: 10,
} as const;

/** Extremo más claro del fondo del monitor: el caso peor para el contraste del texto de ejes. */
export const PLOT_BACKGROUND_LIGHTEST = '#3b4f68';
