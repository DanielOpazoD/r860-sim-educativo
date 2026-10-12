import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import { open, openAula } from './helpers';
import type { SessionFile } from '../../src/history/session';

async function syntheticSession(page: Page): Promise<SessionFile> {
  await open(page, { paused: 1 });
  await page.locator('.palette-trigger').click();
  await page.locator('#palette-input').fill('Sesión y archivos');
  await page.locator('#palette-input').press('Enter');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="exportSession"]')]);
  const session = JSON.parse(await fs.readFile((await download.path())!, 'utf8')) as SessionFile;
  await page.keyboard.press('Escape');
  return session;
}

async function importSyntheticSession(page: Page, session: SessionFile): Promise<void> {
  await page.setInputFiles('#session-input', {
    name: 'banco-sintetico.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(session)),
  });
}

test('presión observada con esfuerzo, advertencia y Cstat no disponible', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const session = await syntheticSession(page);
  session.init.patient = { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0, expValveOpenMs: 0 };
  session.init.effort = { enabled: true, amplitude: 4, ratePerMin: 3, tiS: 3, phaseS: 0, shape: 'riseRelax' };
  Object.assign(session.init.settings, { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pausePct: 0, assistControl: false });
  session.commands = [{ simTimeMs: 0, actor: 'learner', command: { type: 'requestHold', kind: 'inspHold', durationS: 2 } }];
  session.finalSimTimeMs = 3004;
  await importSyntheticSession(page, session);
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

test('pausa de ciclo: presión observada y validez distinguen esfuerzo, incluido al inicio', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const session = await syntheticSession(page);
  session.init.patient = { crs: 0.05, rInsp: 10, rExp: 10, r2: 0, p0: 0, expValveOpenMs: 0 };
  Object.assign(session.init.settings, { vt: 0.5, rr: 15, ie: 1 / 3, peep: 5, pausePct: 0.2, assistControl: false });
  session.commands = [];
  session.finalSimTimeMs = 4004;
  for (const kind of ['passive', 'active', 'early'] as const) {
    session.init.effort = {
      enabled: kind !== 'passive',
      amplitude: 4,
      ratePerMin: 3,
      tiS: kind === 'early' ? 0.02 : 1,
      phaseS: kind === 'early' ? 0.8 : 0,
      shape: kind === 'early' ? 'halfSine' : 'riseRelax',
    };
    await importSyntheticSession(page, session);
    await expect
      .poll(() => page.evaluate(() => window.__r860.frame?.metrics.pplatCycle?.value))
      .toBeCloseTo(kind === 'active' ? 11 : 15, 6);
    await expect
      .poll(() => page.evaluate(() => window.__r860.frame?.metrics.pplatCycle?.quality))
      .toBe(kind === 'passive' ? 'valid' : 'invalid');
    await page.locator('[data-view="data"]').click();
    const row = page.locator('[data-row="pplatCycle"]');
    await expect(row.locator('.q-chip')).toHaveText(kind === 'passive' ? 'Válido' : 'No válido');
    if (kind !== 'passive') await expect(row.locator('.metric-status')).toHaveAttribute('title', /esfuerzo muscular durante la pausa/);
    await page.screenshot({ path: info.outputPath(`pausa-${kind}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('SC-18: bloqueo con esfuerzo permite completar el objetivo sin certificar PEEP pasiva', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, { scenario: 'SC-18', speed: 4 });
  await page.waitForFunction(() => (window.__r860.frame?.simTimeMs ?? 0) >= 57476);
  await page.locator('#sim-pause').click();
  await page.locator('[data-action="expiratory"]').click();
  await page.locator('#hold-duration').selectOption('2');
  for (let attempt = 0; attempt < 4; attempt++) {
    const previous = await page.evaluate(() => window.__r860.frame?.procedure.last.expHold?.procedureId);
    await page.locator('#hold-run').click();
    await page.waitForFunction(
      (id) => {
        const h = window.__r860.frame?.procedure.last.expHold;
        return h && h.procedureId !== id;
      },
      previous,
      { timeout: 15000 },
    );
    const invalid = await page.evaluate(() => window.__r860.frame?.procedure.last.expHold?.quality === 'invalid');
    if (invalid) break;
  }
  await expect(page.locator('#hold-status')).toContainText('No válida');
  await expect(page.locator('#hold-value')).toHaveText('—');
  await page.screenshot({ path: info.outputPath('sc18-bloqueo.png'), fullPage: true });
  await openAula(page, 'lesson');
  const task = page.locator('#lesson-tasks .task').filter({ hasText: 'solicita un bloqueo espiratorio de 2 s' });
  await expect(task).toHaveClass(/complete/);
  await expect(task).toContainText('una cola estable no demuestra');
  await page.screenshot({ path: info.outputPath('sc18-objetivo.png'), fullPage: true });
  expect(errors).toEqual([]);
});
