import { expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';

export const T0 = '2026-08-18T21:04:05-04:00';
export interface FrameLike {
  simTimeMs: number;
  live: { paw: number; phase: string; plimitLimited: boolean; respaldo: string | null };
  wallTimeMs: number;
  ventilation: string;
  settings: Record<string, unknown>;
  pending: Record<string, unknown> | null;
  breathCount: number;
  metrics: Record<string, { value: number | null; quality: string }>;
  alarmBar: { color: string; message: string; activeCount: number };
  alarms: { id: string; conditionActive: boolean; acknowledgedAtMs: number | null }[];
  procedure: {
    last: Record<
      string,
      {
        procedureId: string;
        wallTimeMs: number | null;
        quality: string;
        passiveMechanicsValid?: boolean;
        values: Record<string, { value: number | null }>;
      } | null
    >;
    hold: unknown;
  };
}
declare global {
  interface Window {
    __ventila: {
      frame: FrameLike | null;
      edit: { kind: string; key?: string; draftDisplay?: number | 'off' };
      view: string;
      mode: string;
      running: boolean;
      speed: number;
      points: number;
      /** Valor amortiguado que muestra la columna de presión. */
      gaugePaw: number | null;
      /** Inicio (s de simulación) de la respiración guardada como referencia, o null. */
      waveRef: number | null;
      waveScale: 'auto' | 'fixed';
      /** Modo examen: activo y cuántas mediciones ya se estimaron. */
      exam: { active: boolean; estimates: number };
      /** Evento súbito del paciente (apnea, obstruction, leak, disconnect); ya no tiene botón en el panel. */
      fault(kind: string): Promise<void>;
    };
  }
}

export async function open(page: Page, params: Record<string, string | number> = {}, options: { firstRun?: boolean } = {}): Promise<void> {
  if (!options.firstRun)
    await page.addInitScript(() => {
      if (!localStorage.getItem('ventila.prefs')) localStorage.setItem('ventila.prefs', JSON.stringify({ v: 1, welcomed: true }));
    });
  const q = new URLSearchParams({ t0: T0, seed: '1', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  await page.goto(`/?${q.toString()}`);
  await page.waitForFunction(() => window.__ventila && window.__ventila.frame !== null, null, { timeout: 15_000 });
}
/** Aula · Fundamentos: el espacio educativo bajo el equipo, al que se llega desde la paleta (carga diferida). */
export async function openFundamentos(page: Page): Promise<void> {
  await hidePanel(page);
  await page.locator('.palette-trigger').click();
  await page.locator('#palette-input').fill('Aula: fundamentos');
  await page.locator('#palette-input').press('Enter');
  // La vista docente se carga diferida y el desplazamiento llega cuando ya existe: con la máquina cargada (la batería
  // completa en paralelo) tardaba más de los 5 s por omisión y la prueba fallaba de forma intermitente.
  await expect(page.locator('#teaching-body > *').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#learn-theory')).toBeInViewport({ timeout: 15_000 });
}
/** Vuelve al ventilador desde el espacio educativo. */
export async function backToMonitor(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('#monitor')).toBeInViewport();
}
/** Activa o desactiva el modo examen desde el menú «…». */
export async function toggleExam(page: Page): Promise<void> {
  await page.locator('#more-button').click();
  await page.locator('#exam-toggle').click();
  await expect(page.locator('#more-menu')).toBeHidden();
}
export async function showPanel(page: Page, tab?: 'case' | 'patient'): Promise<void> {
  const mobile = await page.evaluate(() => matchMedia('(max-width:700px)').matches);
  if (mobile) {
    const button = page.locator('#panel-button');
    if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
  } else if (await page.locator('#workspace').evaluate((el) => el.classList.contains('teacher-hidden'))) {
    await page.locator('#teacher-toggle').click();
  }
  if (tab) await page.locator(`[data-instructor="${tab}"]`).click();
}
export type AdvancedGroup = 'esfuerzo' | 'via' | 'pulmon' | 'circuito';
/** Abre «Mecánica avanzada» (panel lateral) en la pestaña del grupo pedido. */
export async function openMoreParams(page: Page, group: AdvancedGroup): Promise<void> {
  const panel = page.locator('#flyout-advanced');
  if (await panel.isHidden()) await page.locator('[data-flyout="advanced"]').click();
  await expect(panel).toBeVisible();
  await page.locator(`#advanced-tabs [data-group="${group}"]`).click();
  await expect(page.locator(`#patient-extra-controls [data-group="${group}"]`)).toBeVisible();
}
/** Abre «Datos del modelo» (panel lateral). */
export async function openModelData(page: Page): Promise<void> {
  const panel = page.locator('#flyout-model');
  if (await panel.isHidden()) await page.locator('[data-flyout="model"]').click();
  await expect(panel).toBeVisible();
}
async function selectViewTab(page: Page, tabName: 'aids' | 'monitor' | 'time'): Promise<void> {
  const dialog = page.locator('#wave-options');
  if (!(await dialog.evaluate((el) => (el as HTMLDialogElement).open))) await page.locator('#wave-options-button').click();
  await expect(dialog).toBeVisible();
  const tab = page.locator(`#view-tab-${tabName}`);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(`#${tabName === 'monitor' ? 'view-presentation' : `view-${tabName}`}`)).toBeVisible();
}
export async function openPersonalization(page: Page): Promise<void> {
  await selectViewTab(page, 'aids');
}
export async function openPresentation(page: Page): Promise<void> {
  await selectViewTab(page, 'monitor');
}
export async function openTimeControls(page: Page): Promise<void> {
  await selectViewTab(page, 'time');
}
export async function closePersonalization(page: Page): Promise<void> {
  const dialog = page.locator('#wave-options');
  if (!(await dialog.evaluate((el) => (el as HTMLDialogElement).open))) return;
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  const button = page.locator('#wave-options-button');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(button).toBeFocused();
}
export async function hidePanel(page: Page): Promise<void> {
  const mobile = await page.evaluate(() => matchMedia('(max-width:700px)').matches);
  // Un panel lateral abierto ocupa la pantalla en móvil: se cierra antes de cerrar la hoja.
  const lateral = page.locator('.flyout:not([hidden]) [data-flyout-close]');
  if (mobile && (await lateral.count())) await lateral.click();
  if (mobile && (await page.locator('#panel-button').getAttribute('aria-pressed')) === 'true') {
    await page.locator('#instructor-close').click();
  }
}
export const frame = (page: Page): Promise<FrameLike> => page.evaluate(() => window.__ventila.frame as unknown as FrameLike);
export async function screenshot(page: Page, info: TestInfo, name: string, meta: Record<string, unknown> = {}): Promise<void> {
  const f = await frame(page);
  const vp = page.viewportSize();
  const file = `test-results/screenshots/${name}-${info.project.name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  fs.writeFileSync(
    file.replace(/\.png$/, '.json'),
    JSON.stringify(
      {
        name,
        project: info.project.name,
        viewport: vp,
        t0: T0,
        seed: 1,
        simTimeMs: f.simTimeMs,
        wallTimeMs: f.wallTimeMs,
        engine: await page.evaluate(() => window.__ventila.mode),
        ...meta,
      },
      null,
      1,
    ),
  );
}
export async function expectSafetyMark(page: Page): Promise<void> {
  await expect(page.locator('.bezel-signature')).toContainText('Ventila');
}
