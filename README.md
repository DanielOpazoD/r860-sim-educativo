# R860 Lab · simulador educativo (motor propio)

Simulador web de entrenamiento en ventilación mecánica inspirado en la interfaz del GE HealthCare CARESCAPE R860. **Simulación educativa, no uso clínico**: no controla equipos, no reproduce firmware y no cuenta con aval del fabricante. Los valores de las fotografías y de los bancos no son ajustes clínicos sugeridos.

- **Motor**: determinista, en Web Worker, paso fijo de 4 ms con sub-pasos exactos en eventos; pulmón lineal de un compartimento con volumen absoluto continuo; A/C VC adulto con Plimit/Pmáx, bloqueos con resultado fechado y calidad, espera, alarmas con estados separados, ↑O₂ con restauración idempotente, replay reproducible. 66 pruebas Vitest (banco BM-01…08, físicas, alarmas, procedimientos, sesión, regresiones de revisión adversarial).
- **Interfaz (v0.2)**: sistema visual y de interacción derivado de **R860 Lab v1.1** (código MIT, ver `LICENSES/R860-LAB-MIT.txt`): carcasa con bisel, curvas con degradado, iconos vectoriales, editor de ajuste emergente con vista previa, panel de bloqueo, vistas de datos grandes, bucles P-V/F-V con referencia, tabla de mediciones con calidad y origen, tendencias, registro de eventos, congelar curvas, panel docente con pestañas (Paciente · Entrenar · Eventos), escenarios con objetivos, sesión JSON/CSV/PNG. La marca de simulación es discreta (franja inferior, firma del bisel, encabezado de diálogos y marca de agua de capturas).
- **Evidencia**: cada regla lleva marca D (documentado) / O (observado) / P (propuesto) / U (no resuelto) en `src/profiles/r860-es-photo-reference/evidence.json` y `gaps.json`.

## Ejecutar

Requisitos: Node ≥ 20 (probado con Node 24.14, npm 11).

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

```bash
npm run check      # oxlint + Prettier + tsc + Vitest
npm run test:coverage
npm run build      # bundle en dist/
npx playwright install chromium   # una vez
npm run e2e        # Playwright: 1440×1000, 1280×900, Pixel 7
```

Capturas de validación con metadatos (viewport, hora, semilla, tiempo simulado) en `test-results/screenshots/` y copia en `docs/capturas/`.

## Parámetros de URL

`?scenario=SC-01` (SC-01…SC-13, SC-13 en presión control; SC-P referencia fotográfica) · `fixture=P1|P3` (transcripción de foto, sin motor) · `t0=2026-08-18T21:04:05-04:00` · `seed=1` · `dt=4` · `speed=2` · `paused=1` · `autopause=12000` · `view=waves|basic|loops|data|trends|log` · `instructor=0` · `inline=1` · `editTimeout=1500` (sólo pruebas).

## Atajos

Espacio pausa · C congela curvas · F captura PNG · A alarmas · H vista principal · ? guía · ↑/↓ ajustan el parámetro seleccionado · Enter confirma · Esc cancela · rueda sobre la perilla ajusta · el deslizador del editor recorre sólo valores admitidos.

## Estructura

```
src/domain      unidades, tipos, reglas de ajuste, validación, comandos, consistencia
src/engine      paciente, esfuerzo, reloj, controlador VC, sensores, métricas, alarmas, procedimientos, simulador
src/app         protocolo Worker↔UI, anfitrión del motor, cliente, máquina de estados de edición
src/workers     engine.worker.ts
src/render      plots.ts: curvas, bucles, manómetro, tendencias, esfuerzo (estilo R860 Lab)
src/ui          app.ts (interfaz), styles.css (MIT R860 Lab), help.ts (ayudas MIT R860 Lab), audio.ts
src/profiles    perfil, reglas con evidencia, evidence.json, gaps.json
src/fixtures    transcripciones P1/P3        src/scenarios  escenarios sintéticos con objetivos
src/history     exportación, importación validada, replay
tests/bench  BM-01…BM-08   tests/unit  unidades, física, alarmas, procedimientos, sesión, UI, seguridad, regresiones   tests/e2e  Playwright
docs         primera entrega, resultados, diferencias frente al dossier, capturas
LICENSES     licencia MIT del código de R860 Lab reutilizado
```

## Límites

Modelo mecánico lineal adulto; sin intercambio gaseoso, fuga, circuito ni tubo. A/C VC y A/C PC habilitados (CPAP/PS tras sus pruebas de banco); fisiología de las curvas y su verificación en `docs/03-fisiologia-curvas.md`. Sin pacientes reales, sin WebUSB/WebSerial/Bluetooth, sin extracción de firmware, sin afirmación de aval GE. Las denominaciones GE HealthCare, CARESCAPE y R860 identifican el equipo de referencia.
