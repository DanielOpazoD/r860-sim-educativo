import type { AlarmPriority } from '../../domain/types';

/**
 * Audio docente APROXIMADO (P): patrones D (QRG 2020 p.9: cinco tonos dos veces / tres tonos / un tono); timbre, frecuencia
 * y cadencia de repetición NO verificados (U-12). Requiere gesto del usuario (política de autoplay). Pausa de audio 120 s (D).
 */
export class AlarmAudio {
  private ctx: AudioContext | null = null;
  private lastPattern: { priority: AlarmPriority; at: number } | null = null;
  pausedUntilMs: number | null = null;
  enabled = false;
  blockedReason: string | null = 'no habilitado: pulse «Activar audio»';

  async enable(): Promise<boolean> {
    try {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) { this.blockedReason = 'Web Audio no disponible'; return false; }
      this.ctx = this.ctx ?? new AC();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.enabled = this.ctx.state === 'running';
      this.blockedReason = this.enabled ? null : `contexto ${this.ctx.state}`;
      return this.enabled;
    } catch (e) {
      this.blockedReason = `error: ${(e as Error).message}`;
      return false;
    }
  }

  status(nowMs: number): string {
    if (!this.enabled) return `Audio: ${this.blockedReason ?? 'no habilitado'}`;
    if (this.pausedUntilMs !== null && nowMs < this.pausedUntilMs) return `Audio en pausa ${Math.ceil((this.pausedUntilMs - nowMs) / 1000)} s`;
    return 'Audio: activado (aproximación docente)';
  }

  /** Emite el patrón de la prioridad más alta activa, con cadencia de repetición propuesta. */
  drive(priority: AlarmPriority | null, nowMs: number): void {
    if (!this.enabled || !this.ctx || priority === null) return;
    if (this.pausedUntilMs !== null && nowMs < this.pausedUntilMs) return;
    const repeatMs = priority === 'high' ? 6000 : priority === 'medium' ? 12000 : 30000;
    if (this.lastPattern && this.lastPattern.priority === priority && nowMs - this.lastPattern.at < repeatMs) return;
    this.lastPattern = { priority, at: nowMs };
    const tones = priority === 'high' ? [0, .18, .36, .54, .72, 1.3, 1.48, 1.66, 1.84, 2.02] : priority === 'medium' ? [0, .25, .5] : [0];
    const freq = priority === 'high' ? 880 : priority === 'medium' ? 660 : 520;
    const t0 = this.ctx.currentTime;
    for (const off of tones) this.beep(t0 + off, freq, priority === 'high' ? 0.12 : 0.16);
  }

  private beep(at: number, freq: number, dur: number): void {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.15, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(c.destination); o.start(at); o.stop(at + dur + 0.02);
  }
}
