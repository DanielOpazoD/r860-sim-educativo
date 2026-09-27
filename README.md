# R860 Lab · simulador educativo (motor propio)

Simulador web de entrenamiento en ventilación mecánica inspirado en la interfaz del GE HealthCare CARESCAPE R860. **Simulación educativa, no uso clínico**: no controla equipos, no reproduce firmware y no cuenta con aval del fabricante. Los valores de las fotografías y de los bancos no son ajustes clínicos sugeridos. <!-- hechos:version -->Versión 0.3.0 del paquete, motor 0.4.0<!-- /hechos:version -->.

- **Motor**: determinista, en Web Worker, paso fijo de 4 ms con sub-pasos exactos en eventos; pulmón con volumen absoluto continuo: un compartimento lineal por omisión y, como opciones del escenario, relajación viscoelástica, curva P-V sigmoidea, resistencia de Rohrer, limitación al flujo espiratorio y una segunda unidad alveolar en paralelo; A/C VC, A/C PC y CPAP/PS adulto con Plimit/Pmáx, rampa de presión, tope de flujo del actuador, ciclado por flujo, frecuencia mínima y respaldo por apnea; bloqueos con resultado fechado y calidad, espera, alarmas con estados separados, ↑O₂ con restauración idempotente, replay reproducible. Banco BM-01…08 y PC, físicas, alarmas, procedimientos, sesión, fronteras y regresiones de cuatro revisiones adversariales: <!-- hechos:pruebas -->395 pruebas Vitest y 54 pruebas Playwright × 3 proyectos (155 ejecuciones, 7 omitidas por diseño: la prueba móvil sólo corre en el proyecto móvil)<!-- /hechos:pruebas -->.
- **Interfaz (v0.3)**: sistema visual y de interacción derivado de **R860 Lab v1.1** (código MIT, ver `LICENSES/R860-LAB-MIT.txt`): carcasa con bisel, curvas con degradado, iconos vectoriales, editor de ajuste emergente con vista previa y deslizador que sólo recorre valores admitidos, panel de bloqueo, vistas de datos grandes (como P3), bucles P-V/F-V con referencia, tabla de mediciones con calidad y origen, columna numérica con alternador de 6 casillas grandes (como en el equipo) o las 13 completas, tendencias, registro de eventos, congelar curvas, panel docente con pestañas (Paciente · Entrenar · Eventos), escenarios con objetivos, sesión JSON/CSV/PNG. La marca de simulación es discreta (franja inferior, firma del bisel, encabezado de diálogos y marca de agua de capturas).
- **Evidencia**: cada regla lleva marca D (documentado) / O (observado) / P (propuesto) / U (no resuelto) en `src/profiles/r860-es-photo-reference/evidence.json` y `gaps.json`.

## Ejecutar

Requisitos: Node ≥ 20 (probado con Node 24.14, npm 11).

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

```bash
npm run check          # puerta rápida: oxlint + fronteras de capas + Prettier + tsc + Vitest (sin cobertura)
npm run test:coverage  # Vitest con cobertura v8 y umbrales (vitest.config.ts)
npm run build          # bundle en dist/
npx playwright install chromium   # una vez
npm run e2e            # Playwright: 1440×1000, 1280×900, Pixel 7
npm run results:doc    # regenera docs/01-resultados.md desde las salidas JSON reales
npm run docs:facts     # sincroniza los números de README y docs/ con los artefactos reales
```

CI (GitHub Actions, `.github/workflows/ci.yml`) ejecuta lint, fronteras de capas, formato, tipos, Vitest con cobertura, build y Playwright; después comprueba que los números de esta documentación coincidan con los artefactos recién producidos (`npm run docs:facts -- --check`) y publica `coverage/coverage-summary.json` y los JSON de `test-results/`.

<!-- hechos:cobertura -->**Cobertura honesta.** Medida sobre todo `src/` (excluidos `src/workers/**`, `src/fixtures/**`): líneas 49,9 % · ramas 46,8 % · funciones 45,6 % · sentencias 49,0 %. Los umbrales de `vitest.config.ts` (45 · 41 · 40 · 44) van por debajo de lo medido para que la integración continua falle ante una regresión y pase hoy. La cifra global es baja porque los 32 archivos de `src/ui/`, `src/render/` y `main.ts` sólo los ejercita Playwright y aquí figuran con 0 %; excluyendo esa capa la cobertura es líneas 92,7 % · ramas 83,6 % · funciones 89,5 % · sentencias 89,1 %. Ninguna de las dos cifras se presenta como fidelidad frente al equipo: miden qué parte del código ejecuta la suite, no cuánto se parece el simulador a un R860.<!-- /hechos:cobertura -->

