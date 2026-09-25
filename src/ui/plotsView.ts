/**
 * Curvas, bucles, tendencias y manómetro. Dueño de la traza (`points`), de la congelación con historia y cursor de
 * medición, del ciclo de referencia, de la escala de dibujo con histéresis y del planificador de dibujo
 * (requestAnimationFrame sólo dibuja cuando algo cambió).
 */
import type { EngineFrame } from '../engine/simulator';
import { formatNumber as f } from '../domain/units';
import {
  appendSamples,
  canvasLogicalWidth,
  cursorTimeAt,
  cyclePoints,
  drawGauge,
  drawLoop,
  drawMuscle,
  drawMuscleLoop,
  drawTrends,
  drawWave,
  getBounds,
  nearestSample,
  stableBounds,
  visiblePoints,
  WAVE_MARGIN,
  type Bounds,
  type Point,
  type ScaleState,
} from '../render/plots';
import type { AppContext } from './context';
import { $, icon, put } from './dom';
import { clock } from './format';

export interface PlotsView {
  readonly points: Point[];
  /** Valor que muestra la columna de presión (con la amortiguación de presentación). */
  readonly gaugePaw: number | null;
  readonly frozen: boolean;
  /** Añade todas las muestras del cuadro a la traza y reinicia si el tiempo retrocedió. */
  ingest(prev: EngineFrame | null, fr: EngineFrame): void;
  /** Vacía la traza y el ciclo de referencia (escenario nuevo, sesión importada). */
  reset(): void;
  /** Vacía sólo la traza (fixture fotográfico). */
  clearPoints(): void;
  markDirty(): void;
  renderPlots(): void;
  toggleFreeze(): void;
  saveLoopReference(): void;
  clearLoopReference(): void;
  setWaveWindow(s: number): void;
  setWaveStyle(style: 'sweep' | 'scroll'): void;
  /** Deslizador de historia (0–1000) con las curvas congeladas. */
  slideHistory(value: number): void;
  /** Deslizador del cursor de medición (0–1000) sobre la ventana congelada: el mismo cálculo que el puntero. */
  slideCursor(value: number): void;
  /** Arranca el bucle de animación y los oyentes de canvas. */
  start(): void;
}

