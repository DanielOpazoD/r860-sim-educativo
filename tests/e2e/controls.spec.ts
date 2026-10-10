import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  closePersonalization,
  frame,
  hidePanel,
  open,
  openPersonalization,
  openPresentation,
  openTimeControls,
  showPanel,
} from './helpers';

async function chooseRadio(page: Page, groupId: string, value: string) {
  const radio = page.locator(`#${groupId} input[type="radio"][value="${value}"]`);
  await radio.locator('xpath=..').click();
  await expect(radio).toBeChecked();
}

test.describe('Controles exteriores coherentes', () => {
  test('los segmentados de Pantalla cambian sus controles y las preferencias persisten al recargar', async ({ page }) => {
    await open(page);
    await openPresentation(page);
    await chooseRadio(page, 'wave-window', '12');
    await chooseRadio(page, 'wave-window', '6');
    await chooseRadio(page, 'wave-style', 'scroll');
    await chooseRadio(page, 'wave-scale', 'fixed');
    await chooseRadio(page, 'numeric-density', '6');

    await expect.poll(() => page.evaluate(() => window.__r860.waveScale)).toBe('fixed');
    await expect(page.locator('#numeric-density input[value="6"]')).toBeChecked();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('r860.tileDensity'))).toBe('6');
    await expect(page.locator('#waves-canvas')).toBeVisible();
    await closePersonalization(page);
    await page.locator('[data-view="basic"]').click();
    await expect.poll(() => page.evaluate(() => window.__r860.view)).toBe('basic');
    await page.locator('[data-view="waves"]').click();
    await expect.poll(() => page.evaluate(() => window.__r860.view)).toBe('waves');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const prefs = JSON.parse(localStorage.getItem('r860.prefs') ?? '{}');
          return [prefs.waveWindow, prefs.waveStyle, prefs.waveScale];
        }),
      )
      .toEqual(['6', 'scroll', 'fixed']);

    await page.reload();
    await expect(page.locator('#wave-window input[value="6"]')).toBeChecked();
    await expect(page.locator('#wave-style input[value="scroll"]')).toBeChecked();
    await expect(page.locator('#wave-scale input[value="fixed"]')).toBeChecked();
    await expect(page.locator('#numeric-density input[value="6"]')).toBeChecked();
    await expect.poll(() => page.evaluate(() => window.__r860.waveScale)).toBe('fixed');
  });

  test('la barra muestra exactamente Pausar y Personalizar vista, y Sesión sólo aparece en Más opciones', async ({ page }) => {
    await open(page);
    await expect(page.locator('.signal-toolbar button:visible')).toHaveCount(2);
    await expect(page.locator('#sim-pause')).toBeVisible();
    await expect(page.locator('#wave-options-button')).toBeVisible();
    await expect(page.locator('.top-actions > [data-action="session"]')).toHaveCount(0);
    await page.locator('#more-button').click();
    await expect(page.locator('#more-menu [data-action="session"]')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Descripción de variables muestra el glosario y persiste al recargar', async ({ page }) => {
    await open(page);
    await openPersonalization(page);
    const toggle = page.locator('#variable-descriptions');
    const guides = page.locator('#wave-guides');
    const annotations = page.locator('#wave-annotations');
    const legend = page.locator('#variable-legend');
    await expect(toggle).not.toBeChecked();
    await expect(legend).toBeHidden();
    await expect(guides).toBeChecked();
    await expect(annotations).toBeChecked();
    await toggle.check();
    await guides.uncheck();
    await annotations.uncheck();
    await expect(page.locator('#wave-ref-button')).toBeDisabled();
    await expect(legend).toBeVisible();
    const stressIndex = legend.locator('dl > div').filter({ hasText: 'Índice de estrés' });
    await expect(stressIndex.locator('dd')).toHaveText(
      'Forma de la curva de presión durante una inspiración a flujo constante. Con flujo constante el volumen entra a ritmo fijo, así que la forma de la presión frente al tiempo es la forma de la presión elástica frente al volumen dentro del volumen corriente.',
    );
    await expect(stressIndex.locator('dd')).not.toHaveText('Índice de estrés');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const prefs = JSON.parse(localStorage.getItem('r860.prefs') ?? '{}');
          return [prefs.variableDescriptions, prefs.waveGuides, prefs.waveAnnotations];
        }),
      )
      .toEqual([true, false, false]);
    await closePersonalization(page);
    await page.reload();
    await expect(toggle).toBeChecked();
    await expect(legend).toBeVisible();
    await openPersonalization(page);
    await expect(guides).not.toBeChecked();
    await expect(annotations).not.toBeChecked();
    await expect(page.locator('#wave-ref-button')).toBeDisabled();
    await toggle.uncheck();
    await guides.check();
    await annotations.check();
    await expect(page.locator('#wave-ref-button')).toBeEnabled();
    await expect(legend).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const prefs = JSON.parse(localStorage.getItem('r860.prefs') ?? '{}');
          return [prefs.variableDescriptions, prefs.waveGuides, prefs.waveAnnotations];
        }),
      )
      .toEqual([false, true, true]);
  });

  test('las preferencias de ayudas no se escriben en una referencia fotográfica', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'r860.prefs',
        JSON.stringify({ v: 1, welcomed: true, variableDescriptions: false, waveGuides: true, waveAnnotations: true }),
      ),
    );
    await open(page, { fixture: 'P1' }, { firstRun: true });
    await expect(page.locator('#scenario-name')).toContainText('Referencia fotográfica P1');
    await openPersonalization(page);
    await page.locator('#variable-descriptions').check();
    await page.locator('#wave-guides').uncheck();
    await page.locator('#wave-annotations').uncheck();
    await expect(page.locator('#variable-legend')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('r860.prefs') ?? '{}')))
      .toEqual({ v: 1, welcomed: true, variableDescriptions: false, waveGuides: true, waveAnnotations: true });
  });

  test('los estados activos sobreviven al cierre y la pausa conserva la velocidad', async ({ page }) => {
    await open(page, { speed: 3 });
    await expect.poll(async () => (await frame(page)).breathCount, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    await openPersonalization(page);
    await expect(page.locator('#wave-ref-button')).toBeVisible();
    await expect(page.locator('#freeze-button')).toBeHidden();
    await openTimeControls(page);
    await page.locator('#freeze-button').click();
    await expect(page.locator('#view-active-state')).toContainText('Curvas congeladas');
    await openPersonalization(page);
    await page.locator('#wave-ref-button').click();
    await expect(page.locator('#view-active-state')).toContainText('Referencia activa');
    await closePersonalization(page);
    await page.locator('#sim-pause').click();
    await expect(page.locator('#sim-pause')).toContainText('Reanudar · 3×');
    await expect(page.locator('#wave-ref-button')).toBeHidden();
    await expect(page.locator('#freeze-button')).toBeHidden();
    await expect(page.locator('#view-active-state')).toContainText('Curvas congeladas');
    await expect(page.locator('#view-active-state')).toContainText('Referencia activa');
  });

  test('el diálogo conserva su caja y no desborda al cambiar de pestaña', async ({ page, isMobile }) => {
    if (isMobile) await page.setViewportSize({ width: 375, height: 800 });
    await open(page, { scenario: 'SC-02', instructor: 0 });
    const boxes: {
      x: number;
      y: number;
      width: number;
      height: number;
      right: number;
      scroll: number;
      client: number;
    }[] = [];
    for (const select of [openPersonalization, openPresentation, openTimeControls]) {
      await select(page);
      boxes.push(
        await page.locator('#wave-options').evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            scroll: el.scrollWidth,
            client: el.clientWidth,
          };
        }),
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        await page.evaluate(() => window.innerWidth + 1),
      );
    }
    for (const box of boxes) {
      expect(box.x).toBeCloseTo(boxes[0]!.x, 0);
      expect(box.y).toBeCloseTo(boxes[0]!.y, 0);
      expect(box.width).toBeCloseTo(boxes[0]!.width, 0);
      expect(box.height).toBeCloseTo(boxes[0]!.height, 0);
      expect(box.right).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth + 1));
      expect(box.scroll).toBeLessThanOrEqual(box.client + 1);
    }
    if (!isMobile) {
      await page.setViewportSize({ width: 844, height: 400 });
      await openPersonalization(page);
      const dialog = page.locator('#wave-options');
      const body = dialog.locator('.view-settings-body');
      const before = await dialog.boundingBox();
      expect(before).not.toBeNull();
      await body.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await page.locator('#view-tab-monitor').click();
      await expect(body).toHaveJSProperty('scrollTop', 0);
      await expect(page.locator('#wave-window')).toBeVisible();
      await expect(page.locator('#wave-window label').first()).toBeVisible();
      const after = await dialog.boundingBox();
      expect(after).not.toBeNull();
      expect(after!.x).toBeCloseTo(before!.x, 0);
      expect(after!.y).toBeCloseTo(before!.y, 0);
      expect(after!.width).toBeCloseTo(before!.width, 0);
      expect(after!.height).toBeCloseTo(before!.height, 0);
    }
  });

  test('las pestañas usan flechas/Home/End, el diálogo atrapa el foco y Escape lo cierra', async ({ page }) => {
    await open(page);
    await openPersonalization(page);
    await expect(page.locator('#wave-options')).toHaveJSProperty('open', true);
    await expect(page.locator('#wave-options-button')).toHaveAttribute('aria-expanded', 'true');
    const aids = page.locator('#view-tab-aids');
    const monitor = page.locator('#view-tab-monitor');
    const time = page.locator('#view-tab-time');
    const checkSelection = async (selected: 'aids' | 'monitor' | 'time') => {
      const panels = {
        aids: page.locator('#view-aids'),
        monitor: page.locator('#view-presentation'),
        time: page.locator('#view-time'),
      };
      const tabs = { aids, monitor, time };
      for (const key of ['aids', 'monitor', 'time'] as const) {
        await expect(tabs[key]).toHaveAttribute('aria-selected', key === selected ? 'true' : 'false');
        await expect(tabs[key]).toHaveJSProperty('tabIndex', key === selected ? 0 : -1);
        if (key === selected) await expect(panels[key]).toBeVisible();
        else await expect(panels[key]).toBeHidden();
      }
    };
    await expect(aids).toBeFocused();
    await checkSelection('aids');
    await page.keyboard.press('ArrowRight');
    await expect(monitor).toBeFocused();
    await checkSelection('monitor');
    await page.keyboard.press('ArrowRight');
    await expect(time).toBeFocused();
    await checkSelection('time');
    await page.keyboard.press('ArrowLeft');
    await expect(monitor).toBeFocused();
    await checkSelection('monitor');
    await page.keyboard.press('Home');
    await expect(aids).toBeFocused();
    await checkSelection('aids');
    await page.keyboard.press('End');
    await expect(time).toBeFocused();
    await checkSelection('time');
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      expect(await page.locator('#wave-options').evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await closePersonalization(page);
    await openPersonalization(page);
    await page.locator('#view-options-close').click();
    await expect(page.locator('#wave-options')).toBeHidden();
    await expect(page.locator('#wave-options-button')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#wave-options-button')).toBeFocused();
  });

  test('Modo: el paso de VT cruza 300 mL por la regla, slider sincroniza y Cancelar no aplica', async ({ page }) => {
    await open(page, { speed: 4 });
    const original = (await frame(page)).settings.vt;
    await page.locator('[data-action="modes"]').first().click();
    const vt = page.locator('[data-mode-field="vt"]');
    const range = page.locator('[data-mode-range="vt"]');
    await vt.fill('300');
    await vt.dispatchEvent('input');
    await page.locator('[data-mode-step="vt"][data-direction="1"]').click();
    await expect(vt).toHaveValue('325');
    const index325 = Number(await range.inputValue());
    await range.evaluate((el: HTMLInputElement) => {
      el.value = String(Number(el.value) - 1);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(vt).toHaveValue('300');
    await page.locator('[data-mode-step="vt"][data-direction="1"]').click();
    await expect(vt).toHaveValue('325');
    await expect(range).toHaveValue(String(index325));
    expect((await frame(page)).settings.vt).toBe(original);

    await page.locator('#app-dialog [data-action="closeDialog"].secondary-button').click();
    await expect(page.locator('#app-dialog')).not.toHaveAttribute('open', '');
    expect((await frame(page)).settings.vt).toBe(original);

    await page.locator('[data-action="modes"]').first().click();
    await page.locator('[data-mode-field="vt"]').fill('300');
    await page.locator('[data-mode-field="vt"]').dispatchEvent('input');
    await page.locator('[data-mode-step="vt"][data-direction="1"]').click();
    await page.locator('[data-action="confirmModes"]').click();
    await expect.poll(async () => (await frame(page)).settings.vt, { timeout: 15_000 }).toBe(0.325);
  });

  test('Paciente: − y deslizador modifican la mecánica simulada', async ({ page }) => {
    await open(page, { speed: 4 });
    await showPanel(page, 'patient');
    const compliance = page.locator('[data-phys-number="compliance"]');
    await expect(compliance).toHaveValue('50');
    await page.locator('[data-phys-step="compliance"][data-direction="-1"]').click();
    await expect(compliance).toHaveValue('49');
    await expect
      .poll(() => page.evaluate(() => (window.__r860.frame as unknown as { truth: { patient: { crs: number } } }).truth.patient.crs * 1000))
      .toBe(49);

    const range = page.locator('[data-phys-range="compliance"]');
    await range.evaluate((el: HTMLInputElement) => {
      el.value = '60';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(compliance).toHaveValue('60');
    await expect
      .poll(() => page.evaluate(() => (window.__r860.frame as unknown as { truth: { patient: { crs: number } } }).truth.patient.crs * 1000))
      .toBe(60);
  });

  test('límites: Off vuelve al mínimo, admite Off y confirma sólo el borrador válido', async ({ page }) => {
    await open(page);
    const initial = await page.evaluate(
      () => (window.__r860.frame as unknown as { alarmLimits: { rrLow: number | 'off' } }).alarmLimits.rrLow,
    );
    await page.locator('[data-action="alarms"]').first().click();
    await page.locator('#app-dialog [data-action="alarmSetup"]').click();
    const rrLow = page.locator('[data-limit="rrLow"]');
    await rrLow.fill('');
    await page.locator('[data-limit-step="rrLow"][data-direction="1"]').click();
    await expect(rrLow).toHaveValue('1');
    await page.locator('[data-limit-step="rrLow"][data-direction="-1"]').click();
    await expect(rrLow).toHaveValue('');
    await rrLow.fill('1.5');
    await rrLow.dispatchEvent('input');
    await expect(rrLow).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[data-action="confirmLimits"]')).toBeDisabled();
    await rrLow.fill('');
    await rrLow.dispatchEvent('input');
    await expect(rrLow).not.toHaveAttribute('aria-invalid', 'true');
    expect(
      await page.evaluate(() => (window.__r860.frame as unknown as { alarmLimits: { rrLow: number | 'off' } }).alarmLimits.rrLow),
    ).toBe(initial);

    await page.locator('[data-limit-step="rrLow"][data-direction="1"]').click();
    await expect(rrLow).toHaveValue('1');
    await page.locator('[data-action="confirmLimits"]').click();
    await expect
      .poll(() => page.evaluate(() => (window.__r860.frame as unknown as { alarmLimits: { rrLow: number | 'off' } }).alarmLimits.rrLow))
      .toBe(1);

    await page.locator('[data-action="alarms"]').first().click();
    await page.locator('#app-dialog [data-action="alarmSetup"]').click();
    await page.locator('[data-limit="rrLow"]').fill('');
    await page.locator('[data-limit-step="rrLow"][data-direction="-1"]').click();
    await expect(page.locator('[data-limit="rrLow"]')).toHaveValue('');
    await page.locator('[data-action="confirmLimits"]').click();
    await expect
      .poll(() => page.evaluate(() => (window.__r860.frame as unknown as { alarmLimits: { rrLow: number | 'off' } }).alarmLimits.rrLow))
      .toBe('off');
  });

  test('minRate respeta Off y su mínimo; switches y ayudas responden al teclado y al foco', async ({ page }) => {
    await open(page, { speed: 1 });
    await page.locator('[data-action="modes"]').first().click();
    await page.locator('.mode-option[data-mode="CPAP_PS"]').click();
    const minRate = page.locator('[data-mode-field="minRate"]');
    await expect(minRate).toHaveValue('');
    await page.locator('[data-mode-step="minRate"][data-direction="-1"]').click();
    await expect(minRate).toHaveValue('');
    await page.locator('[data-mode-step="minRate"][data-direction="1"]').click();
    await expect(minRate).toHaveValue('1');
    await page.locator('[data-mode-step="minRate"][data-direction="-1"]').click();
    await expect(minRate).toHaveValue('');
    await minRate.fill('1.5');
    await minRate.dispatchEvent('input');
    await expect(page.locator('[data-action="confirmModes"]')).toBeDisabled();
    await minRate.fill('');
    await minRate.dispatchEvent('input');
    await expect(page.locator('[data-action="confirmModes"]')).toBeEnabled();
    await expect(minRate).toHaveAttribute('aria-describedby');
    const pressureSwitch = page.locator('[data-mode-field="triggerByPressure"]');
    const modeHelpId = await pressureSwitch.getAttribute('aria-describedby');
    expect(modeHelpId).toBeTruthy();
    await pressureSwitch.focus();
    await expect(page.locator(`#${modeHelpId}`)).toBeVisible();
    await page.keyboard.press('Space');
    await expect(pressureSwitch).toBeChecked();
    await page.locator('#app-dialog [data-action="closeDialog"].secondary-button').click();

    await showPanel(page, 'learn');
    await page.locator('#exam-toggle').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#exam-toggle')).toHaveAttribute('role', 'switch');
    await expect(page.locator('#exam-toggle')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#exam-toggle')).toHaveAttribute('aria-pressed', 'true');

    await showPanel(page, 'patient');
    const patientField = page.locator('[data-phys-number="compliance"]');
    const helpId = await patientField.getAttribute('aria-describedby');
    expect(helpId).toBeTruthy();
    await patientField.focus();
    await expect(page.locator(`#${helpId}`)).toBeVisible();
    await hidePanel(page);
    await openPresentation(page);
    await page.locator('#wave-window input[value="12"]').focus();
    await page.keyboard.press('Home');
    await expect(page.locator('#wave-window input:checked')).toHaveValue('6');
    await openTimeControls(page);
    const expectSpeed = async (speed: number) => {
      const option = page.locator(`.speed-option[data-speed="${speed}"]`);
      await expect(option).toBeFocused();
      await expect(option).toHaveAttribute('aria-checked', 'true');
      await expect.poll(() => page.evaluate(() => window.__r860.speed)).toBe(speed);
    };
    await page.locator('.speed-option[data-speed="1"]').focus();
    for (const [key, speed] of [
      ['ArrowLeft', 0.5],
      ['ArrowRight', 1],
      ['ArrowDown', 2],
      ['ArrowUp', 1],
      ['Home', 0.25],
      ['ArrowLeft', 4],
      ['ArrowRight', 0.25],
      ['End', 4],
      ['Home', 0.25],
    ] as const) {
      await page.keyboard.press(key);
      await expectSpeed(speed);
    }
    await closePersonalization(page);
    await expect(page.locator('#speed-options')).toBeHidden();
    await expect(page.locator('#wave-options-button')).toBeFocused();
  });
});
