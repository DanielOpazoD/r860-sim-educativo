# Arquitectura y módulos

Documento de referencia para quien mantenga o extienda el simulador. Describe las capas, sus reglas de dependencia, los contratos entre ellas y las decisiones que las justifican. Las reglas están verificadas por `scripts/check-deps.mjs` (`npm run deps`), que corre en `npm run check` y en la integración continua.

## 1. Capas y dirección de las dependencias

```
domain  ←  engine  ←  profiles · scenarios  ←  history  ←  app  ←  ui  ←  main
                                                                render (hoja: sin importaciones)
                                                                workers → app
```

| Capa | Responsabilidad | Puede importar en valor | No puede |
| --- | --- | --- | --- |
| `domain` | Tipos, unidades, reglas de ajuste, validación, contrato de perfil (`ProfileSpec`), comandos | sólo `domain` | nada más |
| `engine` | Física, controlador, métricas, alarmas, procedimientos, reloj, `Simulator` | `domain`, `engine` | perfiles concretos, historia, app, ui |
| `profiles` | Perfiles de equipo (`R860_PROFILE`), registro, `defaultInit` | `domain`, `profiles` | motor en valor (sólo tipos) |
| `scenarios` | Escenarios sintéticos con lección | `domain` | — |
| `history` | Exportación, importación validada y reproducción de sesiones | `domain`, `engine`, `profiles` | app, ui |
| `app` | Protocolo del Worker, anfitrión, cliente, máquina de estados de edición | `domain`, `engine`, `profiles`, `scenarios`, `history` | ui |
| `render` | Dibujo en canvas (curvas, bucles, manómetro, tendencias) | nada | — |
| `ui` | Composición de la interfaz, diálogos, editor, panel docente | todo lo anterior | — |
| `workers` | Punto de entrada del Worker | `app` | — |

Los `import type` no cuentan para estas reglas: desaparecen al compilar y no acoplan comportamiento. El verificador también prohíbe importar dos veces el mismo módulo desde un archivo.

## 2. Contratos entre capas

- **`ProfileSpec`** (`src/domain/profile.ts`): reglas de ajuste, límites cruzados, reglas de límites de alarma, reglas de bloqueo, valores iniciales, modos habilitados y tiempos documentados (pausa de audio, ↑O₂, plazo de edición). El motor recibe un `ProfileSpec` por constructor: `new Simulator(init, profile)`. `SimulatorInit.profileId` declara el perfil y el motor rechaza una inicialización cuyo id no coincida con el inyectado. Las sesiones anteriores a 0.3.3 no traen `profileId` y se resuelven al perfil de referencia.
- **`Command` / `CommandResult`** (`src/domain/commands.ts`): único camino de mutación del motor. Todo comando se valida en `Simulator.execute` y se registra con su resultado, lo que hace posible la reproducción determinista (`history/session.ts`).
- **Protocolo del Worker** (`src/app/protocol.ts`): mensajes tipados `MainToEngine` / `EngineToMain`. El cliente (`engineClient.ts`) degrada al anfitrión en página si el Worker falla y responde las órdenes pendientes como rechazadas; un arranque fallido se publica como `initError`, nunca en silencio.
- **`EngineFrame`**: instantánea inmutable que el motor publica a la interfaz. Separa `settings` (programado), `pending` (transacción sin aplicar), `live` (entrega instantánea), `metrics` (con calidad y procedencia), `procedure`, `alarms` y `truth` (verdad del modelo, sólo para el panel docente).

## 3. Motor

- `patient.ts`: modelo de un compartimento con volumen absoluto; integrador RK2 con sub-pasos de 0,2·τ, tope de flujo y resistencia en serie dentro del integrador.
- `controller.ts`: fases (`inspFlow`, `inspLimited`, `inspPause`, `inspPressure`, `exp`, bloqueos), eventos programados con sub-paso exacto, transiciones diferidas, cola de eventos que el `Simulator` drena en orden.
- `metrics.ts`, `alarms.ts`, `procedures.ts`, `sensors.ts`, `effort.ts`: componentes pequeños que sólo hablan por `BreathRecord`, `MetricSample`, `AlarmState` y `ProcedureResult`.
- `simulator.ts`: composición, validación de fronteras, ejecución de comandos y construcción del cuadro.

Invariantes: `null ≠ 0 ≠ Off`; seleccionar ≠ aplicar; el volumen absoluto nunca se reinicia; todo dato lleva calidad y motivo.

## 4. Interfaz

`src/ui/app.ts` es la raíz de composición: lee los parámetros, crea el cliente del motor, construye un contexto compartido (`AppContext`) y ensambla módulos por responsabilidad: `quickEditor.ts`, `holdPanel.ts`, `modeDialog.ts`, `alarmsUi.ts`, `metricsView.ts`, `plotsView.ts`, `views.ts`, `instructorPanel.ts`, `actions.ts`, `keyboard.ts`, con `dialogHost.ts`, `lessonTracker.ts`, `helpPanels.ts` y `labels.ts` como apoyo. Cada módulo se crea con una fábrica `createX(ctx, deps)`, posee su estado y su DOM, y las dependencias entre módulos forman un grafo acíclico explícito (quickEditor ← holdPanel/modeDialog ← instructorPanel ← actions/keyboard ← app), verificado por `import/no-cycle`. `app.ts` queda en unas 325 líneas. Las funciones puras viven aparte: `format.ts`, `humanize.ts` (lenguaje del alumno), `metricsTable.ts`, `lesson.ts`, `exports.ts`, `dialogs.ts`, `patientControls.ts`.

La interfaz depende del perfil inyectado (`ctx.profile`), no del módulo del R860; la única referencia al perfil concreto está en `src/profiles/index.ts`.

## 5. Herramientas y puertas

`npm run check` = oxlint (corrección, `eqeqeq`, `prefer-const`, `consistent-type-imports`, `import/no-cycle`) → fronteras de capas → Prettier → tsc estricto → Vitest con cobertura y umbrales sobre todo `src`. La CI añade el build y Playwright en tres viewports. La cobertura de `src/ui` y `src/render` la aportan las pruebas e2e; el número honesto sobre todo `src` está en el README.

## 6. Decisiones y alternativas descartadas

- **Perfil por inyección y no por importación**: permite perfiles futuros (pediátrico, otro equipo) sin tocar el motor y hace explícito en las sesiones con qué perfil se generaron. Alternativa descartada: un perfil global mutable, que rompería la reproducción determinista.
- **Un solo canal de mutación (comandos)**: cuesta algo de verbosidad, pero es lo que hace posible la exportación, la reproducción y el registro docente sin instrumentar la interfaz.
- **Verificador de capas propio** en vez de un plugin: veinte líneas sin dependencias, legible en la revisión y ejecutable en cualquier entorno.
- **oxlint en vez de typescript-eslint**: el paquete `typescript` 7 nativo no expone la API de JavaScript que typescript-eslint necesita.
