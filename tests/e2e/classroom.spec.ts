import { expect, test } from '@playwright/test';
import { frame, open, openAula, openSimulator } from './helpers';

const aulaSections = ['lesson', 'theory', 'questions', 'exam', 'results', 'library'] as const;

test.describe('AULA · aprendizaje fuera del monitor', () => {
  test('Paciente y Eventos quedan abiertos por omisión en escritorio y cerrados en móvil; el monitor ya no contiene educación', async ({
    page,
  }, info) => {
    await open(page);
    // En escritorio el panel acompaña al equipo desde el inicio; en móvil lo taparía.
    if (info.project.name === 'mobile') await expect(page.locator('#workspace')).toHaveClass(/teacher-hidden/);
    else await expect(page.locator('#workspace')).not.toHaveClass(/teacher-hidden/);
    await expect(page.locator('[data-instructor]')).toHaveCount(2);
    await expect(page.locator('[data-instructor="patient"]')).toBeAttached();
    await expect(page.locator('[data-instructor="events"]')).toBeAttached();
    await expect(page.locator('[data-instructor="learn"]')).toHaveCount(0);
    await expect(page.locator('.monitor-nav [data-view="teaching"]')).toHaveCount(0);
    await expect(page.locator('#monitor #view-teaching')).toHaveCount(0);
    expect(await page.locator('#view-teaching').evaluate((el) => el.closest('#aula-theory-host') !== null)).toBe(true);
  });

  test('SC-01 · la práctica acompaña el primer objetivo y la navegación conserva sesión y ajustes', async ({ page }) => {
    await open(page, { scenario: 'SC-01', speed: 4 });
    await openAula(page, 'lesson');
    await expect(page.locator('#lesson-count')).toHaveText('0 de 3 objetivos');
    const firstObjective = (await page.locator('#lesson-tasks .task:not(.complete) span').nth(1).textContent())?.trim();

    await page.click('[data-action="practice"]');
    await expect(page.locator('#practice-card')).toBeVisible();
    await expect(page.locator('#practice-objective')).toHaveText(firstObjective ?? '');
    await page.click('[data-action="inspiratory"]');
    await page.click('#hold-run');
    await expect(page.locator('#practice-progress')).toHaveText('1/3 · Práctica activa', { timeout: 30_000 });
    await expect(page.locator('#lesson-tasks .task.complete')).toHaveCount(1);
    const nextObjective = (await page.locator('#lesson-tasks .task:not(.complete) span').nth(1).textContent())?.trim();
    await expect(page.locator('#practice-objective')).toHaveText(nextObjective ?? '');

    await page.locator('#sim-pause').click();
    await expect.poll(() => page.evaluate(() => window.__ventila.running)).toBe(false);
    const before = await frame(page);
    const scenario = await page.locator('#scenario-name').textContent();
    await openAula(page, 'lesson');
    await expect(page.locator('#lesson-count')).toHaveText('1 de 3 objetivos');
    await expect(page.locator('#scenario-name')).toHaveText(scenario ?? '');
    await openSimulator(page);
    const after = await frame(page);
    expect({
      simTimeMs: after.simTimeMs,
      breathCount: after.breathCount,
      settings: after.settings,
      paw: after.live.paw,
    }).toEqual({
      simTimeMs: before.simTimeMs,
      breathCount: before.breathCount,
      settings: before.settings,
      paw: before.live.paw,
    });
    await expect(page.locator('#practice-card')).toBeVisible();
    await expect(page.locator('#practice-progress')).toHaveText('1/3 · Práctica activa');
  });

  test('la práctica flota junto al equipo: el monitor no se desplaza ni aparece scroll en escritorio', async ({ page }) => {
    await open(page, { scenario: 'SC-01', speed: 4 });
    const before = await page.locator('#monitor').boundingBox();
    await openAula(page, 'lesson');
    await page.click('[data-action="practice"]');
    await expect(page.locator('#practice-card')).toBeVisible();
    await expect(page.locator('#practice-link')).toHaveText('Ver lección');
    const vp = page.viewportSize();
    if (vp && vp.width > 700) {
      await expect
        .poll(async () => {
          const box = await page.locator('#monitor').boundingBox();
          return box && box.height > 0 ? box : null;
        })
        .toEqual(before);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
      await expect(page.locator('#sim-pause')).toBeInViewport();
    }
    await page.click('[data-action="stopPractice"]');
    await expect(page.locator('#practice-card')).toBeHidden();
  });

  test('las notas sobreviven al cambio de espacio y elegir el caso actual no reinicia la sesión', async ({ page }) => {
    await open(page, { scenario: 'SC-01', speed: 4 });
    await openAula(page, 'questions');
    await page.locator('#reflection-notes').fill('Observo la misma sesión desde ambos espacios.');
    await openSimulator(page);
    await openAula(page, 'questions');
    await expect(page.locator('#reflection-notes')).toHaveValue('Observo la misma sesión desde ambos espacios.');
    await openSimulator(page);
    await page.locator('#sim-pause').click();
    await expect.poll(() => page.evaluate(() => window.__ventila.running)).toBe(false);
    const before = await frame(page);

    await openAula(page, 'library');
    await page.locator('[data-aula-case="SC-01"]').click();
    const after = await frame(page);
    expect({
      simTimeMs: after.simTimeMs,
      breathCount: after.breathCount,
      settings: after.settings,
    }).toEqual({
      simTimeMs: before.simTimeMs,
      breathCount: before.breathCount,
      settings: before.settings,
    });
    await openAula(page, 'questions');
    await expect(page.locator('#reflection-notes')).toHaveValue('Observo la misma sesión desde ambos espacios.');
  });

  test('cambiar de caso desde Biblioteca borra notas y detiene la práctica guiada', async ({ page }) => {
    await open(page, { scenario: 'SC-01', speed: 4 });
    await openAula(page, 'lesson');
    await page.click('[data-action="practice"]');
    await expect(page.locator('#practice-card')).toBeVisible();
    await openAula(page, 'questions');
    await page.locator('#reflection-notes').fill('Nota del caso anterior.');
    await openSimulator(page);
    await openAula(page, 'questions');
    await expect(page.locator('#reflection-notes')).toHaveValue('Nota del caso anterior.');
    await openAula(page, 'library');

    const caseButton = page.locator('.aula-case:not([data-aula-case="SC-01"])').first();
    const newScenario = (await caseButton.locator('strong').textContent())?.trim();
    await caseButton.click();
    await expect(page.locator('#scenario-name')).toHaveText(newScenario ?? '');
    await openSimulator(page);
    await expect(page.locator('#practice-card')).toBeHidden();
    await expect(page.locator('#practice-stop')).toBeHidden();
    await openAula(page, 'questions');
    await expect(page.locator('#reflection-notes')).toHaveValue('');
  });

  test('la URL heredada ?view=teaching abre Fundamentos fuera del monitor y vuelve a Curvas', async ({ page }) => {
    await open(page, { view: 'teaching' });
    await expect(page.locator('#classroom')).toBeVisible();
    await expect(page.locator('#aula-theory')).toBeVisible();
    await expect(page.locator('#view-teaching')).toBeVisible();
    await expect(page.locator('#monitor')).toBeHidden();
    await page.locator('#space-simulator').click();
    await expect(page.locator('#workspace')).toBeVisible();
    await expect(page.locator('[data-view="waves"]')).toHaveClass(/chosen/);
    await expect.poll(() => page.evaluate(() => window.__ventila.view)).toBe('waves');
  });

  test('el resumen se abre en Resultados y la exportación queda dentro de su disclosure', async ({ page }) => {
    await open(page, { scenario: 'SC-01', paused: 1 });
    await page.locator('.palette-trigger').click();
    await page.locator('#palette-input').fill('Resumen para el debriefing');
    await page.locator('#palette-input').press('Enter');
    await expect(page.locator('#aula-results')).toBeVisible();
    await expect(page.locator('#aula-results-body')).toContainText('La presión tiene dos componentes');
    await expect(page.locator('#aula-results-body')).toContainText('0 mediciones estimadas en el escenario actual');
    const details = page.locator('#aula-results details.aula-export');
    const exportButton = details.locator('[data-action="exportDebrief"]');
    expect(await exportButton.evaluate((el) => el.closest('details')?.classList.contains('aula-export'))).toBe(true);
    await expect(exportButton).toBeHidden();
    await details.locator('summary').click();
    await expect(exportButton).toBeVisible();
  });

  test('las capturas móviles del Aula no desbordan y conservan visible el contenido de cada sección', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page);
    const contentBySection: Record<(typeof aulaSections)[number], string> = {
      lesson: '#aula-lesson .aula-paper',
      theory: '#aula-theory .edu-card:first-of-type',
      questions: '#aula-questions #reflection-notes',
      exam: '#aula-exam #exam-toggle',
      results: '#aula-results-body > *',
      library: '#aula-library-list .aula-case',
    };
    for (const section of aulaSections) {
      await openAula(page, section);
      await expect(page.locator(contentBySection[section]).first()).toBeVisible();
      const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
      expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
    }
  });

  test('una referencia fotográfica no permite iniciar práctica', async ({ page }) => {
    await open(page, { fixture: 'P3' });
    await expect(page.locator('#scenario-name')).toContainText('Referencia fotográfica P3');
    await openAula(page, 'lesson');
    await expect(page.locator('[data-action="practice"]')).toBeDisabled();
    await expect(page.locator('#practice-card')).toBeHidden();
  });

  test('la navegación por teclado enfoca el título del Aula y luego el monitor', async ({ page }) => {
    await open(page);
    await page.locator('#space-classroom').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#classroom-title')).toBeFocused();
    await page.locator('#space-simulator').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#monitor')).toBeFocused();
  });
});
