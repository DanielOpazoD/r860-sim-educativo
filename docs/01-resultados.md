# Resultados de pruebas ejecutadas · v0.3.0 (adulto A/C VC + A/C PC · interfaz R860 Lab)

Generado el 2026-09-07T16:43:08 con `npm run results:doc` a partir de `test-results/vitest.json` y `test-results/e2e-results.json` (salidas reales). Motor 0.3.0 · perfil r860-es-photo-reference-v1 · dt 4 ms · semilla 1 · t0 2026-08-18T21:04:05-04:00 · Node 24.14.1 · Chromium (Playwright 1.63.0, build 1243).

## Niveles de validación

- **L0 visual**: capturas deterministas en `docs/capturas/` con JSON de metadatos. Comparación por zonas con P1/P3 hecha por la IA constructora; sin baseline aprobada por revisor humano.
- **L1 interacción**: Playwright (abajo).
- **L2 modelo analítico**: Vitest, banco BM-01…BM-08 y PC, físicas y regresiones.
- **L3 revisión experta**: pendiente.

## Vitest · 201 pasadas / 0 fallidas / 201 totales

| Archivo | Prueba | Estado | ms |
| --- | --- | --- | --- |
| `bench/bm.test.ts` | BM-01 · VC con flujo constante (banco lineal pasivo) › Tinsp 1 s, Ppico 20 cmH2O, presión elástica al ocluir 15 cmH2O | passed | 13 |
| `bench/bm.test.ts` | BM-02 · Cstat y resistencia desde la misma respiración › Cstat = 500/(15−5) = 50 mL/cmH2O; R = (20−15)/0.5 = 10 | passed | 1 |
| `bench/bm.test.ts` | BM-03 · Fuente de presión ideal (modelo, no modo PC) › ΔP 10 sobre PEEP 5, R 10, C 0.05, 1 s: VT ≈ 0.432332 L; Q0 = 1 L/s; Qfin ≈ 0.135335 L/s | passed | 0 |
| `bench/bm.test.ts` | BM-04 · Espiración incompleta (atrapamiento) › Rexp 20, C 0.05, exceso 0.5 L, Te 0.5 s: exceso final ≈ 0.303265 L; presión elástica extra ≈ 6.0653 cmH2O | passed | 1 |
| `bench/bm.test.ts` | BM-05 · Unidades › 0.5 L/s → 30 L/min; 0.5 L·1 s → 500 mL; C 0.05 → 50 mL/cmH2O | passed | 0 |
| `bench/bm.test.ts` | BM-05 · Unidades › el motor no confunde unidades: VTesp de banco = 500 mL exactos | passed | 3 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › Plimit 25 (< Pmáx 40): el flujo cae para mantener 25 durante el Tinsp restante; VT real < VT programado; ciclo por tiempo | passed | 6 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › Pmáx 30 (< Plimit 60): alcanzar Pmáx TERMINA la inspiración a 0.8 s; VT = 0.4 L; alarma Pmáx activa | passed | 1 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › no fuerza el volumen objetivo bajo límites: VTesp medido difiere del VT programado | passed | 14 |
| `bench/bm.test.ts` | BM-07 · Conservación de volumen (sin fuga) › por respiración: VTinsp − VTesp = ΔV absoluto; acumulado en 10 respiraciones | passed | 16 |
| `bench/bm.test.ts` | BM-08 · Convergencia con el paso de integración › errores de VT decrecientes para dt = 4, 2, 1 ms en la respiración limitada por presión (RK2) | passed | 2 |
| `bench/bm.test.ts` | BM-08 · Convergencia con el paso de integración › los tiempos de evento (Ppico, Tinsp) no dependen del paso cuando el evento no cae en un múltiplo de dt | passed | 9 |
| `bench/pc.test.ts` | BM-03 · A/C PC ideal (rampa 0) en el motor › ΔP 10 sobre PEEP 5, R 10, C 0.05, Tinsp 1 s: VT ≈ 0.432332 L; Q0 = 1 L/s; Qfin ≈ 0.135335 L/s; Ppico = PEEP + Pinsp | passed | 13 |
| `bench/pc.test.ts` | BM-03 · A/C PC ideal (rampa 0) en el motor › con rampa de 200 ms el VT coincide con la referencia numérica independiente (< 1 %) | passed | 47 |
| `bench/pc.test.ts` | BM-03 · A/C PC ideal (rampa 0) en el motor › tope de flujo del actuador (160 L/min): con R muy baja la presión no alcanza el objetivo de inmediato | passed | 2 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › duplicar R halva el flujo pico y reduce el VT; Ppico no cambia | passed | 4 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › halvar C reduce el VT (hacia C·ΔP) y acorta la constante de tiempo | passed | 18 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › alargar Tinsp aumenta el VT hasta saturar; el flujo cae a ~cero (fase plana del flujo) | passed | 1 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › cambiar PEEP en PC conserva el volumen y desplaza la línea base: mismo VT (ΔP relativo), Ppico = nuevo PEEP + Pinsp | passed | 8 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › el esfuerzo del paciente aumenta el flujo y el VT con la misma presión de vía aérea | passed | 14 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › BM-07 en PC: conservación de volumen por respiración | passed | 15 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › validación PC: PEEP + Pinsp ≥ Pmáx y rampa > Tinsp se rechazan con explicación; el cambio VC → PC es transacción de siguiente respiración | passed | 8 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › ppeakLow: 30 dispara (medium); 10 resuelve | passed | 20 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › vteLow: 0.6 dispara (medium); 0.4 resuelve | passed | 4 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › vteHigh: 0.4 dispara (medium); 0.6 resuelve | passed | 4 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › mveLow: 10 dispara (high); 5 resuelve | passed | 4 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › mveHigh: 5 dispara (medium); 10 resuelve | passed | 5 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › rrLow: 20 dispara (medium); 10 resuelve | passed | 4 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › rrHigh: 10 dispara (medium); 20 resuelve | passed | 3 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › peepeLow: 8 dispara (medium); 3 resuelve | passed | 1 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › peepeHigh: 5 dispara (medium); 20 resuelve | passed | 8 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › fio2Low: 0.3 dispara (medium); 0.18 resuelve | passed | 4 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › fio2High: 0.24 dispara (medium); 0.99 resuelve | passed | 6 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › Pmáx: bajar el techo por debajo de la presión alcanzada activa la alarma alta y termina la inspiración | passed | 4 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › los límites configurados se conservan al cargar otro escenario | passed | 72 |
| `unit/alarmLimits.test.ts` | ALM-11 · el audio suena según prioridad y respeta la pausa › alta: ráfaga de 10 tonos; media: 3; sin alarma: nada; en pausa de audio: nada; vuelve a sonar tras la cadencia | passed | 0 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-02: reconocer una alarma cuya condición persiste: sigue activa | passed | 11 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-03: resolver sin reconocer deja estado pendiente (banda gris) distinguible de activa | passed | 4 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-07: límite Off no es cero; dato ausente no genera alarma ni valor normal | passed | 0 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-05/06: la alarma Pmáx se traza al valor bruto; varias alarmas concurrentes conservan todas las condiciones | passed | 11 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › FiO2: límites sobre el sensor con retardo; sesgo del instructor separa objetivo y medición (SC-12) | passed | 14 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › el esfuerzo que sobrevive al ciclado dispara una segunda respiración en cuanto pasa el periodo refractario | passed | 19 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › la respiración apilada entra sobre un pulmón sin vaciar: más volumen y más presión | passed | 8 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › el apilamiento genera atrapamiento por sí solo: sin obstrucción ninguna, la PEEP intrínseca sube | passed | 121 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › sin control asistido el mismo esfuerzo no dispara nada: el ciclado sigue siendo por tiempo | passed | 6 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › el mismo esfuerzo deja de disparar al subir la resistencia espiratoria, porque antes debe vencer la PEEP intrínseca | passed | 70 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › el esfuerzo inefectivo deja su huella en la curva de flujo: el vaciamiento deja de ser monótono | passed | 30 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › la Pva no se deforma durante un esfuerzo inefectivo: la válvula sostiene la PEEP mientras la demanda no supere el flujo de base | passed | 36 |
| `unit/boundaries.test.ts` | setAlarmLimits se valida como cualquier ajuste › rechaza texto, NaN, negativos, claves desconocidas, null y bajo ≥ alto; acepta Off y valores en rejilla | passed | 8 |
| `unit/boundaries.test.ts` | setAlarmLimits se valida como cualquier ajuste › increaseO2Start con delta negativo, NaN o > 100 % se rechaza; setSpeed no numérico se ignora | passed | 11 |
| `unit/boundaries.test.ts` | importación acotada › rechaza finalSimTimeMs enorme, negativo o textual, breaths ausente y comandos sin carga útil | passed | 2 |
| `unit/boundaries.test.ts` | cliente del motor: fallo del Worker no es silencioso › si el Worker nunca saluda, degrada al modo en página, avisa y sigue funcionando | passed | 54 |
| `unit/commandHandlers.test.ts` | ARQ-02 · manejadores de comandos › hay exactamente un manejador por tipo de comando declarado en el dominio | passed | 2 |
| `unit/commandHandlers.test.ts` | ARQ-02 · manejadores de comandos › un tipo desconocido se rechaza sin lanzar y sin registrar | passed | 4 |
| `unit/commandHandlers.test.ts` | ARQ-02 · manejadores de comandos › los manejadores sólo ven el contexto: setVentilation y registro pasan por la interfaz | passed | 1 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › con válvula ideal la Pva salta a PEEP en un paso y el flujo arranca en su pico | passed | 57 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › con apertura de 40 ms la Pva parte cerca de la presión alveolar y desciende hasta la PEEP | passed | 11 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › el flujo espiratorio alcanza su pico después de abrirse la válvula, no en el primer instante | passed | 10 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › la apertura no cambia el volumen espirado ni la PEEP total de forma apreciable | passed | 9 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › una apertura fuera de 0–200 ms se rechaza | passed | 1 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › sin limitación el flujo espiratorio es (Pel − Paw)/Rexp; con ella queda en (Pel − pcrit)/(f·Rexp) | passed | 1 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › es independiente del esfuerzo espiratorio y de la presión aguas abajo: eso es la meseta de flujo | passed | 0 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › con Paw ≥ pcrit no hay colapso y el flujo vuelve a ser el de la ecuación de movimiento | passed | 0 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › durante la limitación el volumen decae hacia C·pcrit con tau = f·Rexp·C, no hacia el volumen de PEEP | passed | 1 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › el resultado no depende del paso de integración | passed | 2 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › con PEEP por debajo del punto crítico el pulmón atrapa hasta que el retroceso iguala pcrit | passed | 110 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › subir la PEEP hasta el punto crítico quita la limitación sin aumentar apenas la PEEP total | passed | 198 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › sin limitación el mismo pulmón no atrapa nada a PEEP 3 | passed | 8 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › una limitación fuera de rango se rechaza | passed | 1 |
| `unit/flowLimitation.test.ts` | EFL-03 · resistencia espiratoria dependiente del volumen › la resistencia crece al vaciarse y coincide con la nominal en el volumen de referencia | passed | 0 |
| `unit/flowLimitation.test.ts` | EFL-03 · resistencia espiratoria dependiente del volumen › sin dependencia la relación flujo-volumen es una recta; con ella la rama queda por debajo de la cuerda | passed | 24 |
| `unit/flowLimitation.test.ts` | EFL-03 · resistencia espiratoria dependiente del volumen › una dependencia fuera de rango se rechaza | passed | 0 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › el generador es determinista y acotado: misma semilla, misma secuencia; ganancia dentro de ±fracción | passed | 3 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › fracción 0 devuelve ganancia exacta y no altera la secuencia posterior | passed | 0 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › el VTe mostrado varía ~±2,5 % entre ciclos mientras el volumen verdadero del modelo no cambia | passed | 22 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › VTi y VTe comparten la ganancia del sensor: la fuga mostrada sigue siendo nula | passed | 12 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › el banco analítico no lleva ruido: VTe mostrado = VTe verdadero | passed | 1 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › la reproducción de una sesión repite las mismas lecturas (mismo semilla, misma secuencia) | passed | 12 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › las alarmas de volumen comparan el valor medido, no el verdadero | passed | 4 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › una variabilidad fuera de 0–10 % se rechaza | passed | 0 |
| `unit/physics.test.ts` | PHY-06 · cambiar PEEP conserva el volumen pulmonar; no se suma PEEP dos veces › PEEP 5 → 10: V continuo en el instante del cambio, PEEPe medida sube a 10 y Pplat = 10 + VT/C = 20 | passed | 22 |
| `unit/physics.test.ts` | PHY-06 · cambiar PEEP conserva el volumen pulmonar; no se suma PEEP dos veces › la curva de volumen tidal se reinicia por respiración sin reiniciar el volumen absoluto | passed | 2 |
| `unit/physics.test.ts` | PHY-07 · el vaciamiento determina la auto-PEEP (BM-04 en el motor) › Rexp 30 y Texp corto producen PEEPtot > PEEP; alargar la espiración la reduce | passed | 16 |
| `unit/physics.test.ts` | PHY-08 · R, C y Pmus cambian señales y métricas distintas › subir Rinsp sube Ppico y no Pplat; bajar C sube ambas | passed | 2 |
| `unit/physics.test.ts` | PHY-08 · R, C y Pmus cambian señales y métricas distintas › el esfuerzo dispara respiraciones asistidas (no espontáneas) sólo si supera el trigger | passed | 32 |
| `unit/physics.test.ts` | PHY-10 · dominio de fallo del ensayo › resistencia alta (Rinsp 60) y C baja (5 mL/cmH2O): sin NaN ni infinitos; Pmáx termina la inspiración con volumen parcial | passed | 13 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-01: el resultado del bloqueo conserva su hora y valores tras muchas respiraciones (abrir/cerrar ventana) | passed | 44 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-02: bloqueo con esfuerzo del escenario (SC-10) resulta inválido por meseta perturbada; sin Cstat fabricada | passed | 4 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-03: cancelar dos veces es seguro; ↑O2 restaura una sola vez y respeta una edición del usuario | passed | 26 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-05: un segundo bloqueo mientras hay uno en cola se rechaza con motivo | passed | 0 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › un bloqueo cancelado en curso deja resultado «cancelled» con duración parcial y no borra el válido anterior del historial | passed | 3 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › resp manual: elegible sólo en espiración; produce una respiración de tipo manual | passed | 1 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › DAT-04: el comparador rechaza combinar Pplat y VT de respiraciones distintas | passed | 5 |
| `unit/procedures.test.ts` | espera (standby) como transacción › entrar en espera detiene la entrega, las métricas pasan a no disponibles y la numeración continúa al reanudar | passed | 4 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › defaultInit declara el perfil; profileFor resuelve el de referencia y rechaza ids desconocidos | passed | 1 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › el motor rechaza una inicialización cuyo profileId no coincide con el perfil inyectado | passed | 0 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › el motor usa las reglas del perfil inyectado (no un módulo concreto) | passed | 0 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › una sesión sin profileId (anterior a 0.3.3) se importa con el perfil de referencia; un profileId desconocido se rechaza | passed | 7 |
| `unit/review.test.ts` | H1 · ↑O2: ajuste, mezclador y sensor vuelven juntos (regla 1) › fin por temporizador restaura también el mezclador | passed | 37 |
| `unit/review.test.ts` | H1 · ↑O2: ajuste, mezclador y sensor vuelven juntos (regla 1) › fin por espera restaura también el mezclador | passed | 1 |
| `unit/review.test.ts` | H2 · orden manual y disparo en el mismo sub-paso: sin respiraciones apiladas › con esfuerzo fuerte y control asistido, una orden manual produce exactamente una respiración manual y ninguna espiración de un sub-paso | passed | 15 |
| `unit/review.test.ts` | H3 · espera durante un bloqueo espiratorio en curso › no emite respiraciones fantasma, no activa alarmas en espera y el bloqueo queda cancelado | passed | 3 |
| `unit/review.test.ts` | H4 · poner un límite en Off resuelve la alarma activa (Off = no se evalúa, no estado congelado) › VTesp bajo activa → Off → resuelta y reconocida; banda verde | passed | 2 |
| `unit/review.test.ts` | H5 · una inspiración acortada por Pmáx no acorta el periodo obligatorio › FR medida ≈ FR programada aunque cada inspiración termine a 0.8 s por Pmáx | passed | 7 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › el constructor rechaza FR negativa y un paciente con tau < 1 ms | passed | 1 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › requestHold con duración no numérica o fuera de rango se rechaza; setPatient con R diminuta se rechaza | passed | 1 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › importSession rechaza ajustes fuera de dominio y pacientes degenerados | passed | 1 |
| `unit/review.test.ts` | H7 · importar una sesión no hereda perturbaciones del escenario previo › tras cargar SC-02 (C cambia a 20 s) e importar una sesión de banco, la C importada permanece | passed | 35 |
| `unit/review.test.ts` | H8 · Pplat de ciclo nunca es válida en una respiración terminada por Pmáx › con pausa programada y Pmáx durante la pausa, pplatCycle es null con motivo endedByPmax | passed | 1 |
| `unit/review.test.ts` | H13 · bloqueo espiratorio con paciente que dispara continuamente › se ejecuta al final de la espiración aunque la termine un disparo, y resulta inválido con motivo | passed | 2 |
| `unit/review.test.ts` | audio en pausa como estado del motor (replay) › audioPause fija audioPauseUntilMs = t + 120 s y el replay lo reproduce | passed | 4 |
| `unit/review3.test.ts` | R3-01 · tope de flujo del actuador en PC sin sobreimpulso ni Pmáx falsa › C 5 mL/cmH₂O, R 0.5, Pmáx 17: la presión no supera PEEP + Pinsp y la inspiración termina por tiempo | passed | 28 |
| `unit/review3.test.ts` | R3-01 · tope de flujo del actuador en PC sin sobreimpulso ni Pmáx falsa › la Ppico con tope activo no depende del paso de integración (4 ms vs 1 ms) | passed | 15 |
| `unit/review3.test.ts` | R3-02 · el VTi nunca es negativo en PC tras bajar la PEEP › PEEP 10 → 5 con Pinsp 3: el volumen que sale cuenta como espirado | passed | 3 |
| `unit/review3.test.ts` | R3-03 · flujo de base espiratorio: el esfuerzo hunde la Pva y no inhala sin límite › sin asistencia, un esfuerzo de 8 cmH₂O en espiración baja la Pva por debajo de PEEP y VTe − VTi queda acotado por el flujo de base | passed | 49 |
| `unit/review3.test.ts` | R3-03 · flujo de base espiratorio: el esfuerzo hunde la Pva y no inhala sin límite › con asistencia, el mismo esfuerzo sigue disparando por flujo (2 L/min) | passed | 25 |
| `unit/review3.test.ts` | R3-04 · aviso «Presión limitada por Plimit» › con Plimit 7 el cuadro marca «limitado por Plimit» sin alarma; al subir Plimit el indicador desaparece | passed | 3 |
| `unit/review3.test.ts` | R3-04 · aviso «Presión limitada por Plimit» › Plimit por encima de Pmáx se acepta con aviso no bloqueante | passed | 0 |
| `unit/review3.test.ts` | R3-05 · Cstat del bloqueo inspiratorio usa PEEPtot cuando hay bloqueo espiratorio válido › con atrapamiento (Rexp 30, FR 30) la Cstat vuelve a 50 mL/cmH₂O tras medir PEEPtot | passed | 31 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › confirmSettings rechaza claves desconocidas y modos inexistentes sin tocar los ajustes | passed | 1 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › el constructor rechaza esfuerzo y sensores no finitos o fuera de rango | passed | 1 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › la duración del bloqueo debe estar en la rejilla de su tipo (insp 2–40, esp 2–60) | passed | 0 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › pasar a espera durante un bloqueo lo cierra con motivo «cancelledByStandby», no «cancelado por el usuario» | passed | 1 |
| `unit/review3.test.ts` | R3-07 · sesiones: PC se reimporta; versiones de motor aceptadas o rechazadas de forma explícita › una sesión en A/C PC exporta e importa sin error | passed | 2 |
| `unit/review3.test.ts` | R3-07 · sesiones: PC se reimporta; versiones de motor aceptadas o rechazadas de forma explícita › engineVersion 0.2.0 se acepta con aviso; 0.1.0 se rechaza; esfuerzo absurdo en init se rechaza | passed | 1 |
| `unit/review3.test.ts` | R3-08 · un arranque fallido nunca es silencioso › el anfitrión responde initError y el cliente lo notifica por onDegraded | passed | 0 |
| `unit/review3.test.ts` | R3-08 · un arranque fallido nunca es silencioso › una orden pendiente al degradar el Worker se responde como rechazada en vez de quedar colgada | passed | 0 |
| `unit/review3.test.ts` | R3-09 · bloqueo inspiratorio rechazado por Pmáx queda registrado › SC-09-like (Rinsp 400): resultado inválido, con motivo y hora | passed | 4 |
| `unit/review4.test.ts` | R4-01 · ningún número no finito sale como válido › un tramo de duración nula no produce NaN, ni siquiera con elastancia viscoelástica cero | passed | 2 |
| `unit/review4.test.ts` | R4-01 · ningún número no finito sale como válido › el barrido de dos unidades con Plimit ya no diverge a ningún paso | passed | 91 |
| `unit/review4.test.ts` | R4-01 · ningún número no finito sale como válido › si el modelo divergiera, la métrica se publica como inválida y queda un evento en el registro | passed | 18 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › con la válvula cerrada ninguna unidad sortea la resistencia en serie | passed | 0 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › el tope de flujo del actuador acota el flujo TOTAL, no sólo el de una rama | passed | 0 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › en presión control con dos unidades el flujo pico respeta el tope del actuador | passed | 34 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › el flujo de base acota lo que el paciente puede inhalar en espiración también con dos unidades | passed | 98 |
| `unit/review4.test.ts` | R4-03 · lo que se publica es lo que se mide › durante una oclusión la Pva es la del nodo, no la de una unidad | passed | 7 |
| `unit/review4.test.ts` | R4-03 · lo que se publica es lo que se mide › la curva de volumen suma las dos unidades: coincide con el VT entregado | passed | 16 |
| `unit/review4.test.ts` | R4-04 · órdenes de banco que dejan el estado coherente › fijar el volumen absoluto no inventa presión viscoelástica ni descuadra el total | passed | 3 |
| `unit/review4.test.ts` | R4-04 · órdenes de banco que dejan el estado coherente › quitar la segunda unidad conserva el gas en vez de hacerlo desaparecer | passed | 7 |
| `unit/review4.test.ts` | R4-04 · órdenes de banco que dejan el estado coherente › al reanudar tras espera la primera Cstat usa la PEEP y no cero | passed | 8 |
| `unit/review4.test.ts` | R4-05 · el elástico se describe con una sola función › la presión de equilibrio coincide con la meseta real de una oclusión larga, también con sigmoide | passed | 22 |
| `unit/review4.test.ts` | R4-06 · la forma cerrada del nodo coincide con la bisección › con ramas lineales el nodo resuelto en forma cerrada da el mismo flujo total pedido | passed | 0 |
| `unit/review4.test.ts` | R4-06 · la forma cerrada del nodo coincide con la bisección › con ramas no lineales cae a la bisección y sigue invirtiendo | passed | 0 |
| `unit/review4.test.ts` | R4-07 · el solucionador del nodo no se dispara › con ramas lineales el nodo se resuelve en forma cerrada: cero bisecciones | passed | 5 |
| `unit/review4.test.ts` | R4-07 · el solucionador del nodo no se dispara › la combinación más costosa se mantiene acotada | passed | 1145 |
| `unit/security.test.ts` | SEC-01 · inspección estática: sin WebUSB/WebSerial/Bluetooth ni conexiones externas en el código fuente › ninguna referencia a navigator.usb/serial/bluetooth, WebSocket, fetch externo ni eval | passed | 6 |
| `unit/security.test.ts` | SEC-01 · inspección estática: sin WebUSB/WebSerial/Bluetooth ni conexiones externas en el código fuente › sin dependencias de ejecución en package.json (aplicación local, sin backend) | passed | 0 |
| `unit/session.test.ts` | TIM · reproducibilidad › TIM-02: misma inicialización y comandos → mismos registros de respiración | passed | 30 |
| `unit/session.test.ts` | TIM · reproducibilidad › TIM-01: la cadencia de lectura de cuadros no altera la fisiología | passed | 33 |
| `unit/session.test.ts` | SEC-03 · importación robusta › rechaza JSON malformado, tamaño excesivo, comandos no permitidos, números no finitos y claves desconocidas | passed | 3 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › está anclada en V(P0) = 0 y es su propia inversa en todo el intervalo útil | passed | 1 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › la compliance máxima vale b/(4d) en P = c y es simétrica alrededor de ese punto | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › el mismo incremento de volumen cuesta mucha más presión arriba que en la zona media: eso es el pico de sobredistensión | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › por encima de la capacidad la presión sigue siendo finita y monótona (extensión tangente) | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › sin sigmoide el modelo sigue siendo lineal | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-02 · titulación de PEEP sobre la sigmoide › la compliance medida dibuja una U invertida: baja colapsada, máxima cerca de c y baja otra vez por sobredistensión | passed | 58 |
| `unit/sigmoid.test.ts` | SIG-02 · titulación de PEEP sobre la sigmoide › el volumen inicial de equilibrio usa la sigmoide, no la compliance lineal | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-02 · titulación de PEEP sobre la sigmoide › una sigmoide fuera de rango se rechaza | passed | 1 |
| `unit/sync.test.ts` | SYN-01 · flujo de base programable › con flujo de base 10 L/min el paciente toma hasta 10 L/min sin hundir la Pva; con 2 L/min la hunde antes | passed | 79 |
| `unit/sync.test.ts` | SYN-01 · flujo de base programable › el disparo por flujo no puede superar el flujo de base (motivo legible) | passed | 0 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › con umbral −2 cmH₂O el esfuerzo dispara asistidas; con −10 no llega y las respiraciones siguen siendo mandatorias | passed | 17 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › el disparo por presión ignora el umbral de flujo (flujo de disparo alto no bloquea) | passed | 5 |
| `unit/sync.test.ts` | SYN-03 · resistencia de la rama espiratoria › con 3 cmH₂O·s/L la Pva queda por encima de PEEP al inicio de la espiración y el flujo pico espiratorio baja; el VT espirado se conserva | passed | 31 |
| `unit/sync.test.ts` | SYN-03 · resistencia de la rama espiratoria › se valida en 0–6 y se conserva en la sesión | passed | 2 |
| `unit/twoCompartment.test.ts` | PEN-01 · pendelluft con el circuito ocluido › el gas pasa de la unidad rápida a la lenta y las presiones convergen con tau = (R1+R2)·C1·C2/(C1+C2) | passed | 7 |
| `unit/twoCompartment.test.ts` | PEN-01 · pendelluft con el circuito ocluido › el reparto no depende del paso de integración | passed | 1 |
| `unit/twoCompartment.test.ts` | PEN-01 · pendelluft con el circuito ocluido › la presión del nodo con flujo impuesto es la media ponderada por las conductancias | passed | 0 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › el vaciamiento deja de ser una sola exponencial: al final domina la constante lenta | passed | 51 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › la meseta de una oclusión depende de su duración: el pendelluft sigue moviendo gas | passed | 47 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › con una sola unidad la meseta no depende de la duración | passed | 38 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › el volumen absoluto del panel docente suma las dos unidades | passed | 3 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-01: seleccionar PEEP y girar sin confirmar no emite cambios | passed | 1 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-02: confirmar una edición válida emite un único evento con el nuevo valor interno | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-03: cancelar o vencer el plazo descarta el borrador (plazo identificado como propuesto) | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-06: la rueda sin selección no altera nada; el bloqueo de pantalla impide editar | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › un valor inválido produce explicación y no se aproxima: VT hasta hacer el flujo > 160 L/min | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › PEEP: bajar desde 1 lleva a Off y subir desde Off lleva a 1 (Off no es 0) | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › seleccionar otra tecla descarta el borrador anterior sin aplicarlo | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › vista previa muestra consecuencias cruzadas (Tinsp y flujo derivados) antes de confirmar | passed | 0 |
| `unit/uiState.test.ts` | menú de modo como transacción › cancelar restaura todos los ajustes; confirmar entrega sólo los cambiados | passed | 0 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › VT: 300 → 325 al subir; 300 → 295 al bajar; 1000 → 1050 / 975 | passed | 1 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › 285 mL está en rejilla; 287 no; 300 no se convierte en 325 al cambiar de vista | passed | 0 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › trigger de flujo: 3.0 → 3.5 al subir; 3.0 → 2.9 al bajar | passed | 0 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › I:E discreto: 1:1.5 sube a 1:1 y baja a 1:2; extremos 1:9 y 4:1 | passed | 0 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › propiedad: subir y bajar desde un valor en rejilla (no extremo) devuelve el mismo valor | passed | 29 |
| `unit/validation.test.ts` | restricciones cruzadas (P sobre rangos D) › VT 2 L con Tinsp 0.5 s exige 240 L/min > 160: inválido con explicación, sin aproximar | passed | 0 |
| `unit/validation.test.ts` | restricciones cruzadas (P sobre rangos D) › FR 120 con I:E 4:1 deja Texp 0.1 s < 0.25: inválido | passed | 0 |
| `unit/validation.test.ts` | restricciones cruzadas (P sobre rangos D) › Pmáx ≤ PEEP es inválido; el banco es válido y deriva flujo 0.5 L/s | passed | 0 |
| `unit/validation.test.ts` | rejilla de valores admitidos (deslizador por índice) › gridValues enumera cada tramo con su paso y sin duplicar fronteras | passed | 1 |
| `unit/validation.test.ts` | rejilla de valores admitidos (deslizador por índice) › nearestGridValue devuelve un valor admitido y el más cercano | passed | 2 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › con E2 = 0 el modelo es exactamente el de un compartimento | passed | 2 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › inflado a flujo constante: la separación V − Vve sigue Q·tau·(1 − e^(−t/tau)) y no depende del paso | passed | 1 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › oclusión: caída inmediata resistiva (Ppico − P1 = R·Q) y luego decaimiento exponencial hasta la meseta estática | passed | 0 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › tras 6 constantes la meseta está a menos de 1 % del valor estático | passed | 0 |
| `unit/viscoelastic.test.ts` | VIS-02 · consecuencias en el ventilador › el bloqueo inspiratorio mide una meseta por encima de la estática y la Cstat resultante subestima la compliance | passed | 21 |
| `unit/viscoelastic.test.ts` | VIS-02 · consecuencias en el ventilador › una pausa corta no da meseta de ciclo: la presión sigue cayendo y se declara inestable | passed | 12 |
| `unit/viscoelastic.test.ts` | VIS-02 · consecuencias en el ventilador › sin relajación la misma pausa sí da meseta estable | passed | 3 |
| `unit/viscoelastic.test.ts` | VIS-03 · resistencia no lineal de Rohrer › con K2 = 5, duplicar el flujo multiplica la caída resistiva por 2,4 en vez de por 2 | passed | 36 |
| `unit/viscoelastic.test.ts` | VIS-03 · resistencia no lineal de Rohrer › K2 no cambia la meseta: la carga elástica es la misma | passed | 4 |
| `unit/viscoelastic.test.ts` | VIS-03 · resistencia no lineal de Rohrer › K2 fuera de 0–50 se rechaza | passed | 1 |
| `unit/viscoelastic.test.ts` | VIS-04 · la PEEPe de referencia no se contamina con la oclusión previa › tras un bloqueo espiratorio con atrapamiento, el ΔP y la Cstat del siguiente bloqueo usan PEEP, no PEEP total | passed | 12 |

