import type { AppContext } from './context';
import { $ } from './dom';
import { csvBlob, downloadBlob, paintSnapshot, sessionBlob, SIGNAL_HEADER, signalRows, TRENDS_HEADER, trendsRows } from './exports';
import { stamp, unitText } from './format';
import type { HoldPanel } from './holdPanel';
import { displaySetting, MODE_LABEL, QUICK_KEYS_BY_MODE, QUICK_LABEL } from './labels';
import type { PlotsView } from './plotsView';

/**
 * Lo que el usuario se lleva de la sesión, desde el menú y la tecla del bisel: la sesión en JSON (reproducible), las
 * tendencias o la señal en CSV y la captura PNG del monitor. Cada una avisa con un aviso breve de lo que guardó.
 */
export interface SessionExports {
  exportSession(): Promise<void>;
  exportCSV(signal: boolean): void;
  snapshot(): void;
}

export function createSessionExports(ctx: AppContext, deps: { plots: PlotsView; hold: HoldPanel }): SessionExports {
  const { plots, hold } = deps;
  async function exportSession(): Promise<void> {
    const file = await ctx.client.exportSession();
    if (!file) {
      ctx.toast('No se pudo guardar la sesión: el motor no la entregó.', true);
      return;
    }
    downloadBlob(sessionBlob(file), `Ventila_sesion_${stamp()}.json`);
    ctx.toast(`Sesión guardada (${file.commands.length} comandos, ${file.breaths.length} respiraciones).`);
  }
  function exportCSV(signal: boolean): void {
    const fr = ctx.frame;
    if (!fr) return;
    const rows = signal ? signalRows(plots.points) : trendsRows(fr);
    downloadBlob(csvBlob(signal ? SIGNAL_HEADER : TRENDS_HEADER, rows), `Ventila_${signal ? 'senal' : 'tendencias'}_${stamp()}.csv`);
    ctx.toast(`${rows.length} filas exportadas.`);
  }
  function snapshot(): void {
    const fr = ctx.frame;
    if (!fr) return;
    plots.renderPlots();
    const rules = ctx.profile.rules;
    const quickItems: [string, string][] = [
      ['Modo actual', MODE_LABEL[fr.settings.mode]],
      ...QUICK_KEYS_BY_MODE[fr.settings.mode].map(
        (k) =>
          [QUICK_LABEL[k], displaySetting(rules, k, fr.settings[k]) + (k === 'ie' ? '' : ' ' + unitText(rules[k].displayUnit))] as [
            string,
            string,
          ],
      ),
    ];
    const view = ctx.view;
    const c = paintSnapshot(document.createElement('canvas'), {
      frame: fr,
      view,
      waveCanvas: $<HTMLCanvasElement>(view === 'basic' ? '#basic-wave-canvas' : '#waves-canvas'),
      gaugeCanvas: $<HTMLCanvasElement>('#gauge-canvas'),
      holdVisible: hold.isOpen,
      scenarioName: ctx.scenario.name,
      quickItems,
    });
    c.toBlob((blob) => {
      if (!blob) {
        ctx.toast('No se pudo crear la imagen.', true);
        return;
      }
      downloadBlob(blob, `Ventila_monitor_${stamp()}.png`);
      ctx.lesson.flags.snapshot = true;
      ctx.lesson.evaluate();
    }, 'image/png');
  }
  return { exportSession, exportCSV, snapshot };
}
