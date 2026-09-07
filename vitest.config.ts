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
        // Medido el 07-09-2026 (200 pruebas): líneas 44,23 · ramas 40,49 · funciones 37,44 · sentencias 43,03.
        // Los umbrales van dos puntos por debajo de lo medido; hay que reajustarlos cuando la cobertura suba.
        thresholds: { lines: 42, branches: 38, functions: 35, statements: 41 },
      },
    },
  }),
);
