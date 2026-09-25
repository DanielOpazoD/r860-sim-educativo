/**
 * Colores del texto pequeño de ejes, ticks y rótulos dibujados en canvas, centralizados para medir su contraste de una
 * vez (CTR-03 en tests/unit/contrastePlots.test.ts). El fondo sobre el que se pintan es el degradado del monitor
 * (#004eaf → #0053b5 → #0045a6); #b3e3fa da ≥ 5,2:1 incluso sobre su extremo más claro. Marcas y mensajes (PEEP ámbar,
 * alarmas) no entran aquí: no son texto de ejes.
 */
export const PLOT_TEXT_COLORS = {
  /** Ticks de las curvas Pva/flujo/volumen. */
  tickCurvas: '#b3e3fa',
  /** Escala de tiempo bajo las curvas. */
  ejeTiempo: '#b3e3fa',
  /** Ticks de los bucles P-V y F-V. */
  tickBucles: '#b3e3fa',
  /** Ticks de las tendencias. */
  tickTendencias: '#b3e3fa',
} as const;

/** Extremo más claro del fondo del monitor: el caso peor para el contraste del texto de ejes. */
export const PLOT_BACKGROUND_LIGHTEST = '#0053b5';
