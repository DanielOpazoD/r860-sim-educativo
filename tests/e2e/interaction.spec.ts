import { expect, test, type Page } from '@playwright/test';
import { PATIENT_PROFILES, profileState } from '../../src/ui/patientProfiles';
import {
  closePersonalization,
  expectSafetyMark,
  frame,
  hidePanel,
  open,
  openFundamentos,
  openModelData,
  openMoreParams,
  openPersonalization,
  openPresentation,
  backToMonitor,
  openTimeControls,
  showPanel,
  toggleExam,
} from './helpers';

async function chooseRadio(page: Page, groupId: string, value: string) {
  const radio = page.locator(`#${groupId} input[type="radio"][value="${value}"]`);
  await radio.locator('xpath=..').click();
  await expect(radio).toBeChecked();
}

test.describe('NAV · opciones de cabecera y diálogos del equipo', () => {
  test('escritorio agrupa las opciones en ⋯ y Audio alterna aria-checked', async ({ page, isMobile }) => {
    test.skip(isMobile, 'sólo escritorio');
    await open(page, { instructor: 0 });
    await expect(page.locator('.top-actions button:visible')).toHaveCount(3);
    await expect(page.locator('.top-actions > [data-action="session"]')).toHaveCount(0);

    const button = page.locator('#more-button');
    const menu = page.locator('#more-menu');
    await button.click();
    await expect(menu).toBeVisible();
    await expect(menu.locator('[role^="menuitem"]:visible')).toHaveCount(5);
    await expect(menu.locator('[data-action="session"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    const sound = page.locator('#sound-toggle');
    await sound.click();
    await expect(sound).toHaveAttribute('aria-checked', 'true');
    await expect(sound).toContainText('Audio de alarmas');
    await button.click();
    await sound.click();
    await expect(sound).toHaveAttribute('aria-checked', 'false');

    await button.click();
    await menu.locator('[data-action="help"]').click();
    await expect(page.locator('#app-dialog')).toBeVisible();
    await expect(page.locator('#dialog-title')).toHaveText('Guía del simulador');
  });

  test('el Menú del equipo conserva sólo sus cuatro entradas funcionales', async ({ page }) => {
    await open(page, { instructor: 0 });
    await page.locator('#monitor [data-action="menu"]').click();
    const entries = page.locator('#dialog-content .menu-entry');
    await expect(entries).toHaveCount(4);
    for (const action of ['session', 'scenarios', 'help']) {
      await expect(page.locator(`#dialog-content .menu-entry[data-action="${action}"]`)).toHaveCount(0);
    }
  });

  test('Modo explica en texto los modos que no se simulan', async ({ page }) => {
    await open(page, { instructor: 0 });
    await page.locator('#monitor [data-action="menu"]').click();
    await page.locator('#dialog-content .menu-entry[data-action="modes"]').click();
    await expect(page.locator('.mode-option[disabled]')).toHaveCount(0);
    await expect(page.locator('.mode-other-note')).toHaveText('Otros modos (PRVC, SIMV, BiLevel, APRV, VNI) no se simulan.');
  });
});

test.describe('INT · selección, edición, confirmación y cancelación', () => {
  test('el contexto del encabezado muestra el caso y abre la lista de casos en el panel, sin diálogo', async ({ page }) => {
    await open(page, { instructor: 0 });
    await expect(page.locator('.app-context #scenario-name')).not.toBeEmpty();
    await expect(page.locator('#workspace')).toHaveClass(/teacher-hidden/);
    await page.click('.app-context');
    await expect(page.locator('#app-dialog')).toBeHidden();
    await expect(page.locator('#workspace')).not.toHaveClass(/teacher-hidden/);
    await expect(page.locator('[data-instructor="case"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#instructor-case [data-case-id]')).toHaveCount(8);
  });
  test('el diálogo de personalización cierra con Escape y devuelve el foco', async ({ page }) => {
    await open(page);
    const button = page.locator('#wave-options-button');
    await openPresentation(page);
    await chooseRadio(page, 'wave-window', '24');
    await expect(button).toContainText('Personalizar vista');
    await closePersonalization(page);
    await expect(button).toBeFocused();
  });
  test('la versión vive en el panel docente y ya no existe el listón de seguridad', async ({ page }) => {
    await open(page);
    await expect(page.locator('.safety-strip')).toHaveCount(0);
    await expect(page.locator('#version-tag').locator('xpath=..')).toHaveClass(/instructor-about/);
  });
  test('INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor', async ({ page }) => {
    await open(page, { autopause: 4000, speed: 4, instructor: 0 });
    await page.waitForFunction(() => (window.__ventila.frame as { simTimeMs: number }).simTimeMs >= 4000);
    const before = await frame(page);
    await page.click('[data-setting-quick="peep"]');
    await expect(page.locator('#quick-editor')).toBeVisible();
    await expect(page.locator('[data-setting-quick="peep"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    // El borrador vive en el editor; la cara del equipo sigue mostrando lo que el ventilador ENTREGA.
    await expect(page.locator('#quick-value')).toHaveValue('7');
    await expect(page.locator('[data-quick-val="peep"]')).toHaveText('5');
    await expect(page.locator('[data-quick-next="peep"]')).toBeHidden();
    const after = await frame(page);
    expect(after.settings.peep).toBe(before.settings.peep);
    expect(after.pending).toBeNull();
    await page.keyboard.press('Escape');
    await expect(page.locator('#quick-editor')).toBeHidden();
    await expect(page.locator('[data-quick-val="peep"]')).toHaveText('5');
  });
  test('INT-02 · confirmar edición válida: se aplica en la siguiente respiración', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.click('[data-setting-quick="vt"]');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#quick-value')).toHaveValue('525');
    await page.keyboard.press('Enter');
    await expect(page.locator('#quick-editor')).toBeHidden();
    await page.waitForFunction(
      () => {
        const f = window.__ventila.frame as { settings: { vt: number } } | null;
        return !!f && Math.abs(f.settings.vt - 0.525) < 1e-9;
      },
      null,
      { timeout: 15_000 },
    );
    await expect(page.locator('[data-quick-val="vt"]')).toHaveText('525');
  });
  test('INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.click('[data-setting-quick="vt"]');
    await page.fill('#quick-value', '287');
    await expect(page.locator('#quick-validation')).toContainText('no es un valor admitido');
    await expect(page.locator('[data-action="confirmEdit"]')).toBeDisabled();
    await page.fill('#quick-value', '300');
    await expect(page.locator('[data-action="confirmEdit"]')).toBeEnabled();
    await page.keyboard.press('Escape');
    expect((await frame(page)).settings.vt).toBe(0.5);
  });
  test('INT-03 · cancelar y vencimiento del plazo no mutan ajustes', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0, editTimeout: 1500 });
    await page.click('[data-setting-quick="rr"]');
    await page.keyboard.press('ArrowUp');
    // El lector de pantalla oye el plazo UNA vez; la cuenta visible cambia cada segundo sin región viva. Se comprueba
    // lo primero: con un plazo de 1,5 s, cualquier espera anterior bajo carga se lo come.
    await expect(page.locator('#quick-announce')).toContainText('para confirmar o cancelar');
    await expect(page.locator('#quick-countdown')).not.toHaveAttribute('aria-live', /.+/);
    await expect(page.locator('#quick-value')).toHaveValue('16');
    await expect(page.locator('[data-quick-val="rr"]')).toHaveText('15'); // el borrador no se pinta en la tecla
    await page.waitForTimeout(2600);
    await expect(page.locator('#quick-editor')).toBeHidden();
    await expect(page.locator('[data-quick-val="rr"]')).toHaveText('15');
    await expect(page.locator('.toast').last()).toContainText('inactividad');
    const f = await frame(page);
    expect(f.settings.rr).toBe(15);
    expect(f.pending).toBeNull();
  });
  test('INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.click('[data-action="standby"]');
    await expect(page.locator('#app-dialog')).toBeVisible();
    await page.click('#app-dialog [data-action="closeDialog"]');
    const a = await frame(page);
    expect(a.ventilation).toBe('ventilating');
    await page.waitForFunction((n) => (window.__ventila.frame as { breathCount: number }).breathCount > n, a.breathCount, {
      timeout: 15_000,
    });
    await page.click('[data-action="standby"]');
    await page.click('[data-action="confirmStandby"]');
    await page.waitForFunction(() => (window.__ventila.frame as { ventilation: string }).ventilation === 'standby');
    await expect(page.locator('#standby-overlay')).toBeVisible();
    await expect(page.locator('#numeric-grid [data-metric="ppeak"] .numeric-value')).toHaveText('—');
    await page.click('#standby-overlay [data-action="startVentilation"]');
    await page.waitForFunction(() => (window.__ventila.frame as { ventilation: string }).ventilation === 'ventilating');
    await expect(page.locator('#standby-overlay')).toBeHidden();
  });
  test('INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor', async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, { speed: 4, instructor: 0 });
    const before = await frame(page);
    for (let i = 0; i < 50; i++) {
      await page.locator('.monitor-nav [data-view="basic"]').dispatchEvent('click');
      await page.locator('.monitor-nav [data-view="waves"]').dispatchEvent('click');
    }
    await page.waitForTimeout(500);
    const after = await frame(page);
    expect(after.simTimeMs).toBeGreaterThan(before.simTimeMs);
    expect(after.breathCount).toBeGreaterThanOrEqual(before.breathCount);
    expect(after.settings).toEqual(before.settings);
    expect(await page.evaluate(() => window.__ventila.mode)).toBe(await page.evaluate(() => window.__ventila.mode));
  });
  test('INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    const before = await frame(page);
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, -300);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowDown');
    await page.locator('#trim-knob').hover();
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(300);
    let f = await frame(page);
    expect(f.settings).toEqual(before.settings);
    expect(f.pending).toBeNull();
    await page.click('#lock-key');
    await expect(page.locator('#lock-overlay')).toBeVisible();
    await page.click('[data-setting-quick="peep"]', { force: true });
    await expect(page.locator('#quick-editor')).toBeHidden();
    await page.click('#lock-overlay [data-action="unlock"]');
    await page.click('[data-setting-quick="peep"]');
    await expect(page.locator('#quick-editor')).toBeVisible();
    await page.keyboard.press('Escape');
    f = await frame(page);
    expect(f.settings).toEqual(before.settings);
  });
  test('PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    const pplat = page.locator('#numeric-grid [data-metric="pplat"]');
    await expect(pplat.locator('.numeric-value')).toHaveText('—');
    // Sin pista dentro de la casilla: el guion basta; el motivo queda en su nombre accesible.
    await expect(pplat.locator('.numeric-age')).toBeEmpty();
    await expect(pplat).toHaveAttribute('aria-label', 'Pplat: requiere un bloqueo inspiratorio. Información y medición');
    await page.click('[data-action="inspiratory"]');
    await expect(page.locator('#hold-panel')).toBeVisible();
    await page.click('#hold-run');
    await expect(page.locator('#hold-status')).toContainText(/Esperando|Oclusión|Medido/);
    await expect(page.locator('#hold-value')).toHaveText('15', { timeout: 20_000 });
    await expect(page.locator('#hold-second')).toHaveText('50');
    await expect(pplat.locator('.numeric-value')).not.toHaveText('—');
    await expect(pplat.locator('.numeric-age')).toContainText('Med.');
    await expect(pplat).toHaveAttribute('title', 'Pplat: información y medición');
    await expect(pplat).toHaveAttribute('aria-label', 'Pplat. Información y medición');
    const status = await page.locator('#hold-status').textContent();
    const wallTimeMs = (await frame(page)).procedure.last.inspHold?.wallTimeMs as number;
    const expectedDate = await page.evaluate((ms) => {
      const d = new Date(ms);
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }, wallTimeMs);
    expect(status).toBe(`Medido · ${expectedDate}`);
    await page.click('[data-action="closeHold"]');
    await expect(page.locator('#hold-panel')).toBeHidden();
    await page.waitForTimeout(1500);
    await page.click('[data-action="inspiratory"]');
    await expect(page.locator('#hold-value')).toHaveText('15');
    expect(await page.locator('#hold-status').textContent()).toBe(status);
    await expect(page.locator('#numeric-grid [data-metric="pplat"] .numeric-age')).toContainText('Med.');
    expect((await frame(page)).procedure.last.inspHold?.quality).toBe('valid');
  });
  test('ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.locator('[data-setting-quick="peep"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#quick-editor')).toBeVisible();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#quick-value')).toHaveValue('6');
    await expect(page.locator('[data-quick-val="peep"]')).toHaveText('5');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window.__ventila.frame as unknown as { settings: { peep: number } }).settings.peep === 6, null, {
      timeout: 15_000,
    });
    await page.locator('[data-setting-quick="rr"]').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Escape');
    await expect(page.locator('#quick-editor')).toBeHidden();
    expect((await frame(page)).settings.rr).toBe(15);
    await expectSafetyMark(page);
  });
  test('TIM-03 · pestaña oculta: pausa discreta y reanudación manual sin salto de reloj', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => window.__ventila.running === false);
    await expect(page.locator('#global-notice')).toBeHidden();
    await expect(page.locator('#sim-pause')).toHaveAccessibleName(/Reanudar simulación · segundo plano/);
    const t1 = (await frame(page)).simTimeMs;
    await page.waitForTimeout(1500);
    const t2 = (await frame(page)).simTimeMs;
    expect(t2).toBe(t1);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(800);
    expect((await frame(page)).simTimeMs).toBe(t2); // sigue pausada: reanudación manual
    const reanudadaEn = Date.now();
    await page.click('#sim-pause');
    await page.waitForFunction((t) => (window.__ventila.frame as { simTimeMs: number }).simTimeMs > t, t2, { timeout: 5000 });
    const paredTranscurrida = Date.now() - reanudadaEn;
    expect((await frame(page)).simTimeMs - t2).toBeLessThanOrEqual(4 * (paredTranscurrida + 1000));
  });
  test('ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia', async ({ page }) => {
    await open(page, { scenario: 'SC-09', speed: 4 });
    await page.waitForFunction(() => (window.__ventila.frame as { alarmBar: { color: string } }).alarmBar.color === 'red', null, {
      timeout: 30_000,
    });
    await page.click('[data-action="alarms"]');
    await expect(page.locator('#live-alarms')).toContainText('ACTIVA');
    await page.click('[data-action="acknowledge"]');
    await page.waitForFunction(() =>
      (window.__ventila.frame as { alarms: { id: string; acknowledgedAtMs: number | null }[] }).alarms.some(
        (a) => a.id === 'pmax' && a.acknowledgedAtMs !== null,
      ),
    );
    expect((await frame(page)).alarmBar.color).toBe('red'); // reconocida pero la condición persiste
    await page.keyboard.press('Escape');
    // Resolver la causa desde el panel docente (Rinsp 400 → 10). Con los límites por omisión también saltan VTesp y
    // VMesp bajos. Si se activaron después del reconocimiento, la banda queda gris; bajo mucha carga pueden haber
    // quedado reconocidas en el mismo lote y pasar directamente a verde. La segunda oclusión de abajo fija de forma
    // determinista el contrato «resuelta sin reconocer».
    await showPanel(page, 'patient');
    await page.fill('[data-phys-number="resistance"]', '10');
    await page.locator('[data-phys-number="resistance"]').press('Enter');
    await page.locator('[data-phys-number="resistance"]').dispatchEvent('change');
    await hidePanel(page);
    // VMesp bajo se resuelve con la ventana de ocho respiraciones (32 s simulados): bajo carga, a 4× no bastan 20 s de reloj.
    await page.waitForFunction(() => (window.__ventila.frame as { alarmBar: { color: string } }).alarmBar.color !== 'red', null, {
      timeout: 45_000,
    });
    if ((await frame(page)).alarmBar.color === 'grey') {
      await page.click('[data-action="alarms"]');
      await page.click('[data-action="acknowledge"]');
      await page.keyboard.press('Escape');
    }
    await page.waitForFunction(() => (window.__ventila.frame as { alarmBar: { color: string } }).alarmBar.color === 'green', null, {
      timeout: 20_000,
    });
    // Nueva oclusión sin reconocer y resolución: banda gris (resuelta, pendiente de reconocer) hasta reconocer.
    await showPanel(page, 'patient');
    await page.click('[data-event="obstruction"]');
    await page.waitForFunction(() => (window.__ventila.frame as { alarmBar: { color: string } }).alarmBar.color === 'red', null, {
      timeout: 20_000,
    });
    await page.click('[data-action="undoEvent"]');
    await page.waitForFunction(() => (window.__ventila.frame as { alarmBar: { color: string } }).alarmBar.color === 'grey', null, {
      timeout: 20_000,
    });
    await expect(page.locator('#alarm-label')).toHaveText('Alarmas resueltas');
    await hidePanel(page);
    await page.click('[data-action="alarms"]');
    await expect(page.locator('#live-alarms')).toContainText('PENDIENTE DE RECONOCER');
    await page.click('[data-action="acknowledge"]');
    await page.waitForFunction(() => (window.__ventila.frame as { alarmBar: { color: string } }).alarmBar.color === 'green', null, {
      timeout: 5000,
    });
  });
  test('SC-09 · la oclusión se resuelve con controles visibles: reconocer y Restablecer mecánica', async ({ page }) => {
    await open(page, { scenario: 'SC-09', speed: 4 });
    await page.waitForFunction(() => (window.__ventila.frame as { alarmBar: { color: string } }).alarmBar.color === 'red', null, {
      timeout: 30_000,
    });
    await page.click('[data-action="alarms"]');
    await page.click('[data-action="acknowledge"]');
    await page.keyboard.press('Escape');
    await showPanel(page, 'patient');
    await page.click('[data-action="resetPatient"]');
    await page.waitForFunction(
      () => (window.__ventila.frame as unknown as { truth: { patient: { rInsp: number } } }).truth.patient.rInsp === 10,
    );
    await page.waitForFunction(() => (window.__ventila.frame as { alarmBar: { color: string } }).alarmBar.color !== 'red', null, {
      timeout: 45_000,
    });
    if ((await frame(page)).alarmBar.color === 'grey') {
      await hidePanel(page);
      await page.click('[data-action="alarms"]');
      await page.click('[data-action="acknowledge"]');
      await page.keyboard.press('Escape');
    }
    await page.waitForFunction(() => (window.__ventila.frame as { alarmBar: { color: string } }).alarmBar.color === 'green');
  });
  test('SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.host !== '127.0.0.1:4173') external.push(r.url());
    });
    await open(page, { speed: 4, instructor: 0 });
    for (const v of ['basic', 'loops', 'data', 'trends', 'log', 'waves']) {
      await page.click(`[data-view="${v}"]`);
      await expectSafetyMark(page);
    }
    expect(external).toEqual([]);
  });
});

