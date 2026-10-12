import { expect, test } from '@playwright/test';
import { open } from './helpers';
import fs from 'node:fs/promises';
import type { SessionFile } from '../../src/history/session';
for (const scenario of ['SC-02', 'SC-12']) {
  test(`${scenario} respeta paused=1 durante el arranque`, async ({ page }, info) => {
    await open(page, { scenario, paused: 1 });
    await expect(page.locator('#sim-pause')).toContainText('Reanudar');
    const t = await page.evaluate(() => window.__ventila.frame?.simTimeMs);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__ventila.frame?.simTimeMs)).toBe(t);
    if (scenario === 'SC-12') {
      await page.locator('.palette-trigger').click();
      await page.locator('#palette-input').fill('Sesión y archivos');
      await page.locator('#palette-input').press('Enter');
      const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="exportSession"]')]);
      const text = await fs.readFile((await download.path())!, 'utf8');
      const session = JSON.parse(text) as SessionFile;
      expect(session.commands.filter((c) => c.command.type === 'setSensors').map((c) => c.simTimeMs)).toEqual([10000]);
      await fs.writeFile(info.outputPath('SC-12-session.json'), text);
      await page.keyboard.press('Escape');
    }
    await page.screenshot({ path: info.outputPath(`${scenario}-paused.png`), fullPage: true });
  });
}
test('autopause=12001 detiene el reloj a 12004', async ({ page }, info) => {
  await open(page, { autopause: 12001 });
  await expect(page.locator('#sim-pause')).toContainText('Reanudar');
  expect(await page.evaluate(() => window.__ventila.frame?.simTimeMs)).toBe(12004);
  await page.screenshot({ path: info.outputPath('autopause-12001.png'), fullPage: true });
});
