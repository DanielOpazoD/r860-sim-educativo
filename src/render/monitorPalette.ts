/**
 * Paleta y escala tipográfica del monitor dibujado en canvas: curvas, bucles, barra de presión, tendencias y la captura exportada. Es la
 * misma identidad que las variables `--mon-*` de src/ui/styles/01-base.css (E-118, colores medidos en las capturas del
 * manual SW10). `MON_CSS` repite las que también usa la hoja, con la misma clave en kebab-case (`pantallaClaro` ↔
 * `--mon-pantalla-claro`), y CTR-06 (tests/unit/contraste.test.ts) comprueba que no se separen. El texto pequeño se mide
 * contra el fondo en CTR-03 (tests/unit/contrastePlots.test.ts).
 */

/** Añade la opacidad (dos cifras hexadecimales) a un color `#rrggbb`. */
export const alfa = (color: string, aa: string): string => `${color}${aa}`;

/** Colores que la hoja declara como `--mon-*`, con el mismo valor. */
export const MON_CSS = {
  pantallaClaro: '#3b4f68',
  pantalla: '#2c405a',
  pantallaBorde: '#1b3350',
  texto: '#ffffff',
  textoSuave: '#e6ecf2',
  unidad: '#d6dee8',
  rotulo: '#c9d0da',
  eje: '#dbe3ec',
  trazo: '#7d93ad',
  grafitoAlto: '#353b47',
  grafito: '#262b35',
  grafitoBajo: '#1c2029',
  grafitoBorde: '#474e5c',
  bloqueoAlto: '#3a4c63',
  bloqueoBajo: '#273649',
  navAlto: '#0f1727',
  navBajo: '#050b16',
  reposoAlto: '#2b6f1a',
  reposoBajo: '#36832a',
  bandaAltaA: '#a8172c',
  bandaAltaB: '#c41f31',
  bandaAltaTexto: '#fff2f3',
  bandaMediaA: '#c9931d',
  bandaMediaB: '#e0a92a',
  mediaTexto: '#1a1200',
  bandaPreviaA: '#4a5868',
  bandaPreviaB: '#5c6b7d',
  tinta: '#413a30',
  tintaSuave: '#5c5345',
} as const;

/** Lo que sólo se dibuja en canvas: rejilla, rellenos de las curvas y la barra de presión. */
export const MON = {
  /** Rejilla de las curvas y bucles, rejilla de tendencias, línea de cero y trazo por omisión. */
  rejilla: '#5d78966b',
  rejillaSuave: alfa(MON_CSS.trazo, '40'),
  marco: alfa(MON_CSS.trazo, '8c'),
  cero: '#d8e2ecc0',
  lineaPorOmision: '#7fbde055',
  /** Rellenos: presión amarilla (arriba, centro, base), flujo verde (borde, centro), volumen blanco (arriba, base). */
  presion: ['#c9b4000a', '#d8c21a66', '#f4da2ed9'],
  flujo: ['#43b86ccc', '#2c934cb3'],
  volumen: ['#ffffffd9', '#8d97a540'],
  bucleFlujoVolumen: '#2c934c8c',
  /** Borrador del barrido: el fondo de la pantalla casi opaco. */
  barrido: alfa(MON_CSS.pantalla, 'f0'),
  cursorBarrido: alfa(MON_CSS.textoSuave, '88'),
  /** Barra de presión: tubo negro con brillo, relleno verde, marcas cian, Pmáx roja y separador. */
  tubo: ['#060708', '#26292d'],
  tuboContorno: '#7d8a99',
  tuboRelleno: ['#2b8a3b', '#74d67f'],
  tuboMarca: '#3e8fa3',
  pmax: '#ff4a4f',
  marcaBlanca: '#f2f5f8',
  separador: '#4d6480',
  separadorEspera: '#cbbd98',
} as const;

/** Ayudas docentes y series de tendencias: no son del equipo (las ayudas se encienden con «Ayudas»). */
export const AYUDA = {
  peep: '#ffd66e',
  vt: '#9fd7ff',
  pmaxLinea: '#ff7b7bb0',
  ciclado: '#ffd36e80',
  marca: '#b4dcf060',
  referencia: '#edc87e',
  previo: '#b7c4d466',
  union: '#c4f5ffaa',
  cursor: alfa(MON_CSS.texto, 'd0'),
  esfuerzo: '#b2a5ee',
  esfuerzoRelleno: ['#8e82d939', '#8e82d904'],
  esfuerzoEje: ['#6385a64a', '#6385a62a'],
  tendenciaPeep: '#64d7c4',
  tendenciaFr: '#e8d397',
} as const;

/**
 * Colores del texto pequeño de ejes, ticks y rótulos dibujados en canvas, juntos para medir su contraste de una vez
 * (CTR-03). El fondo es el azul pizarra del monitor; #dbe3ec da 6,5:1 sobre su extremo más claro. Las alarmas no
 * entran aquí: no son texto fijo del trazado.
 */
export const PLOT_TEXT_COLORS = {
  /** Ticks de las curvas Pva/flujo/volumen. */
  tickCurvas: MON_CSS.eje,
  /** Escala de tiempo bajo las curvas. */
  ejeTiempo: MON_CSS.eje,
  /** Ticks de los bucles P-V y F-V. */
  tickBucles: MON_CSS.eje,
  /** Ticks de las tendencias. */
  tickTendencias: MON_CSS.eje,
  /** Anotaciones de fase sobre las curvas («Inicio», «Ciclado», «Fin esp.»). */
  anotacion: '#c4e5f2',
  /** Rótulo de la curva previa («Antes») y de la referencia. */
  antes: '#f3d593',
  /** Leyenda «Referencia» de los bucles. */
  referencia: '#eed49d',
  /** Marca de Pplat sobre la curva. */
  marcaPplat: '#ffe49a',
  /** Marca de Ppico y rótulo de la línea de Pmáx. */
  marcaPpico: '#ffc9c4',
  /** Marca de esfuerzo del paciente. */
  marcaEsfuerzo: '#e3cdff',
  /** Rótulo de la línea de PEEP. */
  lineaPeep: AYUDA.peep,
  /** Rótulo de la línea de VT en los bucles. */
  lineaVt: AYUDA.vt,
} as const;

/**
 * Escala tipográfica del monitor en px, la misma que `--mon-fs-*` de la hoja (TIP-02): el canvas sólo dibuja texto en
 * uno de estos pasos, y ninguno baja de 10 px.
 */
export const MON_FS = {
  '2xs': 10,
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 42,
  '6xl': 60,
} as const;
export type PasoTipo = keyof typeof MON_FS;

/** Extremo más claro del fondo del monitor: el caso peor para el contraste del texto de ejes. */
export const PLOT_BACKGROUND_LIGHTEST = MON_CSS.pantallaClaro;
