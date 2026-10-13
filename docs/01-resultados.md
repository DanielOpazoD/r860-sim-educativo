# Resultados de pruebas ejecutadas · v0.4.0 (adulto A/C VC + A/C PC + CPAP/PS · interfaz Ventila Lab)

Generado el 2026-10-12T15:09:45 con `npm run results:doc` a partir de `test-results/vitest.json` y `test-results/e2e-results.json` (salidas reales). Motor 0.4.0 · perfil ventila-adulto-v1 · dt 4 ms · semilla 1 · t0 2026-08-18T21:04:05-04:00 · Node 22.22.0 · Chromium (Playwright 1.63.0, build 1243).

## Niveles de validación

- **L0 visual**: capturas deterministas en `docs/capturas/` con JSON de metadatos. Comparación por zonas con P1/P3 hecha por la IA constructora; sin baseline aprobada por revisor humano.
- **L1 interacción**: Playwright (abajo).
- **L2 modelo analítico**: Vitest, banco BM-01…BM-08 y PC, físicas y regresiones.
- **L3 revisión experta**: pendiente.

## Vitest · 617 pasadas / 0 fallidas / 617 totales

| Archivo | Prueba | Estado | ms |
| --- | --- | --- | --- |
| `bench/bm.test.ts` | BM-01 · VC con flujo constante (banco lineal pasivo) › Tinsp 1 s, Ppico 20 cmH2O, presión elástica al ocluir 15 cmH2O | passed | 62 |
| `bench/bm.test.ts` | BM-02 · Cstat y resistencia desde la misma respiración › Cstat = 500/(15−5) = 50 mL/cmH2O; R = (20−15)/0.5 = 10 | passed | 40 |
| `bench/bm.test.ts` | BM-03 · Fuente de presión ideal (modelo, no modo PC) › ΔP 10 sobre PEEP 5, R 10, C 0.05, 1 s: VT ≈ 0.432332 L; Q0 = 1 L/s; Qfin ≈ 0.135335 L/s | passed | 1 |
| `bench/bm.test.ts` | BM-04 · Espiración incompleta (atrapamiento) › Rexp 20, C 0.05, exceso 0.5 L, Te 0.5 s: exceso final ≈ 0.303265 L; presión elástica extra ≈ 6.0653 cmH2O | passed | 1 |
| `bench/bm.test.ts` | BM-05 · Unidades › 0.5 L/s → 30 L/min; 0.5 L·1 s → 500 mL; C 0.05 → 50 mL/cmH2O | passed | 0 |
| `bench/bm.test.ts` | BM-05 · Unidades › el motor no confunde unidades: VTesp de banco = 500 mL exactos | passed | 42 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › Plimit 25 (< Pmáx 40): el flujo cae para mantener 25 durante el Tinsp restante; VT real < VT programado; ciclo por tiempo | passed | 12 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › Pmáx 30 (< Plimit 60): alcanzar Pmáx TERMINA la inspiración a 0.8 s; VT = 0.4 L; alarma Pmáx activa | passed | 23 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › no fuerza el volumen objetivo bajo límites: VTesp medido difiere del VT programado | passed | 33 |
| `bench/bm.test.ts` | BM-07 · Conservación de volumen (sin fuga) › por respiración: VTinsp − VTesp = ΔV absoluto; acumulado en 10 respiraciones | passed | 52 |
| `bench/bm.test.ts` | BM-08 · Convergencia con el paso de integración › errores de VT decrecientes para dt = 4, 2, 1 ms en la respiración limitada por presión (RK2) | passed | 96 |
| `bench/bm.test.ts` | BM-08 · Convergencia con el paso de integración › los tiempos de evento (Ppico, Tinsp) no dependen del paso cuando el evento no cae en un múltiplo de dt | passed | 15 |
| `bench/circuito.test.ts` | BM-CC circuito compresible › el pulmón recibe ≈ VT·C/(C+Cc) y la meseta baja acorde | passed | 121 |
| `bench/circuito.test.ts` | BM-CC circuito compresible › la Cstat del bloqueo inspiratorio sale ≈ C + Cc | passed | 34 |
| `bench/circuito.test.ts` | BM-CC circuito compresible › la descompresión al espirar nunca supera el tope del actuador | passed | 8 |
| `bench/disparoReverso.test.ts` | BM-RT · disparo reverso en SC-24 › con latencia 0,5 s la Pmus máxima de cada ciclo cae a inicio+0,5+0,8 ±0,02 s y todas las respiraciones son mandatory | passed | 332 |
| `bench/disparoReverso.test.ts` | BM-RT · disparo reverso en SC-24 › con latencia 1,4 s aparece alguna respiración asistida apilada (< 0,6 s tras el fin de la inspiración previa) | passed | 259 |
| `bench/disparoReverso.test.ts` | BM-RT · disparo reverso en SC-24 › sin `reverse` las trazas de Pva son idénticas a las del esfuerzo apagado sin reverse | passed | 306 |
| `bench/espiracionActiva.test.ts` | BM-EA espiración activa › el pico de flujo espiratorio crece ≥15 % con expAmplitude 8 | passed | 138 |
| `bench/espiracionActiva.test.ts` | BM-EA espiración activa › en estado estable VTe ≥ VTi·0,99 y el pulmón vacía por debajo de su FRC pasiva | passed | 89 |
| `bench/espiracionActiva.test.ts` | BM-EA espiración activa › con limitación al flujo espiratorio, a igual volumen el flujo activo no supera al pasivo en más de 3 % (Starling) | passed | 251 |
| `bench/pc.test.ts` | BM-03 · A/C PC ideal (rampa 0) en el motor › ΔP 10 sobre PEEP 5, R 10, C 0.05, Tinsp 1 s: VT ≈ 0.432332 L; Q0 = 1 L/s; Qfin ≈ 0.135335 L/s; Ppico = PEEP + Pinsp | passed | 90 |
| `bench/pc.test.ts` | BM-03 · A/C PC ideal (rampa 0) en el motor › con rampa de 200 ms el VT coincide con la referencia numérica independiente (< 1 %) | passed | 84 |
| `bench/pc.test.ts` | BM-03 · A/C PC ideal (rampa 0) en el motor › tope de flujo del actuador (160 L/min): con R muy baja la presión no alcanza el objetivo de inmediato | passed | 40 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › duplicar R halva el flujo pico y reduce el VT; Ppico no cambia | passed | 6 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › halvar C reduce el VT (hacia C·ΔP) y acorta la constante de tiempo | passed | 35 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › alargar Tinsp aumenta el VT hasta saturar; el flujo cae a ~cero (fase plana del flujo) | passed | 12 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › cambiar PEEP en PC conserva el volumen y desplaza la línea base: mismo VT (ΔP relativo), Ppico = nuevo PEEP + Pinsp | passed | 37 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › el esfuerzo del paciente aumenta el flujo y el VT con la misma presión de vía aérea | passed | 34 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › BM-07 en PC: conservación de volumen por respiración | passed | 23 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › validación PC: PEEP + Pinsp ≥ Pmáx y rampa > Tinsp se rechazan con explicación; el cambio VC → PC es transacción de siguiente respiración | passed | 30 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › por debajo de la apertura no recluta: r se mantiene 0 y la Cstat es la basal (≈30 mL/cmH₂O) | passed | 173 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › mantener presión por encima de la apertura abre la capacidad ganable: r sube y la meseta baja al mismo VT | passed | 124 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › histéresis: la PEEP decremental devuelve más compliance que la ascendente al mismo nivel | passed | 67 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › por debajo del cierre se desrecluta con su propia constante de tiempo | passed | 104 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › quitar el reclutamiento devuelve el modelo exactamente al lineal | passed | 73 |
| `bench/reguladorPeep.test.ts` | BM-RP · regulador de PEEP: caída transitoria bajo demanda, recuperación en régimen › con fuga estable que el flujo de base cubre la Pva tardía se queda en PEEP: la acción integral no deja caída permanente | passed | 407 |
| `bench/reguladorPeep.test.ts` | BM-RP · regulador de PEEP: caída transitoria bajo demanda, recuperación en régimen › la caída máxima crece con la amplitud del esfuerzo y baja con más flujo de base | passed | 806 |
| `bench/reguladorPeep.test.ts` | BM-RP · regulador de PEEP: caída transitoria bajo demanda, recuperación en régimen › en un escenario con esfuerzo la PEEPe medida se conserva: la traza pre-disparo no se contamina | passed | 86 |
| `bench/viscoelasticoReferencia.test.ts` | BM-VE · preset sano de viscoelasticidad en una oclusión de 3 s › P1 − P2 queda en 0,8–2,5 cmH₂O y P2 ≈ P0 + VT/Crs | passed | 262 |
| `bench/viscoelasticoReferencia.test.ts` | BM-VE · preset sano de viscoelasticidad en una oclusión de 3 s › con el preset SDRA la diferencia P1 − P2 es más del doble que la sana | passed | 166 |
| `bench/viscoelasticoReferencia.test.ts` | BM-VE · preset TET 7,0 mm (K₂ 9,2) › a 0,5 L/s la presión pico sube ≈ K₂·Q² = 2,3 ± 0,4 cmH₂O respecto a K₂ 0 | passed | 54 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › ppeakLow: 30 dispara (medium); 10 resuelve | passed | 158 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › vteLow: 0.6 dispara (medium); 0.4 resuelve | passed | 91 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › vteHigh: 0.4 dispara (medium); 0.6 resuelve | passed | 26 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › mveLow: 10 dispara (high); 5 resuelve | passed | 41 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › mveHigh: 5 dispara (medium); 10 resuelve | passed | 35 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › rrLow: 20 dispara (medium); 10 resuelve | passed | 43 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › rrHigh: 10 dispara (medium); 20 resuelve | passed | 14 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › peepeLow: 8 dispara (medium); 3 resuelve | passed | 14 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › peepeHigh: 5 dispara (medium); 20 resuelve | passed | 15 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › fio2Low: 0.3 dispara (medium); 0.18 resuelve | passed | 19 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › fio2High: 0.24 dispara (medium); 0.99 resuelve | passed | 20 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › Pmáx: bajar el techo por debajo de la presión alcanzada activa la alarma alta y termina la inspiración | passed | 26 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › los límites configurados se conservan al cargar otro escenario | passed | 45 |
| `unit/alarmLimits.test.ts` | ALM-11 · el audio suena según prioridad y respeta la pausa › alta: ráfaga de 10 tonos; media: 3; sin alarma: nada; en pausa de audio: nada; vuelve a sonar tras la cadencia | passed | 3 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-02: reconocer una alarma cuya condición persiste: sigue activa | passed | 70 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-03: resolver sin reconocer deja estado pendiente (banda gris) distinguible de activa | passed | 86 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-07: límite Off no es cero; dato ausente no genera alarma ni valor normal | passed | 1 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-05/06: la alarma Pmáx se traza al valor bruto; varias alarmas concurrentes conservan todas las condiciones | passed | 56 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › FiO2: límites sobre el sensor con retardo; sesgo del instructor separa objetivo y medición (SC-12) | passed | 130 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › el esfuerzo que sobrevive al ciclado dispara una segunda respiración en cuanto pasa el periodo refractario | passed | 203 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › la respiración apilada entra sobre un pulmón sin vaciar: más volumen y más presión | passed | 50 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › el apilamiento genera atrapamiento por sí solo: sin obstrucción ninguna, la PEEP intrínseca sube | passed | 753 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › sin control asistido el mismo esfuerzo no dispara nada: el ciclado sigue siendo por tiempo | passed | 32 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › el mismo esfuerzo deja de disparar al subir la resistencia espiratoria, porque antes debe vencer la PEEP intrínseca | passed | 285 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › el esfuerzo inefectivo deja su huella en la curva de flujo: el vaciamiento deja de ser monótono | passed | 230 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › la Pva se deforma durante un esfuerzo inefectivo y el regulador la recupera antes del siguiente ciclo | passed | 142 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › sin esfuerzo la vía es la de siempre: la Pva espiratoria se queda en PEEP | passed | 144 |
| `unit/boundaries.test.ts` | setAlarmLimits se valida como cualquier ajuste › rechaza texto, NaN, negativos, claves desconocidas, null y bajo ≥ alto; acepta Off y valores en rejilla | passed | 124 |
| `unit/boundaries.test.ts` | setAlarmLimits se valida como cualquier ajuste › increaseO2Start con delta negativo, NaN o > 100 % se rechaza; setSpeed no numérico se ignora | passed | 175 |
| `unit/boundaries.test.ts` | importación acotada › rechaza finalSimTimeMs enorme, negativo o textual, breaths ausente y comandos sin carga útil | passed | 12 |
| `unit/boundaries.test.ts` | cliente del motor: fallo del Worker no es silencioso › si el Worker nunca saluda, degrada al modo en página, avisa y sigue funcionando | passed | 104 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › con Pmus ≈ 0 sólo dibuja Pva y anota que coincide con la presión total | passed | 4 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › con Pmus negativa el eje X incluye el cero con margen negativo | passed | 1 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › con Pva negativa aunque la presión total sea positiva el eje X incluye negativos | passed | 1 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › con volumen negativo el eje Y incluye el cero con margen negativo | passed | 1 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › el esfuerzo se evalúa por ciclo: ciclo pasado pasivo + actual activo no dice «Sin esfuerzo» | passed | 1 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › no lanza con una traza vacía | passed | 1 |
| `unit/bucles.test.ts` | arrowIndices · flechas de sentido del bucle › devuelve tres posiciones repartidas por el ciclo | passed | 3 |
| `unit/bucles.test.ts` | arrowIndices · flechas de sentido del bucle › con menos de 8 muestras no dibuja flechas | passed | 1 |
| `unit/casosClinicos.test.ts` | CAS-00 · formato › cada caso declara tema, viñeta, pregunta, criterios con pruebas existentes y referencias verificadas | passed | 4 |
| `unit/casosClinicos.test.ts` | CAS-00 · formato › los casos no tienen lección guiada: se evalúan al entregar | passed | 0 |
| `unit/casosClinicos.test.ts` | CAS-01 · presión pico alta por resistencia › la mecánica produce la viñeta: Ppico ≈ 29 con Pplat normal (≈ 15) | passed | 77 |
| `unit/casosClinicos.test.ts` | CAS-01 · presión pico alta por resistencia › sin medir la meseta no se resuelve, aunque la respuesta sea correcta | passed | 37 |
| `unit/casosClinicos.test.ts` | CAS-01 · presión pico alta por resistencia › midiendo y respondiendo bien se resuelve; con otra respuesta, no | passed | 53 |
| `unit/casosClinicos.test.ts` | CAS-01 · presión pico alta por resistencia › un bloqueo anterior al último ajuste ya no cuenta | passed | 26 |
| `unit/casosClinicos.test.ts` | CAS-02 · progreso › un caso resuelto no vuelve a «intentado» | passed | 11 |
| `unit/casosClinicos.test.ts` | CAS-02 · EPOC: atrapamiento › la viñeta: PEEP intrínseca ≈ 8 y alcalemia de equilibrio ≈ 7,55; no se resuelve sin tocar nada | passed | 105 |
| `unit/casosClinicos.test.ts` | CAS-02 · EPOC: atrapamiento › FR 12 e I:E 1:4 lo resuelve; alargar sólo el I:E o bajar el VT, no | passed | 237 |
| `unit/casosClinicos.test.ts` | CAS-03 · SDRA: VT protector › la viñeta: ΔP 20 y pH 7,42 con VT 600 | passed | 26 |
| `unit/casosClinicos.test.ts` | CAS-03 · SDRA: VT protector › VT 425 con FR 28 lo resuelve; VT 425 sin subir la FR deja acidosis | passed | 57 |
| `unit/casosClinicos.test.ts` | CAS-04 · PEEP decremental › medir, abrir con PEEP 20 y volver a 11 lo resuelve; sin abrir, no | passed | 165 |
| `unit/casosClinicos.test.ts` | CAS-05 · hipercapnia › la viñeta: PaCO₂ 86 y pH 7,07 de equilibrio | passed | 30 |
| `unit/casosClinicos.test.ts` | CAS-05 · hipercapnia › VT 500 con FR 14 o VT 400 con FR 22 lo resuelven; FR 18 sola no basta; VT 600 se pasa de 8 mL/kg | passed | 162 |
| `unit/casosClinicos.test.ts` | CAS-06 · esfuerzos inefectivos › con soporte 20 un tercio de los esfuerzos no dispara; con 12 disparan todos con VT suficiente; con 6 el VT no alcanza | passed | 456 |
| `unit/casosClinicos.test.ts` | CAS-06 · esfuerzos inefectivos › EPOC hipercápnica: con soporte 20 ventila de más (alcalosis); con 12 vuelve a su equilibrio crónico | passed | 109 |
| `unit/casosClinicos.test.ts` | CAS-06 · esfuerzos inefectivos › antes de un minuto tras el último ajuste no se puede juzgar la sincronía | passed | 78 |
| `unit/casosClinicos.test.ts` | CAS-07 · autodisparo por fuga › con 4 L/min cesa el autodisparo; con 8 L/min también, pero se insensibiliza de más | passed | 110 |
| `unit/casosClinicos.test.ts` | CAS-08 · ciclado tardío › con 5 % el ventilador insufla ≈ 1 s de más; con 25 % termina con la paciente y disparan todos | passed | 297 |
| `unit/circuitoIdentidad.test.ts` | CIR-01 identidad con circuito incompresible › SC-01 con Cc = 0 da la misma traza que sin el campo | passed | 198 |
| `unit/circuitoIdentidad.test.ts` | CIR-01 identidad con circuito incompresible › SC-13 con Cc = 0 da la misma traza que sin el campo | passed | 36 |
| `unit/circuitoIdentidad.test.ts` | CIR-02 PC con circuito compresible › el pulmón recibe lo mismo y el sensor de la máquina ve más flujo | passed | 75 |
| `unit/circuitoIdentidad.test.ts` | CIR-02 PC con circuito compresible › el flujo del sensor nunca supera el tope del actuador: pulmón, fuga y compresión comparten un solo presupuesto | passed | 63 |
| `unit/clockStartup.test.ts` | autopausa no alineada se detiene en el primer paso que alcanza el objetivo | passed | 62 |
| `unit/clockStartup.test.ts` | el calentamiento de SC-12 aplica el sesgo en 10000 ms | passed | 53 |
| `unit/clockStartup.test.ts` | cambiar escenario descarta la autopausa del mundo anterior | passed | 43 |
| `unit/clockStartup.test.ts` | autopausa 0 → 0, una sola vez, también durante calentamiento | passed | 25 |
| `unit/clockStartup.test.ts` | autopausa 1 → 4, una sola vez, también durante calentamiento | passed | 16 |
| `unit/clockStartup.test.ts` | autopausa 12000 → 12000, una sola vez, también durante calentamiento | passed | 27 |
| `unit/clockStartup.test.ts` | autopausa 12001 → 12004, una sola vez, también durante calentamiento | passed | 12 |
| `unit/clockStartup.test.ts` | autopausa 12003 → 12004, una sola vez, también durante calentamiento | passed | 14 |
| `unit/clockStartup.test.ts` | autopausa 12004 → 12004, una sola vez, también durante calentamiento | passed | 9 |
| `unit/clockStartup.test.ts` | SC-02: un único init conserva la pausa y programa perturbaciones desde cero | passed | 7 |
| `unit/clockStartup.test.ts` | SC-12: un único init conserva la pausa y programa perturbaciones desde cero | passed | 11 |
| `unit/clockStartup.test.ts` | sin eventos, calentamiento y avance normal producen el mismo estado | passed | 9 |
| `unit/cobertura.test.ts` | TIM-04 · presupuesto de pasos del reloj › reparte el tiempo acumulado en pasos enteros y guarda el resto | passed | 3 |
| `unit/cobertura.test.ts` | TIM-04 · presupuesto de pasos del reloj › al superar el presupuesto descarta el exceso en vez de dar un salto gigante | passed | 0 |
| `unit/cobertura.test.ts` | TIM-04 · presupuesto de pasos del reloj › un acumulado imposible no produce pasos | passed | 1 |
| `unit/cobertura.test.ts` | DAT-04 · la guarda del denominador de la Cstat › con menos de 1 cmH2O de presión motriz no se publica una compliance inventada | passed | 0 |
| `unit/cobertura.test.ts` | DAT-04 · la guarda del denominador de la Cstat › con presión motriz suficiente devuelve VT dividido por ella, sin redondear | passed | 0 |
| `unit/cobertura.test.ts` | Pmedia y fuga con referencia independiente, no consigo mismas › la presión media publicada es la integral de la curva dibujada, calculada aparte | passed | 170 |
| `unit/cobertura.test.ts` | Pmedia y fuga con referencia independiente, no consigo mismas › la fuga publicada nunca es negativa, ni cuando el pulmón exhala más de lo que recibió | passed | 124 |
| `unit/cobertura.test.ts` | La sesión exportada sólo contiene lo que el motor aceptó › un comando rechazado no entra en el registro exportable | passed | 6 |
| `unit/cobertura.test.ts` | Las teclas booleanas se pueden editar por el mismo camino que las numéricas › seleccionar, girar y confirmar una tecla booleana da el valor interno booleano | passed | 3 |
| `unit/cobertura.test.ts` | Formatos de pantalla y lenguaje del alumno › las unidades se escriben como en el equipo | passed | 1 |
| `unit/cobertura.test.ts` | Formatos de pantalla y lenguaje del alumno › el reloj de sesión no retrocede ni con entradas absurdas | passed | 0 |
| `unit/cobertura.test.ts` | Formatos de pantalla y lenguaje del alumno › la relación I:E se escribe como la lee un clínico | passed | 0 |
| `unit/cobertura.test.ts` | Formatos de pantalla y lenguaje del alumno › los códigos internos se traducen a lenguaje clínico, y lo desconocido no se inventa | passed | 0 |
| `unit/cobertura.test.ts` | Los ejes de las curvas tienen que caber los datos › el suelo del eje de volumen baja hasta el mínimo real | passed | 0 |
| `unit/cobertura.test.ts` | Los ejes de las curvas tienen que caber los datos › sin excursión negativa el suelo se queda en la holgura del 5 % | passed | 0 |
| `unit/cobertura.test.ts` | Los ejes de las curvas tienen que caber los datos › usa escalones legibles sin reservar presión y flujo innecesarios | passed | 0 |
| `unit/cobertura.test.ts` | Los ejes de las curvas tienen que caber los datos › los demás ejes siguen cabiendo sus extremos | passed | 0 |
| `unit/commandHandlers.test.ts` | ARQ-02 · manejadores de comandos › hay exactamente un manejador por tipo de comando declarado en el dominio | passed | 2 |
| `unit/commandHandlers.test.ts` | ARQ-02 · manejadores de comandos › un tipo desconocido se rechaza sin lanzar y sin registrar | passed | 3 |
| `unit/commandHandlers.test.ts` | ARQ-02 · manejadores de comandos › los manejadores sólo ven el contexto: setVentilation y registro pasan por la interfaz | passed | 1 |
| `unit/commandPalette.test.ts` | Paleta de comandos › normaliza mayúsculas y diacríticos | passed | 3 |
| `unit/commandPalette.test.ts` | Paleta de comandos › devuelve todos los comandos en el orden original con la consulta vacía | passed | 1 |
| `unit/commandPalette.test.ts` | Paleta de comandos › encuentra texto con diacríticos ignorados | passed | 0 |
| `unit/commandPalette.test.ts` | Paleta de comandos › requiere que coincidan todos los tokens | passed | 0 |
| `unit/commandPalette.test.ts` | Paleta de comandos › prioriza coincidencias de prefijo y conserva el orden dentro de cada bloque | passed | 0 |
| `unit/commandPalette.test.ts` | Paleta de comandos › incluye las palabras clave en la búsqueda | passed | 0 |
| `unit/commandPalette.test.ts` | Paleta de comandos › no devuelve elementos sin coincidencia | passed | 0 |
| `unit/commands.test.ts` | registro de comandos de la interfaz › no repite identificadores | passed | 3 |
| `unit/commands.test.ts` | registro de comandos de la interfaz › todo data-action de la página y de las plantillas existe en el registro | passed | 2 |
| `unit/commands.test.ts` | registro de comandos de la interfaz › la paleta y los atajos sólo apuntan a comandos registrados y sin duplicados | passed | 5 |
| `unit/commands.test.ts` | registro de comandos de la interfaz › describe el atajo con la tecla visible | passed | 0 |
| `unit/commands.test.ts` | registro de comandos de la interfaz › rechaza identificadores desconocidos | passed | 0 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › .alarm-band: texto ≥ 4.5:1 sobre ambos extremos | passed | 2 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › .alarm-band.high: texto ≥ 4.5:1 sobre ambos extremos | passed | 1 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › .alarm-band.medium: texto ≥ 4.5:1 sobre ambos extremos | passed | 0 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › .alarm-band.previous: texto ≥ 4.5:1 sobre ambos extremos | passed | 0 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › el subtítulo de la banda no lleva opacidad: hereda el color medido | passed | 0 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › la prioridad media es ámbar con texto oscuro, como la celda que alarma | passed | 0 |
| `unit/contraste.test.ts` | CTR-02 · las cifras pequeñas de la columna numérica contrastan sobre el azul del monitor › .numeric .numeric-age ≥ 6:1 | passed | 1 |
| `unit/contraste.test.ts` | CTR-02 · las cifras pequeñas de la columna numérica contrastan sobre el azul del monitor › .numeric-label ≥ 6:1 | passed | 1 |
| `unit/contraste.test.ts` | CTR-02 · las cifras pequeñas de la columna numérica contrastan sobre el azul del monitor › .numeric-unit ≥ 6:1 | passed | 1 |
| `unit/contraste.test.ts` | CTR-02 · las cifras pequeñas de la columna numérica contrastan sobre el azul del monitor › .numeric .numeric-value .sin-dato ≥ 6:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-03 · la prioridad va en palabras y la luz roja parpadea salvo con «reducir movimiento» › alarmBandLabel antepone la prioridad y respeta los estados sin alarma | passed | 1 |
| `unit/contraste.test.ts` | CTR-03 · la prioridad va en palabras y la luz roja parpadea salvo con «reducir movimiento» › la luz del bisel de prioridad alta lleva animación, y la regla de reducir movimiento la anula | passed | 1 |
| `unit/contraste.test.ts` | CTR-04 · los chips de estado y la procedencia son legibles sobre el monitor › .q-ok: texto ≥ 4.5:1 sobre su fondo | passed | 1 |
| `unit/contraste.test.ts` | CTR-04 · los chips de estado y la procedencia son legibles sobre el monitor › .q-warn: texto ≥ 4.5:1 sobre su fondo | passed | 1 |
| `unit/contraste.test.ts` | CTR-04 · los chips de estado y la procedencia son legibles sobre el monitor › .q-off: texto ≥ 4.5:1 sobre el azul del monitor | passed | 0 |
| `unit/contraste.test.ts` | CTR-04 · los chips de estado y la procedencia son legibles sobre el monitor › .q-src: texto ≥ 4.5:1 sobre el azul del monitor | passed | 1 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › tickCurvas (#b3e3fa) ≥ 4,5:1 sobre #0053b5 | passed | 3 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › ejeTiempo (#b3e3fa) ≥ 4,5:1 sobre #0053b5 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › tickBucles (#b3e3fa) ≥ 4,5:1 sobre #0053b5 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › tickTendencias (#b3e3fa) ≥ 4,5:1 sobre #0053b5 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › anotacion (#c4e5f2) ≥ 4,5:1 sobre #0053b5 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › antes (#f3d593) ≥ 4,5:1 sobre #0053b5 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › marcaPplat (#ffe49a) ≥ 4,5:1 sobre #0053b5 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › marcaPpico (#ffc9c4) ≥ 4,5:1 sobre #0053b5 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › marcaEsfuerzo (#e3cdff) ≥ 4,5:1 sobre #0053b5 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › lineaPeep (#ffd66e) ≥ 4,5:1 sobre #0053b5 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › lineaVt (#9fd7ff) ≥ 4,5:1 sobre #0053b5 | passed | 0 |
| `unit/curvas.test.ts` | CUR-01 · la curva llega a donde dicen el número y la alarma › cada respiración que Pmáx corta se ve tocar Pmáx en la curva | passed | 164 |
| `unit/curvas.test.ts` | CUR-01 · la curva llega a donde dicen el número y la alarma › con el diezmado de antes esos picos no llegaban a la pantalla: la prueba mide algo | passed | 41 |
| `unit/curvas.test.ts` | CUR-01 · la curva llega a donde dicen el número y la alarma › lo que se dibuja no depende de cómo el motor agrupe las muestras en cuadros | passed | 738 |
| `unit/curvas.test.ts` | CUR-01 · la curva llega a donde dicen el número y la alarma › la traza no crece sin tope: guarda 120 s, descarta lo más antiguo y no repite instantes | passed | 4 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › cada escenario declara un descriptor fisiológico verificable | passed | 1 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-01 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 58 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-02 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 110 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-03 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 16 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-04 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 64 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-05 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 42 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-09 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 77 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-18 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 135 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-17 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 180 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-16 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 222 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-15 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 46 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-14 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 111 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-10 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 22 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-12 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 64 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-24 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 97 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-13 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 66 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-19 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 79 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-20 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 160 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-21 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 77 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-22 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 128 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-23 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 32 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-25 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 51 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-P conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 15 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-01 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 19 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-02 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 147 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-03 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 13 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-04 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 12 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-05 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 17 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-06 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 70 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-07 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 52 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-08 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 38 |
| `unit/curvas.test.ts` | Análisis educativo de curvas › calcula ΔP, Ti y τ espiratoria entre dos cursores sin inventar τ con flujos no válidos | passed | 1 |
| `unit/curvas.test.ts` | Análisis educativo de curvas › la escala fija conserva su encuadre pero crece si una señal lo supera | passed | 0 |
| `unit/curvas.test.ts` | Análisis educativo de curvas › marca inicio, ciclado, Ppico, fin espiratorio, esfuerzo y Pplat medida | passed | 0 |
| `unit/curvas.test.ts` | Análisis educativo de curvas › extrae descriptores cuantitativos de una ventana | passed | 1 |
| `unit/curvas.test.ts` | CUR-02 · la escala no cambia de tamaño en mitad del barrido › SC-18: con la escala de cada cuadro el eje encoge a medio barrido; con histéresis nunca, y nada se recorta | passed | 1694 |
| `unit/curvas.test.ts` | CUR-02 · la escala no cambia de tamaño en mitad del barrido › SC-09 igual: al cortar Pmáx las escalas no se desploman a medio barrido | passed | 168 |
| `unit/curvas.test.ts` | CUR-02 · la escala no cambia de tamaño en mitad del barrido › la regla: crece en el acto, y encoge sólo tras una ventana entera y con el barrido en el origen | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › en continuo el eje rotula el tiempo de simulación y el cursor lo recorre de borde a borde | passed | 1 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › en barrido el eje rotula la fase, y el cursor cae en la pasada que se ve a cada lado de la unión | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › la muestra más cercana es la misma que recorriendo la traza entera | passed | 3 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › los dos últimos ciclos se encuentran igual buscando desde el final | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › la respiración de referencia se alinea al inicio del último ciclo visible | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › el lector no escribe un cero con signo | passed | 0 |
| `unit/densidadTiles.test.ts` | DEN · densidad de casillas numéricas › CORE_METRICS tiene las seis casillas de la vista del equipo | passed | 8 |
| `unit/densidadTiles.test.ts` | DEN · densidad de casillas numéricas › cada clave de CORE_METRICS existe en la columna numérica (METRICS) | passed | 4 |
| `unit/effort.test.ts` | Pmus · formas del pulso de esfuerzo › halfSine se conserva: pico a mitad del Ti y cero después | passed | 4 |
| `unit/effort.test.ts` | Pmus · formas del pulso de esfuerzo › riseRelax: subida sinusoidal hasta el pico en Ti y relajación exponencial | passed | 1 |
| `unit/effort.test.ts` | Pmus · formas del pulso de esfuerzo › validateEffort rechaza una forma desconocida y una τ de relajación no positiva | passed | 2 |
| `unit/effort.test.ts` | Pmus · variabilidad determinista respiración a respiración › sin variability (o con fracciones 0) el pulso queda bit a bit periódico | passed | 211 |
| `unit/effort.test.ts` | Pmus · variabilidad determinista respiración a respiración › con ±10 % cada pico queda en rango y los períodos no son todos iguales | passed | 13 |
| `unit/effort.test.ts` | Pmus · variabilidad determinista respiración a respiración › la misma semilla repite la serie; otra semilla la cambia | passed | 3 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › sin `reverse`, pmusAt es idéntico en todas las muestras (bit a bit) | passed | 186 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › la evocada arranca en onset + delayS y hace pico en +tiS, aunque la amplitud espontánea sea 0 | passed | 0 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › con ratio 2 sólo evoca en una de cada dos respiraciones de máquina | passed | 0 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › una notificación nueva sobrescribe la evocada pendiente | passed | 0 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › disabled o reverse ausente anulan la evocada; validateEffort acota los campos | passed | 3 |
| `unit/esfuerzoEspiratorio.test.ts` | EA esfuerzo espiratorio › sin el campo o en 0 el pmusAt es idéntico (con y sin variabilidad) | passed | 201 |
| `unit/esfuerzoEspiratorio.test.ts` | EA esfuerzo espiratorio › con expAmplitude la Pmus baja en medio seno negativo y vuelve a 0 | passed | 6 |
| `unit/esfuerzoEspiratorio.test.ts` | EA esfuerzo espiratorio › la forma es continua: /ΔPmus/ entre muestras consecutivas < 1 cmH2O | passed | 2 |
| `unit/examen.test.ts` | EXM · el veredicto de la estimación informa lo correcto cerca de cero › dentro del medio dígito mostrado es exacto, aunque no sea idéntico | passed | 2 |
| `unit/examen.test.ts` | EXM · el veredicto de la estimación informa lo correcto cerca de cero › contra un cero real informa la diferencia absoluta, no un porcentaje | passed | 0 |
| `unit/examen.test.ts` | EXM · el veredicto de la estimación informa lo correcto cerca de cero › lejos de cero informa el porcentaje redondeado | passed | 0 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › con válvula ideal la Pva salta a PEEP en un paso y el flujo arranca en su pico | passed | 183 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › con apertura de 40 ms la Pva parte cerca de la presión alveolar y desciende hasta la PEEP | passed | 116 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › el flujo espiratorio alcanza su pico después de abrirse la válvula, no en el primer instante | passed | 46 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › la apertura no cambia el volumen espirado ni la PEEP total de forma apreciable | passed | 50 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en decenas de milisegundos › una apertura fuera de 0–200 ms se rechaza | passed | 1 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › sin limitación el flujo espiratorio es (Pel − Paw)/Rexp; con ella queda en (Pel − pcrit)/(f·Rexp) | passed | 2 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › es independiente del esfuerzo espiratorio y de la presión aguas abajo: eso es la meseta de flujo | passed | 0 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › con Paw ≥ pcrit no hay colapso y el flujo vuelve a ser el de la ecuación de movimiento | passed | 0 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › durante la limitación el volumen decae hacia C·pcrit con tau = f·Rexp·C, no hacia el volumen de PEEP | passed | 14 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › el resultado no depende del paso de integración | passed | 15 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › con PEEP por debajo del punto crítico el pulmón atrapa hasta que el retroceso iguala pcrit | passed | 590 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › subir la PEEP hasta el punto crítico quita la limitación sin aumentar apenas la PEEP total | passed | 415 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › sin limitación el mismo pulmón no atrapa nada a PEEP 3 | passed | 61 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › una limitación fuera de rango se rechaza | passed | 3 |
| `unit/flowLimitation.test.ts` | EFL-03 · resistencia espiratoria dependiente del volumen › la resistencia crece al vaciarse y coincide con la nominal en el volumen de referencia | passed | 0 |
| `unit/flowLimitation.test.ts` | EFL-03 · resistencia espiratoria dependiente del volumen › sin dependencia la relación flujo-volumen es una recta; con ella la rama queda por debajo de la cuerda | passed | 189 |
| `unit/flowLimitation.test.ts` | EFL-03 · resistencia espiratoria dependiente del volumen › una dependencia fuera de rango se rechaza | passed | 1 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › el generador es determinista y acotado: misma semilla, misma secuencia; ganancia dentro de ±fracción | passed | 15 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › fracción 0 devuelve ganancia exacta y no altera la secuencia posterior | passed | 0 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › el VTe mostrado varía ~±2,5 % entre ciclos mientras el volumen verdadero del modelo no cambia | passed | 186 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › VTi y VTe comparten la ganancia del sensor: la fuga mostrada sigue siendo nula | passed | 43 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › el banco analítico no lleva ruido: VTe mostrado = VTe verdadero | passed | 11 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › la reproducción de una sesión repite las mismas lecturas (mismo semilla, misma secuencia) | passed | 63 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › las alarmas de volumen comparan el valor medido, no el verdadero | passed | 24 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › una variabilidad fuera de 0–10 % se rechaza | passed | 5 |
| `unit/fuga.test.ts` | LEAK-01 · lo entregado no es lo recibido › VC con fuga 6 L/min a 10 cmH₂O: VTi es el programado, VTe lo que vuelve, y la diferencia es la fuga | passed | 126 |
| `unit/fuga.test.ts` | LEAK-01 · lo entregado no es lo recibido › sin fuga nada cambia: el registro es el de siempre | passed | 155 |
| `unit/fuga.test.ts` | LEAK-02 · la PEEP se sostiene mientras el flujo de base cubra la fuga › con base 4 L/min y fuga de 3 a la PEEP la Pva espiratoria queda en 5; con base 2 cae por debajo de 4 | passed | 589 |
| `unit/fuga.test.ts` | LEAK-03 · autodisparo: el sensor ve la fuga como si fuera el paciente › paciente pasivo, fuga 3 L/min a la PEEP y umbral 2: asistidas; umbral 4: ninguna | passed | 117 |
| `unit/fuga.test.ts` | LEAK-04 · en soporte la fuga retrasa el ciclado: el flujo medido no cae al umbral › la inspiración soportada dura más con fuga que sin ella | passed | 50 |
| `unit/fuga.test.ts` | LEAK-05 · desconexión: sin presión, sin volumen, alarma alta que se resuelve al reconectar › con el circuito abierto Ppico < 1 y VTe ≈ 0; la alarma se activa, y al cerrar el circuito se resuelve y queda por reconocer | passed | 186 |
| `unit/fuga.test.ts` | LEAK-05 · desconexión: sin presión, sin volumen, alarma alta que se resuelve al reconectar › la fuga se valida en 0–60 L/min y la desconexión es booleana | passed | 1 |
| `unit/gasometria.test.ts` | GAS-01 · ecuaciones › equilibrio alveolar y pH de referencia | passed | 2 |
| `unit/gasometria.test.ts` | GAS-01 · ecuaciones › en apnea la PaCO₂ sube 0,863·VCO₂/C mmHg por minuto | passed | 6 |
| `unit/gasometria.test.ts` | GAS-01 · ecuaciones › una respiración menor que el espacio muerto no ventila el alvéolo | passed | 1 |
| `unit/gasometria.test.ts` | GAS-05 · V̇A del último minuto › una ventilación regular da (VT − VD)·FR en cualquier fase del ciclo | passed | 1 |
| `unit/gasometria.test.ts` | GAS-05 · V̇A del último minuto › en apnea la V̇A baja y llega a 0 cuando las respiraciones salen de la ventana | passed | 0 |
| `unit/gasometria.test.ts` | GAS-02 · banco SC-01: la ventilación del pulmón fija la PaCO₂ › la primera respiración fija el equilibrio y la PaCO₂ se mantiene | passed | 497 |
| `unit/gasometria.test.ts` | GAS-02 · banco SC-01: la ventilación del pulmón fija la PaCO₂ › el CO₂ no realimenta la mecánica: presiones y volúmenes idénticos con otra gasometría | passed | 58 |
| `unit/gasometria.test.ts` | GAS-06 · equilibrio inicial con atrapamiento › se fija con la ventilación ya estable, no con la primera respiración | passed | 126 |
| `unit/gasometria.test.ts` | GAS-03 · cinética: la PaCO₂ sigue a la ventilación con τ = C/V̇A › duplicar la frecuencia lleva la PaCO₂ hacia la mitad y recorre ≈ 63 % en una τ | passed | 183 |
| `unit/gasometria.test.ts` | GAS-03 · cinética: la PaCO₂ sigue a la ventilación con τ = C/V̇A › más espacio muerto con el mismo VT sube la PaCO₂ de equilibrio | passed | 17 |
| `unit/gasometria.test.ts` | GAS-04 · validación y reproducción › rechaza valores fuera de rango y claves desconocidas | passed | 3 |
| `unit/gasometria.test.ts` | GAS-04 · validación y reproducción › la sesión reproducida da la misma gasometría | passed | 72 |
| `unit/holdsDosUnidades.test.ts` | Cstat y resistencia insp. con dos unidades en paralelo: válidas y marcadas «aprox.» › bloqueo insp válido en un pulmón de dos unidades: cstat y raw traen reason twoCompartments y quality valid | passed | 156 |
| `unit/holdsDosUnidades.test.ts` | Cstat y resistencia insp. con dos unidades en paralelo: válidas y marcadas «aprox.» › un solo compartimento: mismas muestras sin la marca de aproximación | passed | 20 |
| `unit/humanize.test.ts` | textos internos del motor › traduce todos los códigos de razón emitidos por engine, history y app | passed | 4 |
| `unit/humanize.test.ts` | textos internos del motor › traduce la mecánica del escenario a etiquetas y capitaliza la frase | passed | 2 |
| `unit/humanize.test.ts` | textos internos del motor › omite la razón user al pausar y no expone comandos internos rechazados | passed | 1 |
| `unit/lazyView.test.ts` | secciones cargadas bajo demanda › comparte la carga en curso y no renderiza si se abandona la sección antes de terminar | passed | 15 |
| `unit/lazyView.test.ts` | secciones cargadas bajo demanda › un fallo no vuelve a importar desde render y explica que la recuperación reinicia la simulación | passed | 7 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › dice cuál es y cuántos van | passed | 4 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › el último anuncia la secuencia completa y dónde repasarla | passed | 1 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › un objetivo de texto largo cabe en un aviso de una línea | passed | 1 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › en SC-01 nada se cumple al abrir: el primer bloqueo se anuncia aunque llegue en el primer segundo | passed | 181 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › en SC-13 el primer objetivo ya se cumple con el primer cuadro visible, y sólo ése se calla | passed | 201 |
| `unit/leccion.test.ts` | LEC-02 · toda tarea nombra una prueba que existe › SC-09 no pide deshacer una perturbación automática que no aparece en Eventos | passed | 1 |
| `unit/leccion.test.ts` | LEC-02 · toda tarea nombra una prueba que existe › cada `test` de cada lección está en la tabla de pruebas | passed | 1 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › con músculo y meseta estable el equipo publica lo que mide; el modelo la marca como no pasiva | passed | 52 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › Aula: las tarjetas conservan el número del equipo y añaden el aviso del modelo sólo con esfuerzo | passed | 92 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › detecta esfuerzo al arranque del bloqueo aunque desaparezca antes de la ventana final | passed | 5 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › control pasivo: Pplat15, Cstat50, deltaP10 | passed | 1 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › Plimit 12: balance por canal y flujo final | passed | 86 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › Plimit 100: balance por canal y flujo final | passed | 35 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › AC_VC: reproducción determinista con fuga y oclusión | passed | 67 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › AC_PC: reproducción determinista con fuga y oclusión | passed | 34 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › CPAP_PS: reproducción determinista con fuga y oclusión | passed | 81 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › oclusión con fuga 0: Paw es presión del nodo, Q ventilador cero | passed | 63 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › oclusión con fuga 6: Paw es presión del nodo, Q ventilador cero | passed | 15 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › VTi cero no produce porcentaje válido ni una etiqueta UI válida | passed | 14 |
| `unit/measurementFidelity.test.ts` | cierre de coherencia de pausa y SC-18 › pausa estable: conserva presión observada; esfuerzo=false | passed | 11 |
| `unit/measurementFidelity.test.ts` | cierre de coherencia de pausa y SC-18 › pausa estable: conserva presión observada; esfuerzo=true | passed | 17 |
| `unit/measurementFidelity.test.ts` | cierre de coherencia de pausa y SC-18 › pausa: no pierde el esfuerzo inicial aunque la cola y Pmus final sean pasivos | passed | 9 |
| `unit/measurementFidelity.test.ts` | cierre de coherencia de pausa y SC-18 › SC-18: el objetivo acepta la maniobra con esfuerzo tras la perturbación, no cancelaciones ni resultados previos | passed | 183 |
| `unit/mecanica.test.ts` | MEC-01 · la resistencia sale de la misma oclusión que la distensibilidad › en el banco lineal da exactamente el número del modelo | passed | 200 |
| `unit/mecanica.test.ts` | MEC-01 · la resistencia sale de la misma oclusión que la distensibilidad › al triplicar la resistencia el número la sigue, y la distensibilidad no se mueve | passed | 101 |
| `unit/mecanica.test.ts` | MEC-01 · la resistencia sale de la misma oclusión que la distensibilidad › la resistencia inspiratoria NO predice el vaciamiento, y por eso la constante se mide aparte | passed | 133 |
| `unit/mecanica.test.ts` | MEC-02 · cuando la resta no mide una resistencia, no se publica un número › en presión control no hay un caudal único que dividir, y se dice | passed | 32 |
| `unit/mecanica.test.ts` | MEC-02 · cuando la resta no mide una resistencia, no se publica un número › con Plimit recortando la entrega tampoco, aunque el modo sea volumen control | passed | 30 |
| `unit/mecanica.test.ts` | MEC-02 · cuando la resta no mide una resistencia, no se publica un número › con esfuerzo durante la rampa la resta ya no es sólo del pulmón | passed | 27 |
| `unit/mecanica.test.ts` | MEC-02 · cuando la resta no mide una resistencia, no se publica un número › si la meseta se rechaza, la resistencia y la constante caen con ella | passed | 110 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › en un compartimento lineal sale exactamente Rexp × C, sin ninguna maniobra | passed | 181 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › en el obstructivo sale la resistencia espiratoria, que es el triple de la inspiratoria | passed | 49 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › con la espiración estrangulada la recta deja de ajustar y no se publica un número | passed | 136 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › con tejido viscoelástico tampoco: la relajación sigue durante toda la espiración | passed | 38 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › si el paciente hace fuerza durante la espiración, el vaciamiento no es pasivo y se dice | passed | 152 |
| `unit/mechanicsPresets.test.ts` | PRE · presets de mecánica del paciente › K₂ crece al bajar el diámetro del TET | passed | 2 |
| `unit/mechanicsPresets.test.ts` | PRE · presets de mecánica del paciente › todos los presets caben en los rangos de sus deslizadores | passed | 1 |
| `unit/mechanicsPresets.test.ts` | PRE · presets de mecánica del paciente › los grupos de paciente cubren cada control fisiológico exactamente una vez | passed | 0 |
| `unit/mechanicsPresets.test.ts` | PRE · presets de mecánica del paciente › 'none' reproduce los valores por omisión (sin viscoelasticidad, sin tubo) | passed | 0 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › no hay frame | passed | 2 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › en espera | passed | 135 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › muestra ausente | passed | 111 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › traduce quality=valid a tono ok y etiqueta «Válido» | passed | 64 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › traduce quality=stale a tono warn y etiqueta «Antiguo» | passed | 13 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › traduce quality=inProgress a tono warn y etiqueta «En curso» | passed | 7 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › traduce quality=invalid a tono warn y etiqueta «No válido» | passed | 17 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › traduce quality=unavailable a tono off y etiqueta «No disponible» | passed | 2 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › abrevia el origen ventilator | passed | 7 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › abrevia el origen airwayModule | passed | 6 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › abrevia el origen procedure | passed | 2 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › abrevia el origen derivedModel | passed | 2 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › abrevia el origen fixture | passed | 3 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › sin bloqueo inspiratorio | passed | 3 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › muestra válida de bloqueo informa el tiempo transcurrido y conserva el detalle completo | passed | 7 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › bloqueo existente sin muestra | passed | 8 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › bloqueo inspiratorio no válido | passed | 114 |
| `unit/metricStatus.test.ts` | DATA_TABLE_GROUPS · cobertura de la tabla › incluye todas las mediciones exactamente una vez | passed | 1 |
| `unit/numericSteps.test.ts` | pasos numéricos según las reglas del perfil adulto › cruza el escalón de VT de 300 a 325 mL y vuelve a 300 | passed | 2 |
| `unit/numericSteps.test.ts` | pasos numéricos según las reglas del perfil adulto › un campo requerido vacío vuelve al mínimo al decrementar | passed | 1 |
| `unit/numericSteps.test.ts` | pasos numéricos según las reglas del perfil adulto › conserva Off en el mínimo y sube desde Off al mínimo permitido | passed | 1 |
| `unit/numericSteps.test.ts` | pasos numéricos según las reglas del perfil adulto › convierte Off y los límites de VT entre índices del deslizador y valores | passed | 1 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-04 · Plimit recorta la entrega: los tres objetivos se cumplen | passed | 322 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-05 · esfuerzos que no disparan: los tres objetivos se cumplen | passed | 212 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-19 · presión de soporte: espontáneas, PS a 15 y apnea con recuperación | passed | 129 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-20 · ciclado tardío: el Ti supera al esfuerzo hasta subir el ciclaje al 50 % | passed | 72 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-21 · ventilación protectora: ΔP alta, VT reducido con ΔP < 15 y potencia bajo 15 J/min | passed | 122 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-22 · fuga: se ve en la tabla, dispara sola y se calla subiendo el umbral | passed | 147 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-23 · desconexión: alarma, reconexión que la resuelve y reconocimiento que limpia la banda | passed | 145 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-17 · pendelluft: la meseta corta que se pide es una que el equipo acepta | passed | 359 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › un objetivo que no se cumple ya no bloquea a los que vienen detrás | passed | 3 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-09 · la lección de alarmas sigue siendo terminable con los límites puestos | passed | 159 |
| `unit/objetivos.test.ts` | ALM · los límites por omisión vigilan sin molestar › ninguno viene en Off salvo la PEEP espiratoria, como en las fotografías | passed | 4 |
| `unit/objetivos.test.ts` | ALM · los límites por omisión vigilan sin molestar › sólo el escenario de asincronías alarma, y por lo que debe | passed | 2872 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-02 · «antes del cambio» rechaza una meseta medida después (el falso logro) | passed | 3 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-02 · la tarea de PEEP exige llegar a 8 y medir la meseta después del ajuste | passed | 1 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-25 · la decremental exige una medida previa a la apertura y otra posterior | passed | 1 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-25 · la medida «dereclutada» deja de contar una vez abierto el pulmón | passed | 1 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-02 en el simulador: medir sólo después de los 20 s deja «antes» sin cumplir | passed | 108 |
| `unit/occlusionVariability.test.ts` | la pausa conserva Pmus inicial al cruzar la frontera de un período variable | passed | 51 |
| `unit/patientProfiles.test.ts` | Perfiles del paciente › resuelve los escenarios de referencia y coincide con cada estado propio | passed | 4 |
| `unit/patientProfiles.test.ts` | Perfiles del paciente › compara ignorando claves indefinidas y con tolerancia numérica | passed | 0 |
| `unit/patientProfiles.test.ts` | Perfiles del paciente › genera hints desde los parámetros del escenario | passed | 133 |
| `unit/patientProfiles.test.ts` | Perfiles del paciente › resume bajo el nombre lo que define al perfil: C y R si es pasivo, el esfuerzo si respira | passed | 1 |
| `unit/peepe.test.ts` | PEEPe medida antes de la deflexión de disparo › CPAP/PS con esfuerzo: la PEEPe queda en la PEEP programada, no en el fondo del valle de disparo | passed | 182 |
| `unit/peepe.test.ts` | PEEPe medida antes de la deflexión de disparo › banco pasivo A/C VC: la PEEPe sigue en la PEEP programada (sin regresión) | passed | 175 |
| `unit/physics.test.ts` | PHY-06 · cambiar PEEP conserva el volumen pulmonar; no se suma PEEP dos veces › PEEP 5 → 10: V continuo en el instante del cambio, PEEPe medida sube a 10 y Pplat = 10 + VT/C = 20 | passed | 241 |
| `unit/physics.test.ts` | PHY-06 · cambiar PEEP conserva el volumen pulmonar; no se suma PEEP dos veces › la curva de volumen tidal se reinicia por respiración sin reiniciar el volumen absoluto | passed | 50 |
| `unit/physics.test.ts` | PHY-07 · el vaciamiento determina la auto-PEEP (BM-04 en el motor) › Rexp 30 y Texp corto producen PEEPtot > PEEP; alargar la espiración la reduce | passed | 130 |
| `unit/physics.test.ts` | PHY-08 · R, C y Pmus cambian señales y métricas distintas › subir Rinsp sube Ppico y no Pplat; bajar C sube ambas | passed | 33 |
| `unit/physics.test.ts` | PHY-08 · R, C y Pmus cambian señales y métricas distintas › el esfuerzo dispara respiraciones asistidas (no espontáneas) sólo si supera el trigger | passed | 112 |
| `unit/physics.test.ts` | PHY-10 · dominio de fallo del ensayo › resistencia alta (Rinsp 60) y C baja (5 mL/cmH2O): sin NaN ni infinitos; Pmáx termina la inspiración con volumen parcial | passed | 45 |
| `unit/potencia.test.ts` | POT-01 · VC pasivo: la integral coincide con la solución cerrada y con la fórmula de flujo constante › banco SC-01: energía = PEEP·VT + R·Q·VT + VT²/(2C) = 7,5 cmH₂O·L → 11,0 J/min | passed | 325 |
| `unit/potencia.test.ts` | POT-01 · VC pasivo: la integral coincide con la solución cerrada y con la fórmula de flujo constante › a igual VT, subir la frecuencia sube la potencia casi en proporción; bajar el VT la baja más que en proporción | passed | 109 |
| `unit/potencia.test.ts` | POT-02 · PC pasivo: energía = (PEEP + Pinsp) · VT cuando la presión es constante › BM-03 PC con rampa 0: (5 + 10) · 0,4323 = 6,48 cmH₂O·L por respiración | passed | 23 |
| `unit/potencia.test.ts` | POT-03 · calidad: en espera no hay dato; antes de dos respiraciones, en curso › sigue la ventana de FR y VMesp | passed | 4 |
| `unit/prefs.test.ts` | preferencias de interfaz › usa valores por omisión cuando el JSON está corrupto | passed | 2 |
| `unit/prefs.test.ts` | preferencias de interfaz › descarta una ventana de curvas desconocida sin perder valores válidos | passed | 0 |
| `unit/prefs.test.ts` | preferencias de interfaz › acepta las preferencias de ayudas sólo cuando son booleanas | passed | 1 |
| `unit/prefs.test.ts` | preferencias de interfaz › combina cambios con las preferencias existentes | passed | 1 |
| `unit/prefs.test.ts` | preferencias de interfaz › no lanza si localStorage falla al leer, escribir o borrar | passed | 1 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-01: el resultado del bloqueo conserva su hora y valores tras muchas respiraciones (abrir/cerrar ventana) | passed | 313 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-02: bloqueo con esfuerzo del escenario (SC-10) resulta inválido por meseta perturbada; sin Cstat fabricada | passed | 19 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-03: cancelar dos veces es seguro; ↑O2 restaura una sola vez y respeta una edición del usuario | passed | 173 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-05: un segundo bloqueo mientras hay uno en cola se rechaza con motivo | passed | 1 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › un bloqueo cancelado en curso deja resultado «cancelled» con duración parcial y no borra el válido anterior del historial | passed | 17 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › resp manual: elegible sólo en espiración; produce una respiración de tipo manual | passed | 9 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › DAT-04: el comparador rechaza combinar Pplat y VT de respiraciones distintas | passed | 20 |
| `unit/procedures.test.ts` | espera (standby) como transacción › entrar en espera detiene la entrega, las métricas pasan a no disponibles y la numeración continúa al reanudar | passed | 28 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › defaultInit declara el perfil; profileFor resuelve el de referencia y rechaza ids desconocidos | passed | 3 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › el motor rechaza una inicialización cuyo profileId no coincide con el perfil inyectado | passed | 1 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › el motor usa las reglas del perfil inyectado (no un módulo concreto) | passed | 4 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › una sesión sin profileId (anterior a 0.3.3) se importa con el perfil de referencia; un profileId desconocido se rechaza | passed | 24 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › una sesión guardada con el identificador anterior al cambio de nombre se importa y se reproduce igual | passed | 89 |
| `unit/proteccion.test.ts` | PROT-01 · el estimador recupera el exponente que se le da › sobre curvas sintéticas acierta a tres decimales | passed | 3 |
| `unit/proteccion.test.ts` | PROT-01 · el estimador recupera el exponente que se le da › con muestras insuficientes devuelve null en vez de un número inventado | passed | 1 |
| `unit/proteccion.test.ts` | PROT-02 · sobre el motor distingue los tres regímenes › un pulmón lineal da exactamente la recta | passed | 101 |
| `unit/proteccion.test.ts` | PROT-02 · sobre el motor distingue los tres regímenes › con sigmoide, subir la PEEP lleva el índice de reclutamiento a sobredistensión | passed | 199 |
| `unit/proteccion.test.ts` | PROT-03 · no se publica cuando la forma no es del pulmón › en presión control no hay rampa a flujo constante | passed | 58 |
| `unit/proteccion.test.ts` | PROT-03 · no se publica cuando la forma no es del pulmón › con esfuerzo del paciente la curva es suya y del ventilador, no del pulmón | passed | 72 |
| `unit/proteccion.test.ts` | PROT-03 · no se publica cuando la forma no es del pulmón › con la presión recortada por un techo la forma ya no es la del pulmón | passed | 40 |
| `unit/proteccion.test.ts` | PROT-03 · no se publica cuando la forma no es del pulmón › y la métrica lo publica como no disponible con su motivo, nunca como válida | passed | 22 |
| `unit/proteccion.test.ts` | PROT-04 · la lectura y la curva de titulación › cada banda del índice tiene su lectura | passed | 135 |
| `unit/proteccion.test.ts` | PROT-04 · la lectura y la curva de titulación › la titulación ordena por PEEP y señala la mejor distensibilidad | passed | 2 |
| `unit/proteccion.test.ts` | PROT-04 · la lectura y la curva de titulación › sin puntos no inventa ninguno | passed | 0 |
| `unit/proteccion.test.ts` | PROT-05 · la lectura no atribuye al pulmón lo que es del circuito › con fuga el índice se muestra pero no se interpreta como reclutamiento (auditoría: 0,84 en un pulmón lineal) | passed | 76 |
| `unit/proteccion.test.ts` | PROT-05 · la lectura no atribuye al pulmón lo que es del circuito › con circuito compresible tampoco se infiere régimen: la compresión contamina el flujo del pulmón | passed | 112 |
| `unit/rampa.test.ts` | Rampa exponencial en PC › riseMs 200: ≈95 % del escalón a los 0,2 s, ≈63 % a τ = 0,067 s, sin sobrepasar PEEP + Pinsp | passed | 121 |
| `unit/rampa.test.ts` | Rampa exponencial en PC › riseMs 0: el escalón es inmediato, la primera muestra ya es PEEP + Pinsp | passed | 14 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › el equilibrio escala con la fracción reclutada: V(r) = C·(1 + r·frac)·(P − P0) | passed | 2 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › al arrancar ventilado sólo nace abierto si la distensión ya supera pOpen | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › la banda pClose–pOpen conserva el estado: eso ES la histéresis | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › reclutar baja la presión elástica al mismo volumen y sube la compliance local | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › quitar recruit devuelve la fracción abierta a 0 | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › sin recruit el modelo es exactamente el de siempre | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › la validación exige 0 < frac ≤ 1, pClose < pOpen y constantes de tiempo en rango | passed | 2 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › sin bloqueo sólo se lee la Ppico; las otras tres dicen qué falta | passed | 190 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › tras un bloqueo válido las cuatro fórmulas cuadran entre sí | passed | 94 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › la Ppico no lleva rango de referencia, porque no tiene uno | passed | 145 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › el veredicto se decide sobre el número que se muestra, no sobre el crudo | passed | 48 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › una meseta alta se marca fuera de su referencia | passed | 40 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › con la meseta rechazada no se publica ningún número derivado | passed | 101 |
| `unit/resumen.test.ts` | RES · con atrapamiento aéreo la resta es contra la PEEP total › las identidades de la pantalla cuadran, y el esquema no contradice a la tarjeta | passed | 161 |
| `unit/resumen.test.ts` | RES · con atrapamiento aéreo la resta es contra la PEEP total › el motor dice qué PEEP hay en la resta, y lo dice bien | passed | 126 |
| `unit/review.test.ts` | H1 · ↑O2: ajuste, mezclador y sensor vuelven juntos (regla 1) › fin por temporizador restaura también el mezclador | passed | 290 |
| `unit/review.test.ts` | H1 · ↑O2: ajuste, mezclador y sensor vuelven juntos (regla 1) › fin por espera restaura también el mezclador | passed | 2 |
| `unit/review.test.ts` | H2 · orden manual y disparo en el mismo sub-paso: sin respiraciones apiladas › con esfuerzo fuerte y control asistido, una orden manual produce exactamente una respiración manual y ninguna espiración de un sub-paso | passed | 148 |
| `unit/review.test.ts` | H3 · espera durante un bloqueo espiratorio en curso › no emite respiraciones fantasma, no activa alarmas en espera y el bloqueo queda cancelado | passed | 30 |
| `unit/review.test.ts` | H4 · poner un límite en Off resuelve la alarma activa (Off = no se evalúa, no estado congelado) › VTesp bajo activa → Off → resuelta y reconocida; banda verde | passed | 26 |
| `unit/review.test.ts` | H5 · una inspiración acortada por Pmáx no acorta el periodo obligatorio › FR medida ≈ FR programada aunque cada inspiración termine a 0.8 s por Pmáx | passed | 144 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › el constructor rechaza FR negativa y un paciente con tau < 1 ms | passed | 2 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › requestHold con duración no numérica o fuera de rango se rechaza; setPatient con R diminuta se rechaza | passed | 7 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › importSession rechaza ajustes fuera de dominio y pacientes degenerados | passed | 13 |
| `unit/review.test.ts` | H7 · importar una sesión no hereda perturbaciones del escenario previo › tras cargar SC-02 (C cambia a 20 s) e importar una sesión de banco, la C importada permanece | passed | 167 |
| `unit/review.test.ts` | H8 · Pplat de ciclo nunca es válida en una respiración terminada por Pmáx › con pausa programada y Pmáx durante la pausa, pplatCycle es null con motivo endedByPmax | passed | 11 |
| `unit/review.test.ts` | H13 · bloqueo espiratorio con paciente que dispara continuamente › se ejecuta al final de la espiración aunque la termine un disparo, y resulta inválido con motivo | passed | 15 |
| `unit/review.test.ts` | audio en pausa como estado del motor (replay) › audioPause fija audioPauseUntilMs = t + 120 s y el replay lo reproduce | passed | 19 |
| `unit/review3.test.ts` | R3-01 · tope de flujo del actuador en PC sin sobreimpulso ni Pmáx falsa › C 5 mL/cmH₂O, R 0.5, Pmáx 17: la presión no supera PEEP + Pinsp y la inspiración termina por tiempo | passed | 177 |
| `unit/review3.test.ts` | R3-01 · tope de flujo del actuador en PC sin sobreimpulso ni Pmáx falsa › la Ppico con tope activo no depende del paso de integración (4 ms vs 1 ms) | passed | 77 |
| `unit/review3.test.ts` | R3-02 · el VTi nunca es negativo en PC tras bajar la PEEP › PEEP 10 → 5 con Pinsp 3: el volumen que sale cuenta como espirado | passed | 18 |
| `unit/review3.test.ts` | R3-03 · flujo de base espiratorio: el esfuerzo hunde la Pva y no inhala sin límite › sin asistencia, un esfuerzo de 8 cmH₂O en espiración baja la Pva por debajo de PEEP y VTe − VTi queda acotado por el flujo de base | passed | 239 |
| `unit/review3.test.ts` | R3-03 · flujo de base espiratorio: el esfuerzo hunde la Pva y no inhala sin límite › con asistencia, el mismo esfuerzo sigue disparando por flujo (2 L/min) | passed | 41 |
| `unit/review3.test.ts` | R3-04 · aviso «Presión limitada por Plimit» › con Plimit 7 el cuadro marca «limitado por Plimit» sin alarma; al subir Plimit el indicador desaparece | passed | 30 |
| `unit/review3.test.ts` | R3-04 · aviso «Presión limitada por Plimit» › Plimit por encima de Pmáx se acepta con aviso no bloqueante | passed | 2 |
| `unit/review3.test.ts` | R3-05 · Cstat del bloqueo inspiratorio usa PEEPtot cuando hay bloqueo espiratorio válido › con atrapamiento (Rexp 30, FR 30) la Cstat vuelve a 50 mL/cmH₂O tras medir PEEPtot | passed | 139 |
| `unit/review3.test.ts` | R3-05 · Cstat del bloqueo inspiratorio usa PEEPtot cuando hay bloqueo espiratorio válido › tras cambiar la mecánica la PEEPtot medida antes no contamina la Cstat nueva (auditoría: publicaba 118,9) | passed | 130 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › confirmSettings rechaza claves desconocidas y modos inexistentes sin tocar los ajustes | passed | 2 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › el constructor rechaza esfuerzo y sensores no finitos o fuera de rango | passed | 4 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › la duración del bloqueo debe estar en la rejilla de su tipo (insp 2–40, esp 2–60) | passed | 6 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › pasar a espera durante un bloqueo lo cierra con motivo «cancelledByStandby», no «cancelado por el usuario» | passed | 9 |
| `unit/review3.test.ts` | R3-07 · sesiones: PC se reimporta; versiones de motor aceptadas o rechazadas de forma explícita › una sesión en A/C PC exporta e importa sin error | passed | 22 |
| `unit/review3.test.ts` | R3-07 · sesiones: PC se reimporta; versiones de motor aceptadas o rechazadas de forma explícita › engineVersion 0.2.0 se acepta con aviso; 0.1.0 se rechaza; esfuerzo absurdo en init se rechaza | passed | 2 |
| `unit/review3.test.ts` | R3-08 · un arranque fallido nunca es silencioso › el anfitrión responde initError y el cliente lo notifica por onDegraded | passed | 1 |
| `unit/review3.test.ts` | R3-08 · un arranque fallido nunca es silencioso › una orden pendiente al degradar el Worker se responde como rechazada en vez de quedar colgada | passed | 29 |
| `unit/review3.test.ts` | R3-09 · bloqueo inspiratorio rechazado por Pmáx queda registrado › SC-09-like (Rinsp 400): resultado inválido, con motivo y hora | passed | 43 |
| `unit/review4.test.ts` | R4-01 · ningún número no finito sale como válido › un tramo de duración nula no produce NaN, ni siquiera con elastancia viscoelástica cero | passed | 2 |
| `unit/review4.test.ts` | R4-01 · ningún número no finito sale como válido › el barrido de dos unidades con Plimit ya no diverge a ningún paso | passed | 645 |
| `unit/review4.test.ts` | R4-01 · ningún número no finito sale como válido › si el modelo divergiera, la métrica se publica como inválida y queda un evento en el registro | passed | 79 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › con la válvula cerrada ninguna unidad sortea la resistencia en serie | passed | 6 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › el tope de flujo del actuador acota el flujo TOTAL, no sólo el de una rama | passed | 3 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › en presión control con dos unidades el flujo pico respeta el tope del actuador | passed | 100 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › el flujo de base acota lo que el paciente puede inhalar en espiración también con dos unidades | passed | 409 |
| `unit/review4.test.ts` | R4-03 · lo que se publica es lo que se mide › durante una oclusión la Pva es la del nodo, no la de una unidad | passed | 27 |
| `unit/review4.test.ts` | R4-03 · lo que se publica es lo que se mide › la curva de volumen suma las dos unidades: coincide con el VT entregado | passed | 18 |
| `unit/review4.test.ts` | R4-04 · órdenes de banco que dejan el estado coherente › fijar el volumen absoluto no inventa presión viscoelástica ni descuadra el total | passed | 80 |
| `unit/review4.test.ts` | R4-04 · órdenes de banco que dejan el estado coherente › quitar la segunda unidad conserva el gas en vez de hacerlo desaparecer | passed | 36 |
| `unit/review4.test.ts` | R4-04 · órdenes de banco que dejan el estado coherente › al reanudar tras espera la primera Cstat usa la PEEP y no cero | passed | 210 |
| `unit/review4.test.ts` | R4-05 · el elástico se describe con una sola función › la presión de equilibrio coincide con la meseta real de una oclusión larga, también con sigmoide | passed | 59 |
| `unit/review4.test.ts` | R4-06 · la forma cerrada del nodo coincide con la bisección › con ramas lineales el nodo resuelto en forma cerrada da el mismo flujo total pedido | passed | 1 |
| `unit/review4.test.ts` | R4-06 · la forma cerrada del nodo coincide con la bisección › con ramas no lineales cae a la bisección y sigue invirtiendo | passed | 1 |
| `unit/review4.test.ts` | R4-07 · el solucionador del nodo no se dispara › con ramas lineales el nodo se resuelve en forma cerrada: cero bisecciones | passed | 17 |
| `unit/review4.test.ts` | R4-07 · el solucionador del nodo no se dispara › la combinación más costosa se mantiene acotada | passed | 3242 |
| `unit/review5.test.ts` | R5-01 · el criterio de meseta es monótono en la duración de la oclusión › esperar más nunca empeora la tasa de deriva medida | passed | 11 |
| `unit/review5.test.ts` | R5-01 · el criterio de meseta es monótono en la duración de la oclusión › con dos unidades muy dispares, el bloqueo corto se rechaza y el largo se acepta | passed | 307 |
| `unit/review5.test.ts` | R5-02 · la métrica no puede contradecir a la curva › el Ppico publicado aparece en alguna muestra de la pantalla | passed | 124 |
| `unit/review5.test.ts` | R5-03 · la espiración tiene techo de máquina › ninguna combinación deja pasar más flujo espiratorio del que abre la válvula | passed | 29 |
| `unit/review5.test.ts` | R5-04 · un solo elástico › el volumen de equilibrio es el inverso exacto de la presión elástica, también fuera del codo | passed | 1 |
| `unit/review5.test.ts` | R5-04 · un solo elástico › con sigmoide estrecha y PEEP alta el pulmón arranca exactamente en la PEEP | passed | 2 |
| `unit/review5.test.ts` | R5-05 · conmutar la segunda unidad no crea ni destruye gas › añadirla reparte el gas que hay en vez de inventar el suyo | passed | 16 |
| `unit/review5.test.ts` | R5-05 · conmutar la segunda unidad no crea ni destruye gas › quitarla une su gas al que queda | passed | 25 |
| `unit/review5.test.ts` | R5-06 · el contrato de calidad también cubre los procedimientos › la guarda de finitud anula el valor y quita la calidad válida | passed | 1 |
| `unit/review5.test.ts` | R5-06 · el contrato de calidad también cubre los procedimientos › con el modelo divergido ningún valor del bloqueo sale válido | passed | 79 |
| `unit/review5.test.ts` | R5-07 · Plimit protege sin dejar de ventilar › dentro de un tramo actúa el umbral que se cruza antes, que es el más bajo | passed | 0 |
| `unit/review5.test.ts` | R5-07 · Plimit protege sin dejar de ventilar › con Pmáx por debajo de Plimit, o iguales, manda Pmáx | passed | 0 |
| `unit/review5.test.ts` | R5-07 · Plimit protege sin dejar de ventilar › el volumen entregado decrece de forma continua al subir la resistencia | passed | 313 |
| `unit/review5.test.ts` | R5-07 · Plimit protege sin dejar de ventilar › con Pmáx por debajo de Plimit manda Pmáx, que es la acción de seguridad | passed | 8 |
| `unit/review6.test.ts` | R6-01 · un número que no lo es no puede congelar el motor › una velocidad no finita se rechaza con motivo en vez de dejar el reloj en NaN | passed | 6 |
| `unit/review6.test.ts` | R6-01 · un número que no lo es no puede congelar el motor › una autopausa no finita se rechaza igual | passed | 1 |
| `unit/review6.test.ts` | R6-02 · ninguna promesa del cliente queda colgada › exportar sin simulación responde en vez de esperar para siempre | passed | 2 |
| `unit/review6.test.ts` | R6-02 · ninguna promesa del cliente queda colgada › una exportación pendiente al degradar el Worker se resuelve como fallo | passed | 236 |
| `unit/review6.test.ts` | R6-02 · ninguna promesa del cliente queda colgada › si el Worker muere con la sesión en marcha, el respaldo reinicia pausado y lo anuncia (auditoría) | passed | 52 |
| `unit/review6.test.ts` | R6-02 · ninguna promesa del cliente queda colgada › una importación pendiente al degradar se resuelve con el motivo, no con silencio | passed | 18 |
| `unit/review7.test.ts` | R7-01 · la PEEP total no se certifica mientras sigue subiendo › en un pulmón que redistribuye despacio una oclusión corta se rechaza con motivo | passed | 580 |
| `unit/review7.test.ts` | R7-01 · la PEEP total no se certifica mientras sigue subiendo › alargando la oclusión el mismo pulmón sí da una PEEP total, y ya casi no le falta nada | passed | 615 |
| `unit/review7.test.ts` | R7-01 · la PEEP total no se certifica mientras sigue subiendo › un pulmón que vacía rápido no paga el criterio: a los 2 s ya está asentado | passed | 441 |
| `unit/review7.test.ts` | R7-01 · la PEEP total no se certifica mientras sigue subiendo › el listón del bloqueo espiratorio es más estrecho que el del inspiratorio, y eso es deliberado | passed | 0 |
| `unit/review7.test.ts` | R7-02 · si la lección pide un bloqueo espiratorio, dice cuánto tiene que durar › todo objetivo «validExp» se cumple con la duración que su propio texto nombra | passed | 196 |
| `unit/review7.test.ts` | R7-03 · un límite recién puesto se compara enseguida con lo último medido › subir el límite de VTesp bajo por encima de lo entregado alarma sin esperar a la respiración siguiente | passed | 35 |
| `unit/review7.test.ts` | R7-03 · un límite recién puesto se compara enseguida con lo último medido › bajarlo otra vez lo resuelve igual de rápido | passed | 76 |
| `unit/review7.test.ts` | R7-03 · un límite recién puesto se compara enseguida con lo último medido › en espera no se inventa una alarma con la última respiración de antes | passed | 8 |
| `unit/review7.test.ts` | R7-04 · lo que la tarea dice que se verá es lo que se ve › SC-02 · la PEEP que la tarea nombra deja sitio bajo Pmáx; la que descarta, no | passed | 127 |
| `unit/review7.test.ts` | R7-04 · lo que la tarea dice que se verá es lo que se ve › SC-13 · en PC el VT que devuelve I:E 1:1 es el de la mecánica nueva, no el de antes | passed | 66 |
| `unit/security.test.ts` | SEC-01 · inspección estática: sin WebUSB/WebSerial/Bluetooth ni conexiones externas en el código fuente › ninguna referencia a navigator.usb/serial/bluetooth, WebSocket, fetch externo ni eval | passed | 59 |
| `unit/security.test.ts` | SEC-01 · inspección estática: sin WebUSB/WebSerial/Bluetooth ni conexiones externas en el código fuente › sin dependencias de ejecución en package.json (aplicación local, sin backend) | passed | 0 |
| `unit/session.test.ts` | TIM · reproducibilidad › TIM-02: misma inicialización y comandos → mismos registros de respiración | passed | 328 |
| `unit/session.test.ts` | TIM · reproducibilidad › TIM-01: la cadencia de lectura de cuadros no altera la fisiología | passed | 126 |
| `unit/session.test.ts` | TIM · reproducibilidad › setPatient y setEffort reemplazan mecánica opcional y se reproducen desde la sesión | passed | 9 |
| `unit/session.test.ts` | TIM · reproducibilidad › rechaza reemplazos parciales de paciente y esfuerzo | passed | 0 |
| `unit/session.test.ts` | SEC-03 · importación robusta › rechaza JSON malformado, tamaño excesivo, comandos no permitidos, números no finitos y claves desconocidas | passed | 18 |
| `unit/session.test.ts` | SEC-03 · importación robusta › rechaza un paciente incompleto y campos opcionales nulos sin lanzar excepciones (auditoría) | passed | 82 |
| `unit/session.test.ts` | SEC-03 · importación robusta › rechaza replace no booleano en comandos de sesión importados | passed | 37 |
| `unit/session.test.ts` | SEC-03 · importación robusta › la reproducción hasta t no aplica comandos previstos para después de t | passed | 152 |
| `unit/shellContrast.test.ts` | contraste del tema exterior › mantiene una relación WCAG 2 de al menos 4.5:1 | passed | 3 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › está anclada en V(P0) = 0 y es su propia inversa en todo el intervalo útil | passed | 1 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › la compliance máxima vale b/(4d) en P = c y es simétrica alrededor de ese punto | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › el mismo incremento de volumen cuesta mucha más presión arriba que en la zona media: eso es el pico de sobredistensión | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › por encima de la capacidad la presión sigue siendo finita y monótona (extensión tangente) | passed | 1 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › sin sigmoide el modelo sigue siendo lineal | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-02 · titulación de PEEP sobre la sigmoide › la compliance medida dibuja una U invertida: baja colapsada, máxima cerca de c y baja otra vez por sobredistensión | passed | 378 |
| `unit/sigmoid.test.ts` | SIG-02 · titulación de PEEP sobre la sigmoide › el volumen inicial de equilibrio usa la sigmoide, no la compliance lineal | passed | 2 |
| `unit/sigmoid.test.ts` | SIG-02 · titulación de PEEP sobre la sigmoide › una sigmoide fuera de rango se rechaza | passed | 1 |
| `unit/soporte.test.ts` | PHY-03a · con esfuerzo, el paciente manda: espontáneas a PEEP + PS cicladas por flujo › todas las respiraciones son espontáneas, la Ppico es PEEP + PS y terminan al 25 % del flujo pico | passed | 434 |
| `unit/soporte.test.ts` | PHY-03a · con esfuerzo, el paciente manda: espontáneas a PEEP + PS cicladas por flujo › el ciclaje espiratorio gobierna el Ti: 50 % acorta la inspiración frente a 25 %, y una resistencia alta la alarga (ciclado tardío) | passed | 226 |
| `unit/soporte.test.ts` | PHY-03a · con esfuerzo, el paciente manda: espontáneas a PEEP + PS cicladas por flujo › cuando el flujo no cae al umbral, el tope de tiempo del soporte corta la inspiración | passed | 14 |
| `unit/soporte.test.ts` | PHY-03b · respaldo: apnea con alarma y respiraciones por presión; frecuencia mínima › sin esfuerzo: apnea a los 20 s (alarma alta), respaldo a PEEP + Pinsp de respaldo durante Tinsp de respaldo, a 12/min | passed | 9 |
| `unit/soporte.test.ts` | PHY-03b · respaldo: apnea con alarma y respiraciones por presión; frecuencia mínima › cuando el paciente vuelve a disparar, la respiración es espontánea, la apnea se resuelve y el respaldo cesa | passed | 68 |
| `unit/soporte.test.ts` | PHY-03b · respaldo: apnea con alarma y respiraciones por presión; frecuencia mínima › frecuencia mínima 10/min con paciente a 6/min: entran obligatorias por presión entre las espontáneas y no hay apnea | passed | 39 |
| `unit/soporte.test.ts` | PHY-03c · validación y cambio de modo › PEEP + PS y PEEP + Pinsp de respaldo deben quedar bajo Pmáx; el ciclaje sólo admite su rejilla de 5 % | passed | 10 |
| `unit/soporte.test.ts` | PHY-03c · validación y cambio de modo › al pasar de A/C VC a CPAP/PS con paciente activo no se cuela la obligatoria del temporizador: se espera al paciente | passed | 67 |
| `unit/soporte.test.ts` | PHY-03c · validación y cambio de modo › una sesión de un motor anterior sin los ajustes de CPAP/PS se importa completándolos con el valor por omisión | passed | 8 |
| `unit/sync.test.ts` | SYN-01 · flujo de base programable › con flujo de base 10 L/min el paciente toma hasta 10 L/min sin hundir la Pva; con 2 L/min la hunde antes | passed | 635 |
| `unit/sync.test.ts` | SYN-01 · flujo de base programable › el disparo por flujo no puede superar el flujo de base (motivo legible) | passed | 2 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › con umbral −2 cmH₂O el esfuerzo dispara asistidas; con −10 no llega y las respiraciones siguen siendo mandatorias | passed | 78 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › todo el rango de umbral admitido dispara cuando el esfuerzo lo alcanza (regresión: −3 o menos quedaban inertes) | passed | 143 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › con el circuito abierto la espiración nunca sostiene PEEP y el esfuerzo no dispara (guarda LEAK-05) | passed | 79 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › el disparo por presión ignora el umbral de flujo (flujo de disparo alto no bloquea) | passed | 21 |
| `unit/sync.test.ts` | SYN-03 · resistencia de la rama espiratoria › con 3 cmH₂O·s/L la Pva queda por encima de PEEP al inicio de la espiración y el flujo pico espiratorio baja; el VT espirado se conserva | passed | 248 |
| `unit/sync.test.ts` | SYN-03 · resistencia de la rama espiratoria › se valida en 0–6 y se conserva en la sesión | passed | 2 |
| `unit/sync.test.ts` | SYN-04 · retardo de respuesta del disparo: el trabajo de disparo aparece en la curva de presión › la respiración empieza 80 ms después de cruzar el umbral, y en ese lapso la Pva cae ≈ 2 cmH₂O con Pmus 8 y flujo de base 4 | passed | 189 |
| `unit/sync.test.ts` | SYN-04 · retardo de respuesta del disparo: el trabajo de disparo aparece en la curva de presión › el disparo por presión es más lento que el de flujo: la respiración empieza ≈ 110 ms tras cruzar el umbral | passed | 83 |
| `unit/sync.test.ts` | SYN-04 · retardo de respuesta del disparo: el trabajo de disparo aparece en la curva de presión › más flujo de base o menos esfuerzo, menos trabajo de disparo; el disparo por presión lo duplica | passed | 457 |
| `unit/sync.test.ts` | SYN-04 · retardo de respuesta del disparo: el trabajo de disparo aparece en la curva de presión › sin disparo asistido la espiración termina por el temporizador y la caída del esfuerzo queda contenida | passed | 197 |
| `unit/teachingHonesty.test.ts` | ΔP mostrada 14.9 respeta el criterio exclusivo <15 | passed | 128 |
| `unit/teachingHonesty.test.ts` | ΔP mostrada 15 respeta el criterio exclusivo <15 | passed | 35 |
| `unit/teachingHonesty.test.ts` | ΔP mostrada 15.1 respeta el criterio exclusivo <15 | passed | 32 |
| `unit/teachingHonesty.test.ts` | b≈1 describe la forma global sin excluir procesos regionales | passed | 11 |
| `unit/teachingHonesty.test.ts` | SC-04 declara práctica del ajuste, sin certificar un efecto | passed | 2 |
| `unit/teachingHonesty.test.ts` | SC-22: el objetivo del disparo exige que el autodisparo cese, no sólo el ajuste | passed | 141 |
| `unit/tokens.test.ts` | tokens CSS › declara todas las propiedades personalizadas usadas por las parciales | passed | 3 |
| `unit/tokens.test.ts` | tokens CSS › centraliza los neutros fusionados de 08-minimal.css en sus tokens | passed | 1 |
| `unit/tokens.test.ts` | tokens CSS › no redefine un selector dentro de la misma hoja ni reparte más de los ya conocidos entre hojas | passed | 3 |
| `unit/tokens.test.ts` | tokens CSS › reserva !important para [hidden], movimiento reducido e impresión | passed | 31 |
| `unit/tokens.test.ts` | tokens CSS › usa la escala --type-* en el exterior en vez de px sueltos | passed | 2 |
| `unit/twoCompartment.test.ts` | PEN-01 · pendelluft con el circuito ocluido › el gas pasa de la unidad rápida a la lenta y las presiones convergen con tau = (R1+R2)·C1·C2/(C1+C2) | passed | 39 |
| `unit/twoCompartment.test.ts` | PEN-01 · pendelluft con el circuito ocluido › el reparto no depende del paso de integración | passed | 1 |
| `unit/twoCompartment.test.ts` | PEN-01 · pendelluft con el circuito ocluido › la presión del nodo con flujo impuesto es la media ponderada por las conductancias | passed | 1 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › el vaciamiento deja de ser una sola exponencial: al final domina la constante lenta | passed | 291 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › la meseta de una oclusión depende de su duración: el pendelluft sigue moviendo gas | passed | 304 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › con una sola unidad la meseta no depende de la duración | passed | 81 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › el volumen absoluto del panel docente suma las dos unidades | passed | 8 |
| `unit/typeScale.test.ts` | escala tipográfica del monitor › no declara tamaños en px inferiores a 10 fuera de la serigrafía | passed | 6 |
| `unit/uiActions.test.ts` | despacha acciones delegadas, preferencias y atajos sin activarlos al escribir | passed | 3420 |
| `unit/uiActions.test.ts` | la paleta conserva texto literal, búsqueda, foco, selección y cancelación | passed | 226 |
| `unit/uiActions.test.ts` | los perfiles mantienen sus etiquetas como texto y sus botones conservan ARIA | passed | 335 |
| `unit/uiDom.test.ts` | Casos, Aula y texto recibido › construye texto literal e iconos SVG sin convertir datos en etiquetas | passed | 180 |
| `unit/uiDom.test.ts` | Casos, Aula y texto recibido › lista y elige casos en el panel, preservando IDs, temas y viñetas literales | passed | 359 |
| `unit/uiDom.test.ts` | Casos, Aula y texto recibido › muestra la gasometría del modelo, limpia la reflexión al cambiar de caso y no evalúa sesiones importadas | passed | 162 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › mantiene el ajuste vigente hasta confirmar y permite cancelar el borrador | passed | 951 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › ofrece duraciones válidas y conserva selección sin duplicar solicitudes de bloqueo | passed | 95 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › selecciona modos en el equipo y descarta el borrador al cerrar | passed | 419 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › valida límites de alarma antes de enviarlos y permite Off | passed | 413 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › actualiza métricas, enmascara examen y fija la referencia al abrir la estimación | passed | 371 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › conserva eventos literales, orden inverso y alarma destacada | passed | 65 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › abre fundamentos con diagramas SVG y cambia de tema sin perder ocultación de examen | passed | 338 |
| `unit/uiDom.test.ts` | referencias del caso › muestran autor y año; sin año, la referencia tal cual | passed | 111 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-01: seleccionar PEEP y girar sin confirmar no emite cambios | passed | 4 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-02: confirmar una edición válida emite un único evento con el nuevo valor interno | passed | 1 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-03: cancelar o vencer el plazo descarta el borrador (plazo identificado como propuesto) | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-06: la rueda sin selección no altera nada; el bloqueo de pantalla impide editar | passed | 1 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › un valor inválido produce explicación y no se aproxima: VT hasta hacer el flujo > 160 L/min | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › PEEP: bajar desde 1 lleva a Off y subir desde Off lleva a 1 (Off no es 0) | passed | 1 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › seleccionar otra tecla descarta el borrador anterior sin aplicarlo | passed | 1 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › vista previa muestra consecuencias cruzadas (Tinsp y flujo derivados) antes de confirmar | passed | 0 |
| `unit/uiState.test.ts` | menú de modo como transacción › cancelar restaura todos los ajustes; confirmar entrega sólo los cambiados | passed | 1 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › VT: 300 → 325 al subir; 300 → 295 al bajar; 1000 → 1050 / 975 | passed | 2 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › 285 mL está en rejilla; 287 no; 300 no se convierte en 325 al cambiar de vista | passed | 0 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › trigger de flujo: 3.0 → 3.5 al subir; 3.0 → 2.9 al bajar | passed | 0 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › I:E discreto: 1:1.5 sube a 1:1 y baja a 1:2; extremos 1:9 y 4:1 | passed | 0 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › propiedad: subir y bajar desde un valor en rejilla (no extremo) devuelve el mismo valor | passed | 192 |
| `unit/validation.test.ts` | restricciones cruzadas (P sobre rangos D) › VT 2 L con Tinsp 0.5 s exige 240 L/min > 160: inválido con explicación, sin aproximar | passed | 1 |
| `unit/validation.test.ts` | restricciones cruzadas (P sobre rangos D) › FR 120 con I:E 4:1 deja Texp 0.1 s < 0.25: inválido | passed | 0 |
| `unit/validation.test.ts` | restricciones cruzadas (P sobre rangos D) › Pmáx ≤ PEEP es inválido; el banco es válido y deriva flujo 0.5 L/s | passed | 0 |
| `unit/validation.test.ts` | rejilla de valores admitidos (deslizador por índice) › gridValues enumera cada tramo con su paso y sin duplicar fronteras | passed | 2 |
| `unit/validation.test.ts` | rejilla de valores admitidos (deslizador por índice) › nearestGridValue devuelve un valor admitido y el más cercano | passed | 14 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › con E2 = 0 el modelo es exactamente el de un compartimento | passed | 4 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › inflado a flujo constante: la separación V − Vve sigue Q·tau·(1 − e^(−t/tau)) y no depende del paso | passed | 1 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › oclusión: caída inmediata resistiva (Ppico − P1 = R·Q) y luego decaimiento exponencial hasta la meseta estática | passed | 1 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › tras 6 constantes la meseta está a menos de 1 % del valor estático | passed | 0 |
| `unit/viscoelastic.test.ts` | VIS-02 · consecuencias en el ventilador › el bloqueo inspiratorio mide una meseta por encima de la estática y la Cstat resultante subestima la compliance | passed | 157 |
| `unit/viscoelastic.test.ts` | VIS-02 · consecuencias en el ventilador › una pausa corta no da meseta de ciclo: la presión sigue cayendo y se declara inestable | passed | 212 |
| `unit/viscoelastic.test.ts` | VIS-02 · consecuencias en el ventilador › sin relajación la misma pausa sí da meseta estable | passed | 21 |
| `unit/viscoelastic.test.ts` | VIS-03 · resistencia no lineal de Rohrer › con K2 = 5, duplicar el flujo multiplica la caída resistiva por 2,4 en vez de por 2 | passed | 7 |
| `unit/viscoelastic.test.ts` | VIS-03 · resistencia no lineal de Rohrer › K2 no cambia la meseta: la carga elástica es la misma | passed | 10 |
| `unit/viscoelastic.test.ts` | VIS-03 · resistencia no lineal de Rohrer › K2 fuera de 0–50 se rechaza | passed | 7 |
| `unit/viscoelastic.test.ts` | VIS-04 · la PEEPe de referencia no se contamina con la oclusión previa › tras un bloqueo espiratorio con atrapamiento, el ΔP y la Cstat del siguiente bloqueo usan PEEP, no PEEP total | passed | 57 |

## Playwright · 364 pasadas / 0 fallidas / 29 omitidas (por diseño: la prueba móvil sólo corre en el proyecto móvil)

| Proyecto | Archivo | Prueba | Estado | ms |
| --- | --- | --- | --- | --- |
| desktop-1280 | `build.spec.ts` | el build carga los Fundamentos sólo al llegar a ellos y reutiliza su módulo sin red | passed | 892 |
| desktop-1280 | `build.spec.ts` | una carga fallida deja el simulador operativo y permite recuperar los Fundamentos | passed | 1778 |
| desktop-1280 | `clinicalCases.spec.ts` | CC-01: se elige en el panel, se resuelve en el ventilador con la mecánica oculta y se revela al entregar | passed | 3067 |
| desktop-1280 | `clinicalCases.spec.ts` | cada caso se lee entero en el panel sin desplazarse, con el título en una línea, antes y después de entregar | skipped | 113 |
| desktop-1280 | `clinicalCases.spec.ts` | el panel abre en Paciente (perfiles, mecánica y eventos) en escritorio y cerrado en móvil; Casos tiene la lista | passed | 535 |
| desktop-1280 | `clinicalCases.spec.ts` | el resumen de práctica se descarga con el caso y su estado | passed | 485 |
| desktop-1280 | `clinicalCases.spec.ts` | la URL heredada ?view=teaching lleva a los Fundamentos y el monitor sigue en Curvas | passed | 486 |
| desktop-1280 | `clinicalCases.spec.ts` | volver al caso en curso no lo reinicia; elegir otro caso carga su paciente y limpia la reflexión | passed | 804 |
| desktop-1280 | `clinicalCases.spec.ts` | «Aula» lleva a los Fundamentos bajo el equipo; en escritorio el caso sigue a la vista y nada desborda | passed | 532 |
| desktop-1280 | `clinicalCases.spec.ts` | «Salir del caso» vuelve al banco pasivo con el panel Paciente abierto | passed | 474 |
| desktop-1280 | `clockStartup.spec.ts` | SC-02 respeta paused=1 durante el arranque | passed | 949 |
| desktop-1280 | `clockStartup.spec.ts` | SC-12 respeta paused=1 durante el arranque | passed | 1133 |
| desktop-1280 | `clockStartup.spec.ts` | autopause=12001 detiene el reloj a 12004 | passed | 566 |
| desktop-1280 | `controls.spec.ts` | Descripción de variables muestra el glosario y las ayudas persisten al recargar | passed | 1134 |
| desktop-1280 | `controls.spec.ts` | Modo: el paso de VT cruza 300 mL por la regla, slider sincroniza y Cancelar no aplica | passed | 1776 |
| desktop-1280 | `controls.spec.ts` | Paciente: − y deslizador modifican la mecánica simulada | passed | 601 |
| desktop-1280 | `controls.spec.ts` | el diálogo conserva su caja y no desborda al cambiar de pestaña | passed | 812 |
| desktop-1280 | `controls.spec.ts` | la barra muestra exactamente Pausar, Personalizar vista y las ayudas sobre las curvas; Sesión sólo en Más opciones | passed | 521 |
| desktop-1280 | `controls.spec.ts` | las pestañas usan flechas/Home/End, el diálogo atrapa el foco y Escape lo cierra | passed | 1782 |
| desktop-1280 | `controls.spec.ts` | las preferencias de ayudas no se escriben en una referencia fotográfica | passed | 704 |
| desktop-1280 | `controls.spec.ts` | los estados activos sobreviven al cierre y la pausa conserva la velocidad | passed | 1272 |
| desktop-1280 | `controls.spec.ts` | los segmentados de Pantalla cambian sus controles y las preferencias persisten al recargar | passed | 1512 |
| desktop-1280 | `controls.spec.ts` | límites: Off vuelve al mínimo, admite Off y confirma sólo el borrador válido | passed | 1113 |
| desktop-1280 | `controls.spec.ts` | minRate respeta Off y su mínimo; switches y ayudas responden al teclado y al foco | passed | 1086 |
| desktop-1280 | `instrument.spec.ts` | device dialog follows visible monitor bounds, scrolls internally, and resets before global personalization | passed | 1042 |
| desktop-1280 | `instrument.spec.ts` | mode edits stay draft on cancel and confirming sends only changed settings | passed | 4706 |
| desktop-1280 | `instrument.spec.ts` | resizing to 390×844 recomputes device dialog bounds without horizontal overflow | passed | 591 |
| desktop-1280 | `interaction.spec.ts` | ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela | passed | 1501 |
| desktop-1280 | `interaction.spec.ts` | ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia | passed | 4542 |
| desktop-1280 | `interaction.spec.ts` | Casillas vive en Pantalla y se oculta fuera de Curvas | passed | 1459 |
| desktop-1280 | `interaction.spec.ts` | Comparar última respiración dibuja el ciclo previo atenuado bajo la traza actual | passed | 4283 |
| desktop-1280 | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 390 |
| desktop-1280 | `interaction.spec.ts` | INT-02 · confirmar edición válida: se aplica en la siguiente respiración | passed | 1317 |
| desktop-1280 | `interaction.spec.ts` | INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima | passed | 346 |
| desktop-1280 | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 3797 |
| desktop-1280 | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 1614 |
| desktop-1280 | `interaction.spec.ts` | INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor | passed | 1520 |
| desktop-1280 | `interaction.spec.ts` | INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada | passed | 1189 |
| desktop-1280 | `interaction.spec.ts` | Modo explica en texto los modos que no se simulan | passed | 397 |
| desktop-1280 | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel | passed | 3489 |
| desktop-1280 | `interaction.spec.ts` | Pausar, velocidad y Congelar viven en .signal-toolbar y no se confunden | passed | 988 |
| desktop-1280 | `interaction.spec.ts` | SC-09 · la oclusión se resuelve con controles visibles: reconocer y Restablecer mecánica | passed | 2486 |
| desktop-1280 | `interaction.spec.ts` | SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel | passed | 620 |
| desktop-1280 | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa discreta y reanudación manual sin salto de reloj | passed | 2918 |
| desktop-1280 | `interaction.spec.ts` | abrir el circuito en Eventos dispara la alarma alta; deshacer la resuelve y reconocer devuelve la banda al azul | passed | 5794 |
| desktop-1280 | `interaction.spec.ts` | aplica, deshace y restablece mecánica con perfiles completos | passed | 767 |
| desktop-1280 | `interaction.spec.ts` | aplicar un perfil en Paciente conserva sesión, tiempo, ajustes y lo hecho en la práctica | passed | 2643 |
| desktop-1280 | `interaction.spec.ts` | cada tarjeta deja como máximo un párrafo visible fuera de «Por qué» | passed | 1044 |
| desktop-1280 | `interaction.spec.ts` | cargar SC-24 muestra la amplitud evocada 8 en el panel del paciente | passed | 914 |
| desktop-1280 | `interaction.spec.ts` | el Menú del equipo conserva sólo sus cuatro entradas funcionales | passed | 410 |
| desktop-1280 | `interaction.spec.ts` | el bucle Pva·V con presión total se ve en el panel docente | passed | 897 |
| desktop-1280 | `interaction.spec.ts` | el campo vacío no vale como cero y el Resumen no revela las cifras tapadas | passed | 2280 |
| desktop-1280 | `interaction.spec.ts` | el contexto del encabezado muestra el caso y abre la lista de casos en el panel, sin diálogo | passed | 434 |
| desktop-1280 | `interaction.spec.ts` | el cursor cae donde apunta el puntero: el centro de la rejilla es el centro de la ventana | passed | 5270 |
| desktop-1280 | `interaction.spec.ts` | el cursor se maneja con el teclado, se anuncia, y sigue midiendo al recorrer la historia | passed | 5099 |
| desktop-1280 | `interaction.spec.ts` | el diálogo de personalización cierra con Escape y devuelve el foco | passed | 541 |
| desktop-1280 | `interaction.spec.ts` | el interruptor vive en el menú «…» y no en el monitor | passed | 593 |
| desktop-1280 | `interaction.spec.ts` | escritorio agrupa las opciones en ⋯ y Audio alterna aria-checked | passed | 1064 |
| desktop-1280 | `interaction.spec.ts` | la barra muestra como máximo cinco controles interactivos | passed | 418 |
| desktop-1280 | `interaction.spec.ts` | la escala alterna entre automática y fija | passed | 945 |
| desktop-1280 | `interaction.spec.ts` | la pantalla de protección lee el índice de estrés y construye la titulación con lo medido | passed | 5604 |
| desktop-1280 | `interaction.spec.ts` | la pantalla de ventilación muestra la gasometría del modelo y el monitor nunca la muestra | passed | 963 |
| desktop-1280 | `interaction.spec.ts` | la primera visita ofrece explorar o casos clínicos; la bienvenida no se repite | passed | 810 |
| desktop-1280 | `interaction.spec.ts` | la selección de 6 casillas grandes persiste y vuelve a 13 sin romper la tabla | passed | 1340 |
| desktop-1280 | `interaction.spec.ts` | la tecla muestra lo entregado; la propuesta confirmada se anuncia aparte con su flecha | passed | 471 |
| desktop-1280 | `interaction.spec.ts` | la velocidad se actualiza desde el menú y Escape devuelve el foco | passed | 914 |
| desktop-1280 | `interaction.spec.ts` | la versión vive en el panel docente y ya no existe el listón de seguridad | passed | 343 |
| desktop-1280 | `interaction.spec.ts` | los controles de tiempo caben sin desbordar el ancho del viewport | passed | 476 |
| desktop-1280 | `interaction.spec.ts` | los paneles laterales: uno a la vez, Esc devuelve el foco y se cierran al ir a Casos | passed | 1284 |
| desktop-1280 | `interaction.spec.ts` | los perfiles están deshabilitados en una referencia fotográfica | passed | 454 |
| desktop-1280 | `interaction.spec.ts` | los valores medidos se ocultan hasta que el alumno los estima | passed | 1126 |
| desktop-1280 | `interaction.spec.ts` | recorrer la historia desplaza la ventana en el tiempo | passed | 5146 |
| desktop-1280 | `interaction.spec.ts` | restablecer preferencias las borra y avisa que se aplicará al recargar | passed | 602 |
| desktop-1280 | `interaction.spec.ts` | restaura escenario, vista y ventana de curvas al recargar | passed | 1266 |
| desktop-1280 | `interaction.spec.ts` | sin bloqueo no inventa números; con bloqueo enseña la cuenta con los del monitor | passed | 2532 |
| desktop-1280 | `interaction.spec.ts` | subir PEEP por encima de la apertura recluta; bajarla por encima del cierre lo conserva | passed | 4933 |
| desktop-1280 | `interaction.spec.ts` | tocar o pulsar la curva congelada basta para medir | passed | 5138 |
| desktop-1280 | `interaction.spec.ts` | tres controles a la vista; la mecánica avanzada sale de la barra en cuatro pestañas, un grupo a la vez | passed | 855 |
| desktop-1280 | `interaction.spec.ts` | un `speed` ilegible se descarta con aviso y el motor avanza igual | passed | 364 |
| desktop-1280 | `interaction.spec.ts` | un escenario de la dirección tiene prioridad sobre el guardado | passed | 442 |
| desktop-1280 | `interaction.spec.ts` | una intervención conserva automáticamente la última respiración completa como «Antes» | passed | 1591 |
| desktop-1280 | `interaction.spec.ts` | una sesión importada no evalúa el caso clínico que estaba abierto | passed | 694 |
| desktop-1280 | `interaction.spec.ts` | una velocidad personalizada de la URL aparece en Revisar curvas y tiempo | passed | 629 |
| desktop-1280 | `interaction.spec.ts` | «TET 7,0 mm» fija el deslizador K₂ a 9,2 y moverlo a mano deja «Personalizado» | passed | 705 |
| desktop-1280 | `measurementFidelity.spec.ts` | SC-09 prolongada: fuga sin denominador muestra motivo | passed | 4131 |
| desktop-1280 | `measurementFidelity.spec.ts` | SC-18: el bloqueo espiratorio con esfuerzo no delata el músculo en la cara del equipo | passed | 13723 |
| desktop-1280 | `measurementFidelity.spec.ts` | meseta estable con esfuerzo: el equipo muestra lo que mide y el Aula avisa que no es mecánica pasiva | passed | 1014 |
| desktop-1280 | `measurementFidelity.spec.ts` | pausa de ciclo: el equipo publica la meseta estable con o sin esfuerzo, sin delatar el músculo | passed | 1579 |
| desktop-1280 | `mobile.spec.ts` | Paciente conserva targets táctiles; la mecánica avanzada se abre a pantalla completa sobre la hoja | skipped | 1 |
| desktop-1280 | `mobile.spec.ts` | datos grandes: los seis valores a la vista en dos columnas; bucles apilados; la alarma no se recorta | skipped | 1 |
| desktop-1280 | `mobile.spec.ts` | el diálogo conserva su caja y cabe en cada pestaña a 375 px | skipped | 1 |
| desktop-1280 | `mobile.spec.ts` | elimina la barra redundante y arranca con el panel cerrado y compacto | skipped | 3 |
| desktop-1280 | `mobile.spec.ts` | escritorio: la ventana arranca en 12 s | passed | 332 |
| desktop-1280 | `mobile.spec.ts` | la cabecera muestra Buscar y ⋯; el menú añade Sesión | skipped | 124 |
| desktop-1280 | `mobile.spec.ts` | la hoja del panel docente abre, cierra con el botón o Escape y devuelve el foco | skipped | 1 |
| desktop-1280 | `mobile.spec.ts` | la hoja vuelve a la columna del panel al ensanchar el viewport | skipped | 1 |
| desktop-1280 | `mobile.spec.ts` | móvil (< 700 px): la ventana arranca en 6 s | skipped | 117 |
| desktop-1280 | `mobile.spec.ts` | nada flota sobre los ajustes: Pausar y Personalizar quedan en la cabecera, siempre a la vista | skipped | 2 |
| desktop-1280 | `mobile.spec.ts` | sin desbordamiento; las trece cifras a la vista y legibles; el monitor cabe en su ventana; el editor fuera del monitor | skipped | 1 |
| desktop-1280 | `mobile.spec.ts` | sin desborde al cargar, abrir Menú y cambiar cada vista | skipped | 1 |
| desktop-1280 | `palette.spec.ts` | Ctrl+K abre la paleta y permite aplicar un perfil | passed | 571 |
| desktop-1280 | `palette.spec.ts` | Escape cierra la paleta y devuelve el foco al botón | passed | 465 |
| desktop-1280 | `palette.spec.ts` | filtra vistas y ejecuta la selección con las flechas | passed | 582 |
| desktop-1280 | `palette.spec.ts` | la cabecera no desborda horizontalmente | passed | 370 |
| desktop-1280 | `palette.spec.ts` | permite cargar un caso clínico por su identificador y lo presenta en el panel | passed | 472 |
| desktop-1280 | `palette.spec.ts` | una consulta sin coincidencias no ejecuta nada | passed | 653 |
| desktop-1280 | `pc.spec.ts` | Escape cierra primero el diálogo y el reloj del monitor muestra la hora del día | passed | 576 |
| desktop-1280 | `pc.spec.ts` | PEEP: el primer paso del deslizador es Off, no 0 | passed | 537 |
| desktop-1280 | `pc.spec.ts` | VTesp bajo y FR alta configurados en el diálogo se activan mientras ventila y se reflejan en la banda | passed | 840 |
| desktop-1280 | `pc.spec.ts` | bloqueo inspiratorio rechazado por Pmáx: resultado no válido con motivo legible y aviso | passed | 3240 |
| desktop-1280 | `pc.spec.ts` | cambiar a A/C PC desde el menú de modos: teclas rápidas, curvas y VT esperado | passed | 2814 |
| desktop-1280 | `pc.spec.ts` | deslizador recorre sólo valores admitidos; ± y deslizador coinciden; escritura fuera de rejilla sugiere el más cercano | passed | 1492 |
| desktop-1280 | `pc.spec.ts` | el VTesp mostrado cambia entre ciclos alrededor del volumen programado | passed | 12421 |
| desktop-1280 | `pc.spec.ts` | la columna de presión desciende de forma progresiva al terminar la inspiración | passed | 8440 |
| desktop-1280 | `pc.spec.ts` | menú de modo: flujo de base y disparo por presión; el disparo por flujo no puede superar el flujo de base | passed | 1704 |
| desktop-1280 | `pc.spec.ts` | ▶ es idempotente mientras hay solicitud; «Cancelar» la anula y se anuncia | passed | 859 |
| desktop-1280 | `ps.spec.ts` | SC-19: apnea provocada → alarma alta y respaldo; al deshacerla el paciente vuelve y la alarma se resuelve | passed | 7767 |
| desktop-1280 | `ps.spec.ts` | cambiar a CPAP/PS desde el menú de modos: bloque de respaldo, teclas rápidas y respiraciones espontáneas | passed | 5505 |
| desktop-1280 | `teachingHonesty.spec.ts` | SC-25 mantiene sus límites visibles en los Fundamentos | passed | 1723 |
| desktop-1280 | `teachingHonesty.spec.ts` | la ayuda del bloqueo anuncia la maniobra que está abierta | passed | 655 |
| desktop-1280 | `visual.spec.ts` | DAT-08 · grupos y estado Pplat cambian al completar un bloqueo válido | passed | 1931 |
| desktop-1280 | `visual.spec.ts` | VIS · el exterior usa tema claro y conserva el fondo del equipo | passed | 589 |
| desktop-1280 | `visual.spec.ts` | VIS · panel Paciente compacto a 1440 px: gases, perfiles, mecánica y eventos sin desplazarse | skipped | 95 |
| desktop-1280 | `visual.spec.ts` | VIS-01 + DAT-02 · P1: panel denso y bloqueo; Pplat de bloqueo 32 y Cstat 19 fechados | passed | 538 |
| desktop-1280 | `visual.spec.ts` | VIS-02 + DAT-01 · P3: datos grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 465 |
| desktop-1280 | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro | passed | 841 |
| desktop-1280 | `visual.spec.ts` | VIS-04 · alarma de Pmáx (SC-09): banda roja, luz del bisel y celda resaltada | passed | 2540 |
| desktop-1280 | `visual.spec.ts` | VIS-05 · vistas de bucles, tabla, tendencias y registro son funcionales | passed | 1983 |
| desktop-1280 | `visual.spec.ts` | VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3 | passed | 1689 |
| desktop-1280 | `visual.spec.ts` | VIS-08 · CPAP/PS (SC-19): presión a PEEP + PS, flujo cortado al 25 % del pico, volumen del paciente | passed | 1657 |
| desktop-1280 | `visual.spec.ts` | no usa iconos informativos y sus descendientes caben | passed | 345 |
| desktop-1440 | `build.spec.ts` | el build carga los Fundamentos sólo al llegar a ellos y reutiliza su módulo sin red | passed | 1214 |
| desktop-1440 | `build.spec.ts` | una carga fallida deja el simulador operativo y permite recuperar los Fundamentos | passed | 1913 |
| desktop-1440 | `clinicalCases.spec.ts` | CC-01: se elige en el panel, se resuelve en el ventilador con la mecánica oculta y se revela al entregar | passed | 3175 |
| desktop-1440 | `clinicalCases.spec.ts` | cada caso se lee entero en el panel sin desplazarse, con el título en una línea, antes y después de entregar | passed | 2897 |
| desktop-1440 | `clinicalCases.spec.ts` | el panel abre en Paciente (perfiles, mecánica y eventos) en escritorio y cerrado en móvil; Casos tiene la lista | passed | 1087 |
| desktop-1440 | `clinicalCases.spec.ts` | el resumen de práctica se descarga con el caso y su estado | passed | 448 |
| desktop-1440 | `clinicalCases.spec.ts` | la URL heredada ?view=teaching lleva a los Fundamentos y el monitor sigue en Curvas | passed | 399 |
| desktop-1440 | `clinicalCases.spec.ts` | volver al caso en curso no lo reinicia; elegir otro caso carga su paciente y limpia la reflexión | passed | 778 |
| desktop-1440 | `clinicalCases.spec.ts` | «Aula» lleva a los Fundamentos bajo el equipo; en escritorio el caso sigue a la vista y nada desborda | passed | 640 |
| desktop-1440 | `clinicalCases.spec.ts` | «Salir del caso» vuelve al banco pasivo con el panel Paciente abierto | passed | 448 |
| desktop-1440 | `clockStartup.spec.ts` | SC-02 respeta paused=1 durante el arranque | passed | 1294 |
| desktop-1440 | `clockStartup.spec.ts` | SC-12 respeta paused=1 durante el arranque | passed | 1174 |
| desktop-1440 | `clockStartup.spec.ts` | autopause=12001 detiene el reloj a 12004 | passed | 516 |
| desktop-1440 | `controls.spec.ts` | Descripción de variables muestra el glosario y las ayudas persisten al recargar | passed | 1101 |
| desktop-1440 | `controls.spec.ts` | Modo: el paso de VT cruza 300 mL por la regla, slider sincroniza y Cancelar no aplica | passed | 1878 |
| desktop-1440 | `controls.spec.ts` | Paciente: − y deslizador modifican la mecánica simulada | passed | 720 |
| desktop-1440 | `controls.spec.ts` | el diálogo conserva su caja y no desborda al cambiar de pestaña | passed | 750 |
| desktop-1440 | `controls.spec.ts` | la barra muestra exactamente Pausar, Personalizar vista y las ayudas sobre las curvas; Sesión sólo en Más opciones | passed | 542 |
| desktop-1440 | `controls.spec.ts` | las pestañas usan flechas/Home/End, el diálogo atrapa el foco y Escape lo cierra | passed | 1288 |
| desktop-1440 | `controls.spec.ts` | las preferencias de ayudas no se escriben en una referencia fotográfica | passed | 656 |
| desktop-1440 | `controls.spec.ts` | los estados activos sobreviven al cierre y la pausa conserva la velocidad | passed | 813 |
| desktop-1440 | `controls.spec.ts` | los segmentados de Pantalla cambian sus controles y las preferencias persisten al recargar | passed | 1135 |
| desktop-1440 | `controls.spec.ts` | límites: Off vuelve al mínimo, admite Off y confirma sólo el borrador válido | passed | 1155 |
| desktop-1440 | `controls.spec.ts` | minRate respeta Off y su mínimo; switches y ayudas responden al teclado y al foco | passed | 1158 |
| desktop-1440 | `instrument.spec.ts` | device dialog follows visible monitor bounds, scrolls internally, and resets before global personalization | passed | 910 |
| desktop-1440 | `instrument.spec.ts` | mode edits stay draft on cancel and confirming sends only changed settings | passed | 4706 |
| desktop-1440 | `instrument.spec.ts` | resizing to 390×844 recomputes device dialog bounds without horizontal overflow | passed | 416 |
| desktop-1440 | `interaction.spec.ts` | ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela | passed | 1459 |
| desktop-1440 | `interaction.spec.ts` | ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia | passed | 5413 |
| desktop-1440 | `interaction.spec.ts` | Casillas vive en Pantalla y se oculta fuera de Curvas | passed | 1055 |
| desktop-1440 | `interaction.spec.ts` | Comparar última respiración dibuja el ciclo previo atenuado bajo la traza actual | passed | 3787 |
| desktop-1440 | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 457 |
| desktop-1440 | `interaction.spec.ts` | INT-02 · confirmar edición válida: se aplica en la siguiente respiración | passed | 1396 |
| desktop-1440 | `interaction.spec.ts` | INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima | passed | 555 |
| desktop-1440 | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 3917 |
| desktop-1440 | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 1581 |
| desktop-1440 | `interaction.spec.ts` | INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor | passed | 1250 |
| desktop-1440 | `interaction.spec.ts` | INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada | passed | 1138 |
| desktop-1440 | `interaction.spec.ts` | Modo explica en texto los modos que no se simulan | passed | 532 |
| desktop-1440 | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel | passed | 3435 |
| desktop-1440 | `interaction.spec.ts` | Pausar, velocidad y Congelar viven en .signal-toolbar y no se confunden | passed | 835 |
| desktop-1440 | `interaction.spec.ts` | SC-09 · la oclusión se resuelve con controles visibles: reconocer y Restablecer mecánica | passed | 2371 |
| desktop-1440 | `interaction.spec.ts` | SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel | passed | 518 |
| desktop-1440 | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa discreta y reanudación manual sin salto de reloj | passed | 2941 |
| desktop-1440 | `interaction.spec.ts` | abrir el circuito en Eventos dispara la alarma alta; deshacer la resuelve y reconocer devuelve la banda al azul | passed | 5810 |
| desktop-1440 | `interaction.spec.ts` | aplica, deshace y restablece mecánica con perfiles completos | passed | 832 |
| desktop-1440 | `interaction.spec.ts` | aplicar un perfil en Paciente conserva sesión, tiempo, ajustes y lo hecho en la práctica | passed | 2755 |
| desktop-1440 | `interaction.spec.ts` | cada tarjeta deja como máximo un párrafo visible fuera de «Por qué» | passed | 833 |
| desktop-1440 | `interaction.spec.ts` | cargar SC-24 muestra la amplitud evocada 8 en el panel del paciente | passed | 786 |
| desktop-1440 | `interaction.spec.ts` | el Menú del equipo conserva sólo sus cuatro entradas funcionales | passed | 437 |
| desktop-1440 | `interaction.spec.ts` | el bucle Pva·V con presión total se ve en el panel docente | passed | 518 |
| desktop-1440 | `interaction.spec.ts` | el campo vacío no vale como cero y el Resumen no revela las cifras tapadas | passed | 1956 |
| desktop-1440 | `interaction.spec.ts` | el contexto del encabezado muestra el caso y abre la lista de casos en el panel, sin diálogo | passed | 611 |
| desktop-1440 | `interaction.spec.ts` | el cursor cae donde apunta el puntero: el centro de la rejilla es el centro de la ventana | passed | 5202 |
| desktop-1440 | `interaction.spec.ts` | el cursor se maneja con el teclado, se anuncia, y sigue midiendo al recorrer la historia | passed | 5150 |
| desktop-1440 | `interaction.spec.ts` | el diálogo de personalización cierra con Escape y devuelve el foco | passed | 696 |
| desktop-1440 | `interaction.spec.ts` | el interruptor vive en el menú «…» y no en el monitor | passed | 460 |
| desktop-1440 | `interaction.spec.ts` | escritorio agrupa las opciones en ⋯ y Audio alterna aria-checked | passed | 1340 |
| desktop-1440 | `interaction.spec.ts` | la barra muestra como máximo cinco controles interactivos | passed | 451 |
| desktop-1440 | `interaction.spec.ts` | la escala alterna entre automática y fija | passed | 725 |
| desktop-1440 | `interaction.spec.ts` | la pantalla de protección lee el índice de estrés y construye la titulación con lo medido | passed | 5578 |
| desktop-1440 | `interaction.spec.ts` | la pantalla de ventilación muestra la gasometría del modelo y el monitor nunca la muestra | passed | 1004 |
| desktop-1440 | `interaction.spec.ts` | la primera visita ofrece explorar o casos clínicos; la bienvenida no se repite | passed | 569 |
| desktop-1440 | `interaction.spec.ts` | la selección de 6 casillas grandes persiste y vuelve a 13 sin romper la tabla | passed | 1124 |
| desktop-1440 | `interaction.spec.ts` | la tecla muestra lo entregado; la propuesta confirmada se anuncia aparte con su flecha | passed | 394 |
| desktop-1440 | `interaction.spec.ts` | la velocidad se actualiza desde el menú y Escape devuelve el foco | passed | 879 |
| desktop-1440 | `interaction.spec.ts` | la versión vive en el panel docente y ya no existe el listón de seguridad | passed | 364 |
| desktop-1440 | `interaction.spec.ts` | los controles de tiempo caben sin desbordar el ancho del viewport | passed | 527 |
| desktop-1440 | `interaction.spec.ts` | los paneles laterales: uno a la vez, Esc devuelve el foco y se cierran al ir a Casos | passed | 1078 |
| desktop-1440 | `interaction.spec.ts` | los perfiles están deshabilitados en una referencia fotográfica | passed | 490 |
| desktop-1440 | `interaction.spec.ts` | los valores medidos se ocultan hasta que el alumno los estima | passed | 975 |
| desktop-1440 | `interaction.spec.ts` | recorrer la historia desplaza la ventana en el tiempo | passed | 5257 |
| desktop-1440 | `interaction.spec.ts` | restablecer preferencias las borra y avisa que se aplicará al recargar | passed | 552 |
| desktop-1440 | `interaction.spec.ts` | restaura escenario, vista y ventana de curvas al recargar | passed | 853 |
| desktop-1440 | `interaction.spec.ts` | sin bloqueo no inventa números; con bloqueo enseña la cuenta con los del monitor | passed | 2487 |
| desktop-1440 | `interaction.spec.ts` | subir PEEP por encima de la apertura recluta; bajarla por encima del cierre lo conserva | passed | 4871 |
| desktop-1440 | `interaction.spec.ts` | tocar o pulsar la curva congelada basta para medir | passed | 5230 |
| desktop-1440 | `interaction.spec.ts` | tres controles a la vista; la mecánica avanzada sale de la barra en cuatro pestañas, un grupo a la vez | passed | 883 |
| desktop-1440 | `interaction.spec.ts` | un `speed` ilegible se descarta con aviso y el motor avanza igual | passed | 290 |
| desktop-1440 | `interaction.spec.ts` | un escenario de la dirección tiene prioridad sobre el guardado | passed | 363 |
| desktop-1440 | `interaction.spec.ts` | una intervención conserva automáticamente la última respiración completa como «Antes» | passed | 2441 |
| desktop-1440 | `interaction.spec.ts` | una sesión importada no evalúa el caso clínico que estaba abierto | passed | 763 |
| desktop-1440 | `interaction.spec.ts` | una velocidad personalizada de la URL aparece en Revisar curvas y tiempo | passed | 682 |
| desktop-1440 | `interaction.spec.ts` | «TET 7,0 mm» fija el deslizador K₂ a 9,2 y moverlo a mano deja «Personalizado» | passed | 898 |
| desktop-1440 | `measurementFidelity.spec.ts` | SC-09 prolongada: fuga sin denominador muestra motivo | passed | 4344 |
| desktop-1440 | `measurementFidelity.spec.ts` | SC-18: el bloqueo espiratorio con esfuerzo no delata el músculo en la cara del equipo | passed | 13688 |
| desktop-1440 | `measurementFidelity.spec.ts` | meseta estable con esfuerzo: el equipo muestra lo que mide y el Aula avisa que no es mecánica pasiva | passed | 1339 |
| desktop-1440 | `measurementFidelity.spec.ts` | pausa de ciclo: el equipo publica la meseta estable con o sin esfuerzo, sin delatar el músculo | passed | 1746 |
| desktop-1440 | `mobile.spec.ts` | Paciente conserva targets táctiles; la mecánica avanzada se abre a pantalla completa sobre la hoja | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | datos grandes: los seis valores a la vista en dos columnas; bucles apilados; la alarma no se recorta | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | el diálogo conserva su caja y cabe en cada pestaña a 375 px | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | elimina la barra redundante y arranca con el panel cerrado y compacto | skipped | 1 |
| desktop-1440 | `mobile.spec.ts` | escritorio: la ventana arranca en 12 s | passed | 284 |
| desktop-1440 | `mobile.spec.ts` | la cabecera muestra Buscar y ⋯; el menú añade Sesión | skipped | 69 |
| desktop-1440 | `mobile.spec.ts` | la hoja del panel docente abre, cierra con el botón o Escape y devuelve el foco | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | la hoja vuelve a la columna del panel al ensanchar el viewport | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | móvil (< 700 px): la ventana arranca en 6 s | skipped | 67 |
| desktop-1440 | `mobile.spec.ts` | nada flota sobre los ajustes: Pausar y Personalizar quedan en la cabecera, siempre a la vista | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | sin desbordamiento; las trece cifras a la vista y legibles; el monitor cabe en su ventana; el editor fuera del monitor | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | sin desborde al cargar, abrir Menú y cambiar cada vista | skipped | 0 |
| desktop-1440 | `palette.spec.ts` | Ctrl+K abre la paleta y permite aplicar un perfil | passed | 545 |
| desktop-1440 | `palette.spec.ts` | Escape cierra la paleta y devuelve el foco al botón | passed | 593 |
| desktop-1440 | `palette.spec.ts` | filtra vistas y ejecuta la selección con las flechas | passed | 513 |
| desktop-1440 | `palette.spec.ts` | la cabecera no desborda horizontalmente | passed | 324 |
| desktop-1440 | `palette.spec.ts` | permite cargar un caso clínico por su identificador y lo presenta en el panel | passed | 545 |
| desktop-1440 | `palette.spec.ts` | una consulta sin coincidencias no ejecuta nada | passed | 542 |
| desktop-1440 | `pc.spec.ts` | Escape cierra primero el diálogo y el reloj del monitor muestra la hora del día | passed | 377 |
| desktop-1440 | `pc.spec.ts` | PEEP: el primer paso del deslizador es Off, no 0 | passed | 503 |
| desktop-1440 | `pc.spec.ts` | VTesp bajo y FR alta configurados en el diálogo se activan mientras ventila y se reflejan en la banda | passed | 846 |
| desktop-1440 | `pc.spec.ts` | bloqueo inspiratorio rechazado por Pmáx: resultado no válido con motivo legible y aviso | passed | 3347 |
| desktop-1440 | `pc.spec.ts` | cambiar a A/C PC desde el menú de modos: teclas rápidas, curvas y VT esperado | passed | 2749 |
| desktop-1440 | `pc.spec.ts` | deslizador recorre sólo valores admitidos; ± y deslizador coinciden; escritura fuera de rejilla sugiere el más cercano | passed | 1438 |
| desktop-1440 | `pc.spec.ts` | el VTesp mostrado cambia entre ciclos alrededor del volumen programado | passed | 12360 |
| desktop-1440 | `pc.spec.ts` | la columna de presión desciende de forma progresiva al terminar la inspiración | passed | 8396 |
| desktop-1440 | `pc.spec.ts` | menú de modo: flujo de base y disparo por presión; el disparo por flujo no puede superar el flujo de base | passed | 1730 |
| desktop-1440 | `pc.spec.ts` | ▶ es idempotente mientras hay solicitud; «Cancelar» la anula y se anuncia | passed | 768 |
| desktop-1440 | `ps.spec.ts` | SC-19: apnea provocada → alarma alta y respaldo; al deshacerla el paciente vuelve y la alarma se resuelve | passed | 6797 |
| desktop-1440 | `ps.spec.ts` | cambiar a CPAP/PS desde el menú de modos: bloque de respaldo, teclas rápidas y respiraciones espontáneas | passed | 5234 |
| desktop-1440 | `teachingHonesty.spec.ts` | SC-25 mantiene sus límites visibles en los Fundamentos | passed | 1728 |
| desktop-1440 | `teachingHonesty.spec.ts` | la ayuda del bloqueo anuncia la maniobra que está abierta | passed | 805 |
| desktop-1440 | `visual.spec.ts` | DAT-08 · grupos y estado Pplat cambian al completar un bloqueo válido | passed | 1960 |
| desktop-1440 | `visual.spec.ts` | VIS · el exterior usa tema claro y conserva el fondo del equipo | passed | 623 |
| desktop-1440 | `visual.spec.ts` | VIS · panel Paciente compacto a 1440 px: gases, perfiles, mecánica y eventos sin desplazarse | passed | 664 |
| desktop-1440 | `visual.spec.ts` | VIS-01 + DAT-02 · P1: panel denso y bloqueo; Pplat de bloqueo 32 y Cstat 19 fechados | passed | 555 |
| desktop-1440 | `visual.spec.ts` | VIS-02 + DAT-01 · P3: datos grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 624 |
| desktop-1440 | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro | passed | 1152 |
| desktop-1440 | `visual.spec.ts` | VIS-04 · alarma de Pmáx (SC-09): banda roja, luz del bisel y celda resaltada | passed | 2665 |
| desktop-1440 | `visual.spec.ts` | VIS-05 · vistas de bucles, tabla, tendencias y registro son funcionales | passed | 2080 |
| desktop-1440 | `visual.spec.ts` | VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3 | passed | 1853 |
| desktop-1440 | `visual.spec.ts` | VIS-08 · CPAP/PS (SC-19): presión a PEEP + PS, flujo cortado al 25 % del pico, volumen del paciente | passed | 1555 |
| desktop-1440 | `visual.spec.ts` | no usa iconos informativos y sus descendientes caben | passed | 451 |
| mobile | `build.spec.ts` | el build carga los Fundamentos sólo al llegar a ellos y reutiliza su módulo sin red | passed | 1042 |
| mobile | `build.spec.ts` | una carga fallida deja el simulador operativo y permite recuperar los Fundamentos | passed | 900 |
| mobile | `clinicalCases.spec.ts` | CC-01: se elige en el panel, se resuelve en el ventilador con la mecánica oculta y se revela al entregar | passed | 3568 |
| mobile | `clinicalCases.spec.ts` | cada caso se lee entero en el panel sin desplazarse, con el título en una línea, antes y después de entregar | skipped | 214 |
| mobile | `clinicalCases.spec.ts` | el panel abre en Paciente (perfiles, mecánica y eventos) en escritorio y cerrado en móvil; Casos tiene la lista | passed | 509 |
| mobile | `clinicalCases.spec.ts` | el resumen de práctica se descarga con el caso y su estado | passed | 777 |
| mobile | `clinicalCases.spec.ts` | la URL heredada ?view=teaching lleva a los Fundamentos y el monitor sigue en Curvas | passed | 611 |
| mobile | `clinicalCases.spec.ts` | volver al caso en curso no lo reinicia; elegir otro caso carga su paciente y limpia la reflexión | passed | 777 |
| mobile | `clinicalCases.spec.ts` | «Aula» lleva a los Fundamentos bajo el equipo; en escritorio el caso sigue a la vista y nada desborda | passed | 947 |
| mobile | `clinicalCases.spec.ts` | «Salir del caso» vuelve al banco pasivo con el panel Paciente abierto | passed | 842 |
| mobile | `clockStartup.spec.ts` | SC-02 respeta paused=1 durante el arranque | passed | 1370 |
| mobile | `clockStartup.spec.ts` | SC-12 respeta paused=1 durante el arranque | passed | 1744 |
| mobile | `clockStartup.spec.ts` | autopause=12001 detiene el reloj a 12004 | passed | 1088 |
| mobile | `controls.spec.ts` | Descripción de variables muestra el glosario y las ayudas persisten al recargar | passed | 1463 |
| mobile | `controls.spec.ts` | Modo: el paso de VT cruza 300 mL por la regla, slider sincroniza y Cancelar no aplica | passed | 1953 |
| mobile | `controls.spec.ts` | Paciente: − y deslizador modifican la mecánica simulada | passed | 1058 |
| mobile | `controls.spec.ts` | el diálogo conserva su caja y no desborda al cambiar de pestaña | passed | 1161 |
| mobile | `controls.spec.ts` | la barra muestra exactamente Pausar, Personalizar vista y las ayudas sobre las curvas; Sesión sólo en Más opciones | passed | 822 |
| mobile | `controls.spec.ts` | las pestañas usan flechas/Home/End, el diálogo atrapa el foco y Escape lo cierra | passed | 1180 |
| mobile | `controls.spec.ts` | las preferencias de ayudas no se escriben en una referencia fotográfica | passed | 969 |
| mobile | `controls.spec.ts` | los estados activos sobreviven al cierre y la pausa conserva la velocidad | passed | 1252 |
| mobile | `controls.spec.ts` | los segmentados de Pantalla cambian sus controles y las preferencias persisten al recargar | passed | 1486 |
| mobile | `controls.spec.ts` | límites: Off vuelve al mínimo, admite Off y confirma sólo el borrador válido | passed | 1630 |
| mobile | `controls.spec.ts` | minRate respeta Off y su mínimo; switches y ayudas responden al teclado y al foco | passed | 1775 |
| mobile | `instrument.spec.ts` | device dialog follows visible monitor bounds, scrolls internally, and resets before global personalization | passed | 1387 |
| mobile | `instrument.spec.ts` | mode edits stay draft on cancel and confirming sends only changed settings | passed | 5126 |
| mobile | `instrument.spec.ts` | resizing to 390×844 recomputes device dialog bounds without horizontal overflow | passed | 687 |
| mobile | `interaction.spec.ts` | ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela | passed | 1762 |
| mobile | `interaction.spec.ts` | ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia | passed | 5801 |
| mobile | `interaction.spec.ts` | Casillas vive en Pantalla y se oculta fuera de Curvas | passed | 862 |
| mobile | `interaction.spec.ts` | Comparar última respiración dibuja el ciclo previo atenuado bajo la traza actual | passed | 3533 |
| mobile | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 675 |
| mobile | `interaction.spec.ts` | INT-02 · confirmar edición válida: se aplica en la siguiente respiración | passed | 1736 |
| mobile | `interaction.spec.ts` | INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima | passed | 858 |
| mobile | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 3717 |
| mobile | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 1751 |
| mobile | `interaction.spec.ts` | INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor | passed | 2225 |
| mobile | `interaction.spec.ts` | INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada | passed | 1636 |
| mobile | `interaction.spec.ts` | Modo explica en texto los modos que no se simulan | passed | 808 |
| mobile | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel | passed | 3974 |
| mobile | `interaction.spec.ts` | Pausar, velocidad y Congelar viven en .signal-toolbar y no se confunden | passed | 847 |
| mobile | `interaction.spec.ts` | SC-09 · la oclusión se resuelve con controles visibles: reconocer y Restablecer mecánica | passed | 2766 |
| mobile | `interaction.spec.ts` | SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel | passed | 1065 |
| mobile | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa discreta y reanudación manual sin salto de reloj | passed | 2982 |
| mobile | `interaction.spec.ts` | abrir el circuito en Eventos dispara la alarma alta; deshacer la resuelve y reconocer devuelve la banda al azul | passed | 5977 |
| mobile | `interaction.spec.ts` | aplica, deshace y restablece mecánica con perfiles completos | passed | 904 |
| mobile | `interaction.spec.ts` | aplicar un perfil en Paciente conserva sesión, tiempo, ajustes y lo hecho en la práctica | passed | 2743 |
| mobile | `interaction.spec.ts` | cada tarjeta deja como máximo un párrafo visible fuera de «Por qué» | passed | 1163 |
| mobile | `interaction.spec.ts` | cargar SC-24 muestra la amplitud evocada 8 en el panel del paciente | passed | 730 |
| mobile | `interaction.spec.ts` | el Menú del equipo conserva sólo sus cuatro entradas funcionales | passed | 906 |
| mobile | `interaction.spec.ts` | el bucle Pva·V con presión total se ve en el panel docente | passed | 581 |
| mobile | `interaction.spec.ts` | el campo vacío no vale como cero y el Resumen no revela las cifras tapadas | passed | 979 |
| mobile | `interaction.spec.ts` | el contexto del encabezado muestra el caso y abre la lista de casos en el panel, sin diálogo | passed | 845 |
| mobile | `interaction.spec.ts` | el cursor cae donde apunta el puntero: el centro de la rejilla es el centro de la ventana | passed | 5201 |
| mobile | `interaction.spec.ts` | el cursor se maneja con el teclado, se anuncia, y sigue midiendo al recorrer la historia | passed | 5206 |
| mobile | `interaction.spec.ts` | el diálogo de personalización cierra con Escape y devuelve el foco | passed | 1021 |
| mobile | `interaction.spec.ts` | el interruptor vive en el menú «…» y no en el monitor | passed | 492 |
| mobile | `interaction.spec.ts` | escritorio agrupa las opciones en ⋯ y Audio alterna aria-checked | skipped | 240 |
| mobile | `interaction.spec.ts` | la barra muestra como máximo cinco controles interactivos | passed | 512 |
| mobile | `interaction.spec.ts` | la escala alterna entre automática y fija | passed | 902 |
| mobile | `interaction.spec.ts` | la pantalla de protección lee el índice de estrés y construye la titulación con lo medido | passed | 4036 |
| mobile | `interaction.spec.ts` | la pantalla de ventilación muestra la gasometría del modelo y el monitor nunca la muestra | passed | 1351 |
| mobile | `interaction.spec.ts` | la primera visita ofrece explorar o casos clínicos; la bienvenida no se repite | passed | 668 |
| mobile | `interaction.spec.ts` | la selección de 6 casillas grandes persiste y vuelve a 13 sin romper la tabla | passed | 979 |
| mobile | `interaction.spec.ts` | la tecla muestra lo entregado; la propuesta confirmada se anuncia aparte con su flecha | passed | 861 |
| mobile | `interaction.spec.ts` | la velocidad se actualiza desde el menú y Escape devuelve el foco | passed | 955 |
| mobile | `interaction.spec.ts` | la versión vive en el panel docente y ya no existe el listón de seguridad | passed | 699 |
| mobile | `interaction.spec.ts` | los controles de tiempo caben sin desbordar el ancho del viewport | passed | 496 |
| mobile | `interaction.spec.ts` | los paneles laterales: uno a la vez, Esc devuelve el foco y se cierran al ir a Casos | skipped | 151 |
| mobile | `interaction.spec.ts` | los perfiles están deshabilitados en una referencia fotográfica | passed | 529 |
| mobile | `interaction.spec.ts` | los valores medidos se ocultan hasta que el alumno los estima | passed | 958 |
| mobile | `interaction.spec.ts` | recorrer la historia desplaza la ventana en el tiempo | passed | 5302 |
| mobile | `interaction.spec.ts` | restablecer preferencias las borra y avisa que se aplicará al recargar | passed | 623 |
| mobile | `interaction.spec.ts` | restaura escenario, vista y ventana de curvas al recargar | passed | 821 |
| mobile | `interaction.spec.ts` | sin bloqueo no inventa números; con bloqueo enseña la cuenta con los del monitor | passed | 2765 |
| mobile | `interaction.spec.ts` | subir PEEP por encima de la apertura recluta; bajarla por encima del cierre lo conserva | passed | 5485 |
| mobile | `interaction.spec.ts` | tocar o pulsar la curva congelada basta para medir | passed | 5466 |
| mobile | `interaction.spec.ts` | tres controles a la vista; la mecánica avanzada sale de la barra en cuatro pestañas, un grupo a la vez | passed | 857 |
| mobile | `interaction.spec.ts` | un `speed` ilegible se descarta con aviso y el motor avanza igual | passed | 597 |
| mobile | `interaction.spec.ts` | un escenario de la dirección tiene prioridad sobre el guardado | passed | 465 |
| mobile | `interaction.spec.ts` | una intervención conserva automáticamente la última respiración completa como «Antes» | passed | 2469 |
| mobile | `interaction.spec.ts` | una sesión importada no evalúa el caso clínico que estaba abierto | passed | 727 |
| mobile | `interaction.spec.ts` | una velocidad personalizada de la URL aparece en Revisar curvas y tiempo | passed | 702 |
| mobile | `interaction.spec.ts` | «TET 7,0 mm» fija el deslizador K₂ a 9,2 y moverlo a mano deja «Personalizado» | passed | 876 |
| mobile | `measurementFidelity.spec.ts` | SC-09 prolongada: fuga sin denominador muestra motivo | passed | 5055 |
| mobile | `measurementFidelity.spec.ts` | SC-18: el bloqueo espiratorio con esfuerzo no delata el músculo en la cara del equipo | passed | 14002 |
| mobile | `measurementFidelity.spec.ts` | meseta estable con esfuerzo: el equipo muestra lo que mide y el Aula avisa que no es mecánica pasiva | passed | 2102 |
| mobile | `measurementFidelity.spec.ts` | pausa de ciclo: el equipo publica la meseta estable con o sin esfuerzo, sin delatar el músculo | passed | 2385 |
| mobile | `mobile.spec.ts` | Paciente conserva targets táctiles; la mecánica avanzada se abre a pantalla completa sobre la hoja | passed | 1217 |
| mobile | `mobile.spec.ts` | datos grandes: los seis valores a la vista en dos columnas; bucles apilados; la alarma no se recorta | passed | 3047 |
| mobile | `mobile.spec.ts` | el diálogo conserva su caja y cabe en cada pestaña a 375 px | passed | 886 |
| mobile | `mobile.spec.ts` | elimina la barra redundante y arranca con el panel cerrado y compacto | passed | 670 |
| mobile | `mobile.spec.ts` | escritorio: la ventana arranca en 12 s | skipped | 139 |
| mobile | `mobile.spec.ts` | la cabecera muestra Buscar y ⋯; el menú añade Sesión | passed | 979 |
| mobile | `mobile.spec.ts` | la hoja del panel docente abre, cierra con el botón o Escape y devuelve el foco | passed | 926 |
| mobile | `mobile.spec.ts` | la hoja vuelve a la columna del panel al ensanchar el viewport | passed | 1095 |
| mobile | `mobile.spec.ts` | móvil (< 700 px): la ventana arranca en 6 s | passed | 495 |
| mobile | `mobile.spec.ts` | nada flota sobre los ajustes: Pausar y Personalizar quedan en la cabecera, siempre a la vista | passed | 554 |
| mobile | `mobile.spec.ts` | sin desbordamiento; las trece cifras a la vista y legibles; el monitor cabe en su ventana; el editor fuera del monitor | passed | 1067 |
| mobile | `mobile.spec.ts` | sin desborde al cargar, abrir Menú y cambiar cada vista | passed | 2570 |
| mobile | `palette.spec.ts` | Ctrl+K abre la paleta y permite aplicar un perfil | passed | 675 |
| mobile | `palette.spec.ts` | Escape cierra la paleta y devuelve el foco al botón | passed | 777 |
| mobile | `palette.spec.ts` | filtra vistas y ejecuta la selección con las flechas | passed | 678 |
| mobile | `palette.spec.ts` | la cabecera no desborda horizontalmente | passed | 552 |
| mobile | `palette.spec.ts` | permite cargar un caso clínico por su identificador y lo presenta en el panel | passed | 858 |
| mobile | `palette.spec.ts` | una consulta sin coincidencias no ejecuta nada | passed | 1038 |
| mobile | `pc.spec.ts` | Escape cierra primero el diálogo y el reloj del monitor muestra la hora del día | passed | 715 |
| mobile | `pc.spec.ts` | PEEP: el primer paso del deslizador es Off, no 0 | passed | 606 |
| mobile | `pc.spec.ts` | VTesp bajo y FR alta configurados en el diálogo se activan mientras ventila y se reflejan en la banda | passed | 1023 |
| mobile | `pc.spec.ts` | bloqueo inspiratorio rechazado por Pmáx: resultado no válido con motivo legible y aviso | passed | 3499 |
| mobile | `pc.spec.ts` | cambiar a A/C PC desde el menú de modos: teclas rápidas, curvas y VT esperado | passed | 2627 |
| mobile | `pc.spec.ts` | deslizador recorre sólo valores admitidos; ± y deslizador coinciden; escritura fuera de rejilla sugiere el más cercano | passed | 1897 |
| mobile | `pc.spec.ts` | el VTesp mostrado cambia entre ciclos alrededor del volumen programado | passed | 12596 |
| mobile | `pc.spec.ts` | la columna de presión desciende de forma progresiva al terminar la inspiración | passed | 8537 |
| mobile | `pc.spec.ts` | menú de modo: flujo de base y disparo por presión; el disparo por flujo no puede superar el flujo de base | passed | 1615 |
| mobile | `pc.spec.ts` | ▶ es idempotente mientras hay solicitud; «Cancelar» la anula y se anuncia | passed | 998 |
| mobile | `ps.spec.ts` | SC-19: apnea provocada → alarma alta y respaldo; al deshacerla el paciente vuelve y la alarma se resuelve | passed | 8149 |
| mobile | `ps.spec.ts` | cambiar a CPAP/PS desde el menú de modos: bloque de respaldo, teclas rápidas y respiraciones espontáneas | passed | 6000 |
| mobile | `teachingHonesty.spec.ts` | SC-25 mantiene sus límites visibles en los Fundamentos | passed | 1411 |
| mobile | `teachingHonesty.spec.ts` | la ayuda del bloqueo anuncia la maniobra que está abierta | passed | 989 |
| mobile | `visual.spec.ts` | DAT-08 · grupos y estado Pplat cambian al completar un bloqueo válido | passed | 2140 |
| mobile | `visual.spec.ts` | VIS · el exterior usa tema claro y conserva el fondo del equipo | passed | 515 |
| mobile | `visual.spec.ts` | VIS · panel Paciente compacto a 1440 px: gases, perfiles, mecánica y eventos sin desplazarse | skipped | 248 |
| mobile | `visual.spec.ts` | VIS-01 + DAT-02 · P1: panel denso y bloqueo; Pplat de bloqueo 32 y Cstat 19 fechados | passed | 746 |
| mobile | `visual.spec.ts` | VIS-02 + DAT-01 · P3: datos grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 671 |
| mobile | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro | passed | 1284 |
| mobile | `visual.spec.ts` | VIS-04 · alarma de Pmáx (SC-09): banda roja, luz del bisel y celda resaltada | passed | 2731 |
| mobile | `visual.spec.ts` | VIS-05 · vistas de bucles, tabla, tendencias y registro son funcionales | passed | 2281 |
| mobile | `visual.spec.ts` | VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3 | passed | 2090 |
| mobile | `visual.spec.ts` | VIS-08 · CPAP/PS (SC-19): presión a PEEP + PS, flujo cortado al 25 % del pico, volumen del paciente | passed | 1682 |
| mobile | `visual.spec.ts` | no usa iconos informativos y sus descendientes caben | passed | 738 |

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

Un identificador cuenta como habilitado sólo si todas las pruebas que lo citan pasan. ACC-01, ALM-02, ALM-03, ALM-05, ALM-07, ALM-10, ALM-11, BM-01, BM-02, BM-03, BM-04, BM-05, BM-06, BM-07, BM-08, DAT-01, DAT-02, DAT-04, DAT-08, INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, PHY-02, PHY-03, PHY-06, PHY-07, PHY-08, PHY-10, PRC-01, PRC-02, PRC-03, PRC-05, SEC-01, SEC-03, TIM-01, TIM-02, TIM-03, TIM-04, VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, VIS-06, VIS-08.


## No ejecutado en esta etapa

ALM-04 automatizada de extremo a extremo (pausa de audio); PHY-05 (fuga no modelada); PRC-04 (SBT); DAT-05 en UI; DAT-06 en UI; CFG-04; ACC-02 automatizada; auditoría de accesibilidad formal; revisión experta L3; contraste con equipo de demostración.
