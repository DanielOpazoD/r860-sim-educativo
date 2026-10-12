import { expect, test } from '@playwright/test';
import { open, openAula, openSimulator } from './helpers';

test.describe('CASOS · caso clínico con entrega y revelación', () => {
  test('CC-01: se elige en el catálogo, se resuelve en el ventilador con la mecánica oculta y se revela al entregar', async ({ page }) => {
    await open(page, { speed: 4 });
    await openAula(page, 'library');
    // Ocho casos clínicos, cada uno con su tema y sus referencias en la tarjeta.
    await expect(page.locator('.aula-clinical [data-aula-case]')).toHaveCount(8);
    const tarjeta = page.locator('[data-aula-case="CC-01"]');
    // La referencia temática está a la vista desde el catálogo.
    await expect(tarjeta).toContainText('Hess, Respir Care 2014');
    await tarjeta.click();
    await expect(page.locator('#classroom-title')).toHaveText('Caso clínico');
    await expect(page.locator('#aula-case .case-refs a').first()).toHaveAttribute('href', 'https://pubmed.ncbi.nlm.nih.gov/25336536/');
    const entregar = page.locator('#aula-case [data-action="submitCase"]');
    await expect(entregar).toBeDisabled();
    await page.click('[data-case-option="r"]');
    await expect(entregar).toBeEnabled();

    await page.click('#aula-case [data-action="practice"]');
    await expect(page.locator('#practice-card')).toBeVisible();
    await expect(page.locator('#practice-submit')).toBeVisible();
    // La mecánica del paciente es lo que se diagnostica: no se muestra hasta entregar.
    await expect(page.locator('#case-lock-note')).not.toHaveAttribute('hidden', /.*/);
    await expect(page.locator('#instructor')).toHaveClass(/case-locked/);

    await page.click('[data-action="inspiratory"]');
    await page.click('#hold-run');
    await expect
      .poll(() => page.evaluate(() => window.__ventila.frame?.procedure.last.inspHold?.quality ?? null), { timeout: 20_000 })
      .toBe('valid');
    await page.click('[data-action="closeHold"]');
    await page.click('#practice-submit');

    await expect(page.locator('.case-verdict')).toHaveText('Caso resuelto');
    await expect(page.locator('.case-truth')).toContainText('30 / 20');
    await expect(page.locator('#instructor')).not.toHaveClass(/case-locked/);
    await openAula(page, 'library');
    await expect(page.locator('[data-aula-case="CC-01"]')).toContainText('Resuelto');
    await openSimulator(page);
  });
});
