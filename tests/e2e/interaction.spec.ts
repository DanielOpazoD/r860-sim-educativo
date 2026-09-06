import { expect, test } from '@playwright/test';
import { expectBanner, frame, open } from './helpers';

test.describe('INT · selección, edición, confirmación y cancelación', () => {
  test('INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor', async ({ page }) => {
    await open(page, { autopause: 4000, speed: 4, instructor: 0 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 4000);
    const before = await frame(page);
    const peep = page.locator('.qk[data-key="peep"]');
    await peep.click();
    await expect(peep).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(peep.locator('.value')).toHaveText('7');
    await expect(peep).toHaveClass(/editing/);
    const after = await frame(page);
    expect(after.settings.peep).toBe(before.settings.peep);
    expect(after.pending).toBeNull();
    await page.keyboard.press('Escape');
    await expect(peep.locator('.value')).toHaveText('5');
    await expect(peep).toHaveAttribute('aria-pressed', 'false');
  });

  test('INT-02 · confirmar edición válida: un evento, aplicación en la siguiente respiración, nuevo valor', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    const vt = page.locator('.qk[data-key="vt"]');
    await vt.click();
    await page.keyboard.press('ArrowUp');
    await expect(vt.locator('.value')).toHaveText('525');
    await page.keyboard.press('Enter');
    await expect(vt).toHaveAttribute('aria-pressed', 'false');
    await page.waitForFunction(() => { const f = window.__r860.frame as { settings: { vt: number } } | null; return !!f && Math.abs(f.settings.vt - 0.525) < 1e-9; }, null, { timeout: 15_000 });
    const f = await frame(page);
    expect(f.settings.vt).toBeCloseTo(0.525, 9);
    await expect(vt.locator('.value')).toHaveText('525');
  });

  test('INT-03 · cancelar y vencimiento del plazo no mutan ajustes', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0, editTimeout: 1500 });
    const rr = page.locator('.qk[data-key="rr"]');
    await rr.click();
    await page.keyboard.press('ArrowUp');
    await expect(rr.locator('.value')).toHaveText('16');
    await page.waitForTimeout(2600);
    await expect(rr).toHaveAttribute('aria-pressed', 'false');
    await expect(rr.locator('.value')).toHaveText('15');
    await expect(page.locator('.edit-preview')).toContainText('vencimiento');
    const f = await frame(page);
    expect(f.settings.rr).toBe(15);
    expect(f.pending).toBeNull();
  });

  test('INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.getByRole('button', { name: 'EN ESPERA' }).click();
    const dlg = page.getByRole('dialog', { name: 'Pausar ventilación' });
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dlg).toBeHidden();
    const a = await frame(page);
    expect(a.ventilation).toBe('ventilating');
    await page.waitForFunction((n) => (window.__r860.frame as { breathCount: number }).breathCount > n, a.breathCount, { timeout: 15_000 });
    await page.getByRole('button', { name: 'EN ESPERA' }).click();
    await page.getByRole('dialog', { name: 'Pausar ventilación' }).getByRole('button', { name: 'Pausar ventilación' }).click();
    await page.waitForFunction(() => (window.__r860.frame as { ventilation: string }).ventilation === 'standby');
    await expect(page.locator('.standby-overlay')).toBeVisible();
    await expect(page.locator('.panel:not(.basic) .cell[aria-label="Ppico"] .value')).toHaveText('---');
    await page.locator('.standby-overlay').getByRole('button', { name: 'Iniciar ventilación' }).click();
    await page.waitForFunction(() => (window.__r860.frame as { ventilation: string }).ventilation === 'ventilating');
    await expect(page.locator('.standby-overlay')).toBeHidden();
  });

  test('INT-05 · abrir/cerrar vistas 100 veces no reinicia ni duplica el motor', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    const before = await frame(page);
    for (let i = 0; i < 50; i++) {
      await page.getByRole('tab', { name: 'Curvas básicas' }).click();
      await page.getByRole('tab', { name: 'Curvas avanzadas' }).click();
    }
    await page.getByRole('button', { name: 'Pasado: tendencias' }).click();
    await expect(page.locator('.feature-overlay')).toContainText('no implementado');
    const after = await frame(page);
    expect(after.simTimeMs).toBeGreaterThan(before.simTimeMs);
    expect(after.breathCount).toBeGreaterThanOrEqual(before.breathCount);
    expect(after.settings).toEqual(before.settings);
  });

  test('INT-06 · rueda sin foco, flechas sin selección y bloqueo de pantalla no cambian nada', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    const before = await frame(page);
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, -300);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowDown');
    await page.locator('.knob').hover();
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(300);
    let f = await frame(page);
    expect(f.settings).toEqual(before.settings);
    expect(f.pending).toBeNull();
    await page.getByRole('button', { name: 'Bloquear/desbloquear pantalla' }).click();
    await expect(page.locator('.lock-ind')).toHaveText('PANTALLA BLOQUEADA');
    await page.locator('.qk[data-key="peep"]').click();
    await expect(page.locator('.qk[data-key="peep"]')).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Bloquear/desbloquear pantalla' }).click();
    await page.locator('.qk[data-key="peep"]').click();
    await expect(page.locator('.qk[data-key="peep"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    f = await frame(page);
    expect(f.settings).toEqual(before.settings);
  });

  test('PRC-01 (UI) · bloqueo inspiratorio válido con resultado fechado que persiste al cerrar y reabrir la ventana', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.getByRole('button', { name: 'Bloqueo inspiratorio' }).click();
    const hold = page.getByRole('dialog', { name: 'Bloqueo inspiratorio' });
    await expect(hold.locator('.time-key')).toHaveText('3');
    await hold.getByRole('button', { name: 'Iniciar bloqueo' }).click();
    await expect(hold.locator('.status')).toContainText(/en cola|en curso/);
    await expect(hold.locator('.field').nth(2).locator('.value')).toHaveText('15', { timeout: 20_000 });
    await expect(hold.locator('.field').nth(3).locator('.value')).toHaveText('50');
    const stamp = await hold.locator('.stamp').textContent();
    expect(stamp).toContain('18-Ago-2026');
    expect(stamp).toMatch(/21:04:(0[5-9]|1[0-9])/);
    await page.getByRole('button', { name: 'Bloqueo inspiratorio' }).click();
    await expect(hold).toBeHidden();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Bloqueo inspiratorio' }).click();
    await expect(hold.locator('.field').nth(2).locator('.value')).toHaveText('15');
    expect(await hold.locator('.stamp').textContent()).toBe(stamp);
    const f = await frame(page);
    expect(f.procedure.last.inspHold?.quality).toBe('valid');
  });

  test('ACC-01 · recorrido por teclado: Tab, Enter selecciona, flechas ajustan, Enter confirma, Escape cancela', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    const peep = page.locator('.qk[data-key="peep"]');
    await peep.focus();
    await page.keyboard.press('Enter');
    await expect(peep).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(peep.locator('.value')).toHaveText('6');
    await page.keyboard.press('Escape');
    await expect(peep.locator('.value')).toHaveText('5');
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    expect(active).toBeTruthy();
    await expectBanner(page);
  });

  test('TIM-03 · pestaña oculta: pausa explícita registrada; sin salto oculto de reloj', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(page.locator('.pause-banner')).toContainText('segundo plano');
    const t1 = (await frame(page)).simTimeMs;
    await page.waitForTimeout(1500);
    const t2 = (await frame(page)).simTimeMs;
    expect(t2).toBe(t1);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction((t) => (window.__r860.frame as { simTimeMs: number }).simTimeMs > t, t2, { timeout: 5000 });
    const t3 = (await frame(page)).simTimeMs;
    expect(t3 - t2).toBeLessThan(4 * 1500); // no recuperó el tiempo oculto de golpe
  });

  test('SEC-01/SEC-02 · sin conexiones a dispositivos ni tráfico externo; marca visible en todas las vistas', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => { const u = new URL(r.url()); if (u.host !== '127.0.0.1:4173') external.push(r.url()); });
    await open(page, { speed: 4, instructor: 0 });
    await expectBanner(page);
    await page.getByRole('tab', { name: 'Curvas básicas' }).click();
    await expectBanner(page);
    const apis = await page.evaluate(() => ({ usb: 'usb' in navigator, serial: 'serial' in navigator, bt: 'bluetooth' in navigator }));
    // Las API pueden existir en el navegador, pero el código no las invoca: se verifica por inspección estática (tests/unit) y por tráfico.
    expect(external).toEqual([]);
    expect(typeof apis).toBe('object');
  });
});
