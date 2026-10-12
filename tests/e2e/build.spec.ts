import { expect, test } from '@playwright/test';
import { ENGINE_VERSION } from '../../src/engine/version';
import { open, openAula, openSimulator } from './helpers';

test('el build carga Fundamentos y Biblioteca sólo al abrirlos y reutiliza sus módulos', async ({ page, context }) => {
  const modules: string[] = [];
  page.on('request', (request) => {
    if (/\/(?:teachingView|libraryView)-[^/]+\.js$/.test(new URL(request.url()).pathname)) modules.push(request.url());
  });
  await open(page, { paused: 1 });
  const html = await (await page.request.get('/')).text();
  expect(html).toContain(`id="version-tag">v${ENGINE_VERSION} · Offline`);
  expect(html).not.toContain('%ENGINE_VERSION%');
  expect(modules).toEqual([]);
  await expect(page.locator('#version-tag')).toContainText(`v${ENGINE_VERSION}`);
  await openAula(page, 'lesson');
  expect(modules).toEqual([]);
  await openAula(page, 'theory');
  await expect(page.locator('#teaching-body svg').first()).toBeVisible();
  expect(modules.filter((url) => url.includes('teachingView-'))).toHaveLength(1);
  expect(modules.filter((url) => url.includes('libraryView-'))).toHaveLength(0);
  await openAula(page, 'library');
  await expect(page.locator('[data-aula-case="SC-01"]')).toBeVisible();
  expect(modules.filter((url) => url.includes('libraryView-'))).toHaveLength(1);
  await context.setOffline(true);
  await openSimulator(page);
  await openAula(page, 'theory');
  await expect(page.locator('#teaching-body svg').first()).toBeVisible();
  await openAula(page, 'library');
  await page.locator('#aula-search').fill('SC-02');
  await expect(page.locator('[data-aula-case]')).toHaveCount(1);
  await page.locator('[data-aula-case="SC-02"]').click();
  await expect(page.locator('#aula-scenario')).toContainText('SC-02');
  expect(modules).toHaveLength(2);
});

test('una carga fallida deja el simulador operativo y permite recuperar la sección', async ({ page }) => {
  let fail = true;
  await page.route('**/assets/libraryView-*.js', (route) => (fail ? route.abort() : route.continue()));
  await open(page, { paused: 1 });
  await openAula(page, 'library');
  const status = page.locator('#aula-library [role="status"]');
  await expect(status).toContainText('No se pudo cargar');
  await openSimulator(page);
  await expect(page.locator('#monitor')).toBeVisible();
  fail = false;
  await openAula(page, 'library');
  await expect(status).toContainText('reiniciará la simulación');
  await status.getByRole('button', { name: 'Recargar página' }).click();
  await page.waitForFunction(() => window.__ventila?.frame !== null);
  await openAula(page, 'library');
  await expect(page.locator('[data-aula-case="SC-01"]')).toBeVisible();
});
