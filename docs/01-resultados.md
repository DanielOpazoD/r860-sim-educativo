# Resultados de pruebas ejecutadas · etapa P0 (adulto A/C VC)

Generado el 2026-09-06T14:27:44 a partir de `test-results/vitest.json` y `test-results/e2e-results.json` (salidas reales). Motor 0.1.0 · perfil r860-es-photo-reference-v1 · dt 4 ms · semilla 1 · t0 2026-08-18T21:04:05-04:00 · Node 24.14 · Chromium (Playwright 1.63, build 1243). Incluye las regresiones de la revisión adversarial (`tests/unit/review.test.ts`).

## Niveles de validación

- **L0 visual**: capturas deterministas en `docs/capturas/` con JSON de metadatos (viewport, hora, semilla, tiempo simulado). Comparación por zonas con P1/P3 hecha por la IA constructora; **sin baseline aprobada por revisor humano**, por lo que no se automatiza la comparación píxel a píxel.
- **L1 interacción**: Playwright (abajo).
- **L2 modelo analítico**: Vitest, banco BM-01…BM-08, físicas y regresiones.
- **L3 revisión experta**: pendiente. Se realizó una revisión adversarial de código por un agente independiente (no equivale a revisión clínica).

## Vitest · 66 pasadas / 0 fallidas / 66 totales