test.describe('CFG · parámetros de la dirección que no son números', () => {
  test('un `speed` ilegible se descarta con aviso y el motor avanza igual', async ({ page }) => {
    // Antes `?speed=abc` daba NaN: el acumulador del reloj se quedaba en NaN, el motor no ejecutaba ni un paso y la
    // interfaz seguía diciendo «en marcha» con el tiempo simulado clavado en 0.
    await open(page, { speed: 'abc', seed: 'xyz', instructor: 0 });
    await expect(page.locator('#engine-banner')).toBeVisible();
    await expect(page.locator('#engine-banner')).toContainText('speed=abc');
    await expect(page.locator('#engine-banner')).toContainText('seed=xyz');
    await page.waitForFunction(() => (window.__ventila.frame as { simTimeMs: number }).simTimeMs > 0, null, { timeout: 15_000 });
    const f = await frame(page);
    expect(f.simTimeMs).toBeGreaterThan(0);
    expect(f.ventilation).toBe('ventilating');
  });
});

test.describe('CFG · contrato de estado del ajuste', () => {
  test('la tecla muestra lo entregado; la propuesta confirmada se anuncia aparte con su flecha', async ({ page }) => {
    // El borrador se pintaba en la tecla con el mismo tratamiento que un ajuste vigente, incluso siendo inválido:
    // escribir 99 en PEEP hacía que el equipo dijera «PEEP 99». Eso es lo contrario de «seleccionar ≠ aplicar».
    await open(page, { paused: 1, instructor: 0 });
    const valor = page.locator('[data-quick-val="peep"]');
    const propuesta = page.locator('[data-quick-next="peep"]');
    await expect(valor).toHaveText('5');
    await expect(propuesta).toBeHidden();

    await page.click('[data-setting-quick="peep"]');
    await page.fill('#quick-value', '99'); // fuera de rango: no se entrega nunca
    await expect(valor).toHaveText('5');
    await expect(propuesta).toBeHidden();

    await page.fill('#quick-value', '10');
    await expect(valor).toHaveText('5');
    await page.click('[data-action="confirmEdit"]');
    // Confirmado y pendiente: la tecla sigue diciendo lo entregado y añade la propuesta.
    await expect(valor).toHaveText('5');
    await expect(propuesta).toBeVisible();
    await expect(propuesta).toHaveText('→ 10');
    expect((await frame(page)).settings.peep).toBe(5);
  });
});

