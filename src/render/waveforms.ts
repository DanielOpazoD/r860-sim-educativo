/**
 * Renderizador de curvas (P · dossier §16): canvas con barrido (cursor de escritura y hueco por delante),
 * base temporal compartida, decimación por extremos (mín/máx por columna) y relleno bajo la curva como en P1/P3.
 * Sólo dibuja: nunca es fuente del tiempo fisiológico.
 */
export interface ChannelScale { min: number; max: number; ticks: number[] }
export interface ChannelStyle { line: string; fill: string; baselineValue: number }

export interface WaveformChannelSpec { id: 'paw' | 'flow' | 'vol'; scale: ChannelScale; style: ChannelStyle; toDisplay: (internal: number) => number }

const GAP_FRACTION = 0.035;

export class SweepChannel {
  private ctx: CanvasRenderingContext2D | null = null;
  private lastX = -1;
  private colMin = Infinity;
  private colMax = -Infinity;
  private lastY: number | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  constructor(readonly canvas: HTMLCanvasElement, public spec: WaveformChannelSpec, public windowS: number) {}

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
    const w = Math.max(1, Math.round(rect.width * this.dpr));
    const h = Math.max(1, Math.round(rect.height * this.dpr));
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w; this.canvas.height = h;
      this.width = w; this.height = h;
      this.ctx = this.canvas.getContext('2d');
      this.clearAll();
    }
  }

  setScale(scale: ChannelScale): void {
    this.spec = { ...this.spec, scale };
    this.clearAll();
  }

  clearAll(): void {
    const c = this.ctx; if (!c) return;
    c.clearRect(0, 0, this.width, this.height);
    this.drawGrid();
    this.lastX = -1; this.lastY = null; this.colMin = Infinity; this.colMax = -Infinity;
  }

  private yOf(v: number): number {
    const { min, max } = this.spec.scale;
    const f = (v - min) / (max - min);
    return Math.round((1 - Math.min(1.05, Math.max(-0.05, f))) * this.height);
  }

  private drawGrid(): void {
    const c = this.ctx; if (!c) return;
    c.save();
    c.strokeStyle = 'rgba(126, 200, 255, 0.38)';
    c.lineWidth = 1 * this.dpr;
    for (const t of this.spec.scale.ticks) {
      const y = this.yOf(t) + 0.5;
      c.beginPath(); c.moveTo(0, y); c.lineTo(this.width, y); c.stroke();
    }
    // Divisiones verticales cada 1/4 de ventana (P): referencia de tiempo sin etiquetas dentro del canvas.
    for (let i = 1; i < 4; i++) {
      const x = Math.round((this.width * i) / 4) + 0.5;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, this.height); c.stroke();
    }
    c.restore();
  }

  /** Dibuja muestras nuevas (t en ms, valores internos). */
  push(t: ArrayLike<number>, v: ArrayLike<number>): void {
    const c = this.ctx; if (!c || !this.width) return;
    const winMs = this.windowS * 1000;
    const yBase = this.yOf(this.spec.style.baselineValue);
    for (let i = 0; i < t.length; i++) {
      const tm = t[i] as number;
      const x = Math.floor(((tm % winMs) / winMs) * this.width);
      const y = this.yOf(this.spec.toDisplay(v[i] as number));
      if (x !== this.lastX) {
        if (this.lastX >= 0) this.flushColumn(this.lastX, yBase);
        // Avance del cursor: limpiar hueco por delante (envolviendo al inicio).
        const gap = Math.max(4, Math.round(this.width * GAP_FRACTION));
        const from = this.lastX < 0 ? x : x;
        for (let k = 0; k <= gap; k++) {
          const gx = (from + k) % this.width;
          c.clearRect(gx, 0, 1, this.height);
        }
        this.redrawGridColumns(from, gap);
        if (x < this.lastX) this.lastY = null; // envoltura: no unir con el borde derecho
        this.lastX = x; this.colMin = y; this.colMax = y;
      } else {
        this.colMin = Math.min(this.colMin, y); this.colMax = Math.max(this.colMax, y);
      }
    }
  }

  private redrawGridColumns(from: number, gap: number): void {
    const c = this.ctx; if (!c) return;
    c.save();
    c.fillStyle = 'rgba(126, 200, 255, 0.38)';
    for (const tk of this.spec.scale.ticks) {
      const y = this.yOf(tk);
      for (let k = 0; k <= gap; k++) c.fillRect((from + k) % this.width, y, 1, 1);
    }
    for (let i = 1; i < 4; i++) {
      const gx = Math.round((this.width * i) / 4);
      if (gx >= from && gx <= from + gap) c.fillRect(gx, 0, 1, this.height);
    }
    c.restore();
  }

  private flushColumn(x: number, yBase: number): void {
    const c = this.ctx; if (!c) return;
    const yMin = this.colMin, yMax = this.colMax; // en píxeles: yMin arriba
    // Relleno desde la línea base hasta el extremo más alejado (conserva picos).
    const yFar = Math.abs(yMin - yBase) > Math.abs(yMax - yBase) ? yMin : yMax;
    c.fillStyle = this.spec.style.fill;
    const top = Math.min(yBase, yFar), h = Math.abs(yFar - yBase);
    if (h > 0) c.fillRect(x, top, 1, h);
    // Trazo: segmento vertical mín–máx de la columna + unión con la columna anterior.
    c.fillStyle = this.spec.style.line;
    const lw = Math.max(1, Math.round(1.5 * this.dpr));
    const from = this.lastY === null ? yMin : Math.min(this.lastY, yMin);
    const to = this.lastY === null ? yMax : Math.max(this.lastY, yMax);
    c.fillRect(x, Math.min(from, to) - Math.floor(lw / 2), lw, Math.abs(to - from) + lw);
    this.lastY = yFar === yMin ? yMax : yMin; // continuar desde el último valor observado en la columna
    this.lastY = (yMin + yMax) / 2;
    this.colMin = Infinity; this.colMax = -Infinity;
  }
}

export const SCALES = {
  /** O · P1: Pva −10..40; Flujo −80..80; Volumen −50..300. */
  advanced: {
    paw: { min: -10, max: 40, ticks: [0, 20, 40] } as ChannelScale,
    flow: { min: -80, max: 80, ticks: [0] } as ChannelScale,
    vol: { min: -50, max: 300, ticks: [0, 150, 300] } as ChannelScale,
  },
  /** O · P3: Pva −11.25..45; Flujo −50..50; Volumen −50..300. */
  basic: {
    paw: { min: -11.25, max: 45, ticks: [0, 22.5, 45] } as ChannelScale,
    flow: { min: -50, max: 50, ticks: [0] } as ChannelScale,
    vol: { min: -50, max: 300, ticks: [0, 150, 300] } as ChannelScale,
  },
  /** P · escalas amplias para bancos con VT 500 mL. */
  wide: {
    paw: { min: -10, max: 60, ticks: [0, 20, 40, 60] } as ChannelScale,
    flow: { min: -80, max: 80, ticks: [0] } as ChannelScale,
    vol: { min: -100, max: 800, ticks: [0, 400, 800] } as ChannelScale,
  },
} as const;

export type ScaleSetId = keyof typeof SCALES;
