# R860 Lab · simulador educativo (motor propio)

Simulador web de entrenamiento en ventilación mecánica inspirado en la interfaz del GE HealthCare CARESCAPE R860. **Simulación educativa, no uso clínico**: no controla equipos, no reproduce firmware y no cuenta con aval del fabricante. Los valores de las fotografías y de los bancos no son ajustes clínicos sugeridos. Versión 0.3.x (`package.json`).

- **Motor**: determinista, en Web Worker, paso fijo de 4 ms con sub-pasos exactos en eventos; pulmón lineal de un compartimento con volumen absoluto continuo; A/C VC y A/C PC adulto con Plimit/Pmáx, rampa de presión y tope de flujo del actuador; bloqueos con resultado fechado y calidad, espera, alarmas con estados separados, ↑O₂ con restauración idempotente, replay reproducible. 99 pruebas Vitest (banco BM-01…08 y PC, físicas, alarmas, procedimientos, sesión, fronteras, regresiones de tres revisiones adversariales) y 25 pruebas Playwright × 3 proyectos (75 ejecuciones; la móvil sólo en Pixel 7).
- **Interfaz (v0.3)**: sistema visual y de interacción derivado de **R860 Lab v1.1** (código MIT, ver `LICENSES/R860-LAB-MIT.txt`): carcasa con bisel, curvas con degradado, iconos vectoriales, editor de ajuste emergente con vista previa y deslizador que sólo recorre valores admitidos, panel de bloqueo, vistas de datos grandes (como P3), bucles P-V/F-V con referencia, tabla de mediciones con calidad y origen, tendencias, registro de eventos, congelar curvas, panel docente con pestañas (Paciente · Entrenar · Eventos), escenarios con objetivos, sesión JSON/CSV/PNG. La marca de simulación es discreta (franja inferior, firma del bisel, encabezado de diálogos y marca de agua de capturas).
- **Evidencia**: cada regla lleva marca D (documentado) / O (observado) / P (propuesto) / U (no resuelto) en `src/profiles/r860-es-photo-reference/evidence.json` y `gaps.json`.

## Ejecutar

Requisitos: Node ≥ 20 (probado con Node 24.14, npm 11).

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

```bash
npm run check          # oxlint + Prettier + tsc + Vitest
npm run test:coverage  # Vitest con cobertura v8 y umbrales (vitest.config.ts)
npm run build          # bundle en dist/
npx playwright install chromium   # una vez
npm run e2e            # Playwright: 1440×1000, 1280×900, Pixel 7
npm run results:doc    # regenera docs/01-resultados.md desde las salidas JSON reales
```

CI (GitHub Actions, `.github/workflows/ci.yml`) ejecuta lint, formato, tipos, Vitest con cobertura, build y Playwright, y publica `coverage/coverage-summary.json` y los JSON de `test-results/`.

**Cobertura honesta.** Los umbrales de `vitest.config.ts` se midieron el 06-09-2026 y se fijaron dos puntos por debajo del valor medido, redondeado hacia abajo, para que CI falle ante una regresión y pase hoy. Sobre todo `src/` (excluidos `workers/` y `fixtures/`): líneas 38,7 % · ramas 33,1 % · funciones 32,7 % · sentencias 37,4 % (umbrales 36 · 31 · 30 · 35). La cifra es baja porque `src/ui/app.ts`, `src/render/plots.ts` y el resto de la capa de interfaz sólo los ejercita Playwright y aquí figuran con 0 %; excluyendo esa capa (`src/ui/**`, `src/render/**`, `main.ts`) la cobertura medida es líneas 87,8 % · ramas 76,0 % · funciones 82,8 % · sentencias 83,4 %. Ninguna de las dos cifras se presenta como fidelidad frente al equipo.

Capturas de validación con metadatos (viewport, hora, semilla, tiempo simulado) en `test-results/screenshots/` y copia en `docs/capturas/`.

## Parámetros de URL

`?scenario=SC-01` (SC-01…SC-13, SC-13 en presión control; SC-P referencia fotográfica) · `fixture=P1|P3` (transcripción de foto, sin motor) · `t0=2026-08-18T21:04:05-04:00` · `seed=1` · `dt=4` · `speed=2` · `paused=1` · `autopause=12000` · `view=waves|basic|loops|data|trends|log` · `instructor=0` · `inline=1` · `editTimeout=1500` (sólo pruebas).

## Atajos

Espacio pausa · C congela curvas · F captura PNG · A alarmas · H vista principal · ? guía · ↑/↓ ajustan el parámetro seleccionado · Enter confirma · Esc cancela · rueda sobre la perilla ajusta · el deslizador del editor recorre sólo valores admitidos.

## Estructura

```
src/domain      unidades, tipos, reglas de ajuste, validación, comandos, consistencia
src/engine      paciente, esfuerzo, reloj, controlador VC/PC, sensores, métricas, alarmas, procedimientos, simulador
src/app         protocolo Worker↔UI, anfitrión del motor, cliente, máquina de estados de edición
src/workers     engine.worker.ts
src/render      plots.ts: curvas, bucles, manómetro, tendencias, esfuerzo (estilo R860 Lab)
src/ui          app.ts (composición y diálogos), lesson.ts (panel docente), exports.ts (JSON/CSV/PNG), metricsTable.ts, patientControls.ts,
                dom.ts, format.ts, humanize.ts, audio.ts, help.ts (ayudas MIT R860 Lab), styles.css (MIT R860 Lab)
src/profiles    perfil (modos habilitados), reglas con evidencia, evidence.json, gaps.json
src/fixtures    transcripciones P1/P3        src/scenarios  escenarios sintéticos con objetivos
src/history     exportación, importación validada, replay
tests/bench  BM-01…BM-08, PC   tests/unit  unidades, física, alarmas, procedimientos, sesión, fronteras, UI, seguridad, regresiones   tests/e2e  Playwright
docs         primera entrega, resultados (generado), diferencias frente al dossier, fisiología de las curvas, capturas
LICENSES     licencia MIT del código de R860 Lab reutilizado
```

Herramientas: TypeScript 7 (nativo), Vite 8, Vitest 5 (+ `@vitest/coverage-v8`, fast-check), Playwright 1.63, oxlint (`.oxlintrc.json`), Prettier (`.prettierrc.json`).

## Límites

Modelo mecánico lineal adulto; sin intercambio gaseoso, fuga, circuito ni tubo. A/C VC y A/C PC habilitados (`PROFILE.enabledModes`; CPAP/PS tras sus pruebas de banco); fisiología de las curvas y su verificación en `docs/03-fisiologia-curvas.md`. Sin pacientes reales, sin WebUSB/WebSerial/Bluetooth, sin extracción de firmware, sin afirmación de aval GE. Las denominaciones GE HealthCare, CARESCAPE y R860 identifican el equipo de referencia.