test.describe('EDU · pestaña Resumen', () => {
  test('cada tarjeta deja como máximo un párrafo visible fuera de «Por qué»', async ({ page }) => {
    await open(page, { scenario: 'SC-02', instructor: 0 });
    await openFundamentos(page);
    const visibleParagraphs = async (): Promise<number[]> =>
      page
        .locator('.edu-card, .edu-bloque')
        .evaluateAll((cards) =>
          cards.map(
            (card) =>
              [...card.querySelectorAll('p')].filter(
                (paragraph) => !paragraph.closest('details') && getComputedStyle(paragraph).display !== 'none',
              ).length,
          ),
        );
    await expect.poll(visibleParagraphs).toEqual([1, 1, 1, 1]);
    await page.click('[data-edu-tab="proteccion"]');
    await expect.poll(visibleParagraphs).toEqual([1, 1, 1]);
    await expect(page.locator('details.edu-more[open]')).toHaveCount(0);
    await page.click('[data-edu-tab="presiones"]');
    const why = page.locator('.edu-card').first().locator('.edu-more');
    await why.locator('summary').click();
    await expect(why.locator('.edu-nota')).toBeVisible();
  });

  test('sin bloqueo no inventa números; con bloqueo enseña la cuenta con los del monitor', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await openFundamentos(page);
    await expect(page.locator('#view-teaching')).toBeVisible();
    // La Ppico se lee siempre; la meseta y sus derivados exigen ocluir, y la pestaña lo dice en vez de rellenar.
    await expect(page.locator('.edu-card').first()).toContainText('Presión pico');
    await expect(page.locator('.edu-falta').first()).toContainText('bloqueo inspiratorio');
    await expect(page.locator('.edu-sub')).toHaveCount(0);

    await backToMonitor(page);
    await page.click('[data-action="inspiratory"]');
    await page.click('[data-action="runHold"]');
    await page.waitForFunction(
      () => (window.__ventila.frame as unknown as { procedure: { last: { inspHold: unknown } } })?.procedure.last.inspHold !== null,
      null,
      { timeout: 40_000 },
    );
    await page.click('[data-action="closeHold"]');
    // El bloqueo lleva el monitor a las curvas, que es lo que se quiere ver durante la maniobra: se vuelve al resumen.
    await openFundamentos(page);
    // Las cuatro tarjetas con su sustitución, y el número de la meseta es el mismo que publicó el bloqueo.
    await expect(page.locator('.edu-card')).toHaveCount(4);
    await expect(page.locator('.edu-formula b')).toHaveCount(4);
    const pplat = await page.evaluate(
      () =>
        (window.__ventila.frame as unknown as { procedure: { last: { inspHold: { values: { pplat: { value: number } } } } } }).procedure
          .last.inspHold.values.pplat.value,
    );
    await expect(page.locator('.edu-card').nth(1)).toContainText(pplat.toFixed(1));
    // Y en escritorio la pestaña cabe sin desplazarse: es un resumen, no un documento. En móvil las cuatro tarjetas se
    // apilan y el desplazamiento es inevitable y correcto, así que ahí no se exige.
    const alturas = await page.evaluate(() => {
      const b = document.querySelector('#teaching-body') as HTMLElement;
      return { cliente: b.clientHeight, contenido: b.scrollHeight };
    });
    if ((page.viewportSize()?.width ?? 0) >= 1000) expect(alturas.contenido).toBeLessThanOrEqual(alturas.cliente);
    else expect(alturas.contenido).toBeGreaterThan(0);
  });

  test('la pantalla de ventilación muestra la gasometría del modelo y el monitor nunca la muestra', async ({ page }) => {
    await open(page, { speed: 8, instructor: 0 });
    await openFundamentos(page);
    // Esperar al primer pintado de Fundamentos: la vista se carga bajo demanda.
    await expect(page.locator('#teaching-body .edu-card').first()).toBeVisible();
    await page.click('[data-edu-tab="ventilacion"]');
    await expect(page.locator('[data-edu-tab="ventilacion"]')).toHaveAttribute('aria-pressed', 'true');
    const bloque = page.locator('[data-testid="gasometria"]');
    // Banco SC-01 (VT 500 mL, 15/min; vía aérea 165 mL y fracción alveolar 0,12): V̇A 4,4 L/min y PaCO₂ ≈ 39 mmHg.
    await expect(bloque.locator('header b')).toHaveText(/^3[89]mmHg PaCO₂$/, { timeout: 15_000 });
    await expect(page.locator('.edu-bloque').nth(1)).toContainText(/− VD 165\) mL × 0[.,]88 × 15\/min/);
    await expect(bloque.locator('.edu-gases')).toContainText('pH');
    await expect(page.locator('.edu-bloque').nth(1)).toContainText('L/min');
    await expect(page.locator('.edu-pie')).toContainText('no del equipo');
    await backToMonitor(page);
    await expect(page.locator('#monitor')).not.toContainText('PaCO');
  });

  test('la pantalla de protección lee el índice de estrés y construye la titulación con lo medido', async ({ page }) => {
    await open(page, { scenario: 'SC-15', speed: 8, instructor: 0 });
    await openFundamentos(page);
    await page.click('[data-edu-tab="proteccion"]');
    // El índice se lee del ciclo actual; la titulación empieza vacía y dice cuántos puntos faltan.
    await expect(page.locator('.edu-siluetas .activa')).toHaveCount(1);
    await expect(page.locator('.edu-falta')).toContainText('0 de los 2 puntos');

    for (const peep of [8, 14]) {
      await backToMonitor(page);
      await page.click('.monitor-nav [data-view="waves"]');
      // Hay que esperar a un bloqueo DISTINTO del anterior: el previo ya era válido y satisfacía la condición al
      // instante, así que la prueba cerraba el panel antes de que el nuevo terminara. De ahí venía su intermitencia.
      const previo = await page.evaluate(
        () =>
          (window.__ventila.frame as unknown as { procedure: { last: { inspHold: { procedureId: string } | null } } })?.procedure.last
            .inspHold?.procedureId ?? '',
      );
      await page.click('[data-setting-quick="peep"]');
      await page.fill('#quick-value', String(peep));
      await page.click('[data-action="confirmEdit"]');
      await page.waitForFunction((p) => (window.__ventila.frame as unknown as { settings: { peep: number } }).settings.peep === p, peep, {
        timeout: 20_000,
      });
      await page.click('[data-action="inspiratory"]');
      await page.click('[data-action="runHold"]');
      // Esperar a que el bloqueo sea VÁLIDO y a esa misma PEEP: sólo entonces existe el punto. Esperar un plazo fijo
      // hacía la prueba dependiente de la máquina, y en el runner llegaba tarde.
      await page.waitForFunction(
        ([p, anterior]) => {
          const fr = window.__ventila.frame as unknown as {
            settings: { peep: number };
            procedure: {
              last: { inspHold: { procedureId: string; quality: string; values: { cstat?: { value: number | null } } } | null };
            };
          };
          const h = fr?.procedure.last.inspHold;
          return (
            fr?.settings.peep === p &&
            !!h &&
            h.procedureId !== anterior &&
            h.quality === 'valid' &&
            typeof h.values.cstat?.value === 'number'
          );
        },
        [peep, previo] as [number, string],
        { timeout: 40_000 },
      );
      await page.click('[data-action="closeHold"]');
      await openFundamentos(page);
    }
    await openFundamentos(page);
    await page.click('[data-edu-tab="proteccion"]');
    // Dos mediciones propias: la curva aparece con sus dos puntos y ninguno inventado.
    await expect(page.locator('.edu-titulacion')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.edu-titulacion circle')).toHaveCount(2);
    // El textContent pega el número y su unidad, como en las tarjetas: «2» + «puntos».
    await expect(page.locator('.edu-bloque').nth(1).locator('header b')).toHaveText('2puntos');
  });
});

