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
| `profiles` | Perfiles de equipo (`REFERENCE_PROFILE`), registro, `defaultInit` | `domain`, `profiles` | motor en valor (sólo tipos) |
| `scenarios` | Escenarios sintéticos con lección | `domain` | — |
| `fixtures` | Transcripción de las fotografías P1/P3 a un cuadro congelado, sin física | `domain`, `engine`, `profiles` | app, ui, render |
| `history` | Exportación, importación validada y reproducción de sesiones | `domain`, `engine`, `profiles` | app, ui |
| `app` | Protocolo del Worker, anfitrión, cliente, máquina de estados de edición | `domain`, `engine`, `profiles`, `scenarios`, `history` | ui |
| `render` | Dibujo en canvas: `canvas` (lienzo y primitivas), `signal` (puntos), `waves` (curvas), `loops`, `gauge` (barra de presión), `effortCharts` (esfuerzo del panel), `trends`; `monitorPalette` (paleta y escala tipográfica) y `plots` como fachada que lo reexporta | `domain` | engine, app, ui |
| `ui` | Composición de la interfaz, panel lateral Paciente/Casos, gasometría del modelo, espacio educativo bajo el equipo, diálogos, editor y perfiles de paciente basados en escenarios | todo lo anterior | — |
| `workers` | Punto de entrada del Worker | `app` | — |

**Qué cuenta como alcanzar una capa.** Los `import type` no cuentan: desaparecen al compilar y no acoplan comportamiento. Sí cuentan las cuatro formas que dejan una dependencia en tiempo de ejecución, y el verificador comprueba las cuatro: `import x from '…'`, `export … from '…'` (re-exportar acopla igual, y además propaga el módulo a quien importe éste), `import '…'` (sólo por efecto secundario) y `await import('…')` (diferida, pero la misma dependencia). Las tres últimas se añadieron después de que una revisión adversarial burlara el verificador colocando `export * from '../ui/format'` dentro de `domain`: pasaba lint, tipos y la puerta de capas. El verificador prohíbe además importar dos veces el mismo módulo desde un archivo.

## 2. Contratos entre capas

- **`ProfileSpec`** (`src/domain/profile.ts`): reglas de ajuste, límites cruzados, reglas de límites de alarma, reglas de bloqueo, valores iniciales, modos habilitados y tiempos documentados (pausa de audio, ↑O₂, plazo de edición). El motor recibe un `ProfileSpec` por constructor: `new Simulator(init, profile)`. `SimulatorInit.profileId` declara el perfil y el motor rechaza una inicialización cuyo id no coincida con el inyectado. Las sesiones anteriores a 0.3.3 no traen `profileId` y se resuelven al perfil de referencia.
- **`Command` / `CommandResult`** (`src/domain/commands.ts`): único camino de mutación del motor. Todo comando se valida en `Simulator.execute` y se registra con su resultado, lo que hace posible la reproducción determinista (`history/session.ts`).
- **Protocolo del Worker** (`src/app/protocol.ts`): mensajes tipados `MainToEngine` / `EngineToMain`. El cliente (`engineClient.ts`) degrada al anfitrión en página si el Worker falla y responde las órdenes pendientes como rechazadas; un arranque fallido se publica como `initError`, nunca en silencio.
- **`EngineFrame`**: instantánea inmutable que el motor publica a la interfaz. Separa `settings` (programado), `pending` (transacción sin aplicar), `live` (entrega instantánea), `metrics` (con calidad y procedencia), `procedure`, `alarms` y `truth` (verdad del modelo, usada por el panel Paciente y el desarrollo de los casos).

## 3. Motor

- `patient.ts`: mecánica del sistema respiratorio. Por omisión, un compartimento lineal con volumen absoluto; opcionalmente, relajación viscoelástica, curva P-V sigmoidea, resistencia de Rohrer, limitación al flujo espiratorio, calibre dependiente del volumen y una segunda unidad alveolar en paralelo. Integrador RK2 con sub-pasos de 0,2·τ; la resistencia del circuito y el tope de flujo del ventilador se resuelven en el nodo de la vía aérea.
- `controller.ts`: fases (`inspFlow`, `inspLimited`, `inspPause`, `inspPressure`, `exp`, bloqueos), eventos programados con sub-paso exacto, transiciones diferidas, cola de eventos que el `Simulator` drena en orden. Le acompañan `ventilatorConstants.ts` (las constantes del equipo y del modelo, cada una con su origen), `trigger.ts` (disparo y regulador de PEEP), `breathAnalysis.ts` (meseta, índice de estrés y τ espiratoria de cada respiración) y `controllerTypes.ts`.
- `metrics.ts`, `alarms.ts`, `procedures.ts`, `sensors.ts`, `effort.ts`: componentes pequeños que sólo hablan por `BreathRecord`, `MetricSample`, `AlarmState` y `ProcedureResult`.
- `gasExchange.ts`: gasometría de modelo. Recibe el volumen que espira el pulmón en cada respiración y publica `truth.gas`; no realimenta la mecánica ni entra en las métricas del monitor.
- `simulator.ts`: composición, validación de fronteras, reloj y construcción del cuadro. `commandHandlers.ts`: un manejador por tipo de comando sobre una interfaz `CommandContext` (validar → aplicar → registrar); la prueba ARQ-02 exige un manejador por cada tipo declarado en el dominio.