| Archivo | Prueba | Estado | ms |
| --- | --- | --- | --- |
| `bench/bm.test.ts` | BM-01 · VC con flujo constante (banco lineal pasivo) › Tinsp 1 s, Ppico 20 cmH2O, presión elástica al ocluir 15 cmH2O | passed | 67 |
| `bench/bm.test.ts` | BM-02 · Cstat y resistencia desde la misma respiración › Cstat = 500/(15−5) = 50 mL/cmH2O; R = (20−15)/0.5 = 10 | passed | 53 |
| `bench/bm.test.ts` | BM-03 · Fuente de presión ideal (modelo, no modo PC) › ΔP 10 sobre PEEP 5, R 10, C 0.05, 1 s: VT ≈ 0.432332 L; Q0 = 1 L/s; Qfin ≈ 0.135335 L/s | passed | 26 |
| `bench/bm.test.ts` | BM-04 · Espiración incompleta (atrapamiento) › Rexp 20, C 0.05, exceso 0.5 L, Te 0.5 s: exceso final ≈ 0.303265 L; presión elástica extra ≈ 6.0653 cmH2O | passed | 71 |
| `bench/bm.test.ts` | BM-05 · Unidades › 0.5 L/s → 30 L/min; 0.5 L·1 s → 500 mL; C 0.05 → 50 mL/cmH2O | passed | 61 |
| `bench/bm.test.ts` | BM-05 · Unidades › el motor no confunde unidades: VTesp de banco = 500 mL exactos | passed | 39 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › Plimit 25 (< Pmáx 40): el flujo cae para mantener 25 durante el Tinsp restante; VT real < VT programado; ciclo por tiempo | passed | 62 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › Pmáx 30 (< Plimit 60): alcanzar Pmáx TERMINA la inspiración a 0.8 s; VT = 0.4 L; alarma Pmáx activa | passed | 10 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › no fuerza el volumen objetivo bajo límites: VTesp medido difiere del VT programado | passed | 141 |
| `bench/bm.test.ts` | BM-07 · Conservación de volumen (sin fuga) › por respiración: VTinsp − VTesp = ΔV absoluto; acumulado en 10 respiraciones | passed | 29 |
| `bench/bm.test.ts` | BM-08 · Convergencia con el paso de integración › errores de VT decrecientes para dt = 4, 2, 1 ms en la respiración limitada por presión (RK2) | passed | 10 |
| `bench/bm.test.ts` | BM-08 · Convergencia con el paso de integración › los tiempos de evento (Ppico, Tinsp) no dependen del paso cuando el evento no cae en un múltiplo de dt | passed | 10 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-02: reconocer una alarma cuya condición persiste: sigue activa | passed | 75 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-03: resolver sin reconocer deja estado pendiente (banda gris) distinguible de activa | passed | 18 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-07: límite Off no es cero; dato ausente no genera alarma ni valor normal | passed | 5 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-05/06: la alarma Pmáx se traza al valor bruto; varias alarmas concurrentes conservan todas las condiciones | passed | 11 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › FiO2: límites sobre el sensor con retardo; sesgo del instructor separa objetivo y medición (SC-12) | passed | 298 |
| `unit/physics.test.ts` | PHY-06 · cambiar PEEP conserva el volumen pulmonar; no se suma PEEP dos veces › PEEP 5 → 10: V continuo en el instante del cambio, PEEPe medida sube a 10 y Pplat = 10 + VT/C = 20 | passed | 220 |
| `unit/physics.test.ts` | PHY-06 · cambiar PEEP conserva el volumen pulmonar; no se suma PEEP dos veces › la curva de volumen tidal se reinicia por respiración sin reiniciar el volumen absoluto | passed | 9 |
| `unit/physics.test.ts` | PHY-07 · el vaciamiento determina la auto-PEEP (BM-04 en el motor) › Rexp 30 y Texp corto producen PEEPtot > PEEP; alargar la espiración la reduce | passed | 165 |
| `unit/physics.test.ts` | PHY-08 · R, C y Pmus cambian señales y métricas distintas › subir Rinsp sube Ppico y no Pplat; bajar C sube ambas | passed | 11 |
| `unit/physics.test.ts` | PHY-08 · R, C y Pmus cambian señales y métricas distintas › el esfuerzo dispara respiraciones asistidas (no espontáneas) sólo si supera el trigger | passed | 204 |
| `unit/physics.test.ts` | PHY-10 · dominio de fallo del ensayo › resistencia alta (Rinsp 60) y C baja (5 mL/cmH2O): sin NaN ni infinitos; Pmáx termina la inspiración con volumen parcial | passed | 27 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-01: el resultado del bloqueo conserva su hora y valores tras muchas respiraciones (abrir/cerrar ventana) | passed | 127 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-02: bloqueo con esfuerzo del escenario (SC-10) resulta inválido por meseta inestable; sin Cstat fabricada | passed | 112 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-03: cancelar dos veces es seguro; ↑O2 restaura una sola vez y respeta una edición del usuario | passed | 181 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-05: un segundo bloqueo mientras hay uno en cola se rechaza con motivo | passed | 2 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › un bloqueo cancelado en curso deja resultado «cancelled» con duración parcial y no borra el válido anterior del historial | passed | 11 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › resp manual: elegible sólo en espiración; produce una respiración de tipo manual | passed | 2 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › DAT-04: el comparador rechaza combinar Pplat y VT de respiraciones distintas | passed | 14 |
| `unit/procedures.test.ts` | espera (standby) como transacción › entrar en espera detiene la entrega, las métricas pasan a no disponibles y la numeración continúa al reanudar | passed | 25 |
| `unit/review.test.ts` | H1 · ↑O2: ajuste, mezclador y sensor vuelven juntos (regla 1) › fin por temporizador restaura también el mezclador | passed | 367 |
| `unit/review.test.ts` | H1 · ↑O2: ajuste, mezclador y sensor vuelven juntos (regla 1) › fin por espera restaura también el mezclador | passed | 5 |
| `unit/review.test.ts` | H2 · orden manual y disparo en el mismo sub-paso: sin respiraciones apiladas › con esfuerzo fuerte y control asistido, una orden manual produce exactamente una respiración manual y ninguna espiración de un sub-paso | passed | 89 |
| `unit/review.test.ts` | H3 · espera durante un bloqueo espiratorio en curso › no emite respiraciones fantasma, no activa alarmas en espera y el bloqueo queda cancelado | passed | 41 |
| `unit/review.test.ts` | H4 · poner un límite en Off resuelve la alarma activa (Off = no se evalúa, no estado congelado) › VTesp bajo activa → Off → resuelta y reconocida; banda verde | passed | 12 |
| `unit/review.test.ts` | H5 · una inspiración acortada por Pmáx no acorta el periodo obligatorio › FR medida ≈ FR programada aunque cada inspiración termine a 0.8 s por Pmáx | passed | 30 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › el constructor rechaza FR negativa y un paciente con tau < 1 ms | passed | 3 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › requestHold con duración no numérica o fuera de rango se rechaza; setPatient con R diminuta se rechaza | passed | 3 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › importSession rechaza ajustes fuera de dominio y pacientes degenerados | passed | 10 |
| `unit/review.test.ts` | H7 · importar una sesión no hereda perturbaciones del escenario previo › tras cargar SC-02 (C cambia a 20 s) e importar una sesión de banco, la C importada permanece | passed | 20 |
| `unit/review.test.ts` | H8 · Pplat de ciclo nunca es válida en una respiración terminada por Pmáx › con pausa programada y Pmáx durante la pausa, pplatCycle es null con motivo endedByPmax | passed | 7 |
| `unit/review.test.ts` | H13 · bloqueo espiratorio con paciente que dispara continuamente › se ejecuta al final de la espiración aunque la termine un disparo, y resulta inválido con motivo | passed | 11 |
| `unit/review.test.ts` | audio en pausa como estado del motor (replay) › audioPause fija audioPauseUntilMs = t + 120 s y el replay lo reproduce | passed | 9 |
| `unit/security.test.ts` | SEC-01 · inspección estática: sin WebUSB/WebSerial/Bluetooth ni conexiones externas en el código fuente › ninguna referencia a navigator.usb/serial/bluetooth, WebSocket, fetch externo ni eval | passed | 45 |
| `unit/security.test.ts` | SEC-01 · inspección estática: sin WebUSB/WebSerial/Bluetooth ni conexiones externas en el código fuente › sin dependencias de ejecución en package.json (aplicación local, sin backend) | passed | 2 |
| `unit/session.test.ts` | TIM · reproducibilidad › TIM-02: misma inicialización y comandos → mismos registros de respiración | passed | 408 |
| `unit/session.test.ts` | TIM · reproducibilidad › TIM-01: la cadencia de lectura de cuadros no altera la fisiología | passed | 51 |
| `unit/session.test.ts` | SEC-03 · importación robusta › rechaza JSON malformado, tamaño excesivo, comandos no permitidos, números no finitos y claves desconocidas | passed | 21 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-01: seleccionar PEEP y girar sin confirmar no emite cambios | passed | 5 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-02: confirmar una edición válida emite un único evento con el nuevo valor interno | passed | 9 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-03: cancelar o vencer el plazo descarta el borrador (plazo identificado como propuesto) | passed | 2 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-06: la rueda sin selección no altera nada; el bloqueo de pantalla impide editar | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › un valor inválido produce explicación y no se aproxima: VT hasta hacer el flujo > 160 L/min | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › PEEP: bajar desde 1 lleva a Off y subir desde Off lleva a 1 (Off no es 0) | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › seleccionar otra tecla descarta el borrador anterior sin aplicarlo | passed | 1 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › vista previa muestra consecuencias cruzadas (Tinsp y flujo derivados) antes de confirmar | passed | 0 |
| `unit/uiState.test.ts` | menú de modo como transacción › cancelar restaura todos los ajustes; confirmar entrega sólo los cambiados | passed | 4 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › VT: 300 → 325 al subir; 300 → 295 al bajar; 1000 → 1050 / 975 | passed | 13 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › 285 mL está en rejilla; 287 no; 300 no se convierte en 325 al cambiar de vista | passed | 1 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › trigger de flujo: 3.0 → 3.5 al subir; 3.0 → 2.9 al bajar | passed | 1 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › I:E discreto: 1:1.5 sube a 1:1 y baja a 1:2; extremos 1:9 y 4:1 | passed | 1 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › propiedad: subir y bajar desde un valor en rejilla (no extremo) devuelve el mismo valor | passed | 450 |
| `unit/validation.test.ts` | restricciones cruzadas (P sobre rangos D) › VT 2 L con Tinsp 0.5 s exige 240 L/min > 160: inválido con explicación, sin aproximar | passed | 13 |
| `unit/validation.test.ts` | restricciones cruzadas (P sobre rangos D) › FR 120 con I:E 4:1 deja Texp 0.1 s < 0.25: inválido | passed | 14 |
| `unit/validation.test.ts` | restricciones cruzadas (P sobre rangos D) › Pmáx ≤ PEEP es inválido; el banco es válido y deriva flujo 0.5 L/s | passed | 5 |