test.describe('CUR · medir sobre la curva congelada', () => {
  /** Deja 30 s de curva, pausa y congela. */
  async function congelar(page: Page): Promise<void> {
    await open(page, { speed: 4, instructor: 0, autopause: 30_000 });
    await page.waitForFunction(() => (window.__ventila.frame as unknown as { simTimeMs: number }).simTimeMs >= 30_000, null, {
      timeout: 40_000,
    });
    await openTimeControls(page);
    await page.locator('#freeze-button').click();
    await closePersonalization(page);
    await expect(page.locator('#signal-inspector')).toBeVisible();
  }
  /** Mueve un deslizador como lo haría el usuario: valor nuevo y evento `input`. */
  const mover = (page: Page, id: string, v: number): Promise<void> =>
    page.locator(id).evaluate((el, val) => {
      (el as HTMLInputElement).value = String(val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, v);

  test('el cursor se maneja con el teclado, se anuncia, y sigue midiendo al recorrer la historia', async ({ page }) => {
    await congelar(page);
    const cursor = page.locator('#cursor-slider');
    await cursor.focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
    const etiqueta = page.locator('#inspector-label');
    await expect(etiqueta).toContainText('Paw');
    await expect(etiqueta).toContainText('Ti/Δt');
    await expect(etiqueta).toContainText('τesp');
    const lectura = (await etiqueta.textContent()) ?? '';
    await expect(cursor).toHaveAttribute('aria-valuetext', lectura);
    await expect(page.locator('#cursor-b-slider')).toHaveAttribute('aria-valuetext', lectura);
    await mover(page, '#history-slider', 0);
    await expect(etiqueta).toContainText('Paw');
    await expect(etiqueta).not.toHaveText(lectura);
  });

  test('tocar o pulsar la curva congelada basta para medir', async ({ page }, info) => {
    await congelar(page);
    const lienzo = page.locator('#waves-canvas');
    const caja = (await lienzo.boundingBox())!;
    const donde = { x: caja.width * 0.5, y: caja.height * 0.3 };
    if (info.project.use.hasTouch) await lienzo.tap({ position: donde });
    else await lienzo.click({ position: donde });
    await expect(page.locator('#inspector-label')).toContainText('Paw');
  });

  test('recorrer la historia desplaza la ventana en el tiempo', async ({ page }) => {
    await congelar(page);
    const tiempoA = async (): Promise<number> => {
      const texto = (await page.locator('#inspector-label').textContent()) ?? '';
      const m = /A · t ([\d.,]+) s/.exec(texto);
      expect(m, texto).not.toBeNull();
      return Number((m as RegExpExecArray)[1]!.replace(',', '.'));
    };
    await mover(page, '#history-slider', 0);
    const temprano = await tiempoA();
    await mover(page, '#history-slider', 1000);
    const tarde = await tiempoA();
    expect(tarde - temprano).toBeGreaterThanOrEqual(10);
  });

  test('el cursor cae donde apunta el puntero: el centro de la rejilla es el centro de la ventana', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0, autopause: 30_000 });
    await page.waitForFunction(() => (window.__ventila.frame as unknown as { simTimeMs: number }).simTimeMs >= 30_000, null, {
      timeout: 40_000,
    });
    // En continuo el centro del área de trazado es «final − ventana/2». La conversión anterior usaba márgenes distintos
    // de los del dibujo y el cursor caía unos 90 ms más allá. La ventana por omisión es 12 s en escritorio y 6 s en
    // teléfono, así que se fija: la cuentas del centro dependen de ella.
    await openPresentation(page);
    await chooseRadio(page, 'wave-window', '12');
    await chooseRadio(page, 'wave-style', 'scroll');
    await openTimeControls(page);
    await page.click('#freeze-button');
    await closePersonalization(page);
    const lienzo = page.locator('#waves-canvas');
    const caja = (await lienzo.boundingBox())!;
    const escala = caja.width / 608;
    await lienzo.click({ position: { x: (47 + 552 / 2) * escala, y: caja.height * 0.3 } });
    const texto = (await page.locator('#inspector-label').textContent()) ?? '';
    const t = Number((/t ([\d.,]+) s/.exec(texto) as RegExpExecArray)[1]!.replace(',', '.'));
    const fin = (await frame(page)).simTimeMs / 1000;
    expect(Math.abs(t - (fin - 6)), texto).toBeLessThan(0.025);
  });
});

