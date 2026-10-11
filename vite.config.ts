import { defineConfig } from 'vite';
import { ENGINE_VERSION } from './src/engine/version.ts';
import pkg from './package.json' with { type: 'json' };

if (pkg.version !== ENGINE_VERSION) throw new Error('La versión del paquete debe coincidir con ENGINE_VERSION.');

// Simulador EDUCATIVO · NO USO CLÍNICO. Sin backend, sin dependencias en tiempo de ejecución.
export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'engine-version-html',
      transformIndexHtml: (html) => html.replaceAll('%ENGINE_VERSION%', ENGINE_VERSION),
    },
  ],
  build: { target: 'es2022', sourcemap: false },
  worker: { format: 'es' },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/bench/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
    // Estas pruebas simulan minutos de ventilación paso a paso: varias tardan segundos por derecho propio. Con los 5 s
    // por omisión, agotar el plazo no señalaba ninguna regresión —sólo que la máquina estaba ocupada— y ya hizo fallar
    // la integración continua dos veces sin que nada estuviera mal. El plazo sigue existiendo para atrapar un bucle
    // infinito, que es lo único que tarda un minuto entero.
    testTimeout: 60_000,
  },
});
