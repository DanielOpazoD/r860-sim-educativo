import { defineConfig } from 'vite';

// Simulador EDUCATIVO · NO USO CLÍNICO. Sin backend, sin dependencias en tiempo de ejecución.
export default defineConfig({
  base: './',
  build: { target: 'es2022', sourcemap: true },
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