## Playwright · 43 pasadas / 0 fallidas / 2 omitidas (por diseño: la prueba móvil sólo corre en el proyecto móvil)

| Proyecto | Archivo | Prueba | Estado | ms |
| --- | --- | --- | --- | --- |
| desktop-1280 | `interaction.spec.ts` | ACC-01 · recorrido por teclado: Tab, Enter selecciona, flechas ajustan, Enter confirma, Escape cancela | passed | 959 |
| desktop-1280 | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 3264 |
| desktop-1280 | `interaction.spec.ts` | INT-02 · confirmar edición válida: un evento, aplicación en la siguiente respiración, nuevo valor | passed | 1710 |
| desktop-1280 | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 3395 |
| desktop-1280 | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 2810 |
| desktop-1280 | `interaction.spec.ts` | INT-05 · abrir/cerrar vistas 100 veces no reinicia ni duplica el motor | passed | 18001 |
| desktop-1280 | `interaction.spec.ts` | INT-06 · rueda sin foco, flechas sin selección y bloqueo de pantalla no cambian nada | passed | 1834 |
| desktop-1280 | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido con resultado fechado que persiste al cerrar y reabrir la ventana | passed | 3343 |
| desktop-1280 | `interaction.spec.ts` | SEC-01/SEC-02 · sin conexiones a dispositivos ni tráfico externo; marca visible en todas las vistas | passed | 771 |
| desktop-1280 | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa explícita registrada; sin salto oculto de reloj | passed | 2375 |
| desktop-1280 | `mobile.spec.ts` | la pantalla escala, no hay desbordamiento horizontal global y una tecla sigue siendo operable | skipped | 47 |
| desktop-1280 | `visual.spec.ts` | VIS-01 + DAT-02 · P1: composición avanzada; Pplat de panel 35 y de bloqueo 32 no se fusionan | passed | 2049 |
| desktop-1280 | `visual.spec.ts` | VIS-02 + DAT-01 · P3: curvas básicas con seis valores grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 1359 |
| desktop-1280 | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y barra de presión | passed | 4336 |
| desktop-1280 | `visual.spec.ts` | VIS-04 · alarma larga y tres dígitos: SC-09 (oclusión de ensayo) con Pmáx alcanzada | passed | 6555 |
| desktop-1440 | `interaction.spec.ts` | ACC-01 · recorrido por teclado: Tab, Enter selecciona, flechas ajustan, Enter confirma, Escape cancela | passed | 560 |
| desktop-1440 | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 3159 |
| desktop-1440 | `interaction.spec.ts` | INT-02 · confirmar edición válida: un evento, aplicación en la siguiente respiración, nuevo valor | passed | 1765 |
| desktop-1440 | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 3336 |
| desktop-1440 | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 2607 |
| desktop-1440 | `interaction.spec.ts` | INT-05 · abrir/cerrar vistas 100 veces no reinicia ni duplica el motor | passed | 17025 |
| desktop-1440 | `interaction.spec.ts` | INT-06 · rueda sin foco, flechas sin selección y bloqueo de pantalla no cambian nada | passed | 2083 |
| desktop-1440 | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido con resultado fechado que persiste al cerrar y reabrir la ventana | passed | 3335 |
| desktop-1440 | `interaction.spec.ts` | SEC-01/SEC-02 · sin conexiones a dispositivos ni tráfico externo; marca visible en todas las vistas | passed | 677 |
| desktop-1440 | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa explícita registrada; sin salto oculto de reloj | passed | 2390 |
| desktop-1440 | `mobile.spec.ts` | la pantalla escala, no hay desbordamiento horizontal global y una tecla sigue siendo operable | skipped | 16 |
| desktop-1440 | `visual.spec.ts` | VIS-01 + DAT-02 · P1: composición avanzada; Pplat de panel 35 y de bloqueo 32 no se fusionan | passed | 2334 |
| desktop-1440 | `visual.spec.ts` | VIS-02 + DAT-01 · P3: curvas básicas con seis valores grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 1331 |
| desktop-1440 | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y barra de presión | passed | 4333 |
| desktop-1440 | `visual.spec.ts` | VIS-04 · alarma larga y tres dígitos: SC-09 (oclusión de ensayo) con Pmáx alcanzada | passed | 6549 |
| mobile | `interaction.spec.ts` | ACC-01 · recorrido por teclado: Tab, Enter selecciona, flechas ajustan, Enter confirma, Escape cancela | passed | 1158 |
| mobile | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 2383 |
| mobile | `interaction.spec.ts` | INT-02 · confirmar edición válida: un evento, aplicación en la siguiente respiración, nuevo valor | passed | 1565 |
| mobile | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 3341 |
| mobile | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 2744 |
| mobile | `interaction.spec.ts` | INT-05 · abrir/cerrar vistas 100 veces no reinicia ni duplica el motor | passed | 17288 |
| mobile | `interaction.spec.ts` | INT-06 · rueda sin foco, flechas sin selección y bloqueo de pantalla no cambian nada | passed | 1933 |
| mobile | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido con resultado fechado que persiste al cerrar y reabrir la ventana | passed | 3476 |
| mobile | `interaction.spec.ts` | SEC-01/SEC-02 · sin conexiones a dispositivos ni tráfico externo; marca visible en todas las vistas | passed | 811 |
| mobile | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa explícita registrada; sin salto oculto de reloj | passed | 2365 |
| mobile | `mobile.spec.ts` | la pantalla escala, no hay desbordamiento horizontal global y una tecla sigue siendo operable | passed | 5820 |
| mobile | `visual.spec.ts` | VIS-01 + DAT-02 · P1: composición avanzada; Pplat de panel 35 y de bloqueo 32 no se fusionan | passed | 3887 |
| mobile | `visual.spec.ts` | VIS-02 + DAT-01 · P3: curvas básicas con seis valores grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 4506 |
| mobile | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y barra de presión | passed | 4839 |
| mobile | `visual.spec.ts` | VIS-04 · alarma larga y tres dígitos: SC-09 (oclusión de ensayo) con Pmáx alcanzada | passed | 5979 |

## Capturas (docs/capturas)

| Archivo | Contenido | Metadatos |
| --- | --- | --- |
| `vis-01-p1-advanced-desktop-1440.png` | vis-01-p1-advanced | desktop-1440 1440×1000 · t=0 ms · motor worker |
| `vis-02-p3-basic-desktop-1440.png` | vis-02-p3-basic | desktop-1440 1440×1000 · t=0 ms · motor worker |
| `vis-03-live-sc01-t12s-desktop-1440.png` | vis-03-live-sc01-t12s | desktop-1440 1440×1000 · t=12000 ms · motor worker |
| `vis-03-mobile-mobile.png` | vis-03-mobile | mobile 412×839 · t=8000 ms · motor worker |
| `vis-04-alarm-sc09-t20s-desktop-1440.png` | vis-04-alarm-sc09-t20s | desktop-1440 1440×1000 · t=20000 ms · motor worker |

## No ejecutado en esta etapa

ALM-04 automatizada de extremo a extremo; PHY-02/03 (PC, CPAP/PS no habilitados); PHY-05 (fuga); PRC-04 (SBT); DAT-05/06 en UI; CFG-04; ACC-02 automatizada; auditoría de accesibilidad formal; revisión experta L3; contraste con equipo de demostración.
