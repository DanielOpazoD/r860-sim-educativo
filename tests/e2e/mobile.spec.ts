import { expect, test } from '@playwright/test';
import { expectSafetyMark, open, screenshot } from './helpers';

test.describe('VIS-03 móvil · equipo desplazable y editor fuera del monitor', () => {
  test.skip(({ isMobile }) => !isMobile, 'sólo proyecto móvil');
  test('sin desbordamiento global; el editor de ajustes se muestra legible fuera del monitor', async ({ page }, info) => {
    await open(page, { autopause: 8000, speed: 4, instructor: 0 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 8000);
    await expectSafetyMark(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.locator('[data-setting-quick="vt"]').tap();
    await expect(page.locator('#quick-editor')).toBeVisible();
    await expect(page.locator('#quick-editor')).toHaveClass(/mobile-editor/);
    const box = await page.locator('#quick-value').boundingBox();
    expect(box!.height).toBeGreaterThan(30);
    await page.keyboard.press('Escape');
    await screenshot(page, info, 'vis-03-mobile');
  });
});