Invariantes: `null ≠ 0 ≠ Off`; seleccionar ≠ aplicar; el volumen absoluto nunca se reinicia; todo dato lleva calidad y motivo.

## 4. Interfaz

`src/ui/app.ts` es la raíz de composición: lee los parámetros, crea el cliente del motor, construye un contexto compartido (`AppContext`) y ensambla módulos por responsabilidad: `quickEditor.ts`, `holdPanel.ts`, `modeDialog.ts`, `alarmsUi.ts`, `metricsView.ts`, `plotsView.ts`, `views.ts`, `instructorPanel.ts`, `caseSpace.ts`, `actions.ts`, `keyboard.ts`, `commandPalette.ts`, con `dialogHost.ts`, `lessonTracker.ts`, `helpPanels.ts` y `labels.ts` como apoyo. Cada módulo se crea con una fábrica `createX(ctx, deps)`, posee su estado y su DOM, y las dependencias entre módulos forman un grafo acíclico explícito (quickEditor ← holdPanel/modeDialog ← instructorPanel/caseSpace ← actions/keyboard ← app), verificado por `import/no-cycle`. `app.ts` se queda en el papel de raíz de composición: monta, conecta y no decide nada de la simulación. Las funciones puras viven aparte: `format.ts`, `humanize.ts` (lenguaje del alumno), `metricsTable.ts`, `lesson.ts`, `exports.ts`, `dialogs.ts`, `patientControls.ts`.

Una sola pantalla. El panel lateral izquierdo tiene dos pestañas: **Paciente** (cinco perfiles rápidos —sano sedado, restrictivo, obstructivo, esfuerzo normal y débil— con sus números bajo el nombre; compliance, resistencia y esfuerzo; eventos súbitos que los deslizadores no hacen —apnea, oclusión, fuga, desconexión—; «Deshacer» y «Restablecer» en el encabezado). «Mecánica avanzada» (cuatro pestañas: esfuerzo, vía aérea, pulmón, circuito, cada una con su preajuste) y «Datos del modelo» se abren como paneles laterales que salen del borde de la barra, encima del equipo, uno a la vez (`sideFlyouts.ts`); en móvil ocupan la pantalla y **Casos** (lista de casos clínicos o el caso en curso, compacto para leerse entero: viñeta, objetivo, Entregar y referencias; los criterios se marcan al entregar). Sin caso abre en Paciente; con un caso, en Casos. Paciente sigue operativo durante un caso: una línea recuerda que cambiar el paciente altera el caso y ofrece «Salir del caso», que vuelve al banco pasivo. Bajo sus pestañas está siempre la gasometría del modelo (`gasView.ts`), en dos líneas: PaCO₂ y pH de ahora con su valor al inicio, y la trayectoria de la PaCO₂ con la marca del último cambio. Bajo el equipo, con scroll, el espacio educativo (`#learn`): el desarrollo del caso (oculto hasta entregar), Aula · Fundamentos (`#view-teaching`, fuera de `#monitor`, cargado al llegar a él) y Aula · Reflexión. `caseSpace.ts` lo coordina: no hay pestañas de espacios ni catálogo aparte, y elegir el caso en curso no lo reinicia. El panel queda abierto por omisión en escritorio (fijo al desplazar la página) y cerrado en móvil, donde es una hoja inferior; salvo que exista una preferencia guardada. Las prácticas guiadas antiguas y sus escenarios quedan como datos para futuros casos: no se ofrecen ni se evalúan. El modo examen es una opción del menú «…». Los avisos breves (`toast`) aparecen pequeños abajo a la derecha, tres como máximo y 3,2 s cada uno. Una sesión importada no se evalúa como el caso que estaba abierto.

**Sistema visual del exterior.** Barra superior, panel lateral, paneles desplegables, diálogos, paleta, menús y espacio educativo comparten tokens declarados en `08-minimal.css`; el equipo (carcasa, pantalla azul pizarra, teclas de grafito) conserva su propio cromo, medido en las capturas del manual (E-118), y su tipografía Arial. Radios: `--radius-xs` 4 px (teclas), `--radius-sm` 6 px (piezas internas: opciones de lista, pestañas segmentadas), `--radius-md` 8 px (controles: botones, chips, campos, opciones), `--radius-lg` 12 px (superficies: panel, paneles desplegables, diálogos, paleta, tarjetas del Aula) y `--radius-pill`. Sombras: `--shadow-sm` para superficies que conviven con el equipo, `--shadow-md` para lo flotante (menús, paneles desplegables), `--shadow-lg` para lo modal (diálogos, paleta). Tipografía: `--font-ui` (la del sistema) con números tabulares y la escala `--type-*`; pesos 400/500/600/700. Los rótulos de sección comparten un estilo (versalitas de 10 px, 600, espaciado 0,08 em). Las pestañas principales se subrayan en acento sin relleno; las secundarias son segmentadas. Foco: anillo `--shell-focus` (separación blanca y 1,5 px de acento).

