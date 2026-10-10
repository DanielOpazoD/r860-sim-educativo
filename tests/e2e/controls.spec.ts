import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { frame, hidePanel, open, showPanel } from './helpers';

async function chooseRadio(page: Page, groupId: string, value: string) {
  const radio = page.locator(`#${groupId} input[type="radio"][value="${value}"]`);
  await radio.locator('xpath=..').click();
  await expect(radio).toBeChecked();
}

test.describe('Controles exteriores coherentes', () => {
  test('los segmentados de Pantalla cambian sus controles y las preferencias persisten al recargar', async ({ page }) => {
    await open(page);
    await page.locator('#wave-options-button').click();
    await chooseRadio(page, 'wave-window', '12');
    await chooseRadio(page, 'wave-window', '6');
    await chooseRadio(page, 'wave-style', 'scroll');
    await chooseRadio(page, 'wave-scale', 'fixed');
    await chooseRadio(page, 'numeric-density', '6');

    await expect.poll(() => page.evaluate(() => window.__r860.waveScale)).toBe('fixed');
    await expect(page.locator('#numeric-density input[value="6"]')).toBeChecked();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('r860.tileDensity'))).toBe('6');
    await expect(page.locator('#waves-canvas')).toBeVisible();
    await page.locator('#wave-options-button').click();
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
    await open(page, { speed: 4 });
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
    await page.locator('#wave-options-button').click();
    await page.locator('#wave-window input[value="12"]').focus();
    await page.keyboard.press('Home');
    await expect(page.locator('#wave-window input:checked')).toHaveValue('6');
    await page.locator('#speed-button').click();
    await page.locator('.speed-option[data-speed="1"]').focus();
    await page.keyboard.press('End');
    await expect(page.locator('.speed-option[data-speed="4"]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#speed-options')).toBeHidden();
    await expect(page.locator('#speed-button')).toBeFocused();
  });
});