test.describe('IMP · sesión importada', () => {
  test('una sesión importada no evalúa el caso clínico que estaba abierto', async ({ page }, info) => {
    await open(page, { scenario: 'CC-03', speed: 4 });
    await page.locator('.palette-trigger').click();
    await page.locator('#palette-input').fill('Sesión y archivos');
    await page.locator('#palette-input').press('Enter');
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="exportSession"]')]);
    const ruta = info.outputPath('sesion.json');
    await descarga.saveAs(ruta);
    await page.keyboard.press('Escape');
    await page.setInputFiles('#session-input', ruta);
    // La sesión no dice de qué caso es: el panel lo avisa y no ofrece entregar.
    await showPanel(page, 'case');
    await expect(page.locator('#instructor-case')).toContainText('Sesión importada', { timeout: 15_000 });
    await expect(page.locator('#instructor-case [data-action="submitCase"]')).toHaveCount(0);
  });
});

test.describe('DESC · desconexión del circuito', () => {
  test('abrir el circuito en Eventos dispara la alarma alta; deshacer la resuelve y reconocer devuelve la banda al azul', async ({
    page,
  }) => {
    await open(page, { scenario: 'SC-23', speed: 4 });
    await showPanel(page, 'patient');
    await page.click('[data-event="disconnect"]');
    await expect(page.locator('#alarm-label')).toHaveText('Prioridad alta · Paciente desconectado', { timeout: 20_000 });
    await expect(page.locator('#alarm-band')).toHaveClass(/high/);
    await expect.poll(async () => (await frame(page)).metrics.vte?.value ?? 1, { timeout: 15_000 }).toBeLessThan(0.01);
    await page.click('[data-action="undoEvent"]');
    await expect(page.locator('#alarm-label')).toHaveText('Alarmas resueltas', { timeout: 20_000 });
    await hidePanel(page);
    await page.click('[data-action="alarms"]');
    await page.click('[data-action="acknowledge"]');
    await page.waitForFunction(() => (window.__ventila.frame as { alarmBar: { color: string } }).alarmBar.color === 'green');
    await page.keyboard.press('Escape');
    await expect(page.locator('#alarm-label')).toHaveText('Sin alarmas');
  });
});

test.describe('TIE · controles de tiempo en la barra de curvas', () => {
  test('Pausar, velocidad y Congelar viven en .signal-toolbar y no se confunden', async ({ page }) => {
    await open(page, { speed: 4 });
    await expect(page.locator('.signal-toolbar button:visible')).toHaveCount(3);
    await expect(page.locator('#sim-pause')).toBeVisible();
    await expect(page.locator('#wave-options-button')).toBeVisible();
    await openTimeControls(page);
    await expect(page.locator('#freeze-button')).toBeVisible();
    await expect(page.locator('#speed-options')).toHaveAttribute('role', 'radiogroup');
    await expect(page.locator('#speed-options [role="radio"]')).toHaveCount(5);
    await page.click('#freeze-button');
    await expect(page.locator('#freeze-button')).toHaveClass(/active/);
    await expect(page.locator('#frozen-ribbon')).toBeVisible();
    await expect(page.locator('#sim-pause')).toContainText('Pausar'); // congelar no detiene la simulación
    await closePersonalization(page);
    await page.click('#sim-pause');
    await expect(page.locator('#sim-pause')).toContainText('Reanudar · 4×');
    await page.click('#sim-pause');
    await expect(page.locator('#sim-pause')).toContainText('Pausar · 4×');
  });
  test('la velocidad se actualiza desde el menú y Escape devuelve el foco', async ({ page }) => {
    await open(page);
    await openTimeControls(page);
    await page.locator('#speed-options [data-speed="2"]').click();
    await expect.poll(() => page.evaluate(() => window.__ventila.speed)).toBe(2);
    await expect(page.locator('#speed-value')).toHaveText('2×');
    await expect(page.locator('#speed-options [data-speed="2"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#speed-options')).toBeVisible();
    await expect(page.locator('#simulation-clock')).toContainText('2×');
    await page.locator('#speed-options [data-speed="4"]').focus();
    await closePersonalization(page);
    await expect(page.locator('#wave-options-button')).toBeFocused();
    await openTimeControls(page);
    await page.locator('#freeze-button').click();
    await expect(page.locator('#freeze-button')).toHaveClass(/active/);
  });
  test('una velocidad personalizada de la URL aparece en Revisar curvas y tiempo', async ({ page }) => {
    await open(page, { speed: 3 });
    await openTimeControls(page);
    await expect(page.locator('#speed-value')).toHaveText('3×');
    await expect(page.locator('#speed-options [data-speed="3"]')).toHaveAttribute('aria-checked', 'true');
  });
  test('la escala alterna entre automática y fija', async ({ page }) => {
    await open(page);
    await expect(page.locator('#wave-scale input[value="auto"]')).toBeChecked();
    await openPresentation(page);
    await chooseRadio(page, 'wave-scale', 'fixed');
    await expect.poll(() => page.evaluate(() => window.__ventila.waveScale)).toBe('fixed');
    await chooseRadio(page, 'wave-scale', 'auto');
    await expect.poll(() => page.evaluate(() => window.__ventila.waveScale)).toBe('auto');
  });
  test('los controles de tiempo caben sin desbordar el ancho del viewport', async ({ page }) => {
    await open(page);
    await expect(page.locator('.signal-toolbar button:visible')).toHaveCount(3);
    const d = await page.locator('.signal-toolbar').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(d.scroll).toBeLessThanOrEqual(d.client + 1);
  });
  test('la barra muestra como máximo cinco controles interactivos', async ({ page }) => {
    await open(page);
    const count = await page
      .locator('.signal-toolbar button:visible, .signal-toolbar select:visible, .signal-toolbar input:visible')
      .count();
    expect(count).toBeLessThanOrEqual(await page.evaluate(() => (matchMedia('(max-width:700px)').matches ? 6 : 5)));
  });
});

