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
  },
});
