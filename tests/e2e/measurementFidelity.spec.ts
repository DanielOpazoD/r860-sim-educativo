import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import { open } from './helpers';

test('presión observada con esfuerzo, advertencia y Cstat no disponible', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, { paused: 1 });
  await page.locator('.palette-trigger').click();
  await page.locator('#palette-input').fill('Sesión y archivos');
  await page.locator('#palette-input').press('Enter');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="exportSession"]')]);
  const session = JSON.parse(await fs.readFile((await download.path())!, 'utf8'));
  session.init.patient = { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0, expValveOpenMs: 0 };
  session.init.effort = { enabled: true, amplitude: 4, ratePerMin: 3, tiS: 3, phaseS: 0, shape: 'riseRelax' };
  Object.assign(session.init.settings, { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pausePct: 0, assistControl: false });
  session.commands = [{ simTimeMs: 0, actor: 'learner', command: { type: 'requestHold', kind: 'inspHold', durationS: 2 } }];
  session.finalSimTimeMs = 3004;
  await page.keyboard.press('Escape');
  await page.setInputFiles('#session-input', {
    name: 'esfuerzo-sintetico.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(session)),
  });
  await expect.poll(() => page.evaluate(() => window.__r860.frame?.procedure.last.inspHold?.quality)).toBe('invalid');
  await expect(page.locator('#numeric-grid [data-metric="pplat"] .numeric-age')).toHaveText('Mecánica no válida');
  await page.click('[data-action="inspiratory"]');
  await expect(page.locator('#hold-value')).toHaveText('11');
  await expect(page.locator('#hold-second')).toHaveText('—');
  await expect(page.locator('#hold-status')).toContainText('esfuerzo muscular');
  await expect(page.locator('#hold-status')).toContainText('señal estable; presión observada');
  await page.screenshot({ path: info.outputPath('esfuerzo.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('SC-09 prolongada: fuga sin denominador muestra motivo', async ({ page }, info) => {
  await open(page, { scenario: 'SC-09', speed: 4, view: 'data' });
  await page.waitForFunction(() => (window.__r860.frame?.simTimeMs ?? 0) >= 26000);
  await page.click('#sim-pause');
  const metric = await page.evaluate(() => window.__r860.frame?.metrics.leakPct);
  expect(metric).toMatchObject({ value: null, quality: 'unavailable', reason: 'volumenInspiradoInsuficiente' });
  await expect(page.locator('[data-row="leakPct"] .q-chip')).toHaveText('No disponible');
  await expect(page.locator('[data-row="leakPct"] .metric-status')).toHaveAttribute('title', /volumen inspirado insuficiente/);
  await page.locator('[data-row="leakPct"] .metric-name').click();
  await expect(page.locator('.measurement-summary')).toContainText('volumen inspirado insuficiente');
  await page.screenshot({ path: info.outputPath('fuga-sin-denominador.png'), fullPage: true });
});