## Playwright · 85 pasadas / 0 fallidas / 2 omitidas (por diseño: la prueba móvil sólo corre en el proyecto móvil)

| Proyecto | Archivo | Prueba | Estado | ms |
| --- | --- | --- | --- | --- |
| desktop-1280 | `interaction.spec.ts` | ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela | passed | 1255 |
| desktop-1280 | `interaction.spec.ts` | ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia | passed | 4357 |
| desktop-1280 | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 738 |
| desktop-1280 | `interaction.spec.ts` | INT-02 · confirmar edición válida: se aplica en la siguiente respiración | passed | 1303 |
| desktop-1280 | `interaction.spec.ts` | INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima | passed | 335 |
| desktop-1280 | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 2872 |
| desktop-1280 | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 1420 |
| desktop-1280 | `interaction.spec.ts` | INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor | passed | 1154 |
| desktop-1280 | `interaction.spec.ts` | INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada | passed | 834 |
| desktop-1280 | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel | passed | 3183 |
| desktop-1280 | `interaction.spec.ts` | SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel | passed | 462 |
| desktop-1280 | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa explícita con aviso; reanudación manual sin salto de reloj | passed | 2613 |
| desktop-1280 | `mobile.spec.ts` | sin desbordamiento global; el editor de ajustes se muestra legible fuera del monitor | skipped | 1 |
| desktop-1280 | `pc.spec.ts` | Escape cierra primero el diálogo y el reloj del monitor muestra la hora del día | passed | 393 |
| desktop-1280 | `pc.spec.ts` | PEEP: el primer paso del deslizador es Off, no 0 | passed | 285 |
| desktop-1280 | `pc.spec.ts` | VTesp bajo y FR alta configurados en el diálogo se activan mientras ventila y se reflejan en la banda | passed | 4192 |
| desktop-1280 | `pc.spec.ts` | bloqueo inspiratorio rechazado por Pmáx: resultado no válido con motivo legible y aviso | passed | 1285 |
| desktop-1280 | `pc.spec.ts` | cambiar a A/C PC desde el menú de modos: teclas rápidas, curvas y VT esperado | passed | 2745 |
| desktop-1280 | `pc.spec.ts` | deslizador recorre sólo valores admitidos; ± y deslizador coinciden; escritura fuera de rejilla sugiere el más cercano | passed | 1229 |
| desktop-1280 | `pc.spec.ts` | el VTesp mostrado cambia entre ciclos alrededor del volumen programado | passed | 12218 |
| desktop-1280 | `pc.spec.ts` | la columna de presión desciende de forma progresiva al terminar la inspiración | passed | 2695 |
| desktop-1280 | `pc.spec.ts` | menú de modo: flujo de base y disparo por presión; el disparo por flujo no puede superar el flujo de base | passed | 1361 |
| desktop-1280 | `pc.spec.ts` | ▶ es idempotente mientras hay solicitud; «Cancelar» la anula y se anuncia | passed | 646 |
| desktop-1280 | `visual.spec.ts` | VIS-01 + DAT-02 · P1: panel denso y bloqueo; Pplat de bloqueo 32 y Cstat 19 fechados | passed | 424 |
| desktop-1280 | `visual.spec.ts` | VIS-02 + DAT-01 · P3: datos grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 438 |
| desktop-1280 | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro | passed | 658 |
| desktop-1280 | `visual.spec.ts` | VIS-04 · alarma de Pmáx (SC-09): banda roja, luz del bisel y celda resaltada | passed | 2328 |
| desktop-1280 | `visual.spec.ts` | VIS-05 · vistas de bucles, tabla, tendencias y registro son funcionales | passed | 1685 |
| desktop-1280 | `visual.spec.ts` | VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3 | passed | 1407 |
| desktop-1440 | `interaction.spec.ts` | ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela | passed | 1276 |
| desktop-1440 | `interaction.spec.ts` | ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia | passed | 4406 |
| desktop-1440 | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 758 |
| desktop-1440 | `interaction.spec.ts` | INT-02 · confirmar edición válida: se aplica en la siguiente respiración | passed | 1320 |
| desktop-1440 | `interaction.spec.ts` | INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima | passed | 352 |
| desktop-1440 | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 2909 |
| desktop-1440 | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 1527 |
| desktop-1440 | `interaction.spec.ts` | INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor | passed | 1055 |
| desktop-1440 | `interaction.spec.ts` | INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada | passed | 847 |
| desktop-1440 | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel | passed | 3244 |
| desktop-1440 | `interaction.spec.ts` | SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel | passed | 447 |
| desktop-1440 | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa explícita con aviso; reanudación manual sin salto de reloj | passed | 2641 |
| desktop-1440 | `mobile.spec.ts` | sin desbordamiento global; el editor de ajustes se muestra legible fuera del monitor | skipped | 0 |
| desktop-1440 | `pc.spec.ts` | Escape cierra primero el diálogo y el reloj del monitor muestra la hora del día | passed | 356 |
| desktop-1440 | `pc.spec.ts` | PEEP: el primer paso del deslizador es Off, no 0 | passed | 295 |
| desktop-1440 | `pc.spec.ts` | VTesp bajo y FR alta configurados en el diálogo se activan mientras ventila y se reflejan en la banda | passed | 4121 |
| desktop-1440 | `pc.spec.ts` | bloqueo inspiratorio rechazado por Pmáx: resultado no válido con motivo legible y aviso | passed | 1297 |
| desktop-1440 | `pc.spec.ts` | cambiar a A/C PC desde el menú de modos: teclas rápidas, curvas y VT esperado | passed | 3485 |
| desktop-1440 | `pc.spec.ts` | deslizador recorre sólo valores admitidos; ± y deslizador coinciden; escritura fuera de rejilla sugiere el más cercano | passed | 1225 |
| desktop-1440 | `pc.spec.ts` | el VTesp mostrado cambia entre ciclos alrededor del volumen programado | passed | 12233 |
| desktop-1440 | `pc.spec.ts` | la columna de presión desciende de forma progresiva al terminar la inspiración | passed | 2714 |
| desktop-1440 | `pc.spec.ts` | menú de modo: flujo de base y disparo por presión; el disparo por flujo no puede superar el flujo de base | passed | 2242 |
| desktop-1440 | `pc.spec.ts` | ▶ es idempotente mientras hay solicitud; «Cancelar» la anula y se anuncia | passed | 630 |
| desktop-1440 | `visual.spec.ts` | VIS-01 + DAT-02 · P1: panel denso y bloqueo; Pplat de bloqueo 32 y Cstat 19 fechados | passed | 738 |
| desktop-1440 | `visual.spec.ts` | VIS-02 + DAT-01 · P3: datos grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 469 |
| desktop-1440 | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro | passed | 642 |
| desktop-1440 | `visual.spec.ts` | VIS-04 · alarma de Pmáx (SC-09): banda roja, luz del bisel y celda resaltada | passed | 2358 |
| desktop-1440 | `visual.spec.ts` | VIS-05 · vistas de bucles, tabla, tendencias y registro son funcionales | passed | 1807 |
| desktop-1440 | `visual.spec.ts` | VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3 | passed | 1535 |
| mobile | `interaction.spec.ts` | ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela | passed | 1356 |
| mobile | `interaction.spec.ts` | ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia | passed | 4509 |
| mobile | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 373 |
| mobile | `interaction.spec.ts` | INT-02 · confirmar edición válida: se aplica en la siguiente respiración | passed | 1303 |
| mobile | `interaction.spec.ts` | INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima | passed | 376 |
| mobile | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 2926 |
| mobile | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 1521 |
| mobile | `interaction.spec.ts` | INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor | passed | 897 |
| mobile | `interaction.spec.ts` | INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada | passed | 1171 |
| mobile | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel | passed | 3285 |
| mobile | `interaction.spec.ts` | SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel | passed | 461 |
| mobile | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa explícita con aviso; reanudación manual sin salto de reloj | passed | 2737 |
| mobile | `mobile.spec.ts` | sin desbordamiento global; el editor de ajustes se muestra legible fuera del monitor | passed | 543 |
| mobile | `pc.spec.ts` | Escape cierra primero el diálogo y el reloj del monitor muestra la hora del día | passed | 353 |
| mobile | `pc.spec.ts` | PEEP: el primer paso del deslizador es Off, no 0 | passed | 397 |
| mobile | `pc.spec.ts` | VTesp bajo y FR alta configurados en el diálogo se activan mientras ventila y se reflejan en la banda | passed | 4166 |
| mobile | `pc.spec.ts` | bloqueo inspiratorio rechazado por Pmáx: resultado no válido con motivo legible y aviso | passed | 1353 |
| mobile | `pc.spec.ts` | cambiar a A/C PC desde el menú de modos: teclas rápidas, curvas y VT esperado | passed | 2671 |
| mobile | `pc.spec.ts` | deslizador recorre sólo valores admitidos; ± y deslizador coinciden; escritura fuera de rejilla sugiere el más cercano | passed | 2344 |
| mobile | `pc.spec.ts` | el VTesp mostrado cambia entre ciclos alrededor del volumen programado | passed | 12288 |
| mobile | `pc.spec.ts` | la columna de presión desciende de forma progresiva al terminar la inspiración | passed | 2778 |
| mobile | `pc.spec.ts` | menú de modo: flujo de base y disparo por presión; el disparo por flujo no puede superar el flujo de base | passed | 2291 |
| mobile | `pc.spec.ts` | ▶ es idempotente mientras hay solicitud; «Cancelar» la anula y se anuncia | passed | 721 |
| mobile | `visual.spec.ts` | VIS-01 + DAT-02 · P1: panel denso y bloqueo; Pplat de bloqueo 32 y Cstat 19 fechados | passed | 519 |
| mobile | `visual.spec.ts` | VIS-02 + DAT-01 · P3: datos grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 507 |
| mobile | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro | passed | 760 |
| mobile | `visual.spec.ts` | VIS-04 · alarma de Pmáx (SC-09): banda roja, luz del bisel y celda resaltada | passed | 2485 |
| mobile | `visual.spec.ts` | VIS-05 · vistas de bucles, tabla, tendencias y registro son funcionales | passed | 1856 |
| mobile | `visual.spec.ts` | VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3 | passed | 1704 |

