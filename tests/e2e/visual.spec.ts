import { expect, test } from '@playwright/test';
import { expectSafetyMark, frame, open, screenshot, showPanel } from './helpers';

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

test('VIS · el exterior usa tema claro y conserva el fondo del equipo', async ({ page }) => {
  await open(page, { scenario: 'SC-02', instructor: 0 });
  await showPanel(page, 'patient');

  const styles = await page.evaluate(() => {
    const luminance = (value: string) => {
      const rgb = value.match(/rgba?\(([^)]+)\)/)?.[1];
      const srgb = value.match(/color\(srgb\s+([^)]+)\)/)?.[1];
      const raw = rgb ?? srgb;
      if (!raw) return Number.NaN;
      const channels = raw
        .split(/[,\s/]+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((channel) => Number(channel) / (rgb ? 255 : 1));
      if (channels.length !== 3) return Number.NaN;
      const [r = Number.NaN, g = Number.NaN, b = Number.NaN] = channels.map((channel) =>
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
      );
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const background = (selector: string) => getComputedStyle(document.querySelector(selector)!).backgroundColor;
    const device = getComputedStyle(document.querySelector('.device-shell')!);
    return {
      body: luminance(getComputedStyle(document.body).backgroundColor),
      header: luminance(background('.app-top')),
      instructor: luminance(background('#instructor')),
      deviceBackground: device.backgroundColor,
      deviceImage: device.backgroundImage,
    };
  });

  expect(styles.body).toBeGreaterThan(0.85);
  expect(styles.header).toBeGreaterThan(0.85);
  expect(styles.instructor).toBeGreaterThan(0.85);
  expect(styles.deviceBackground).toBe('rgba(0, 0, 0, 0)');
  expect(styles.deviceImage).toBe(
    (page.viewportSize()?.width ?? 1440) <= 700
      ? 'linear-gradient(150deg, rgb(119, 129, 136) 0px, rgb(86, 95, 102) 17%, rgb(60, 68, 76) 49%, rgb(66, 74, 83) 82%, rgb(116, 127, 133) 100%)'
      : 'linear-gradient(160deg, rgb(58, 64, 71), rgb(35, 40, 45))',
  );
});

