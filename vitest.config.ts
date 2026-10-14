import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Cobertura honesta: sólo lo que ejercitan Vitest (unidad + banco); buena parte de `src/ui` y `src/render` sólo la
// ejercita Playwright, que no suma aquí. Los umbrales son un trinquete: dos puntos por debajo de lo medido (redondeado
// hacia abajo), para que el CI falle ante una regresión y no ante el ruido entre macOS y Linux (≈ 0,3 puntos). El núcleo
// físico —motor y dominio— lleva su propio umbral, más alto: una prueba de física que se pierde no se diluye en el total.
// Cuando la cobertura suba, se suben con ella; no se bajan para hacer pasar un cambio.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/workers/**', 'src/fixtures/**'],
        reporter: ['text', 'json-summary', 'html'],
        // Medido el 14-10-2026: total 72,9 · 64,1 · 69,9 · 70,8; motor 97,5 · 90,0 · 96,1 · 95,0; dominio 90,9 · 87,8 ·
        // 79,2 · 86,1 (líneas · ramas · funciones · sentencias). La cifra vigente la publica el README desde
        // `coverage/coverage-summary.json` con `npm run docs:facts`; aquí sólo van los suelos.
        thresholds: {
          lines: 70,
          branches: 62,
          functions: 67,
          statements: 68,
          'src/engine/**': { lines: 95, branches: 88, functions: 94, statements: 93 },
          'src/domain/**': { lines: 88, branches: 85, functions: 77, statements: 84 },
        },
      },
    },
  }),
);
