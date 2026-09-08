# Arquitectura y módulos

Documento de referencia para quien mantenga o extienda el simulador. Describe las capas, sus reglas de dependencia, los contratos entre ellas y las decisiones que las justifican. Las reglas están verificadas por `scripts/check-deps.mjs` (`npm run deps`), que corre en `npm run check` y en la integración continua.

## 1. Capas y dirección de las dependencias

```
domain  ←  engine  ←  profiles · scenarios  ←  history  ←  app  ←  ui  ←  main
   ↑                                                            main → profiles (elige el perfil)
   └── render (sólo tipos y unidades del dominio)
                                                                workers → app
```

| Capa | Responsabilidad | Puede importar en valor | No puede |
| --- | --- | --- | --- |
| `domain` | Tipos, unidades, reglas de ajuste, validación, contrato de perfil (`ProfileSpec`), comandos | sólo `domain` | nada más |
| `engine` | Física, controlador, métricas, alarmas, procedimientos, reloj, `Simulator` | `domain`, `engine` | perfiles concretos, historia, app, ui |
| `profiles` | Perfiles de equipo (`R860_PROFILE`), registro, `defaultInit` | `domain`, `profiles` | motor en valor (sólo tipos) |
| `scenarios` | Escenarios sintéticos con lección | `domain` | — |
| `fixtures` | Transcripción de las fotografías P1/P3 a un cuadro congelado, sin física | `domain`, `engine`, `profiles` | app, ui, render |
| `history` | Exportación, importación validada y reproducción de sesiones | `domain`, `engine`, `profiles` | app, ui |
| `app` | Protocolo del Worker, anfitrión, cliente, máquina de estados de edición | `domain`, `engine`, `profiles`, `scenarios`, `history` | ui |
| `render` | Dibujo en canvas (curvas, bucles, manómetro, tendencias) | `domain` | engine, app, ui |
| `ui` | Composición de la interfaz, diálogos, editor, panel docente | todo lo anterior | — |
| `workers` | Punto de entrada del Worker | `app` | — |

**Qué cuenta como alcanzar una capa.** Los `import type` no cuentan: desaparecen al compilar y no acoplan comportamiento. Sí cuentan las cuatro formas que dejan una dependencia en tiempo de ejecución, y el verificador comprueba las cuatro: `import x from '…'`, `export … from '…'` (re-exportar acopla igual, y además propaga el módulo a quien importe éste), `import '…'` (sólo por efecto secundario) y `await import('…')` (diferida, pero la misma dependencia). Las tres últimas se añadieron después de que una revisión adversarial burlara el verificador colocando `export * from '../ui/format'` dentro de `domain`: pasaba lint, tipos y la puerta de capas. El verificador prohíbe además importar dos veces el mismo módulo desde un archivo.

## 2. Contratos entre capas

- **`ProfileSpec`** (`src/domain/profile.ts`): reglas de ajuste, límites cruzados, reglas de límites de alarma, reglas de bloqueo, valores iniciales, modos habilitados y tiempos documentados (pausa de audio, ↑O₂, plazo de edición). El motor recibe un `ProfileSpec` por constructor: `new Simulator(init, profile)`. `SimulatorInit.profileId` declara el perfil y el motor rechaza una inicialización cuyo id no coincida con el inyectado. Las sesiones anteriores a 0.3.3 no traen `profileId` y se resuelven al perfil de referencia.
- **`Command` / `CommandResult`** (`src/domain/commands.ts`): único camino de mutación del motor. Todo comando se valida en `Simulator.execute` y se registra con su resultado, lo que hace posible la reproducción determinista (`history/session.ts`).
- **Protocolo del Worker** (`src/app/protocol.ts`): mensajes tipados `MainToEngine` / `EngineToMain`. El cliente (`engineClient.ts`) degrada al anfitrión en página si el Worker falla y responde las órdenes pendientes como rechazadas; un arranque fallido se publica como `initError`, nunca en silencio.
- **`EngineFrame`**: instantánea inmutable que el motor publica a la interfaz. Separa `settings` (programado), `pending` (transacción sin aplicar), `live` (entrega instantánea), `metrics` (con calidad y procedencia), `procedure`, `alarms` y `truth` (verdad del modelo, sólo para el panel docente).

