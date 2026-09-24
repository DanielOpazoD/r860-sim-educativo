import { expect, test } from '@playwright/test';
import { expectSafetyMark, frame, open, screenshot } from './helpers';

test.describe('VIS/DAT · fixtures fotográficas (transcripción, no motor)', () => {
  test('VIS-01 + DAT-02 · P1: panel denso y bloqueo; Pplat de bloqueo 32 y Cstat 19 fechados', async ({ page }, info) => {
    await open(page, { fixture: 'P1', instructor: 0 });
    await expectSafetyMark(page);
    await expect(page.locator('#alarm-label')).toHaveText('Sin alarmas');
    await expect(page.locator('#quick-mode')).toHaveText('A/C VC');
    await expect(page.locator('[data-quick-val="vt"]')).toHaveText('285');
    await expect(page.locator('[data-quick-val="rr"]')).toHaveText('32');
    await expect(page.locator('[data-quick-val="ie"]')).toHaveText('1:1.5');
    await expect(page.locator('[data-quick-val="peep"]')).toHaveText('18');
    await expect(page.locator('[data-quick-val="pmax"]')).toHaveText('50');
    await expect(page.locator('#numeric-grid [data-metric="ppeak"] .numeric-value')).toHaveText('38');
    await expect(page.locator('#numeric-grid [data-metric="pplat"] .numeric-value')).toHaveText('32');
    await expect(page.locator('#hold-value')).toHaveText('32');
    await expect(page.locator('#hold-second')).toHaveText('19');
    await expect(page.locator('#hold-status')).toContainText('18-Ago-2026 21:04:05');
    await expect(page.locator('#scenario-name')).toContainText('P1');
    await screenshot(page, info, 'vis-01-p1-fixture', { fixture: 'P1' });
  });
  test('VIS-02 + DAT-01 · P3: datos grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295', async ({ page }, info) => {
    await open(page, { fixture: 'P3', instructor: 0 });
    await expect(page.locator('#view-basic')).toHaveClass(/active/);
    await expect(page.locator('#big-metrics [data-metric="fio2"] b')).toHaveText('97');
    await expect(page.locator('[data-quick-val="fio2"]')).toHaveText('100');
    await expect(page.locator('#big-metrics [data-metric="vte"] b')).toHaveText('295');
    await expect(page.locator('[data-quick-val="vt"]')).toHaveText('285');
    await expect(page.locator('#big-metrics [data-metric="ppeak"] b')).toHaveText('33');
    await expect(page.locator('#big-metrics [data-metric="mve"] b')).toHaveText('8.9');
    await expect(page.locator('#big-metrics [data-metric="rr"] b')).toHaveText('30');
    await screenshot(page, info, 'vis-02-p3-fixture', { fixture: 'P3' });
  });
});

