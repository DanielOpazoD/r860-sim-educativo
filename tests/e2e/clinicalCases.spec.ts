import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { frame, hidePanel, open, showPanel } from './helpers';

test.describe('CASOS · una sola pantalla: el caso en el panel, el desarrollo bajo el equipo', () => {
  test('el panel abre en Explorar (perfiles, mecánica y eventos) en escritorio y cerrado en móvil; Casos tiene la lista', async ({
    page,
  }, info) => {
    await open(page);
    if (info.project.name === 'mobile') await expect(page.locator('#workspace')).toHaveClass(/teacher-hidden/);
    else {
      await expect(page.locator('#workspace')).not.toHaveClass(/teacher-hidden/);
      await expect(page.locator('[data-instructor="patient"]')).toHaveText('Explorar');
      await expect(page.locator('[data-instructor="patient"]')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#patient-profiles [data-profile]').first()).toBeVisible();
      await expect(page.locator('#fault-grid [data-event]')).toHaveCount(6);
      await expect(page.locator('#undo-event')).toBeVisible();
      // La gasometría es del modelo, no una medición del equipo: está en el panel, rotulada, y nunca en el monitor.
      await expect(page.locator('#case-gas .gas-tag')).toHaveText('modelo');
      await expect(page.locator('#case-gas thead')).toContainText('Inicio');
      await page.click('[data-instructor="case"]');
      await expect(page.locator('#instructor-case [data-case-id]')).toHaveCount(8);
      await expect(page.locator('#instructor-case [data-case-id]').first()).toBeVisible();
    }
    await expect(page.locator('[data-instructor]')).toHaveCount(2);
    await expect(page.locator('#monitor #view-teaching')).toHaveCount(0);
    await expect(page.locator('#monitor')).not.toContainText('PaCO₂');
    expect(await page.locator('#view-teaching').evaluate((el) => el.closest('#aula-theory-host') !== null)).toBe(true);
  });

  test('CC-01: se elige en el panel, se resuelve en el ventilador con la mecánica oculta y se revela al entregar', async ({ page }) => {
    await open(page, { speed: 4 });
    await page.locator('.app-context').click();
    await expect(page.locator('#instructor-case [data-case-id]')).toHaveCount(8);
    await page.locator('#instructor-case [data-case-id="CC-01"]').click();
    await expect(page.locator('#instructor-case .case-title')).toHaveText('Presión pico alta: ¿resistencia o distensibilidad?');
    await expect(page.locator('#scenario-name')).toHaveText('Presión pico alta: ¿resistencia o distensibilidad?');
    // Qué lograr y la referencia temática, a la vista en el panel.
    await expect(page.locator('#instructor-case .case-goal')).toBeVisible();
    await expect(page.locator('#instructor-case .case-refs a').first()).toHaveAttribute(
      'href',
      'https://pubmed.ncbi.nlm.nih.gov/25336536/',
    );
    const entregar = page.locator('#instructor-case [data-action="submitCase"]');
    await expect(entregar).toBeDisabled();
    await page.click('[data-case-option="r"]');
    await expect(entregar).toBeEnabled();

    // La mecánica del paciente es lo que se diagnostica: Explorar sólo muestra el aviso (y la salida del caso) hasta entregar.
    await expect(page.locator('#instructor')).toHaveClass(/case-locked/);
    await page.click('[data-instructor="patient"]');
    await expect(page.locator('#case-lock-note')).toBeVisible();
    await expect(page.locator('#case-lock-note [data-action="freeExplore"]')).toBeVisible();
    await expect(page.locator('#instructor-patient')).toBeHidden();
    await page.click('[data-instructor="case"]');
    await expect(page.locator('#case-lock-note')).toBeHidden();
    // Antes de entregar, el desarrollo no adelanta la respuesta.
    await expect(page.locator('#learn-case-body')).toContainText('Se revela al entregar');
    await expect(page.locator('#learn-case-body .case-reveal')).toHaveCount(0);

    await hidePanel(page);
    await page.click('[data-action="inspiratory"]');
    await page.click('#hold-run');
    await expect
      .poll(() => page.evaluate(() => window.__ventila.frame?.procedure.last.inspHold?.quality ?? null), { timeout: 20_000 })
      .toBe('valid');
    await page.click('[data-action="closeHold"]');
    await showPanel(page, 'case');
    await entregar.click();

    await expect(page.locator('#instructor-case .case-criteria')).toContainText('Caso resuelto');
    await expect(page.locator('#instructor')).not.toHaveClass(/case-locked/);
    await expect(page.locator('#learn-case .case-verdict')).toHaveText('Caso resuelto');
    await expect(page.locator('#learn-case .case-truth')).toContainText('30 / 20');
    await page.locator('#instructor-case [data-action="caseDevelopment"]').click();
    await expect(page.locator('#learn-case .case-reveal')).toBeInViewport();
    await showPanel(page, 'case');
    await page.locator('#instructor-case [data-action="scenarios"]').click();
    await expect(page.locator('#instructor-case [data-case-id="CC-01"]')).toContainText('Resuelto');
  });

  test('volver al caso en curso no lo reinicia; elegir otro caso carga su paciente y limpia la reflexión', async ({ page }) => {
    await open(page, { scenario: 'CC-03', speed: 4 });
    await page.locator('#reflection-notes').fill('La meseta sube con el VT.');
    await page.locator('#sim-pause').click();
    await expect.poll(() => page.evaluate(() => window.__ventila.running)).toBe(false);
    const before = await frame(page);

    await page.locator('.app-context').click();
    await page.locator('#instructor-case [data-case-id="CC-03"]').click();
    await expect(page.locator('#instructor-case .case-title')).toHaveText('SDRA: volumen corriente protector');
    const after = await frame(page);
    expect({ simTimeMs: after.simTimeMs, breathCount: after.breathCount, settings: after.settings }).toEqual({
      simTimeMs: before.simTimeMs,
      breathCount: before.breathCount,
      settings: before.settings,
    });
    await expect(page.locator('#reflection-notes')).toHaveValue('La meseta sube con el VT.');

    await page.locator('#instructor-case [data-action="scenarios"]').click();
    await page.locator('#instructor-case [data-case-id="CC-04"]').click();
    await expect(page.locator('#scenario-name')).toHaveText('PEEP decremental tras reclutamiento');
    await expect(page.locator('#instructor-case .case-title')).toHaveText('PEEP decremental tras reclutamiento');
    await expect(page.locator('#reflection-notes')).toHaveValue('');
  });

  test('«Aula» lleva a los Fundamentos bajo el equipo; en escritorio el caso sigue a la vista y nada desborda', async ({ page }, info) => {
    await open(page, { scenario: 'CC-03', paused: 1 });
    await showPanel(page, 'case');
    await page.locator('#instructor-case [data-action="classroom"]').click();
    await expect(page.locator('#learn-theory')).toBeInViewport();
    await expect(page.locator('#teaching-body svg').first()).toBeVisible();
    await expect(page.locator('#learn-theory')).toBeFocused();
    if (info.project.name !== 'mobile') {
      // El panel acompaña el desplazamiento: el caso y la gasometría siguen a la vista.
      await expect(page.locator('#instructor-case .case-title')).toBeInViewport();
      await expect(page.locator('#case-gas')).toBeInViewport();
    } else await expect(page.locator('#workspace')).toHaveClass(/teacher-hidden/);
    const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  });

  test('la URL heredada ?view=teaching lleva a los Fundamentos y el monitor sigue en Curvas', async ({ page }) => {
    await open(page, { view: 'teaching' });
    await expect(page.locator('#learn-theory')).toBeInViewport();
    await expect(page.locator('#teaching-body svg').first()).toBeVisible();
    await expect(page.locator('[data-view="waves"]')).toHaveClass(/chosen/);
    await expect.poll(() => page.evaluate(() => window.__ventila.view)).toBe('waves');
  });

  test('el resumen de práctica se descarga con el caso y su estado', async ({ page }) => {
    await open(page, { scenario: 'CC-03', paused: 1 });
    await page.locator('.palette-trigger').click();
    await page.locator('#palette-input').fill('Resumen de práctica');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#palette-input').press('Enter')]);
    const text = fs.readFileSync(await download.path(), 'utf8');
    expect(text).toContain('Caso CC-03 · SDRA · ventilación protectora: sin entregar.');
    expect(text).toContain('AJUSTES');
  });

  test('«Salir del caso» vuelve al banco pasivo con Explorar abierto', async ({ page }) => {
    await open(page, { scenario: 'CC-02', paused: 1 });
    await showPanel(page, 'patient');
    await page.locator('#case-lock-note [data-action="freeExplore"]').click();
    await expect(page.locator('#scenario-name')).toHaveText('Banco lineal pasivo');
    await expect(page.locator('#instructor')).not.toHaveClass(/case-locked/);
    await expect(page.locator('[data-instructor="patient"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#fault-grid [data-event]').first()).toBeVisible();
  });
});
