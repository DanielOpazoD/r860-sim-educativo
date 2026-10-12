import { expect, test } from '@playwright/test';
import { open, showPanel } from './helpers';

test.describe('Paleta de comandos', () => {
  test('Ctrl+K abre la paleta y permite aplicar un perfil', async ({ page, isMobile }) => {
    await open(page);
    const dialog = page.locator('#command-palette');
    const input = page.locator('#palette-input');

    await page.keyboard.press('Control+k');
    await expect(dialog).toBeVisible();
    await expect(input).toBeFocused();
    await input.fill('rigido');
    await expect(page.getByRole('option', { name: 'Perfil: Pulmón rígido' })).toBeVisible();
    await input.press('Enter');
    await expect(dialog).not.toBeVisible();
    if (!isMobile) {
      await showPanel(page, 'patient');
      await expect(page.locator('[data-phys-number="compliance"]')).toHaveValue('25');
    }
  });

  test('filtra vistas y ejecuta la selección con las flechas', async ({ page }) => {
    await open(page);
    await page.locator('.palette-trigger').click();
    const input = page.locator('#palette-input');
    await input.fill('tabla');
    await expect(page.getByRole('option', { name: 'Tabla de mediciones' })).toBeVisible();
    await input.press('ArrowDown');
    await input.press('ArrowUp');
    await expect(input).toHaveAttribute('aria-activedescendant', 'palette-opt-0');
    await input.press('Enter');
    await expect(page.locator('#command-palette')).not.toBeVisible();
    await expect(page.locator('[data-view-panel="data"]')).toHaveClass(/active/);
  });

  test('Escape cierra la paleta y devuelve el foco al botón', async ({ page }) => {
    await open(page);
    const trigger = page.locator('.palette-trigger');
    await trigger.click();
    await page.locator('#palette-input').press('Escape');
    await expect(page.locator('#command-palette')).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('una consulta sin coincidencias no ejecuta nada', async ({ page }) => {
    await open(page);
    const input = page.locator('#palette-input');
    await page.locator('.palette-trigger').click();
    await input.fill('zzzz');
    await expect(page.getByText('Sin resultados')).toBeVisible();
    await input.press('Enter');
    await expect(page.locator('#command-palette')).toBeVisible();
    await expect(page.locator('#scenario-name')).toHaveText('Banco lineal pasivo');
  });

  test('permite cargar un caso clínico por su identificador y lo presenta en el panel', async ({ page }) => {
    await open(page);
    const input = page.locator('#palette-input');
    await page.locator('.palette-trigger').click();
    await input.fill('CC-05');
    await expect(page.getByRole('option', { name: /Hipercapnia/ })).toBeVisible();
    await input.press('Enter');
    await expect(page.locator('#command-palette')).not.toBeVisible();
    await expect(page.locator('#scenario-name')).toHaveText('Hipercapnia: ventilación alveolar y espacio muerto');
    await expect(page.locator('#instructor-case .case-title')).toHaveText('Hipercapnia: ventilación alveolar y espacio muerto');
  });

  test('la cabecera no desborda horizontalmente', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
});