test.describe('VIS · motor vivo con pausa automática determinista', () => {
  test('VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro', async ({ page }, info) => {
    await open(page, { autopause: 12000, instructor: 0, speed: 4 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 12000, null, { timeout: 20_000 });
    const f = await frame(page);
    expect(f.simTimeMs).toBe(12000);
    expect(f.breathCount).toBe(3);
    await expect(page.locator('#numeric-grid [data-metric="ppeak"] .numeric-value')).toHaveText('20');
    await expect(page.locator('#numeric-grid [data-metric="peepe"] .numeric-value')).toHaveText('5');
    // El VTe mostrado es la lectura del sensor de flujo: varía ±2,5 % ciclo a ciclo alrededor del VT programado (SEN-01).
    const vteMostrado = Number(await page.locator('#numeric-grid [data-metric="vte"] .numeric-value').textContent());
    expect(Math.abs(vteMostrado - 500)).toBeLessThanOrEqual(15);
    await expect(page.locator('#numeric-grid [data-metric="rr"] .numeric-value')).toHaveText('15');
    // Sin bloqueo inspiratorio la Pplat no existe: la casilla nombra el motivo en el sitio de la cifra.
    await expect(page.locator('#numeric-grid [data-metric="pplat"] .numeric-value')).toHaveText('sin bloqueo');
    await expect(page.locator('#phase-status')).toContainText('PAUSADA');
    const drawn = await page.evaluate(() => {
      const c = document.getElementById('waves-canvas') as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 40) if (d[i]! > 0) n++;
      return n;
    });
    expect(drawn).toBeGreaterThan(100);
    await page.waitForTimeout(300);
    await screenshot(page, info, 'vis-03-live-sc01-t12s', { scenario: 'SC-01' });
  });
  test('VIS-04 · alarma de Pmáx (SC-09): banda roja, luz del bisel y celda resaltada', async ({ page }, info) => {
    await open(page, { scenario: 'SC-09', autopause: 20000, instructor: 0, speed: 4 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 20000, null, { timeout: 25_000 });
    const f = await frame(page);
    expect(f.alarmBar.color).toBe('red');
    await expect(page.locator('#alarm-band')).toHaveClass(/high/);
    // La prioridad va en palabras, no sólo en el color.
    await expect(page.locator('#alarm-label')).toHaveText(/^Prioridad alta · Pmáx alcanzada/);
    await expect(page.locator('#bezel-light')).toHaveClass(/high/);
    await expect(page.locator('#numeric-grid [data-metric="ppeak"]')).toHaveClass(/alarm-value/);
    await screenshot(page, info, 'vis-04-alarm-sc09-t20s', { scenario: 'SC-09' });
    // Luz roja intermitente (D), salvo que el sistema pida reducir movimiento.
    const animacion = (): Promise<string> => page.evaluate(() => getComputedStyle(document.querySelector('#bezel-light')!).animationName);
    expect(await animacion()).toBe('bezel-blink');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await animacion()).toBe('none');
    await page.emulateMedia({ reducedMotion: null });
  });
  test('VIS-05 · vistas de bucles, tabla, tendencias y registro son funcionales', async ({ page }, info) => {
    await open(page, { autopause: 16000, instructor: 0, speed: 4 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 16000, null, { timeout: 20_000 });
    await page.click('[data-view="loops"]');
    await page.click('[data-action="loopReference"]');
    await expect(page.locator('#loop-reference-label')).toContainText('Referencia');
    await screenshot(page, info, 'vis-05-loops');
    await page.click('[data-view="data"]');
    // Las veinte mediciones se ven a la vez, en dos columnas: con una sola tabla nueve quedaban bajo el pliegue
    // sin ninguna señal, entre ellas la Cstat, la ΔP y el índice de estrés.
    await expect(page.locator('#data-table-body tr, #data-table-body-2 tr')).toHaveCount(20);
    const caben = await page.evaluate(() => {
      const c = document.querySelector('.data-tables') as HTMLElement;
      return c.scrollHeight <= c.clientHeight;
    });
    // En móvil las dos columnas se apilan y el desplazamiento es inevitable y correcto; ahí no se exige.
    if ((page.viewportSize()?.width ?? 0) >= 900) expect(caben, 'la tabla de mediciones no puede esconder filas').toBe(true);
    await expect(page.locator('.data-tables')).toContainText('Índice de estrés');
    await expect(page.locator('#data-table-body')).toContainText('sensor del ventilador');
    await page.click('[data-view="trends"]');
    await page.waitForTimeout(200);
    await page.click('[data-view="log"]');
    await expect(page.locator('#device-event-log .event-log-row').first()).toBeVisible();
  });
  test('VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3', async ({
    page,
  }, info) => {
    await open(page, { scenario: 'SC-13', autopause: 16000, instructor: 0, speed: 4 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 16000, null, { timeout: 20_000 });
    await expect(page.locator('#quick-mode')).toHaveText('A/C PC');
    await screenshot(page, info, 'vis-06-pc-sc13-t16s', { mode: 'AC_PC' });
    await page.click('[data-view="basic"]');
    await expect(page.locator('#big-metrics .big-numeric')).toHaveCount(6);
    await screenshot(page, info, 'vis-07-basic-p3-layout', { view: 'basic' });
  });
  test('VIS-08 · CPAP/PS (SC-19): presión a PEEP + PS, flujo cortado al 25 % del pico, volumen del paciente', async ({ page }, info) => {
    await open(page, { scenario: 'SC-19', autopause: 16000, instructor: 0, speed: 4 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 16000, null, { timeout: 20_000 });
    await expect(page.locator('#quick-mode')).toHaveText('CPAP/PS');
    const f = await frame(page);
    expect(f.metrics.ppeak?.value ?? 0).toBeCloseTo(15, 0);
    expect(f.metrics.rrSpont?.value ?? 0).toBeGreaterThan(10);
    await screenshot(page, info, 'vis-08-ps-sc19-t16s', { mode: 'CPAP_PS' });
  });
});
