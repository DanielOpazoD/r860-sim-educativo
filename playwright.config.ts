import { defineConfig, devices } from '@playwright/test';

// E2E_PORT deja correr la e2e en varios worktrees o sesiones a la vez. El mismo puerto va al servidor y a baseURL; los
// workers vuelven a evaluar este archivo con el mismo entorno, así que coinciden. Sin reuseExistingServer, un puerto
// ocupado hace fallar la corrida en vez de probar contra el servidor de otra copia.
const port = Number(process.env.E2E_PORT) || 4173;
const baseURL = `http://127.0.0.1:${port}`;

// Capturas con viewport, hora y semilla fijas (VIS-03). El servidor es `vite preview` sobre el build.
export default defineConfig({
  testDir: 'tests/e2e',
  // Playwright vacía su carpeta de salida al arrancar: la suya es una subcarpeta, para que no borre la salida de Vitest
  // (test-results/vitest.json, escrita por `npm run test:coverage`) que después leen results:doc y docs:facts.
  outputDir: 'test-results/e2e',
  timeout: 60_000,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  // Regresión visual (VR-01): referencias por plataforma, porque macOS y el Linux del CI dibujan distinto las fuentes.
  snapshotPathTemplate: '{testDir}/capturas/{platform}/{projectName}/{arg}{ext}',
  use: {
    baseURL,
    timezoneId: 'America/Santiago',
    locale: 'es-CL',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'desktop-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
