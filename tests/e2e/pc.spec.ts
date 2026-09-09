import { expect, test } from '@playwright/test';
import { frame, open } from './helpers';

// Modo A/C PC, edición libre con el deslizador (sólo valores admitidos), equivalencia ± / deslizador / rueda, y retroalimentación de bloqueos.
test.describe('A/C PC y edición', () => {
  test('cambiar a A/C PC desde el menú de modos: teclas rápidas, curvas y VT esperado', async ({ page }) => {
    await open(page, { speed: 4 });
    await page.locator('[data-action="modes"]').first().click();
    await page.click('.mode-option[data-mode="AC_PC"]');
    await expect(page.locator('#mode-fields')).toContainText('controlado por presión');
    await page.click('[data-action="confirmModes"]');
    await expect(page.locator('#scenario-sub')).toContainText('A/C PC');
    await expect.poll(async () => (await frame(page)).settings.mode).toBe('AC_PC');
    await expect(page.locator('#quick-controls [data-key]')).toHaveCount(6); // PC: sin Plimit
    expect(await page.$$eval('#quick-controls [data-key]', (e) => e.map((x) => (x as HTMLElement).dataset.key))).toEqual([
      'fio2',
      'pinsp',
      'rr',
      'ie',
      'peep',
      'pmax',
    ]);
    await expect.poll(async () => (await frame(page)).metrics.ppeak?.value ?? 0, { timeout: 15_000 }).toBeCloseTo(15, 0); // PEEP 5 + Pinsp 10
    // BM-03 en el motor: C 50 mL/cmH2O · Pinsp 10 · Ti 1 s → VT ≈ 432 mL (1 − e^−2)
    await expect.poll(async () => (await frame(page)).metrics.vte?.value ?? 0, { timeout: 15_000 }).toBeGreaterThan(0.4);
    expect((await frame(page)).metrics.vte?.value ?? 1).toBeLessThan(0.45);
  });

  test('deslizador recorre sólo valores admitidos; ± y deslizador coinciden; escritura fuera de rejilla sugiere el más cercano', async ({
    page,
  }) => {
    await open(page, { speed: 4 });
    await page.click('[data-setting-quick="vt"]');
    const range = page.locator('#quick-range');
    await expect(range).toBeEnabled();
    expect(await range.getAttribute('step')).toBe('1');
    const start = Number(await range.inputValue());
    await page.click('[data-action="editPlus"]');
    await page.click('[data-action="editPlus"]');
    expect(Number(await range.inputValue())).toBe(start + 2);
    await expect.poll(() => page.evaluate(() => window.__r860.edit.draftDisplay)).toBe(550);
    // El deslizador por índice produce exactamente el mismo escalón que dos «−».
    await range.evaluate((e: HTMLInputElement, v) => {
      e.value = String(v);
      e.dispatchEvent(new Event('input', { bubbles: true }));
    }, start);
    await expect.poll(() => page.evaluate(() => window.__r860.edit.draftDisplay)).toBe(500);
    // Arrastrar a un extremo nunca sale de la rejilla ni del dominio.
    await range.evaluate((e: HTMLInputElement) => {
      e.value = e.max;
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect.poll(() => page.evaluate(() => window.__r860.edit.draftDisplay)).toBe(2000);
    await expect(page.locator('#quick-validation')).toBeHidden();
    await page.fill('#quick-value', '287');
    await expect(page.locator('#quick-validation')).toContainText('no es un valor admitido');
    await expect(page.locator('#quick-validation')).toContainText('285');
    await page.fill('#quick-value', '600');
    await page.click('[data-action="knob"]');
    await expect.poll(async () => (await frame(page)).settings.vt, { timeout: 15_000 }).toBe(0.6);
  });

  test('PEEP: el primer paso del deslizador es Off, no 0', async ({ page }) => {
    await open(page, { speed: 4 });
    await page.click('[data-setting-quick="peep"]');
    const range = page.locator('#quick-range');
    await range.evaluate((e: HTMLInputElement) => {
      e.value = '0';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect.poll(() => page.evaluate(() => window.__r860.edit.draftDisplay)).toBe('off');
    await range.evaluate((e: HTMLInputElement) => {
      e.value = '1';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect.poll(() => page.evaluate(() => window.__r860.edit.draftDisplay)).toBe(1);
  });

  test('bloqueo inspiratorio rechazado por Pmáx: resultado no válido con motivo legible y aviso', async ({ page }) => {
    await open(page, { scenario: 'SC-09', speed: 4 });
    await expect.poll(async () => (await frame(page)).simTimeMs, { timeout: 20_000 }).toBeGreaterThan(14_000);
    await page.click('[data-action="inspiratory"]');
    await page.click('#hold-run');
    await expect.poll(async () => (await frame(page)).procedure.last.inspHold?.quality ?? null, { timeout: 20_000 }).toBe('invalid');
    await expect(page.locator('#hold-status')).toContainText('No válida');
    await expect(page.locator('#hold-status')).not.toContainText('pmaxEndedInspiration');
    await expect(page.locator('.toast.warn').last()).toContainText('Bloqueo no válido');
  });

  test('▶ es idempotente mientras hay solicitud; «Cancelar» la anula y se anuncia', async ({ page }) => {
    await open(page, { speed: 0.25 }); // a un cuarto de velocidad la solicitud sigue en cola cuando se pulsa por segunda vez
    await page.click('[data-action="expiratory"]');
    await page.click('#hold-run');
    await expect.poll(async () => (await frame(page)).procedure.hold).not.toBeNull();
    await page.locator('#hold-run').dispatchEvent('click'); // doble pulsación: no cancela ni duplica
    await page.waitForTimeout(150);
    expect(((await frame(page)).procedure.hold as { procedureId?: string } | null)?.procedureId).toBe('p1');
    await expect(page.locator('#hold-cancel')).toBeVisible();
    await page.click('#hold-cancel');
    await expect(page.locator('.toast').last()).toContainText(/cancelad/);
    await expect.poll(async () => (await frame(page)).procedure.hold).toBeNull();
  });

  test('Escape cierra primero el diálogo y el reloj del monitor muestra la hora del día', async ({ page }) => {
    await open(page);
    await expect(page.locator('#monitor-clock')).toHaveText(/^21:0\d$/);
    await page.click('[data-action="alarms"]');
    await expect(page.locator('#app-dialog')).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('#app-dialog')).not.toHaveAttribute('open', '');
  });

  test('menú de modo: flujo de base y disparo por presión; el disparo por flujo no puede superar el flujo de base', async ({ page }) => {
    await open(page, { speed: 4 });
    await page.locator('[data-action="modes"]').first().click();
    await expect(page.locator('[data-mode-field="biasFlow"]')).toHaveValue('2');
    await expect(page.locator('[data-mode-field="pressureTrigger"]')).toHaveValue('-2');
    await page.fill('[data-mode-field="flowTrigger"]', '5');
    await page.dispatchEvent('[data-mode-field="flowTrigger"]', 'input');
    await expect(page.locator('#mode-error')).toContainText('flujo de base');
    await page.fill('[data-mode-field="biasFlow"]', '6');
    await page.dispatchEvent('[data-mode-field="biasFlow"]', 'input');
    await expect(page.locator('#mode-error')).not.toContainText('flujo de base');
    await page.locator('[data-mode-field="triggerByPressure"]').dispatchEvent('click');
    await page.click('[data-action="confirmModes"]');
    await expect.poll(async () => (await frame(page)).settings.triggerByPressure).toBe(true);
    expect((await frame(page)).settings.biasFlow).toBeCloseTo(0.1, 6);
  });
});

test.describe('Alarmas configuradas desde el diálogo', () => {
  test('VTesp bajo y FR alta configurados en el diálogo se activan mientras ventila y se reflejan en la banda', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0 });
    await page.locator('[data-action="alarmSetup"]').first().click();
    await page.fill('[data-limit="vteLow"]', '600');
    await page.dispatchEvent('[data-limit="vteLow"]', 'input');
    await page.click('[data-action="confirmLimits"]');
    await expect.poll(async () => (await frame(page)).alarmBar.color, { timeout: 20_000 }).toBe('yellow');
    await expect(page.locator('#alarm-band')).toContainText('VTesp bajo');
    await page.locator('[data-action="alarmSetup"]').first().click();
    await page.fill('[data-limit="vteLow"]', '');
    await page.dispatchEvent('[data-limit="vteLow"]', 'input');
    await page.fill('[data-limit="rrHigh"]', '10');
    await page.dispatchEvent('[data-limit="rrHigh"]', 'input');
    await page.click('[data-action="confirmLimits"]');
    await expect
      .poll(async () => (await frame(page)).alarms.find((a) => a.id === 'rrHigh')?.conditionActive ?? false, { timeout: 20_000 })
      .toBe(true);
    await expect(page.locator('#alarm-band')).toContainText('FR alta');
  });
});

test.describe('Presentación del manómetro y del volumen medido', () => {
  test('la columna de presión desciende de forma progresiva al terminar la inspiración', async ({ page }) => {
    await open(page, { speed: 1, instructor: 0 });
    await page.waitForFunction(() => window.__r860.frame?.live.phase === 'inspFlow');
    const serie = await page.evaluate(
      async () =>
        await new Promise<[number, number, string][]>((res) => {
          const out: [number, number, string][] = [];
          const t0 = performance.now();
          const step = (): void => {
            const f = window.__r860.frame!;
            out.push([f.live.paw, window.__r860.gaugePaw ?? 0, f.live.phase]);
            if (performance.now() - t0 < 2500) requestAnimationFrame(step);
            else res(out);
          };
          requestAnimationFrame(step);
        }),
    );
    const i = serie.findIndex((s) => s[2] === 'exp');
    expect(i).toBeGreaterThan(0);
    const senal = serie.slice(i, i + 12).map((s) => s[0]);
    const bajada = serie.slice(i, i + 12).map((s) => s[1]);
    // La señal pierde de golpe lo resistivo (Ppico → presión alveolar) y luego baja con la válvula abriéndose.
    // La afirmación es que hay un descenso con valores intermedios, no un salto a PEEP. Dónde caiga exactamente el
    // primer fotograma tras el cambio de fase depende de la carga de la máquina: pedirle 8 cmH2O hacía fallar la
    // prueba cuando el navegador se saltaba un fotograma y llegaba con la caída ya empezada.
    expect(senal[0]).toBeLessThan(serie[i - 1]![0] - 3);
    expect(senal[0], 'todavía por encima de PEEP').toBeGreaterThan(5.5);
    expect(new Set(senal.map((v) => Math.round(v))).size, 'la bajada pasa por valores intermedios').toBeGreaterThan(1);
    expect(senal.at(-1)).toBeLessThan(6); // en menos de 200 ms ya está en PEEP
    // La columna sigue esa bajada amortiguada, escalón a escalón.
    expect(bajada[0]).toBeGreaterThan(12);
    expect(bajada.at(-1)).toBeLessThan(bajada[0]!);
    for (let k = 1; k < bajada.length; k++) expect(bajada[k]!).toBeLessThanOrEqual(bajada[k - 1]! + 1e-9);
    expect(new Set(bajada.map((v) => Math.round(v * 10))).size).toBeGreaterThan(3);
  });

  test('el VTesp mostrado cambia entre ciclos alrededor del volumen programado', async ({ page }) => {
    await open(page, { speed: 4, instructor: 0, autopause: 60_000 });
    await page.waitForFunction(() => (window.__r860.frame as unknown as { simTimeMs: number }).simTimeMs >= 60_000, null, {
      timeout: 60_000,
    });
    const vte = await page.evaluate(() =>
      (window.__r860.frame as unknown as { trends: { vte: number }[] }).trends.slice(-10).map((t) => Math.round(t.vte * 1000)),
    );
    expect(new Set(vte).size).toBeGreaterThan(4);
    for (const v of vte) expect(Math.abs(v - 500)).toBeLessThanOrEqual(16);
  });
});
