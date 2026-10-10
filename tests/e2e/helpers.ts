import { expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';

export const T0 = '2026-08-18T21:04:05-04:00';
export interface FrameLike {
  simTimeMs: number;
  live: { paw: number; phase: string; plimitLimited: boolean };
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
      { procedureId: string; wallTimeMs: number | null; quality: string; values: Record<string, { value: number | null }> } | null
    >;
    hold: unknown;
  };
}
declare global {
  interface Window {
    __r860: {
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
    };
  }
}

export async function open(page: Page, params: Record<string, string | number> = {}, options: { firstRun?: boolean } = {}): Promise<void> {
  if (!options.firstRun)
    await page.addInitScript(() => {
      if (!localStorage.getItem('r860.prefs')) localStorage.setItem('r860.prefs', JSON.stringify({ v: 1, welcomed: true }));
    });
  const q = new URLSearchParams({ t0: T0, seed: '1', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  await page.goto(`/?${q.toString()}`);
  await page.waitForFunction(() => window.__r860 && window.__r860.frame !== null, null, { timeout: 15_000 });
}
export async function showPanel(page: Page, tab?: 'patient' | 'events' | 'learn'): Promise<void> {
  const mobile = await page.evaluate(() => matchMedia('(max-width:700px)').matches);
  if (mobile) {
    const button = page.locator('#panel-button');
    if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
  } else if (await page.locator('#workspace').evaluate((el) => el.classList.contains('teacher-hidden'))) {
    await page.locator('#teacher-toggle').click();
  }
  if (tab) await page.locator(`[data-instructor="${tab}"]`).click();
}
export async function hidePanel(page: Page): Promise<void> {
  const mobile = await page.evaluate(() => matchMedia('(max-width:700px)').matches);
  if (mobile && (await page.locator('#panel-button').getAttribute('aria-pressed')) === 'true') {
    await page.locator('#instructor-close').click();
  }
}
export const frame = (page: Page): Promise<FrameLike> => page.evaluate(() => window.__r860.frame as unknown as FrameLike);
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
        engine: await page.evaluate(() => window.__r860.mode),
        ...meta,
      },
      null,
      1,
    ),
  );
}
export async function expectSafetyMark(page: Page): Promise<void> {
  await expect(page.locator('.bezel-signature')).toContainText('R860');
}