Capturas de validación con metadatos (viewport, hora, semilla, tiempo simulado) en `test-results/screenshots/` y copia en `docs/capturas/`.

## Parámetros de URL

`?scenario=SC-01` (<!-- hechos:escenarios -->SC-01…SC-23 (19 escenarios de enseñanza; la numeración salta los no implementados) y SC-P de referencia fotográfica<!-- /hechos:escenarios -->) · `fixture=P1|P3` (transcripción de foto, sin motor) · `t0=2026-08-18T21:04:05-04:00` · `seed=1` · `dt=4` · `speed=2` · `paused=1` · `autopause=12000` · `view=waves|basic|loops|data|trends|log` · `instructor=0` · `inline=1` · `editTimeout=1500` (sólo pruebas).

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
docs         primera entrega, resultados (generado), diferencias frente al dossier, fisiología de las curvas,
             arquitectura y módulos, capturas
LICENSES     licencia MIT del código de R860 Lab reutilizado
```

Herramientas: TypeScript 7 (nativo), Vite 8, Vitest 5 (+ `@vitest/coverage-v8`, fast-check), Playwright 1.63, oxlint (`.oxlintrc.json`), Prettier (`.prettierrc.json`).

## Documentación

Cinco documentos, cada uno con una pregunta distinta. Los tres primeros se leen en ese orden si es la primera vez.

| Documento | Responde a | Cómo se mantiene |
| --- | --- | --- |
| `docs/00-primera-entrega.md` | Qué se propuso construir y con qué evidencia, al empezar | Instantánea fechada; no se actualiza |
| `docs/04-arquitectura.md` | Cómo está organizado el código y por qué así | A mano |
| `docs/03-fisiologia-curvas.md` | Qué debe verse en cada curva y de qué ecuación sale | A mano, con cada afirmación anclada a una prueba con nombre |
| `docs/02-diferencias-frente-al-dossier.md` | En qué se apartó del plan inicial, qué se corrigió y tras qué revisión | A mano, por versiones, incluidos los errores propios |
| `docs/01-resultados.md` | Qué pruebas existen hoy y cuál fue su resultado | Generado por `npm run results:doc` |

Los números que aparecen dentro de la prosa (cobertura, recuentos, escenarios, modos) no se escriben a mano: los inyecta `npm run docs:facts` desde los artefactos reales y la integración continua falla si se desvían. El reparto entre lo generado y lo escrito está en `docs/04-arquitectura.md` §7.

La evidencia vive aparte del texto: `src/profiles/r860-es-photo-reference/evidence.json` marca cada regla como **D** documentada, **O** observada en una fotografía, **P** propuesta o **U** no resuelta, y `gaps.json` guarda las preguntas abiertas y las funciones desactivadas con su motivo.

## Límites

Mecánica adulta de uno o dos compartimentos, sin intercambio gaseoso, con fuga lineal en la pieza en Y (sin compensación), con compliance del circuito opcional (0 por omisión; sin inertancia) y sin tubo: el modelo describe el sistema respiratorio, no la máquina ni el paciente completo. Por omisión el pulmón es lineal; la relajación viscoelástica, la curva sigmoidea, la resistencia de Rohrer, la limitación al flujo espiratorio y la segunda unidad son opciones que activa el escenario, no el comportamiento por defecto. Modos habilitados <!-- hechos:modos -->A/C VC y A/C PC y CPAP/PS<!-- /hechos:modos --> (`PROFILE.enabledModes`; CPAP/PS tras sus pruebas de banco); fisiología de las curvas y su verificación en `docs/03-fisiologia-curvas.md`. Sin pacientes reales, sin WebUSB/WebSerial/Bluetooth, sin extracción de firmware, sin afirmación de aval GE. Las denominaciones GE HealthCare, CARESCAPE y R860 identifican el equipo de referencia.
