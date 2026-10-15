import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers';

// VR-01 · regresión visual. Cada estado se lleva a un instante fijo (simulación determinista, reloj de pared fijo,
// pausa automática) y su imagen se compara píxel a píxel con su referencia: el equipo y sus ventanas (sin el cromo
// exterior) y, desde la entrega de pulido, también el exterior —el panel, sus paneles laterales, las ventanas del exterior
// y el Aula—. Las referencias son por plataforma (tests/e2e/capturas/<plataforma>/): macOS y el Linux del CI dibujan
// distinto las fuentes. Cómo se actualizan tras un cambio visual intencional: docs/04-arquitectura.md §5.

const RELOJ = new Date('2026-10-13T12:00:00-03:00');

interface Estado {
  id: string;
  escenario: string;
  ms: number;
  pasos?: string[];
  /** Pasos que no son un clic (teclas, la paleta). */
  antes?: (page: Page) => Promise<void>;
  /** Qué se captura: el equipo (por omisión), una ventana o 'pagina' (lo que se ve). */
  objetivo?: string;
  /** Con el panel lateral abierto. */
  panel?: boolean;
  /** Es del exterior: se captura con su cromo (la barra y las herramientas). */
  exterior?: boolean;
  movil?: boolean;
}
const paleta = (texto: string) => async (page: Page) => {
  await page.locator('.palette-trigger').click();
  await page.locator('#palette-input').fill(texto);
  await page.locator('#palette-input').press('Enter');
};
const ESTADOS: Estado[] = [
  { id: 'curvas', escenario: 'SC-13', ms: 16_000, movil: true },
  { id: 'datos-grandes', escenario: 'SC-13', ms: 16_000, pasos: ['[data-view="basic"]'] },
  { id: 'bucles', escenario: 'SC-13', ms: 18_000, pasos: ['[data-view="loops"]'] },
  { id: 'tendencias', escenario: 'SC-13', ms: 30_000, pasos: ['[data-view="trends"]'] },
  { id: 'tabla', escenario: 'SC-13', ms: 16_000, pasos: ['[data-view="data"]'] },
  { id: 'alarma-alta', escenario: 'SC-09', ms: 20_000, pasos: ['[data-view="waves"]'], movil: true },
  // Las ayudas empiezan apagadas; encendidas, sobre la misma alarma: líneas de PEEP y Pmáx, marcas de fase y curva previa.
  { id: 'ayudas', escenario: 'SC-09', ms: 20_000, pasos: ['[data-view="waves"]', '#wave-aids-toggle'] },
  { id: 'fuga', escenario: 'SC-22', ms: 20_000 },
  { id: 'bloqueo', escenario: 'SC-13', ms: 16_000, pasos: ['[data-action="inspiratory"]'] },
  { id: 'editor', escenario: 'SC-13', ms: 16_000, pasos: ['[data-setting-quick="peep"]'] },
  { id: 'espera', escenario: 'SC-13', ms: 16_000, pasos: ['.standby-key', '[data-action="confirmStandby"]'], movil: true },
  { id: 'modos', escenario: 'SC-13', ms: 16_000, pasos: ['[data-action="modes"]'], objetivo: '#app-dialog', movil: true },
  { id: 'limites', escenario: 'SC-13', ms: 16_000, pasos: ['.alarm-setup'], objetivo: '#app-dialog', movil: true },
  // El exterior.
  { id: 'panel', escenario: 'SC-13', ms: 8_000, panel: true, objetivo: 'pagina', exterior: true, movil: true },
  {
    id: 'datos-modelo',
    escenario: 'SC-19',
    ms: 20_000,
    panel: true,
    pasos: ['[data-flyout="model"]'],
    objetivo: '#flyout-model',
    exterior: true,
  },
  { id: 'guia', escenario: 'SC-13', ms: 8_000, antes: (p) => p.keyboard.press('?'), objetivo: '#app-dialog', exterior: true, movil: true },
  {
    id: 'sesion',
    escenario: 'SC-13',
    ms: 8_000,
    pasos: ['.top-actions [aria-haspopup]', '[data-action="session"]'],
    objetivo: '#app-dialog',
    exterior: true,
  },
  { id: 'vista', escenario: 'SC-13', ms: 8_000, pasos: ['#wave-options-button'], objetivo: '#wave-options', exterior: true },
  { id: 'aula', escenario: 'SC-13', ms: 8_000, antes: paleta('Aula: fundamentos'), objetivo: '#learn-theory', exterior: true },
];

async function llevar(page: Page, e: Estado): Promise<void> {
  await page.clock.setFixedTime(RELOJ);
  await open(page, { scenario: e.escenario, speed: 4, instructor: e.panel ? 1 : 0, autopause: e.ms });
  await page.waitForFunction((t) => (window.__ventila?.frame?.simTimeMs ?? 0) >= t, e.ms, { timeout: 45_000 });
  for (const sel of e.pasos ?? []) await page.locator(sel).first().click();
  if (e.antes) await e.antes(page);
  if (e.objetivo && e.objetivo !== 'pagina') await expect(page.locator(e.objetivo)).toBeVisible();
  // Sin interacción pendiente: el foco no debe dejar un anillo que dependa de cómo se llegó.
  await page.mouse.move(0, 0);
}

for (const e of ESTADOS)
  test(`VR-01 · ${e.id}`, async ({ page }, info) => {
    const proyecto = info.project.name;
    test.skip(proyecto === 'desktop-1440', 'una sola anchura de escritorio basta para la imagen');
    test.skip(proyecto === 'mobile' && !e.movil, 'en el teléfono sólo los estados que cambian de disposición');
    await llevar(page, e);
    // Estricto: dos pasadas en la misma plataforma dan la misma imagen (simulación y reloj fijos), así que se admite sólo
    // el ruido de antialiasado de unos pocos píxeles. Con el umbral por omisión (0,2 por píxel y 0,1 % de la imagen) pasaba
    // un cambio real: la opacidad de las líneas de las ayudas (#163).
    const opciones = {
      animations: 'disabled' as const,
      caret: 'hide' as const,
      threshold: 0.05,
      maxDiffPixels: 25,
      // El equipo, sin el cromo exterior que puede quedarle encima al desplazar la página.
      ...(e.exterior ? {} : { stylePath: 'tests/e2e/regresion.css' }),
    };
    if (e.objetivo === 'pagina') await expect(page).toHaveScreenshot(`${e.id}.png`, opciones);
    else await expect(page.locator(e.objetivo ?? '#device-shell')).toHaveScreenshot(`${e.id}.png`, opciones);
  });
