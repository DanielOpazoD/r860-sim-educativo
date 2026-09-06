# r860-sim-educativo

**SIMULACIÓN EDUCATIVA · NO USO CLÍNICO.** Simulador web de entrenamiento inspirado visual y funcionalmente en el GE Healthcare CARESCAPE R860, construido a partir del dossier «CARESCAPE R860 · Investigación y especificación para un simulador web» (v1.0, 06-09-2026) y de cuatro documentos públicos del fabricante leídos íntegros. No controla equipos, no afirma equivalencia con firmware GE ni cuenta con aval del fabricante. Los valores de las fotografías y de los bancos no son ajustes clínicos sugeridos.

Alcance de esta etapa: **adulto · A/C VC** (seleccionar/editar/confirmar, motor lineal determinista, curvas, números, Plimit/Pmáx, bloqueos con resultado fechado, espera, alarmas básicas, ↑O2, respiración manual, panel docente, exportación/replay). Todo lo demás está desactivado con motivo visible.

## Ejecutar

Requisitos: Node ≥ 20 (probado con Node 24.14, npm 11).

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

Pruebas:

```bash
npm run check      # tsc + Vitest (banco BM-01…08, físicas, alarmas, procedimientos, sesión, validación, seguridad)
npm run build      # bundle en dist/ (motor en Worker ES)
npx playwright install chromium   # una vez
npm run e2e        # Playwright sobre `vite preview` (1440×1000, 1280×900, Pixel 7)
```

Las capturas de validación quedan en `test-results/screenshots/*.png` con un `.json` al lado (viewport, t0, semilla, tiempo simulado, versión del motor).

## Parámetros de URL (reproducibilidad)

`?fixture=P1|P3` (transcripción de foto, sin motor) · `t0=2026-08-18T21:04:05-04:00` (hora de pared inicial) · `seed=1` · `dt=4` · `speed=2` · `paused=1` · `autopause=12000` (pausa exacta en tiempo simulado) · `scenario=SC-01` · `view=basicWaves|advancedWaves` · `instructor=0` · `inline=1` (motor en la página en vez de Worker) · `editTimeout=1500` (sólo pruebas).

## Estructura

```
src/domain      unidades, tipos, reglas de ajuste, validación, comandos, comparador de consistencia
src/engine      paciente (1 compartimento), esfuerzo, reloj, controlador VC, sensores, métricas, alarmas, procedimientos, simulador
src/app         protocolo Worker↔UI, anfitrión del motor, cliente, máquina de estados de edición
src/workers     engine.worker.ts
src/render      curvas en canvas (barrido, decimación por extremos)
src/ui/r860     pantalla del equipo (HTML real para etiquetas y controles)
src/ui/instructor  panel docente (fuera del marco)
src/profiles/r860-es-photo-reference  perfil, reglas con evidencia, etiquetas, evidence.json, gaps.json
src/fixtures    transcripciones P1/P3
src/scenarios   escenarios sintéticos
src/history     exportación, importación validada, replay
tests/bench     BM-01…BM-08      tests/unit  unidades, física, alarmas, procedimientos, sesión, UI, seguridad     tests/e2e  Playwright
docs            primera entrega, resultados, diferencias frente al dossier
```

## Límites

Sin pacientes reales, sin WebUSB/WebSerial/Bluetooth, sin extracción de firmware, sin contraseñas de servicio, sin afirmación de aval GE. Las denominaciones GE Healthcare, CARESCAPE y R860 identifican el producto en el que se inspira el simulador.
