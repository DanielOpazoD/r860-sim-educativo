import { expect, test } from '@playwright/test';
import { open, openAula } from './helpers';
test('SC-25 mantiene sus límites visibles en lección, interpretación y resultados', async ({ page }, info) => {
  await open(page, { scenario: 'SC-25', paused: 1 });
  await openAula(page, 'lesson');
  await expect(page.locator('#lesson-caution')).toContainText('gases ni hemodinámica');
  await expect(page.locator('#lesson-caution')).toBeVisible();
  await page.screenshot({ path: info.outputPath('SC25-leccion.png'), fullPage: true });
  await openAula(page, 'theory');
  await page.click('[data-edu-tab="proteccion"]');
  await expect(page.locator('#teaching-body')).toContainText('gases ni hemodinámica');
  await expect(page.locator('#teaching-body')).toContainText('no identifica una PEEP clínicamente segura');
  await page.screenshot({ path: info.outputPath('SC25-interpretacion.png'), fullPage: true });
  await openAula(page, 'results');
  await expect(page.locator('#aula-results-body')).toContainText('gases ni hemodinámica');
});
test('la ayuda del bloqueo anuncia la maniobra que está abierta', async ({ page }, info) => {
  await open(page, { paused: 1 });
  await page.click('[data-action="expiratory"]');
  await expect(page.locator('#hold-help-button')).toHaveAccessibleName('Información sobre bloqueo espiratorio');
  await page.locator('#hold-help-button').click();
  await expect(page.locator('#hold-help')).toBeVisible();
  await page.screenshot({ path: info.outputPath('ayuda-espiratoria.png'), fullPage: true });
  await page.click('[data-action="closeHold"]');
  await page.click('[data-action="inspiratory"]');
  await expect(page.locator('#hold-help-button')).toHaveAccessibleName('Información sobre bloqueo inspiratorio');
});
