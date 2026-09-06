import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Cobertura honesta: sólo lo que ejercitan Vitest (unidad + banco). `src/ui/app.ts` y `src/render/plots.ts`
// sólo los ejercita Playwright y aquí figuran con 0 %; los umbrales se miden con `npx vitest run --coverage`
// y se fijan dos puntos por debajo del valor medido (redondeado hacia abajo) para que CI falle ante regresiones.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/workers/**', 'src/fixtures/**'],
        reporter: ['text', 'json-summary', 'html'],
        // Medido el 06-09-2026 (99 pruebas): líneas 38,68 · ramas 33,10 · funciones 32,72 · sentencias 37,42.
        thresholds: { lines: 36, branches: 31, functions: 30, statements: 35 },
      },
    },
  }),
);