export function createPlotsView(ctx: AppContext, deps: { teacherVisible: () => boolean }): PlotsView {
  let points: Point[] = [];
  // Instantes de disparo detectado por el sensor (s de simulación): el marcador ámbar de la curva de presión.
  let triggerDetectionsS: number[] = [],
    frozenTriggerDetections: number[] = [],
    lastTriggerSeq = 0;
  let waveWindow = 12,
    waveStyle: 'sweep' | 'scroll' = 'sweep';
  let frozen = false,
    frozenPoints: Point[] = [],
    freezeEnd = 0,
    reviewEnd = 0,
    cursorTime: number | null = null,
    cursorRatio: number | null = null,
    loopReference: Point[] | null = null;
  let dirty = true,
    lastPlot = 0,
    lastView = '';
  // Escala de dibujo por lienzo, con histéresis (`stableBounds`). Vive aquí y no en el renderizador para que éste siga
  // siendo una función de sus argumentos: quien fija el instante de una captura fija también su escala.
  const scales: Record<'waves' | 'basic', ScaleState | null> = { waves: null, basic: null };
  const resetScales = (): void => {
    scales.waves = null;
    scales.basic = null;
  };
  // Amortiguación de presentación del manómetro (P): la apertura de la válvula espiratoria dura unas decenas de ms,
  // menos que el refresco de la pantalla, así que la columna se amortigua al bajar (0,07 s) para que la transición se
  // vea como un movimiento. Sólo afecta a la columna: curvas, métricas y alarmas usan la señal sin amortiguar.
  const GAUGE_FALL_TAU_S = 0.07;
  let gaugePaw: number | null = null,
    gaugeAt = 0,
    gaugeAnimating = false;

  function gaugeValue(target: number, live: boolean): number {
    const now = performance.now();
    const dt = Math.min(0.25, Math.max(0, (now - gaugeAt) / 1000));
    gaugeAt = now;
    if (gaugePaw === null || !live || target >= gaugePaw) gaugePaw = target;
    else gaugePaw += (1 - Math.exp(-dt / GAUGE_FALL_TAU_S)) * (target - gaugePaw);
    gaugeAnimating = Math.abs(target - gaugePaw) > 0.05;
    return gaugePaw;
  }

  function activeTrace(): { pts: Point[]; end: number } {
    return { pts: frozen ? frozenPoints : points, end: frozen ? reviewEnd : ctx.simS() };
  }
  /**
   * Al congelar se conserva el trazado elegido: congelar es capturar la imagen que se estaba mirando, y cambiarle la
   * geometría en ese instante la destruye. Sólo al recorrer la historia se dibuja en continuo: en barrido, arrastrar la
   * ventana hacía rotar la traza alrededor de la unión en vez de desplazarla, y el eje no podía decir qué tiempo se
   * estaba mirando. De vuelta al final de la historia, vuelve el trazado elegido.
   */
  const drawStyle = (): 'sweep' | 'scroll' => (frozen && reviewEnd < freezeEnd - 1e-9 ? 'scroll' : waveStyle);
  function waveBounds(canvas: 'waves' | 'basic', pts: Point[], end: number, peep: number, vtMl: number): Bounds {
    const measured = getBounds(visiblePoints(pts, end, waveWindow), peep, vtMl);
    // Congeladas no se mueven: la escala es la de lo que se ve, sin memoria.
    if (frozen) return measured;
    const s = stableBounds(scales[canvas], measured, end, waveWindow, waveStyle);
    scales[canvas] = s;
    return s.bounds;
  }
  function renderPlots(): void {
    const fr = ctx.frame;
    if (!fr) return;
    const view = ctx.view;
    if (view !== lastView) {
      // Al volver a una vista su escala guardada ya no describe lo que hay: se parte de lo visible.
      resetScales();
      lastView = view;
    }
    const { pts, end } = activeTrace();
    const peep = fr.settings.peep === 'off' ? 0 : fr.settings.peep,
      vtMl = fr.settings.vt * 1000;
    const style = drawStyle();
    if (view === 'waves')
      drawWave($<HTMLCanvasElement>('#waves-canvas'), pts, end, peep, vtMl, {
        window: waveWindow,
        style,
        frozen,
        cursorTime,
        bounds: waveBounds('waves', pts, end, peep, vtMl),
        pmax: fr.settings.pmax,
        triggerDetectionsS: frozen ? frozenTriggerDetections : triggerDetectionsS,
      });
    else if (view === 'basic')
      drawWave($<HTMLCanvasElement>('#basic-wave-canvas'), pts, end, peep, vtMl, {
        window: waveWindow,
        style,
        frozen,
        bounds: waveBounds('basic', pts, end, peep, vtMl),
        pmax: fr.settings.pmax,
        triggerDetectionsS: frozen ? frozenTriggerDetections : triggerDetectionsS,
      });
    else if (view === 'loops') {
      drawLoop($<HTMLCanvasElement>('#pv-canvas'), pts, loopReference, peep, vtMl, 'pv', {
        vtMark: fr.settings.mode === 'AC_VC',
      });
      drawLoop($<HTMLCanvasElement>('#fv-canvas'), pts, loopReference, peep, vtMl, 'fv', {
        vtMark: fr.settings.mode === 'AC_VC',
      });
    } else if (view === 'trends')
      drawTrends(
        $<HTMLCanvasElement>('#trends-canvas'),
        fr.trends.map((t) => ({ t: t.tMs / 1000, ppeak: t.ppeak, peep: t.peepe, vte: t.vte * 1000, rr: t.rr })),
        ctx.simS(),
      );
    drawGauge($<HTMLCanvasElement>('#gauge-canvas'), {
      paw: gaugeValue(fr.live.paw, ctx.running && !frozen && fr.ventilation === 'ventilating'),
      pmax: fr.settings.pmax,
      ppeak: fr.metrics.ppeak?.value ?? fr.live.ppeakCurrent,
      peep,
      standby: fr.ventilation === 'standby',
      vteMl: fr.metrics.vte?.value === null || fr.metrics.vte?.value === undefined ? null : fr.metrics.vte.value * 1000,
      fio2Pct: fr.metrics.fio2?.value === null || fr.metrics.fio2?.value === undefined ? null : fr.metrics.fio2.value * 100,
    });
    if (deps.teacherVisible()) {
      drawMuscle($<HTMLCanvasElement>('#muscle-canvas'), points, ctx.simS());
      drawMuscleLoop($<HTMLCanvasElement>('#muscle-loop-canvas'), points);
    }
  }
  function tick(now: number): void {
    if (ctx.frame && !document.hidden && now - lastPlot > 32 && (dirty || gaugeAnimating)) {
      lastPlot = now;
      renderPlots();
      dirty = false;
    }
    requestAnimationFrame(tick);
  }
  /** Pone el cursor de medición en una fracción de la ventana congelada, escribe la lectura y la anuncia. */
  function setCursorAt(ratio: number): void {
    if (!frozen || !frozenPoints.length) return;
    cursorRatio = Math.max(0, Math.min(1, ratio));
    cursorTime = cursorTimeAt(cursorRatio, drawStyle(), reviewEnd, waveWindow);
    const nearest = nearestSample(frozenPoints, cursorTime) as Point;
    const lectura = `t ${f(nearest[0], 2)} s · Paw ${f(nearest[1], 1)} cmH₂O · Flujo ${f(nearest[2], 1)} L/min · Volumen ${f(nearest[3], 0)} mL · datos del sensor`;
    put('#inspector-label', lectura);
    // El propio control anuncia la lectura: el rótulo es texto sin región viva, y con lector de pantalla no se oía.
    const slider = $<HTMLInputElement>('#cursor-slider');
    slider.value = String(Math.round(cursorRatio * 1000));
    slider.setAttribute('aria-valuetext', lectura);
    dirty = true;
  }
  function toggleFreeze(): void {
    frozen = !frozen;
    cursorTime = null;
    cursorRatio = null;
    resetScales();
    const slider = $<HTMLInputElement>('#cursor-slider');
    slider.value = '500';
    slider.removeAttribute('aria-valuetext');
    if (frozen) {
      frozenPoints = points.map((x) => [...x] as Point);
      frozenTriggerDetections = [...triggerDetectionsS];
      freezeEnd = ctx.simS();
      reviewEnd = freezeEnd;
      ($('#history-slider') as HTMLInputElement).value = '1000';
      put(
        '#inspector-label',
        'Curvas congeladas tal como estaban; los números siguen en vivo. Mueve el cursor o toca la curva; al recorrer la historia el trazado pasa a continuo.',
      );
    } else frozenPoints = [];
    $('#signal-inspector').hidden = !frozen;
    $('#frozen-ribbon').hidden = !frozen;
    $('#freeze-button').innerHTML = icon(frozen ? 'play' : 'freeze') + `<span>${frozen ? 'Reanudar curvas' : 'Congelar curvas'}</span>`;
    $('#freeze-button').classList.toggle('active', frozen);
    dirty = true;
  }
  function onPointer(e: PointerEvent): void {
    if (!frozen || !frozenPoints.length) return;
    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const w = canvasLogicalWidth(canvas) || 608;
    const x = ((e.clientX - rect.left) / rect.width) * w;
    setCursorAt((x - WAVE_MARGIN.left) / (w - WAVE_MARGIN.left - WAVE_MARGIN.right));
  }
  return {
    get gaugePaw() {
      return gaugePaw;
    },
    get points() {
      return points;
    },
    get frozen() {
      return frozen;
    },
    ingest(prev, fr) {
      if (prev && prev.simTimeMs > fr.simTimeMs) {
        // sesión nueva (escenario o importación): el historial anterior no debe filtrar las muestras nuevas
        points = [];
        triggerDetectionsS = [];
        lastTriggerSeq = 0;
        loopReference = null;
        resetScales();
      }
      for (const e of fr.eventsTail) {
        if (e.kind !== 'breath' || e.sequence <= lastTriggerSeq) continue;
        const p = e.payload as { trigger?: unknown };
        if (typeof p.trigger === 'number') {
          triggerDetectionsS.push(e.simTimeMs / 1000);
          if (triggerDetectionsS.length > 200) triggerDetectionsS = triggerDetectionsS.slice(-200);
        }
        lastTriggerSeq = Math.max(lastTriggerSeq, e.sequence);
      }
      appendSamples(points, fr.samples);
      dirty = true;
    },
    reset() {
      gaugePaw = null;
      points = [];
      triggerDetectionsS = [];
      lastTriggerSeq = 0;
      loopReference = null;
      resetScales();
    },
    clearPoints() {
      points = [];
      triggerDetectionsS = [];
      lastTriggerSeq = 0;
      resetScales();
      dirty = true;
    },
    markDirty() {
      dirty = true;
    },
    renderPlots,
    toggleFreeze,
    saveLoopReference() {
      const cyc = cyclePoints(points);
      if (cyc.length < 3) {
        ctx.toast('Espera un ciclo completo.', true);
        return;
      }
      loopReference = cyc.map((x) => [...x] as Point);
      put('#loop-reference-label', `Referencia ${clock(cyc[0]![0])}`);
      ctx.lesson.flags.referenceLoop = true;
      dirty = true;
      ctx.lesson.evaluate();
    },
    clearLoopReference() {
      loopReference = null;
      put('#loop-reference-label', 'Sin referencia');
      dirty = true;
    },
    setWaveWindow(s) {
      waveWindow = s;
      resetScales();
      if (cursorRatio !== null) setCursorAt(cursorRatio);
      dirty = true;
    },
    setWaveStyle(style) {
      waveStyle = style;
      resetScales();
      dirty = true;
    },
    slideHistory(value) {
      const start = Math.min(freezeEnd, frozenPoints[0]?.[0] ?? freezeEnd);
      reviewEnd = Math.min(freezeEnd, start + waveWindow + ((freezeEnd - start - waveWindow) * value) / 1000);
      // El cursor conserva su posición en la ventana, no su instante, que puede haber quedado fuera de lo que se ve.
      if (cursorRatio !== null) setCursorAt(cursorRatio);
      else {
        cursorTime = null;
        put('#inspector-label', `Historia congelada · final de ventana ${clock(reviewEnd)}. Los números del monitor siguen en vivo.`);
      }
      dirty = true;
    },
    slideCursor(value) {
      setCursorAt(value / 1000);
    },
    start() {
      const canvas = $('#waves-canvas');
      // También `pointerdown`: en una pantalla táctil no existe «mover sin pulsar», así que tocar la curva debe bastar.
      canvas.addEventListener('pointermove', onPointer);
      canvas.addEventListener('pointerdown', onPointer);
      requestAnimationFrame(tick);
    },
  };
}
