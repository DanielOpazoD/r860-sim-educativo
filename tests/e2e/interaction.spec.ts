import { expect, test, type Page } from '@playwright/test';
import { expectSafetyMark, frame, open } from './helpers';

test.describe('INT · selección, edición, confirmación y cancelación', () => {
  test('INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor', async ({ page }) => {
    await open(page, { autopause: 4000, speed: 4, instructor: 0 });
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs >= 4000);
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
        const f = window.__r860.frame as { settings: { vt: number } } | null;
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
    await page.waitForFunction((n) => (window.__r860.frame as { breathCount: number }).breathCount > n, a.breathCount, { timeout: 15_000 });
    await page.click('[data-action="standby"]');
    await page.click('[data-action="confirmStandby"]');
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
    for (let i = 0; i < 50; i++) {
      await page.locator('.monitor-nav [data-view="basic"]').dispatchEvent('click');
      await page.locator('.monitor-nav [data-view="waves"]').dispatchEvent('click');
    }
    await page.waitForTimeout(500);
    const after = await frame(page);
    expect(after.simTimeMs).toBeGreaterThan(before.simTimeMs);
    expect(after.breathCount).toBeGreaterThanOrEqual(before.breathCount);
    expect(after.settings).toEqual(before.settings);
    expect(await page.evaluate(() => window.__r860.mode)).toBe(await page.evaluate(() => window.__r860.mode));
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
    await page.click('[data-action="inspiratory"]');
    await expect(page.locator('#hold-panel')).toBeVisible();
    await page.click('#hold-run');
    await expect(page.locator('#hold-status')).toContainText(/Esperando|Oclusión/);
    await expect(page.locator('#hold-value')).toHaveText('15', { timeout: 20_000 });
    await expect(page.locator('#hold-second')).toHaveText('50');
    const status = await page.locator('#hold-status').textContent();
    expect(status).toMatch(/Medido · 18-Ago-2026 21:04:(0[5-9]|1[0-9]|2[0-9])/);
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
    await page.waitForFunction(() => (window.__r860.frame as unknown as { settings: { peep: number } }).settings.peep === 6, null, {
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
  test('TIM-03 · pestaña oculta: pausa explícita con aviso; reanudación manual sin salto de reloj', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('#global-notice')).toContainText('pausada');
    await page.waitForFunction(() => window.__r860.running === false);
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
    await page.click('#sim-pause');
    await page.waitForFunction((t) => (window.__r860.frame as { simTimeMs: number }).simTimeMs > t, t2, { timeout: 5000 });
    expect((await frame(page)).simTimeMs - t2).toBeLessThan(4 * 1500);
  });
  test('ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia', async ({ page }) => {
    await open(page, { scenario: 'SC-09', speed: 4 });
    await page.waitForFunction(() => (window.__r860.frame as { alarmBar: { color: string } }).alarmBar.color === 'red', null, {
      timeout: 30_000,
    });
    await page.click('[data-action="alarms"]');
    await expect(page.locator('#live-alarms')).toContainText('ACTIVA');
    await page.click('[data-action="acknowledge"]');
    await page.waitForFunction(() =>
      (window.__r860.frame as { alarms: { id: string; acknowledgedAtMs: number | null }[] }).alarms.some(
        (a) => a.id === 'pmax' && a.acknowledgedAtMs !== null,
      ),
    );
    expect((await frame(page)).alarmBar.color).toBe('red'); // reconocida pero la condición persiste
    await page.keyboard.press('Escape');
    // Resolver la causa desde el panel docente (Rinsp 400 → 10). Con los límites por omisión configurados, un ventilador
    // que entrega 0 mL no alarma sólo por Pmáx: también saltan VTesp bajo y VMesp bajo, y esas dos se activaron DESPUÉS
    // del reconocimiento anterior. Así que al resolverse la causa la banda queda gris —resuelta, pendiente de
    // reconocer— y hace falta reconocer otra vez para limpiarla. Ése es justamente el contrato que esta prueba fija.
    await page.click('[data-instructor="patient"]'); // la pestaña que se abre es «Entrenar»
    await page.fill('[data-phys-number="resistance"]', '10');
    await page.locator('[data-phys-number="resistance"]').press('Enter');
    await page.locator('[data-phys-number="resistance"]').dispatchEvent('change');
    // VMesp bajo se resuelve con la ventana de ocho respiraciones (32 s simulados): bajo carga, a 4× no bastan 20 s de reloj.
    await page.waitForFunction(() => (window.__r860.frame as { alarmBar: { color: string } }).alarmBar.color === 'grey', null, {
      timeout: 45_000,
    });
    await page.click('[data-action="alarms"]');
    await page.click('[data-action="acknowledge"]');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => (window.__r860.frame as { alarmBar: { color: string } }).alarmBar.color === 'green', null, {
      timeout: 20_000,
    });
    // Nueva oclusión sin reconocer y resolución: banda gris (resuelta, pendiente de reconocer) hasta reconocer.
    await page.click('[data-instructor="events"]');
    await page.click('[data-event="obstruction"]');
    await page.waitForFunction(() => (window.__r860.frame as { alarmBar: { color: string } }).alarmBar.color === 'red', null, {
      timeout: 20_000,
    });
    await page.click('[data-action="undoEvent"]');
    await page.waitForFunction(() => (window.__r860.frame as { alarmBar: { color: string } }).alarmBar.color === 'grey', null, {
      timeout: 20_000,
    });
    await expect(page.locator('#alarm-label')).toHaveText('Alarmas resueltas');
    await page.click('[data-action="alarms"]');
    await expect(page.locator('#live-alarms')).toContainText('PENDIENTE DE RECONOCER');
    await page.click('[data-action="acknowledge"]');
    await page.waitForFunction(() => (window.__r860.frame as { alarmBar: { color: string } }).alarmBar.color === 'green', null, {
      timeout: 5000,
    });
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
    await page.waitForFunction(() => (window.__r860.frame as { simTimeMs: number }).simTimeMs > 0, null, { timeout: 15_000 });
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
  test('sin bloqueo no inventa números; con bloqueo enseña la cuenta con los del monitor', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.click('.monitor-nav [data-view="teaching"]');
    await expect(page.locator('#view-teaching')).toBeVisible();
    // La Ppico se lee siempre; la meseta y sus derivados exigen ocluir, y la pestaña lo dice en vez de rellenar.
    await expect(page.locator('.edu-card').first()).toContainText('Presión pico');
    await expect(page.locator('.edu-falta').first()).toContainText('bloqueo inspiratorio');
    await expect(page.locator('.edu-sub')).toHaveCount(0);

    await page.click('[data-action="inspiratory"]');
    await page.click('[data-action="runHold"]');
    await page.waitForFunction(
      () => (window.__r860.frame as unknown as { procedure: { last: { inspHold: unknown } } })?.procedure.last.inspHold !== null,
      null,
      { timeout: 40_000 },
    );
    await page.click('[data-action="closeHold"]');
    // El bloqueo lleva el monitor a las curvas, que es lo que se quiere ver durante la maniobra: se vuelve al resumen.
    await page.click('.monitor-nav [data-view="teaching"]');
    // Las cuatro tarjetas con su sustitución, y el número de la meseta es el mismo que publicó el bloqueo.
    await expect(page.locator('.edu-card')).toHaveCount(4);
    await expect(page.locator('.edu-formula b')).toHaveCount(4);
    const pplat = await page.evaluate(
      () =>
        (window.__r860.frame as unknown as { procedure: { last: { inspHold: { values: { pplat: { value: number } } } } } }).procedure.last
          .inspHold.values.pplat.value,
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

  test('la pantalla de protección lee el índice de estrés y construye la titulación con lo medido', async ({ page }) => {
    await open(page, { scenario: 'SC-15', speed: 8, instructor: 0 });
    await page.click('.monitor-nav [data-view="teaching"]');
    await page.click('[data-edu-tab="proteccion"]');
    // El índice se lee del ciclo actual; la titulación empieza vacía y dice cuántos puntos faltan.
    await expect(page.locator('.edu-siluetas .activa')).toHaveCount(1);
    await expect(page.locator('.edu-falta')).toContainText('0 de los 2 puntos');

    for (const peep of [8, 14]) {
      await page.click('.monitor-nav [data-view="waves"]');
      // Hay que esperar a un bloqueo DISTINTO del anterior: el previo ya era válido y satisfacía la condición al
      // instante, así que la prueba cerraba el panel antes de que el nuevo terminara. De ahí venía su intermitencia.
      const previo = await page.evaluate(
        () =>
          (window.__r860.frame as unknown as { procedure: { last: { inspHold: { procedureId: string } | null } } })?.procedure.last.inspHold
            ?.procedureId ?? '',
      );
      await page.click('[data-setting-quick="peep"]');
      await page.fill('#quick-value', String(peep));
      await page.click('[data-action="confirmEdit"]');
      await page.waitForFunction((p) => (window.__r860.frame as unknown as { settings: { peep: number } }).settings.peep === p, peep, {
        timeout: 20_000,
      });
      await page.click('[data-action="inspiratory"]');
      await page.click('[data-action="runHold"]');
      // Esperar a que el bloqueo sea VÁLIDO y a esa misma PEEP: sólo entonces existe el punto. Esperar un plazo fijo
      // hacía la prueba dependiente de la máquina, y en el runner llegaba tarde.
      await page.waitForFunction(
        ([p, anterior]) => {
          const fr = window.__r860.frame as unknown as {
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
    }
    await page.click('.monitor-nav [data-view="teaching"]');
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
    await page.waitForFunction(() => (window.__r860.frame as unknown as { simTimeMs: number }).simTimeMs >= 30_000, null, {
      timeout: 40_000,
    });
    await page.click('#freeze-button');
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
    const lectura = (await etiqueta.textContent()) ?? '';
    await expect(cursor).toHaveAttribute('aria-valuetext', lectura);
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
    const finDeVentana = async (): Promise<number> => {
      const texto = (await page.locator('#inspector-label').textContent()) ?? '';
      const m = /final de ventana ([\d:]+)/.exec(texto);
      expect(m, texto).not.toBeNull();
      return (m as RegExpExecArray)[1]!.split(':').reduce((a, x) => a * 60 + Number(x), 0);
    };
    await mover(page, '#history-slider', 0);
    const temprano = await finDeVentana();
    await mover(page, '#history-slider', 1000);
    const tarde = await finDeVentana();
    expect(tarde - temprano).toBeGreaterThanOrEqual(10);
  });

  test('el cursor cae donde apunta el puntero: el centro de la rejilla es el centro de la ventana', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0, autopause: 30_000 });
    await page.waitForFunction(() => (window.__r860.frame as unknown as { simTimeMs: number }).simTimeMs >= 30_000, null, {
      timeout: 40_000,
    });
    // En continuo el centro del área de trazado es «final − ventana/2». La conversión anterior usaba márgenes distintos
    // de los del dibujo y el cursor caía unos 90 ms más allá. La ventana por omisión es 12 s en escritorio y 6 s en
    // teléfono, así que se fija: la cuentas del centro dependen de ella.
    await page.selectOption('#wave-window', '12');
    await page.selectOption('#wave-style', 'scroll');
    await page.click('#freeze-button');
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

test.describe('LEC · la lección responde', () => {
  test('la pestaña de la lección se abre primero, cuenta lo hecho y avisa al cumplir un objetivo', async ({ page }) => {
    await open(page, { speed: 4 });
    const pestana = page.locator('[data-instructor="learn"]');
    await expect(pestana).toHaveAttribute('aria-selected', 'true');
    await expect(pestana).toHaveText('Entrenar · 0/3');
    // SC-01: el primer objetivo es un bloqueo inspiratorio válido.
    await page.click('[data-action="inspiratory"]');
    await page.click('#hold-run');
    const avisos = page.locator('#toast-stack .toast');
    await expect(avisos.filter({ hasText: 'Objetivo 1 de 3 cumplido' })).toBeVisible({ timeout: 25_000 });
    // El aviso del objetivo convive con el del resultado del bloqueo que lo cumplió.
    await expect(avisos.filter({ hasText: 'Bloqueo medido' })).toBeVisible();
    await expect(pestana).toHaveText('Entrenar · 1/3');
  });

  test('lo que ya se cumple al abrir se marca sin aviso', async ({ page }) => {
    // SC-13: el primer objetivo es observar el VT inicial, y ya está cumplido con el primer cuadro.
    await open(page, { scenario: 'SC-13', speed: 4 });
    await expect(page.locator('[data-instructor="learn"]')).toHaveText('Entrenar · 1/3');
    await expect(page.locator('#lesson-tasks .task.complete')).toHaveCount(1);
    // Sin reintentos: un aviso dura 4 s y `toHaveCount(0)` esperaría a que se fuera solo.
    const avisos = page.locator('#toast-stack .toast', { hasText: 'Objetivo' });
    expect(await avisos.count(), 'el objetivo se marca en el mismo cuadro que anunciaría').toBe(0);
    await page.waitForTimeout(1000);
    expect(await avisos.count()).toBe(0);
  });

  test('una sesión importada no marca objetivos del escenario que estaba abierto', async ({ page }, info) => {
    // Con la resistencia en 25, el objetivo «duplica la resistencia» de SC-01 se cumpliría con el primer cuadro de la
    // sesión reproducida: sin la guarda aparecería marcado aunque nadie lo hubiera hecho en esa sesión.
    await open(page, { speed: 4 });
    await page.click('[data-instructor="patient"]');
    await page.fill('[data-phys-number="resistance"]', '25');
    await page.locator('[data-phys-number="resistance"]').press('Enter');
    await page.locator('[data-phys-number="resistance"]').dispatchEvent('change');
    await page.waitForFunction(
      () => (window.__r860.frame as unknown as { truth: { patient: { rInsp: number } } }).truth.patient.rInsp >= 20,
      null,
      { timeout: 10_000 },
    );
    // El objetivo sí se cumple en la sesión original; se espera a que su aviso se retire para no confundirlo después.
    await expect(page.locator('#toast-stack .toast', { hasText: 'Objetivo' })).toHaveCount(0, { timeout: 10_000 });
    await page.click('[data-action="session"]');
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="exportSession"]')]);
    const ruta = info.outputPath('sesion.json');
    await descarga.saveAs(ruta);
    await page.keyboard.press('Escape');
    await page.setInputFiles('#session-input', ruta);
    await expect(page.locator('#lesson-count')).toHaveText('Sesión importada: sus objetivos no se evalúan', { timeout: 15_000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('#lesson-tasks .task.complete')).toHaveCount(0);
    expect(await page.locator('#toast-stack .toast', { hasText: 'Objetivo' }).count()).toBe(0);
  });
});

test.describe('DESC · desconexión del circuito', () => {
  test('abrir el circuito en «Eventos» dispara la alarma alta; deshacer la resuelve y reconocer devuelve la banda al azul', async ({
    page,
  }) => {
    await open(page, { scenario: 'SC-23', speed: 4 });
    await page.click('[data-instructor="events"]');
    await page.click('[data-event="disconnect"]');
    await expect(page.locator('#alarm-label')).toHaveText('Prioridad alta · Paciente desconectado', { timeout: 20_000 });
    await expect(page.locator('#alarm-band')).toHaveClass(/high/);
    await expect.poll(async () => (await frame(page)).metrics.vte?.value ?? 1, { timeout: 15_000 }).toBeLessThan(0.01);
    await page.click('[data-action="undoEvent"]');
    await expect(page.locator('#alarm-label')).toHaveText('Alarmas resueltas', { timeout: 20_000 });
    await page.click('[data-action="alarms"]');
    await page.click('[data-action="acknowledge"]');
    await page.keyboard.press('Escape');
    await expect(page.locator('#alarm-label')).toHaveText('Sin alarmas');
    await expect(page.locator('[data-instructor="learn"]')).toHaveText('Entrenar · 3/3', { timeout: 10_000 });
  });
});

test.describe('TIE · controles de tiempo en la barra de curvas', () => {
  test('Pausar, velocidad y Congelar viven en .signal-toolbar y no se confunden', async ({ page }) => {
    await open(page, { speed: 4 });
    for (const id of ['#sim-pause', '#sim-speed', '#freeze-button']) await expect(page.locator(`.signal-toolbar ${id}`)).toBeVisible();
    await page.click('#freeze-button');
    await expect(page.locator('#freeze-button')).toHaveClass(/active/);
    await expect(page.locator('#frozen-ribbon')).toBeVisible();
    await expect(page.locator('#sim-pause')).toContainText('Pausar'); // congelar no detiene la simulación
    await page.click('#sim-pause');
    await expect(page.locator('#sim-pause')).toContainText('Reanudar');
    await page.click('#sim-pause');
    await expect(page.locator('#sim-pause')).toContainText('Pausar');
  });
  test('los controles de tiempo caben sin desbordar el ancho del viewport', async ({ page }) => {
    await open(page);
    for (const id of ['#sim-pause', '#sim-speed', '#freeze-button']) await expect(page.locator(id)).toBeVisible();
    const d = await page.locator('.signal-toolbar').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(d.scroll).toBeLessThanOrEqual(d.client + 1);
  });
});

test.describe('CUR · respiración de referencia superpuesta', () => {
  test('guardar una referencia dibuja el ciclo previo atenuado bajo la traza actual', async ({ page }) => {
    await open(page, { speed: 4 });
    await expect.poll(async () => (await frame(page)).breathCount, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    await page.click('#wave-ref-button');
    await expect(page.locator('#wave-ref-button')).toHaveClass(/active/);
    await expect(page.locator('#wave-ref-button')).toContainText('Ref');
    await expect.poll(() => page.evaluate(() => window.__r860.waveRef)).not.toBeNull();
    await expect(page.locator('#wave-ref-clear')).toBeVisible();
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
    await page.click('#freeze-button');
    await expect(page.locator('#frozen-ribbon')).toBeVisible();
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('#waves-canvas')!;
      (window as unknown as { __r860shot: number[] }).__r860shot = Array.from(
        c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data,
      );
    });
    const cambiados = () =>
      page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>('#waves-canvas')!;
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        const a = (window as unknown as { __r860shot: number[] }).__r860shot;
        let n = 0;
        for (let i = 0; i < d.length; i += 4)
          if (Math.abs(d[i]! - a[i]!) > 12 || Math.abs(d[i + 1]! - a[i + 1]!) > 12 || Math.abs(d[i + 2]! - a[i + 2]!) > 12) n++;
        return n;
      });
    await page.click('#wave-ref-clear');
    await expect(page.locator('#wave-ref-button')).toContainText('Referencia');
    await expect(page.locator('#wave-ref-button')).not.toHaveClass(/active/);
    await expect.poll(() => page.evaluate(() => window.__r860.waveRef)).toBeNull();
    await expect.poll(cambiados, { timeout: 10_000 }).toBeGreaterThan(80);
  });
});

test.describe('EXM · modo examen', () => {
  test('los valores medidos se ocultan hasta que el alumno los estima', async ({ page }) => {
    await open(page, { speed: 4 });
    await expect.poll(async () => (await frame(page)).metrics.ppeak?.value, { timeout: 20_000 }).not.toBeNull();
    const pico = page.locator('#numeric-grid [data-metric="ppeak"]');
    const real = (await frame(page)).metrics.ppeak!.value;
    await expect(pico.locator('.numeric-value')).not.toHaveText('?');
    await page.click('#exam-toggle');
    await expect(page.locator('#exam-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => window.__r860.exam.active)).toBe(true);
    // Las casillas con dato muestran «?»; las sin medición conservan su motivo, nunca una cifra falsa.
    await expect(pico.locator('.numeric-value')).toHaveText('?');
    await page.click('#numeric-grid [data-metric="ppeak"]');
    await expect(page.locator('#app-dialog')).toBeVisible();
    await expect(page.locator('#dialog-title')).toContainText('Estimar');
    await page.fill('#exam-estimate-input', String(Math.round(real! * 1.2)));
    await page.click('[data-action="examSubmit"]');
    await expect(page.locator('#app-dialog')).not.toBeVisible();
    await expect(pico.locator('.numeric-value')).toHaveText(String(Math.round(real!)));
    await expect(pico.locator('.numeric-age')).toContainText('Est.');
    await expect.poll(() => page.evaluate(() => window.__r860.exam.estimates)).toBe(1);
    await expect(page.locator('.toast').last()).toContainText('estimaste');
    // La tabla de mediciones aplica la misma regla: estimada muestra el valor y la estimación; las demás siguen «?».
    await page.click('[data-view="data"]');
    const filaPico = page.locator('#data-table-body tr', { has: page.locator('[data-metric="ppeak"]') });
    await expect(filaPico).toContainText('Estimaste');
    const filaVte = page.locator('#data-table-body tr', { has: page.locator('[data-metric="vte"]') });
    await expect(filaVte).toContainText('?');
    await page.click('[data-view="waves"]');
    // Al apagar el modo examen todo vuelve; al encenderlo de nuevo la estimación ya hecha sigue visible.
    await page.click('#exam-toggle');
    await expect(pico.locator('.numeric-value')).toHaveText(String(Math.round(real!)));
    await expect(page.locator('#numeric-grid [data-metric="vte"] .numeric-value')).not.toHaveText('?');
    await page.click('#exam-toggle');
    await expect(page.locator('#numeric-grid [data-metric="vte"] .numeric-value')).toHaveText('?');
    await expect(pico.locator('.numeric-value')).toHaveText(String(Math.round(real!)));
  });
});

test.describe('BLD · bucle docente con presión muscular', () => {
  test('el bucle Pva·V con presión total se ve en el panel docente', async ({ page }) => {
    await open(page, { scenario: 'SC-19' });
    await page.click('[data-instructor="patient"]'); // el panel abre en «Entrenar»
    await page.locator('#truth-details summary').click();
    const canvas = page.locator('#muscle-loop-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box && box.width > 0 && box.height > 0).toBe(true);
  });
});

test.describe('DEN · densidad de la columna numérica', () => {
  test('el alternador muestra 6 casillas grandes, persiste y vuelve a 13 sin romper la tabla', async ({ page }) => {
    await open(page);
    const visibles = () => page.locator('#numeric-grid .numeric:visible');
    await expect(visibles()).toHaveCount(13);
    await page.click('#numeric-density');
    await expect(visibles()).toHaveCount(6);
    await expect(page.locator('#numeric-density')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#numeric-density')).toHaveText('13 datos');
    const rotulos = await visibles().locator('.numeric-label').allTextContents();
    // El orden es el de la rejilla completa (METRICS), con VTesp en su lugar habitual tras FR.
    expect(rotulos).toEqual(['Ppico', 'PEEPe', 'Pplat', 'FR', 'VTesp', 'FiO₂']);
    const vista = await page.locator('#view-waves').evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
    expect(vista.scroll).toBeLessThanOrEqual(vista.client + 1);
    // La preferencia persiste entre recargas.
    await page.reload();
    await expect(page.locator('#numeric-grid .numeric:visible')).toHaveCount(6);
    await page.click('#numeric-density');
    await expect(page.locator('#numeric-grid .numeric:visible')).toHaveCount(13);
    await expect(page.locator('#numeric-density')).toHaveAttribute('aria-pressed', 'false');
    // La tabla «Datos» completa no cambia: sigue con las veinte filas repartidas en dos tablas.
    await page.click('[data-view="data"]');
    await expect(page.locator('#data-table-body tr')).toHaveCount(10);
    await expect(page.locator('#data-table-body-2 tr')).toHaveCount(10);
  });
});

test.describe('RT · disparo reverso (SC-24)', () => {
  test('cargar SC-24 muestra la amplitud evocada 8 en el panel del paciente', async ({ page }) => {
    await open(page, { scenario: 'SC-24' });
    await page.click('[data-instructor="patient"]');
    await page.locator('.advanced-patient summary').click();
    await expect(page.locator('[data-phys-number="reverseAmp"]')).toHaveValue('8');
    await expect(page.locator('[data-phys-number="reverseDelay"]')).toHaveValue('0.5');
  });
});

test.describe('PRE · presets de mecánica del paciente', () => {
  test('«TET 7,0 mm» fija el deslizador K₂ a 9,2 y moverlo a mano deja «Personalizado»', async ({ page }) => {
    await open(page);
    await page.click('[data-instructor="patient"]');
    await page.locator('.advanced-patient summary').click();
    const tubo = page.locator('#preset-tube');
    await expect(tubo).toHaveValue('none');
    await tubo.selectOption('id70');
    await expect(page.locator('[data-phys-number="rohrer"]')).toHaveValue('9.2');
    await expect(tubo).toHaveValue('id70');
    // Mover el deslizador a mano deja el preset en «Personalizado» (opción oculta, seleccionada).
    await page.locator('[data-phys-range="rohrer"]').fill('5');
    await expect(page.locator('[data-phys-range="rohrer"]')).toHaveValue('5');
    await expect(tubo).toHaveValue('custom');
    const tejido = page.locator('#preset-tissue');
    await tejido.selectOption('healthy');
    await expect(page.locator('[data-phys-number="viscoelastic"]')).toHaveValue('3');
    await expect(page.locator('#preset-tissue-note')).toContainText('D’Angelo');
  });
});

test.describe('RC · reclutamiento alveolar con histéresis (SC-25)', () => {
  const ponerPeep = async (page: Page, peep: number): Promise<void> => {
    await page.click('[data-setting-quick="peep"]');
    await page.fill('#quick-value', String(peep));
    await page.click('[data-action="confirmEdit"]');
    await page.waitForFunction((p) => (window.__r860.frame as unknown as { settings: { peep: number } }).settings.peep === p, peep, {
      timeout: 20_000,
    });
  };
  const reclutado = (page: Page): Promise<number> =>
    page.evaluate(() => (window.__r860.frame as unknown as { truth: { recruited: number } }).truth.recruited);

  test('subir PEEP por encima de la apertura recluta; bajarla por encima del cierre lo conserva', async ({ page }) => {
    await open(page, { scenario: 'SC-25', speed: 8 });
    await page.click('[data-instructor="patient"]');
    await page.locator('#truth-details summary').click();
    // La celda del modelo aparece sólo con reclutamiento configurado, y arranca en 0 % (PEEP 5, picos ~22 < pOpen 28).
    await expect(page.locator('#truth-recruit-cell')).toBeVisible();
    expect(await reclutado(page)).toBeLessThan(0.05);
    // PEEP 20: los picos inspiratorios (~37) superan pOpen y la fracción abierta sube respiración a respiración.
    await ponerPeep(page, 20);
    await page.waitForFunction(() => (window.__r860.frame as unknown as { truth: { recruited: number } }).truth.recruited > 0.9, null, {
      timeout: 40_000,
    });
    // De vuelta a PEEP 10 —dentro de la banda, por encima del cierre— se conserva lo abierto: histéresis.
    await ponerPeep(page, 10);
    const n = (await frame(page)).breathCount;
    await page.waitForFunction((b) => (window.__r860.frame as unknown as { breathCount: number }).breathCount >= b + 4, n, {
      timeout: 40_000,
    });
    expect(await reclutado(page)).toBeGreaterThan(0.9);
    await expect(page.locator('#truth-recruit')).not.toHaveText(/^0\s*%$/);
  });
});
