import { expect, test } from '@playwright/test';
import { frame, open } from './helpers';

type FrameLike = {
  settings: { mode: string; psupport: number };
  metrics: { ppeak?: { value: number | null }; rrSpont?: { value: number | null }; vte?: { value: number | null } };
  alarms: { id: string; conditionActive: boolean }[];
  eventsTail: { kind: string; payload: { type?: string; cause?: string } }[];
};
const respiraciones = (f: FrameLike): { type?: string; cause?: string }[] =>
  f.eventsTail.filter((e) => e.kind === 'breath').map((e) => e.payload);

// CPAP/PS en la interfaz: se elige en el menú de modos, tiene sus teclas y su bloque de respaldo, y el paciente manda.
test.describe('CPAP/PS', () => {
  test('cambiar a CPAP/PS desde el menú de modos: bloque de respaldo, teclas rápidas y respiraciones espontáneas', async ({ page }) => {
    // SC-18 tiene un esfuerzo fuerte (Pmus 12 a 12/min): al pasar a CPAP/PS el paciente dispara y el soporte lo lleva.
    await open(page, { scenario: 'SC-18', speed: 4 });
    await page.locator('[data-action="modes"]').first().click();
    await page.click('.mode-option[data-mode="CPAP_PS"]');
    await expect(page.locator('#mode-fields')).toContainText('Presión de soporte sobre CPAP');
    await expect(page.locator('#mode-fields')).toContainText('Respaldo');
    await expect(page.locator('#mode-timing')).toContainText('apnea a los 20 s');
    await page.click('[data-action="confirmModes"]');
    await expect(page.locator('#scenario-sub')).toContainText('CPAP/PS');
    await expect.poll(async () => (await frame(page)).settings.mode).toBe('CPAP_PS');
    expect(await page.$$eval('#quick-controls [data-key]', (e) => e.map((x) => (x as HTMLElement).dataset.key))).toEqual([
      'fio2',
      'psupport',
      'peep',
      'expTriggerPct',
      'minRate',
      'pmax',
    ]);
    await expect(page.locator('[data-quick-val="minRate"]')).toHaveText('Off');
    await expect(page.locator('[data-quick-val="expTriggerPct"]')).toHaveText('25');
    // El paciente dispara y el soporte cicla por flujo: espontáneas a PEEP + PS.
    await expect
      .poll(async () => respiraciones((await frame(page)) as unknown as FrameLike).filter((b) => b.type === 'spontaneous').length, {
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(3);
    const f = (await frame(page)) as unknown as FrameLike;
    const espontaneas = respiraciones(f).filter((b) => b.type === 'spontaneous');
    expect(espontaneas.length).toBeGreaterThanOrEqual(3);
    expect(espontaneas.every((b) => b.cause === 'flow')).toBe(true);
    expect(f.metrics.ppeak?.value ?? 0).toBeCloseTo(15, 0); // PEEP 5 + PS 10, con independencia del esfuerzo
    await expect(page.locator('#phase-status')).toContainText(/Inspiración · soporte|Espiración/);
  });

  test('SC-19: apnea provocada → alarma alta y respaldo; al deshacerla el paciente vuelve y la alarma se resuelve', async ({ page }) => {
    await open(page, { scenario: 'SC-19', speed: 4 });
    await expect(page.locator('#quick-mode')).toHaveText('CPAP/PS');
    await expect(page.locator('[data-instructor="learn"]')).toHaveText(/Entrenar · [01]\/3/);
    await expect.poll(async () => (await frame(page)).metrics.rrSpont?.value ?? 0, { timeout: 30_000 }).toBeGreaterThan(10);
    // Apnea desde el panel docente: el esfuerzo se apaga; a los 20 s de tiempo simulado, alarma y respaldo.
    await page.click('[data-instructor="events"]');
    await page.click('[data-event="apnea"]');
    await expect(page.locator('#alarm-label')).toHaveText('Prioridad alta · Apnea', { timeout: 30_000 });
    await expect(page.locator('#alarm-band')).toHaveClass(/high/);
    await expect
      .poll(async () => respiraciones((await frame(page)) as unknown as FrameLike).filter((b) => b.type === 'backup').length, {
        timeout: 20_000,
      })
      .toBeGreaterThanOrEqual(1);
    // Deshacer: el esfuerzo vuelve, la primera espontánea resuelve la apnea (queda gris hasta reconocer).
    await page.click('[data-action="undoEvent"]');
    await expect
      .poll(async () => (await frame(page)).alarms.find((a) => a.id === 'apnea')?.conditionActive, { timeout: 30_000 })
      .toBe(false);
    await expect(page.locator('#alarm-label')).toHaveText('Alarmas resueltas');
    await expect(page.locator('[data-instructor="learn"]')).toHaveText('Entrenar · 2/3', { timeout: 15_000 });
  });
});
