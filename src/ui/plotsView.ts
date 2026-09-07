/**
 * Curvas, bucles, tendencias y manómetro. Dueño de la traza (`points`), de la congelación con historia e inspector,
 * del ciclo de referencia y del planificador de dibujo (requestAnimationFrame sólo dibuja cuando algo cambió).
 */
import type { EngineFrame } from '../engine/simulator';
import { cyclePoints, drawGauge, drawLoop, drawMuscle, drawTrends, drawWave, format as f, type Point } from '../render/plots';
import type { AppContext } from './context';
import { $, icon, put } from './dom';
import { clock } from './format';

export interface PlotsView {
  readonly points: Point[];
  readonly frozen: boolean;
  /** Añade las muestras del cuadro a la traza (submuestreo 1/5) y reinicia si el tiempo retrocedió. */
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
  /** Arranca el bucle de animación y los oyentes de canvas. */
  start(): void;
}

export function createPlotsView(ctx: AppContext, deps: { teacherVisible: () => boolean }): PlotsView {
  let points: Point[] = [];
  let waveWindow = 12,
    waveStyle: 'sweep' | 'scroll' = 'sweep';
  let frozen = false,
    frozenPoints: Point[] = [],
    freezeEnd = 0,
    reviewEnd = 0,
    cursorTime: number | null = null,
    loopReference: Point[] | null = null;
  let dirty = true,
    lastPlot = 0;

  function activeTrace(): { pts: Point[]; end: number } {
    return { pts: frozen ? frozenPoints : points, end: frozen ? reviewEnd : ctx.simS() };
  }
  function renderPlots(): void {
    const fr = ctx.frame;
    if (!fr) return;
    const view = ctx.view;
    const { pts, end } = activeTrace();
    const peep = fr.settings.peep === 'off' ? 0 : fr.settings.peep,
      vtMl = fr.settings.vt * 1000;
    if (view === 'waves')
      drawWave($<HTMLCanvasElement>('#waves-canvas'), pts, end, peep, vtMl, { window: waveWindow, style: waveStyle, frozen, cursorTime });
    else if (view === 'basic')
      drawWave($<HTMLCanvasElement>('#basic-wave-canvas'), pts, end, peep, vtMl, { window: waveWindow, style: waveStyle, frozen });
    else if (view === 'loops') {
      drawLoop($<HTMLCanvasElement>('#pv-canvas'), pts, loopReference, peep, vtMl, 'pv');
      drawLoop($<HTMLCanvasElement>('#fv-canvas'), pts, loopReference, peep, vtMl, 'fv');
    } else if (view === 'trends')
      drawTrends(
        $<HTMLCanvasElement>('#trends-canvas'),
        fr.trends.map((t) => ({ t: t.tMs / 1000, ppeak: t.ppeak, peep: t.peepe, vte: t.vte * 1000, rr: t.rr })),
        ctx.simS(),
      );
    drawGauge($<HTMLCanvasElement>('#gauge-canvas'), {
      paw: fr.live.paw,
      pmax: fr.settings.pmax,
      ppeak: fr.metrics.ppeak?.value ?? fr.live.ppeakCurrent,
      peep,
      standby: fr.ventilation === 'standby',
      vteMl: fr.metrics.vte?.value === null || fr.metrics.vte?.value === undefined ? null : fr.metrics.vte.value * 1000,
      fio2Pct: fr.metrics.fio2?.value === null || fr.metrics.fio2?.value === undefined ? null : fr.metrics.fio2.value * 100,
    });
    if (deps.teacherVisible()) drawMuscle($<HTMLCanvasElement>('#muscle-canvas'), points, ctx.simS());
  }
  function tick(now: number): void {
    if (ctx.frame && !document.hidden && now - lastPlot > 32 && dirty) {
      lastPlot = now;
      renderPlots();
      dirty = false;
    }
    requestAnimationFrame(tick);
  }
  function toggleFreeze(): void {
    frozen = !frozen;
    cursorTime = null;
    if (frozen) {
      frozenPoints = points.map((x) => [...x] as Point);
      freezeEnd = ctx.simS();
      reviewEnd = freezeEnd;
      ($('#history-slider') as HTMLInputElement).value = '1000';
      put('#inspector-label', 'Curvas congeladas; los números siguen en vivo. Arrastra la historia o mueve el cursor sobre una curva.');
    } else frozenPoints = [];
    $('#signal-inspector').hidden = !frozen;
    $('#frozen-ribbon').hidden = !frozen;
    $('#freeze-button').innerHTML = icon(frozen ? 'play' : 'pause') + `<span>${frozen ? 'Reanudar curvas' : 'Congelar curvas'}</span>`;
    $('#freeze-button').classList.toggle('active', frozen);
    dirty = true;
  }
  function onPointerMove(e: PointerEvent): void {
    if (!frozen || !frozenPoints.length) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 608;
    const ratio = Math.max(0, Math.min(1, (x - 45) / (608 - 60)));
    if (waveStyle === 'sweep') {
      const cycle = Math.floor(reviewEnd / waveWindow) * waveWindow;
      cursorTime = cycle + ratio * waveWindow;
      if (cursorTime > reviewEnd) cursorTime -= waveWindow;
    } else cursorTime = reviewEnd - waveWindow + ratio * waveWindow;
    const ct = cursorTime;
    const nearest = frozenPoints.reduce((best, p) => (Math.abs(p[0] - ct) < Math.abs(best[0] - ct) ? p : best), frozenPoints[0] as Point);
    put(
      '#inspector-label',
      `t ${f(nearest[0], 2)} s · Paw ${f(nearest[1], 1)} cmH₂O · Flujo ${f(nearest[2], 1)} L/min · Volumen ${f(nearest[3], 0)} mL · datos del sensor`,
    );
    dirty = true;
  }
  return {
    get points() {
      return points;
    },
    get frozen() {
      return frozen;
    },
    ingest(prev, fr) {
      const s = fr.samples;
      const lastT = points[points.length - 1]?.[0] ?? -1;
      for (let i = 0; i < s.t.length; i += 5) {
        const t = (s.t[i] as number) / 1000;
        if (t <= lastT) continue;
        points.push([
          t,
          s.paw[i] as number,
          (s.flow[i] as number) * 60,
          (s.vol[i] as number) * 1000,
          s.pmus[i] as number,
          s.breath[i] as number,
        ]);
      }
      if (points.length > 6000) points.splice(0, points.length - 6000);
      if (prev && prev.simTimeMs > fr.simTimeMs) {
        points = [];
        loopReference = null;
      }
      dirty = true;
    },
    reset() {
      points = [];
      loopReference = null;
    },
    clearPoints() {
      points = [];
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
      dirty = true;
    },
    setWaveStyle(style) {
      waveStyle = style;
      dirty = true;
    },
    slideHistory(value) {
      const start = Math.min(freezeEnd, frozenPoints[0]?.[0] ?? freezeEnd);
      reviewEnd = Math.min(freezeEnd, start + waveWindow + ((freezeEnd - start - waveWindow) * value) / 1000);
      cursorTime = null;
      put('#inspector-label', `Historia congelada · final de ventana ${clock(reviewEnd)}. Los números del monitor siguen en vivo.`);
      dirty = true;
    },
    start() {
      $('#waves-canvas').addEventListener('pointermove', onPointerMove);
      requestAnimationFrame(tick);
    },
  };
}
