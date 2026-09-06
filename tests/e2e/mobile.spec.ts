import { expect, test } from '@playwright/test';
import { expectBanner, open, screenshot } from './helpers';

test.describe('VIS-03 móvil · vista escalada de exploración con controles HTML reales', () => {
  test.skip(({ browserName, isMobile }) => !isMobile, 'sólo proyecto móvil');
  test('la pantalla escala, no hay desbordamiento horizontal global y una tecla sigue siendo operable', async ({ page }, info) => {
    await open(page, { autopause: 8000, speed: 4, instructor: 0 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 8000);
    await expectBanner(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(overflow).toBe(true);
    const peep = page.locator('.qk[data-key="peep"]');
    await peep.tap();
    await expect(peep).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await screenshot(page, info, 'vis-03-mobile');
  });
});
