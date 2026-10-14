# Ventila Lab · simulador educativo de ventilación mecánica (motor propio)

Simulador web de entrenamiento en ventilación mecánica con la interfaz de un ventilador de UCI adulto genérico. **Simulación educativa, no uso clínico**: no controla equipos, no reproduce el firmware de ningún equipo y no cuenta con aval de ningún fabricante. Antes se llamó R860 Lab; las reglas del equipo virtual siguen trazadas a la documentación técnica pública que las originó (`evidence.json`). Los valores de las fotografías y de los bancos no son ajustes clínicos sugeridos. <!-- hechos:version -->Versión 0.4.0 del paquete, motor 0.4.0<!-- /hechos:version -->.

- **Motor**: determinista, en Web Worker, paso fijo de 4 ms con sub-pasos exactos en eventos; pulmón con volumen absoluto continuo: un compartimento lineal por omisión y, como opciones del escenario, relajación viscoelástica, curva P-V sigmoidea, resistencia de Rohrer, limitación al flujo espiratorio y una segunda unidad alveolar en paralelo; A/C VC, A/C PC y CPAP/PS adulto con Plimit/Pmáx, rampa de presión, tope de flujo del actuador, ciclado por flujo, frecuencia mínima y respaldo por apnea; bloqueos con resultado fechado y calidad, espera, alarmas con estados separados, ↑O₂ con restauración idempotente, replay reproducible; gasometría de modelo (PaCO₂ y pH desde la ventilación alveolar del pulmón, en el panel lateral y en Aula · Fundamentos, rotulada como del modelo y nunca en el monitor). Banco BM-01…08 y PC, físicas, alarmas, procedimientos, sesión, fronteras y regresiones de cuatro revisiones adversariales: <!-- hechos:pruebas -->836 pruebas Vitest y 154 pruebas Playwright × 3 proyectos (396 ejecuciones, 66 omitidas por diseño: la prueba móvil sólo corre en el proyecto móvil)<!-- /hechos:pruebas -->.
- **Interfaz (v0.3)**: sistema visual y de interacción derivado de **R860 Lab v1.1** (código MIT, ver `LICENSES/R860-LAB-MIT.txt`): carcasa con bisel, curvas con degradado, iconos vectoriales, editor de ajuste emergente con vista previa y deslizador que sólo recorre valores admitidos, panel de bloqueo, vistas de datos grandes (como P3), bucles P-V/F-V con referencia, tabla de mediciones con calidad y origen, columna numérica con alternador de 6 casillas grandes (como en el equipo) o las 13 completas, tendencias, registro de eventos, congelar curvas y una sola pantalla: panel lateral con **Paciente** (cinco perfiles rápidos con lo que los define a la vista, compliance, resistencia y esfuerzo, cuatro eventos súbitos con «Deshacer», también durante un caso; «Mecánica avanzada» y «Datos del modelo» salen al costado de la barra) y **Casos** (ocho casos clínicos: qué lograr, entrega y referencias; formato en `docs/08-casos-clinicos.md`), gasometría del modelo siempre a la vista (PaCO₂ y pH de ahora y del inicio, con su trayectoria), y bajo el equipo el espacio educativo (desarrollo del caso, Aula · Fundamentos y Reflexión). Conserva seis perfiles de paciente, modo examen en el menú «…» y sesión JSON/CSV/PNG; las prácticas guiadas antiguas quedan como datos para futuros casos. La marca de simulación es discreta (contexto del escenario, firma del bisel, encabezado de diálogos y marca de agua de capturas).
- **Evidencia**: cada regla lleva marca D (documentado) / O (observado) / P (propuesto) / U (no resuelto) en `src/profiles/adulto-referencia/evidence.json` y `gaps.json`.

## Ejecutar

Requisitos: Node ≥ 20; desarrollo e integración continua con Node 22 (`.nvmrc`), npm 10.

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

```bash
npm run check          # puerta rápida: oxlint + fronteras de capas + Prettier + tsc + Vitest (sin cobertura)
npm run test:coverage  # Vitest con cobertura v8 y umbrales (vitest.config.ts); escribe test-results/vitest.json
npm run build          # bundle en dist/
npx playwright install chromium   # una vez
npm run e2e            # Playwright: 1440×1000, 1280×900, Pixel 7
npm run results:doc    # regenera docs/01-resultados.md desde las salidas JSON de esa corrida (no repite pruebas)
npm run docs:facts     # sincroniza los números de README y docs/ con los artefactos reales
npm run ci             # todo lo anterior en el orden de la integración continua, en un solo pase
```

CI (GitHub Actions, `.github/workflows/ci.yml`) ejecuta lint, fronteras de capas, formato, tipos, Vitest con cobertura, build y Playwright; después comprueba que los números de esta documentación coincidan con los artefactos recién producidos (`npm run docs:facts -- --check`) y publica `coverage/coverage-summary.json` y los JSON de `test-results/`.

El build de producción no publica mapas de código fuente. Para depurar una copia local: `npm run build -- --sourcemap`; reconstruye con `npm run build` antes de publicar. Vite inyecta `ENGINE_VERSION` en el HTML y exige que coincida con la versión del paquete; la compatibilidad de sesiones sigue definida por `ACCEPTED_ENGINE_VERSIONS` y `SESSION_SCHEMA_VERSION`.

