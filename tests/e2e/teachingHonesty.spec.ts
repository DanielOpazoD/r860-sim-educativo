import { expect, test } from '@playwright/test';
import { open, openFundamentos } from './helpers';
test('SC-25 mantiene sus límites visibles en los Fundamentos', async ({ page }, info) => {
  await open(page, { scenario: 'SC-25', paused: 1 });
  await openFundamentos(page);
  await expect(page.locator('#teaching-body .notice-box')).toContainText('gases ni hemodinámica');
  await page.click('[data-edu-tab="proteccion"]');
  await expect(page.locator('#teaching-body')).toContainText('gases ni hemodinámica');
  await expect(page.locator('#teaching-body')).toContainText('no identifica una PEEP clínicamente segura');
  await page.screenshot({ path: info.outputPath('SC25-interpretacion.png'), fullPage: true });
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
