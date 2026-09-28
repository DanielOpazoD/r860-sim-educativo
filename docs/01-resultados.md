# Resultados de pruebas ejecutadas · v0.3.0 (adulto A/C VC + A/C PC + CPAP/PS · interfaz R860 Lab)

Generado el 2026-09-27T17:55:07 con `npm run results:doc` a partir de `test-results/vitest.json` y `test-results/e2e-results.json` (salidas reales). Motor 0.4.0 · perfil r860-es-photo-reference-v1 · dt 4 ms · semilla 1 · t0 2026-08-18T21:04:05-04:00 · Node 24.20.0 · Chromium (Playwright 1.63.0, build 1243).

## Niveles de validación

- **L0 visual**: capturas deterministas en `docs/capturas/` con JSON de metadatos. Comparación por zonas con P1/P3 hecha por la IA constructora; sin baseline aprobada por revisor humano.
- **L1 interacción**: Playwright (abajo).
- **L2 modelo analítico**: Vitest, banco BM-01…BM-08 y PC, físicas y regresiones.
- **L3 revisión experta**: pendiente.

## Vitest · 429 pasadas / 0 fallidas / 429 totales

| Archivo | Prueba | Estado | ms |
| --- | --- | --- | --- |
| `bench/bm.test.ts` | BM-01 · VC con flujo constante (banco lineal pasivo) › Tinsp 1 s, Ppico 20 cmH2O, presión elástica al ocluir 15 cmH2O | passed | 13 |
| `bench/bm.test.ts` | BM-02 · Cstat y resistencia desde la misma respiración › Cstat = 500/(15−5) = 50 mL/cmH2O; R = (20−15)/0.5 = 10 | passed | 8 |
| `bench/bm.test.ts` | BM-03 · Fuente de presión ideal (modelo, no modo PC) › ΔP 10 sobre PEEP 5, R 10, C 0.05, 1 s: VT ≈ 0.432332 L; Q0 = 1 L/s; Qfin ≈ 0.135335 L/s | passed | 1 |
| `bench/bm.test.ts` | BM-04 · Espiración incompleta (atrapamiento) › Rexp 20, C 0.05, exceso 0.5 L, Te 0.5 s: exceso final ≈ 0.303265 L; presión elástica extra ≈ 6.0653 cmH2O | passed | 2 |
| `bench/bm.test.ts` | BM-05 · Unidades › 0.5 L/s → 30 L/min; 0.5 L·1 s → 500 mL; C 0.05 → 50 mL/cmH2O | passed | 0 |
| `bench/bm.test.ts` | BM-05 · Unidades › el motor no confunde unidades: VTesp de banco = 500 mL exactos | passed | 8 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › Plimit 25 (< Pmáx 40): el flujo cae para mantener 25 durante el Tinsp restante; VT real < VT programado; ciclo por tiempo | passed | 5 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › Pmáx 30 (< Plimit 60): alcanzar Pmáx TERMINA la inspiración a 0.8 s; VT = 0.4 L; alarma Pmáx activa | passed | 2 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › no fuerza el volumen objetivo bajo límites: VTesp medido difiere del VT programado | passed | 11 |
| `bench/bm.test.ts` | BM-07 · Conservación de volumen (sin fuga) › por respiración: VTinsp − VTesp = ΔV absoluto; acumulado en 10 respiraciones | passed | 20 |
| `bench/bm.test.ts` | BM-08 · Convergencia con el paso de integración › errores de VT decrecientes para dt = 4, 2, 1 ms en la respiración limitada por presión (RK2) | passed | 7 |
| `bench/bm.test.ts` | BM-08 · Convergencia con el paso de integración › los tiempos de evento (Ppico, Tinsp) no dependen del paso cuando el evento no cae en un múltiplo de dt | passed | 4 |
| `bench/circuito.test.ts` | BM-CC circuito compresible › el pulmón recibe ≈ VT·C/(C+Cc) y la meseta baja acorde | passed | 20 |
| `bench/circuito.test.ts` | BM-CC circuito compresible › la Cstat del bloqueo inspiratorio sale ≈ C + Cc | passed | 13 |
| `bench/circuito.test.ts` | BM-CC circuito compresible › la descompresión al espirar nunca supera el tope del actuador | passed | 4 |
| `bench/disparoReverso.test.ts` | BM-RT · disparo reverso en SC-24 › con latencia 0,5 s la Pmus máxima de cada ciclo cae a inicio+0,5+0,8 ±0,02 s y todas las respiraciones son mandatory | passed | 66 |
| `bench/disparoReverso.test.ts` | BM-RT · disparo reverso en SC-24 › con latencia 1,4 s aparece alguna respiración asistida apilada (< 0,6 s tras el fin de la inspiración previa) | passed | 34 |
| `bench/disparoReverso.test.ts` | BM-RT · disparo reverso en SC-24 › sin `reverse` las trazas de Pva son idénticas a las del esfuerzo apagado sin reverse | passed | 30 |
| `bench/espiracionActiva.test.ts` | BM-EA espiración activa › el pico de flujo espiratorio crece ≥15 % con expAmplitude 8 | passed | 42 |
| `bench/espiracionActiva.test.ts` | BM-EA espiración activa › en estado estable VTe ≥ VTi·0,99 y el pulmón vacía por debajo de su FRC pasiva | passed | 64 |
| `bench/espiracionActiva.test.ts` | BM-EA espiración activa › con limitación al flujo espiratorio, a igual volumen el flujo activo no supera al pasivo en más de 3 % (Starling) | passed | 153 |
| `bench/pc.test.ts` | BM-03 · A/C PC ideal (rampa 0) en el motor › ΔP 10 sobre PEEP 5, R 10, C 0.05, Tinsp 1 s: VT ≈ 0.432332 L; Q0 = 1 L/s; Qfin ≈ 0.135335 L/s; Ppico = PEEP + Pinsp | passed | 51 |
| `bench/pc.test.ts` | BM-03 · A/C PC ideal (rampa 0) en el motor › con rampa de 200 ms el VT coincide con la referencia numérica independiente (< 1 %) | passed | 17 |
| `bench/pc.test.ts` | BM-03 · A/C PC ideal (rampa 0) en el motor › tope de flujo del actuador (160 L/min): con R muy baja la presión no alcanza el objetivo de inmediato | passed | 5 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › duplicar R halva el flujo pico y reduce el VT; Ppico no cambia | passed | 4 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › halvar C reduce el VT (hacia C·ΔP) y acorta la constante de tiempo | passed | 4 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › alargar Tinsp aumenta el VT hasta saturar; el flujo cae a ~cero (fase plana del flujo) | passed | 4 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › cambiar PEEP en PC conserva el volumen y desplaza la línea base: mismo VT (ΔP relativo), Ppico = nuevo PEEP + Pinsp | passed | 8 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › el esfuerzo del paciente aumenta el flujo y el VT con la misma presión de vía aérea | passed | 6 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › BM-07 en PC: conservación de volumen por respiración | passed | 5 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › validación PC: PEEP + Pinsp ≥ Pmáx y rampa > Tinsp se rechazan con explicación; el cambio VC → PC es transacción de siguiente respiración | passed | 5 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › por debajo de la apertura no recluta: r se mantiene 0 y la Cstat es la basal (≈30 mL/cmH₂O) | passed | 56 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › mantener presión por encima de la apertura abre la capacidad ganable: r sube y la meseta baja al mismo VT | passed | 18 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › histéresis: la PEEP decremental devuelve más compliance que la ascendente al mismo nivel | passed | 24 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › por debajo del cierre se desrecluta con su propia constante de tiempo | passed | 7 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › quitar el reclutamiento devuelve el modelo exactamente al lineal | passed | 18 |
| `bench/reguladorPeep.test.ts` | BM-RP · regulador de PEEP: caída transitoria bajo demanda, recuperación en régimen › con fuga estable que el flujo de base cubre la Pva tardía se queda en PEEP: la acción integral no deja caída permanente | passed | 132 |
| `bench/reguladorPeep.test.ts` | BM-RP · regulador de PEEP: caída transitoria bajo demanda, recuperación en régimen › la caída máxima crece con la amplitud del esfuerzo y baja con más flujo de base | passed | 163 |
| `bench/reguladorPeep.test.ts` | BM-RP · regulador de PEEP: caída transitoria bajo demanda, recuperación en régimen › en un escenario con esfuerzo la PEEPe medida se conserva: la traza pre-disparo no se contamina | passed | 8 |
| `bench/viscoelasticoReferencia.test.ts` | BM-VE · preset sano de viscoelasticidad en una oclusión de 3 s › P1 − P2 queda en 0,8–2,5 cmH₂O y P2 ≈ P0 + VT/Crs | passed | 65 |
| `bench/viscoelasticoReferencia.test.ts` | BM-VE · preset sano de viscoelasticidad en una oclusión de 3 s › con el preset SDRA la diferencia P1 − P2 es más del doble que la sana | passed | 32 |
| `bench/viscoelasticoReferencia.test.ts` | BM-VE · preset TET 7,0 mm (K₂ 9,2) › a 0,5 L/s la presión pico sube ≈ K₂·Q² = 2,3 ± 0,4 cmH₂O respecto a K₂ 0 | passed | 30 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › ppeakLow: 30 dispara (medium); 10 resuelve | passed | 34 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › vteLow: 0.6 dispara (medium); 0.4 resuelve | passed | 7 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › vteHigh: 0.4 dispara (medium); 0.6 resuelve | passed | 4 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › mveLow: 10 dispara (high); 5 resuelve | passed | 9 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › mveHigh: 5 dispara (medium); 10 resuelve | passed | 4 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › rrLow: 20 dispara (medium); 10 resuelve | passed | 4 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › rrHigh: 10 dispara (medium); 20 resuelve | passed | 6 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › peepeLow: 8 dispara (medium); 3 resuelve | passed | 6 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › peepeHigh: 5 dispara (medium); 20 resuelve | passed | 2 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › fio2Low: 0.3 dispara (medium); 0.18 resuelve | passed | 3 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › fio2High: 0.24 dispara (medium); 0.99 resuelve | passed | 3 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › Pmáx: bajar el techo por debajo de la presión alcanzada activa la alarma alta y termina la inspiración | passed | 3 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › los límites configurados se conservan al cargar otro escenario | passed | 67 |
| `unit/alarmLimits.test.ts` | ALM-11 · el audio suena según prioridad y respeta la pausa › alta: ráfaga de 10 tonos; media: 3; sin alarma: nada; en pausa de audio: nada; vuelve a sonar tras la cadencia | passed | 1 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-02: reconocer una alarma cuya condición persiste: sigue activa | passed | 14 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-03: resolver sin reconocer deja estado pendiente (banda gris) distinguible de activa | passed | 8 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-07: límite Off no es cero; dato ausente no genera alarma ni valor normal | passed | 0 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-05/06: la alarma Pmáx se traza al valor bruto; varias alarmas concurrentes conservan todas las condiciones | passed | 3 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › FiO2: límites sobre el sensor con retardo; sesgo del instructor separa objetivo y medición (SC-12) | passed | 29 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › el esfuerzo que sobrevive al ciclado dispara una segunda respiración en cuanto pasa el periodo refractario | passed | 30 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › la respiración apilada entra sobre un pulmón sin vaciar: más volumen y más presión | passed | 15 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › el apilamiento genera atrapamiento por sí solo: sin obstrucción ninguna, la PEEP intrínseca sube | passed | 211 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › sin control asistido el mismo esfuerzo no dispara nada: el ciclado sigue siendo por tiempo | passed | 89 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › el mismo esfuerzo deja de disparar al subir la resistencia espiratoria, porque antes debe vencer la PEEP intrínseca | passed | 86 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › el esfuerzo inefectivo deja su huella en la curva de flujo: el vaciamiento deja de ser monótono | passed | 47 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › la Pva se deforma durante un esfuerzo inefectivo y el regulador la recupera antes del siguiente ciclo | passed | 33 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › sin esfuerzo la vía es la de siempre: la Pva espiratoria se queda en PEEP | passed | 69 |
| `unit/boundaries.test.ts` | setAlarmLimits se valida como cualquier ajuste › rechaza texto, NaN, negativos, claves desconocidas, null y bajo ≥ alto; acepta Off y valores en rejilla | passed | 4 |
| `unit/boundaries.test.ts` | setAlarmLimits se valida como cualquier ajuste › increaseO2Start con delta negativo, NaN o > 100 % se rechaza; setSpeed no numérico se ignora | passed | 21 |
| `unit/boundaries.test.ts` | importación acotada › rechaza finalSimTimeMs enorme, negativo o textual, breaths ausente y comandos sin carga útil | passed | 3 |
| `unit/boundaries.test.ts` | cliente del motor: fallo del Worker no es silencioso › si el Worker nunca saluda, degrada al modo en página, avisa y sigue funcionando | passed | 57 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › con Pmus ≈ 0 sólo dibuja Pva y anota que coincide con la presión total | passed | 2 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › con Pmus negativa el eje X incluye el cero con margen negativo | passed | 0 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › con Pva negativa aunque la presión total sea positiva el eje X incluye negativos | passed | 0 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › con volumen negativo el eje Y incluye el cero con margen negativo | passed | 9 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › el esfuerzo se evalúa por ciclo: ciclo pasado pasivo + actual activo no dice «Sin esfuerzo» | passed | 1 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › no lanza con una traza vacía | passed | 1 |
| `unit/bucles.test.ts` | arrowIndices · flechas de sentido del bucle › devuelve tres posiciones repartidas por el ciclo | passed | 1 |
| `unit/bucles.test.ts` | arrowIndices · flechas de sentido del bucle › con menos de 8 muestras no dibuja flechas | passed | 0 |
| `unit/circuitoIdentidad.test.ts` | CIR-01 identidad con circuito incompresible › SC-01 con Cc = 0 da la misma traza que sin el campo | passed | 17 |
| `unit/circuitoIdentidad.test.ts` | CIR-01 identidad con circuito incompresible › SC-13 con Cc = 0 da la misma traza que sin el campo | passed | 9 |
| `unit/circuitoIdentidad.test.ts` | CIR-02 PC con circuito compresible › el pulmón recibe lo mismo y el sensor de la máquina ve más flujo | passed | 17 |
| `unit/circuitoIdentidad.test.ts` | CIR-02 PC con circuito compresible › el flujo del sensor nunca supera el tope del actuador: pulmón, fuga y compresión comparten un solo presupuesto | passed | 9 |
| `unit/cobertura.test.ts` | TIM-04 · presupuesto de pasos del reloj › reparte el tiempo acumulado en pasos enteros y guarda el resto | passed | 2 |
| `unit/cobertura.test.ts` | TIM-04 · presupuesto de pasos del reloj › al superar el presupuesto descarta el exceso en vez de dar un salto gigante | passed | 0 |
| `unit/cobertura.test.ts` | TIM-04 · presupuesto de pasos del reloj › un acumulado imposible no produce pasos | passed | 0 |
| `unit/cobertura.test.ts` | DAT-04 · la guarda del denominador de la Cstat › con menos de 1 cmH2O de presión motriz no se publica una compliance inventada | passed | 0 |
| `unit/cobertura.test.ts` | DAT-04 · la guarda del denominador de la Cstat › con presión motriz suficiente devuelve VT dividido por ella, sin redondear | passed | 0 |
| `unit/cobertura.test.ts` | Pmedia y fuga con referencia independiente, no consigo mismas › la presión media publicada es la integral de la curva dibujada, calculada aparte | passed | 17 |
| `unit/cobertura.test.ts` | Pmedia y fuga con referencia independiente, no consigo mismas › la fuga publicada nunca es negativa, ni cuando el pulmón exhala más de lo que recibió | passed | 20 |
| `unit/cobertura.test.ts` | La sesión exportada sólo contiene lo que el motor aceptó › un comando rechazado no entra en el registro exportable | passed | 25 |
| `unit/cobertura.test.ts` | Las teclas booleanas se pueden editar por el mismo camino que las numéricas › seleccionar, girar y confirmar una tecla booleana da el valor interno booleano | passed | 1 |
| `unit/cobertura.test.ts` | Formatos de pantalla y lenguaje del alumno › las unidades se escriben como en el equipo | passed | 1 |
| `unit/cobertura.test.ts` | Formatos de pantalla y lenguaje del alumno › el reloj de sesión no retrocede ni con entradas absurdas | passed | 0 |
| `unit/cobertura.test.ts` | Formatos de pantalla y lenguaje del alumno › la relación I:E se escribe como la lee un clínico | passed | 2 |
| `unit/cobertura.test.ts` | Formatos de pantalla y lenguaje del alumno › los códigos internos se traducen a lenguaje clínico, y lo desconocido no se inventa | passed | 4 |
| `unit/cobertura.test.ts` | Los ejes de las curvas tienen que caber los datos › el suelo del eje de volumen baja hasta el mínimo real | passed | 1 |
| `unit/cobertura.test.ts` | Los ejes de las curvas tienen que caber los datos › sin excursión negativa el suelo se queda en la holgura de siempre | passed | 0 |
| `unit/cobertura.test.ts` | Los ejes de las curvas tienen que caber los datos › los demás ejes siguen cabiendo sus extremos | passed | 0 |
| `unit/commandHandlers.test.ts` | ARQ-02 · manejadores de comandos › hay exactamente un manejador por tipo de comando declarado en el dominio | passed | 1 |
| `unit/commandHandlers.test.ts` | ARQ-02 · manejadores de comandos › un tipo desconocido se rechaza sin lanzar y sin registrar | passed | 2 |
| `unit/commandHandlers.test.ts` | ARQ-02 · manejadores de comandos › los manejadores sólo ven el contexto: setVentilation y registro pasan por la interfaz | passed | 0 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › .alarm-band: texto ≥ 4.5:1 sobre ambos extremos | passed | 3 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › .alarm-band.high: texto ≥ 4.5:1 sobre ambos extremos | passed | 2 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › .alarm-band.medium: texto ≥ 4.5:1 sobre ambos extremos | passed | 1 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › .alarm-band.previous: texto ≥ 4.5:1 sobre ambos extremos | passed | 0 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › el subtítulo de la banda no lleva opacidad: hereda el color medido | passed | 0 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › la prioridad media es ámbar con texto oscuro, como la celda que alarma | passed | 1 |
| `unit/contraste.test.ts` | CTR-02 · las cifras pequeñas de la columna numérica contrastan sobre el azul del monitor › .numeric-limits ≥ 6:1 | passed | 1 |
| `unit/contraste.test.ts` | CTR-02 · las cifras pequeñas de la columna numérica contrastan sobre el azul del monitor › .numeric .numeric-age ≥ 6:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-02 · las cifras pequeñas de la columna numérica contrastan sobre el azul del monitor › .numeric-label ≥ 6:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-02 · las cifras pequeñas de la columna numérica contrastan sobre el azul del monitor › .numeric-unit ≥ 6:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-03 · la prioridad va en palabras y la luz roja parpadea salvo con «reducir movimiento» › alarmBandLabel antepone la prioridad y respeta los estados sin alarma | passed | 0 |
| `unit/contraste.test.ts` | CTR-03 · la prioridad va en palabras y la luz roja parpadea salvo con «reducir movimiento» › la luz del bisel de prioridad alta lleva animación, y la regla de reducir movimiento la anula | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › tickCurvas (#b3e3fa) ≥ 4,5:1 sobre #0053b5 | passed | 1 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › ejeTiempo (#b3e3fa) ≥ 4,5:1 sobre #0053b5 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › tickBucles (#b3e3fa) ≥ 4,5:1 sobre #0053b5 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › tickTendencias (#b3e3fa) ≥ 4,5:1 sobre #0053b5 | passed | 0 |
| `unit/curvas.test.ts` | CUR-01 · la curva llega a donde dicen el número y la alarma › cada respiración que Pmáx corta se ve tocar Pmáx en la curva | passed | 79 |
| `unit/curvas.test.ts` | CUR-01 · la curva llega a donde dicen el número y la alarma › con el diezmado de antes esos picos no llegaban a la pantalla: la prueba mide algo | passed | 49 |
| `unit/curvas.test.ts` | CUR-01 · la curva llega a donde dicen el número y la alarma › lo que se dibuja no depende de cómo el motor agrupe las muestras en cuadros | passed | 244 |
| `unit/curvas.test.ts` | CUR-01 · la curva llega a donde dicen el número y la alarma › la traza no crece sin tope: guarda 120 s, descarta lo más antiguo y no repite instantes | passed | 11 |
| `unit/curvas.test.ts` | CUR-02 · la escala no cambia de tamaño en mitad del barrido › SC-18: con la escala de cada cuadro el eje encoge a medio barrido; con histéresis nunca, y nada se recorta | passed | 1186 |
| `unit/curvas.test.ts` | CUR-02 · la escala no cambia de tamaño en mitad del barrido › SC-09 igual: al cortar Pmáx las escalas no se desploman a medio barrido | passed | 163 |
| `unit/curvas.test.ts` | CUR-02 · la escala no cambia de tamaño en mitad del barrido › la regla: crece en el acto, y encoge sólo tras una ventana entera y con el barrido en el origen | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › en continuo el eje rotula el tiempo de simulación y el cursor lo recorre de borde a borde | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › en barrido el eje rotula la fase, y el cursor cae en la pasada que se ve a cada lado de la unión | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › la muestra más cercana es la misma que recorriendo la traza entera | passed | 1 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › los dos últimos ciclos se encuentran igual buscando desde el final | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › la respiración de referencia se alinea al inicio del último ciclo visible | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › el lector no escribe un cero con signo | passed | 0 |
| `unit/densidadTiles.test.ts` | DEN · densidad de casillas numéricas › CORE_METRICS tiene las seis casillas de la vista del equipo | passed | 1 |
| `unit/densidadTiles.test.ts` | DEN · densidad de casillas numéricas › cada clave de CORE_METRICS existe en la columna numérica (METRICS) | passed | 0 |
| `unit/effort.test.ts` | Pmus · formas del pulso de esfuerzo › halfSine se conserva: pico a mitad del Ti y cero después | passed | 1 |
| `unit/effort.test.ts` | Pmus · formas del pulso de esfuerzo › riseRelax: subida sinusoidal hasta el pico en Ti y relajación exponencial | passed | 0 |
| `unit/effort.test.ts` | Pmus · formas del pulso de esfuerzo › validateEffort rechaza una forma desconocida y una τ de relajación no positiva | passed | 1 |
| `unit/effort.test.ts` | Pmus · variabilidad determinista respiración a respiración › sin variability (o con fracciones 0) el pulso queda bit a bit periódico | passed | 7 |
| `unit/effort.test.ts` | Pmus · variabilidad determinista respiración a respiración › con ±10 % cada pico queda en rango y los períodos no son todos iguales | passed | 4 |
| `unit/effort.test.ts` | Pmus · variabilidad determinista respiración a respiración › la misma semilla repite la serie; otra semilla la cambia | passed | 1 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › sin `reverse`, pmusAt es idéntico en todas las muestras (bit a bit) | passed | 5 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › la evocada arranca en onset + delayS y hace pico en +tiS, aunque la amplitud espontánea sea 0 | passed | 0 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › con ratio 2 sólo evoca en una de cada dos respiraciones de máquina | passed | 0 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › una notificación nueva sobrescribe la evocada pendiente | passed | 0 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › disabled o reverse ausente anulan la evocada; validateEffort acota los campos | passed | 0 |
| `unit/esfuerzoEspiratorio.test.ts` | EA esfuerzo espiratorio › sin el campo o en 0 el pmusAt es idéntico (con y sin variabilidad) | passed | 25 |
| `unit/esfuerzoEspiratorio.test.ts` | EA esfuerzo espiratorio › con expAmplitude la Pmus baja en medio seno negativo y vuelve a 0 | passed | 1 |
| `unit/esfuerzoEspiratorio.test.ts` | EA esfuerzo espiratorio › la forma es continua: /ΔPmus/ entre muestras consecutivas < 1 cmH2O | passed | 0 |
| `unit/examen.test.ts` | EXM · el veredicto de la estimación informa lo correcto cerca de cero › dentro del medio dígito mostrado es exacto, aunque no sea idéntico | passed | 1 |
| `unit/examen.test.ts` | EXM · el veredicto de la estimación informa lo correcto cerca de cero › contra un cero real informa la diferencia absoluta, no un porcentaje | passed | 0 |
| `unit/examen.test.ts` | EXM · el veredicto de la estimación informa lo correcto cerca de cero › lejos de cero informa el porcentaje redondeado | passed | 0 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › con válvula ideal la Pva salta a PEEP en un paso y el flujo arranca en su pico | passed | 40 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › con apertura de 40 ms la Pva parte cerca de la presión alveolar y desciende hasta la PEEP | passed | 39 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › el flujo espiratorio alcanza su pico después de abrirse la válvula, no en el primer instante | passed | 10 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › la apertura no cambia el volumen espirado ni la PEEP total de forma apreciable | passed | 8 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › una apertura fuera de 0–200 ms se rechaza | passed | 5 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › sin limitación el flujo espiratorio es (Pel − Paw)/Rexp; con ella queda en (Pel − pcrit)/(f·Rexp) | passed | 1 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › es independiente del esfuerzo espiratorio y de la presión aguas abajo: eso es la meseta de flujo | passed | 0 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › con Paw ≥ pcrit no hay colapso y el flujo vuelve a ser el de la ecuación de movimiento | passed | 0 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › durante la limitación el volumen decae hacia C·pcrit con tau = f·Rexp·C, no hacia el volumen de PEEP | passed | 2 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › el resultado no depende del paso de integración | passed | 1 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › con PEEP por debajo del punto crítico el pulmón atrapa hasta que el retroceso iguala pcrit | passed | 120 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › subir la PEEP hasta el punto crítico quita la limitación sin aumentar apenas la PEEP total | passed | 273 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › sin limitación el mismo pulmón no atrapa nada a PEEP 3 | passed | 12 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › una limitación fuera de rango se rechaza | passed | 1 |
| `unit/flowLimitation.test.ts` | EFL-03 · resistencia espiratoria dependiente del volumen › la resistencia crece al vaciarse y coincide con la nominal en el volumen de referencia | passed | 0 |
| `unit/flowLimitation.test.ts` | EFL-03 · resistencia espiratoria dependiente del volumen › sin dependencia la relación flujo-volumen es una recta; con ella la rama queda por debajo de la cuerda | passed | 46 |
| `unit/flowLimitation.test.ts` | EFL-03 · resistencia espiratoria dependiente del volumen › una dependencia fuera de rango se rechaza | passed | 2 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › el generador es determinista y acotado: misma semilla, misma secuencia; ganancia dentro de ±fracción | passed | 4 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › fracción 0 devuelve ganancia exacta y no altera la secuencia posterior | passed | 0 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › el VTe mostrado varía ~±2,5 % entre ciclos mientras el volumen verdadero del modelo no cambia | passed | 51 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › VTi y VTe comparten la ganancia del sensor: la fuga mostrada sigue siendo nula | passed | 8 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › el banco analítico no lleva ruido: VTe mostrado = VTe verdadero | passed | 13 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › la reproducción de una sesión repite las mismas lecturas (mismo semilla, misma secuencia) | passed | 10 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › las alarmas de volumen comparan el valor medido, no el verdadero | passed | 18 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › una variabilidad fuera de 0–10 % se rechaza | passed | 1 |
| `unit/fuga.test.ts` | LEAK-01 · lo entregado no es lo recibido › VC con fuga 6 L/min a 10 cmH₂O: VTi es el programado, VTe lo que vuelve, y la diferencia es la fuga | passed | 28 |
| `unit/fuga.test.ts` | LEAK-01 · lo entregado no es lo recibido › sin fuga nada cambia: el registro es el de siempre | passed | 12 |
| `unit/fuga.test.ts` | LEAK-02 · la PEEP se sostiene mientras el flujo de base cubra la fuga › con base 4 L/min y fuga de 3 a la PEEP la Pva espiratoria queda en 5; con base 2 cae por debajo de 4 | passed | 159 |
| `unit/fuga.test.ts` | LEAK-03 · autodisparo: el sensor ve la fuga como si fuera el paciente › paciente pasivo, fuga 3 L/min a la PEEP y umbral 2: asistidas; umbral 4: ninguna | passed | 27 |
| `unit/fuga.test.ts` | LEAK-04 · en soporte la fuga retrasa el ciclado: el flujo medido no cae al umbral › la inspiración soportada dura más con fuga que sin ella | passed | 52 |
| `unit/fuga.test.ts` | LEAK-05 · desconexión: sin presión, sin volumen, alarma alta que se resuelve al reconectar › con el circuito abierto Ppico < 1 y VTe ≈ 0; la alarma se activa, y al cerrar el circuito se resuelve y queda por reconocer | passed | 17 |
| `unit/fuga.test.ts` | LEAK-05 · desconexión: sin presión, sin volumen, alarma alta que se resuelve al reconectar › la fuga se valida en 0–60 L/min y la desconexión es booleana | passed | 1 |
| `unit/holdsDosUnidades.test.ts` | Cstat y resistencia insp. con dos unidades en paralelo: válidas y marcadas «aprox.» › bloqueo insp válido en un pulmón de dos unidades: cstat y raw traen reason twoCompartments y quality valid | passed | 32 |
| `unit/holdsDosUnidades.test.ts` | Cstat y resistencia insp. con dos unidades en paralelo: válidas y marcadas «aprox.» › un solo compartimento: mismas muestras sin la marca de aproximación | passed | 8 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › dice cuál es y cuántos van | passed | 1 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › el último anuncia la secuencia completa y dónde repasarla | passed | 0 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › un objetivo de texto largo cabe en un aviso de una línea | passed | 0 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › en SC-01 nada se cumple al abrir: el primer bloqueo se anuncia aunque llegue en el primer segundo | passed | 14 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › en SC-13 el primer objetivo ya se cumple con el primer cuadro visible, y sólo ése se calla | passed | 6 |
| `unit/leccion.test.ts` | LEC-02 · toda tarea nombra una prueba que existe › cada `test` de cada lección está en la tabla de pruebas | passed | 1 |
| `unit/limites.test.ts` | limitPair · límites de alarma en la casilla › vte 0,5 / 0,2 L se lee «500
200» en mL | passed | 1 |
| `unit/limites.test.ts` | limitPair · límites de alarma en la casilla › peepe con ambos límites en Off no muestra nada | passed | 0 |
| `unit/limites.test.ts` | limitPair · límites de alarma en la casilla › rr con el alto en Off deja el renglón de arriba vacío | passed | 0 |
| `unit/mecanica.test.ts` | MEC-01 · la resistencia sale de la misma oclusión que la distensibilidad › en el banco lineal da exactamente el número del modelo | passed | 36 |
| `unit/mecanica.test.ts` | MEC-01 · la resistencia sale de la misma oclusión que la distensibilidad › al triplicar la resistencia el número la sigue, y la distensibilidad no se mueve | passed | 26 |
| `unit/mecanica.test.ts` | MEC-01 · la resistencia sale de la misma oclusión que la distensibilidad › la resistencia inspiratoria NO predice el vaciamiento, y por eso la constante se mide aparte | passed | 14 |
| `unit/mecanica.test.ts` | MEC-02 · cuando la resta no mide una resistencia, no se publica un número › en presión control no hay un caudal único que dividir, y se dice | passed | 16 |
| `unit/mecanica.test.ts` | MEC-02 · cuando la resta no mide una resistencia, no se publica un número › con Plimit recortando la entrega tampoco, aunque el modo sea volumen control | passed | 86 |
| `unit/mecanica.test.ts` | MEC-02 · cuando la resta no mide una resistencia, no se publica un número › con esfuerzo durante la rampa la resta ya no es sólo del pulmón | passed | 8 |
| `unit/mecanica.test.ts` | MEC-02 · cuando la resta no mide una resistencia, no se publica un número › si la meseta se rechaza, la resistencia y la constante caen con ella | passed | 12 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › en un compartimento lineal sale exactamente Rexp × C, sin ninguna maniobra | passed | 7 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › en el obstructivo sale la resistencia espiratoria, que es el triple de la inspiratoria | passed | 4 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › con la espiración estrangulada la recta deja de ajustar y no se publica un número | passed | 82 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › con tejido viscoelástico tampoco: la relajación sigue durante toda la espiración | passed | 34 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › si el paciente hace fuerza durante la espiración, el vaciamiento no es pasivo y se dice | passed | 14 |
| `unit/mechanicsPresets.test.ts` | PRE · presets de mecánica del paciente › K₂ crece al bajar el diámetro del TET | passed | 1 |
| `unit/mechanicsPresets.test.ts` | PRE · presets de mecánica del paciente › todos los presets caben en los rangos de sus deslizadores | passed | 0 |
| `unit/mechanicsPresets.test.ts` | PRE · presets de mecánica del paciente › 'none' reproduce los valores por omisión (sin viscoelasticidad, sin tubo) | passed | 0 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-04 · Plimit recorta la entrega: los tres objetivos se cumplen | passed | 50 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-05 · esfuerzos que no disparan: los tres objetivos se cumplen | passed | 24 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-19 · presión de soporte: espontáneas, PS a 15 y apnea con recuperación | passed | 117 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-20 · ciclado tardío: el Ti supera al esfuerzo hasta subir el ciclaje al 50 % | passed | 43 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-21 · ventilación protectora: ΔP alta, VT reducido con ΔP < 15 y potencia bajo 15 J/min | passed | 44 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-22 · fuga: se ve en la tabla, dispara sola y se calla subiendo el umbral | passed | 42 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-23 · desconexión: alarma, reconexión que la resuelve y reconocimiento que limpia la banda | passed | 50 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-17 · pendelluft: la meseta corta que se pide es una que el equipo acepta | passed | 95 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › un objetivo que no se cumple ya no bloquea a los que vienen detrás | passed | 9 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-09 · la lección de alarmas sigue siendo terminable con los límites puestos | passed | 102 |
| `unit/objetivos.test.ts` | ALM · los límites por omisión vigilan sin molestar › ninguno viene en Off salvo la PEEP espiratoria, como en las fotografías | passed | 9 |
| `unit/objetivos.test.ts` | ALM · los límites por omisión vigilan sin molestar › sólo el escenario de asincronías alarma, y por lo que debe | passed | 1145 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-02 · «antes del cambio» rechaza una meseta medida después (el falso logro) | passed | 0 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-02 · la tarea de PEEP exige llegar a 8 y medir la meseta después del ajuste | passed | 0 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-25 · la decremental exige una medida previa a la apertura y otra posterior | passed | 0 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-25 · la medida «dereclutada» deja de contar una vez abierto el pulmón | passed | 0 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-02 en el simulador: medir sólo después de los 20 s deja «antes» sin cumplir | passed | 25 |
| `unit/peepe.test.ts` | PEEPe medida antes de la deflexión de disparo › CPAP/PS con esfuerzo: la PEEPe queda en la PEEP programada, no en el fondo del valle de disparo | passed | 38 |
| `unit/peepe.test.ts` | PEEPe medida antes de la deflexión de disparo › banco pasivo A/C VC: la PEEPe sigue en la PEEP programada (sin regresión) | passed | 12 |
| `unit/physics.test.ts` | PHY-06 · cambiar PEEP conserva el volumen pulmonar; no se suma PEEP dos veces › PEEP 5 → 10: V continuo en el instante del cambio, PEEPe medida sube a 10 y Pplat = 10 + VT/C = 20 | passed | 21 |
| `unit/physics.test.ts` | PHY-06 · cambiar PEEP conserva el volumen pulmonar; no se suma PEEP dos veces › la curva de volumen tidal se reinicia por respiración sin reiniciar el volumen absoluto | passed | 5 |
| `unit/physics.test.ts` | PHY-07 · el vaciamiento determina la auto-PEEP (BM-04 en el motor) › Rexp 30 y Texp corto producen PEEPtot > PEEP; alargar la espiración la reduce | passed | 24 |
| `unit/physics.test.ts` | PHY-08 · R, C y Pmus cambian señales y métricas distintas › subir Rinsp sube Ppico y no Pplat; bajar C sube ambas | passed | 7 |
| `unit/physics.test.ts` | PHY-08 · R, C y Pmus cambian señales y métricas distintas › el esfuerzo dispara respiraciones asistidas (no espontáneas) sólo si supera el trigger | passed | 41 |
| `unit/physics.test.ts` | PHY-10 · dominio de fallo del ensayo › resistencia alta (Rinsp 60) y C baja (5 mL/cmH2O): sin NaN ni infinitos; Pmáx termina la inspiración con volumen parcial | passed | 12 |
| `unit/potencia.test.ts` | POT-01 · VC pasivo: la integral coincide con la solución cerrada y con la fórmula de flujo constante › banco SC-01: energía = PEEP·VT + R·Q·VT + VT²/(2C) = 7,5 cmH₂O·L → 11,0 J/min | passed | 23 |
| `unit/potencia.test.ts` | POT-01 · VC pasivo: la integral coincide con la solución cerrada y con la fórmula de flujo constante › a igual VT, subir la frecuencia sube la potencia casi en proporción; bajar el VT la baja más que en proporción | passed | 69 |
| `unit/potencia.test.ts` | POT-02 · PC pasivo: energía = (PEEP + Pinsp) · VT cuando la presión es constante › BM-03 PC con rampa 0: (5 + 10) · 0,4323 = 6,48 cmH₂O·L por respiración | passed | 9 |
| `unit/potencia.test.ts` | POT-03 · calidad: en espera no hay dato; antes de dos respiraciones, en curso › sigue la ventana de FR y VMesp | passed | 2 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-01: el resultado del bloqueo conserva su hora y valores tras muchas respiraciones (abrir/cerrar ventana) | passed | 64 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-02: bloqueo con esfuerzo del escenario (SC-10) resulta inválido por meseta perturbada; sin Cstat fabricada | passed | 5 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-03: cancelar dos veces es seguro; ↑O2 restaura una sola vez y respeta una edición del usuario | passed | 23 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-05: un segundo bloqueo mientras hay uno en cola se rechaza con motivo | passed | 0 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › un bloqueo cancelado en curso deja resultado «cancelled» con duración parcial y no borra el válido anterior del historial | passed | 4 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › resp manual: elegible sólo en espiración; produce una respiración de tipo manual | passed | 1 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › DAT-04: el comparador rechaza combinar Pplat y VT de respiraciones distintas | passed | 2 |
| `unit/procedures.test.ts` | espera (standby) como transacción › entrar en espera detiene la entrega, las métricas pasan a no disponibles y la numeración continúa al reanudar | passed | 6 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › defaultInit declara el perfil; profileFor resuelve el de referencia y rechaza ids desconocidos | passed | 1 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › el motor rechaza una inicialización cuyo profileId no coincide con el perfil inyectado | passed | 0 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › el motor usa las reglas del perfil inyectado (no un módulo concreto) | passed | 1 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › una sesión sin profileId (anterior a 0.3.3) se importa con el perfil de referencia; un profileId desconocido se rechaza | passed | 8 |
| `unit/proteccion.test.ts` | PROT-01 · el estimador recupera el exponente que se le da › sobre curvas sintéticas acierta a tres decimales | passed | 1 |
| `unit/proteccion.test.ts` | PROT-01 · el estimador recupera el exponente que se le da › con muestras insuficientes devuelve null en vez de un número inventado | passed | 0 |
| `unit/proteccion.test.ts` | PROT-02 · sobre el motor distingue los tres regímenes › un pulmón lineal da exactamente la recta | passed | 21 |
| `unit/proteccion.test.ts` | PROT-02 · sobre el motor distingue los tres regímenes › con sigmoide, subir la PEEP lleva el índice de reclutamiento a sobredistensión | passed | 42 |
| `unit/proteccion.test.ts` | PROT-03 · no se publica cuando la forma no es del pulmón › en presión control no hay rampa a flujo constante | passed | 12 |
| `unit/proteccion.test.ts` | PROT-03 · no se publica cuando la forma no es del pulmón › con esfuerzo del paciente la curva es suya y del ventilador, no del pulmón | passed | 7 |
| `unit/proteccion.test.ts` | PROT-03 · no se publica cuando la forma no es del pulmón › con la presión recortada por un techo la forma ya no es la del pulmón | passed | 10 |
| `unit/proteccion.test.ts` | PROT-03 · no se publica cuando la forma no es del pulmón › y la métrica lo publica como no disponible con su motivo, nunca como válida | passed | 7 |
| `unit/proteccion.test.ts` | PROT-04 · la lectura y la curva de titulación › cada banda del índice tiene su lectura | passed | 5 |
| `unit/proteccion.test.ts` | PROT-04 · la lectura y la curva de titulación › la titulación ordena por PEEP y señala la mejor distensibilidad | passed | 0 |
| `unit/proteccion.test.ts` | PROT-04 · la lectura y la curva de titulación › sin puntos no inventa ninguno | passed | 0 |
| `unit/proteccion.test.ts` | PROT-05 · la lectura no atribuye al pulmón lo que es del circuito › con fuga el índice se muestra pero no se interpreta como reclutamiento (auditoría: 0,84 en un pulmón lineal) | passed | 25 |
| `unit/proteccion.test.ts` | PROT-05 · la lectura no atribuye al pulmón lo que es del circuito › con circuito compresible tampoco se infiere régimen: la compresión contamina el flujo del pulmón | passed | 78 |
| `unit/rampa.test.ts` | Rampa exponencial en PC › riseMs 200: ≈95 % del escalón a los 0,2 s, ≈63 % a τ = 0,067 s, sin sobrepasar PEEP + Pinsp | passed | 11 |
| `unit/rampa.test.ts` | Rampa exponencial en PC › riseMs 0: el escalón es inmediato, la primera muestra ya es PEEP + Pinsp | passed | 19 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › el equilibrio escala con la fracción reclutada: V(r) = C·(1 + r·frac)·(P − P0) | passed | 5 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › al arrancar ventilado sólo nace abierto si la distensión ya supera pOpen | passed | 1 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › la banda pClose–pOpen conserva el estado: eso ES la histéresis | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › reclutar baja la presión elástica al mismo volumen y sube la compliance local | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › quitar recruit devuelve la fracción abierta a 0 | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › sin recruit el modelo es exactamente el de siempre | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › la validación exige 0 < frac ≤ 1, pClose < pOpen y constantes de tiempo en rango | passed | 1 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › sin bloqueo sólo se lee la Ppico; las otras tres dicen qué falta | passed | 16 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › tras un bloqueo válido las cuatro fórmulas cuadran entre sí | passed | 10 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › la Ppico no lleva rango de referencia, porque no tiene uno | passed | 7 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › el veredicto se decide sobre el número que se muestra, no sobre el crudo | passed | 6 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › una meseta alta se marca fuera de su referencia | passed | 5 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › con la meseta rechazada no se publica ningún número derivado | passed | 11 |
| `unit/resumen.test.ts` | RES · con atrapamiento aéreo la resta es contra la PEEP total › las identidades de la pantalla cuadran, y el esquema no contradice a la tarjeta | passed | 60 |
| `unit/resumen.test.ts` | RES · con atrapamiento aéreo la resta es contra la PEEP total › el motor dice qué PEEP hay en la resta, y lo dice bien | passed | 16 |
| `unit/review.test.ts` | H1 · ↑O2: ajuste, mezclador y sensor vuelven juntos (regla 1) › fin por temporizador restaura también el mezclador | passed | 54 |
| `unit/review.test.ts` | H1 · ↑O2: ajuste, mezclador y sensor vuelven juntos (regla 1) › fin por espera restaura también el mezclador | passed | 1 |
| `unit/review.test.ts` | H2 · orden manual y disparo en el mismo sub-paso: sin respiraciones apiladas › con esfuerzo fuerte y control asistido, una orden manual produce exactamente una respiración manual y ninguna espiración de un sub-paso | passed | 15 |
| `unit/review.test.ts` | H3 · espera durante un bloqueo espiratorio en curso › no emite respiraciones fantasma, no activa alarmas en espera y el bloqueo queda cancelado | passed | 7 |
| `unit/review.test.ts` | H4 · poner un límite en Off resuelve la alarma activa (Off = no se evalúa, no estado congelado) › VTesp bajo activa → Off → resuelta y reconocida; banda verde | passed | 4 |
| `unit/review.test.ts` | H5 · una inspiración acortada por Pmáx no acorta el periodo obligatorio › FR medida ≈ FR programada aunque cada inspiración termine a 0.8 s por Pmáx | passed | 60 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › el constructor rechaza FR negativa y un paciente con tau < 1 ms | passed | 1 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › requestHold con duración no numérica o fuera de rango se rechaza; setPatient con R diminuta se rechaza | passed | 4 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › importSession rechaza ajustes fuera de dominio y pacientes degenerados | passed | 4 |
| `unit/review.test.ts` | H7 · importar una sesión no hereda perturbaciones del escenario previo › tras cargar SC-02 (C cambia a 20 s) e importar una sesión de banco, la C importada permanece | passed | 85 |
| `unit/review.test.ts` | H8 · Pplat de ciclo nunca es válida en una respiración terminada por Pmáx › con pausa programada y Pmáx durante la pausa, pplatCycle es null con motivo endedByPmax | passed | 8 |
| `unit/review.test.ts` | H13 · bloqueo espiratorio con paciente que dispara continuamente › se ejecuta al final de la espiración aunque la termine un disparo, y resulta inválido con motivo | passed | 21 |
| `unit/review.test.ts` | audio en pausa como estado del motor (replay) › audioPause fija audioPauseUntilMs = t + 120 s y el replay lo reproduce | passed | 25 |
| `unit/review3.test.ts` | R3-01 · tope de flujo del actuador en PC sin sobreimpulso ni Pmáx falsa › C 5 mL/cmH₂O, R 0.5, Pmáx 17: la presión no supera PEEP + Pinsp y la inspiración termina por tiempo | passed | 28 |
| `unit/review3.test.ts` | R3-01 · tope de flujo del actuador en PC sin sobreimpulso ni Pmáx falsa › la Ppico con tope activo no depende del paso de integración (4 ms vs 1 ms) | passed | 92 |
| `unit/review3.test.ts` | R3-02 · el VTi nunca es negativo en PC tras bajar la PEEP › PEEP 10 → 5 con Pinsp 3: el volumen que sale cuenta como espirado | passed | 4 |
| `unit/review3.test.ts` | R3-03 · flujo de base espiratorio: el esfuerzo hunde la Pva y no inhala sin límite › sin asistencia, un esfuerzo de 8 cmH₂O en espiración baja la Pva por debajo de PEEP y VTe − VTi queda acotado por el flujo de base | passed | 77 |
| `unit/review3.test.ts` | R3-03 · flujo de base espiratorio: el esfuerzo hunde la Pva y no inhala sin límite › con asistencia, el mismo esfuerzo sigue disparando por flujo (2 L/min) | passed | 15 |
| `unit/review3.test.ts` | R3-04 · aviso «Presión limitada por Plimit» › con Plimit 7 el cuadro marca «limitado por Plimit» sin alarma; al subir Plimit el indicador desaparece | passed | 5 |
| `unit/review3.test.ts` | R3-04 · aviso «Presión limitada por Plimit» › Plimit por encima de Pmáx se acepta con aviso no bloqueante | passed | 0 |
| `unit/review3.test.ts` | R3-05 · Cstat del bloqueo inspiratorio usa PEEPtot cuando hay bloqueo espiratorio válido › con atrapamiento (Rexp 30, FR 30) la Cstat vuelve a 50 mL/cmH₂O tras medir PEEPtot | passed | 11 |
| `unit/review3.test.ts` | R3-05 · Cstat del bloqueo inspiratorio usa PEEPtot cuando hay bloqueo espiratorio válido › tras cambiar la mecánica la PEEPtot medida antes no contamina la Cstat nueva (auditoría: publicaba 118,9) | passed | 13 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › confirmSettings rechaza claves desconocidas y modos inexistentes sin tocar los ajustes | passed | 1 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › el constructor rechaza esfuerzo y sensores no finitos o fuera de rango | passed | 1 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › la duración del bloqueo debe estar en la rejilla de su tipo (insp 2–40, esp 2–60) | passed | 0 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › pasar a espera durante un bloqueo lo cierra con motivo «cancelledByStandby», no «cancelado por el usuario» | passed | 2 |
| `unit/review3.test.ts` | R3-07 · sesiones: PC se reimporta; versiones de motor aceptadas o rechazadas de forma explícita › una sesión en A/C PC exporta e importa sin error | passed | 4 |
| `unit/review3.test.ts` | R3-07 · sesiones: PC se reimporta; versiones de motor aceptadas o rechazadas de forma explícita › engineVersion 0.2.0 se acepta con aviso; 0.1.0 se rechaza; esfuerzo absurdo en init se rechaza | passed | 28 |
| `unit/review3.test.ts` | R3-08 · un arranque fallido nunca es silencioso › el anfitrión responde initError y el cliente lo notifica por onDegraded | passed | 1 |
| `unit/review3.test.ts` | R3-08 · un arranque fallido nunca es silencioso › una orden pendiente al degradar el Worker se responde como rechazada en vez de quedar colgada | passed | 21 |
| `unit/review3.test.ts` | R3-09 · bloqueo inspiratorio rechazado por Pmáx queda registrado › SC-09-like (Rinsp 400): resultado inválido, con motivo y hora | passed | 17 |
| `unit/review4.test.ts` | R4-01 · ningún número no finito sale como válido › un tramo de duración nula no produce NaN, ni siquiera con elastancia viscoelástica cero | passed | 1 |
| `unit/review4.test.ts` | R4-01 · ningún número no finito sale como válido › el barrido de dos unidades con Plimit ya no diverge a ningún paso | passed | 126 |
| `unit/review4.test.ts` | R4-01 · ningún número no finito sale como válido › si el modelo divergiera, la métrica se publica como inválida y queda un evento en el registro | passed | 6 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › con la válvula cerrada ninguna unidad sortea la resistencia en serie | passed | 0 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › el tope de flujo del actuador acota el flujo TOTAL, no sólo el de una rama | passed | 0 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › en presión control con dos unidades el flujo pico respeta el tope del actuador | passed | 26 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › el flujo de base acota lo que el paciente puede inhalar en espiración también con dos unidades | passed | 157 |
| `unit/review4.test.ts` | R4-03 · lo que se publica es lo que se mide › durante una oclusión la Pva es la del nodo, no la de una unidad | passed | 6 |
| `unit/review4.test.ts` | R4-03 · lo que se publica es lo que se mide › la curva de volumen suma las dos unidades: coincide con el VT entregado | passed | 6 |
| `unit/review4.test.ts` | R4-04 · órdenes de banco que dejan el estado coherente › fijar el volumen absoluto no inventa presión viscoelástica ni descuadra el total | passed | 32 |
| `unit/review4.test.ts` | R4-04 · órdenes de banco que dejan el estado coherente › quitar la segunda unidad conserva el gas en vez de hacerlo desaparecer | passed | 22 |
| `unit/review4.test.ts` | R4-04 · órdenes de banco que dejan el estado coherente › al reanudar tras espera la primera Cstat usa la PEEP y no cero | passed | 26 |
| `unit/review4.test.ts` | R4-05 · el elástico se describe con una sola función › la presión de equilibrio coincide con la meseta real de una oclusión larga, también con sigmoide | passed | 38 |
| `unit/review4.test.ts` | R4-06 · la forma cerrada del nodo coincide con la bisección › con ramas lineales el nodo resuelto en forma cerrada da el mismo flujo total pedido | passed | 0 |
| `unit/review4.test.ts` | R4-06 · la forma cerrada del nodo coincide con la bisección › con ramas no lineales cae a la bisección y sigue invirtiendo | passed | 0 |
| `unit/review4.test.ts` | R4-07 · el solucionador del nodo no se dispara › con ramas lineales el nodo se resuelve en forma cerrada: cero bisecciones | passed | 4 |
| `unit/review4.test.ts` | R4-07 · el solucionador del nodo no se dispara › la combinación más costosa se mantiene acotada | passed | 1501 |
| `unit/review5.test.ts` | R5-01 · el criterio de meseta es monótono en la duración de la oclusión › esperar más nunca empeora la tasa de deriva medida | passed | 5 |
| `unit/review5.test.ts` | R5-01 · el criterio de meseta es monótono en la duración de la oclusión › con dos unidades muy dispares, el bloqueo corto se rechaza y el largo se acepta | passed | 58 |
| `unit/review5.test.ts` | R5-02 · la métrica no puede contradecir a la curva › el Ppico publicado aparece en alguna muestra de la pantalla | passed | 7 |
| `unit/review5.test.ts` | R5-03 · la espiración tiene techo de máquina › ninguna combinación deja pasar más flujo espiratorio del que abre la válvula | passed | 10 |
| `unit/review5.test.ts` | R5-04 · un solo elástico › el volumen de equilibrio es el inverso exacto de la presión elástica, también fuera del codo | passed | 1 |
| `unit/review5.test.ts` | R5-04 · un solo elástico › con sigmoide estrecha y PEEP alta el pulmón arranca exactamente en la PEEP | passed | 0 |
| `unit/review5.test.ts` | R5-05 · conmutar la segunda unidad no crea ni destruye gas › añadirla reparte el gas que hay en vez de inventar el suyo | passed | 2 |
| `unit/review5.test.ts` | R5-05 · conmutar la segunda unidad no crea ni destruye gas › quitarla une su gas al que queda | passed | 6 |
| `unit/review5.test.ts` | R5-06 · el contrato de calidad también cubre los procedimientos › la guarda de finitud anula el valor y quita la calidad válida | passed | 1 |
| `unit/review5.test.ts` | R5-06 · el contrato de calidad también cubre los procedimientos › con el modelo divergido ningún valor del bloqueo sale válido | passed | 33 |
| `unit/review5.test.ts` | R5-07 · Plimit protege sin dejar de ventilar › dentro de un tramo actúa el umbral que se cruza antes, que es el más bajo | passed | 0 |
| `unit/review5.test.ts` | R5-07 · Plimit protege sin dejar de ventilar › con Pmáx por debajo de Plimit, o iguales, manda Pmáx | passed | 0 |
| `unit/review5.test.ts` | R5-07 · Plimit protege sin dejar de ventilar › el volumen entregado decrece de forma continua al subir la resistencia | passed | 124 |
| `unit/review5.test.ts` | R5-07 · Plimit protege sin dejar de ventilar › con Pmáx por debajo de Plimit manda Pmáx, que es la acción de seguridad | passed | 2 |
| `unit/review6.test.ts` | R6-01 · un número que no lo es no puede congelar el motor › una velocidad no finita se rechaza con motivo en vez de dejar el reloj en NaN | passed | 14 |
| `unit/review6.test.ts` | R6-01 · un número que no lo es no puede congelar el motor › una autopausa no finita se rechaza igual | passed | 7 |
| `unit/review6.test.ts` | R6-02 · ninguna promesa del cliente queda colgada › exportar sin simulación responde en vez de esperar para siempre | passed | 1 |
| `unit/review6.test.ts` | R6-02 · ninguna promesa del cliente queda colgada › una exportación pendiente al degradar el Worker se resuelve como fallo | passed | 1 |
| `unit/review6.test.ts` | R6-02 · ninguna promesa del cliente queda colgada › una importación pendiente al degradar se resuelve con el motivo, no con silencio | passed | 0 |
| `unit/review7.test.ts` | R7-01 · la PEEP total no se certifica mientras sigue subiendo › en un pulmón que redistribuye despacio una oclusión corta se rechaza con motivo | passed | 131 |
| `unit/review7.test.ts` | R7-01 · la PEEP total no se certifica mientras sigue subiendo › alargando la oclusión el mismo pulmón sí da una PEEP total, y ya casi no le falta nada | passed | 289 |
| `unit/review7.test.ts` | R7-01 · la PEEP total no se certifica mientras sigue subiendo › un pulmón que vacía rápido no paga el criterio: a los 2 s ya está asentado | passed | 103 |
| `unit/review7.test.ts` | R7-01 · la PEEP total no se certifica mientras sigue subiendo › el listón del bloqueo espiratorio es más estrecho que el del inspiratorio, y eso es deliberado | passed | 0 |
| `unit/review7.test.ts` | R7-02 · si la lección pide un bloqueo espiratorio, dice cuánto tiene que durar › todo objetivo «validExp» se cumple con la duración que su propio texto nombra | passed | 198 |
| `unit/review7.test.ts` | R7-03 · un límite recién puesto se compara enseguida con lo último medido › subir el límite de VTesp bajo por encima de lo entregado alarma sin esperar a la respiración siguiente | passed | 42 |
| `unit/review7.test.ts` | R7-03 · un límite recién puesto se compara enseguida con lo último medido › bajarlo otra vez lo resuelve igual de rápido | passed | 10 |
| `unit/review7.test.ts` | R7-03 · un límite recién puesto se compara enseguida con lo último medido › en espera no se inventa una alarma con la última respiración de antes | passed | 3 |
| `unit/review7.test.ts` | R7-04 · lo que la tarea dice que se verá es lo que se ve › SC-02 · la PEEP que la tarea nombra deja sitio bajo Pmáx; la que descarta, no | passed | 56 |
| `unit/review7.test.ts` | R7-04 · lo que la tarea dice que se verá es lo que se ve › SC-13 · en PC el VT que devuelve I:E 1:1 es el de la mecánica nueva, no el de antes | passed | 17 |
| `unit/security.test.ts` | SEC-01 · inspección estática: sin WebUSB/WebSerial/Bluetooth ni conexiones externas en el código fuente › ninguna referencia a navigator.usb/serial/bluetooth, WebSocket, fetch externo ni eval | passed | 33 |
| `unit/security.test.ts` | SEC-01 · inspección estática: sin WebUSB/WebSerial/Bluetooth ni conexiones externas en el código fuente › sin dependencias de ejecución en package.json (aplicación local, sin backend) | passed | 0 |
| `unit/session.test.ts` | TIM · reproducibilidad › TIM-02: misma inicialización y comandos → mismos registros de respiración | passed | 65 |
| `unit/session.test.ts` | TIM · reproducibilidad › TIM-01: la cadencia de lectura de cuadros no altera la fisiología | passed | 28 |
| `unit/session.test.ts` | SEC-03 · importación robusta › rechaza JSON malformado, tamaño excesivo, comandos no permitidos, números no finitos y claves desconocidas | passed | 9 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › está anclada en V(P0) = 0 y es su propia inversa en todo el intervalo útil | passed | 1 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › la compliance máxima vale b/(4d) en P = c y es simétrica alrededor de ese punto | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › el mismo incremento de volumen cuesta mucha más presión arriba que en la zona media: eso es el pico de sobredistensión | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › por encima de la capacidad la presión sigue siendo finita y monótona (extensión tangente) | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › sin sigmoide el modelo sigue siendo lineal | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-02 · titulación de PEEP sobre la sigmoide › la compliance medida dibuja una U invertida: baja colapsada, máxima cerca de c y baja otra vez por sobredistensión | passed | 67 |
| `unit/sigmoid.test.ts` | SIG-02 · titulación de PEEP sobre la sigmoide › el volumen inicial de equilibrio usa la sigmoide, no la compliance lineal | passed | 1 |
| `unit/sigmoid.test.ts` | SIG-02 · titulación de PEEP sobre la sigmoide › una sigmoide fuera de rango se rechaza | passed | 1 |
| `unit/soporte.test.ts` | PHY-03a · con esfuerzo, el paciente manda: espontáneas a PEEP + PS cicladas por flujo › todas las respiraciones son espontáneas, la Ppico es PEEP + PS y terminan al 25 % del flujo pico | passed | 59 |
| `unit/soporte.test.ts` | PHY-03a · con esfuerzo, el paciente manda: espontáneas a PEEP + PS cicladas por flujo › el ciclaje espiratorio gobierna el Ti: 50 % acorta la inspiración frente a 25 %, y una resistencia alta la alarga (ciclado tardío) | passed | 189 |
| `unit/soporte.test.ts` | PHY-03a · con esfuerzo, el paciente manda: espontáneas a PEEP + PS cicladas por flujo › cuando el flujo no cae al umbral, el tope de tiempo del soporte corta la inspiración | passed | 10 |
| `unit/soporte.test.ts` | PHY-03b · respaldo: apnea con alarma y respiraciones por presión; frecuencia mínima › sin esfuerzo: apnea a los 20 s (alarma alta), respaldo a PEEP + Pinsp de respaldo durante Tinsp de respaldo, a 12/min | passed | 20 |
| `unit/soporte.test.ts` | PHY-03b · respaldo: apnea con alarma y respiraciones por presión; frecuencia mínima › cuando el paciente vuelve a disparar, la respiración es espontánea, la apnea se resuelve y el respaldo cesa | passed | 67 |
| `unit/soporte.test.ts` | PHY-03b · respaldo: apnea con alarma y respiraciones por presión; frecuencia mínima › frecuencia mínima 10/min con paciente a 6/min: entran obligatorias por presión entre las espontáneas y no hay apnea | passed | 17 |
| `unit/soporte.test.ts` | PHY-03c · validación y cambio de modo › PEEP + PS y PEEP + Pinsp de respaldo deben quedar bajo Pmáx; el ciclaje sólo admite su rejilla de 5 % | passed | 1 |
| `unit/soporte.test.ts` | PHY-03c · validación y cambio de modo › al pasar de A/C VC a CPAP/PS con paciente activo no se cuela la obligatoria del temporizador: se espera al paciente | passed | 27 |
| `unit/soporte.test.ts` | PHY-03c · validación y cambio de modo › una sesión de un motor anterior sin los ajustes de CPAP/PS se importa completándolos con el valor por omisión | passed | 10 |
| `unit/sync.test.ts` | SYN-01 · flujo de base programable › con flujo de base 10 L/min el paciente toma hasta 10 L/min sin hundir la Pva; con 2 L/min la hunde antes | passed | 71 |
| `unit/sync.test.ts` | SYN-01 · flujo de base programable › el disparo por flujo no puede superar el flujo de base (motivo legible) | passed | 1 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › con umbral −2 cmH₂O el esfuerzo dispara asistidas; con −10 no llega y las respiraciones siguen siendo mandatorias | passed | 32 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › todo el rango de umbral admitido dispara cuando el esfuerzo lo alcanza (regresión: −3 o menos quedaban inertes) | passed | 64 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › con el circuito abierto la espiración nunca sostiene PEEP y el esfuerzo no dispara (guarda LEAK-05) | passed | 45 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › el disparo por presión ignora el umbral de flujo (flujo de disparo alto no bloquea) | passed | 20 |
| `unit/sync.test.ts` | SYN-03 · resistencia de la rama espiratoria › con 3 cmH₂O·s/L la Pva queda por encima de PEEP al inicio de la espiración y el flujo pico espiratorio baja; el VT espirado se conserva | passed | 65 |
| `unit/sync.test.ts` | SYN-03 · resistencia de la rama espiratoria › se valida en 0–6 y se conserva en la sesión | passed | 1 |
| `unit/sync.test.ts` | SYN-04 · retardo de respuesta del disparo: el trabajo de disparo aparece en la curva de presión › la respiración empieza 80 ms después de cruzar el umbral, y en ese lapso la Pva cae ≈ 2 cmH₂O con Pmus 8 y flujo de base 4 | passed | 32 |
| `unit/sync.test.ts` | SYN-04 · retardo de respuesta del disparo: el trabajo de disparo aparece en la curva de presión › el disparo por presión es más lento que el de flujo: la respiración empieza ≈ 110 ms tras cruzar el umbral | passed | 91 |
| `unit/sync.test.ts` | SYN-04 · retardo de respuesta del disparo: el trabajo de disparo aparece en la curva de presión › más flujo de base o menos esfuerzo, menos trabajo de disparo; el disparo por presión lo duplica | passed | 220 |
| `unit/sync.test.ts` | SYN-04 · retardo de respuesta del disparo: el trabajo de disparo aparece en la curva de presión › sin disparo asistido la espiración termina por el temporizador y la caída del esfuerzo queda contenida | passed | 78 |
| `unit/twoCompartment.test.ts` | PEN-01 · pendelluft con el circuito ocluido › el gas pasa de la unidad rápida a la lenta y las presiones convergen con tau = (R1+R2)·C1·C2/(C1+C2) | passed | 7 |
| `unit/twoCompartment.test.ts` | PEN-01 · pendelluft con el circuito ocluido › el reparto no depende del paso de integración | passed | 2 |
| `unit/twoCompartment.test.ts` | PEN-01 · pendelluft con el circuito ocluido › la presión del nodo con flujo impuesto es la media ponderada por las conductancias | passed | 1 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › el vaciamiento deja de ser una sola exponencial: al final domina la constante lenta | passed | 86 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › la meseta de una oclusión depende de su duración: el pendelluft sigue moviendo gas | passed | 36 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › con una sola unidad la meseta no depende de la duración | passed | 39 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › el volumen absoluto del panel docente suma las dos unidades | passed | 3 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-01: seleccionar PEEP y girar sin confirmar no emite cambios | passed | 2 |
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
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › con E2 = 0 el modelo es exactamente el de un compartimento | passed | 4 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › inflado a flujo constante: la separación V − Vve sigue Q·tau·(1 − e^(−t/tau)) y no depende del paso | passed | 1 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › oclusión: caída inmediata resistiva (Ppico − P1 = R·Q) y luego decaimiento exponencial hasta la meseta estática | passed | 0 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › tras 6 constantes la meseta está a menos de 1 % del valor estático | passed | 0 |
| `unit/viscoelastic.test.ts` | VIS-02 · consecuencias en el ventilador › el bloqueo inspiratorio mide una meseta por encima de la estática y la Cstat resultante subestima la compliance | passed | 65 |
| `unit/viscoelastic.test.ts` | VIS-02 · consecuencias en el ventilador › una pausa corta no da meseta de ciclo: la presión sigue cayendo y se declara inestable | passed | 4 |
| `unit/viscoelastic.test.ts` | VIS-02 · consecuencias en el ventilador › sin relajación la misma pausa sí da meseta estable | passed | 4 |
| `unit/viscoelastic.test.ts` | VIS-03 · resistencia no lineal de Rohrer › con K2 = 5, duplicar el flujo multiplica la caída resistiva por 2,4 en vez de por 2 | passed | 2 |
| `unit/viscoelastic.test.ts` | VIS-03 · resistencia no lineal de Rohrer › K2 no cambia la meseta: la carga elástica es la misma | passed | 3 |
| `unit/viscoelastic.test.ts` | VIS-03 · resistencia no lineal de Rohrer › K2 fuera de 0–50 se rechaza | passed | 1 |
| `unit/viscoelastic.test.ts` | VIS-04 · la PEEPe de referencia no se contamina con la oclusión previa › tras un bloqueo espiratorio con atrapamiento, el ΔP y la Cstat del siguiente bloqueo usan PEEP, no PEEP total | passed | 10 |

## Playwright · 164 pasadas / 0 fallidas / 7 omitidas (por diseño: la prueba móvil sólo corre en el proyecto móvil)

| Proyecto | Archivo | Prueba | Estado | ms |
| --- | --- | --- | --- | --- |
| desktop-1280 | `interaction.spec.ts` | ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela | passed | 1300 |
| desktop-1280 | `interaction.spec.ts` | ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia | passed | 4378 |
| desktop-1280 | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 749 |
| desktop-1280 | `interaction.spec.ts` | INT-02 · confirmar edición válida: se aplica en la siguiente respiración | passed | 1278 |
| desktop-1280 | `interaction.spec.ts` | INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima | passed | 300 |
| desktop-1280 | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 3667 |
| desktop-1280 | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 1477 |
| desktop-1280 | `interaction.spec.ts` | INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor | passed | 1096 |
| desktop-1280 | `interaction.spec.ts` | INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada | passed | 1061 |
| desktop-1280 | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel | passed | 3303 |
| desktop-1280 | `interaction.spec.ts` | Pausar, velocidad y Congelar viven en .signal-toolbar y no se confunden | passed | 383 |
| desktop-1280 | `interaction.spec.ts` | SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel | passed | 516 |
| desktop-1280 | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa explícita con aviso; reanudación manual sin salto de reloj | passed | 2682 |
| desktop-1280 | `interaction.spec.ts` | abrir el circuito en «Eventos» dispara la alarma alta; deshacer la resuelve y reconocer devuelve la banda al azul | passed | 5534 |
| desktop-1280 | `interaction.spec.ts` | cargar SC-24 muestra la amplitud evocada 8 en el panel del paciente | passed | 280 |
| desktop-1280 | `interaction.spec.ts` | el alternador muestra 6 casillas grandes, persiste y vuelve a 13 sin romper la tabla | passed | 374 |
| desktop-1280 | `interaction.spec.ts` | el bucle Pva·V con presión total se ve en el panel docente | passed | 292 |
| desktop-1280 | `interaction.spec.ts` | el campo vacío no vale como cero y el Resumen no revela las cifras tapadas | passed | 478 |
| desktop-1280 | `interaction.spec.ts` | el cursor cae donde apunta el puntero: el centro de la rejilla es el centro de la ventana | passed | 4881 |
| desktop-1280 | `interaction.spec.ts` | el cursor se maneja con el teclado, se anuncia, y sigue midiendo al recorrer la historia | passed | 4834 |
| desktop-1280 | `interaction.spec.ts` | guardar una referencia dibuja el ciclo previo atenuado bajo la traza actual | passed | 2765 |
| desktop-1280 | `interaction.spec.ts` | la pantalla de protección lee el índice de estrés y construye la titulación con lo medido | passed | 2275 |
| desktop-1280 | `interaction.spec.ts` | la pestaña de la lección se abre primero, cuenta lo hecho y avisa al cumplir un objetivo | passed | 1676 |
| desktop-1280 | `interaction.spec.ts` | la tecla muestra lo entregado; la propuesta confirmada se anuncia aparte con su flecha | passed | 409 |
| desktop-1280 | `interaction.spec.ts` | lo que ya se cumple al abrir se marca sin aviso | passed | 1251 |
| desktop-1280 | `interaction.spec.ts` | los controles de tiempo caben sin desbordar el ancho del viewport | passed | 194 |
| desktop-1280 | `interaction.spec.ts` | los valores medidos se ocultan hasta que el alumno los estima | passed | 496 |
| desktop-1280 | `interaction.spec.ts` | recorrer la historia desplaza la ventana en el tiempo | passed | 4810 |
| desktop-1280 | `interaction.spec.ts` | sin bloqueo no inventa números; con bloqueo enseña la cuenta con los del monitor | passed | 1356 |
| desktop-1280 | `interaction.spec.ts` | subir PEEP por encima de la apertura recluta; bajarla por encima del cierre lo conserva | passed | 4724 |
| desktop-1280 | `interaction.spec.ts` | tocar o pulsar la curva congelada basta para medir | passed | 4841 |
| desktop-1280 | `interaction.spec.ts` | un `speed` ilegible se descarta con aviso y el motor avanza igual | passed | 303 |
| desktop-1280 | `interaction.spec.ts` | una sesión importada no marca objetivos del escenario que estaba abierto | passed | 6277 |
| desktop-1280 | `interaction.spec.ts` | «TET 7,0 mm» fija el deslizador K₂ a 9,2 y moverlo a mano deja «Personalizado» | passed | 242 |
| desktop-1280 | `mobile.spec.ts` | datos grandes: los seis valores a la vista en dos columnas; bucles apilados; la alarma no se recorta | skipped | 0 |
| desktop-1280 | `mobile.spec.ts` | escritorio: la ventana arranca en 12 s | passed | 250 |
| desktop-1280 | `mobile.spec.ts` | móvil (< 700 px): la ventana arranca en 6 s | skipped | 83 |
| desktop-1280 | `mobile.spec.ts` | sin desbordamiento; las trece cifras a la vista y legibles; el monitor cabe en su ventana; el editor fuera del monitor | skipped | 0 |
| desktop-1280 | `pc.spec.ts` | Escape cierra primero el diálogo y el reloj del monitor muestra la hora del día | passed | 352 |
| desktop-1280 | `pc.spec.ts` | PEEP: el primer paso del deslizador es Off, no 0 | passed | 277 |
| desktop-1280 | `pc.spec.ts` | VTesp bajo y FR alta configurados en el diálogo se activan mientras ventila y se reflejan en la banda | passed | 617 |
| desktop-1280 | `pc.spec.ts` | bloqueo inspiratorio rechazado por Pmáx: resultado no válido con motivo legible y aviso | passed | 1300 |
| desktop-1280 | `pc.spec.ts` | cambiar a A/C PC desde el menú de modos: teclas rápidas, curvas y VT esperado | passed | 2532 |
| desktop-1280 | `pc.spec.ts` | deslizador recorre sólo valores admitidos; ± y deslizador coinciden; escritura fuera de rejilla sugiere el más cercano | passed | 1288 |
| desktop-1280 | `pc.spec.ts` | el VTesp mostrado cambia entre ciclos alrededor del volumen programado | passed | 12262 |
| desktop-1280 | `pc.spec.ts` | la columna de presión desciende de forma progresiva al terminar la inspiración | passed | 8224 |
| desktop-1280 | `pc.spec.ts` | menú de modo: flujo de base y disparo por presión; el disparo por flujo no puede superar el flujo de base | passed | 2235 |
| desktop-1280 | `pc.spec.ts` | ▶ es idempotente mientras hay solicitud; «Cancelar» la anula y se anuncia | passed | 670 |
| desktop-1280 | `ps.spec.ts` | SC-19: apnea provocada → alarma alta y respaldo; al deshacerla el paciente vuelve y la alarma se resuelve | passed | 6672 |
| desktop-1280 | `ps.spec.ts` | cambiar a CPAP/PS desde el menú de modos: bloque de respaldo, teclas rápidas y respiraciones espontáneas | passed | 5182 |
| desktop-1280 | `visual.spec.ts` | VIS-01 + DAT-02 · P1: panel denso y bloqueo; Pplat de bloqueo 32 y Cstat 19 fechados | passed | 484 |
| desktop-1280 | `visual.spec.ts` | VIS-02 + DAT-01 · P3: datos grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 444 |
| desktop-1280 | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro | passed | 665 |
| desktop-1280 | `visual.spec.ts` | VIS-04 · alarma de Pmáx (SC-09): banda roja, luz del bisel y celda resaltada | passed | 2347 |
| desktop-1280 | `visual.spec.ts` | VIS-05 · vistas de bucles, tabla, tendencias y registro son funcionales | passed | 1776 |
| desktop-1280 | `visual.spec.ts` | VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3 | passed | 1492 |
| desktop-1280 | `visual.spec.ts` | VIS-08 · CPAP/PS (SC-19): presión a PEEP + PS, flujo cortado al 25 % del pico, volumen del paciente | passed | 1370 |
| desktop-1440 | `interaction.spec.ts` | ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela | passed | 1304 |
| desktop-1440 | `interaction.spec.ts` | ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia | passed | 5454 |
| desktop-1440 | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 659 |
| desktop-1440 | `interaction.spec.ts` | INT-02 · confirmar edición válida: se aplica en la siguiente respiración | passed | 1318 |
| desktop-1440 | `interaction.spec.ts` | INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima | passed | 343 |
| desktop-1440 | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 3699 |
| desktop-1440 | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 1539 |
| desktop-1440 | `interaction.spec.ts` | INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor | passed | 1083 |
| desktop-1440 | `interaction.spec.ts` | INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada | passed | 873 |
| desktop-1440 | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel | passed | 3313 |
| desktop-1440 | `interaction.spec.ts` | Pausar, velocidad y Congelar viven en .signal-toolbar y no se confunden | passed | 379 |
| desktop-1440 | `interaction.spec.ts` | SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel | passed | 522 |
| desktop-1440 | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa explícita con aviso; reanudación manual sin salto de reloj | passed | 2674 |
| desktop-1440 | `interaction.spec.ts` | abrir el circuito en «Eventos» dispara la alarma alta; deshacer la resuelve y reconocer devuelve la banda al azul | passed | 5577 |
| desktop-1440 | `interaction.spec.ts` | cargar SC-24 muestra la amplitud evocada 8 en el panel del paciente | passed | 310 |
| desktop-1440 | `interaction.spec.ts` | el alternador muestra 6 casillas grandes, persiste y vuelve a 13 sin romper la tabla | passed | 387 |
| desktop-1440 | `interaction.spec.ts` | el bucle Pva·V con presión total se ve en el panel docente | passed | 310 |
| desktop-1440 | `interaction.spec.ts` | el campo vacío no vale como cero y el Resumen no revela las cifras tapadas | passed | 532 |
| desktop-1440 | `interaction.spec.ts` | el cursor cae donde apunta el puntero: el centro de la rejilla es el centro de la ventana | passed | 4846 |
| desktop-1440 | `interaction.spec.ts` | el cursor se maneja con el teclado, se anuncia, y sigue midiendo al recorrer la historia | passed | 4819 |
| desktop-1440 | `interaction.spec.ts` | guardar una referencia dibuja el ciclo previo atenuado bajo la traza actual | passed | 2764 |
| desktop-1440 | `interaction.spec.ts` | la pantalla de protección lee el índice de estrés y construye la titulación con lo medido | passed | 2250 |
| desktop-1440 | `interaction.spec.ts` | la pestaña de la lección se abre primero, cuenta lo hecho y avisa al cumplir un objetivo | passed | 1671 |
| desktop-1440 | `interaction.spec.ts` | la tecla muestra lo entregado; la propuesta confirmada se anuncia aparte con su flecha | passed | 406 |
| desktop-1440 | `interaction.spec.ts` | lo que ya se cumple al abrir se marca sin aviso | passed | 1262 |
| desktop-1440 | `interaction.spec.ts` | los controles de tiempo caben sin desbordar el ancho del viewport | passed | 211 |
| desktop-1440 | `interaction.spec.ts` | los valores medidos se ocultan hasta que el alumno los estima | passed | 556 |
| desktop-1440 | `interaction.spec.ts` | recorrer la historia desplaza la ventana en el tiempo | passed | 4835 |
| desktop-1440 | `interaction.spec.ts` | sin bloqueo no inventa números; con bloqueo enseña la cuenta con los del monitor | passed | 1343 |
| desktop-1440 | `interaction.spec.ts` | subir PEEP por encima de la apertura recluta; bajarla por encima del cierre lo conserva | passed | 4732 |
| desktop-1440 | `interaction.spec.ts` | tocar o pulsar la curva congelada basta para medir | passed | 4861 |
| desktop-1440 | `interaction.spec.ts` | un `speed` ilegible se descarta con aviso y el motor avanza igual | passed | 259 |
| desktop-1440 | `interaction.spec.ts` | una sesión importada no marca objetivos del escenario que estaba abierto | passed | 6266 |
| desktop-1440 | `interaction.spec.ts` | «TET 7,0 mm» fija el deslizador K₂ a 9,2 y moverlo a mano deja «Personalizado» | passed | 258 |
| desktop-1440 | `mobile.spec.ts` | datos grandes: los seis valores a la vista en dos columnas; bucles apilados; la alarma no se recorta | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | escritorio: la ventana arranca en 12 s | passed | 353 |
| desktop-1440 | `mobile.spec.ts` | móvil (< 700 px): la ventana arranca en 6 s | skipped | 306 |
| desktop-1440 | `mobile.spec.ts` | sin desbordamiento; las trece cifras a la vista y legibles; el monitor cabe en su ventana; el editor fuera del monitor | skipped | 0 |
| desktop-1440 | `pc.spec.ts` | Escape cierra primero el diálogo y el reloj del monitor muestra la hora del día | passed | 303 |
| desktop-1440 | `pc.spec.ts` | PEEP: el primer paso del deslizador es Off, no 0 | passed | 304 |
| desktop-1440 | `pc.spec.ts` | VTesp bajo y FR alta configurados en el diálogo se activan mientras ventila y se reflejan en la banda | passed | 701 |
| desktop-1440 | `pc.spec.ts` | bloqueo inspiratorio rechazado por Pmáx: resultado no válido con motivo legible y aviso | passed | 1320 |
| desktop-1440 | `pc.spec.ts` | cambiar a A/C PC desde el menú de modos: teclas rápidas, curvas y VT esperado | passed | 3469 |
| desktop-1440 | `pc.spec.ts` | deslizador recorre sólo valores admitidos; ± y deslizador coinciden; escritura fuera de rejilla sugiere el más cercano | passed | 1269 |
| desktop-1440 | `pc.spec.ts` | el VTesp mostrado cambia entre ciclos alrededor del volumen programado | passed | 12354 |
| desktop-1440 | `pc.spec.ts` | la columna de presión desciende de forma progresiva al terminar la inspiración | passed | 8288 |
| desktop-1440 | `pc.spec.ts` | menú de modo: flujo de base y disparo por presión; el disparo por flujo no puede superar el flujo de base | passed | 1330 |
| desktop-1440 | `pc.spec.ts` | ▶ es idempotente mientras hay solicitud; «Cancelar» la anula y se anuncia | passed | 677 |
| desktop-1440 | `ps.spec.ts` | SC-19: apnea provocada → alarma alta y respaldo; al deshacerla el paciente vuelve y la alarma se resuelve | passed | 6662 |
| desktop-1440 | `ps.spec.ts` | cambiar a CPAP/PS desde el menú de modos: bloque de respaldo, teclas rápidas y respiraciones espontáneas | passed | 5560 |
| desktop-1440 | `visual.spec.ts` | VIS-01 + DAT-02 · P1: panel denso y bloqueo; Pplat de bloqueo 32 y Cstat 19 fechados | passed | 764 |
| desktop-1440 | `visual.spec.ts` | VIS-02 + DAT-01 · P3: datos grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 523 |
| desktop-1440 | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro | passed | 662 |
| desktop-1440 | `visual.spec.ts` | VIS-04 · alarma de Pmáx (SC-09): banda roja, luz del bisel y celda resaltada | passed | 2409 |
| desktop-1440 | `visual.spec.ts` | VIS-05 · vistas de bucles, tabla, tendencias y registro son funcionales | passed | 1840 |
| desktop-1440 | `visual.spec.ts` | VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3 | passed | 1604 |
| desktop-1440 | `visual.spec.ts` | VIS-08 · CPAP/PS (SC-19): presión a PEEP + PS, flujo cortado al 25 % del pico, volumen del paciente | passed | 1412 |
| mobile | `interaction.spec.ts` | ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela | passed | 1404 |
| mobile | `interaction.spec.ts` | ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia | passed | 4594 |
| mobile | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 600 |
| mobile | `interaction.spec.ts` | INT-02 · confirmar edición válida: se aplica en la siguiente respiración | passed | 1434 |
| mobile | `interaction.spec.ts` | INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima | passed | 511 |
| mobile | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 3877 |
| mobile | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 1544 |
| mobile | `interaction.spec.ts` | INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor | passed | 1164 |
| mobile | `interaction.spec.ts` | INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada | passed | 2318 |
| mobile | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel | passed | 3320 |
| mobile | `interaction.spec.ts` | Pausar, velocidad y Congelar viven en .signal-toolbar y no se confunden | passed | 464 |
| mobile | `interaction.spec.ts` | SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel | passed | 619 |
| mobile | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa explícita con aviso; reanudación manual sin salto de reloj | passed | 2780 |
| mobile | `interaction.spec.ts` | abrir el circuito en «Eventos» dispara la alarma alta; deshacer la resuelve y reconocer devuelve la banda al azul | passed | 5805 |
| mobile | `interaction.spec.ts` | cargar SC-24 muestra la amplitud evocada 8 en el panel del paciente | passed | 244 |
| mobile | `interaction.spec.ts` | el alternador muestra 6 casillas grandes, persiste y vuelve a 13 sin romper la tabla | passed | 491 |
| mobile | `interaction.spec.ts` | el bucle Pva·V con presión total se ve en el panel docente | passed | 259 |
| mobile | `interaction.spec.ts` | el campo vacío no vale como cero y el Resumen no revela las cifras tapadas | passed | 645 |
| mobile | `interaction.spec.ts` | el cursor cae donde apunta el puntero: el centro de la rejilla es el centro de la ventana | passed | 4989 |
| mobile | `interaction.spec.ts` | el cursor se maneja con el teclado, se anuncia, y sigue midiendo al recorrer la historia | passed | 4944 |
| mobile | `interaction.spec.ts` | guardar una referencia dibuja el ciclo previo atenuado bajo la traza actual | passed | 3028 |
| mobile | `interaction.spec.ts` | la pantalla de protección lee el índice de estrés y construye la titulación con lo medido | passed | 2363 |
| mobile | `interaction.spec.ts` | la pestaña de la lección se abre primero, cuenta lo hecho y avisa al cumplir un objetivo | passed | 1705 |
| mobile | `interaction.spec.ts` | la tecla muestra lo entregado; la propuesta confirmada se anuncia aparte con su flecha | passed | 564 |
| mobile | `interaction.spec.ts` | lo que ya se cumple al abrir se marca sin aviso | passed | 1344 |
| mobile | `interaction.spec.ts` | los controles de tiempo caben sin desbordar el ancho del viewport | passed | 364 |
| mobile | `interaction.spec.ts` | los valores medidos se ocultan hasta que el alumno los estima | passed | 660 |
| mobile | `interaction.spec.ts` | recorrer la historia desplaza la ventana en el tiempo | passed | 4894 |
| mobile | `interaction.spec.ts` | sin bloqueo no inventa números; con bloqueo enseña la cuenta con los del monitor | passed | 1470 |
| mobile | `interaction.spec.ts` | subir PEEP por encima de la apertura recluta; bajarla por encima del cierre lo conserva | passed | 4852 |
| mobile | `interaction.spec.ts` | tocar o pulsar la curva congelada basta para medir | passed | 4988 |
| mobile | `interaction.spec.ts` | un `speed` ilegible se descarta con aviso y el motor avanza igual | passed | 390 |
| mobile | `interaction.spec.ts` | una sesión importada no marca objetivos del escenario que estaba abierto | passed | 6415 |
| mobile | `interaction.spec.ts` | «TET 7,0 mm» fija el deslizador K₂ a 9,2 y moverlo a mano deja «Personalizado» | passed | 271 |
| mobile | `mobile.spec.ts` | datos grandes: los seis valores a la vista en dos columnas; bucles apilados; la alarma no se recorta | passed | 2728 |
| mobile | `mobile.spec.ts` | escritorio: la ventana arranca en 12 s | skipped | 79 |
| mobile | `mobile.spec.ts` | móvil (< 700 px): la ventana arranca en 6 s | passed | 365 |
| mobile | `mobile.spec.ts` | sin desbordamiento; las trece cifras a la vista y legibles; el monitor cabe en su ventana; el editor fuera del monitor | passed | 795 |
| mobile | `pc.spec.ts` | Escape cierra primero el diálogo y el reloj del monitor muestra la hora del día | passed | 432 |
| mobile | `pc.spec.ts` | PEEP: el primer paso del deslizador es Off, no 0 | passed | 605 |
| mobile | `pc.spec.ts` | VTesp bajo y FR alta configurados en el diálogo se activan mientras ventila y se reflejan en la banda | passed | 745 |
| mobile | `pc.spec.ts` | bloqueo inspiratorio rechazado por Pmáx: resultado no válido con motivo legible y aviso | passed | 1436 |
| mobile | `pc.spec.ts` | cambiar a A/C PC desde el menú de modos: teclas rápidas, curvas y VT esperado | passed | 2772 |
| mobile | `pc.spec.ts` | deslizador recorre sólo valores admitidos; ± y deslizador coinciden; escritura fuera de rejilla sugiere el más cercano | passed | 1601 |
| mobile | `pc.spec.ts` | el VTesp mostrado cambia entre ciclos alrededor del volumen programado | passed | 12352 |
| mobile | `pc.spec.ts` | la columna de presión desciende de forma progresiva al terminar la inspiración | passed | 8393 |
| mobile | `pc.spec.ts` | menú de modo: flujo de base y disparo por presión; el disparo por flujo no puede superar el flujo de base | passed | 1406 |
| mobile | `pc.spec.ts` | ▶ es idempotente mientras hay solicitud; «Cancelar» la anula y se anuncia | passed | 790 |
| mobile | `ps.spec.ts` | SC-19: apnea provocada → alarma alta y respaldo; al deshacerla el paciente vuelve y la alarma se resuelve | passed | 6693 |
| mobile | `ps.spec.ts` | cambiar a CPAP/PS desde el menú de modos: bloque de respaldo, teclas rápidas y respiraciones espontáneas | passed | 5404 |
| mobile | `visual.spec.ts` | VIS-01 + DAT-02 · P1: panel denso y bloqueo; Pplat de bloqueo 32 y Cstat 19 fechados | passed | 668 |
| mobile | `visual.spec.ts` | VIS-02 + DAT-01 · P3: datos grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 635 |
| mobile | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro | passed | 938 |
| mobile | `visual.spec.ts` | VIS-04 · alarma de Pmáx (SC-09): banda roja, luz del bisel y celda resaltada | passed | 2636 |
| mobile | `visual.spec.ts` | VIS-05 · vistas de bucles, tabla, tendencias y registro son funcionales | passed | 1904 |
| mobile | `visual.spec.ts` | VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3 | passed | 1840 |
| mobile | `visual.spec.ts` | VIS-08 · CPAP/PS (SC-19): presión a PEEP + PS, flujo cortado al 25 % del pico, volumen del paciente | passed | 1598 |

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

Un identificador cuenta como habilitado sólo si todas las pruebas que lo citan pasan. ACC-01, ALM-02, ALM-03, ALM-05, ALM-07, ALM-10, ALM-11, BM-01, BM-02, BM-03, BM-04, BM-05, BM-06, BM-07, BM-08, DAT-01, DAT-02, DAT-04, INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, PHY-02, PHY-03, PHY-06, PHY-07, PHY-08, PHY-10, PRC-01, PRC-02, PRC-03, PRC-05, SEC-01, SEC-03, TIM-01, TIM-02, TIM-03, TIM-04, VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, VIS-06, VIS-08.


## No ejecutado en esta etapa

ALM-04 automatizada de extremo a extremo (pausa de audio); PHY-05 (fuga no modelada); PRC-04 (SBT); DAT-05 en UI; DAT-06 en UI; CFG-04; ACC-02 automatizada; auditoría de accesibilidad formal; revisión experta L3; contraste con equipo de demostración.