test.describe('CUR · comparación antes/después', () => {
  test('una intervención conserva automáticamente la última respiración completa como «Antes»', async ({ page }) => {
    await open(page, { speed: 4 });
    await expect.poll(async () => (await frame(page)).breathCount, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(() => window.__ventila.waveRef)).toBeNull();
    await page.click('[data-setting-quick="peep"]');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.__ventila.waveRef)).not.toBeNull();
    await expect(page.locator('#wave-ref-button')).toHaveClass(/active/);
  });
  test('Comparar última respiración dibuja el ciclo previo atenuado bajo la traza actual', async ({ page }) => {
    await open(page, { speed: 4 });
    await expect.poll(async () => (await frame(page)).breathCount, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    // Comparar dibuja sobre las curvas: pide las ayudas encendidas (apagadas por omisión).
    await page.locator('#wave-aids-toggle').click();
    await openPersonalization(page);
    await page.click('#wave-ref-button');
    await expect(page.locator('#wave-ref-button')).toHaveClass(/active/);
    await expect(page.locator('#wave-ref-button')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#wave-ref-button')).toContainText('Dejar de comparar');
    await expect.poll(() => page.evaluate(() => window.__ventila.waveRef)).not.toBeNull();
    await expect(page.locator('#wave-ref-clear')).toHaveCount(0);
    await closePersonalization(page);
    // Para que el fantasma no quede escondido bajo una curva idéntica, suben PEEP y Vt: la referencia queda
    // con la línea de base y el volumen viejos bajo la traza nueva — la separación es el punto didáctico.
    const bc0 = (await frame(page)).breathCount;
    await page.click('[data-setting-quick="peep"]');
    for (let k = 0; k < 6; k++) await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await page.click('[data-setting-quick="vt"]');
    for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await frame(page)).breathCount, { timeout: 20_000 }).toBeGreaterThanOrEqual(bc0 + 2);
    // Con la traza congelada el dibujo es estático: los únicos píxeles que cambian al quitar la referencia son
    // los del fantasma. La línea base se toma tras el primer repintado congelado.
    await openTimeControls(page);
    await page.click('#freeze-button');
    await expect(page.locator('#frozen-ribbon')).toBeVisible();
    await closePersonalization(page);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('#waves-canvas')!;
      (window as unknown as { __ventilashot: number[] }).__ventilashot = Array.from(
        c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data,
      );
    });
    const cambiados = () =>
      page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>('#waves-canvas')!;
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        const a = (window as unknown as { __ventilashot: number[] }).__ventilashot;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] !== a[i] || d[i + 1] !== a[i + 1] || d[i + 2] !== a[i + 2]) n++;
        return n;
      });
    // Un solo botón apaga todas las ayudas: curva previa, marcas de fase y presión, líneas de PEEP y Pmáx.
    await page.locator('#wave-aids-toggle').click();
    await expect(page.locator('#wave-aids-toggle')).toHaveAttribute('aria-pressed', 'false');
    await openPersonalization(page);
    await expect(page.locator('#wave-ref-button')).toBeDisabled();
    await closePersonalization(page);
    await expect.poll(cambiados, { timeout: 10_000 }).toBeGreaterThan(80);
    expect(await page.evaluate(() => window.__ventila.waveRef)).not.toBeNull();
    await page.locator('#wave-aids-toggle').click();
    await openPersonalization(page);
    await expect(page.locator('#wave-ref-button')).toBeEnabled();
    await closePersonalization(page);
    await expect.poll(cambiados, { timeout: 10_000 }).toBe(0);
  });
});

test.describe('EXM · modo examen', () => {
  test('los valores medidos se ocultan hasta que el alumno los estima', async ({ page }) => {
    await open(page, { speed: 4 });
    await expect.poll(async () => (await frame(page)).metrics.ppeak?.value, { timeout: 20_000 }).not.toBeNull();
    const pico = page.locator('#numeric-grid [data-metric="ppeak"]');
    const real = (await frame(page)).metrics.ppeak!.value;
    await expect(pico.locator('.numeric-value')).not.toHaveText('?');
    await toggleExam(page);
    await expect(page.locator('#exam-toggle')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#exam-toggle')).toHaveClass(/active/);
    await expect.poll(() => page.evaluate(() => window.__ventila.exam.active)).toBe(true);
    await backToMonitor(page);
    // Las casillas con dato muestran «?»; las sin medición conservan el guion y explican el motivo debajo.
    await expect(pico.locator('.numeric-value')).toHaveText('?');
    await page.click('#numeric-grid [data-metric="ppeak"]');
    await expect(page.locator('#app-dialog')).toBeVisible();
    await expect(page.locator('#dialog-title')).toContainText('Estimar');
    await page.fill('#exam-estimate-input', String(Math.round(real! * 1.2)));
    await page.click('[data-action="examSubmit"]');
    await expect(page.locator('#app-dialog')).not.toBeVisible();
    await expect(pico.locator('.numeric-value')).toHaveText(String(Math.round(real!)));
    await expect(pico.locator('.numeric-age')).toContainText('Est.');
    await expect.poll(() => page.evaluate(() => window.__ventila.exam.estimates)).toBe(1);
    await expect(page.locator('.toast').last()).toContainText('estimaste');
    // La tabla de mediciones aplica la misma regla: estimada muestra el valor y la estimación; las demás siguen «?».
    await page.click('[data-view="data"]');
    const filaPico = page.locator('#data-table-body tr', { has: page.locator('[data-metric="ppeak"]') });
    await expect(filaPico).toContainText('Estimaste');
    const filaVte = page.locator('#data-table-body tr', { has: page.locator('[data-metric="vte"]') });
    await expect(filaVte).toContainText('?');
    await page.click('[data-view="waves"]');
    // Al apagar el modo examen todo vuelve; al encenderlo de nuevo la estimación ya hecha sigue visible.
    await expect(page.locator('#exam-toggle')).toHaveAttribute('aria-checked', 'true');
    await toggleExam(page);
    await expect(pico.locator('.numeric-value')).toHaveText(String(Math.round(real!)));
    await expect(page.locator('#numeric-grid [data-metric="vte"] .numeric-value')).not.toHaveText('?');
    await toggleExam(page);
    await expect(page.locator('#numeric-grid [data-metric="vte"] .numeric-value')).toHaveText('?');
    await expect(pico.locator('.numeric-value')).toHaveText(String(Math.round(real!)));
  });

  test('el campo vacío no vale como cero y el Resumen no revela las cifras tapadas', async ({ page }) => {
    // Auditoría: `Number('')` aceptaba el vacío como 0, y la pestaña Resumen mostraba lo que la columna tapaba.
    await open(page, { speed: 4 });
    await expect.poll(async () => (await frame(page)).metrics.ppeak?.value, { timeout: 20_000 }).not.toBeNull();
    await toggleExam(page);
    const pico = page.locator('#numeric-grid [data-metric="ppeak"]');
    await expect(pico.locator('.numeric-value')).toHaveText('?');
    await page.click('#numeric-grid [data-metric="ppeak"]');
    await page.click('[data-action="examSubmit"]'); // sin escribir nada
    // El diálogo sigue abierto y no se registró estimación: el vacío no es una respuesta.
    await expect(page.locator('#app-dialog')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__ventila.exam.estimates)).toBe(0);
    await page.click('[data-action="closeDialog"]');
    // El Resumen no filtra lo que la columna tapa: ni el valor de la tarjeta ni la fórmula sustituida.
    await openFundamentos(page);
    await expect(page.locator('.edu-card').first().locator('header b')).toContainText('?');
    await expect(page.locator('.edu-card').first()).not.toContainText(/\d+ = /);
    // El modo examen vive en el menú «…» y se alterna desde cualquier lugar; al salir, la cifra y la sustitución vuelven.
    await toggleExam(page);
    await openFundamentos(page);
    await expect(page.locator('.edu-card').first().locator('header b')).not.toContainText('?');
  });
});

