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
      points: number;
      /** Valor amortiguado que muestra la columna de presión. */
      gaugePaw: number | null;
      /** Inicio (s de simulación) de la respiración guardada como referencia, o null. */
      waveRef: number | null;
      /** Modo examen: activo y cuántas mediciones ya se estimaron. */
      exam: { active: boolean; estimates: number };
    };
  }
}

export async function open(page: Page, params: Record<string, string | number> = {}): Promise<void> {
  const q = new URLSearchParams({ t0: T0, seed: '1', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  await page.goto(`/?${q.toString()}`);
  await page.waitForFunction(() => window.__r860 && window.__r860.frame !== null, null, { timeout: 15_000 });
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