test('VIS · panel Paciente compacto a 1440 px: gases, perfiles, mecánica y eventos sin desplazarse', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'sólo escritorio a 1440 px');
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, { scenario: 'SC-02', instructor: 0 });
  await showPanel(page, 'patient');

  const pane = page.locator('#instructor-patient');
  const profiles = page.locator('#patient-profiles .profile-chip');
  await expect(pane).toBeVisible();
  await expect(page.locator('#flyout-advanced')).toBeHidden();
  await expect(profiles).toHaveCount(5);
  await expect(page.locator('#patient-controls [data-phys-number]')).toHaveCount(4);
  await expect(page.locator('#patient-controls [data-phys-step]')).toHaveCount(8);
  for (const profile of await profiles.all()) await expect(profile).toBeInViewport();
  await expect(page.locator('#case-gas .gas-card')).toBeInViewport();

  const geometry = await pane.evaluate((el) => {
    const { height } = el.getBoundingClientRect();
    return { height, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(geometry.height).toBeLessThanOrEqual(620);
  // El panel entero, con la gasometría arriba, cabe en la ventana sin desplazarse por dentro.
  expect(await page.locator('#instructor').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test.describe('VIS · casillas del monitor sin desbordamiento', () => {
  test('no usa iconos informativos y sus descendientes caben', async ({ page }) => {
    await open(page, { scenario: 'SC-02', instructor: 0 });
    await expect(page.locator('#monitor .numeric-info')).toHaveCount(0);
    const overflows = await page
      .locator('#monitor .numeric')
      .evaluateAll((tiles) =>
        tiles.flatMap((tile) =>
          [...tile.querySelectorAll('*')]
            .filter((el) => el.scrollWidth > el.clientWidth + 1)
            .map((el) => ({ metric: tile.getAttribute('data-metric'), element: el.className })),
        ),
      );
    expect(overflows).toEqual([]);
  });
});

test.describe('VIS · motor vivo con pausa automática determinista', () => {
  test('VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro', async ({ page }, info) => {
    await open(page, { autopause: 12000, instructor: 0, speed: 4 });
    await page.waitForFunction(() => (window.__ventila.frame as { simTimeMs: number }).simTimeMs >= 12000, null, { timeout: 20_000 });
    const f = await frame(page);
    expect(f.simTimeMs).toBe(12000);
    expect(f.breathCount).toBe(3);
    await expect(page.locator('#numeric-grid [data-metric="ppeak"] .numeric-value')).toHaveText('20');
    await expect(page.locator('#numeric-grid [data-metric="peepe"] .numeric-value')).toHaveText('5');
    // El VTe mostrado es la lectura del sensor de flujo: varía ±2,5 % ciclo a ciclo alrededor del VT programado (SEN-01).
    const vteMostrado = Number(await page.locator('#numeric-grid [data-metric="vte"] .numeric-value').textContent());
    expect(Math.abs(vteMostrado - 500)).toBeLessThanOrEqual(15);
    await expect(page.locator('#numeric-grid [data-metric="rr"] .numeric-value')).toHaveText('15');
    // Sin bloqueo inspiratorio la Pplat no existe: sólo el guion, sin pista dentro de la casilla.
    await expect(page.locator('#numeric-grid [data-metric="pplat"] .numeric-value')).toHaveText('—');
    await expect(page.locator('#numeric-grid [data-metric="pplat"] .numeric-age')).toBeEmpty();
    for (const key of ['cstat', 'driving']) await expect(page.locator(`#numeric-grid [data-metric="${key}"] .numeric-age`)).toBeEmpty();
    await expect(page.locator('#numeric-grid [data-metric="pplat"]')).toHaveAttribute(
      'aria-label',
      'Pplat: requiere un bloqueo inspiratorio. Información y medición',
    );
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
    await page.waitForFunction(() => (window.__ventila.frame as { simTimeMs: number }).simTimeMs >= 20000, null, { timeout: 25_000 });
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
    await page.waitForFunction(() => (window.__ventila.frame as { simTimeMs: number }).simTimeMs >= 16000, null, { timeout: 20_000 });
    await page.click('[data-view="loops"]');
    await page.click('[data-action="loopReference"]');
    await expect(page.locator('#loop-reference-label')).toContainText('Referencia');
    await screenshot(page, info, 'vis-05-loops');
    await page.click('[data-view="data"]');
    // Las veinte mediciones se ven a la vez, en dos columnas: con una sola tabla nueve quedaban bajo el pliegue
    // sin ninguna señal, entre ellas la Cstat, la ΔP y el índice de estrés.
    await expect(page.locator('#data-table-body tr[data-row], #data-table-body-2 tr[data-row]')).toHaveCount(20);
    const caben = await page.evaluate(() => {
      const c = document.querySelector('.data-tables') as HTMLElement;
      return c.scrollHeight <= c.clientHeight;
    });
    // En móvil las dos columnas se apilan y el desplazamiento es inevitable y correcto; ahí no se exige.
    if ((page.viewportSize()?.width ?? 0) >= 900) expect(caben, 'la tabla de mediciones no puede esconder filas').toBe(true);
    await expect(page.locator('.data-tables')).toContainText('Índice de estrés');
    const estadoPico = page.locator('tr[data-row="ppeak"] .metric-status');
    await expect(estadoPico).toContainText('Válido');
    await expect(estadoPico).toContainText('Sensor');
    await expect(estadoPico).toHaveAttribute('title', /sensor del ventilador/);
    await page.click('[data-view="trends"]');
    await page.waitForTimeout(200);
    await page.click('[data-view="log"]');
    await expect(page.locator('#device-event-log .event-log-row').first()).toBeVisible();
  });
  test('DAT-08 · grupos y estado Pplat cambian al completar un bloqueo válido', async ({ page }) => {
    await open(page, { scenario: 'SC-02', instructor: 0, speed: 4 });
    await page.click('[data-view="data"]');
    await expect(page.locator('.group-row').filter({ hasText: 'Mecánica por bloqueo' })).toBeVisible();
    const pplat = page.locator('tr[data-row="pplat"]');
    await expect(pplat.locator('td').nth(1)).toHaveText('—');
    await expect(pplat.locator('.q-chip')).toHaveText('Requiere bloqueo');
    await page.click('[data-action="inspiratory"]');
    await page.click('#hold-run');
    const holdValue = (page.viewportSize()?.width ?? 0) <= 700 ? /^\d+$/ : '15';
    await expect(page.locator('#hold-value')).toHaveText(holdValue, { timeout: 20_000 });
    if ((page.viewportSize()?.width ?? 0) <= 700) {
      await page.click('#hold-panel [data-action="closeHold"]');
      await expect(page.locator('#hold-panel')).toBeHidden();
    }
    await page.click('[data-view="data"]');
    await expect(pplat.locator('.q-chip')).toHaveText(/^Bloqueo · hace \d{2}:\d{2}$/, { timeout: 20_000 });
  });
  test('VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3', async ({
    page,
  }, info) => {
    await open(page, { scenario: 'SC-13', autopause: 16000, instructor: 0, speed: 4 });
    await page.waitForFunction(() => (window.__ventila.frame as { simTimeMs: number }).simTimeMs >= 16000, null, { timeout: 20_000 });
    await expect(page.locator('#quick-mode')).toHaveText('A/C PC');
    await screenshot(page, info, 'vis-06-pc-sc13-t16s', { mode: 'AC_PC' });
    await page.click('[data-view="basic"]');
    await expect(page.locator('#big-metrics .big-numeric')).toHaveCount(6);
    await screenshot(page, info, 'vis-07-basic-p3-layout', { view: 'basic' });
  });
  test('VIS-08 · CPAP/PS (SC-19): presión a PEEP + PS, flujo cortado al 25 % del pico, volumen del paciente', async ({ page }, info) => {
    await open(page, { scenario: 'SC-19', autopause: 16000, instructor: 0, speed: 4 });
    await page.waitForFunction(() => (window.__ventila.frame as { simTimeMs: number }).simTimeMs >= 16000, null, { timeout: 20_000 });
    await expect(page.locator('#quick-mode')).toHaveText('CPAP/PS');
    const f = await frame(page);
    expect(f.metrics.ppeak?.value ?? 0).toBeCloseTo(15, 0);
    expect(f.metrics.rrSpont?.value ?? 0).toBeGreaterThan(10);
    await screenshot(page, info, 'vis-08-ps-sc19-t16s', { mode: 'CPAP_PS' });
  });
});