## Capturas (docs/capturas)

| Archivo | Contenido | Metadatos |
| --- | --- | --- |
| `vis-01-p1-fixture-desktop-1440.png` | vis-01-p1-fixture | desktop-1440 1440×1000 · t=0 ms · motor worker |
| `vis-02-p3-fixture-desktop-1440.png` | vis-02-p3-fixture | desktop-1440 1440×1000 · t=0 ms · motor worker |
| `vis-03-live-sc01-t12s-desktop-1440.png` | vis-03-live-sc01-t12s | desktop-1440 1440×1000 · t=12000 ms · motor worker |
| `vis-03-mobile-mobile.png` | vis-03-mobile | mobile 412×839 · t=8000 ms · motor worker |
| `vis-04-alarm-sc09-t20s-desktop-1440.png` | vis-04-alarm-sc09-t20s | desktop-1440 1440×1000 · t=20000 ms · motor worker |
| `vis-05-loops-desktop-1440.png` | vis-05-loops | desktop-1440 1440×1000 · t=16000 ms · motor worker |
| `vis-06-pc-sc13-t16s-desktop-1440.png` | vis-06-pc-sc13-t16s | desktop-1440 1440×1000 · t=16000 ms · motor worker |
| `vis-07-basic-p3-layout-desktop-1440.png` | vis-07-basic-p3-layout | desktop-1440 1440×1000 · t=16000 ms · motor worker |

## Identificadores de prueba presentes

Un identificador cuenta como habilitado sólo si todas las pruebas que lo citan pasan. ACC-01, ALM-02, ALM-03, ALM-05, ALM-07, ALM-10, ALM-11, BM-01, BM-02, BM-03, BM-04, BM-05, BM-06, BM-07, BM-08, DAT-01, DAT-02, DAT-04, INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, PHY-02, PHY-06, PHY-07, PHY-08, PHY-10, PRC-01, PRC-02, PRC-03, PRC-05, SEC-01, SEC-03, TIM-01, TIM-02, TIM-03, VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, VIS-06.


## No ejecutado en esta etapa

ALM-04 automatizada de extremo a extremo (pausa de audio); PHY-03 (CPAP/PS: esfuerzo, disparo, ciclaje, respaldo; modo no habilitado); PHY-05 (fuga no modelada); PRC-04 (SBT); DAT-05 en UI; DAT-06 en UI; CFG-04; ACC-02 automatizada; auditoría de accesibilidad formal; revisión experta L3; contraste con equipo de demostración.
