import { expect, test, type Page } from '@playwright/test';
import { expectSafetyMark, frame, open, screenshot } from './helpers';

test.describe('NAV móvil · opciones de cabecera', () => {
  test('la cabecera muestra Buscar y ⋯; el menú añade Sesión', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'sólo proyecto móvil');
    await open(page, { instructor: 0 });
    await expect(page.locator('.top-actions button:visible')).toHaveCount(2);
    await expect(page.locator('.palette-trigger')).toBeVisible();
    await expect(page.locator('#more-button')).toBeVisible();
    await page.locator('#more-button').click();
    await expect(page.locator('#more-menu')).toBeVisible();
    await expect(page.locator('#more-menu [data-action="session"]')).toBeVisible();
    await expect(page.locator('#more-menu [role^="menuitem"]:visible')).toHaveCount(4);
  });
});

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
    await page.locator('#monitor .nav-key[data-view="basic"]').tap();
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
    await page.locator('#monitor .nav-key[data-view="loops"]').tap();
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

test.describe('VIS-10 móvil · bisel y vistas sin desbordamiento', () => {
  test.skip(({ isMobile }) => !isMobile, 'sólo proyecto móvil');

  test('sin desborde al cargar, abrir Menú y cambiar cada vista', async ({ page }) => {
    await open(page, { instructor: 0 });

    const comprobarGeometríaMóvil = async () => {
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const medición = await page.evaluate(() => {
        const bisel = document.querySelector('.bezel-bottom')!.getBoundingClientRect();
        const perilla = document.querySelector('#trim-knob')!.getBoundingClientRect();
        const pantalla = document.querySelector('#screen-window')!.getBoundingClientRect();
        const transform = document.querySelector<HTMLElement>('#monitor')!.style.transform;
        const escalaMonitor = Number(transform.match(/^scale\(([^)]+)\)$/)?.[1]);
        const barraEl = document.querySelector('.signal-toolbar')!;
        const barra = barraEl.getBoundingClientRect();
        const teclas = [...document.querySelectorAll('.bezel-bottom .hard-key')].map((el) => {
          const { width, height } = el.getBoundingClientRect();
          return { width, height };
        });
        return {
          innerWidth,
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          screenWidth: pantalla.width,
          monitorScale: escalaMonitor,
          biselRight: bisel.right,
          perillaRight: perilla.right,
          barraRight: barra.right,
          barraClientWidth: barraEl.clientWidth,
          barraScrollWidth: barraEl.scrollWidth,
          barraHeight: barra.height,
          teclas,
        };
      });
      expect(medición.scrollWidth).toBeLessThanOrEqual(medición.clientWidth);
      expect(medición.innerWidth).toBe(medición.clientWidth);
      expect(medición.screenWidth).toBeGreaterThanOrEqual(medición.innerWidth - 24);
      if (medición.innerWidth === 360) expect(medición.monitorScale).toBeGreaterThanOrEqual(0.55);
      expect(medición.perillaRight).toBeLessThanOrEqual(medición.biselRight - 6);
      expect(medición.barraRight).toBeLessThanOrEqual(medición.clientWidth);
      expect(medición.barraScrollWidth).toBeLessThanOrEqual(medición.barraClientWidth + 1);
      expect(medición.barraHeight).toBeLessThan(60);
      expect(medición.teclas.every(({ width, height }) => width >= 30 && height >= 30)).toBe(true);
    };

    await comprobarGeometríaMóvil();
    for (const viewport of [
      { width: 360, height: 780 },
      { width: 390, height: 844 },
      { width: 412, height: 915 },
    ]) {
      await page.setViewportSize(viewport);
      await comprobarGeometríaMóvil();

      await page.locator('[data-action="menu"]').tap();
      await expect(page.locator('#app-dialog')).toBeVisible();
      await comprobarGeometríaMóvil();
      await page.keyboard.press('Escape');
      await expect(page.locator('#app-dialog')).toBeHidden();

      for (const botón of await page.locator('#monitor .nav-key[data-view]').all()) {
        const vista = await botón.getAttribute('data-view');
        await botón.tap();
        await expect.poll(() => page.evaluate(() => window.__r860.view)).toBe(vista);
        await comprobarGeometríaMóvil();
      }
    }
  });

  test('elimina la barra redundante y arranca con el panel cerrado y compacto', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page, { scenario: 'SC-02' });
    await expect(page.locator('.mobile-toolbar')).toHaveCount(0);
    await expect(page.locator('#panel-button')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#instructor')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(1100);
  });

  test('la hoja del panel docente abre, cierra con el botón o Escape y devuelve el foco', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page, { scenario: 'SC-02' });
    const preferences = await page.evaluate(() => localStorage.getItem('r860.prefs'));
    const alto = page.viewportSize()!.height;
    const panel = page.locator('#instructor');
    const button = page.locator('#panel-button');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(button).toHaveClass(/active/);
    await expect(panel).toBeVisible();
    await expect(page.locator('[data-instructor="patient"]')).toBeFocused();
    expect((await panel.boundingBox())!.y).toBeGreaterThanOrEqual(alto * 0.25);
    await page.locator('#instructor-close').click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(button).not.toHaveClass(/active/);
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
    await button.click();
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('r860.prefs'))).toBe(preferences);
  });

  test('la hoja vuelve a la columna del panel al ensanchar el viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, { scenario: 'SC-02' });
    const panel = page.locator('#instructor');
    await page.locator('#panel-button').click();
    await expect(panel).toHaveCSS('position', 'fixed');
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS('position', 'static');
    await expect(page.locator('#instructor-close')).toBeHidden();
  });

  test('el popover Pantalla abierto cabe en el viewport a 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await open(page, { scenario: 'SC-02', instructor: 0 });
    await page.locator('#wave-options-button').click();
    await expect(page.locator('#wave-options')).toBeVisible();
    const bounds = await page.locator('#wave-options').evaluate((el) => {
      const { top, right, bottom } = el.getBoundingClientRect();
      return { top, right, bottom };
    });
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(360);
    expect(bounds.bottom).toBeLessThanOrEqual(780);
  });
});
