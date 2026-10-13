import type { AlarmPriority, AlarmState } from '../domain/types';

/**
 * Audio docente APROXIMADO (P): patrones D (QRG 2020 p.9 y URM SW10 8-6: cinco tonos dos veces / tres tonos / un tono);
 * timbre, frecuencia y cadencia NO verificados (U-12). Requiere gesto del usuario. La pausa de audio (120 s, D) es estado
 * del motor y se lee del cuadro.
 * Lo que sí dice el manual (URM SW10 8-6 y 8-7, D): los tonos de prioridad alta y media se repiten hasta que se pausa el
 * audio o se resuelve la condición, y el de baja suena una vez; una alta que no se resuelve ni se reconoce en el tiempo
 * de «High Alert Audio» (30 s de fábrica, 11-10) sube de tono y de volumen al máximo; y la pausa de audio no calla la
 * desconexión del paciente.
 */

/** Tiempo de «High Alert Audio» de fábrica (ms): URM SW10 8-6 y 11-10, D. */
export const HIGH_ALERT_AUDIO_MS = 30_000;
/** Alarmas del modelo que suenan aunque la pausa de audio esté activa (URM SW10 8-7, D): la desconexión. */
export const SIEMPRE_AUDIBLES: ReadonlySet<string> = new Set(['disconnect']);

/** Lo que tiene que sonar ahora: la prioridad, desde cuándo y si ya pasó a alerta alta. */
export interface Sonido {
  priority: AlarmPriority;
  desdeMs: number;
  alerta: boolean;
}

const RANGO: Record<AlarmPriority, number> = { high: 0, medium: 1, informational: 2 };

/**
 * Qué suena (pura): la alarma activa y visible de más prioridad (la más antigua entre iguales); durante la pausa de
 * audio, sólo las que la pausa no calla. Una alta pasa a alerta cuando lleva HIGH_ALERT_AUDIO_MS sin resolverse ni
 * reconocerse; reconocerla es pulsar «Reconocer» o pausar el audio después de que empezó (P: el manual no separa los dos).
 */
export function sonidoDeAlarma(alarms: readonly AlarmState[], nowMs: number, pausaHastaMs: number | null, pausaMs: number): Sonido | null {
  const enPausa = pausaHastaMs !== null && nowMs < pausaHastaMs;
  const activas = alarms
    .filter((a) => a.conditionActive && !a.filteredBy && (!enPausa || SIEMPRE_AUDIBLES.has(a.id)))
    .sort((a, b) => RANGO[a.priority] - RANGO[b.priority] || (a.onsetAtMs ?? 0) - (b.onsetAtMs ?? 0));
  const top = activas[0];
  if (!top) return null;
  const desdeMs = top.onsetAtMs ?? nowMs;
  const pausaDesdeMs = pausaHastaMs === null ? null : pausaHastaMs - pausaMs;
  const reconocida = top.acknowledgedAtMs !== null || (pausaDesdeMs !== null && pausaDesdeMs >= desdeMs);
  return { priority: top.priority, desdeMs, alerta: top.priority === 'high' && !reconocida && nowMs - desdeMs >= HIGH_ALERT_AUDIO_MS };
}

/** Patrón que se dispara: instantes de los tonos (s), frecuencia (Hz) y volumen (ganancia). */
export interface Patron {
  tonos: number[];
  frecuenciaHz: number;
  volumen: number;
}

/** Cada cuánto se repite el patrón de cada prioridad (ms); la baja («informational») no se repite (D). Intervalos P (U-12). */
const REPETIR_MS: Record<AlarmPriority, number | null> = { high: 6000, medium: 12000, informational: null };
const VOLUMEN = 0.05;
/** Volumen y tono de la alerta alta: el máximo de este audio (P; el manual sólo dice «al máximo»). */
const VOLUMEN_MAXIMO = 0.12;

/**
 * Si hay que disparar un patrón ahora (pura): uno nuevo cuando cambia lo que suena o pasa a alerta, y la repetición de
 * la alta y la media a su intervalo. `previo` es el último disparado.
 */
export function patronAhora(previo: (Sonido & { at: number }) | null, s: Sonido | null, nowMs: number): Patron | null {
  if (s === null) return null;
  const mismo = previo !== null && previo.priority === s.priority && previo.desdeMs === s.desdeMs && previo.alerta === s.alerta;
  const repetir = REPETIR_MS[s.priority];
  if (mismo && (repetir === null || nowMs - previo.at < repetir)) return null;
  const tonos =
    s.priority === 'high' ? [0, 0.18, 0.36, 0.54, 0.72, 1.3, 1.48, 1.66, 1.84, 2.02] : s.priority === 'medium' ? [0, 0.25, 0.5] : [0];
  const frecuenciaHz = s.priority === 'high' ? (s.alerta ? 1040 : 780) : s.priority === 'medium' ? 520 : 440;
  return { tonos, frecuenciaHz, volumen: s.alerta ? VOLUMEN_MAXIMO : VOLUMEN };
}

export class AlarmAudio {
  private ctx: AudioContext | null = null;
  private previo: (Sonido & { at: number }) | null = null;
  enabled = false;
  blockedReason: string | null = 'no habilitado';

  async enable(): Promise<boolean> {
    try {
      const AC =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) {
        this.blockedReason = 'Web Audio no disponible en este navegador';
        return false;
      }
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

  /** Hace sonar lo que `sonidoDeAlarma` decidió; la pausa ya está aplicada allí. */
  drive(s: Sonido | null, nowMs: number): void {
    if (!this.enabled || !this.ctx || document.hidden) return;
    const p = patronAhora(this.previo, s, nowMs);
    if (!p || !s) return;
    this.previo = { ...s, at: nowMs };
    const t0 = this.ctx.currentTime;
    for (const off of p.tonos) this.beep(t0 + off, p.frecuenciaHz, 0.12, p.volumen);
  }

  private beep(at: number, freq: number, dur: number, volumen: number): void {
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(volumen, at + 0.015);
    g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(g).connect(c.destination);
    o.start(at);
    o.stop(at + dur + 0.02);
  }
}