## 3. Motor

- `patient.ts`: mecánica del sistema respiratorio. Por omisión, un compartimento lineal con volumen absoluto; opcionalmente, relajación viscoelástica, curva P-V sigmoidea, resistencia de Rohrer, limitación al flujo espiratorio, calibre dependiente del volumen y una segunda unidad alveolar en paralelo. Integrador RK2 con sub-pasos de 0,2·τ; la resistencia del circuito y el tope de flujo del ventilador se resuelven en el nodo de la vía aérea.
- `controller.ts`: fases (`inspFlow`, `inspLimited`, `inspPause`, `inspPressure`, `exp`, bloqueos), eventos programados con sub-paso exacto, transiciones diferidas, cola de eventos que el `Simulator` drena en orden.
- `metrics.ts`, `alarms.ts`, `procedures.ts`, `sensors.ts`, `effort.ts`: componentes pequeños que sólo hablan por `BreathRecord`, `MetricSample`, `AlarmState` y `ProcedureResult`.
- `simulator.ts`: composición, validación de fronteras, reloj y construcción del cuadro. `commandHandlers.ts`: un manejador por tipo de comando sobre una interfaz `CommandContext` (validar → aplicar → registrar); la prueba ARQ-02 exige un manejador por cada tipo declarado en el dominio.

Invariantes: `null ≠ 0 ≠ Off`; seleccionar ≠ aplicar; el volumen absoluto nunca se reinicia; todo dato lleva calidad y motivo.

## 4. Interfaz

`src/ui/app.ts` es la raíz de composición: lee los parámetros, crea el cliente del motor, construye un contexto compartido (`AppContext`) y ensambla módulos por responsabilidad: `quickEditor.ts`, `holdPanel.ts`, `modeDialog.ts`, `alarmsUi.ts`, `metricsView.ts`, `plotsView.ts`, `views.ts`, `instructorPanel.ts`, `actions.ts`, `keyboard.ts`, con `dialogHost.ts`, `lessonTracker.ts`, `helpPanels.ts` y `labels.ts` como apoyo. Cada módulo se crea con una fábrica `createX(ctx, deps)`, posee su estado y su DOM, y las dependencias entre módulos forman un grafo acíclico explícito (quickEditor ← holdPanel/modeDialog ← instructorPanel ← actions/keyboard ← app), verificado por `import/no-cycle`. `app.ts` se queda en el papel de raíz de composición: monta, conecta y no decide nada de la simulación. Las funciones puras viven aparte: `format.ts`, `humanize.ts` (lenguaje del alumno), `metricsTable.ts`, `lesson.ts`, `exports.ts`, `dialogs.ts`, `patientControls.ts`.

La interfaz depende del perfil inyectado (`ctx.profile`), no del módulo del R860: **ningún módulo de `src/ui` nombra un equipo concreto**. Quien lo elige es la raíz de composición, `src/main.ts`, que se lo entrega a `startApp` en `AppOptions.profile`; por eso el verificador de capas autoriza a `main` —y sólo a `main`— a alcanzar `profiles`. Un perfil pediátrico o de otro ventilador se cambia ahí, en una línea, sin tocar la interfaz.

## 5. Herramientas y puertas

Hay dos puertas, y conviene no confundirlas.

