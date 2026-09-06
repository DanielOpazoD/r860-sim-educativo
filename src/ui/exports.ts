/** Exportaciones de sesión: CSV de tendencias y señal, JSON de sesión y captura PNG del monitor. Sin DOM salvo el lienzo que se pinta. */
import type { SessionFile } from '../history/session';
import type { EngineFrame } from '../engine/simulator';
import { format as f, type Point } from '../render/plots';
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
/** Pinta la captura del monitor (1600×1050) con la marca de simulación. Devuelve el lienzo listo para `toBlob`. */
export function paintSnapshot(c: HTMLCanvasElement, input: SnapshotInput): HTMLCanvasElement {
  const { frame: fr, view } = input;
  c.width = 1600;
  c.height = 1050;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(1600 / 1120, 1050 / 735);
  const bg = ctx.createLinearGradient(0, 0, 1120, 735);
  bg.addColorStop(0, '#004bae');
  bg.addColorStop(1, '#0349a1');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1120, 735);
  const txt = (s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', weight = 'normal'): void => {
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.font = `${weight} ${size}px Arial,sans-serif`;
    ctx.fillText(s, x, y);
  };
  const bar = fr.alarmBar;
  ctx.fillStyle = bar.color === 'red' ? '#b91d36' : bar.color === 'yellow' ? '#ba891c' : bar.color === 'grey' ? '#738090' : '#119c78';
  ctx.fillRect(8, 7, 1104, 70);
  txt(bar.color === 'grey' ? 'Alarmas resueltas' : bar.message, 30, 33, 17, '#f4fff6');
  txt('SIMULACIÓN EDUCATIVA · NO USO CLÍNICO', 30, 60, 10, '#d0f2e1');
  const wc = input.waveCanvas;
  ctx.drawImage(wc, 0, 0, wc.width, wc.height, 8, 88, 608, view === 'basic' ? 138 : 488);
  METRICS.forEach((m, i) => {
    const x = 645 + (i % 2) * 147,
      y = 110 + Math.floor(i / 2) * 77;
    txt(m.label, x, y, 12, '#a8defb');
    txt(f(metricValue(fr, m), m.decimals), x, y + 33, 32, '#eeffff', 'left', '600');
    txt(m.unit, x, y + 50, 9, '#a8ddf5');
  });
  const g = input.gaugeCanvas;
  ctx.drawImage(g, 0, 0, g.width, g.height, 971, 87, 140, 488);
  const h = fr.procedure.last.inspHold;
  if (h && input.holdVisible) {
    ctx.fillStyle = '#246caf';
    ctx.fillRect(750, 89, 354, 112);
    ctx.strokeStyle = '#91c6e7';
    ctx.strokeRect(750, 89, 354, 112);
    txt('Bloqueo inspiratorio', 765, 109, 12, '#dcf5ff');
    txt(
      h.quality === 'valid'
        ? `Pplat ${f(h.values.pplat?.value ?? null, 0)} cmH₂O · Cstat ${f((h.values.cstat?.value ?? 0) * 1000, 0)} mL/cmH₂O`
        : `No válida: ${humanReason(h.reason)}`,
      765,
      140,
      16,
      '#eefcff',
    );
    txt(wallDate(h.wallTimeMs ?? 0), 765, 170, 12, '#c3e5f7');
  }
  ctx.fillStyle = '#072d63';
  ctx.fillRect(8, 583, 1104, 56);
  txt(`Tiempo simulado ${clock(fr.simTimeMs / 1000)} · ${input.scenarioName}`, 27, 615, 13, '#acd0e6');
  txt('R860 LAB · datos de un modelo sintético · no reproduce firmware GE', 1100, 615, 12, '#c0e4f4', 'right');
  let x = 8;
  input.quickItems.forEach((v, i) => {
    const width = i === 0 ? 169 : 155;
    const gr = ctx.createLinearGradient(0, 645, 0, 725);
    gr.addColorStop(0, '#266aac');
    gr.addColorStop(1, '#0b3977');
    ctx.fillStyle = gr;
    ctx.fillRect(x, 645, width, 80);
    txt(v[0], x + width / 2, 662, 11, '#acddfc', 'center');
    txt(v[1], x + width / 2, 700, 24, '#edffff', 'center', '600');
    x += width + 2;
  });
  return c;
}
