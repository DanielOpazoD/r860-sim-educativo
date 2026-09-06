import { expect, test } from '@playwright/test';
import { expectBanner, frame, open, screenshot } from './helpers';

test.describe('VIS/DAT · fixtures fotográficas (transcripción, no motor)', () => {
  test('VIS-01 + DAT-02 · P1: composición avanzada; Pplat de panel 35 y de bloqueo 32 no se fusionan', async ({ page }, info) => {
    await open(page, { fixture: 'P1', instructor: 0 });
    await expectBanner(page);
    await expect(page.locator('.alarm-band')).toContainText('Sin alarmas');
    await expect(page.locator('.qk.mode .value')).toHaveText('A/C VC');
    await expect(page.locator('.qk[data-key="vt"] .value')).toHaveText('285');
    await expect(page.locator('.qk[data-key="rr"] .value')).toHaveText('32');
    await expect(page.locator('.qk[data-key="ie"] .value')).toHaveText('1:1.5');
    await expect(page.locator('.qk[data-key="peep"] .value')).toHaveText('18');
    await expect(page.locator('.qk[data-key="pmax"] .value')).toHaveText('50');
    const pplatPanel = page.locator('.panel:not(.basic) .cell[aria-label="Pplat"] .value');
    await expect(pplatPanel).toHaveText('35');
    await page.getByRole('button', { name: 'Bloqueo inspiratorio' }).click();
    const hold = page.getByRole('dialog', { name: 'Bloqueo inspiratorio' });
    await expect(hold).toBeVisible();
    await expect(hold.locator('.field').nth(2).locator('.value')).toHaveText('32');
    await expect(hold.locator('.field').nth(3).locator('.value')).toHaveText('19');
    await expect(hold.locator('.stamp')).toContainText('18-Ago-2026');
    await expect(hold.locator('.stamp')).toContainText('21:04:05');
    await expect(hold.locator('.time-key')).toHaveText('3');
    await expect(page.locator('.navbar .clock')).toHaveText('21:04');
    await expect(page.locator('.pause-banner')).toContainText('FIXTURE VISUAL P1');
    await screenshot(page, info, 'vis-01-p1-advanced', { fixture: 'P1' });
  });

  test('VIS-02 + DAT-01 · P3: curvas básicas con seis valores grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295', async ({ page }, info) => {
    await open(page, { fixture: 'P3', instructor: 0 });
    await expect(page.locator('.work')).toHaveClass(/basic/);
    const big = page.locator('.panel.basic .cell.big');
    await expect(big).toHaveCount(6);
    await expect(page.locator('.panel.basic .cell[aria-label="FiO2"] .value')).toHaveText('97');
    await expect(page.locator('.qk[data-key="fio2"] .value')).toHaveText('100');
    await expect(page.locator('.panel.basic .cell[aria-label="Volumen tidal"] .value')).toHaveText('295');
    await expect(page.locator('.qk[data-key="vt"] .value')).toHaveText('285');
    await expect(page.locator('.panel.basic .cell[aria-label="PEEPe"] .limits')).toContainText('Off');
    await expect(page.locator('.panel.basic .cell[aria-label="Presión pico"] .value')).toHaveText('33');
    await expect(page.locator('.panel.basic .cell[aria-label="Volumen minuto"] .value')).toHaveText('8.9');
    await expect(page.locator('.panel.basic .cell[aria-label="Frecuencia resp."] .value')).toHaveText('30');
    await page.getByRole('button', { name: 'Bloqueo inspiratorio' }).click();
    const hold = page.getByRole('dialog', { name: 'Bloqueo inspiratorio' });
    await expect(hold.locator('.field').nth(2).locator('.value')).toHaveText('28');
    await expect(hold.locator('.field').nth(3).locator('.value')).toHaveText('25');
    await expect(hold.locator('.stamp')).toContainText('19-Ago-2026');
    await expect(hold.locator('.stamp')).toContainText('09:31:10');
    await screenshot(page, info, 'vis-02-p3-basic', { fixture: 'P3' });
  });
});

test.describe('VIS · motor vivo con pausa automática determinista', () => {
  test('VIS-03 · banco SC-01 a t = 12 s: curvas, números y barra de presión', async ({ page }, info) => {
    await open(page, { autopause: 12000, instructor: 0, speed: 4 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 12000, null, { timeout: 20_000 });
    const f = await frame(page);
    expect(f.simTimeMs).toBe(12000);
    expect(f.breathCount).toBe(3);
    await expect(page.locator('.panel:not(.basic) .cell[aria-label="Ppico"] .value')).toHaveText('20');
    await expect(page.locator('.panel:not(.basic) .cell[aria-label="PEEPe"] .value')).toHaveText('5');
    await expect(page.locator('.panel:not(.basic) .cell[aria-label="VTesp"] .value')).toHaveText('500');
    await expect(page.locator('.panel:not(.basic) .cell[aria-label="FR"] .value')).toHaveText('15');
    await expect(page.locator('.panel:not(.basic) .cell[aria-label="Pplat"] .value')).toHaveText('---'); // sin pausa: null, no 0
    await expect(page.locator('.panel:not(.basic) .cell[aria-label="VTesp espont"] .value')).toHaveText('---');
    await expect(page.locator('.panel:not(.basic) .cell[aria-label="FR espont"] .value')).toHaveText('0');
    await expect(page.locator('.navbar .clock')).toHaveText('21:04');
    await page.waitForTimeout(300);
    await screenshot(page, info, 'vis-03-live-sc01-t12s', { scenario: 'banco por defecto (SC-01)' });
  });

  test('VIS-04 · alarma larga y tres dígitos: SC-09 (oclusión de ensayo) con Pmáx alcanzada', async ({ page }, info) => {
    await open(page, { scenario: 'SC-09', autopause: 20000, instructor: 0, speed: 4 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 20000, null, { timeout: 25_000 });
    const f = await frame(page);
    expect(f.alarmBar.color).toBe('red');
    await expect(page.locator('.alarm-band')).toHaveClass(/red/);
    await expect(page.locator('.alarm-band')).toContainText('Pmáx alcanzada');
    // Las columnas no se desplazan: la celda de Ppico conserva su anchura mínima reservada.
    const w = await page.locator('.panel:not(.basic) .cell[aria-label="Ppico"] .value').evaluate((el) => (el as HTMLElement).offsetWidth); // anchura de layout, independiente del escalado CSS
    expect(w).toBeGreaterThan(40);
    await screenshot(page, info, 'vis-04-alarm-sc09-t20s', { scenario: 'SC-09' });
  });
});