`views.ts` sólo registra las vistas del monitor. La URL antigua `?view=teaching` se mantiene como compatibilidad: lleva a Aula · Fundamentos, bajo el equipo, sin cambiar la vista del monitor.

La interfaz depende del perfil inyectado (`ctx.profile`), no del módulo de un equipo concreto: **ningún módulo de `src/ui` nombra un equipo concreto**. Quien lo elige es la raíz de composición, `src/main.ts`, que se lo entrega a `startApp` en `AppOptions.profile`; por eso el verificador de capas autoriza a `main` —y sólo a `main`— a alcanzar `profiles`. Un perfil pediátrico o de otro ventilador se cambia ahí, en una línea, sin tocar la interfaz.

## 5. Herramientas y puertas

Hay dos puertas, y conviene no confundirlas.

- **`npm run check`** es la puerta rápida de escritorio (unos segundos): oxlint (corrección, `eqeqeq`, `prefer-const`, `consistent-type-imports`, `import/no-cycle`) → fronteras de capas → Prettier → tsc estricto → Vitest. **No mide cobertura**: `npm run test` es `vitest run` a secas, para que la puerta que se corre veinte veces al día siga siendo instantánea.
- **La integración continua** es la puerta real: repite lo anterior, sustituye Vitest por `npm run test:coverage` (con los umbrales de `vitest.config.ts`), añade el build y Playwright en tres viewports, y termina comprobando que los números de la documentación coincidan con los artefactos que acaba de producir. `npm run ci` la reproduce en local en un solo pase y deja escritos los hechos (`docs:facts`) en vez de sólo comprobarlos.
- **Un solo pase de Vitest.** `test:coverage` escribe también `test-results/vitest.json`, y `results:doc` lo lee sin volver a ejecutar las pruebas. Antes las repetía al final: si el árbol había cambiado mientras corría Playwright, el README contaba pruebas que la rama no tenía (así falló el PR #139).

- **Regresión visual (VR-01, `tests/e2e/regresion.spec.ts`).** Dieciocho estados se llevan a un instante fijo —simulación determinista, reloj de pared fijo, pausa automática— y su imagen se compara píxel a píxel con su referencia en `tests/e2e/capturas/<plataforma>/<proyecto>/`, en escritorio 1280 y, los que cambian de disposición, en el teléfono: el equipo (vistas, alarma alta, fuga, bloqueo, editor, espera, modos y límites) sin el cromo exterior, y el exterior con su cromo (el panel, «Datos del modelo», la guía, sesión y exportaciones, «Personalizar vista» y el Aula). El umbral es estricto (0,05 por píxel y 25 píxeles distintos como mucho): dos pasadas en la misma plataforma dan la misma imagen, y con el de Playwright por omisión pasaba un cambio real de opacidad en las líneas de las ayudas. Hay referencias por plataforma porque macOS y el Linux del CI dibujan distinto las fuentes; VR-02 (Vitest) exige que las de macOS sean exactamente las del spec y que no sobre ninguna en Linux (si falta una, Playwright ya hace fallar el CI).
  - **Tras un cambio visual intencional**: en local, `npx playwright test tests/e2e/regresion.spec.ts --update-snapshots=changed` (macOS) y revisar las imágenes; después borrar las de Linux afectadas y subir la rama. El CI las vuelve a escribir —esa pasada falla a propósito, «writing actual»— y las deja en el artefacto `capturas-linux`: `gh run download <run> -n capturas-linux -D tests/e2e/capturas/linux`, revisarlas, commit y subir; la siguiente pasada compara.
  - **Si una comparación falla sin quererlo**, el artefacto `capturas-diferencias` trae la referencia, la imagen obtenida y la diferencia.

- **La cascada CSS se ordena con un verificador, no a ojo.** Antes de juntar dos reglas con el mismo selector se comprueba que ninguna regla intermedia de igual especificidad fije la misma propiedad (atajos incluidos: `padding` cubre `padding-top`). Si la hay pero una regla posterior incondicional la anula a cualquier ancho, esa declaración intermedia es código muerto: se quita primero —el aspecto no cambia— y después se junta. Así se reunieron las reglas del monitor (PR #150) y del exterior; `tokens.test` lleva el trinquete de lo que queda repartido.

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

Las marcas D / O / P / U de `evidence.json` cumplen la misma función en la otra dirección: separan lo documentado de lo observado en una fotografía, de lo supuesto y de lo que no se sabe. Una afirmación sin marca no pertenece a este proyecto. Y el registro tampoco puede citar lo que no existe: `tests/unit/evidencia.test.ts` (EVI) comprueba que cada afirmación tenga marca, que sus fuentes estén en la lista, que los archivos que la implementan existan, que cada identificador de prueba aparezca en el archivo citado (y cada escenario, en la lista de escenarios), y que las referencias E-nnn y U-nn de la documentación y del código apunten a entradas reales. Al estrenarla encontró tres citas a pruebas que ya no existían (ALM-06, ALM-04, CFG-05).