- **`npm run check`** es la puerta rápida de escritorio (unos segundos): oxlint (corrección, `eqeqeq`, `prefer-const`, `consistent-type-imports`, `import/no-cycle`) → fronteras de capas → Prettier → tsc estricto → Vitest. **No mide cobertura**: `npm run test` es `vitest run` a secas, para que la puerta que se corre veinte veces al día siga siendo instantánea.
- **La integración continua** es la puerta real: repite lo anterior, sustituye Vitest por `npm run test:coverage` (con los umbrales de `vitest.config.ts`), añade el build y Playwright en tres viewports, y termina comprobando que los números de la documentación coincidan con los artefactos que acaba de producir.

La cobertura de `src/ui` y `src/render` la aportan las pruebas e2e y no aparece en el informe de v8; por eso el README publica las dos cifras, con y sin esa capa.

## 6. Decisiones y alternativas descartadas

- **Perfil por inyección y no por importación**: permite perfiles futuros (pediátrico, otro equipo) sin tocar el motor y hace explícito en las sesiones con qué perfil se generaron. Alternativa descartada: un perfil global mutable, que rompería la reproducción determinista.
- **Un solo canal de mutación (comandos)**: cuesta algo de verbosidad, pero es lo que hace posible la exportación, la reproducción y el registro docente sin instrumentar la interfaz.
- **Verificador de capas propio** en vez de un plugin: un archivo sin dependencias que se lee entero en una revisión y corre en cualquier entorno. Su límite conocido es que analiza texto con expresiones regulares, no el árbol de sintaxis: reconoce las cuatro formas de importación listadas en §1, y no reconocería una construida en tiempo de ejecución (`import(variable)`). Para eso está `import/no-cycle` de oxlint como segunda red.
- **oxlint en vez de typescript-eslint**: el paquete `typescript` 7 nativo no expone la API de JavaScript que typescript-eslint necesita.

## 7. Cómo se mantiene esta documentación

Una revisión adversarial de contexto limpio verificó doce afirmaciones concretas de este repositorio contra el código y las encontró falsas. Ninguna era una mentira: eran cifras correctas en su día que el código dejó atrás — la cobertura, los umbrales, el número de pruebas, cuántos escenarios hay, qué modos están habilitados, cuántas líneas mide un archivo. La conclusión no es «revisar mejor», porque eso ya se intentó. Es que **un número escrito a mano en la prosa caduca en silencio**, y por tanto no debe escribirse a mano.

De ahí el reparto:

| | Qué es | Quién lo mantiene |
| --- | --- | --- |
| **Documento generado** | `docs/01-resultados.md`: cada prueba con su estado y su duración | `npm run results:doc`, desde `test-results/*.json` |
| **Hechos incrustados** | Los números dentro de la prosa de `README.md` y `docs/`, entre marcas `<!-- hechos:clave -->` | `npm run docs:facts`, desde la cobertura, las salidas de prueba y el propio código |
| **Prosa** | Lo que un número no puede decir: por qué se tomó una decisión, qué se descartó, qué se sabe que falta | Una persona, a mano |

`npm run docs:facts -- --check` no escribe nada y falla si algún bloque quedó atrás. Corre en la integración continua **después** de la cobertura y de Playwright, es decir contra artefactos recién producidos; no corre en `npm run check`, que es una puerta rápida y no genera esos artefactos, y compararía contra restos de una ejecución anterior. Si el bloque de un hecho se edita a mano, la puerta lo revierte en el siguiente `docs:facts` y lo delata en el siguiente `--check`.

Lo que la automatización **no** puede sostener es la única parte que de verdad importa: que la prosa describa el código de hoy. Para eso está la práctica que encontró estos errores y que conviene repetir antes de cada versión — pedir a un revisor sin contexto previo que tome diez afirmaciones cualesquiera de la documentación y las verifique **ejecutando** el proyecto, no leyéndolo. Las afirmaciones que sobreviven a eso son las que se pueden publicar.

Las marcas D / O / P / U de `evidence.json` cumplen la misma función en la otra dirección: separan lo documentado de lo observado en una fotografía, de lo supuesto y de lo que no se sabe. Una afirmación sin marca no pertenece a este proyecto.
