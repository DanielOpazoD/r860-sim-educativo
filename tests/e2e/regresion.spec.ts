import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers';

// VR-01 · regresión visual del equipo. Cada estado se lleva a un instante fijo (simulación determinista, reloj de pared
// fijo, pausa automática) y la imagen del equipo se compara píxel a píxel con su referencia. Las referencias son por
// plataforma (tests/e2e/capturas/<plataforma>/): macOS y el Linux del CI dibujan distinto las fuentes. Cómo se
// actualizan tras un cambio visual intencional: docs/04-ingenieria.md, «Regresión visual».

const RELOJ = new Date('2026-10-13T12:00:00-03:00');

interface Estado {
  id: string;
  escenario: string;
  ms: number;
  pasos?: string[];
  /** Qué se captura: el equipo entero o una ventana suya. */
  objetivo?: string;
  movil?: boolean;
}
const ESTADOS: Estado[] = [
  { id: 'curvas', escenario: 'SC-13', ms: 16_000, movil: true },
  { id: 'datos-grandes', escenario: 'SC-13', ms: 16_000, pasos: ['[data-view="basic"]'] },
  { id: 'bucles', escenario: 'SC-13', ms: 18_000, pasos: ['[data-view="loops"]'] },
  { id: 'tendencias', escenario: 'SC-13', ms: 30_000, pasos: ['[data-view="trends"]'] },
  { id: 'tabla', escenario: 'SC-13', ms: 16_000, pasos: ['[data-view="data"]'] },
  { id: 'alarma-alta', escenario: 'SC-09', ms: 20_000, pasos: ['[data-view="waves"]'], movil: true },
  { id: 'fuga', escenario: 'SC-22', ms: 20_000 },
  { id: 'bloqueo', escenario: 'SC-13', ms: 16_000, pasos: ['[data-action="inspiratory"]'] },
  { id: 'editor', escenario: 'SC-13', ms: 16_000, pasos: ['[data-setting-quick="peep"]'] },
  { id: 'espera', escenario: 'SC-13', ms: 16_000, pasos: ['.standby-key', '[data-action="confirmStandby"]'], movil: true },
  { id: 'modos', escenario: 'SC-13', ms: 16_000, pasos: ['[data-action="modes"]'], objetivo: '#app-dialog' },
  { id: 'limites', escenario: 'SC-13', ms: 16_000, pasos: ['.alarm-setup'], objetivo: '#app-dialog' },
];

async function llevar(page: Page, e: Estado): Promise<void> {
  await page.clock.setFixedTime(RELOJ);
  await open(page, { scenario: e.escenario, speed: 4, instructor: 0, autopause: e.ms });
  await page.waitForFunction((t) => (window.__ventila?.frame?.simTimeMs ?? 0) >= t, e.ms, { timeout: 45_000 });
  for (const sel of e.pasos ?? []) await page.locator(sel).click();
  // Sin interacción pendiente: el foco no debe dejar un anillo que dependa de cómo se llegó.
  await page.mouse.move(0, 0);
}

for (const e of ESTADOS)
  test(`VR-01 · ${e.id}`, async ({ page }, info) => {
    const proyecto = info.project.name;
    test.skip(proyecto === 'desktop-1440', 'una sola anchura de escritorio basta para la imagen');
    test.skip(proyecto === 'mobile' && !e.movil, 'en el teléfono sólo los estados que cambian de disposición');
    await llevar(page, e);
    await expect(page.locator(e.objetivo ?? '#device-shell')).toHaveScreenshot(`${e.id}.png`, {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.001,
      stylePath: 'tests/e2e/regresion.css',
    });
  });
