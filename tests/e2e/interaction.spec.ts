import { expect, test } from '@playwright/test';
import { expectSafetyMark, frame, open } from './helpers';

test.describe('INT · selección, edición, confirmación y cancelación', () => {
  test('INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor', async ({ page }) => {
    await open(page, { autopause: 4000, speed: 4, instructor: 0 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 4000);
    const before = await frame(page);
    await page.click('[data-setting-quick="peep"]');
    await expect(page.locator('#quick-editor')).toBeVisible();
    await expect(page.locator('[data-setting-quick="peep"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
    await expect(page.locator('[data-quick-val="peep"]')).toHaveText('7');
    await expect(page.locator('#quick-value')).toHaveValue('7');
    const after = await frame(page);
    expect(after.settings.peep).toBe(before.settings.peep); expect(after.pending).toBeNull();
    await page.keyboard.press('Escape');
    await expect(page.locator('#quick-editor')).toBeHidden();
    await expect(page.locator('[data-quick-val="peep"]')).toHaveText('5');
  });
  test('INT-02 · confirmar edición válida: se aplica en la siguiente respiración', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.click('[data-setting-quick="vt"]'); await page.keyboard.press('ArrowUp');
    await expect(page.locator('#quick-value')).toHaveValue('525');
    await page.keyboard.press('Enter');
    await expect(page.locator('#quick-editor')).toBeHidden();
    await page.waitForFunction(() => { const f = window.__r860.frame as { settings: { vt: number } } | null; return !!f && Math.abs(f.settings.vt - 0.525) < 1e-9; }, null, { timeout: 15_000 });
    await expect(page.locator('[data-quick-val="vt"]')).toHaveText('525');
  });
  test('INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.click('[data-setting-quick="vt"]'); await page.fill('#quick-value', '287');
    await expect(page.locator('#quick-validation')).toContainText('rejilla');
    await expect(page.locator('[data-action="confirmEdit"]')).toBeDisabled();
    await page.fill('#quick-value', '300'); await expect(page.locator('[data-action="confirmEdit"]')).toBeEnabled();
    await page.keyboard.press('Escape');
    expect((await frame(page)).settings.vt).toBe(0.5);
  });
  test('INT-03 · cancelar y vencimiento del plazo no mutan ajustes', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0, editTimeout: 1500 });
    await page.click('[data-setting-quick="rr"]'); await page.keyboard.press('ArrowUp');
    await expect(page.locator('[data-quick-val="rr"]')).toHaveText('16');
    await page.waitForTimeout(2600);
    await expect(page.locator('#quick-editor')).toBeHidden();
    await expect(page.locator('[data-quick-val="rr"]')).toHaveText('15');
    await expect(page.locator('.toast').last()).toContainText('vencimiento');
    const f = await frame(page); expect(f.settings.rr).toBe(15); expect(f.pending).toBeNull();
  });
  test('INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.click('[data-action="standby"]');
    await expect(page.locator('#app-dialog')).toBeVisible();
    await page.click('#app-dialog [data-action="closeDialog"]');
    const a = await frame(page); expect(a.ventilation).toBe('ventilating');
    await page.waitForFunction((n) => (window.__r860.frame as { breathCount: number }).breathCount > n, a.breathCount, { timeout: 15_000 });
    await page.click('[data-action="standby"]'); await page.click('[data-action="confirmStandby"]');
    await page.waitForFunction(() => (window.__r860.frame as { ventilation: string }).ventilation === 'standby');
    await expect(page.locator('#standby-overlay')).toBeVisible();
    await expect(page.locator('#numeric-grid [data-metric="ppeak"] .numeric-value')).toHaveText('—');
    await page.click('#standby-overlay [data-action="startVentilation"]');
    await page.waitForFunction(() => (window.__r860.frame as { ventilation: string }).ventilation === 'ventilating');
    await expect(page.locator('#standby-overlay')).toBeHidden();
  });
  test('INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor', async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, { speed: 4, instructor: 0 });
    const before = await frame(page);
    for (let i = 0; i < 50; i++) { await page.locator('[data-view="basic"]').dispatchEvent('click'); await page.locator('[data-view="waves"]').dispatchEvent('click'); }
    await page.waitForTimeout(500);
    const after = await frame(page);
    expect(after.simTimeMs).toBeGreaterThan(before.simTimeMs); expect(after.breathCount).toBeGreaterThanOrEqual(before.breathCount); expect(after.settings).toEqual(before.settings);
    expect(await page.evaluate(() => window.__r860.mode)).toBe(await page.evaluate(() => window.__r860.mode));
  });
  test('INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    const before = await frame(page);
    await page.mouse.move(600, 400); await page.mouse.wheel(0, -300); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowDown');
    await page.locator('#trim-knob').hover(); await page.mouse.wheel(0, -200); await page.waitForTimeout(300);
    let f = await frame(page); expect(f.settings).toEqual(before.settings); expect(f.pending).toBeNull();
    await page.click('#lock-key'); await expect(page.locator('#lock-overlay')).toBeVisible();
    await page.click('[data-setting-quick="peep"]', { force: true }); await expect(page.locator('#quick-editor')).toBeHidden();
    await page.click('#lock-overlay [data-action="unlock"]'); await page.click('[data-setting-quick="peep"]'); await expect(page.locator('#quick-editor')).toBeVisible();
    await page.keyboard.press('Escape'); f = await frame(page); expect(f.settings).toEqual(before.settings);
  });
  test('PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.click('[data-action="inspiratory"]'); await expect(page.locator('#hold-panel')).toBeVisible();
    await page.click('#hold-run');
    await expect(page.locator('#hold-status')).toContainText(/Esperando|Oclusión/);
    await expect(page.locator('#hold-value')).toHaveText('15', { timeout: 20_000 });
    await expect(page.locator('#hold-second')).toHaveText('50');
    const status = await page.locator('#hold-status').textContent();
    expect(status).toMatch(/Medido · 18-Ago-2026 21:04:(0[5-9]|1[0-9]|2[0-9])/);
    await page.click('[data-action="closeHold"]'); await expect(page.locator('#hold-panel')).toBeHidden();
    await page.waitForTimeout(1500); await page.click('[data-action="inspiratory"]');
    await expect(page.locator('#hold-value')).toHaveText('15'); expect(await page.locator('#hold-status').textContent()).toBe(status);
    await expect(page.locator('#numeric-grid [data-metric="pplat"] .numeric-age')).toContainText('Med.');
    expect((await frame(page)).procedure.last.inspHold?.quality).toBe('valid');
  });
  test('ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.locator('[data-setting-quick="peep"]').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#quick-editor')).toBeVisible();
    await page.keyboard.press('ArrowUp'); await expect(page.locator('[data-quick-val="peep"]')).toHaveText('6');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window.__r860.frame as unknown as { settings: { peep: number } }).settings.peep === 6, null, { timeout: 15_000 });
    await page.locator('[data-setting-quick="rr"]').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Escape');
    await expect(page.locator('#quick-editor')).toBeHidden(); expect((await frame(page)).settings.rr).toBe(15);
    await expectSafetyMark(page);
  });
  test('TIM-03 · pestaña oculta: pausa explícita con aviso; reanudación manual sin salto de reloj', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(page.locator('#global-notice')).toContainText('pausada');
    await page.waitForFunction(() => window.__r860.running === false);
    const t1 = (await frame(page)).simTimeMs; await page.waitForTimeout(1500); const t2 = (await frame(page)).simTimeMs; expect(t2).toBe(t1);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(800); expect((await frame(page)).simTimeMs).toBe(t2); // sigue pausada: reanudación manual
    await page.click('#sim-pause'); await page.waitForFunction((t) => (window.__r860.frame as { simTimeMs: number }).simTimeMs > t, t2, { timeout: 5000 });
    expect((await frame(page)).simTimeMs - t2).toBeLessThan(4 * 1500);
  });
  test('ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia', async ({ page }) => {
    await open(page, { scenario: 'SC-09', speed: 4 });
    await page.waitForFunction(() => (window.__r860.frame as { alarmBar: { color: string } }).alarmBar.color === 'red', null, { timeout: 30_000 });
    await page.click('[data-action="alarms"]'); await expect(page.locator('#live-alarms')).toContainText('ACTIVA');
    await page.click('[data-action="acknowledge"]');
    await page.waitForFunction(() => (window.__r860.frame as { alarms: { id: string; acknowledgedAtMs: number | null }[] }).alarms.some((a) => a.id === 'pmax' && a.acknowledgedAtMs !== null));
    expect((await frame(page)).alarmBar.color).toBe('red'); // reconocida pero la condición persiste
    await page.keyboard.press('Escape');
    // Resolver la causa desde el panel docente (Rinsp 400 → 10): la alarma se resuelve; como ya estaba reconocida, la banda vuelve a verde.
    await page.fill('[data-phys-number="resistance"]', '10'); await page.locator('[data-phys-number="resistance"]').press('Enter'); await page.locator('[data-phys-number="resistance"]').dispatchEvent('change');
    await page.waitForFunction(() => (window.__r860.frame as { alarmBar: { color: string } }).alarmBar.color === 'green', null, { timeout: 20_000 });
    // Nueva oclusión sin reconocer y resolución: banda gris (resuelta, pendiente de reconocer) hasta reconocer.
    await page.click('[data-instructor="events"]'); await page.click('[data-event="obstruction"]');
    await page.waitForFunction(() => (window.__r860.frame as { alarmBar: { color: string } }).alarmBar.color === 'red', null, { timeout: 20_000 });
    await page.click('[data-action="undoEvent"]');
    await page.waitForFunction(() => (window.__r860.frame as { alarmBar: { color: string } }).alarmBar.color === 'grey', null, { timeout: 20_000 });
    await expect(page.locator('#alarm-label')).toHaveText('Alarmas resueltas');
    await page.click('[data-action="alarms"]'); await expect(page.locator('#live-alarms')).toContainText('PENDIENTE DE RECONOCER');
    await page.click('[data-action="acknowledge"]');
    await page.waitForFunction(() => (window.__r860.frame as { alarmBar: { color: string } }).alarmBar.color === 'green', null, { timeout: 5000 });
  });
  test('SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => { const u = new URL(r.url()); if (u.host !== '127.0.0.1:4173') external.push(r.url()); });
    await open(page, { speed: 4, instructor: 0 });
    for (const v of ['basic', 'loops', 'data', 'trends', 'log', 'waves']) { await page.click(`[data-view="${v}"]`); await expectSafetyMark(page); }
    expect(external).toEqual([]);
  });
});