test.describe('EXM · ubicación del modo examen', () => {
  test('el interruptor vive en el menú «…» y no en el monitor', async ({ page }) => {
    await open(page);
    const button = page.locator('#exam-toggle');
    expect(await button.evaluate((el) => el.closest('#more-menu'))).not.toBeNull();
    await expect(page.locator('#monitor #exam-toggle')).toHaveCount(0);
    expect(await button.evaluate((el) => el.closest('.signal-toolbar'))).toBeNull();
    await page.locator('#more-button').click();
    await expect(button).toBeVisible();
    await expect(button).toContainText('Modo examen');
    await expect(button).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('BLD · bucle docente con presión muscular', () => {
  test('el bucle Pva·V con presión total se ve en el panel docente', async ({ page }) => {
    await open(page, { scenario: 'SC-19' });
    await showPanel(page, 'patient');
    await openModelData(page);
    const canvas = page.locator('#muscle-loop-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box && box.width > 0 && box.height > 0).toBe(true);
  });
});

test.describe('DEN · densidad de la columna numérica', () => {
  test('Casillas vive en Pantalla y se oculta fuera de Curvas', async ({ page }) => {
    await open(page);
    const density = page.locator('#numeric-density');
    const densityField = page.locator('#density-field');
    expect(await density.evaluate((el) => el.tagName.toLowerCase())).toBe('fieldset');
    expect(await density.evaluate((el) => el.closest('#wave-options'))).not.toBeNull();
    await openPresentation(page);
    await expect(density).toBeVisible();
    await closePersonalization(page);
    await page.locator('.monitor-nav [data-view="loops"]').click();
    await expect(densityField).toHaveJSProperty('hidden', true);
    await page.locator('.monitor-nav [data-view="waves"]').click();
    await expect(densityField).toHaveJSProperty('hidden', false);
    await openPresentation(page);
    await expect(density).toBeVisible();
    await closePersonalization(page);
    await page.locator('.monitor-nav [data-view="data"]').click();
    await openPresentation(page);
    await expect(densityField).toHaveJSProperty('hidden', true);
    await closePersonalization(page);
  });

  test('la selección de 6 casillas grandes persiste y vuelve a 13 sin romper la tabla', async ({ page }) => {
    await open(page);
    const visibles = () => page.locator('#numeric-grid .numeric:visible');
    await expect(visibles()).toHaveCount(13);
    await openPresentation(page);
    await chooseRadio(page, 'numeric-density', '6');
    await expect(visibles()).toHaveCount(6);
    await expect(page.locator('#numeric-density input[value="6"]')).toBeChecked();
    const rotulos = await visibles().locator('.numeric-label').allTextContents();
    // El orden es el de la rejilla completa (METRICS), con VTesp en su lugar habitual tras FR.
    expect(rotulos).toEqual(['Ppico', 'PEEPe', 'Pplat', 'FR', 'VTesp', 'FiO₂']);
    const vista = await page.locator('#view-waves').evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
    expect(vista.scroll).toBeLessThanOrEqual(vista.client + 1);
    // La preferencia persiste entre recargas.
    await page.reload();
    await expect(page.locator('#numeric-grid .numeric:visible')).toHaveCount(6);
    await openPresentation(page);
    await chooseRadio(page, 'numeric-density', '13');
    await expect(page.locator('#numeric-grid .numeric:visible')).toHaveCount(13);
    await expect(page.locator('#numeric-density input[value="13"]')).toBeChecked();
    // La tabla «Datos» completa no cambia: sigue con las veinte filas repartidas en dos tablas.
    await closePersonalization(page);
    await page.locator('.monitor-nav [data-view="data"]').click();
    await expect(page.locator('#data-table-body tr[data-row]')).toHaveCount(10);
    await expect(page.locator('#data-table-body-2 tr[data-row]')).toHaveCount(10);
  });
});

test.describe('RT · disparo reverso (SC-24)', () => {
  test('cargar SC-24 muestra la amplitud evocada 8 en el panel del paciente', async ({ page }) => {
    await open(page, { scenario: 'SC-24' });
    await showPanel(page, 'patient');
    await openMoreParams(page, 'esfuerzo');
    await expect(page.locator('[data-phys-number="reverseAmp"]')).toHaveValue('8');
    await expect(page.locator('[data-phys-number="reverseDelay"]')).toHaveValue('0.5');
  });
});

test.describe('PRE · presets de mecánica del paciente', () => {
  test('«TET 7,0 mm» fija el deslizador K₂ a 9,2 y moverlo a mano deja «Personalizado»', async ({ page }) => {
    await open(page);
    await showPanel(page, 'patient');
    await openMoreParams(page, 'via');
    const tubo = page.locator('#preset-tube');
    await expect(tubo).toHaveValue('none');
    await tubo.selectOption('id70');
    await expect(page.locator('[data-phys-number="rohrer"]')).toHaveValue('9.2');
    await expect(tubo).toHaveValue('id70');
    // Mover el deslizador a mano deja el preset en «Personalizado» (opción oculta, seleccionada).
    await page.locator('[data-phys-range="rohrer"]').fill('5');
    await expect(page.locator('[data-phys-range="rohrer"]')).toHaveValue('5');
    await expect(tubo).toHaveValue('custom');
    await openMoreParams(page, 'pulmon');
    const tejido = page.locator('#preset-tissue');
    await tejido.selectOption('healthy');
    await expect(page.locator('[data-phys-number="viscoelastic"]')).toHaveValue('3');
    await expect(page.locator('#preset-tissue-note')).toContainText('D’Angelo');
  });
});

test.describe('PAC · panel Paciente esencial', () => {
  test('tres controles a la vista; la mecánica avanzada sale de la barra en cuatro pestañas, un grupo a la vez', async ({ page }) => {
    await open(page, { scenario: 'SC-02' });
    await showPanel(page, 'patient');
    await expect(page.locator('#instructor-patient [data-phys-range]:visible')).toHaveCount(3);
    await expect(page.locator('#flyout-advanced')).toBeHidden();

    await openMoreParams(page, 'via');
    await expect(page.locator('#advanced-tabs [data-group]')).toHaveCount(4);
    await expect(page.locator('#patient-extra-controls [data-group]:visible')).toHaveCount(1);
    await expect(page.locator('[data-phys-range="expResistance"]')).toBeVisible();
    await expect(page.locator('[data-phys-range="effortExp"]')).toBeHidden();
    await openMoreParams(page, 'esfuerzo');
    await expect(page.locator('[data-phys-range="effortExp"]')).toBeVisible();
  });

  test('los paneles laterales: uno a la vez, Esc devuelve el foco y se cierran al ir a Casos', async ({ page }, info) => {
    // En móvil el panel ocupa la pantalla y tapa la barra: allí se prueba abrirlo y cerrarlo (mobile.spec.ts).
    test.skip(info.project.name === 'mobile', 'sólo escritorio');
    await open(page, { scenario: 'SC-02' });
    await showPanel(page, 'patient');
    await openMoreParams(page, 'pulmon');
    await openModelData(page);
    await expect(page.locator('#flyout-advanced')).toBeHidden();
    await expect(page.locator('[data-flyout="model"]')).toHaveAttribute('aria-expanded', 'true');
    // Sale del borde derecho de la barra, sin taparla.
    const [barra, panel] = await Promise.all([page.locator('#instructor').boundingBox(), page.locator('#flyout-model').boundingBox()]);
    expect(panel!.x).toBeGreaterThanOrEqual(barra!.x + barra!.width);
    await page.locator('#flyout-model-title').press('Escape');
    await expect(page.locator('#flyout-model')).toBeHidden();
    await expect(page.locator('[data-flyout="model"]')).toBeFocused();
    await openModelData(page);
    await page.locator('[data-instructor="case"]').click();
    await expect(page.locator('#flyout-model')).toBeHidden();
  });
});

test.describe('RC · reclutamiento alveolar con histéresis (SC-25)', () => {
  const ponerPeep = async (page: Page, peep: number): Promise<void> => {
    await page.click('[data-setting-quick="peep"]');
    await page.fill('#quick-value', String(peep));
    await page.click('[data-action="confirmEdit"]');
    await page.waitForFunction((p) => (window.__ventila.frame as unknown as { settings: { peep: number } }).settings.peep === p, peep, {
      timeout: 20_000,
    });
  };
  const reclutado = (page: Page): Promise<number> =>
    page.evaluate(() => (window.__ventila.frame as unknown as { truth: { recruited: number } }).truth.recruited);

  test('subir PEEP por encima de la apertura recluta; bajarla por encima del cierre lo conserva', async ({ page }) => {
    await open(page, { scenario: 'SC-25', speed: 8 });
    await showPanel(page, 'patient');
    await openModelData(page);
    // La celda del modelo aparece sólo con reclutamiento configurado, y arranca en 0 % (PEEP 5, picos ~22 < pOpen 28).
    await expect(page.locator('#truth-recruit-cell')).toBeVisible();
    expect(await reclutado(page)).toBeLessThan(0.05);
    await hidePanel(page);
    // PEEP 20: los picos inspiratorios (~37) superan pOpen y la fracción abierta sube respiración a respiración.
    await ponerPeep(page, 20);
    await page.waitForFunction(() => (window.__ventila.frame as unknown as { truth: { recruited: number } }).truth.recruited > 0.9, null, {
      timeout: 40_000,
    });
    // De vuelta a PEEP 10 —dentro de la banda, por encima del cierre— se conserva lo abierto: histéresis.
    await ponerPeep(page, 10);
    const n = (await frame(page)).breathCount;
    await page.waitForFunction((b) => (window.__ventila.frame as unknown as { breathCount: number }).breathCount >= b + 4, n, {
      timeout: 40_000,
    });
    expect(await reclutado(page)).toBeGreaterThan(0.9);
    await expect(page.locator('#truth-recruit')).not.toHaveText(/^0\s*%$/);
  });
});

test.describe('PREF · bienvenida y memoria de preferencias', () => {
  test('la primera visita ofrece explorar o casos clínicos; la bienvenida no se repite', async ({ page }) => {
    await open(page, {}, { firstRun: true });
    await expect(page.locator('#dialog-title')).toHaveText('Bienvenido a Ventila Lab');
    await expect(page.locator('#welcome-free')).toBeFocused();
    await expect(page.locator('#dialog-content')).toContainText('Un ventilador virtual para aprender mecánica respiratoria sin riesgo.');
    // Casos clínicos lleva a la lista de casos, en el panel lateral.
    await page.click('#welcome-guided');
    await expect(page.locator('#app-dialog')).toBeHidden();
    await expect(page.locator('#instructor-case [data-case-id="CC-01"]')).toBeVisible();
    await page.reload();
    await page.waitForFunction(() => !!window.__ventila && window.__ventila.frame !== null, null, { timeout: 15_000 });
    await expect(page.locator('#app-dialog')).toBeHidden();
  });

  test('restaura escenario, vista y ventana de curvas al recargar', async ({ page }) => {
    await open(page);
    await page.click('.app-context');
    const card = page.locator('#instructor-case [data-case-id="CC-03"]');
    const scenarioName = (await card.locator('strong').textContent())?.trim() ?? '';
    await card.click();
    await expect(page.locator('#scenario-name')).toHaveText(scenarioName);
    await hidePanel(page);
    await page.locator('.monitor-nav [data-view="loops"]').click();
    await expect(page.locator('#view-loops')).toHaveClass(/active/);
    await openPresentation(page);
    await chooseRadio(page, 'wave-window', '24');
    await page.reload();
    await page.waitForFunction(() => !!window.__ventila && window.__ventila.frame !== null, null, { timeout: 15_000 });
    await expect(page.locator('#scenario-name')).toHaveText(scenarioName);
    await expect(page.locator('#view-loops')).toHaveClass(/active/);
    await expect(page.locator('#wave-window input[value="24"]')).toBeChecked();
    await expect(page.locator('#toast-stack .toast').last()).toContainText(`Continúas en: ${scenarioName}`);
  });

  test('un escenario de la dirección tiene prioridad sobre el guardado', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ventila.prefs', JSON.stringify({ v: 1, lastScenario: 'SC-03', welcomed: true }));
    });
    await open(page, { scenario: 'SC-01' }, { firstRun: true });
    await expect(page.locator('#scenario-name')).toHaveText('Banco lineal pasivo');
  });

  test('restablecer preferencias las borra y avisa que se aplicará al recargar', async ({ page }) => {
    await open(page);
    await page.locator('.palette-trigger').click();
    await page.locator('#palette-input').fill('Sesión y archivos');
    await page.locator('#palette-input').press('Enter');
    await page.click('#app-dialog [data-action="resetPrefs"]');
    await expect(page.locator('#toast-stack .toast').last()).toHaveText('Preferencias restablecidas: se aplican al recargar');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ventila.prefs'))).toBeNull();
  });
});

test.describe('PAT · perfiles del paciente', () => {
  test('aplicar un perfil en Paciente conserva sesión, tiempo, ajustes y lo hecho en la práctica', async ({ page }) => {
    await open(page, { scenario: 'SC-01', speed: 4 });
    await page.click('[data-action="inspiratory"]');
    await page.click('#hold-run');
    await expect
      .poll(() => page.evaluate(() => window.__ventila.frame?.procedure.last.inspHold?.quality ?? null), { timeout: 25_000 })
      .toBe('valid');
    await page.click('[data-action="closeHold"]');
    await page.locator('#sim-pause').click();
    await expect.poll(() => page.evaluate(() => window.__ventila.running)).toBe(false);
    const estado = () =>
      page.evaluate(() => {
        const current = window.__ventila.frame as unknown as {
          simTimeMs: number;
          settings: unknown;
          truth: { patient: unknown; effort: unknown };
        };
        return {
          simTimeMs: current.simTimeMs,
          settings: current.settings,
          patient: current.truth.patient,
          effort: current.truth.effort,
          scenario: document.querySelector('#scenario-name')?.textContent,
          lessonFlags: (window.__ventila as unknown as { lessonFlags: Record<string, unknown> }).lessonFlags,
        };
      });
    const before = await estado();
    const profile = PATIENT_PROFILES.find((item) => item.id === 'stiff')!;
    const expected = JSON.parse(JSON.stringify(profileState(profile))) as { patient: unknown; effort: unknown };
    await showPanel(page, 'patient');
    await page.locator('#patient-profiles [data-profile="stiff"]').click();
    await expect(page.locator('#toast-stack .toast').last()).toContainText('Perfil aplicado: Restrictivo');
    await expect.poll(async () => (await estado()).patient).toEqual(expected.patient);
    const after = await estado();
    expect(after.effort).toEqual(expected.effort);
    expect(after.settings).toEqual(before.settings);
    expect(after.scenario).toBe(before.scenario);
    expect(after.simTimeMs).toBe(before.simTimeMs);
    expect(after.lessonFlags).toEqual(before.lessonFlags);
  });

  test('los perfiles están deshabilitados en una referencia fotográfica', async ({ page }) => {
    await open(page, { fixture: 'P1' });
    await expect(page.locator('#scenario-name')).toContainText('Referencia fotográfica P1');
    await showPanel(page, 'patient');
    await expect(page.locator('#patient-profiles [data-profile]')).toHaveCount(PATIENT_PROFILES.length);
    await expect(page.locator('#patient-profiles [data-profile]:disabled')).toHaveCount(PATIENT_PROFILES.length);
  });

  test('aplica, deshace y restablece mecánica con perfiles completos', async ({ page }) => {
    await open(page, { scenario: 'SC-01' });
    await showPanel(page, 'patient');
    await expect(page.locator('#patient-profiles')).toBeVisible();
    const programmedSettings = (await frame(page)).settings;

    const healthy = page.locator('#patient-profiles [data-profile="healthy"]');
    const stiff = page.locator('#patient-profiles [data-profile="stiff"]');
    await expect(healthy).toHaveAttribute('aria-pressed', 'true');
    await stiff.click();
    await expect(page.locator('[data-phys-number="compliance"]')).toHaveValue('25');
    await expect(stiff).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#profile-status')).toHaveText('');
    await expect(page.locator('#toast-stack .toast').last()).toHaveText(
      'Perfil aplicado: Restrictivo. La programación del ventilador no cambia.',
    );
    expect((await frame(page)).settings).toEqual(programmedSettings);

    const compliance = page.locator('[data-phys-number="compliance"]');
    await compliance.fill('40');
    await compliance.dispatchEvent('change');
    await expect
      .poll(() =>
        page.evaluate(() => (window.__ventila.frame as unknown as { truth: { patient: { crs: number } } }).truth.patient.crs * 1000),
      )
      .toBe(40);
    await expect(page.locator('.profile-chip[aria-pressed="true"]')).toHaveCount(0);
    await expect(page.locator('#profile-status')).toHaveText('Personalizado');

    // Deshacer revierte el último perfil aplicado: vuelve el de partida, aunque luego se tocara un control a mano.
    await page.click('#undo-event');
    await expect(page.locator('[data-phys-number="compliance"]')).toHaveValue('50');
    await expect(healthy).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#profile-status')).toHaveText('');

    await page.locator('#patient-profiles [data-profile="obstructive"]').click();
    await expect(page.locator('#patient-profiles [data-profile="obstructive"]')).toHaveAttribute('aria-pressed', 'true');
    await page.click('[data-action="resetPatient"]');
    await expect(page.locator('[data-phys-number="compliance"]')).toHaveValue('50');
    await expect(healthy).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#profile-status')).toHaveText('');
    const resetPatient = await page.evaluate(
      () =>
        (
          window.__ventila.frame as unknown as {
            truth: { patient: { crs: number; recruit?: unknown; sigmoid?: unknown; second?: unknown } };
          }
        ).truth.patient,
    );
    expect(resetPatient.crs).toBe(0.05);
    expect(resetPatient.recruit).toBeUndefined();
    expect(resetPatient.sigmoid).toBeUndefined();
    expect(resetPatient.second).toBeUndefined();
  });
});