Aula · Fundamentos se carga al llegar a ella, bajo el equipo. Los escenarios siguen disponibles para el motor desde el inicio. Para uso sin internet, sirve la carpeta `dist/` completa con un servidor HTTP local: también deben estar disponibles los chunks bajo demanda y el Worker. No hay un service worker que garantice una recarga sin conexión de una instalación alojada remotamente.

<!-- hechos:cobertura -->**Cobertura honesta.** Medida sobre todo `src/` (excluidos `src/workers/**`, `src/fixtures/**`): líneas 73,0 % · ramas 64,4 % · funciones 70,0 % · sentencias 70,9 %. Los umbrales de `vitest.config.ts` (70 · 62 · 67 · 68; `src/engine/` 95 · 88 · 94 · 93; `src/domain/` 88 · 85 · 77 · 84) van por debajo de lo medido para que la integración continua falle ante una regresión y pase hoy. En `src/ui/`, las pruebas unitarias y DOM cubren líneas 62,1 % · ramas 50,3 % · funciones 58,9 % · sentencias 59,5 %. Playwright verifica además los flujos completos, pero no aporta a estos porcentajes. Excluyendo `src/ui/`, `src/render/` y `main.ts`, la cobertura es líneas 95,0 % · ramas 86,9 % · funciones 93,1 % · sentencias 92,1 %. Ninguna cifra se presenta como fidelidad frente al equipo: miden qué parte del código ejecuta la suite, no cuánto se parece el simulador a un equipo real.<!-- /hechos:cobertura -->

Capturas de validación con metadatos (viewport, hora, semilla, tiempo simulado) en `test-results/screenshots/` y copia en `docs/capturas/`.

## Parámetros de URL

`?scenario=SC-01` (<!-- hechos:escenarios -->SC-01…SC-25 (21 escenarios de enseñanza; la numeración salta los no implementados) y SC-P de referencia fotográfica<!-- /hechos:escenarios -->) · `fixture=P1|P3` (transcripción de foto, sin motor) · `t0=2026-08-18T21:04:05-04:00` · `seed=1` · `dt=4` · `speed=2` · `paused=1` · `autopause=12000` · `view=waves|basic|loops|data|trends|log` (`teaching` heredado lleva a Aula · Fundamentos) · `instructor=0` · `inline=1` · `editTimeout=1500` (sólo pruebas).

## Atajos

Espacio pausa · C congela curvas · F captura PNG · A alarmas · H vista principal · ? guía · ↑/↓ ajustan el parámetro seleccionado · Enter confirma · Esc cancela · rueda sobre la perilla ajusta · el deslizador del editor recorre sólo valores admitidos.

## Estructura

```
src/domain      unidades, tipos, reglas de ajuste, validación, comandos, consistencia
src/engine      paciente, esfuerzo, reloj, controlador VC/PC, sensores, métricas, alarmas, procedimientos, simulador
src/app         protocolo Worker↔UI, anfitrión del motor, cliente, máquina de estados de edición
src/workers     engine.worker.ts
src/render      plots.ts: curvas, bucles, manómetro, tendencias, esfuerzo (estilo R860 Lab)
src/ui          app.ts (composición), caseSpace.ts (casos y espacio educativo), lessonTracker.ts (historia de la sesión), teachingView.ts (Fundamentos), instructorPanel.ts (panel Paciente: perfiles, mecánica y eventos), gasView.ts (gasometría),
                dialogs.ts, lesson.ts, exports.ts (JSON/CSV/PNG), metricsTable.ts, patientControls.ts,
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

La evidencia vive aparte del texto: `src/profiles/adulto-referencia/evidence.json` marca cada regla como **D** documentada, **O** observada en una fotografía, **P** propuesta o **U** no resuelta, y `gaps.json` guarda las preguntas abiertas y las funciones desactivadas con su motivo.

## Límites

Mecánica adulta de uno o dos compartimentos, con gasometría de modelo (PaCO₂/pH) y sin oxigenación, con fuga en la pieza en Y que crece con la presión como un orificio (sin compensación), con compliance de circuito no compensada opcional (0 por omisión: el circuito verificado en el System Check; sin inertancia) y sin tubo: el modelo describe el sistema respiratorio, no la máquina ni el paciente completo. Por omisión el pulmón es lineal; la relajación viscoelástica, la curva sigmoidea, la resistencia de Rohrer, la limitación al flujo espiratorio y la segunda unidad son opciones que activa el escenario, no el comportamiento por defecto. Modos habilitados <!-- hechos:modos -->A/C VC y A/C PC y CPAP/PS<!-- /hechos:modos --> (`PROFILE.enabledModes`; CPAP/PS tras sus pruebas de banco); fisiología de las curvas y su verificación en `docs/03-fisiologia-curvas.md`. Sin pacientes reales, sin WebUSB/WebSerial/Bluetooth, sin extracción de firmware, sin afirmación de aval de ningún fabricante. Las marcas que aparecen en las fuentes de `evidence.json` pertenecen a sus titulares y sólo identifican la documentación consultada.
