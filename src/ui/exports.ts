/** Exportaciones de sesión: CSV de tendencias y señal, JSON de sesión y captura PNG del monitor. Sin DOM salvo el lienzo que se pinta. */
import type { SessionFile } from '../history/session';
import type { EngineFrame } from '../engine/simulator';
import { formatNumber as f } from '../domain/units';
import { MON_CSS as C, MON_FS, type PasoTipo } from '../render/monitorPalette';
import { type Point } from '../render/plots';
import { clock, wallDate } from './format';
import { humanReason } from './humanize';
import { METRICS, metricValue } from './metricsTable';

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  return `"${String(v).replace(/"/g, '""')}"`;
}
/** Texto CSV con BOM y CRLF (Excel en español lo abre sin asistente). */
export function csvText(header: string[], rows: unknown[][]): string {
  return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
export const SIGNAL_HEADER = ['tiempo_s', 'Paw_cmH2O', 'flujo_L_min', 'volumen_mL', 'Pmus_cmH2O', 'ciclo'];
export const TRENDS_HEADER = [
  'tiempo_s',
  'tipo',
  'Ppico_cmH2O',
  'PEEPe_cmH2O',
  'VTi_mL',
  'VTe_mL',
  'FR_min',
  'VM_L_min',
  'Pplat_bloqueo_cmH2O',
  'Cstat_bloqueo_mL_cmH2O',
];
export const signalRows = (points: Point[]): unknown[][] => points.map((p) => [...p]);
export const trendsRows = (fr: EngineFrame): unknown[][] =>
  fr.trends.map((t) => [
    t.tMs / 1000,
    t.type,
    t.ppeak,
    t.peepe,
    t.vti * 1000,
    t.vte * 1000,
    t.rr,
    t.mve,
    t.pplatHold,
    t.cstatHold === null ? null : t.cstatHold * 1000,
  ]);
export function csvBlob(header: string[], rows: unknown[][]): Blob {
  return new Blob([csvText(header, rows)], { type: 'text/csv;charset=utf-8' });
}
export function sessionBlob(file: SessionFile): Blob {
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}
export function textBlob(text: string): Blob {
  return new Blob([text], { type: 'text/plain;charset=utf-8' });
}
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export interface SnapshotInput {
  frame: EngineFrame;
  view: string;
  waveCanvas: HTMLCanvasElement;
  gaugeCanvas: HTMLCanvasElement;
  holdVisible: boolean;
  scenarioName: string;
  /** Teclas rápidas: [etiqueta, valor con unidad]. */
  quickItems: [string, string][];
}
/**
 * Pinta la captura del monitor (1600×1050) con la marca de simulación y la misma paleta que la pantalla
 * (src/render/monitorPalette.ts, E-118). Devuelve el lienzo listo para `toBlob`.
 */
export function paintSnapshot(c: HTMLCanvasElement, input: SnapshotInput): HTMLCanvasElement {
  const { frame: fr, view } = input;
  c.width = 1600;
  c.height = 1050;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(1600 / 1120, 1050 / 735);
  // El degradado radial de .monitor (elipse 72 % × 62 % centrada en 46 % · 40 %): un círculo aplastado en vertical.
  const [cx, cy, rx, ry] = [1120 * 0.46, 735 * 0.4, 1120 * 0.72, 735 * 0.62];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  bg.addColorStop(0, C.pantallaClaro);
  bg.addColorStop(0.55, C.pantalla);
  bg.addColorStop(1, C.pantallaBorde);
  ctx.fillStyle = bg;
  ctx.fillRect(-cx, -cy * (rx / ry), 1120, 735 * (rx / ry));
  ctx.restore();
  const txt = (
    s: string,
    x: number,
    y: number,
    paso: PasoTipo,
    color: string,
    align: CanvasTextAlign = 'left',
    weight = 'normal',
  ): void => {
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.font = `${weight} ${MON_FS[paso]}px Arial,sans-serif`;
    ctx.fillText(s, x, y);
  };
  // La banda como en .alarm-band: verde sin alarmas (y con las de prioridad baja), roja, ámbar o gris de alarma previa.
  const bar = fr.alarmBar;
  const [a, b, tinta] =
    bar.color === 'red'
      ? [C.bandaAltaA, C.bandaAltaB, C.bandaAltaTexto]
      : bar.color === 'yellow'
        ? [C.bandaMediaA, C.bandaMediaB, C.mediaTexto]
        : bar.color === 'grey'
          ? [C.bandaPreviaA, C.bandaPreviaB, C.texto]
          : [C.reposoAlto, C.reposoBajo, C.texto];
  const banda = ctx.createLinearGradient(8, 0, 1112, 0);
  banda.addColorStop(0, a);
  banda.addColorStop(1, b);
  ctx.fillStyle = banda;
  ctx.fillRect(8, 7, 1104, 70);
  txt(bar.color === 'grey' ? 'Alarmas resueltas' : bar.message, 30, 33, 'xl', tinta, 'left', '600');
  txt('SIMULACIÓN EDUCATIVA · NO USO CLÍNICO', 30, 60, '2xs', tinta);
  const wc = input.waveCanvas;
  ctx.drawImage(wc, 0, 0, wc.width, wc.height, 8, 88, 608, view === 'basic' ? 138 : 488);
  // Dos columnas en el alto que deja la fila de vistas (y = 583): con siete filas, la última quedaba debajo de ella.
  const paso = Math.min(77, Math.floor(470 / Math.ceil(METRICS.length / 2)));
  METRICS.forEach((m, i) => {
    const x = 645 + (i % 2) * 147,
      y = 110 + Math.floor(i / 2) * paso;
    txt(m.label, x, y, 'sm', C.texto, 'left', '700');
    txt(f(metricValue(fr, m), m.decimals), x, y + 33, '4xl', C.texto, 'left', '700');
    txt(m.unit, x, y + 50, '2xs', C.unidad);
  });
  const g = input.gaugeCanvas;
  ctx.drawImage(g, 0, 0, g.width, g.height, 971, 87, 140, 488);
  const h = fr.procedure.last.inspHold;
  if (h && input.holdVisible) {
    const ventana = ctx.createLinearGradient(0, 89, 0, 201);
    ventana.addColorStop(0, C.bloqueoAlto);
    ventana.addColorStop(1, C.bloqueoBajo);
    ctx.fillStyle = ventana;
    ctx.fillRect(750, 89, 354, 112);
    ctx.strokeStyle = C.trazo;
    ctx.strokeRect(750, 89, 354, 112);
    txt('Bloqueo inspiratorio', 765, 109, 'sm', C.eje);
    txt(
      h.quality === 'valid'
        ? `Pplat ${f(h.values.pplat?.value ?? null, 0)} cmH₂O · Cstat ${f((h.values.cstat?.value ?? 0) * 1000, 0)} mL/cmH₂O`
        : `No válida: ${humanReason(h.reason)}`,
      765,
      140,
      'lg',
      C.texto,
    );
    txt(wallDate(h.wallTimeMs ?? 0), 765, 170, 'sm', C.eje);
  }
  const nav = ctx.createLinearGradient(0, 583, 0, 639);
  nav.addColorStop(0, C.navAlto);
  nav.addColorStop(1, C.navBajo);
  ctx.fillStyle = nav;
  ctx.fillRect(8, 583, 1104, 56);
  txt(`Tiempo simulado ${clock(fr.simTimeMs / 1000)} · ${input.scenarioName}`, 27, 615, 'sm', C.rotulo);
  txt('VENTILA LAB · datos de un modelo sintético · no reproduce el firmware de ningún equipo', 1100, 615, 'sm', C.eje, 'right');
  let x = 8;
  input.quickItems.forEach((v, i) => {
    const width = i === 0 ? 169 : 155;
    const gr = ctx.createLinearGradient(0, 645, 0, 725);
    // Teclas de grafito, como .device-key.
    gr.addColorStop(0, C.grafitoAlto);
    gr.addColorStop(0.48, C.grafito);
    gr.addColorStop(1, C.grafitoBajo);
    ctx.fillStyle = gr;
    ctx.fillRect(x, 645, width, 80);
    ctx.strokeStyle = C.grafitoBorde;
    ctx.strokeRect(x + 0.5, 645.5, width - 1, 79);
    txt(v[0], x + width / 2, 662, 'xs', C.rotulo, 'center');
    txt(v[1], x + width / 2, 700, '2xl', C.texto, 'center', '700');
    x += width + 2;
  });
  return c;
}
