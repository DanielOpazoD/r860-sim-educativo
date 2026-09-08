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
        // Los umbrales van por debajo de lo medido; hay que reajustarlos cuando la cobertura suba. La cifra medida
        // no se copia aquí a mano: la publica el README desde `coverage/coverage-summary.json` con `npm run docs:facts`.
        thresholds: { lines: 45, branches: 41, functions: 40, statements: 44 },
      },
    },
  }),
);
