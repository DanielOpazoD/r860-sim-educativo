import { expect, test, type Page } from '@playwright/test';
import { frame, open, openPersonalization } from './helpers';

type DialogBox = { left: number; top: number; width: number; height: number };

async function openModes(page: Page): Promise<void> {
  await page.locator('[data-action="modes"]').first().click();
  await expect(page.locator('#app-dialog')).toBeVisible();
}

async function deviceDialogGeometry(
  page: Page,
): Promise<{ actual: DialogBox; expected: DialogBox; scrollWidth: number; viewportWidth: number }> {
  return page.evaluate(() => {
    const surface = document.querySelector('.monitor-body')!.getBoundingClientRect();
    const dialog = document.querySelector('#app-dialog')!.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = (viewport?.offsetTop ?? 0) + 8;
    const viewportBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 8;
    return {
      actual: { left: dialog.left, top: dialog.top, width: dialog.width, height: dialog.height },
      expected: {
        left: surface.left,
        top: Math.max(surface.top, viewportTop),
        width: surface.width,
        height: Math.max(0, Math.min(surface.bottom, viewportBottom) - Math.max(surface.top, viewportTop)),
      },
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
}

function expectGeometryToMatch(actual: DialogBox, expected: DialogBox): void {
  for (const key of ['left', 'top', 'width', 'height'] as const)
    expect(Math.abs(actual[key] - expected[key]), `${key} differs from visible monitor bounds`).toBeLessThanOrEqual(2);
}

test('device dialog follows visible monitor bounds, scrolls internally, and resets before global personalization', async ({ page }) => {
  await open(page, { instructor: 0 });
  await openModes(page);

  const initial = await deviceDialogGeometry(page);
  expectGeometryToMatch(initial.actual, initial.expected);

  for (const mode of ['AC_PC', 'CPAP_PS', 'AC_VC']) {
    await page.locator(`.mode-option[data-mode="${mode}"]`).click();
    const current = await deviceDialogGeometry(page);
    expectGeometryToMatch(current.actual, current.expected);
    for (const key of ['left', 'top', 'width', 'height'] as const)
      expect(Math.abs(current.actual[key] - initial.actual[key]), `${mode} changed dialog ${key}`).toBeLessThanOrEqual(2);
  }

  const explanation = page.locator('.mode-explanation');
  await explanation.locator('summary').click();
  await expect(page.locator('.mode-other-note')).toBeVisible();
  const content = page.locator('#dialog-content');
  await expect.poll(() => content.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await content.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  const footer = page.locator('#dialog-footer');
  await expect(footer).toBeInViewport();
  const footerBounds = await footer.boundingBox();
  const dialogBounds = await page.locator('#app-dialog').boundingBox();
  expect(footerBounds).not.toBeNull();
  expect(dialogBounds).not.toBeNull();
  expect(footerBounds!.y + footerBounds!.height).toBeLessThanOrEqual(dialogBounds!.y + dialogBounds!.height + 2);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const geometry = await deviceDialogGeometry(page);
      return ['left', 'top', 'width', 'height'].every(
        (key) => Math.abs(geometry.actual[key as keyof DialogBox] - geometry.expected[key as keyof DialogBox]) <= 2,
      );
    })
    .toBe(true);
  const mobileGeometry = await deviceDialogGeometry(page);
  expect(mobileGeometry.scrollWidth).toBeLessThanOrEqual(mobileGeometry.viewportWidth);

  await page.keyboard.press('Escape');
  await expect(page.locator('#app-dialog')).not.toHaveAttribute('open', '');
  await openPersonalization(page);
  const globalDialog = page.locator('#wave-options');
  await expect(globalDialog).toBeVisible();
  const globalGeometry = await globalDialog.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const style = (el as HTMLDialogElement).style;
    return {
      deviceDialog: el.classList.contains('device-dialog'),
      inlinePosition: [style.left, style.top, style.width, style.height],
      position: getComputedStyle(el).position,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  expect(globalGeometry.deviceDialog).toBe(false);
  expect(globalGeometry.inlinePosition).toEqual(['', '', '', '']);
  expect(globalGeometry.position).toBe('fixed');
  expect(Math.abs(globalGeometry.centerX - globalGeometry.viewportWidth / 2)).toBeLessThanOrEqual(2);
  expect(Math.abs(globalGeometry.centerY - globalGeometry.viewportHeight / 2)).toBeLessThanOrEqual(2);
});

test('resizing to 390×844 recomputes device dialog bounds without horizontal overflow', async ({ page }) => {
  await open(page, { instructor: 0 });
  await page.setViewportSize({ width: 390, height: 844 });
  await openModes(page);

  await expect
    .poll(async () => {
      const geometry = await deviceDialogGeometry(page);
      return ['left', 'top', 'width', 'height'].every(
        (key) => Math.abs(geometry.actual[key as keyof DialogBox] - geometry.expected[key as keyof DialogBox]) <= 2,
      );
    })
    .toBe(true);
  const geometry = await deviceDialogGeometry(page);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
});

test('mode edits stay draft on cancel and confirming sends only changed settings', async ({ page }) => {
  await page.addInitScript(() => {
    const target = window as unknown as { __r860ConfirmSettings: unknown[] };
    target.__r860ConfirmSettings = [];
    const prototype = Worker.prototype as unknown as { postMessage: (...args: unknown[]) => void };
    const original = prototype.postMessage;
    prototype.postMessage = function (this: Worker, ...args: unknown[]): void {
      const message = args[0] as { type?: string; cmd?: { type?: string; changes?: unknown } } | undefined;
      if (message?.type === 'command' && message.cmd?.type === 'confirmSettings') target.__r860ConfirmSettings.push(message.cmd);
      original.apply(this, args);
    };
  });
  await open(page);
  const originalVt = (await frame(page)).settings.vt;

  await openModes(page);
  const vt = page.locator('[data-mode-field="vt"]');
  await vt.fill('300');
  await vt.dispatchEvent('input');
  expect((await frame(page)).settings.vt).toBe(originalVt);
  await page.locator('#app-dialog [data-action="closeDialog"].secondary-button').click();
  expect((await frame(page)).settings.vt).toBe(originalVt);
  expect(await page.evaluate(() => (window as unknown as { __r860ConfirmSettings: unknown[] }).__r860ConfirmSettings)).toEqual([]);

  await openModes(page);
  await page.locator('[data-mode-field="vt"]').fill('325');
  await page.locator('[data-mode-field="vt"]').dispatchEvent('input');
  await page.locator('[data-action="confirmModes"]').click();
  await expect.poll(async () => (await frame(page)).settings.vt).toBe(0.325);
  expect(await page.evaluate(() => (window as unknown as { __r860ConfirmSettings: unknown[] }).__r860ConfirmSettings)).toEqual([
    { type: 'confirmSettings', changes: { vt: 0.325 } },
  ]);
});
