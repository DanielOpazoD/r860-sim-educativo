import { expect, test, type Page } from '@playwright/test';
import { expectSafetyMark, frame, open, screenshot } from './helpers';

// Monitor vertical en teléfono: nada se desplaza de lado, cada cifra queda a la vista y sigue siendo legible.
test.describe('VIS-03 móvil · monitor vertical y editor fuera del monitor', () => {
  test.skip(({ isMobile }) => !isMobile, 'sólo proyecto móvil');

  /** Escala efectiva del monitor (transform) para convertir tamaños CSS en píxeles de pantalla. */
  const escala = (page: Page): Promise<number> =>
    page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('#monitor')!).transform).a);

  test('sin desbordamiento; las trece cifras a la vista y legibles; el monitor cabe en su ventana; el editor fuera del monitor', async ({
    page,
  }, info) => {
    await open(page, { autopause: 8000, speed: 4, instructor: 0 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 8000);
    await expectSafetyMark(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    // Antes #numeric-grid empezaba en x = 419 con la zona visible acabando en 392: la columna entera fuera de pantalla.
    const cajas = await page.$$eval('#numeric-grid .numeric', (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, right: r.right, width: r.width, height: r.height };
      }),
    );
    expect(cajas.length).toBe(13);
    const ancho = await page.evaluate(() => window.innerWidth);
    for (const c of cajas) {
      expect(c.x).toBeGreaterThanOrEqual(-1);
      expect(c.right).toBeLessThanOrEqual(ancho + 1);
      expect(c.width).toBeGreaterThan(60);
    }
    // Legible de verdad: el valor mide ≥ 16 px en pantalla (descarta el falso arreglo de encoger).
    const k = await escala(page);
    const fuente = await page.$eval('#numeric-grid .numeric-value', (e) => parseFloat(getComputedStyle(e).fontSize));
    expect(fuente * k).toBeGreaterThanOrEqual(16);
    // El monitor queda dentro de su ventana y las curvas conservan su proporción.
    const [mon, win, lienzo] = await page.evaluate(() =>
      ['#monitor', '#screen-window', '#waves-canvas'].map((sel) => {
        const r = document.querySelector(sel)!.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, right: r.right, width: r.width, height: r.height };
      }),
    );
    expect(mon!.bottom).toBeLessThanOrEqual(win!.bottom + 2);
    expect(mon!.right).toBeLessThanOrEqual(win!.right + 2);
    expect(Math.abs(lienzo!.width / lienzo!.height - 608 / 488)).toBeLessThan(0.01 * (608 / 488));
    // Editor de ajustes fuera del monitor, legible.
    await page.locator('[data-setting-quick="vt"]').tap();
    await expect(page.locator('#quick-editor')).toBeVisible();
    await expect(page.locator('#quick-editor')).toHaveClass(/mobile-editor/);
    const box = await page.locator('#quick-value').boundingBox();
    expect(box!.height).toBeGreaterThan(30);
    await page.keyboard.press('Escape');
    await screenshot(page, info, 'vis-03-mobile');
  });

  test('datos grandes: los seis valores a la vista en dos columnas; bucles apilados; la alarma no se recorta', async ({ page }, info) => {
    await open(page, { scenario: 'SC-09', autopause: 20000, speed: 4, instructor: 0 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 20000, null, { timeout: 25_000 });
    expect((await frame(page)).alarmBar.color).toBe('red');
    const recorte = await page.$eval('#alarm-label', (e) => e.scrollHeight - e.clientHeight);
    expect(recorte).toBeLessThanOrEqual(1);
    await page.locator('.mobile-toolbar [data-view="basic"]').tap();
    const grandes = await page.$$eval('#big-metrics .big-numeric', (els) =>
      els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, right: r.right })),
    );
    const ancho = await page.evaluate(() => window.innerWidth);
    expect(grandes.length).toBe(6);
    for (const g of grandes) {
      expect(g.x).toBeGreaterThanOrEqual(-1);
      expect(g.right).toBeLessThanOrEqual(ancho + 1);
    }
    await screenshot(page, info, 'vis-09-mobile-basic', { view: 'basic', scenario: 'SC-09' });
    await page.locator('.mobile-toolbar [data-view="loops"]').tap();
    const bucles = await page.$$eval('#view-loops canvas', (els) =>
      els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: r.top, right: r.right })),
    );
    expect(bucles.length).toBe(2);
    expect(bucles[1]!.top).toBeGreaterThan(bucles[0]!.top + 50); // apilados, no lado a lado
    for (const b of bucles) expect(b.right).toBeLessThanOrEqual(ancho + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
});

test.describe('Ventana de curvas por omisión según el ancho del viewport', () => {
  test('móvil (< 700 px): la ventana arranca en 6 s', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'sólo proyecto móvil');
    await open(page, { instructor: 0 });
    await expect(page.locator('#wave-window')).toHaveValue('6');
  });
  test('escritorio: la ventana arranca en 12 s', async ({ page, isMobile }) => {
    test.skip(isMobile, 'sólo proyectos de escritorio');
    await open(page, { instructor: 0 });
    await expect(page.locator('#wave-window')).toHaveValue('12');
  });
});
