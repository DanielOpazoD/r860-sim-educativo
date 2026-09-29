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
  expandBounds,
  getBounds,
  cursorMeasurements,
  nearestSample,
  stableBounds,
  visiblePoints,
  waveMarkers,
  WAVE_MARGIN,
  type Bounds,
  type Point,
  type ScaleState,
  type WaveBreath,
  type WaveMarker,
} from '../render/plots';
import type { AppContext } from './context';
import { $, icon, put } from './dom';
import { clock } from './format';

export interface PlotsView {
  readonly points: Point[];
  /** Valor que muestra la columna de presión (con la amortiguación de presentación). */
  readonly gaugePaw: number | null;
  readonly frozen: boolean;
  readonly waveScaleMode: 'auto' | 'fixed';
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
  /** Guarda la última respiración completa como referencia dibujada atenuada bajo las curvas. */
  saveWaveReference(): void;
  clearWaveReference(): void;
  /** Instante de inicio de la respiración guardada como referencia (s), o null. */
  readonly waveRefAt: number | null;
  setWaveWindow(s: number): void;
  setWaveStyle(style: 'sweep' | 'scroll'): void;
  setWaveScaleMode(mode: 'auto' | 'fixed'): void;
  /** Deslizador de historia (0–1000) con las curvas congeladas. */
  slideHistory(value: number): void;
  /** Deslizadores A/B (0–1000) sobre la ventana congelada. */
  slideCursor(value: number, cursor: 'A' | 'B'): void;
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
    waveStyle: 'sweep' | 'scroll' = 'sweep',
    waveScaleMode: 'auto' | 'fixed' = 'auto';
  let frozen = false,
    frozenPoints: Point[] = [],
    freezeEnd = 0,
    reviewEnd = 0,
    cursorTime: number | null = null,
    cursorRatio: number | null = null,
    cursorTimeB: number | null = null,
    cursorRatioB: number | null = null,
    loopReference: Point[] | null = null,
    waveReference: Point[] | null = null,
    breaths: WaveBreath[] = [],
    markerCache: WaveMarker[] = [],
    markerCacheKey = '',
    mechanicsSignature = '';
  const fixedBounds: Record<'waves' | 'basic', Bounds | null> = { waves: null, basic: null };
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
    if (waveScaleMode === 'fixed') {
      fixedBounds[canvas] = fixedBounds[canvas] ? expandBounds(fixedBounds[canvas], measured) : (scales[canvas]?.bounds ?? measured);
      return fixedBounds[canvas];
    }
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
    const latestBreath = [...breaths].reverse().find((b) => b.endSimTimeMs <= end * 1000 + 1) ?? null;
    const lastHold = fr.procedure.last.inspHold;
    const pplat = lastHold?.quality === 'valid' ? lastHold.values.pplat?.value : null;
    const holdBreath =
      lastHold?.breathId && (lastHold.completedAtMs ?? 0) >= (end - waveWindow) * 1000
        ? (breaths.find((b) => b.breathId === lastHold.breathId) ?? null)
        : null;
    const annotatedBreath = holdBreath ?? latestBreath;
    const markerKey = `${annotatedBreath?.breathId ?? ''}:${lastHold?.procedureId ?? ''}:${typeof pplat === 'number' ? pplat : ''}`;
    if (markerKey !== markerCacheKey) {
      markerCacheKey = markerKey;
      markerCache = waveMarkers(
        pts,
        annotatedBreath,
        lastHold && typeof pplat === 'number'
          ? {
              breathId: lastHold.breathId,
              startedAtMs: lastHold.startedAtMs,
              completedAtMs: lastHold.completedAtMs,
              pplat,
            }
          : null,
      );
    }
    const markers = markerCache;
    if (view === 'waves')
      drawWave($<HTMLCanvasElement>('#waves-canvas'), pts, end, peep, vtMl, {
        window: waveWindow,
        style,
        frozen,
        cursorTime,
        cursorTimeB,
        markers,
        bounds: waveBounds('waves', pts, end, peep, vtMl),
        pmax: fr.settings.pmax,
        triggerDetectionsS: frozen ? frozenTriggerDetections : triggerDetectionsS,
        reference: waveReference,
      });
    else if (view === 'basic')
      drawWave($<HTMLCanvasElement>('#basic-wave-canvas'), pts, end, peep, vtMl, {
        window: waveWindow,
        style,
        frozen,
        markers,
        bounds: waveBounds('basic', pts, end, peep, vtMl),
        pmax: fr.settings.pmax,
        triggerDetectionsS: frozen ? frozenTriggerDetections : triggerDetectionsS,
        reference: waveReference,
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
    const muscleLoop = $<HTMLCanvasElement>('#muscle-loop-canvas');
    if (deps.teacherVisible() && muscleLoop.offsetParent !== null) {
      drawMuscle($<HTMLCanvasElement>('#muscle-canvas'), points, ctx.simS());
      drawMuscleLoop(muscleLoop, points);
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
  function updateCursorReadout(): void {
    if (cursorTime === null) return;
    const a = nearestSample(frozenPoints, cursorTime) as Point;
    const parts = [`A · t ${f(a[0], 2)} s · Paw ${f(a[1], 1)} · Flujo ${f(a[2], 1)} · V ${f(a[3], 0)}`];
    if (cursorTimeB !== null) {
      const b = nearestSample(frozenPoints, cursorTimeB) as Point;
      const m = cursorMeasurements(a, b);
      parts.push(`B · t ${f(b[0], 2)} s · Paw ${f(b[1], 1)} · Flujo ${f(b[2], 1)} · V ${f(b[3], 0)}`);
      parts.push(`ΔP ${f(m.deltaP, 1)} cmH₂O · Ti/Δt ${f(m.deltaT, 2)} s · τesp ${m.tauExp === null ? '—' : f(m.tauExp, 2) + ' s'}`);
    }
    const lectura = parts.join('  |  ');
    put('#inspector-label', lectura);
    for (const id of ['#cursor-slider', '#cursor-b-slider']) document.querySelector(id)?.setAttribute('aria-valuetext', lectura);
  }
  function setCursorAt(ratio: number, cursor: 'A' | 'B' = 'A'): void {
    if (!frozen || !frozenPoints.length) return;
    const bounded = Math.max(0, Math.min(1, ratio));
    const time = cursorTimeAt(bounded, drawStyle(), reviewEnd, waveWindow);
    if (cursor === 'A') {
      cursorRatio = bounded;
      cursorTime = time;
    } else {
      cursorRatioB = bounded;
      cursorTimeB = time;
    }
    const slider = $<HTMLInputElement>(cursor === 'A' ? '#cursor-slider' : '#cursor-b-slider');
    slider.value = String(Math.round(bounded * 1000));
    updateCursorReadout();
    dirty = true;
  }
  function toggleFreeze(): void {
    frozen = !frozen;
    cursorTime = null;
    cursorRatio = null;
    cursorTimeB = null;
    cursorRatioB = null;
    resetScales();
    const slider = $<HTMLInputElement>('#cursor-slider');
    const sliderB = $<HTMLInputElement>('#cursor-b-slider');
    slider.value = '350';
    sliderB.value = '650';
    slider.removeAttribute('aria-valuetext');
    sliderB.removeAttribute('aria-valuetext');
    if (frozen) {
      frozenPoints = points.map((x) => [...x] as Point);
      frozenTriggerDetections = [...triggerDetectionsS];
      freezeEnd = ctx.simS();
      reviewEnd = freezeEnd;
      ($('#history-slider') as HTMLInputElement).value = '1000';
      put('#inspector-label', 'Curvas congeladas tal como estaban; los números siguen en vivo. Mueve los cursores A y B para medir.');
      const latest = [...breaths].reverse().find((b) => b.endSimTimeMs <= freezeEnd * 1000 + 1);
      const startRatio = latest ? ((((latest.startSimTimeMs / 1000) % waveWindow) + waveWindow) % waveWindow) / waveWindow : 0.35;
      const cycleRatio = latest
        ? ((((latest.startSimTimeMs / 1000 + latest.tInspS) % waveWindow) + waveWindow) % waveWindow) / waveWindow
        : 0.65;
      setCursorAt(startRatio, 'A');
      setCursorAt(cycleRatio, 'B');
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
  function setWaveReference(cyc: Point[]): void {
    waveReference = cyc.map((x) => [...x] as Point);
    const btn = $<HTMLButtonElement>('#wave-ref-button');
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    $('#wave-ref-clear').hidden = false;
    dirty = true;
  }
  function resetWaveReferenceButton(): void {
    const btn = $<HTMLButtonElement>('#wave-ref-button');
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
    (btn.querySelector('span') as HTMLElement).textContent = 'Comparar última respiración';
    $('#wave-ref-clear').hidden = true;
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
    get waveScaleMode() {
      return waveScaleMode;
    },
    ingest(prev, fr) {
      const nextMechanicsSignature = JSON.stringify([fr.settings, fr.truth.patient, fr.truth.effort, fr.truth.sensors]);
      if (prev && prev.simTimeMs > fr.simTimeMs) {
        // sesión nueva (escenario o importación): el historial anterior no debe filtrar las muestras nuevas
        points = [];
        triggerDetectionsS = [];
        lastTriggerSeq = 0;
        loopReference = null;
        waveReference = null;
        resetWaveReferenceButton();
        breaths = [];
        markerCache = [];
        markerCacheKey = '';
        fixedBounds.waves = null;
        fixedBounds.basic = null;
        resetScales();
      } else if (prev && !waveReference && mechanicsSignature !== '' && mechanicsSignature !== nextMechanicsSignature) {
        const before = cyclePoints(points);
        if (before.length >= 3) setWaveReference(before);
      }
      for (const e of fr.eventsTail) {
        if (e.kind !== 'breath' || e.sequence <= lastTriggerSeq) continue;
        const p = e.payload as Record<string, unknown>;
        if (typeof p.trigger === 'number') {
          triggerDetectionsS.push(e.simTimeMs / 1000);
          if (triggerDetectionsS.length > 200) triggerDetectionsS = triggerDetectionsS.slice(-200);
        }
        if (
          typeof p.breathId === 'string' &&
          typeof p.startSimTimeMs === 'number' &&
          typeof p.endSimTimeMs === 'number' &&
          typeof p.tInspS === 'number' &&
          typeof p.ppeak === 'number'
        ) {
          breaths.push({
            breathId: p.breathId,
            startSimTimeMs: p.startSimTimeMs,
            endSimTimeMs: p.endSimTimeMs,
            tInspS: p.tInspS,
            ppeak: p.ppeak,
            pplatCycle: typeof p.pplatCycle === 'number' ? p.pplatCycle : null,
            tauExpS: typeof p.tauExpS === 'number' ? p.tauExpS : null,
            cyclingCause: String(p.cause ?? ''),
          });
          if (breaths.length > 200) breaths = breaths.slice(-200);
        }
        lastTriggerSeq = Math.max(lastTriggerSeq, e.sequence);
      }
      appendSamples(points, fr.samples);
      mechanicsSignature = nextMechanicsSignature;
      dirty = true;
    },
    reset() {
      gaugePaw = null;
      points = [];
      triggerDetectionsS = [];
      lastTriggerSeq = 0;
      loopReference = null;
      waveReference = null;
      resetWaveReferenceButton();
      breaths = [];
      markerCache = [];
      markerCacheKey = '';
      mechanicsSignature = '';
      fixedBounds.waves = null;
      fixedBounds.basic = null;
      resetScales();
    },
    clearPoints() {
      points = [];
      triggerDetectionsS = [];
      lastTriggerSeq = 0;
      breaths = [];
      markerCache = [];
      markerCacheKey = '';
      mechanicsSignature = '';
      fixedBounds.waves = null;
      fixedBounds.basic = null;
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
    get waveRefAt() {
      return waveReference?.length ? waveReference[0]![0] : null;
    },
    saveWaveReference() {
      const cyc = cyclePoints(points);
      if (cyc.length < 3) {
        ctx.toast('Espera un ciclo completo.', true);
        return;
      }
      setWaveReference(cyc);
      ctx.lesson.flags.referenceWave = true;
      dirty = true;
      ctx.lesson.evaluate();
    },
    clearWaveReference() {
      waveReference = null;
      resetWaveReferenceButton();
      dirty = true;
    },
    setWaveWindow(s) {
      waveWindow = s;
      resetScales();
      if (cursorRatio !== null) setCursorAt(cursorRatio, 'A');
      if (cursorRatioB !== null) setCursorAt(cursorRatioB, 'B');
      dirty = true;
    },
    setWaveStyle(style) {
      waveStyle = style;
      resetScales();
      dirty = true;
    },
    setWaveScaleMode(mode) {
      waveScaleMode = mode;
      if (mode === 'auto') {
        fixedBounds.waves = null;
        fixedBounds.basic = null;
        resetScales();
      } else {
        fixedBounds.waves = scales.waves?.bounds ?? null;
        fixedBounds.basic = scales.basic?.bounds ?? null;
      }
      dirty = true;
    },
    slideHistory(value) {
      const start = Math.min(freezeEnd, frozenPoints[0]?.[0] ?? freezeEnd);
      reviewEnd = Math.min(freezeEnd, start + waveWindow + ((freezeEnd - start - waveWindow) * value) / 1000);
      // El cursor conserva su posición en la ventana, no su instante, que puede haber quedado fuera de lo que se ve.
      if (cursorRatio !== null) setCursorAt(cursorRatio, 'A');
      if (cursorRatioB !== null) setCursorAt(cursorRatioB, 'B');
      if (cursorRatio === null && cursorRatioB === null) {
        cursorTime = null;
        put('#inspector-label', `Historia congelada · final de ventana ${clock(reviewEnd)}. Los números del monitor siguen en vivo.`);
      }
      dirty = true;
    },
    slideCursor(value, cursor) {
      setCursorAt(value / 1000, cursor);
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
