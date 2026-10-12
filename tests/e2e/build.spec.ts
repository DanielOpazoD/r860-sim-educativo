import { expect, test, type Page } from '@playwright/test';
import { ENGINE_VERSION } from '../../src/engine/version';
import { open } from './helpers';

/** Lleva al Aula desde la paleta, como lo haría quien no tiene un caso abierto. */
async function goToAula(page: Page): Promise<void> {
  await page.locator('.palette-trigger').click();
  await page.locator('#palette-input').fill('Aula: fundamentos');
  await page.locator('#palette-input').press('Enter');
}

test('el build carga los Fundamentos sólo al llegar a ellos y reutiliza su módulo sin red', async ({ page, context }) => {
  const modules: string[] = [];
  page.on('request', (request) => {
    if (/\/teachingView-[^/]+\.js$/.test(new URL(request.url()).pathname)) modules.push(request.url());
  });
  // Ventana baja: el espacio educativo empieza fuera de la vista y no debe cargarse hasta que se llegue a él.
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 700 });
  await open(page, { paused: 1 });
  const html = await (await page.request.get('/')).text();
  expect(html).toContain(`id="version-tag">v${ENGINE_VERSION} · Offline`);
  expect(html).not.toContain('%ENGINE_VERSION%');
  expect(modules).toEqual([]);
  await expect(page.locator('#version-tag')).toContainText(`v${ENGINE_VERSION}`);
  await goToAula(page);
  await expect(page.locator('#teaching-body svg').first()).toBeVisible();
  expect(modules).toHaveLength(1);
  await context.setOffline(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('#monitor')).toBeInViewport();
  await goToAula(page);
  await expect(page.locator('#learn-theory')).toBeInViewport();
  await expect(page.locator('#teaching-body svg').first()).toBeVisible();
  expect(modules).toHaveLength(1);
});

test('una carga fallida deja el simulador operativo y permite recuperar los Fundamentos', async ({ page }) => {
  let fail = true;
  await page.route('**/assets/teachingView-*.js', (route) => (fail ? route.abort() : route.continue()));
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 700 });
  await open(page, { paused: 1 });
  await goToAula(page);
  const status = page.locator('#aula-theory-host [role="status"]');
  await expect(status).toContainText('No se pudo cargar');
  await expect(status).toContainText('reiniciará la simulación');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('#monitor')).toBeVisible();
  await page.locator('#sim-pause').click();
  await expect.poll(() => page.evaluate(() => window.__ventila.running)).toBe(true);
  fail = false;
  await goToAula(page);
  await status.getByRole('button', { name: 'Recargar página' }).click();
  await page.waitForFunction(() => window.__ventila?.frame !== null);
  await goToAula(page);
  await expect(page.locator('#teaching-body svg').first()).toBeVisible();
});
