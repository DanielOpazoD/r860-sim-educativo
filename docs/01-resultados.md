# Resultados de pruebas ejecutadas · v0.7.0 (adulto A/C VC + A/C PC + CPAP/PS · interfaz Ventila Lab)

Generado el 2026-10-14T19:49:59 con `npm run results:doc` a partir de `test-results/vitest.json` y `test-results/e2e-results.json` (salidas reales). Motor 0.7.0 · perfil ventila-adulto-v1 · dt 4 ms · semilla 1 · t0 2026-08-18T21:04:05-04:00 · Node 22.22.0 · Chromium (Playwright 1.63.0, build 1243).

## Niveles de validación

- **L0 visual**: capturas deterministas en `docs/capturas/` con JSON de metadatos. Comparación por zonas con P1/P3 hecha por la IA constructora; sin baseline aprobada por revisor humano.
- **L1 interacción**: Playwright (abajo).
- **L2 modelo analítico**: Vitest, banco BM-01…BM-08 y PC, físicas y regresiones.
- **L3 revisión experta**: pendiente.

## Vitest · 840 pasadas / 0 fallidas / 840 totales

| Archivo | Prueba | Estado | ms |
| --- | --- | --- | --- |
| `bench/bm.test.ts` | BM-01 · VC con flujo constante (banco lineal pasivo) › Tinsp 1 s, Ppico 20 cmH2O, presión elástica al ocluir 15 cmH2O | passed | 23 |
| `bench/bm.test.ts` | BM-02 · Cstat y resistencia desde la misma respiración › Cstat = 500/(15−5) = 50 mL/cmH2O; R = (20−15)/0.5 = 10 | passed | 14 |
| `bench/bm.test.ts` | BM-03 · Fuente de presión ideal (modelo, no modo PC) › ΔP 10 sobre PEEP 5, R 10, C 0.05, 1 s: VT ≈ 0.432332 L; Q0 = 1 L/s; Qfin ≈ 0.135335 L/s | passed | 0 |
| `bench/bm.test.ts` | BM-04 · Espiración incompleta (atrapamiento) › Rexp 20, C 0.05, exceso 0.5 L, Te 0.5 s: exceso final ≈ 0.303265 L; presión elástica extra ≈ 6.0653 cmH2O | passed | 0 |
| `bench/bm.test.ts` | BM-05 · Unidades › 0.5 L/s → 30 L/min; 0.5 L·1 s → 500 mL; C 0.05 → 50 mL/cmH2O | passed | 0 |
| `bench/bm.test.ts` | BM-05 · Unidades › el motor no confunde unidades: VTesp de banco = 500 mL exactos | passed | 32 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › Plimit 25 (< Pmáx 40): el flujo cae para mantener 25 durante el Tinsp restante; VT real < VT programado; ciclo por tiempo | passed | 20 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › Pmáx 30 (< Plimit 60): alcanzar Pmáx TERMINA la inspiración a 0.8 s; VT = 0.4 L; alarma Pmáx activa | passed | 10 |
| `bench/bm.test.ts` | BM-06 · Presión limitada: Plimit y Pmáx producen respuestas distintas › no fuerza el volumen objetivo bajo límites: VTesp medido difiere del VT programado | passed | 16 |
| `bench/bm.test.ts` | BM-07 · Conservación de volumen (sin fuga) › por respiración: VTinsp − VTesp = ΔV absoluto; acumulado en 10 respiraciones | passed | 25 |
| `bench/bm.test.ts` | BM-08 · Convergencia con el paso de integración › errores de VT decrecientes para dt = 4, 2, 1 ms en la respiración limitada por presión (RK2) | passed | 27 |
| `bench/bm.test.ts` | BM-08 · Convergencia con el paso de integración › los tiempos de evento (Ppico, Tinsp) no dependen del paso cuando el evento no cae en un múltiplo de dt | passed | 15 |
| `bench/circuito.test.ts` | BM-CC circuito compresible › el pulmón recibe ≈ VT·C/(C+Cc) y la meseta baja acorde | passed | 79 |
| `bench/circuito.test.ts` | BM-CC circuito compresible › la Cstat del bloqueo inspiratorio sale ≈ C + Cc | passed | 54 |
| `bench/circuito.test.ts` | BM-CC circuito compresible › la descompresión al espirar nunca supera el tope del actuador | passed | 21 |
| `bench/disparoReverso.test.ts` | BM-RT · disparo reverso en SC-24 › el umbral del apilamiento sale de la mecánica: con la rama espiratoria del equipo, latencia entre 0,7 y 0,8 s con Pmus 8–9 | passed | 738 |
| `bench/disparoReverso.test.ts` | BM-RT · disparo reverso en SC-24 › con latencia 0,5 s (mitad del ciclo, Baedorf Kassis 0,47) la Pmus máxima cae a inicio+0,5+0,8 ±0,02 s y todas son mandatory | passed | 101 |
| `bench/disparoReverso.test.ts` | BM-RT · disparo reverso en SC-24 › con latencia 0,8 s (apilamiento; Baedorf Kassis 0,68) aparecen asistidas que entran sobre un pulmón sin vaciar | passed | 253 |
| `bench/disparoReverso.test.ts` | BM-RT · disparo reverso en SC-24 › sin `reverse` las trazas de Pva son idénticas a las del esfuerzo apagado sin reverse | passed | 122 |
| `bench/espiracionActiva.test.ts` | BM-EA espiración activa › el pico de flujo espiratorio crece ≥15 % con expAmplitude 8 | passed | 233 |
| `bench/espiracionActiva.test.ts` | BM-EA espiración activa › en estado estable VTe ≈ VTi y el pulmón vacía por debajo de su FRC pasiva | passed | 145 |
| `bench/espiracionActiva.test.ts` | BM-EA espiración activa › con limitación al flujo espiratorio, a igual volumen el flujo activo no supera al pasivo en más de 3 % (Starling) | passed | 333 |
| `bench/pc.test.ts` | BM-03 · A/C PC ideal (rampa 0) en el motor › ΔP 10 sobre PEEP 5, R 10, C 0.05, Tinsp 1 s: VT ≈ 0.432332 L; Q0 = 1 L/s; Qfin ≈ 0.135335 L/s; Ppico = PEEP + Pinsp | passed | 25 |
| `bench/pc.test.ts` | BM-03 · A/C PC ideal (rampa 0) en el motor › con rampa de 200 ms el VT coincide con la referencia numérica independiente (< 1 %) | passed | 16 |
| `bench/pc.test.ts` | BM-03 · A/C PC ideal (rampa 0) en el motor › tope de flujo del actuador (160 L/min): con R muy baja la presión no alcanza el objetivo de inmediato | passed | 11 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › duplicar R halva el flujo pico y reduce el VT; Ppico no cambia | passed | 8 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › halvar C reduce el VT (hacia C·ΔP) y acorta la constante de tiempo | passed | 13 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › alargar Tinsp aumenta el VT hasta saturar; el flujo cae a ~cero (fase plana del flujo) | passed | 8 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › cambiar PEEP en PC conserva el volumen y desplaza la línea base: mismo VT (ΔP relativo), Ppico = nuevo PEEP + Pinsp | passed | 62 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › el esfuerzo del paciente aumenta el flujo y el VT con la misma presión de vía aérea | passed | 35 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › BM-07 en PC: conservación de volumen por respiración | passed | 67 |
| `bench/pc.test.ts` | PHY-02 · en PC el flujo y el VT dependen de R, C, Tinsp y esfuerzo; la presión no › validación PC: PEEP + Pinsp ≥ Pmáx y rampa > Tinsp se rechazan con explicación; el cambio VC → PC es transacción de siguiente respiración | passed | 6 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › por debajo de la apertura no recluta: r se mantiene 0 y la Cstat es la basal (≈30 mL/cmH₂O) | passed | 73 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › mantener presión por encima de la apertura abre la capacidad ganable: r sube y la meseta baja al mismo VT | passed | 56 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › histéresis: la PEEP decremental devuelve más compliance que la ascendente al mismo nivel | passed | 129 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › por debajo del cierre se desrecluta con su propia constante de tiempo | passed | 52 |
| `bench/reclutamiento.test.ts` | BM-RC · reclutamiento y curva P-V con histéresis › quitar el reclutamiento devuelve el modelo exactamente al lineal | passed | 66 |
| `bench/reguladorPeep.test.ts` | BM-RP · regulador de PEEP: caída transitoria bajo demanda, recuperación en régimen › con fuga estable que el flujo de base cubre la Pva tardía se queda en PEEP: la acción integral no deja caída permanente | passed | 389 |
| `bench/reguladorPeep.test.ts` | BM-RP · regulador de PEEP: caída transitoria bajo demanda, recuperación en régimen › la caída máxima crece con la amplitud del esfuerzo y baja con más flujo de base | passed | 794 |
| `bench/reguladorPeep.test.ts` | BM-RP · regulador de PEEP: caída transitoria bajo demanda, recuperación en régimen › en un escenario con esfuerzo la PEEPe medida se conserva: la traza pre-disparo no se contamina | passed | 96 |
| `bench/viscoelasticoReferencia.test.ts` | BM-VE · preset sano de viscoelasticidad en una oclusión de 3 s › P1 − P2 queda en 0,8–2,5 cmH₂O y P2 ≈ P0 + VT/Crs | passed | 130 |
| `bench/viscoelasticoReferencia.test.ts` | BM-VE · preset sano de viscoelasticidad en una oclusión de 3 s › con el preset SDRA la diferencia P1 − P2 es más del doble que la sana | passed | 113 |
| `bench/viscoelasticoReferencia.test.ts` | BM-VE · preset TET 7,0 mm (K₂ 9,2) › a 0,5 L/s la presión pico sube ≈ K₂·Q² = 2,3 ± 0,4 cmH₂O respecto a K₂ 0 | passed | 48 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › ppeakLow: 30 dispara (high); 10 resuelve | passed | 94 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › vteLow: 0.6 dispara (medium); 0.4 resuelve | passed | 52 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › vteHigh: 0.4 dispara (medium); 0.6 resuelve | passed | 23 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › mveLow: 10 dispara (high); 5 resuelve | passed | 25 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › mveHigh: 5 dispara (high); 10 resuelve | passed | 38 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › rrLow: 20 dispara (high); 10 resuelve | passed | 43 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › rrHigh: 10 dispara (medium); 20 resuelve | passed | 32 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › peepeLow: 8 dispara (high); 3 resuelve | passed | 35 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › peepeHigh: 5 dispara (medium); 20 resuelve | passed | 22 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › fio2Low: 0.3 dispara (high); 0.18 resuelve | passed | 20 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › fio2High: 0.24 dispara (high); 0.99 resuelve | passed | 22 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › Pmáx: bajar el techo por debajo de la presión alcanzada activa la alarma alta y termina la inspiración | passed | 22 |
| `unit/alarmLimits.test.ts` | ALM-10 · cada límite de alarma dispara en su escenario bajo/alto y se resuelve › los límites configurados se conservan al cargar otro escenario | passed | 74 |
| `unit/alarmLimits.test.ts` | ALM-11 · el audio suena según prioridad › alta: ráfaga de 10 tonos; media: 3; sin alarma: nada; vuelve a sonar tras la cadencia | passed | 2 |
| `unit/alarmLimits.test.ts` | ALM-URM-AUDIO · sonido de alarma como el equipo › suena la de más prioridad que se ve; las filtradas no suenan | passed | 7 |
| `unit/alarmLimits.test.ts` | ALM-URM-AUDIO · sonido de alarma como el equipo › una alta sin resolver ni reconocer pasa a alerta a los 30 s: más tono y más volumen | passed | 5 |
| `unit/alarmLimits.test.ts` | ALM-URM-AUDIO · sonido de alarma como el equipo › la pausa de audio calla todo menos la desconexión | passed | 0 |
| `unit/alarmLimits.test.ts` | ALM-URM-AUDIO · sonido de alarma como el equipo › la baja suena una vez y no se repite; alta y media se repiten | passed | 1 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-02: reconocer una alarma cuya condición persiste: sigue activa | passed | 72 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-03: resolver sin reconocer deja estado pendiente (banda gris) distinguible de activa | passed | 42 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-07: límite Off no es cero; dato ausente no genera alarma ni valor normal | passed | 0 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › ALM-05/06: la alarma Pmáx se traza al valor bruto; varias alarmas concurrentes conservan todas las condiciones | passed | 29 |
| `unit/alarms.test.ts` | ALM · estados separados (activa, reconocida, resuelta, audio) › FiO2: límites sobre el sensor con retardo; sesgo del instructor separa objetivo y medición (SC-12) | passed | 182 |
| `unit/alarms.test.ts` | ALM-URM · el sistema de alarmas se comporta como el del manual › filtros: con el paciente desconectado, las de volumen y FR salen de la lista y la banda sólo cuenta la desconexión | passed | 145 |
| `unit/alarms.test.ts` | ALM-URM · el sistema de alarmas se comporta como el del manual › Ppico alta retira Ppico baja: el motor de alarmas lo aplica en la lista y en la banda | passed | 0 |
| `unit/alarms.test.ts` | ALM-URM · el sistema de alarmas se comporta como el del manual › tras un bloqueo, VMesp bajo y FR baja esperan 60 s aunque la condición se cumpla | passed | 118 |
| `unit/alarms.test.ts` | ALM-URM · el sistema de alarmas se comporta como el del manual › las alarmas de FiO2 esperan 60 s tras cambiar la FiO2: el sensor tarda en seguir al mezclador | passed | 122 |
| `unit/alarms.test.ts` | ALM-URM · el sistema de alarmas se comporta como el del manual › al pasar de espera a ventilar, VTesp bajo espera 60 s y la desconexión 10 | passed | 140 |
| `unit/alarms.test.ts` | ALM-URM · el sistema de alarmas se comporta como el del manual › la apnea no se habilita durante un bloqueo | passed | 1 |
| `unit/alarms.test.ts` | ALM-PLIMIT · Plimit alcanzada y VT no entregado › Plimit alcanzada salta en la primera respiración recortada; VT no entregado espera seis seguidas | passed | 87 |
| `unit/alarms.test.ts` | ALM-PLIMIT · Plimit alcanzada y VT no entregado › un VT corto por menos del 20 % no cuenta; en presión control no se evalúa | passed | 196 |
| `unit/alarms.test.ts` | ALM-PLIMIT · Plimit alcanzada y VT no entregado › la pausa de audio las rebaja a prioridad baja hasta que se resuelven; las demás conservan la suya | passed | 53 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › el esfuerzo que sobrevive al ciclado dispara una segunda respiración en cuanto pasa el periodo refractario | passed | 94 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › la respiración apilada entra sobre un pulmón sin vaciar: más volumen y más presión | passed | 56 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › el apilamiento genera atrapamiento por sí solo: sin obstrucción ninguna, la PEEP intrínseca sube | passed | 509 |
| `unit/asynchrony.test.ts` | ASI-01 · doble disparo con Ti neural mayor que el mecánico › sin control asistido el mismo esfuerzo no dispara nada: el ciclado sigue siendo por tiempo | passed | 55 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › el mismo esfuerzo deja de disparar al subir la resistencia espiratoria, porque antes debe vencer la PEEP intrínseca | passed | 388 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › el esfuerzo inefectivo deja su huella en la curva de flujo: el vaciamiento deja de ser monótono | passed | 99 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › la Pva se deforma durante un esfuerzo inefectivo y el regulador la recupera antes del siguiente ciclo | passed | 281 |
| `unit/asynchrony.test.ts` | ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP › sin esfuerzo la vía es la de siempre: la Pva espiratoria se queda en PEEP | passed | 155 |
| `unit/boundaries.test.ts` | setAlarmLimits se valida como cualquier ajuste › rechaza texto, NaN, negativos, claves desconocidas, null y bajo ≥ alto; acepta Off y valores en rejilla | passed | 7 |
| `unit/boundaries.test.ts` | setAlarmLimits se valida como cualquier ajuste › increaseO2Start con delta negativo, NaN o > 100 % se rechaza; setSpeed no numérico se ignora | passed | 54 |
| `unit/boundaries.test.ts` | importación acotada › rechaza finalSimTimeMs enorme, negativo o textual, breaths ausente y comandos sin carga útil | passed | 14 |
| `unit/boundaries.test.ts` | cliente del motor: fallo del Worker no es silencioso › si el Worker nunca saluda, degrada al modo en página, avisa y sigue funcionando | passed | 66 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › con Pmus ≈ 0 sólo dibuja Pva y anota que coincide con la presión total | passed | 2 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › con Pmus negativa el eje X incluye el cero con margen negativo | passed | 0 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › con Pva negativa aunque la presión total sea positiva el eje X incluye negativos | passed | 0 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › con volumen negativo el eje Y incluye el cero con margen negativo | passed | 0 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › el esfuerzo se evalúa por ciclo: ciclo pasado pasivo + actual activo no dice «Sin esfuerzo» | passed | 0 |
| `unit/bucleDocente.test.ts` | BLD · bucle docente con presión muscular › no lanza con una traza vacía | passed | 0 |
| `unit/bucles.test.ts` | arrowIndices · flechas de sentido del bucle › devuelve tres posiciones repartidas por el ciclo | passed | 1 |
| `unit/bucles.test.ts` | arrowIndices · flechas de sentido del bucle › con menos de 8 muestras no dibuja flechas | passed | 0 |
| `unit/captura.test.ts` | CAP-01 · la captura exportada dice lo mismo que el monitor › SC-09 en alarma alta: prioridad arriba, mensaje del alumno debajo y Ppico con borde rojo | passed | 81 |
| `unit/captura.test.ts` | CAP-01 · la captura exportada dice lo mismo que el monitor › sin alarmas: «Sin alarmas», ningún borde de prioridad, y la línea de fuga con su cifra | passed | 405 |
| `unit/capturas.test.ts` | VR-02 · las referencias de la regresión visual corresponden al spec › el spec declara estados y algunos también en el teléfono | passed | 1 |
| `unit/capturas.test.ts` | VR-02 · las referencias de la regresión visual corresponden al spec › macOS: las referencias son exactamente las del spec | passed | 1 |
| `unit/capturas.test.ts` | VR-02 · las referencias de la regresión visual corresponden al spec › Linux: no hay referencias huérfanas | passed | 0 |
| `unit/casosClinicos.test.ts` | CAS-00 · formato › cada caso declara tema, viñeta, pregunta, criterios con pruebas existentes y referencias verificadas | passed | 4 |
| `unit/casosClinicos.test.ts` | CAS-00 · formato › los casos no tienen lección guiada: se evalúan al entregar | passed | 0 |
| `unit/casosClinicos.test.ts` | CAS-01 · presión pico alta por resistencia › la mecánica produce la viñeta: Ppico ≈ 29 con Pplat normal (≈ 15) | passed | 75 |
| `unit/casosClinicos.test.ts` | CAS-01 · presión pico alta por resistencia › sin medir la meseta no se resuelve, aunque la respuesta sea correcta | passed | 47 |
| `unit/casosClinicos.test.ts` | CAS-01 · presión pico alta por resistencia › midiendo y respondiendo bien se resuelve; con otra respuesta, no | passed | 22 |
| `unit/casosClinicos.test.ts` | CAS-01 · presión pico alta por resistencia › un bloqueo anterior al último ajuste ya no cuenta | passed | 62 |
| `unit/casosClinicos.test.ts` | CAS-02 · progreso › un caso resuelto no vuelve a «intentado» | passed | 0 |
| `unit/casosClinicos.test.ts` | CAS-02 · EPOC: atrapamiento › la viñeta: PEEP intrínseca ≈ 8 y pH de equilibrio ≈ 7,49 (hipocapnia aguda tamponada); no se resuelve sin tocar nada | passed | 339 |
| `unit/casosClinicos.test.ts` | CAS-02 · EPOC: atrapamiento › FR 12 e I:E 1:4 lo resuelve; alargar sólo el I:E o bajar el VT, no | passed | 1061 |
| `unit/casosClinicos.test.ts` | CAS-02b · EPOC con limitación al flujo: la PEEP externa hasta la presión crítica no infla › con PEEP 5 la PEEP total no baja de ≈ 9,6 (presión crítica 9); con 7 casi no cambia (Ranieri 1993); con 11 la suma | passed | 841 |
| `unit/casosClinicos.test.ts` | CAS-03 · SDRA: VT protector › la viñeta: con VT 600 la meseta pasa el codo superior (Pplat ≈ 33, ΔP ≈ 23) y el pH es 7,40 | passed | 52 |
| `unit/casosClinicos.test.ts` | CAS-03 · SDRA: VT protector › 6 mL/kg todavía deja la presión motriz en 15 o más (Terragni); 400 mL con FR 28 lo resuelve; sin subir la FR, acidosis | passed | 225 |
| `unit/casosClinicos.test.ts` | CAS-03 · SDRA: VT protector › curva no lineal: la Cstat cae al subir el VT o la PEEP, y la PEEP alta sube la presión motriz (Roupie, Grasso) | passed | 273 |
| `unit/casosClinicos.test.ts` | CAS-03 · SDRA: VT protector › el índice de estrés sube con el VT y con la PEEP, y con el latido se lee igual que sin él | passed | 211 |
| `unit/casosClinicos.test.ts` | CAS-04 · PEEP decremental › medir, abrir con PEEP 20 y volver a 11 lo resuelve; sin abrir, no | passed | 210 |
| `unit/casosClinicos.test.ts` | CAS-05 · hipercapnia › la viñeta: PaCO₂ 88 y pH 7,14 de equilibrio (con el bicarbonato de la hipercapnia aguda) | passed | 59 |
| `unit/casosClinicos.test.ts` | CAS-05 · hipercapnia › VT 500 con FR 14 o VT 400 con FR 22 lo resuelven; FR 18 sola no basta; VT 600 se pasa de 8 mL/kg | passed | 246 |
| `unit/casosClinicos.test.ts` | CAS-06 · esfuerzos inefectivos › como en Thille: con soporte 20 cerca de la mitad de los esfuerzos no dispara con VT ≈ 10 mL/kg; con 13 disparan todos con ≈ 6 | passed | 864 |
| `unit/casosClinicos.test.ts` | CAS-06 · esfuerzos inefectivos › la ventilación alveolar cambia mucho menos que el VT: con 12–13 queda en su equilibrio de EPOC y con 20 sólo algo más baja | passed | 882 |
| `unit/casosClinicos.test.ts` | CAS-06 · esfuerzos inefectivos › antes de un minuto tras el último ajuste no se puede juzgar la sincronía | passed | 270 |
| `unit/casosClinicos.test.ts` | CAS-07 · autodisparo por fuga › fuga y latido: con 5 L/min sigue el autodisparo, con 6 cesa; con 8 L/min también, pero se insensibiliza de más | passed | 5028 |
| `unit/casosClinicos.test.ts` | CAS-08 · ciclado tardío › con 5 % el ventilador insufla ≈ 1 s de más; con 25 % termina con la paciente y disparan todos | passed | 192 |
| `unit/circuitoIdentidad.test.ts` | CIR-01 identidad con circuito incompresible › SC-01 con Cc = 0 da la misma traza que sin el campo | passed | 76 |
| `unit/circuitoIdentidad.test.ts` | CIR-01 identidad con circuito incompresible › SC-13 con Cc = 0 da la misma traza que sin el campo | passed | 47 |
| `unit/circuitoIdentidad.test.ts` | CIR-02 PC con circuito compresible › el pulmón recibe lo mismo y el sensor de la máquina ve más flujo | passed | 81 |
| `unit/circuitoIdentidad.test.ts` | CIR-02 PC con circuito compresible › el flujo del sensor nunca supera el tope del actuador: pulmón, fuga y compresión comparten un solo presupuesto | passed | 24 |
| `unit/clockStartup.test.ts` | autopausa no alineada se detiene en el primer paso que alcanza el objetivo | passed | 37 |
| `unit/clockStartup.test.ts` | el calentamiento de SC-12 aplica el sesgo en 10000 ms | passed | 56 |
| `unit/clockStartup.test.ts` | cambiar escenario descarta la autopausa del mundo anterior | passed | 25 |
| `unit/clockStartup.test.ts` | autopausa 0 → 0, una sola vez, también durante calentamiento | passed | 1 |
| `unit/clockStartup.test.ts` | autopausa 1 → 4, una sola vez, también durante calentamiento | passed | 6 |
| `unit/clockStartup.test.ts` | autopausa 12000 → 12000, una sola vez, también durante calentamiento | passed | 12 |
| `unit/clockStartup.test.ts` | autopausa 12001 → 12004, una sola vez, también durante calentamiento | passed | 11 |
| `unit/clockStartup.test.ts` | autopausa 12003 → 12004, una sola vez, también durante calentamiento | passed | 11 |
| `unit/clockStartup.test.ts` | autopausa 12004 → 12004, una sola vez, también durante calentamiento | passed | 8 |
| `unit/clockStartup.test.ts` | SC-02: un único init conserva la pausa y programa perturbaciones desde cero | passed | 18 |
| `unit/clockStartup.test.ts` | SC-12: un único init conserva la pausa y programa perturbaciones desde cero | passed | 11 |
| `unit/clockStartup.test.ts` | sin eventos, calentamiento y avance normal producen el mismo estado | passed | 51 |
| `unit/cobertura.test.ts` | TIM-04 · presupuesto de pasos del reloj › reparte el tiempo acumulado en pasos enteros y guarda el resto | passed | 1 |
| `unit/cobertura.test.ts` | TIM-04 · presupuesto de pasos del reloj › al superar el presupuesto descarta el exceso en vez de dar un salto gigante | passed | 0 |
| `unit/cobertura.test.ts` | TIM-04 · presupuesto de pasos del reloj › un acumulado imposible no produce pasos | passed | 0 |
| `unit/cobertura.test.ts` | DAT-04 · la guarda del denominador de la Cstat › con menos de 1 cmH2O de presión motriz no se publica una compliance inventada | passed | 0 |
| `unit/cobertura.test.ts` | DAT-04 · la guarda del denominador de la Cstat › con presión motriz suficiente devuelve VT dividido por ella, sin redondear | passed | 0 |
| `unit/cobertura.test.ts` | Pmedia y fuga con referencia independiente, no consigo mismas › la presión media publicada es la integral de la curva dibujada, calculada aparte | passed | 93 |
| `unit/cobertura.test.ts` | Pmedia y fuga con referencia independiente, no consigo mismas › la fuga publicada nunca es negativa, ni cuando el pulmón exhala más de lo que recibió | passed | 79 |
| `unit/cobertura.test.ts` | La sesión exportada sólo contiene lo que el motor aceptó › un comando rechazado no entra en el registro exportable | passed | 4 |
| `unit/cobertura.test.ts` | Las teclas booleanas se pueden editar por el mismo camino que las numéricas › seleccionar, girar y confirmar una tecla booleana da el valor interno booleano | passed | 0 |
| `unit/cobertura.test.ts` | Formatos de pantalla y lenguaje del alumno › las unidades se escriben como en el equipo | passed | 0 |
| `unit/cobertura.test.ts` | Formatos de pantalla y lenguaje del alumno › el reloj de sesión no retrocede ni con entradas absurdas | passed | 1 |
| `unit/cobertura.test.ts` | Formatos de pantalla y lenguaje del alumno › la relación I:E se escribe como la lee un clínico | passed | 0 |
| `unit/cobertura.test.ts` | Formatos de pantalla y lenguaje del alumno › los códigos internos se traducen a lenguaje clínico, y lo desconocido no se inventa | passed | 0 |
| `unit/cobertura.test.ts` | Los ejes de las curvas tienen que caber los datos › el suelo del eje de volumen baja hasta el mínimo real | passed | 0 |
| `unit/cobertura.test.ts` | Los ejes de las curvas tienen que caber los datos › sin excursión negativa el suelo se queda en la holgura del 5 % | passed | 0 |
| `unit/cobertura.test.ts` | Los ejes de las curvas tienen que caber los datos › usa escalones legibles sin reservar presión y flujo innecesarios | passed | 0 |
| `unit/cobertura.test.ts` | Los ejes de las curvas tienen que caber los datos › los demás ejes siguen cabiendo sus extremos | passed | 0 |
| `unit/commandHandlers.test.ts` | ARQ-02 · manejadores de comandos › hay exactamente un manejador por tipo de comando declarado en el dominio | passed | 2 |
| `unit/commandHandlers.test.ts` | ARQ-02 · manejadores de comandos › un tipo desconocido se rechaza sin lanzar y sin registrar | passed | 7 |
| `unit/commandHandlers.test.ts` | ARQ-02 · manejadores de comandos › los manejadores sólo ven el contexto: setVentilation y registro pasan por la interfaz | passed | 0 |
| `unit/commandPalette.test.ts` | Paleta de comandos › normaliza mayúsculas y diacríticos | passed | 2 |
| `unit/commandPalette.test.ts` | Paleta de comandos › devuelve todos los comandos en el orden original con la consulta vacía | passed | 0 |
| `unit/commandPalette.test.ts` | Paleta de comandos › encuentra texto con diacríticos ignorados | passed | 0 |
| `unit/commandPalette.test.ts` | Paleta de comandos › requiere que coincidan todos los tokens | passed | 0 |
| `unit/commandPalette.test.ts` | Paleta de comandos › prioriza coincidencias de prefijo y conserva el orden dentro de cada bloque | passed | 0 |
| `unit/commandPalette.test.ts` | Paleta de comandos › incluye las palabras clave en la búsqueda | passed | 0 |
| `unit/commandPalette.test.ts` | Paleta de comandos › no devuelve elementos sin coincidencia | passed | 0 |
| `unit/commands.test.ts` | registro de comandos de la interfaz › no repite identificadores | passed | 1 |
| `unit/commands.test.ts` | registro de comandos de la interfaz › todo data-action de la página y de las plantillas existe en el registro | passed | 1 |
| `unit/commands.test.ts` | registro de comandos de la interfaz › la paleta y los atajos sólo apuntan a comandos registrados y sin duplicados | passed | 0 |
| `unit/commands.test.ts` | registro de comandos de la interfaz › describe el atajo con la tecla visible | passed | 0 |
| `unit/commands.test.ts` | registro de comandos de la interfaz › rechaza identificadores desconocidos | passed | 0 |
| `unit/compensacionVt.test.ts` | VTC-01 · compensación del VT entregado en volumen control › Plimit a mitad de la inspiración: la primera respiración queda corta y las siguientes completan el VT | passed | 57 |
| `unit/compensacionVt.test.ts` | VTC-01 · compensación del VT entregado en volumen control › VT imposible bajo Plimit (R 60, como SC-04): sigue corto y salta «VT no entregado» | passed | 55 |
| `unit/compensacionVt.test.ts` | VTC-01 · compensación del VT entregado en volumen control › al subir Plimit, el flujo vuelve al nominal: VT exacto y sin pausa | passed | 47 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › .alarm-band: texto ≥ 4.5:1 sobre ambos extremos | passed | 3 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › .alarm-band.high: texto ≥ 4.5:1 sobre ambos extremos | passed | 0 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › .alarm-band.medium: texto ≥ 4.5:1 sobre ambos extremos | passed | 0 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › .alarm-band.previous: texto ≥ 4.5:1 sobre ambos extremos | passed | 0 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › el subtítulo de la banda no lleva opacidad: hereda el color medido | passed | 0 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › sin alarmas la banda es verde, como en las pantallas del manual SW10 y en la fotografía P1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-01 · la banda de alarmas contrasta en todos sus estados y en los dos extremos del degradado › la prioridad media es ámbar con texto oscuro, como la celda que alarma | passed | 0 |
| `unit/contraste.test.ts` | CTR-02 · las cifras pequeñas de la columna numérica contrastan sobre el fondo del monitor › .numeric .numeric-age ≥ 6:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-02 · las cifras pequeñas de la columna numérica contrastan sobre el fondo del monitor › .numeric-label ≥ 6:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-02 · las cifras pequeñas de la columna numérica contrastan sobre el fondo del monitor › .numeric-unit ≥ 6:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-02 · las cifras pequeñas de la columna numérica contrastan sobre el fondo del monitor › .numeric .numeric-value .sin-dato ≥ 6:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-03 · la prioridad va en palabras y la luz roja parpadea salvo con «reducir movimiento» › alarmBandLabel antepone la prioridad y respeta los estados sin alarma | passed | 1 |
| `unit/contraste.test.ts` | CTR-03 · la prioridad va en palabras y la luz roja parpadea salvo con «reducir movimiento» › la luz del bisel de prioridad alta lleva animación, y la regla de reducir movimiento la anula | passed | 1 |
| `unit/contraste.test.ts` | CTR-04 · los chips de estado y la procedencia son legibles sobre el monitor › .q-ok: texto ≥ 4.5:1 sobre su fondo | passed | 0 |
| `unit/contraste.test.ts` | CTR-04 · los chips de estado y la procedencia son legibles sobre el monitor › .q-warn: texto ≥ 4.5:1 sobre su fondo | passed | 0 |
| `unit/contraste.test.ts` | CTR-04 · los chips de estado y la procedencia son legibles sobre el monitor › .q-off: texto ≥ 4.5:1 sobre el fondo del monitor | passed | 0 |
| `unit/contraste.test.ts` | CTR-04 · los chips de estado y la procedencia son legibles sobre el monitor › .q-src: texto ≥ 4.5:1 sobre el fondo del monitor | passed | 0 |
| `unit/contraste.test.ts` | CTR-05 · los colores del equipo › la pantalla es azul pizarra: azul dominante pero poco saturado, y su extremo claro es el que miden los contrastes | passed | 0 |
| `unit/contraste.test.ts` | CTR-05 · los colores del equipo › las teclas son de grafito: gris neutro, con rótulo blanco | passed | 0 |
| `unit/contraste.test.ts` | CTR-05 · los colores del equipo › el valor en alarma lleva un borde de la prioridad que se distingue del fondo (≥ 3:1) y la cifra sigue blanca | passed | 0 |
| `unit/contraste.test.ts` | CTR-05 · los colores del equipo › en espera: panel y tecla tostados del equipo (#e7dab8) con texto oscuro legible, y el botón de iniciar naranja | passed | 0 |
| `unit/contraste.test.ts` | CTR-05 · los colores del equipo › las ventanas del equipo son de grafito, como la configuración de alarmas del manual, con texto legible | passed | 0 |
| `unit/contraste.test.ts` | CTR-05 · los colores del equipo › la X roja de una medición de bloqueo sin resultado se lee sobre la ventana (texto grande, ≥ 3:1) | passed | 0 |
| `unit/contraste.test.ts` | CTR-06 · la paleta del monitor, en un solo sitio › declara la paleta medida y ninguna hoja del monitor repite sus colores como literal | passed | 2 |
| `unit/contraste.test.ts` | CTR-06 · la paleta del monitor, en un solo sitio › el canvas usa los mismos valores que la hoja (MON_CSS ↔ --mon-*) | passed | 4 |
| `unit/contraste.test.ts` | CTR-06 · la paleta del monitor, en un solo sitio › los gráficos del exterior usan los mismos valores que su hoja (SHELL_CSS ↔ --shell-*) | passed | 1 |
| `unit/contraste.test.ts` | CTR-06 · la paleta del monitor, en un solo sitio › las curvas, la captura exportada y los diagramas de Fundamentos no escriben colores a mano: vienen de monitorPalette.ts | passed | 2 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › el bisel sigue siendo el que se mide aquí | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-pantalla-claro | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-pantalla | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-pantalla-borde | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-grafito-alto | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-grafito-bajo | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-ventana | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-ventana-barra | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-bloqueo-alto | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-bloqueo-bajo | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-nav-alto | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-nav-bajo | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-reposo-alto | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-reposo-bajo | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-banda-alta-a | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-banda-alta-b | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-banda-previa-a | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre --mon-banda-previa-b | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre el bisel #3a4047 | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › amarillo sobre el bisel #23282d | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › oscuro sobre el ámbar de la banda media y el tostado de la espera | passed | 0 |
| `unit/contraste.test.ts` | CTR-07 · el anillo de foco del equipo contrasta 3:1 donde aparece › el anillo de las hojas del equipo es éste y no otro | passed | 1 |
| `unit/contraste.test.ts` | CTR-08 · los diagramas de Fundamentos contrastan sobre la pizarra › el fondo de los diagramas es la pizarra del monitor | passed | 0 |
| `unit/contraste.test.ts` | CTR-08 · los diagramas de Fundamentos contrastan sobre la pizarra › texto texto (#dbe3ec) ≥ 4.5:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-08 · los diagramas de Fundamentos contrastan sobre la pizarra › texto formula (#e6ecf2) ≥ 4.5:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-08 · los diagramas de Fundamentos contrastan sobre la pizarra › texto resistiva (#ffd27a) ≥ 4.5:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-08 · los diagramas de Fundamentos contrastan sobre la pizarra › texto elastica (#7ce0b8) ≥ 4.5:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-08 · los diagramas de Fundamentos contrastan sobre la pizarra › texto peep (#9fd0f0) ≥ 4.5:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-08 · los diagramas de Fundamentos contrastan sobre la pizarra › texto peepi (#ffb0c8) ≥ 4.5:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-08 · los diagramas de Fundamentos contrastan sobre la pizarra › trazo traza (#ffffff) ≥ 3:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-08 · los diagramas de Fundamentos contrastan sobre la pizarra › trazo inactiva (#7d93ad) ≥ 3:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-08 · los diagramas de Fundamentos contrastan sobre la pizarra › trazo eje (#7d93ad) ≥ 3:1 | passed | 0 |
| `unit/contraste.test.ts` | CTR-08 · los diagramas de Fundamentos contrastan sobre la pizarra › rótulos de las siluetas: apagado sobre su ficha y activo sobre la suya | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › tickCurvas (#dbe3ec) ≥ 4,5:1 sobre #3b4f68 | passed | 2 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › ejeTiempo (#dbe3ec) ≥ 4,5:1 sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › tickBucles (#dbe3ec) ≥ 4,5:1 sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › tickTendencias (#dbe3ec) ≥ 4,5:1 sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › anotacion (#c4e5f2) ≥ 4,5:1 sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › antes (#f3d593) ≥ 4,5:1 sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › referencia (#eed49d) ≥ 4,5:1 sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › marcaPplat (#ffe49a) ≥ 4,5:1 sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › marcaPpico (#ffc9c4) ≥ 4,5:1 sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › marcaEsfuerzo (#e3cdff) ≥ 4,5:1 sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › lineaPeep (#ffd66e) ≥ 4,5:1 sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-03 · el texto de ejes de las gráficas en canvas contrasta sobre el fondo del monitor › lineaVt (#9fd7ff) ≥ 4,5:1 sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-09 · los gráficos del panel claro contrastan sobre blanco › trazo (#111827) ≥ 4,5:1 sobre #ffffff | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-09 · los gráficos del panel claro contrastan sobre blanco › eje (#3f4a57) ≥ 4,5:1 sobre #ffffff | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-09 · los gráficos del panel claro contrastan sobre blanco › esfuerzo (#6b4fd0) ≥ 4,5:1 sobre #ffffff | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › PEEP (#ffd66e99) sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › VT (bucles) (#9fd7ff99) sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › Pmáx (#ff7b7be8) sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › ciclado (#ffd36e90) sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › marcas de inicio y fin (#b4dcf090) sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › referencia en la curva (#edc87eb3) sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › referencia en el bucle (#edc87ecc) sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › bucle previo (#b7c4d4aa) sobre #3b4f68 | passed | 1 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › unión de las congeladas (#c4f5ffaa) sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › cursor A (#ffffffd0) sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › cursor de barrido (#e6ecf288) sobre #3b4f68 | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › PEEP (#ffd66e99) sobre #2c405a | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › VT (bucles) (#9fd7ff99) sobre #2c405a | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › Pmáx (#ff7b7be8) sobre #2c405a | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › ciclado (#ffd36e90) sobre #2c405a | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › marcas de inicio y fin (#b4dcf090) sobre #2c405a | passed | 2 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › referencia en la curva (#edc87eb3) sobre #2c405a | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › referencia en el bucle (#edc87ecc) sobre #2c405a | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › bucle previo (#b7c4d4aa) sobre #2c405a | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › unión de las congeladas (#c4f5ffaa) sobre #2c405a | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › cursor A (#ffffffd0) sobre #2c405a | passed | 0 |
| `unit/contrastePlots.test.ts` | CTR-10 · las líneas de las ayudas contrastan 3:1 sobre la pizarra › cursor de barrido (#e6ecf288) sobre #2c405a | passed | 0 |
| `unit/curvas.test.ts` | CUR-01 · la curva llega a donde dicen el número y la alarma › cada respiración que Pmáx corta se ve tocar Pmáx en la curva | passed | 125 |
| `unit/curvas.test.ts` | CUR-01 · la curva llega a donde dicen el número y la alarma › con el diezmado de antes esos picos no llegaban a la pantalla: la prueba mide algo | passed | 66 |
| `unit/curvas.test.ts` | CUR-01 · la curva llega a donde dicen el número y la alarma › lo que se dibuja no depende de cómo el motor agrupe las muestras en cuadros | passed | 532 |
| `unit/curvas.test.ts` | CUR-01 · la curva llega a donde dicen el número y la alarma › la traza no crece sin tope: guarda 120 s, descarta lo más antiguo y no repite instantes | passed | 7 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › cada escenario declara un descriptor fisiológico verificable | passed | 0 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-01 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 55 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-02 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 52 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-03 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 42 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-04 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 67 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-05 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 64 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-09 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 48 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-18 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 124 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-17 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 92 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-16 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 181 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-15 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 70 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-14 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 42 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-10 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 43 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-12 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 32 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-24 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 101 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-13 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 79 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-19 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 63 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-20 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 41 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-21 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 27 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-22 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 370 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-23 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 35 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-25 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 50 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › SC-P conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 66 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-01 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 56 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-02 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 217 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-03 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 85 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-04 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 44 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-05 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 53 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-06 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 63 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-07 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 623 |
| `unit/curvas.test.ts` | Curvas de todos los escenarios › CC-08 conserva señales válidas y cumple su descriptor tras las perturbaciones | passed | 66 |
| `unit/curvas.test.ts` | Análisis educativo de curvas › calcula ΔP, Ti y τ espiratoria entre dos cursores sin inventar τ con flujos no válidos | passed | 0 |
| `unit/curvas.test.ts` | Análisis educativo de curvas › la escala fija conserva su encuadre pero crece si una señal lo supera | passed | 0 |
| `unit/curvas.test.ts` | Análisis educativo de curvas › marca inicio, ciclado, Ppico, fin espiratorio, esfuerzo y Pplat medida | passed | 0 |
| `unit/curvas.test.ts` | Análisis educativo de curvas › extrae descriptores cuantitativos de una ventana | passed | 0 |
| `unit/curvas.test.ts` | CUR-02 · la escala no cambia de tamaño en mitad del barrido › SC-18: con la escala de cada cuadro el eje encoge a medio barrido; con histéresis nunca, y nada se recorta | passed | 1690 |
| `unit/curvas.test.ts` | CUR-02 · la escala no cambia de tamaño en mitad del barrido › SC-09 igual: al cortar Pmáx las escalas no se desploman a medio barrido | passed | 299 |
| `unit/curvas.test.ts` | CUR-02 · la escala no cambia de tamaño en mitad del barrido › la regla: crece en el acto, y encoge sólo tras una ventana entera y con el barrido en el origen | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › en continuo el eje rotula el tiempo de simulación y el cursor lo recorre de borde a borde | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › en barrido el eje rotula la fase, y el cursor cae en la pasada que se ve a cada lado de la unión | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › la muestra más cercana es la misma que recorriendo la traza entera | passed | 2 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › los dos últimos ciclos se encuentran igual buscando desde el final | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › la respiración de referencia se alinea al inicio del último ciclo visible | passed | 0 |
| `unit/curvas.test.ts` | CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo › el lector no escribe un cero con signo | passed | 0 |
| `unit/curvas.test.ts` | CUR-04 · los rótulos de las marcas no se pisan › en una oclusión Ppico cae en «Inicio», los dos arriba: Ppico baja bajo su punto | passed | 0 |
| `unit/curvas.test.ts` | CUR-04 · los rótulos de las marcas no se pisan › lejos de otro rótulo, o a otra altura, queda encima del punto | passed | 0 |
| `unit/curvas.test.ts` | CUR-04 · los rótulos de las marcas no se pisan › si abajo también choca, se queda en su sitio (no salta a ciegas) | passed | 0 |
| `unit/curvas.test.ts` | CUR-05 · los rótulos de fase no tachan la traza › el alto de la traza se mide en el tramo del rótulo, también con un tramo que lo cruza entero | passed | 0 |
| `unit/curvas.test.ts` | CUR-05 · los rótulos de fase no tachan la traza › SC-09: la PEEP pasa a la altura de «Ciclado» → el rótulo sube por encima de la traza | passed | 0 |
| `unit/curvas.test.ts` | CUR-05 · los rótulos de fase no tachan la traza › sin cruce se queda donde estaba; sin sitio encima, baja; sin sitio en ninguno, no salta | passed | 0 |
| `unit/densidadTiles.test.ts` | DEN · densidad de casillas numéricas › CORE_METRICS tiene las seis casillas de la vista del equipo | passed | 1 |
| `unit/densidadTiles.test.ts` | DEN · densidad de casillas numéricas › cada clave de CORE_METRICS existe en la columna numérica (METRICS) | passed | 0 |
| `unit/effort.test.ts` | Pmus · formas del pulso de esfuerzo › halfSine se conserva: pico a mitad del Ti y cero después | passed | 2 |
| `unit/effort.test.ts` | Pmus · formas del pulso de esfuerzo › riseRelax: subida sinusoidal hasta el pico en Ti y relajación exponencial | passed | 0 |
| `unit/effort.test.ts` | Pmus · formas del pulso de esfuerzo › validateEffort rechaza una forma desconocida y una τ de relajación no positiva | passed | 1 |
| `unit/effort.test.ts` | Pmus · variabilidad determinista respiración a respiración › sin variability (o con fracciones 0) el pulso queda bit a bit periódico | passed | 18 |
| `unit/effort.test.ts` | Pmus · variabilidad determinista respiración a respiración › con ±10 % cada pico queda en rango y los períodos no son todos iguales | passed | 14 |
| `unit/effort.test.ts` | Pmus · variabilidad determinista respiración a respiración › la misma semilla repite la serie; otra semilla la cambia | passed | 11 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › sin `reverse`, pmusAt es idéntico en todas las muestras (bit a bit) | passed | 6 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › la evocada arranca en onset + delayS y hace pico en +tiS, aunque la amplitud espontánea sea 0 | passed | 0 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › con ratio 2 sólo evoca en una de cada dos respiraciones de máquina | passed | 0 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › una notificación nueva sobrescribe la evocada pendiente | passed | 0 |
| `unit/effort.test.ts` | Pmus · disparo reverso (entrainment) › disabled o reverse ausente anulan la evocada; validateEffort acota los campos | passed | 0 |
| `unit/esfuerzoEspiratorio.test.ts` | EA esfuerzo espiratorio › sin el campo o en 0 el pmusAt es idéntico (con y sin variabilidad) | passed | 40 |
| `unit/esfuerzoEspiratorio.test.ts` | EA esfuerzo espiratorio › con expAmplitude la Pmus baja en medio seno negativo y vuelve a 0 | passed | 6 |
| `unit/esfuerzoEspiratorio.test.ts` | EA esfuerzo espiratorio › la forma es continua: /ΔPmus/ entre muestras consecutivas < 1 cmH2O | passed | 1 |
| `unit/esfuerzoP01.test.ts` | P01-01 · el P0.1 implícito y el trabajo del esfuerzo cuentan lo mismo (Telias 2020) › hay escenarios con esfuerzo que comprobar | passed | 2 |
| `unit/esfuerzoP01.test.ts` | P01-01 · el P0.1 implícito y el trabajo del esfuerzo cuentan lo mismo (Telias 2020) › SC-05 · Esfuerzo débil | passed | 22 |
| `unit/esfuerzoP01.test.ts` | P01-01 · el P0.1 implícito y el trabajo del esfuerzo cuentan lo mismo (Telias 2020) › SC-18 · Doble disparo y esfuerzos que no llegan | passed | 5 |
| `unit/esfuerzoP01.test.ts` | P01-01 · el P0.1 implícito y el trabajo del esfuerzo cuentan lo mismo (Telias 2020) › SC-10 · Maniobra inválida | passed | 11 |
| `unit/esfuerzoP01.test.ts` | P01-01 · el P0.1 implícito y el trabajo del esfuerzo cuentan lo mismo (Telias 2020) › SC-19 · Presión de soporte: el paciente manda | passed | 9 |
| `unit/esfuerzoP01.test.ts` | P01-01 · el P0.1 implícito y el trabajo del esfuerzo cuentan lo mismo (Telias 2020) › SC-20 · Ciclado tardío: el ventilador inspira más que el paciente | passed | 10 |
| `unit/esfuerzoP01.test.ts` | P01-01 · el P0.1 implícito y el trabajo del esfuerzo cuentan lo mismo (Telias 2020) › CC-06 · Esfuerzos que no disparan | passed | 26 |
| `unit/esfuerzoP01.test.ts` | P01-01 · el P0.1 implícito y el trabajo del esfuerzo cuentan lo mismo (Telias 2020) › CC-08 · Ciclado tardío en presión de soporte | passed | 5 |
| `unit/esfuerzoP01.test.ts` | P01-01 · el P0.1 implícito y el trabajo del esfuerzo cuentan lo mismo (Telias 2020) › el esfuerzo débil (SC-05) es bajo por las dos medidas | passed | 20 |
| `unit/evidencia.test.ts` | EVI · el registro de evidencia sólo cita lo que existe › identificadores únicos, con forma E-nnn y U-nn, y fuentes únicas | passed | 2 |
| `unit/evidencia.test.ts` | EVI · el registro de evidencia sólo cita lo que existe › cada afirmación lleva su marca D, D-secundario, O, P o U | passed | 4 |
| `unit/evidencia.test.ts` | EVI · el registro de evidencia sólo cita lo que existe › las fuentes citadas están en la lista de fuentes | passed | 1 |
| `unit/evidencia.test.ts` | EVI · el registro de evidencia sólo cita lo que existe › los archivos que la implementan existen | passed | 3 |
| `unit/evidencia.test.ts` | EVI · el registro de evidencia sólo cita lo que existe › las pruebas citadas existen: el archivo, y en él cada identificador; los escenarios, en la lista de escenarios | passed | 2 |
| `unit/evidencia.test.ts` | EVI · el registro de evidencia sólo cita lo que existe › las referencias E-nnn y U-nn de la documentación y del código existen | passed | 11 |
| `unit/exactitudVolumen.test.ts` | VTD-01 · volumen y presiones caben en la especificación del equipo (URM SW10 13-20) › la ganancia del canal de volumen por omisión: 1σ ≤ 2 % y nunca fuera de ± 10 % | passed | 85 |
| `unit/exactitudVolumen.test.ts` | VTD-01 · volumen y presiones caben en la especificación del equipo (URM SW10 13-20) › A/C VC 500 mL, pulmón pasivo y canal por omisión: entregado exacto; medido con media y σ dentro de la cota | passed | 448 |
| `unit/exactitudVolumen.test.ts` | VTD-01 · volumen y presiones caben en la especificación del equipo (URM SW10 13-20) › A/C VC 300 mL, pulmón pasivo y canal por omisión: entregado exacto; medido con media y σ dentro de la cota | passed | 222 |
| `unit/exactitudVolumen.test.ts` | VTD-01 · volumen y presiones caben en la especificación del equipo (URM SW10 13-20) › A/C PC: presión inspiratoria y PEEP dentro de ± 2 cmH₂O del ajuste y con 1σ ≤ 1 (13-20, «Inspired pressure control», «PEEP control») | passed | 155 |
| `unit/examen.test.ts` | EXM · el veredicto de la estimación informa lo correcto cerca de cero › dentro del medio dígito mostrado es exacto, aunque no sea idéntico | passed | 2 |
| `unit/examen.test.ts` | EXM · el veredicto de la estimación informa lo correcto cerca de cero › contra un cero real informa la diferencia absoluta, no un porcentaje | passed | 0 |
| `unit/examen.test.ts` | EXM · el veredicto de la estimación informa lo correcto cerca de cero › lejos de cero informa el porcentaje redondeado | passed | 0 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en ≈ 110 ms, como el Carescape en banco › con válvula ideal la Pva salta a PEEP en un paso y el flujo arranca en su pico | passed | 135 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en ≈ 110 ms, como el Carescape en banco › con la apertura del equipo la Pva parte cerca de la presión alveolar y desciende hasta la PEEP | passed | 142 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en ≈ 110 ms, como el Carescape en banco › el flujo espiratorio alcanza su pico después de abrirse la válvula, no en el primer instante | passed | 47 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en ≈ 110 ms, como el Carescape en banco › la apertura no cambia el volumen espirado ni la PEEP total de forma apreciable | passed | 103 |
| `unit/expValve.test.ts` | VAL-01 · la válvula espiratoria abre en ≈ 110 ms, como el Carescape en banco › una apertura fuera de 0–200 ms se rechaza | passed | 1 |
| `unit/expValve.test.ts` | VAL-02 · la rama espiratoria del equipo frena lo que sale, no lo que entra › con la rama por omisión la Pva queda sobre la PEEP en R_rama·/Q/ mientras se espira | passed | 77 |
| `unit/expValve.test.ts` | VAL-02 · la rama espiratoria del equipo frena lo que sale, no lo que entra › un esfuerzo tardío inhala lo mismo con rama o sin ella: ese gas viene del flujo de base por la rama inspiratoria | passed | 727 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › sin limitación el flujo espiratorio es (Pel − Paw)/Rexp; con ella queda en (Pel − pcrit)/(f·Rexp) | passed | 2 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › es independiente del esfuerzo espiratorio y de la presión aguas abajo: eso es la meseta de flujo | passed | 0 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › con Paw ≥ pcrit no hay colapso y el flujo vuelve a ser el de la ecuación de movimiento | passed | 0 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › durante la limitación el volumen decae hacia C·pcrit con tau = f·Rexp·C, no hacia el volumen de PEEP | passed | 5 |
| `unit/flowLimitation.test.ts` | EFL-01 · limitación al flujo frente a su solución analítica › el resultado no depende del paso de integración | passed | 2 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › con PEEP por debajo del punto crítico el pulmón atrapa hasta que el retroceso iguala pcrit | passed | 494 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › subir la PEEP hasta el punto crítico quita la limitación sin aumentar apenas la PEEP total | passed | 1042 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › sin limitación el mismo pulmón no atrapa nada a PEEP 3 | passed | 84 |
| `unit/flowLimitation.test.ts` | EFL-02 · consecuencias en el ventilador › una limitación fuera de rango se rechaza | passed | 10 |
| `unit/flowLimitation.test.ts` | EFL-03 · resistencia espiratoria dependiente del volumen › la resistencia crece al vaciarse y coincide con la nominal en el volumen de referencia | passed | 0 |
| `unit/flowLimitation.test.ts` | EFL-03 · resistencia espiratoria dependiente del volumen › sin dependencia la relación flujo-volumen es una recta; con ella la rama queda por debajo de la cuerda | passed | 289 |
| `unit/flowLimitation.test.ts` | EFL-03 · resistencia espiratoria dependiente del volumen › una dependencia fuera de rango se rechaza | passed | 1 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › el generador es determinista y acotado: misma semilla, misma secuencia; ganancia dentro de ±fracción | passed | 6 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › fracción 0 devuelve ganancia exacta y no altera la secuencia posterior | passed | 0 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › el VTe mostrado varía ~±2,5 % entre ciclos mientras el volumen verdadero del modelo no cambia | passed | 83 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › VTi y VTe comparten la ganancia del sensor: la fuga mostrada sigue siendo nula | passed | 31 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › el banco analítico no lleva ruido: VTe mostrado = VTe verdadero | passed | 8 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › la reproducción de una sesión repite las mismas lecturas (mismo semilla, misma secuencia) | passed | 44 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › las alarmas de volumen comparan el valor medido, no el verdadero | passed | 19 |
| `unit/flowSensor.test.ts` | SEN-01 · variabilidad del canal de volumen › una variabilidad fuera de 0–10 % se rechaza | passed | 1 |
| `unit/fuga.test.ts` | LEAK-01 · lo entregado no es lo recibido › VC con fuga 4,4 L/min a 10 cmH₂O: VTi es el programado, VTe lo que vuelve, y la diferencia es la fuga | passed | 503 |
| `unit/fuga.test.ts` | LEAK-01 · lo entregado no es lo recibido › sin fuga nada cambia: el registro es el de siempre | passed | 122 |
| `unit/fuga.test.ts` | LEAK-06 · la fuga es un orificio: crece con la raíz de la presión, no en proporción › reproduce la curva presión-flujo publicada de un orificio calibrado (ResMed AirFit F20) con error ≤ 3 % | passed | 1 |
| `unit/fuga.test.ts` | LEAK-06 · la fuga es un orificio: crece con la raíz de la presión, no en proporción › es simétrica: si el nodo queda bajo el ambiente entra aire; sin fuga, nada | passed | 1 |
| `unit/fuga.test.ts` | LEAK-07 · la curva de volumen es la del equipo: con fuga no vuelve a cero › sube a lo entregado, termina la espiración en VTi − VTe y se reinicia al empezar la respiración siguiente | passed | 285 |
| `unit/fuga.test.ts` | LEAK-02 · la PEEP se sostiene mientras el flujo de base cubra la fuga › con base 4 L/min y fuga de 3 a la PEEP la Pva espiratoria queda en 5; con base 2 cae por debajo de 4 | passed | 1522 |
| `unit/fuga.test.ts` | LEAK-03 · autodisparo: el sensor ve la fuga como si fuera el paciente › paciente pasivo, fuga 3 L/min a la PEEP y umbral 2: asistidas; umbral 4: ninguna | passed | 492 |
| `unit/fuga.test.ts` | LEAK-04 · en soporte la fuga retrasa el ciclado: el flujo medido no cae al umbral › la inspiración soportada dura más con fuga que sin ella | passed | 76 |
| `unit/fuga.test.ts` | LEAK-05 · desconexión: sin presión, sin volumen, alarma alta que se resuelve al reconectar › con el circuito abierto Ppico < 1 y VTe ≈ 0; la alarma se activa, y al cerrar el circuito se resuelve y queda por reconocer | passed | 84 |
| `unit/fuga.test.ts` | LEAK-05 · desconexión: sin presión, sin volumen, alarma alta que se resuelve al reconectar › la fuga se valida en 0–60 L/min y la desconexión es booleana | passed | 1 |
| `unit/gasometria.test.ts` | GAS-01 · ecuaciones › equilibrio alveolar y pH de referencia | passed | 2 |
| `unit/gasometria.test.ts` | GAS-01 · ecuaciones › en apnea, pasado el tramo rápido, la PaCO₂ sube 0,863·VCO₂/C mmHg por minuto | passed | 15 |
| `unit/gasometria.test.ts` | GAS-01 · ecuaciones › una respiración menor que el espacio muerto no ventila el alvéolo | passed | 1 |
| `unit/gasometria.test.ts` | GAS-01 · ecuaciones › el espacio muerto fisiológico reproduce las dos medianas de Fletcher y Jonson (0,44 con VT 0,45; 0,31 con 0,75) | passed | 0 |
| `unit/gasometria.test.ts` | GAS-01 · ecuaciones › el gas que mueve un esfuerzo que no dispara entra y sale de la vía aérea: no ventila | passed | 2 |
| `unit/gasometria.test.ts` | GAS-07 · tamponamiento agudo: el bicarbonato sigue a la PaCO₂ en minutos › +1 mEq/L por cada 10 mmHg de hipercapnia aguda y −2 por cada 10 de hipocapnia aguda (reglas de Boston) | passed | 0 |
| `unit/gasometria.test.ts` | GAS-07 · tamponamiento agudo: el bicarbonato sigue a la PaCO₂ en minutos › en el EPOC hipercápnico crónico el bicarbonato habitual es el de su PaCO₂ habitual, no el de 40 | passed | 0 |
| `unit/gasometria.test.ts` | GAS-07 · tamponamiento agudo: el bicarbonato sigue a la PaCO₂ en minutos › el pH de equilibrio usa el bicarbonato de la PaCO₂ de equilibrio | passed | 0 |
| `unit/gasometria.test.ts` | GAS-05 · V̇A del último minuto › una ventilación regular da (VT − VD)·FR en cualquier fase del ciclo | passed | 0 |
| `unit/gasometria.test.ts` | GAS-05 · V̇A del último minuto › en apnea la V̇A baja y llega a 0 cuando las respiraciones salen de la ventana | passed | 0 |
| `unit/gasometria.test.ts` | GAS-02 · banco SC-01: la ventilación del pulmón fija la PaCO₂ › la primera respiración fija el equilibrio y la PaCO₂ se mantiene | passed | 305 |
| `unit/gasometria.test.ts` | GAS-02 · banco SC-01: la ventilación del pulmón fija la PaCO₂ › el CO₂ no realimenta la mecánica: presiones y volúmenes idénticos con otra gasometría | passed | 58 |
| `unit/gasometria.test.ts` | GAS-06 · equilibrio inicial con atrapamiento › se fija con la ventilación ya estable, no con la primera respiración | passed | 111 |
| `unit/gasometria.test.ts` | GAS-03 · cinética: la PaCO₂ sigue a la ventilación con el tramo lento de los tejidos › duplicar la frecuencia lleva la PaCO₂ hacia la mitad y, pasado el tramo rápido, recorre ≈ 63 % en una τ | passed | 487 |
| `unit/gasometria.test.ts` | GAS-03 · cinética: la PaCO₂ sigue a la ventilación con el tramo lento de los tejidos › más espacio muerto con el mismo VT sube la PaCO₂ de equilibrio | passed | 167 |
| `unit/gasometria.test.ts` | GAS-03 · cinética: la PaCO₂ sigue a la ventilación con el tramo lento de los tejidos › el espacio muerto de la vía aérea pesa más con VT bajos; el alveolar, igual con cualquier VT | passed | 1 |
| `unit/gasometria.test.ts` | GAS-04 · validación y reproducción › rechaza valores fuera de rango y claves desconocidas | passed | 1 |
| `unit/gasometria.test.ts` | GAS-04 · validación y reproducción › la sesión reproducida da la misma gasometría | passed | 75 |
| `unit/gasometria.test.ts` | GAS-08 · cinética de dos compartimentos › apnea: el primer minuto sube rápido y después 3,4–4,4 mmHg/min, como en los anestesiados con el tubo ocluido | passed | 31 |
| `unit/gasometria.test.ts` | GAS-08 · cinética de dos compartimentos › en equilibrio la sangre venosa queda ≈ 6 mmHg por encima de la arterial, y en proporción a la producción | passed | 57 |
| `unit/gasometria.test.ts` | GAS-08 · cinética de dos compartimentos › tras una hiperventilación aguda el primer minuto de apnea sube más: el gradiente venoarterial está abierto (Gentz) | passed | 144 |
| `unit/gasometria.test.ts` | GAS-08 · cinética de dos compartimentos › ±10 % de VT: la PaCO₂ apenas se mueve en diez respiraciones y recorre la mayor parte en 20 min; bajando, más lento | passed | 376 |
| `unit/gasometria.test.ts` | GAS-08 · cinética de dos compartimentos › la muestra arterial no oscila con cada respiración; el alvéolo sí | passed | 37 |
| `unit/holdsDosUnidades.test.ts` | Cstat y resistencia insp. con dos unidades en paralelo: válidas y marcadas «aprox.» › bloqueo insp válido en un pulmón de dos unidades: cstat y raw traen reason twoCompartments y quality valid | passed | 67 |
| `unit/holdsDosUnidades.test.ts` | Cstat y resistencia insp. con dos unidades en paralelo: válidas y marcadas «aprox.» › un solo compartimento: mismas muestras sin la marca de aproximación | passed | 25 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › la huella se tomó con esta versión del motor, y sus sesiones se aceptan (U-46) | passed | 1 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › cubre todos los escenarios y ninguno más | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-01 · Banco lineal pasivo | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-02 · Menor distensibilidad | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-03 · Mayor resistencia espiratoria | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-04 · Mayor resistencia inspiratoria | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-05 · Esfuerzo débil | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-09 · Oclusión de ensayo | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-18 · Doble disparo y esfuerzos que no llegan | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-17 · Dos pulmones en uno | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-16 · Espiración estrangulada | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-15 · Titular la PEEP sobre la curva P-V | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-14 · La meseta que sigue bajando | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-10 · Maniobra inválida | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-12 · Sensor de O2 sesgado | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-24 · Disparo reverso | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-13 · Presión control: la misma mecánica, otra variable controlada | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-19 · Presión de soporte: el paciente manda | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-20 · Ciclado tardío: el ventilador inspira más que el paciente | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-21 · Ventilación protectora: la presión de distensión y la potencia | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-22 · Fuga en el circuito: lo que entra no es lo que vuelve | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-23 · Desconexión: sin presión y sin volumen | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-25 · Reclutamiento y PEEP decremental | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › SC-P · Referencia de tus fotografías | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › CC-01 · Presión pico alta | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › CC-02 · Atrapamiento aéreo en EPOC | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › CC-03 · SDRA: volumen corriente protector | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › CC-04 · PEEP decremental tras reclutamiento | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › CC-05 · Hipercapnia con pulmones sanos | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › CC-06 · Esfuerzos que no disparan | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › CC-07 · Autodisparo por fuga | passed | 0 |
| `unit/huella.test.ts` | HUE-01 · la física de cada escenario no cambia sin querer › CC-08 · Ciclado tardío en presión de soporte | passed | 0 |
| `unit/humanize.test.ts` | textos internos del motor › traduce todos los códigos de razón emitidos por engine, history y app | passed | 2 |
| `unit/humanize.test.ts` | textos internos del motor › traduce la mecánica del escenario a etiquetas y capitaliza la frase | passed | 0 |
| `unit/humanize.test.ts` | textos internos del motor › omite la razón user al pausar y no expone comandos internos rechazados | passed | 0 |
| `unit/latido.test.ts` | LAT · oscilación cardiogénica › mueve el flujo al final de la espiración ≈ ±2 L/min, como el grupo sin autodisparo de Imanaka (2,0 ± 0,9) | passed | 176 |
| `unit/latido.test.ts` | LAT · oscilación cardiogénica › la meseta y la PEEP total se leen promediando un ciclo cardíaco: el mismo número que sin latido | passed | 260 |
| `unit/latido.test.ts` | LAT · oscilación cardiogénica › no cuenta como esfuerzo: en un paciente pasivo el bloqueo sigue siendo de mecánica pasiva | passed | 45 |
| `unit/latido.test.ts` | LAT · oscilación cardiogénica › la constante de tiempo se sigue midiendo: la recta se ajusta junto con el latido | passed | 497 |
| `unit/latido.test.ts` | LAT · oscilación cardiogénica › el índice de estrés se lee descontando el latido: el mismo número que sin latido, respiración a respiración | passed | 141 |
| `unit/latido.test.ts` | LAT · oscilación cardiogénica › rechaza frecuencias y amplitudes fuera de rango | passed | 0 |
| `unit/lazyView.test.ts` | secciones cargadas bajo demanda › comparte la carga en curso y no renderiza si se abandona la sección antes de terminar | passed | 16 |
| `unit/lazyView.test.ts` | secciones cargadas bajo demanda › un fallo no vuelve a importar desde render y explica que la recuperación reinicia la simulación | passed | 5 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › dice cuál es y cuántos van | passed | 2 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › el último anuncia la secuencia completa y dónde repasarla | passed | 0 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › un objetivo de texto largo cabe en un aviso de una línea | passed | 0 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › en SC-01 nada se cumple al abrir: el primer bloqueo se anuncia aunque llegue en el primer segundo | passed | 32 |
| `unit/leccion.test.ts` | LEC-01 · cumplir un objetivo se anuncia, salvo lo que ya se cumplía al abrir › en SC-13 el primer objetivo ya se cumple con el primer cuadro visible, y sólo ése se calla | passed | 36 |
| `unit/leccion.test.ts` | LEC-02 · toda tarea nombra una prueba que existe › SC-09 no pide deshacer una perturbación automática que no aparece en Eventos | passed | 0 |
| `unit/leccion.test.ts` | LEC-02 · toda tarea nombra una prueba que existe › cada `test` de cada lección está en la tabla de pruebas | passed | 2 |
| `unit/lienzo.test.ts` | LIE-01 · el lienzo se rehace cuando cambia la densidad de la pantalla › pasa de 1× a 2× y vuelve, sin perder su tamaño lógico | passed | 3 |
| `unit/lienzo.test.ts` | LIE-01 · el lienzo se rehace cuando cambia la densidad de la pantalla › por encima de 2× se queda en 2× (el coste de pintar crece con el cuadrado) | passed | 0 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › con músculo y meseta estable el equipo publica lo que mide; el modelo la marca como no pasiva | passed | 14 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › Aula: las tarjetas conservan el número del equipo y añaden el aviso del modelo sólo con esfuerzo | passed | 15 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › detecta esfuerzo al arranque del bloqueo aunque desaparezca antes de la ventana final | passed | 9 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › control pasivo: Pplat15, Cstat50, deltaP10 | passed | 5 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › Plimit 12: balance por canal y flujo final | passed | 104 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › Plimit 100: balance por canal y flujo final | passed | 147 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › AC_VC: reproducción determinista con fuga y oclusión | passed | 756 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › AC_PC: reproducción determinista con fuga y oclusión | passed | 503 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › CPAP_PS: reproducción determinista con fuga y oclusión | passed | 157 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › oclusión con fuga 0: Paw es presión del nodo, Q ventilador cero | passed | 14 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › oclusión con fuga 6: Paw es presión del nodo, Q ventilador cero | passed | 213 |
| `unit/measurementFidelity.test.ts` | fidelidad de medición: señal, validez y canales › VTi cero no produce porcentaje válido ni una etiqueta UI válida | passed | 2 |
| `unit/measurementFidelity.test.ts` | cierre de coherencia de pausa y SC-18 › pausa estable: conserva presión observada; esfuerzo=false | passed | 8 |
| `unit/measurementFidelity.test.ts` | cierre de coherencia de pausa y SC-18 › pausa estable: conserva presión observada; esfuerzo=true | passed | 10 |
| `unit/measurementFidelity.test.ts` | cierre de coherencia de pausa y SC-18 › pausa: no pierde el esfuerzo inicial aunque la cola y Pmus final sean pasivos | passed | 13 |
| `unit/measurementFidelity.test.ts` | cierre de coherencia de pausa y SC-18 › SC-18: el objetivo acepta la maniobra con esfuerzo tras la perturbación, no cancelaciones ni resultados previos | passed | 109 |
| `unit/measurementFidelity.test.ts` | MED-VTE · el VT espirado es la integral con signo del flujo que ve el sensor › sin fuga, en régimen sale lo que entró: con latido, esfuerzos que no disparan o espiración activa | passed | 3042 |
| `unit/measurementFidelity.test.ts` | MED-VTE · el VT espirado es la integral con signo del flujo que ve el sensor › con el VT programado, el paciente del caso con latido devuelve exactamente lo insuflado | passed | 73 |
| `unit/mecanica.test.ts` | MEC-01 · la resistencia sale de la misma oclusión que la distensibilidad › en el banco lineal da exactamente el número del modelo | passed | 132 |
| `unit/mecanica.test.ts` | MEC-01 · la resistencia sale de la misma oclusión que la distensibilidad › al triplicar la resistencia el número la sigue, y la distensibilidad no se mueve | passed | 86 |
| `unit/mecanica.test.ts` | MEC-01 · la resistencia sale de la misma oclusión que la distensibilidad › la resistencia inspiratoria NO predice el vaciamiento, y por eso la constante se mide aparte | passed | 110 |
| `unit/mecanica.test.ts` | MEC-02 · cuando la resta no mide una resistencia, no se publica un número › en presión control no hay un caudal único que dividir, y se dice | passed | 30 |
| `unit/mecanica.test.ts` | MEC-02 · cuando la resta no mide una resistencia, no se publica un número › con Plimit recortando la entrega tampoco, aunque el modo sea volumen control | passed | 52 |
| `unit/mecanica.test.ts` | MEC-02 · cuando la resta no mide una resistencia, no se publica un número › con esfuerzo durante la rampa la resta ya no es sólo del pulmón | passed | 99 |
| `unit/mecanica.test.ts` | MEC-02 · cuando la resta no mide una resistencia, no se publica un número › si la meseta se rechaza, la resistencia y la constante caen con ella | passed | 118 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › en un compartimento lineal sale exactamente (Rexp + Rrama) × C, sin ninguna maniobra | passed | 66 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › en el obstructivo sale la resistencia espiratoria, que es el triple de la inspiratoria | passed | 15 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › con la espiración estrangulada la recta deja de ajustar y no se publica un número | passed | 214 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › con tejido viscoelástico tampoco: la relajación sigue durante toda la espiración | passed | 74 |
| `unit/mecanica.test.ts` | MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta › si el paciente hace fuerza durante la espiración, el vaciamiento no es pasivo y se dice | passed | 77 |
| `unit/mechanicsPresets.test.ts` | PRE · presets de mecánica del paciente › K₂ crece al bajar el diámetro del TET | passed | 2 |
| `unit/mechanicsPresets.test.ts` | PRE · presets de mecánica del paciente › todos los presets caben en los rangos de sus deslizadores | passed | 1 |
| `unit/mechanicsPresets.test.ts` | PRE · presets de mecánica del paciente › los grupos de paciente cubren cada control fisiológico exactamente una vez | passed | 1 |
| `unit/mechanicsPresets.test.ts` | PRE · presets de mecánica del paciente › 'none' reproduce los valores por omisión (sin viscoelasticidad, sin tubo) | passed | 0 |
| `unit/mechanicsPresets.test.ts` | PRE · el control de compliance actúa también sobre la curva sigmoidea › duplicar C duplica la capacidad de la curva y conserva sus codos | passed | 0 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › no hay frame | passed | 2 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › en espera | passed | 23 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › muestra ausente | passed | 17 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › traduce quality=valid a tono ok y etiqueta «Válido» | passed | 8 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › traduce quality=stale a tono warn y etiqueta «Antiguo» | passed | 6 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › traduce quality=inProgress a tono warn y etiqueta «En curso» | passed | 6 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › traduce quality=invalid a tono warn y etiqueta «No válido» | passed | 26 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › traduce quality=unavailable a tono off y etiqueta «No disponible» | passed | 4 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › abrevia el origen ventilator | passed | 7 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › abrevia el origen airwayModule | passed | 9 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › abrevia el origen procedure | passed | 4 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › abrevia el origen derivedModel | passed | 12 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › abrevia el origen fixture | passed | 12 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › sin bloqueo inspiratorio | passed | 4 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › muestra válida de bloqueo informa el tiempo transcurrido y conserva el detalle completo | passed | 19 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › bloqueo existente sin muestra | passed | 13 |
| `unit/metricStatus.test.ts` | metricStatus · calidad compacta y procedencia › bloqueo inspiratorio no válido | passed | 33 |
| `unit/metricStatus.test.ts` | DATA_TABLE_GROUPS · cobertura de la tabla › incluye todas las mediciones exactamente una vez | passed | 1 |
| `unit/metricasEquipo.test.ts` | MON · FR y VMesp: el último minuto más una respiración › la ventana cubre un minuto entero y no más de una respiración de sobra, a cualquier FR | passed | 733 |
| `unit/metricasEquipo.test.ts` | MON · FR y VMesp: el último minuto más una respiración › tras bajar el VT, el VMesp tarda un minuto en asentarse: a los 30 s va por la mitad del camino | passed | 244 |
| `unit/metricasEquipo.test.ts` | MON · resolución de pantalla del equipo › VMesp en pasos de 0,01 hasta 1 L/min y de 0,1 desde ahí; VT en pasos de 0,1 mL bajo 50 | passed | 0 |
| `unit/metricasEquipo.test.ts` | MON · en alarma, el límite violado se muestra junto al valor › VTesp bajo el límite de 600 mL: la casilla dice «Mín. 600»; sin alarma, nada | passed | 14 |
| `unit/metricasEquipo.test.ts` | MON · en alarma, el límite violado se muestra junto al valor › Pmáx alcanzada: la casilla de Ppico dice «Máx.» con el valor de Pmáx | passed | 26 |
| `unit/numericSteps.test.ts` | pasos numéricos según las reglas del perfil adulto › cruza el escalón de VT de 300 a 325 mL y vuelve a 300 | passed | 1 |
| `unit/numericSteps.test.ts` | pasos numéricos según las reglas del perfil adulto › un campo requerido vacío vuelve al mínimo al decrementar | passed | 0 |
| `unit/numericSteps.test.ts` | pasos numéricos según las reglas del perfil adulto › conserva Off en el mínimo y sube desde Off al mínimo permitido | passed | 0 |
| `unit/numericSteps.test.ts` | pasos numéricos según las reglas del perfil adulto › convierte Off y los límites de VT entre índices del deslizador y valores | passed | 0 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-04 · Plimit recorta la entrega: los tres objetivos se cumplen | passed | 332 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-05 · esfuerzos que no disparan: los tres objetivos se cumplen | passed | 199 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-19 · presión de soporte: espontáneas, PS a 15 y apnea con recuperación | passed | 273 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-20 · ciclado tardío: el Ti supera al esfuerzo hasta subir el ciclaje al 50 % | passed | 79 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-21 · ventilación protectora: ΔP alta, VT reducido con ΔP < 15 y potencia bajo 15 J/min | passed | 153 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-22 · fuga: se ve en la tabla, dispara sola y se calla subiendo el umbral | passed | 1274 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-23 · desconexión: alarma, reconexión que la resuelve y reconocimiento que limpia la banda | passed | 72 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-17 · pendelluft: la meseta corta que se pide es una que el equipo acepta | passed | 417 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › un objetivo que no se cumple ya no bloquea a los que vienen detrás | passed | 5 |
| `unit/objetivos.test.ts` | OBJ · las lecciones se pueden terminar › SC-09 · la lección de alarmas sigue siendo terminable con los límites puestos | passed | 149 |
| `unit/objetivos.test.ts` | ALM · los límites por omisión vigilan sin molestar › ninguno viene en Off salvo la PEEP espiratoria, como en las fotografías | passed | 1 |
| `unit/objetivos.test.ts` | ALM · los límites por omisión vigilan sin molestar › sólo el escenario de asincronías alarma, y por lo que debe | passed | 8150 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-02 · «antes del cambio» rechaza una meseta medida después (el falso logro) | passed | 1 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-02 · la tarea de PEEP exige llegar a 8 y medir la meseta después del ajuste | passed | 0 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-25 · la decremental exige una medida previa a la apertura y otra posterior | passed | 0 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-25 · la medida «dereclutada» deja de contar una vez abierto el pulmón | passed | 0 |
| `unit/objetivos.test.ts` | OBJ · las comparaciones exigen la cronología que piden › SC-02 en el simulador: medir sólo después de los 20 s deja «antes» sin cumplir | passed | 90 |
| `unit/occlusionVariability.test.ts` | la pausa conserva Pmus inicial al cruzar la frontera de un período variable | passed | 28 |
| `unit/oxigenoEquipo.test.ts` | O2-URM · mezclador, sensor y pantalla de FiO2 › el mezclador no salta: de 21 a 90 % llega al 90 % del paso en menos de 30 s, no al instante | passed | 50 |
| `unit/oxigenoEquipo.test.ts` | O2-URM · mezclador, sensor y pantalla de FiO2 › la FiO2 mostrada es la media móvil de 10 s del sensor: un salto se ve como una rampa de 10 s | passed | 79 |
| `unit/patientProfiles.test.ts` | Perfiles del paciente › resuelve los escenarios de referencia y coincide con cada estado propio | passed | 3 |
| `unit/patientProfiles.test.ts` | Perfiles del paciente › compara ignorando claves indefinidas y con tolerancia numérica | passed | 0 |
| `unit/patientProfiles.test.ts` | Perfiles del paciente › genera hints desde los parámetros del escenario | passed | 9 |
| `unit/patientProfiles.test.ts` | Perfiles del paciente › resume bajo el nombre lo que define al perfil: C y R si es pasivo, el esfuerzo si respira | passed | 0 |
| `unit/peepe.test.ts` | PEEPe medida antes de la deflexión de disparo › CPAP/PS con esfuerzo: la PEEPe queda en la PEEP programada, no en el fondo del valle de disparo | passed | 58 |
| `unit/peepe.test.ts` | PEEPe medida antes de la deflexión de disparo › banco pasivo A/C VC: la PEEPe sigue en la PEEP programada (sin regresión) | passed | 48 |
| `unit/physics.test.ts` | PHY-06 · cambiar PEEP conserva el volumen pulmonar; no se suma PEEP dos veces › PEEP 5 → 10: V continuo en el instante del cambio, PEEPe medida sube a 10 y Pplat = 10 + VT/C = 20 | passed | 84 |
| `unit/physics.test.ts` | PHY-06 · cambiar PEEP conserva el volumen pulmonar; no se suma PEEP dos veces › la curva de volumen tidal se reinicia por respiración sin reiniciar el volumen absoluto | passed | 18 |
| `unit/physics.test.ts` | PHY-07 · el vaciamiento determina la auto-PEEP (BM-04 en el motor) › Rexp 30 y Texp corto producen PEEPtot > PEEP; alargar la espiración la reduce | passed | 147 |
| `unit/physics.test.ts` | PHY-08 · R, C y Pmus cambian señales y métricas distintas › subir Rinsp sube Ppico y no Pplat; bajar C sube ambas | passed | 51 |
| `unit/physics.test.ts` | PHY-08 · R, C y Pmus cambian señales y métricas distintas › el esfuerzo dispara respiraciones asistidas (no espontáneas) sólo si supera el trigger | passed | 104 |
| `unit/physics.test.ts` | PHY-10 · dominio de fallo del ensayo › resistencia alta (Rinsp 60) y C baja (5 mL/cmH2O): sin NaN ni infinitos; Pmáx termina la inspiración con volumen parcial | passed | 44 |
| `unit/potencia.test.ts` | POT-01 · VC pasivo: la integral coincide con la solución cerrada y con la fórmula de flujo constante › banco SC-01: energía = PEEP·VT + R·Q·VT + VT²/(2C) = 7,5 cmH₂O·L → 11,0 J/min | passed | 92 |
| `unit/potencia.test.ts` | POT-01 · VC pasivo: la integral coincide con la solución cerrada y con la fórmula de flujo constante › a igual VT, subir la frecuencia sube la potencia casi en proporción; bajar el VT la baja más que en proporción | passed | 133 |
| `unit/potencia.test.ts` | POT-02 · PC pasivo: energía = (PEEP + Pinsp) · VT cuando la presión es constante › BM-03 PC con rampa 0: (5 + 10) · 0,4323 = 6,48 cmH₂O·L por respiración | passed | 91 |
| `unit/potencia.test.ts` | POT-03 · calidad: en espera no hay dato; antes de dos respiraciones, en curso › sigue la ventana de FR y VMesp | passed | 22 |
| `unit/prefs.test.ts` | preferencias de interfaz › usa valores por omisión cuando el JSON está corrupto | passed | 3 |
| `unit/prefs.test.ts` | preferencias de interfaz › descarta una ventana de curvas desconocida sin perder valores válidos | passed | 0 |
| `unit/prefs.test.ts` | preferencias de interfaz › acepta las preferencias de ayudas sólo cuando son booleanas | passed | 1 |
| `unit/prefs.test.ts` | preferencias de interfaz › combina cambios con las preferencias existentes | passed | 1 |
| `unit/prefs.test.ts` | preferencias de interfaz › no lanza si localStorage falla al leer, escribir o borrar | passed | 2 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-01: el resultado del bloqueo conserva su hora y valores tras muchas respiraciones (abrir/cerrar ventana) | passed | 146 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-02: bloqueo con esfuerzo del escenario (SC-10) resulta inválido por meseta perturbada; sin Cstat fabricada | passed | 45 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-03: cancelar dos veces es seguro; ↑O2 restaura una sola vez y respeta una edición del usuario | passed | 183 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › PRC-05: un segundo bloqueo mientras hay uno en cola se rechaza con motivo | passed | 0 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › un bloqueo cancelado en curso deja resultado «cancelled» con duración parcial y no borra el válido anterior del historial | passed | 11 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › resp manual: se pide en cualquier fase y se entrega tras 0,25 s de espiración (URM SW10 7-9) | passed | 18 |
| `unit/procedures.test.ts` | PRC · procedimientos con elegibilidad, cancelación, restauración idempotente y resultado fechado › DAT-04: el comparador rechaza combinar Pplat y VT de respiraciones distintas | passed | 20 |
| `unit/procedures.test.ts` | espera (standby) como transacción › entrar en espera detiene la entrega, las métricas pasan a no disponibles y la numeración continúa al reanudar | passed | 44 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › defaultInit declara el perfil; profileFor resuelve el de referencia y rechaza ids desconocidos | passed | 2 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › el motor rechaza una inicialización cuyo profileId no coincide con el perfil inyectado | passed | 0 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › el motor usa las reglas del perfil inyectado (no un módulo concreto) | passed | 1 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › una sesión sin profileId (anterior a 0.3.3) se importa con el perfil de referencia; un profileId desconocido se rechaza | passed | 31 |
| `unit/profiles.test.ts` | ARQ-01 · perfil inyectado en el motor › una sesión guardada con el identificador anterior al cambio de nombre se importa y se reproduce igual | passed | 57 |
| `unit/proteccion.test.ts` | PROT-01 · el estimador recupera el exponente que se le da › sobre curvas sintéticas acierta a tres decimales | passed | 2 |
| `unit/proteccion.test.ts` | PROT-01 · el estimador recupera el exponente que se le da › con latido descuenta la sinusoide: el mismo exponente en cualquier fase cardíaca | passed | 38 |
| `unit/proteccion.test.ts` | PROT-01 · el estimador recupera el exponente que se le da › con muestras insuficientes devuelve null en vez de un número inventado | passed | 0 |
| `unit/proteccion.test.ts` | PROT-02 · sobre el motor distingue los tres regímenes › un pulmón lineal da exactamente la recta | passed | 64 |
| `unit/proteccion.test.ts` | PROT-02 · sobre el motor distingue los tres regímenes › con sigmoide, subir la PEEP lleva el índice de reclutamiento a sobredistensión | passed | 102 |
| `unit/proteccion.test.ts` | PROT-03 · no se publica cuando la forma no es del pulmón › en presión control no hay rampa a flujo constante | passed | 43 |
| `unit/proteccion.test.ts` | PROT-03 · no se publica cuando la forma no es del pulmón › con esfuerzo del paciente la curva es suya y del ventilador, no del pulmón | passed | 44 |
| `unit/proteccion.test.ts` | PROT-03 · no se publica cuando la forma no es del pulmón › con la presión recortada por un techo la forma ya no es la del pulmón | passed | 30 |
| `unit/proteccion.test.ts` | PROT-03 · no se publica cuando la forma no es del pulmón › y la métrica lo publica como no disponible con su motivo, nunca como válida | passed | 33 |
| `unit/proteccion.test.ts` | PROT-04 · la lectura y la curva de titulación › cada banda del índice tiene su lectura | passed | 23 |
| `unit/proteccion.test.ts` | PROT-04 · la lectura y la curva de titulación › la titulación ordena por PEEP y señala la mejor distensibilidad | passed | 0 |
| `unit/proteccion.test.ts` | PROT-04 · la lectura y la curva de titulación › sin puntos no inventa ninguno | passed | 0 |
| `unit/proteccion.test.ts` | PROT-05 · la lectura no atribuye al pulmón lo que es del circuito › con fuga el índice se muestra pero no se interpreta como reclutamiento (auditoría: 0,84 en un pulmón lineal) | passed | 1137 |
| `unit/proteccion.test.ts` | PROT-05 · la lectura no atribuye al pulmón lo que es del circuito › con circuito compresible tampoco se infiere régimen: la compresión contamina el flujo del pulmón | passed | 192 |
| `unit/rampa.test.ts` | Rampa exponencial en PC › riseMs 200: 90 % del escalón a los 0,2 s, ≈63 % a τ = 0,087 s, sin sobrepasar PEEP + Pinsp | passed | 18 |
| `unit/rampa.test.ts` | Rampa exponencial en PC › riseMs 0: el escalón es inmediato, la primera muestra ya es PEEP + Pinsp | passed | 10 |
| `unit/rangosEquipo.test.ts` | RAN-URM · ajustes › I:E de 1:9 a 4:1 en pasos de 0,1 en las dos partes | passed | 2 |
| `unit/rangosEquipo.test.ts` | RAN-URM · ajustes › Tinsp de respaldo de 0,25 a 15 s: 0,05 hasta 1 s, 0,1 hasta 4 s y 0,25 hasta 15 s | passed | 0 |
| `unit/rangosEquipo.test.ts` | RAN-URM · ajustes › tiempo de apnea de 5 a 60 s: de 1 en 1 hasta 20 y de 5 en 5 después | passed | 0 |
| `unit/rangosEquipo.test.ts` | RAN-URM · ajustes › los valores de fábrica del perfil caen en la rejilla | passed | 0 |
| `unit/rangosEquipo.test.ts` | RAN-URM · límites de alarma › VTesp: de 0,5 en 0,5 mL hasta 20, de 1 hasta 100, de 5 hasta 350, de 25 hasta 1000 y de 50 después | passed | 0 |
| `unit/rangosEquipo.test.ts` | RAN-URM · límites de alarma › VMesp: de 0,01 L/min bajo 1, de 0,1 hasta 10 y de 1 después; sin Off en invasiva | passed | 0 |
| `unit/rangosEquipo.test.ts` | RAN-URM · límites de alarma › FiO2 baja no se apaga; FiO2 alta sí | passed | 3 |
| `unit/rangosEquipo.test.ts` | RAN-URM · límites de alarma › los límites por omisión y los de todos los escenarios caen en la rejilla del equipo | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › el equilibrio escala con la fracción reclutada: V(r) = C·(1 + r·frac)·(P − P0) | passed | 1 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › al arrancar ventilado sólo nace abierto si la distensión ya supera pOpen | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › la banda pClose–pOpen conserva el estado: eso ES la histéresis | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › reclutar baja la presión elástica al mismo volumen y sube la compliance local | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › quitar recruit devuelve la fracción abierta a 0 | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › sin recruit el modelo es exactamente el de siempre | passed | 0 |
| `unit/reclutamiento.test.ts` | RC-01 · modelo de reclutamiento con histéresis › la validación exige 0 < frac ≤ 1, pClose < pOpen y constantes de tiempo en rango | passed | 1 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › sin bloqueo sólo se lee la Ppico; las otras tres dicen qué falta | passed | 99 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › tras un bloqueo válido las cuatro fórmulas cuadran entre sí | passed | 95 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › la Ppico no lleva rango de referencia, porque no tiene uno | passed | 86 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › el veredicto se decide sobre el número que se muestra, no sobre el crudo | passed | 63 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › una meseta alta se marca fuera de su referencia | passed | 28 |
| `unit/resumen.test.ts` | RES · el resumen dice lo mismo que el monitor › con la meseta rechazada no se publica ningún número derivado | passed | 90 |
| `unit/resumen.test.ts` | RES · con atrapamiento aéreo la resta es contra la PEEP total › las identidades de la pantalla cuadran, y el esquema no contradice a la tarjeta | passed | 149 |
| `unit/resumen.test.ts` | RES · con atrapamiento aéreo la resta es contra la PEEP total › el motor dice qué PEEP hay en la resta, y lo dice bien | passed | 70 |
| `unit/review.test.ts` | H1 · ↑O2: ajuste, mezclador y sensor vuelven juntos (regla 1) › fin por temporizador restaura también el mezclador | passed | 424 |
| `unit/review.test.ts` | H1 · ↑O2: ajuste, mezclador y sensor vuelven juntos (regla 1) › fin por espera restaura también el mezclador | passed | 2 |
| `unit/review.test.ts` | H2 · orden manual y disparo en el mismo sub-paso: sin respiraciones apiladas › con esfuerzo fuerte y control asistido, una orden manual produce exactamente una respiración manual y ninguna espiración de un sub-paso | passed | 101 |
| `unit/review.test.ts` | H3 · espera durante un bloqueo espiratorio en curso › no emite respiraciones fantasma, no activa alarmas en espera y el bloqueo queda cancelado | passed | 44 |
| `unit/review.test.ts` | H4 · poner un límite en Off resuelve la alarma activa (Off = no se evalúa, no estado congelado) › VTesp bajo activa → Off → resuelta y reconocida; banda verde | passed | 24 |
| `unit/review.test.ts` | H5 · una inspiración acortada por Pmáx no acorta el periodo obligatorio › FR medida ≈ FR programada aunque cada inspiración termine a 0.8 s por Pmáx | passed | 67 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › el constructor rechaza FR negativa y un paciente con tau < 1 ms | passed | 1 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › requestHold con duración no numérica o fuera de rango se rechaza; setPatient con R diminuta se rechaza | passed | 8 |
| `unit/review.test.ts` | H6 · validación de inicialización, comandos e importación › importSession rechaza ajustes fuera de dominio y pacientes degenerados | passed | 5 |
| `unit/review.test.ts` | H7 · importar una sesión no hereda perturbaciones del escenario previo › tras cargar SC-02 (C cambia a 20 s) e importar una sesión de banco, la C importada permanece | passed | 118 |
| `unit/review.test.ts` | H8 · Pplat de ciclo nunca es válida en una respiración terminada por Pmáx › con pausa programada y Pmáx durante la pausa, pplatCycle es null con motivo endedByPmax | passed | 8 |
| `unit/review.test.ts` | H13 · bloqueo espiratorio con paciente que dispara continuamente › se ejecuta al final de la espiración aunque la termine un disparo, y resulta inválido con motivo | passed | 29 |
| `unit/review.test.ts` | audio en pausa como estado del motor (replay) › audioPause fija audioPauseUntilMs = t + 120 s y el replay lo reproduce | passed | 25 |
| `unit/review3.test.ts` | R3-01 · tope de flujo del actuador en PC sin sobreimpulso ni Pmáx falsa › C 5 mL/cmH₂O, R 0.5, Pmáx 17: la presión no supera PEEP + Pinsp y la inspiración termina por tiempo | passed | 115 |
| `unit/review3.test.ts` | R3-01 · tope de flujo del actuador en PC sin sobreimpulso ni Pmáx falsa › la Ppico con tope activo no depende del paso de integración (4 ms vs 1 ms) | passed | 109 |
| `unit/review3.test.ts` | R3-02 · el VTi nunca es negativo en PC tras bajar la PEEP › PEEP 10 → 5 con Pinsp 3: el volumen que sale cuenta como espirado | passed | 26 |
| `unit/review3.test.ts` | R3-03 · flujo de base espiratorio: el esfuerzo hunde la Pva y no inhala sin límite › sin asistencia, un esfuerzo de 8 cmH₂O en espiración baja la Pva por debajo de PEEP y VTe − VTi queda acotado por el flujo de base | passed | 209 |
| `unit/review3.test.ts` | R3-03 · flujo de base espiratorio: el esfuerzo hunde la Pva y no inhala sin límite › con asistencia, el mismo esfuerzo sigue disparando por flujo (2 L/min) | passed | 31 |
| `unit/review3.test.ts` | R3-04 · aviso «Presión limitada por Plimit» › con Plimit 7 el cuadro marca «limitado por Plimit» y salta la alarma media del equipo; al subir Plimit los dos desaparecen | passed | 29 |
| `unit/review3.test.ts` | R3-04 · aviso «Presión limitada por Plimit» › Plimit por encima de Pmáx se acepta con aviso no bloqueante | passed | 0 |
| `unit/review3.test.ts` | R3-05 · Cstat del bloqueo inspiratorio usa PEEPtot cuando hay bloqueo espiratorio válido › con atrapamiento (Rexp 30, FR 30) la Cstat vuelve a 50 mL/cmH₂O tras medir PEEPtot | passed | 99 |
| `unit/review3.test.ts` | R3-05 · Cstat del bloqueo inspiratorio usa PEEPtot cuando hay bloqueo espiratorio válido › tras cambiar la mecánica la PEEPtot medida antes no contamina la Cstat nueva (auditoría: publicaba 118,9) | passed | 67 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › confirmSettings rechaza claves desconocidas y modos inexistentes sin tocar los ajustes | passed | 1 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › el constructor rechaza esfuerzo y sensores no finitos o fuera de rango | passed | 10 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › la duración del bloqueo debe estar en la rejilla de su tipo (insp 2–40, esp 2–60) | passed | 0 |
| `unit/review3.test.ts` | R3-06 · fronteras: claves, modo, esfuerzo, sensores, duración de bloqueo y espera › pasar a espera durante un bloqueo lo cierra con motivo «cancelledByStandby», no «cancelado por el usuario» | passed | 8 |
| `unit/review3.test.ts` | R3-07 · sesiones: PC se reimporta; versiones de motor aceptadas o rechazadas de forma explícita › una sesión en A/C PC exporta e importa sin error | passed | 10 |
| `unit/review3.test.ts` | R3-07 · sesiones: PC se reimporta; versiones de motor aceptadas o rechazadas de forma explícita › engineVersion 0.2.0 se acepta con aviso; 0.1.0 se rechaza; esfuerzo absurdo en init se rechaza | passed | 3 |
| `unit/review3.test.ts` | R3-08 · un arranque fallido nunca es silencioso › el anfitrión responde initError y el cliente lo notifica por onDegraded | passed | 1 |
| `unit/review3.test.ts` | R3-08 · un arranque fallido nunca es silencioso › una orden pendiente al degradar el Worker se responde como rechazada en vez de quedar colgada | passed | 14 |
| `unit/review3.test.ts` | R3-09 · bloqueo inspiratorio rechazado por Pmáx queda registrado › SC-09-like (Rinsp 400): resultado inválido, con motivo y hora | passed | 76 |
| `unit/review4.test.ts` | R4-01 · ningún número no finito sale como válido › un tramo de duración nula no produce NaN, ni siquiera con elastancia viscoelástica cero | passed | 2 |
| `unit/review4.test.ts` | R4-01 · ningún número no finito sale como válido › el barrido de dos unidades con Plimit ya no diverge a ningún paso | passed | 590 |
| `unit/review4.test.ts` | R4-01 · ningún número no finito sale como válido › si el modelo divergiera, la métrica se publica como inválida y queda un evento en el registro | passed | 114 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › con la válvula cerrada ninguna unidad sortea la resistencia en serie | passed | 0 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › el tope de flujo del actuador acota el flujo TOTAL, no sólo el de una rama | passed | 0 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › en presión control con dos unidades el flujo pico respeta el tope del actuador | passed | 214 |
| `unit/review4.test.ts` | R4-02 · el circuito y el tope del ventilador son restricciones del nodo › el flujo de base acota lo que el paciente puede inhalar en espiración también con dos unidades | passed | 428 |
| `unit/review4.test.ts` | R4-03 · lo que se publica es lo que se mide › durante una oclusión la Pva es la del nodo, no la de una unidad | passed | 24 |
| `unit/review4.test.ts` | R4-03 · lo que se publica es lo que se mide › la curva de volumen suma las dos unidades: coincide con el VT entregado | passed | 18 |
| `unit/review4.test.ts` | R4-04 · órdenes de banco que dejan el estado coherente › fijar el volumen absoluto no inventa presión viscoelástica ni descuadra el total | passed | 29 |
| `unit/review4.test.ts` | R4-04 · órdenes de banco que dejan el estado coherente › quitar la segunda unidad conserva el gas en vez de hacerlo desaparecer | passed | 41 |
| `unit/review4.test.ts` | R4-04 · órdenes de banco que dejan el estado coherente › al reanudar tras espera la primera Cstat usa la PEEP y no cero | passed | 57 |
| `unit/review4.test.ts` | R4-05 · el elástico se describe con una sola función › la presión de equilibrio coincide con la meseta real de una oclusión larga, también con sigmoide | passed | 122 |
| `unit/review4.test.ts` | R4-06 · la forma cerrada del nodo coincide con la bisección › con ramas lineales el nodo resuelto en forma cerrada da el mismo flujo total pedido | passed | 1 |
| `unit/review4.test.ts` | R4-06 · la forma cerrada del nodo coincide con la bisección › con ramas no lineales cae a la bisección y sigue invirtiendo | passed | 1 |
| `unit/review4.test.ts` | R4-07 · el solucionador del nodo no se dispara › con ramas lineales el nodo se resuelve en forma cerrada: cero bisecciones | passed | 21 |
| `unit/review4.test.ts` | R4-07 · el solucionador del nodo no se dispara › la combinación más costosa se mantiene acotada | passed | 4861 |
| `unit/review5.test.ts` | R5-01 · el criterio de meseta es monótono en la duración de la oclusión › esperar más nunca empeora la tasa de deriva medida | passed | 8 |
| `unit/review5.test.ts` | R5-01 · el criterio de meseta es monótono en la duración de la oclusión › con dos unidades muy dispares, el bloqueo corto se rechaza y el largo se acepta | passed | 528 |
| `unit/review5.test.ts` | R5-02 · la métrica no puede contradecir a la curva › el Ppico publicado aparece en alguna muestra de la pantalla | passed | 40 |
| `unit/review5.test.ts` | R5-03 · la espiración tiene techo de máquina › ninguna combinación deja pasar más flujo espiratorio del que abre la válvula | passed | 57 |
| `unit/review5.test.ts` | R5-04 · un solo elástico › el volumen de equilibrio es el inverso exacto de la presión elástica, también fuera del codo | passed | 9 |
| `unit/review5.test.ts` | R5-04 · un solo elástico › con sigmoide estrecha y PEEP alta el pulmón arranca exactamente en la PEEP | passed | 0 |
| `unit/review5.test.ts` | R5-05 · conmutar la segunda unidad no crea ni destruye gas › añadirla reparte el gas que hay en vez de inventar el suyo | passed | 16 |
| `unit/review5.test.ts` | R5-05 · conmutar la segunda unidad no crea ni destruye gas › quitarla une su gas al que queda | passed | 24 |
| `unit/review5.test.ts` | R5-06 · el contrato de calidad también cubre los procedimientos › la guarda de finitud anula el valor y quita la calidad válida | passed | 0 |
| `unit/review5.test.ts` | R5-06 · el contrato de calidad también cubre los procedimientos › con el modelo divergido ningún valor del bloqueo sale válido | passed | 60 |
| `unit/review5.test.ts` | R5-07 · Plimit protege sin dejar de ventilar › dentro de un tramo actúa el umbral que se cruza antes, que es el más bajo | passed | 0 |
| `unit/review5.test.ts` | R5-07 · Plimit protege sin dejar de ventilar › con Pmáx por debajo de Plimit, o iguales, manda Pmáx | passed | 0 |
| `unit/review5.test.ts` | R5-07 · Plimit protege sin dejar de ventilar › el volumen entregado decrece de forma continua al subir la resistencia | passed | 383 |
| `unit/review5.test.ts` | R5-07 · Plimit protege sin dejar de ventilar › con Pmáx por debajo de Plimit manda Pmáx, que es la acción de seguridad | passed | 27 |
| `unit/review6.test.ts` | R6-01 · un número que no lo es no puede congelar el motor › una velocidad no finita se rechaza con motivo en vez de dejar el reloj en NaN | passed | 7 |
| `unit/review6.test.ts` | R6-01 · un número que no lo es no puede congelar el motor › una autopausa no finita se rechaza igual | passed | 1 |
| `unit/review6.test.ts` | R6-02 · ninguna promesa del cliente queda colgada › exportar sin simulación responde en vez de esperar para siempre | passed | 1 |
| `unit/review6.test.ts` | R6-02 · ninguna promesa del cliente queda colgada › una exportación pendiente al degradar el Worker se resuelve como fallo | passed | 58 |
| `unit/review6.test.ts` | R6-02 · ninguna promesa del cliente queda colgada › si el Worker muere con la sesión en marcha, el respaldo reinicia pausado y lo anuncia (auditoría) | passed | 40 |
| `unit/review6.test.ts` | R6-02 · ninguna promesa del cliente queda colgada › una importación pendiente al degradar se resuelve con el motivo, no con silencio | passed | 13 |
| `unit/review7.test.ts` | R7-01 · la PEEP total no se certifica mientras sigue subiendo › en un pulmón que redistribuye despacio una oclusión corta se rechaza con motivo | passed | 651 |
| `unit/review7.test.ts` | R7-01 · la PEEP total no se certifica mientras sigue subiendo › alargando la oclusión el mismo pulmón sí da una PEEP total, y ya casi no le falta nada | passed | 780 |
| `unit/review7.test.ts` | R7-01 · la PEEP total no se certifica mientras sigue subiendo › un pulmón que vacía rápido no paga el criterio: a los 2 s ya está asentado | passed | 537 |
| `unit/review7.test.ts` | R7-01 · la PEEP total no se certifica mientras sigue subiendo › el listón del bloqueo espiratorio es más estrecho que el del inspiratorio, y eso es deliberado | passed | 0 |
| `unit/review7.test.ts` | R7-02 · si la lección pide un bloqueo espiratorio, dice cuánto tiene que durar › todo objetivo «validExp» se cumple con la duración que su propio texto nombra | passed | 235 |
| `unit/review7.test.ts` | R7-03 · un límite recién puesto se compara enseguida con lo último medido › subir el límite de VTesp bajo por encima de lo entregado alarma sin esperar a la respiración siguiente | passed | 82 |
| `unit/review7.test.ts` | R7-03 · un límite recién puesto se compara enseguida con lo último medido › bajarlo otra vez lo resuelve igual de rápido | passed | 58 |
| `unit/review7.test.ts` | R7-03 · un límite recién puesto se compara enseguida con lo último medido › en espera no se inventa una alarma con la última respiración de antes | passed | 24 |
| `unit/review7.test.ts` | R7-04 · lo que la tarea dice que se verá es lo que se ve › SC-02 · la PEEP que la tarea nombra deja sitio bajo Pmáx; la que descarta, no | passed | 216 |
| `unit/review7.test.ts` | R7-04 · lo que la tarea dice que se verá es lo que se ve › SC-13 · en PC el VT que devuelve I:E 1:1 es el de la mecánica nueva, no el de antes | passed | 145 |
| `unit/security.test.ts` | SEC-01 · inspección estática: sin WebUSB/WebSerial/Bluetooth ni conexiones externas en el código fuente › ninguna referencia a navigator.usb/serial/bluetooth, WebSocket, fetch externo ni eval | passed | 18 |
| `unit/security.test.ts` | SEC-01 · inspección estática: sin WebUSB/WebSerial/Bluetooth ni conexiones externas en el código fuente › sin dependencias de ejecución en package.json (aplicación local, sin backend) | passed | 0 |
| `unit/session.test.ts` | TIM · reproducibilidad › TIM-02: misma inicialización y comandos → mismos registros de respiración | passed | 162 |
| `unit/session.test.ts` | TIM · reproducibilidad › TIM-01: la cadencia de lectura de cuadros no altera la fisiología | passed | 67 |
| `unit/session.test.ts` | TIM · reproducibilidad › setPatient y setEffort reemplazan mecánica opcional y se reproducen desde la sesión | passed | 13 |
| `unit/session.test.ts` | TIM · reproducibilidad › rechaza reemplazos parciales de paciente y esfuerzo | passed | 0 |
| `unit/session.test.ts` | SEC-03 · importación robusta › rechaza JSON malformado, tamaño excesivo, comandos no permitidos, números no finitos y claves desconocidas | passed | 5 |
| `unit/session.test.ts` | SEC-03 · importación robusta › rechaza un paciente incompleto y campos opcionales nulos sin lanzar excepciones (auditoría) | passed | 4 |
| `unit/session.test.ts` | SEC-03 · importación robusta › rechaza replace no booleano en comandos de sesión importados | passed | 3 |
| `unit/session.test.ts` | SEC-03 · importación robusta › la reproducción hasta t no aplica comandos previstos para después de t | passed | 205 |
| `unit/shellContrast.test.ts` | contraste del tema exterior › mantiene una relación WCAG 2 de al menos 4.5:1 | passed | 1 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › está anclada en V(P0) = 0 y es su propia inversa en todo el intervalo útil | passed | 1 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › la compliance máxima vale b/(4d) en P = c y es simétrica alrededor de ese punto | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › el mismo incremento de volumen cuesta mucha más presión arriba que en la zona media: eso es el pico de sobredistensión | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › por encima de la capacidad la presión sigue siendo finita y monótona (extensión tangente) | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-01 · la sigmoide contra su forma analítica › sin sigmoide el modelo sigue siendo lineal | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-02 · titulación de PEEP sobre la sigmoide › la compliance medida dibuja una U invertida: baja colapsada, máxima cerca de c y baja otra vez por sobredistensión | passed | 194 |
| `unit/sigmoid.test.ts` | SIG-02 · titulación de PEEP sobre la sigmoide › el volumen inicial de equilibrio usa la sigmoide, no la compliance lineal | passed | 1 |
| `unit/sigmoid.test.ts` | SIG-02 · titulación de PEEP sobre la sigmoide › una sigmoide fuera de rango se rechaza | passed | 3 |
| `unit/sigmoid.test.ts` | SIG-03 · los parámetros de SC-15 caen dentro de lo publicado (E-125) › compliance máxima dentro de una desviación de 67 ± 18 mL/cmH₂O, y es la de la curva del motor | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-03 · los parámetros de SC-15 caen dentro de lo publicado (E-125) › capacidad dentro de una desviación de 1836 ± 680 mL | passed | 0 |
| `unit/sigmoid.test.ts` | SIG-03 · los parámetros de SC-15 caen dentro de lo publicado (E-125) › codos en c ∓ 1,317·d: 11,4 y 24,6 cmH₂O, los que cita el escenario | passed | 0 |
| `unit/soporte.test.ts` | PHY-03a · con esfuerzo, el paciente manda: espontáneas a PEEP + PS cicladas por flujo › todas las respiraciones son espontáneas, la Ppico es PEEP + PS y terminan al 25 % del flujo pico | passed | 249 |
| `unit/soporte.test.ts` | PHY-03a · con esfuerzo, el paciente manda: espontáneas a PEEP + PS cicladas por flujo › el ciclaje espiratorio gobierna el Ti: 50 % acorta la inspiración frente a 25 %, y una resistencia alta la alarga (ciclado tardío) | passed | 459 |
| `unit/soporte.test.ts` | PHY-03a · con esfuerzo, el paciente manda: espontáneas a PEEP + PS cicladas por flujo › cuando el flujo no cae al umbral, el tope de tiempo del soporte corta la inspiración | passed | 39 |
| `unit/soporte.test.ts` | PHY-03b · respaldo: apnea con alarma y respiraciones por presión; frecuencia mínima › sin esfuerzo: apnea a los 20 s (alarma alta), respaldo a PEEP + Pinsp de respaldo durante Tinsp de respaldo, a 12/min | passed | 58 |
| `unit/soporte.test.ts` | PHY-03b · respaldo: apnea con alarma y respiraciones por presión; frecuencia mínima › cuando el paciente vuelve a disparar, la apnea se resuelve pero el respaldo sigue hasta que se confirma el modo | passed | 56 |
| `unit/soporte.test.ts` | PHY-03b · respaldo: apnea con alarma y respiraciones por presión; frecuencia mínima › un ajuste rápido (FiO2) no termina el respaldo: sólo confirmar el modo | passed | 33 |
| `unit/soporte.test.ts` | PHY-03b · respaldo: apnea con alarma y respiraciones por presión; frecuencia mínima › respaldo por VMesp: en CPAP/PS, un VMesp bajo la mitad de su límite bajo pasa al respaldo aunque haya disparos | passed | 111 |
| `unit/soporte.test.ts` | PHY-03b · respaldo: apnea con alarma y respiraciones por presión; frecuencia mínima › frecuencia mínima 10/min con paciente a 6/min: entran obligatorias por presión entre las espontáneas y no hay apnea | passed | 64 |
| `unit/soporte.test.ts` | PHY-03c · validación y cambio de modo › PEEP + PS y PEEP + Pinsp de respaldo deben quedar bajo Pmáx; el ciclaje sólo admite su rejilla de 5 % | passed | 0 |
| `unit/soporte.test.ts` | PHY-03c · validación y cambio de modo › al pasar de A/C VC a CPAP/PS con paciente activo no se cuela la obligatoria del temporizador: se espera al paciente | passed | 61 |
| `unit/soporte.test.ts` | PHY-03c · validación y cambio de modo › una sesión de un motor anterior sin los ajustes de CPAP/PS se importa completándolos con el valor por omisión | passed | 5 |
| `unit/soporte.test.ts` | SUP-URM · ciclado por presión, rampa propia y Tsupp del equipo › si algo empuja el gas de vuelta de golpe (tos), la inspiración termina al pasar PEEP + PS + 2,5 cmH₂O | passed | 144 |
| `unit/soporte.test.ts` | SUP-URM · ciclado por presión, rampa propia y Tsupp del equipo › la rampa del soporte llega al 90 % de PS en el tiempo programado, como define el equipo la PS Rise Time | passed | 9 |
| `unit/soporte.test.ts` | SUP-URM · ciclado por presión, rampa propia y Tsupp del equipo › Tsupp: el tope de la inspiración soportada es 4 s en adultos | passed | 0 |
| `unit/soporte.test.ts` | PHY-03d · retardos del respaldo › tras confirmar el modo, la apnea vuelve a alarmar enseguida pero el respaldo espera 10 s | passed | 74 |
| `unit/soporte.test.ts` | PHY-03d · retardos del respaldo › por VMesp, tras confirmar el modo el respaldo no vuelve antes de 60 s aunque el VMesp siga bajo | passed | 694 |
| `unit/soporte.test.ts` | PHY-03d · retardos del respaldo › los plazos: 10 s desde el fin del respaldo para las dos causas, y desde el modo 10 s la apnea y 60 s el VMesp | passed | 59 |
| `unit/sync.test.ts` | SYN-01 · flujo de base programable › con flujo de base 10 L/min el paciente toma hasta 10 L/min sin hundir la Pva; con 2 L/min la hunde antes | passed | 323 |
| `unit/sync.test.ts` | SYN-01 · flujo de base programable › el disparo por flujo no puede superar el flujo de base (motivo legible) | passed | 0 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › con umbral −2 cmH₂O el esfuerzo dispara asistidas; con −10 no llega y las respiraciones siguen siendo mandatorias | passed | 105 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › todo el rango de umbral admitido dispara cuando el esfuerzo lo alcanza (regresión: −3 o menos quedaban inertes) | passed | 223 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › con el circuito abierto la espiración nunca sostiene PEEP y el esfuerzo no dispara (guarda LEAK-05) | passed | 90 |
| `unit/sync.test.ts` | SYN-02 · disparo por presión › el disparo por presión ignora el umbral de flujo (flujo de disparo alto no bloquea) | passed | 68 |
| `unit/sync.test.ts` | SYN-03 · resistencia de la rama espiratoria › con 3 cmH₂O·s/L la Pva queda por encima de PEEP al inicio de la espiración y el flujo pico espiratorio baja; el VT espirado se conserva | passed | 184 |
| `unit/sync.test.ts` | SYN-03 · resistencia de la rama espiratoria › se valida en 0–6 y se conserva en la sesión | passed | 1 |
| `unit/sync.test.ts` | SYN-04 · retardo de respuesta del disparo: el trabajo de disparo aparece en la curva de presión › la respiración empieza 40 ms después de cruzar el umbral, por flujo o por presión; en ese lapso la Pva cae bajo PEEP | passed | 471 |
| `unit/sync.test.ts` | SYN-04 · retardo de respuesta del disparo: el trabajo de disparo aparece en la curva de presión › del inicio del esfuerzo a la presurización, como el banco de Thille 2009: < 50 ms con esfuerzo fuerte, más con débil o por presión | passed | 134 |
| `unit/sync.test.ts` | SYN-04 · retardo de respuesta del disparo: el trabajo de disparo aparece en la curva de presión › más flujo de base o menos esfuerzo, menos trabajo de disparo; el disparo por presión lo multiplica | passed | 639 |
| `unit/sync.test.ts` | SYN-04 · retardo de respuesta del disparo: el trabajo de disparo aparece en la curva de presión › sin disparo asistido la espiración termina por el temporizador y la caída del esfuerzo queda contenida | passed | 172 |
| `unit/sync.test.ts` | SYN-05 · presurización del soporte como en el banco de Thille 2009: el lazo de presión tiene ganancia finita › retardo inspiratorio medio bajo 70 ms y bajo 100 ms en el peor caso, como el Engström (media de 13 equipos: 94 ms) | passed | 0 |
| `unit/sync.test.ts` | SYN-05 · presurización del soporte como en el banco de Thille 2009: el lazo de presión tiene ganancia finita › la Pva tarda más en volver sobre la PEEP cuanto más tira el paciente y menos cuanto mayor es el soporte | passed | 0 |
| `unit/sync.test.ts` | SYN-05 · presurización del soporte como en el banco de Thille 2009: el lazo de presión tiene ganancia finita › el producto presión-tiempo de 0,3 s queda en el rango del banco y sube con el soporte | passed | 1 |
| `unit/sync.test.ts` | SYN-05 · presurización del soporte como en el banco de Thille 2009: el lazo de presión tiene ganancia finita › la fuente ideal (ganancia 0, banco analítico) vuelve sobre la PEEP en el mismo instante del disparo | passed | 62 |
| `unit/teachingHonesty.test.ts` | ΔP mostrada 14.9 respeta el criterio exclusivo <15 | passed | 72 |
| `unit/teachingHonesty.test.ts` | ΔP mostrada 15 respeta el criterio exclusivo <15 | passed | 47 |
| `unit/teachingHonesty.test.ts` | ΔP mostrada 15.1 respeta el criterio exclusivo <15 | passed | 65 |
| `unit/teachingHonesty.test.ts` | b≈1 describe la forma global sin excluir procesos regionales | passed | 22 |
| `unit/teachingHonesty.test.ts` | SC-04 declara práctica del ajuste, sin certificar un efecto | passed | 2 |
| `unit/teachingHonesty.test.ts` | SC-22: el objetivo del disparo exige que el autodisparo cese, no sólo el ajuste | passed | 2658 |
| `unit/temporizacion.test.ts` | TMP-01 · la respiración siguiente llega a su hora › Pmáx acorta cada inspiración y las obligatorias siguen cada 60/FR s | passed | 82 |
| `unit/temporizacion.test.ts` | TMP-01 · la respiración siguiente llega a su hora › bloqueo inspiratorio de 2 s: Ti + bloqueo + Texp completo; después, el ritmo de siempre | passed | 54 |
| `unit/temporizacion.test.ts` | TMP-01 · la respiración siguiente llega a su hora › bloqueo espiratorio de 2 s: al terminar empieza la siguiente | passed | 56 |
| `unit/tokens.test.ts` | tokens CSS › declara todas las propiedades personalizadas usadas por las parciales | passed | 1 |
| `unit/tokens.test.ts` | tokens CSS › centraliza los neutros fusionados de 08-minimal.css en sus tokens | passed | 1 |
| `unit/tokens.test.ts` | tokens CSS › no redefine un selector dentro de la misma hoja ni reparte más de los ya conocidos entre hojas | passed | 1 |
| `unit/tokens.test.ts` | tokens CSS › reserva !important para [hidden], movimiento reducido e impresión | passed | 22 |
| `unit/tokens.test.ts` | tokens CSS › usa la escala --type-* en el exterior en vez de px sueltos | passed | 0 |
| `unit/twoCompartment.test.ts` | PEN-01 · pendelluft con el circuito ocluido › el gas pasa de la unidad rápida a la lenta y las presiones convergen con tau = (R1+R2)·C1·C2/(C1+C2) | passed | 56 |
| `unit/twoCompartment.test.ts` | PEN-01 · pendelluft con el circuito ocluido › el reparto no depende del paso de integración | passed | 9 |
| `unit/twoCompartment.test.ts` | PEN-01 · pendelluft con el circuito ocluido › la presión del nodo con flujo impuesto es la media ponderada por las conductancias | passed | 1 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › el vaciamiento deja de ser una sola exponencial: al final domina la constante lenta | passed | 342 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › la meseta de una oclusión depende de su duración: el pendelluft sigue moviendo gas | passed | 236 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › con una sola unidad la meseta no depende de la duración | passed | 147 |
| `unit/twoCompartment.test.ts` | PEN-02 · consecuencias en las curvas › el volumen absoluto del panel docente suma las dos unidades | passed | 26 |
| `unit/twoCompartment.test.ts` | PEN-03 · SC-17: la meseta, la Cstat y la resistencia aparente dependen de la oclusión › con 2 s la presión aún cae demasiado deprisa: el equipo no da la meseta por válida | passed | 143 |
| `unit/twoCompartment.test.ts` | PEN-03 · SC-17: la meseta, la Cstat y la resistencia aparente dependen de la oclusión › entre 4 y 15 s la meseta baja alrededor de 1 cmH₂O (pendelluft) | passed | 0 |
| `unit/twoCompartment.test.ts` | PEN-03 · SC-17: la meseta, la Cstat y la resistencia aparente dependen de la oclusión › la Cstat sale baja y se acerca a la del pulmón (60 mL/cmH₂O) con la oclusión larga; la resistencia aparente, más del doble | passed | 0 |
| `unit/typeScale.test.ts` | escala tipográfica del monitor › no declara tamaños en px inferiores a 10 fuera de la serigrafía | passed | 4 |
| `unit/typeScale.test.ts` | TIP-02 · una sola escala tipográfica para el monitor › once pasos crecientes, ninguno bajo 10 px, iguales en la hoja y en el canvas | passed | 1 |
| `unit/typeScale.test.ts` | TIP-02 · una sola escala tipográfica para el monitor › las hojas del monitor no declaran tamaños fuera de la escala | passed | 0 |
| `unit/uiActions.test.ts` | despacha acciones delegadas, preferencias y atajos sin activarlos al escribir | passed | 1442 |
| `unit/uiActions.test.ts` | la paleta conserva texto literal, búsqueda, foco, selección y cancelación | passed | 35 |
| `unit/uiActions.test.ts` | los perfiles mantienen sus etiquetas como texto y sus botones conservan ARIA | passed | 111 |
| `unit/uiDom.test.ts` | Casos, Aula y texto recibido › construye texto literal e iconos SVG sin convertir datos en etiquetas | passed | 76 |
| `unit/uiDom.test.ts` | Casos, Aula y texto recibido › lista y elige casos en el panel, preservando IDs, temas y viñetas literales | passed | 67 |
| `unit/uiDom.test.ts` | Casos, Aula y texto recibido › muestra la gasometría del modelo, limpia la reflexión al cambiar de caso y no evalúa sesiones importadas | passed | 41 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › mantiene el ajuste vigente hasta confirmar y permite cancelar el borrador | passed | 734 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › ofrece duraciones válidas y conserva selección sin duplicar solicitudes de bloqueo | passed | 42 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › una medición de bloqueo sin resultado se marca con una X roja, como el equipo; sin medir, un guion | passed | 106 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › en espera, como el equipo: barra de presión tostada y teclas de procedimiento grises e inactivas | passed | 240 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › selecciona modos en el equipo y descarta el borrador al cerrar | passed | 124 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › valida límites de alarma antes de enviarlos y permite Off | passed | 72 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › la luz del bisel como la del equipo: prioridad a la derecha y mitad azul durante la pausa de audio | passed | 51 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › VMesp y FiO2 baja no se apagan, como en el equipo: el campo vacío es un error con el mínimo | passed | 68 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › «Fuga % N» encabeza el grupo de volumen como en el equipo: entero de la última respiración, «—» sin dato | passed | 76 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › actualiza métricas, enmascara examen y fija la referencia al abrir la estimación | passed | 99 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › conserva eventos literales, orden inverso y alarma destacada | passed | 32 |
| `unit/uiDom.test.ts` | edición, medición y navegación de diálogos › abre fundamentos con diagramas SVG y cambia de tema sin perder ocultación de examen | passed | 104 |
| `unit/uiDom.test.ts` | referencias del caso › muestran autor y año; sin año, la referencia tal cual | passed | 50 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-01: seleccionar PEEP y girar sin confirmar no emite cambios | passed | 5 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-02: confirmar una edición válida emite un único evento con el nuevo valor interno | passed | 1 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-03: cancelar o vencer el plazo descarta el borrador (plazo identificado como propuesto) | passed | 1 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › INT-06: la rueda sin selección no altera nada; el bloqueo de pantalla impide editar | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › un valor inválido produce explicación y no se aproxima: VT hasta hacer el flujo > 160 L/min | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › PEEP: bajar desde 1 lleva a Off y subir desde Off lleva a 1 (Off no es 0) | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › seleccionar otra tecla descarta el borrador anterior sin aplicarlo | passed | 0 |
| `unit/uiState.test.ts` | INT · seleccionar/editar/confirmar/cancelar como transacciones › vista previa muestra consecuencias cruzadas (Tinsp y flujo derivados) antes de confirmar | passed | 0 |
| `unit/uiState.test.ts` | menú de modo como transacción › cancelar restaura todos los ajustes; confirmar entrega sólo los cambiados | passed | 0 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › VT: 300 → 325 al subir; 300 → 295 al bajar; 1000 → 1050 / 975 | passed | 1 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › 285 mL está en rejilla; 287 no; 300 no se convierte en 325 al cambiar de vista | passed | 1 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › trigger de flujo: 3.0 → 3.5 al subir; 3.0 → 2.9 al bajar | passed | 0 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › I:E de 0,1 en 0,1 (URM 13-12): 1:1.5 sube a 1:1.4 y baja a 1:1.6; 1:1.1 → 1:1 → 1.1:1; extremos 1:9 y 4:1 | passed | 0 |
| `unit/validation.test.ts` | escalones por tramo (D ficha 2014) en ambos sentidos › propiedad: subir y bajar desde un valor en rejilla (no extremo) devuelve el mismo valor | passed | 48 |
| `unit/validation.test.ts` | restricciones cruzadas (P sobre rangos D) › VT 2 L con Tinsp 0.5 s exige 240 L/min > 160: inválido con explicación, sin aproximar | passed | 0 |
| `unit/validation.test.ts` | restricciones cruzadas (P sobre rangos D) › FR 120 con I:E 4:1 deja Texp 0.1 s < 0.25: inválido | passed | 0 |
| `unit/validation.test.ts` | restricciones cruzadas (P sobre rangos D) › Pmáx ≤ PEEP es inválido; el banco es válido y deriva flujo 0.5 L/s | passed | 0 |
| `unit/validation.test.ts` | rejilla de valores admitidos (deslizador por índice) › gridValues enumera cada tramo con su paso y sin duplicar fronteras | passed | 1 |
| `unit/validation.test.ts` | rejilla de valores admitidos (deslizador por índice) › nearestGridValue devuelve un valor admitido y el más cercano | passed | 3 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › con E2 = 0 el modelo es exactamente el de un compartimento | passed | 2 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › inflado a flujo constante: la separación V − Vve sigue Q·tau·(1 − e^(−t/tau)) y no depende del paso | passed | 1 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › oclusión: caída inmediata resistiva (Ppico − P1 = R·Q) y luego decaimiento exponencial hasta la meseta estática | passed | 0 |
| `unit/viscoelastic.test.ts` | VIS-01 · modelo viscoelástico contra su solución analítica › tras 6 constantes la meseta está a menos de 1 % del valor estático | passed | 0 |
| `unit/viscoelastic.test.ts` | VIS-02 · consecuencias en el ventilador › el bloqueo inspiratorio mide una meseta por encima de la estática y la Cstat resultante subestima la compliance | passed | 58 |
| `unit/viscoelastic.test.ts` | VIS-02 · consecuencias en el ventilador › una pausa corta no da meseta de ciclo: la presión sigue cayendo y se declara inestable | passed | 21 |
| `unit/viscoelastic.test.ts` | VIS-02 · consecuencias en el ventilador › sin relajación la misma pausa sí da meseta estable | passed | 30 |
| `unit/viscoelastic.test.ts` | VIS-03 · resistencia no lineal de Rohrer › con K2 = 5, duplicar el flujo multiplica la caída resistiva por 2,4 en vez de por 2 | passed | 15 |
| `unit/viscoelastic.test.ts` | VIS-03 · resistencia no lineal de Rohrer › K2 no cambia la meseta: la carga elástica es la misma | passed | 10 |
| `unit/viscoelastic.test.ts` | VIS-03 · resistencia no lineal de Rohrer › K2 fuera de 0–50 se rechaza | passed | 1 |
| `unit/viscoelastic.test.ts` | VIS-04 · la PEEPe de referencia no se contamina con la oclusión previa › tras un bloqueo espiratorio con atrapamiento, el ΔP y la Cstat del siguiente bloqueo usan PEEP, no PEEP total | passed | 64 |

## Playwright · 397 pasadas / 0 fallidas / 68 omitidas (por diseño: la prueba móvil sólo corre en el proyecto móvil)

| Proyecto | Archivo | Prueba | Estado | ms |
| --- | --- | --- | --- | --- |
| desktop-1280 | `build.spec.ts` | el build carga los Fundamentos sólo al llegar a ellos y reutiliza su módulo sin red | passed | 700 |
| desktop-1280 | `build.spec.ts` | una carga fallida deja el simulador operativo y permite recuperar los Fundamentos | passed | 1628 |
| desktop-1280 | `clinicalCases.spec.ts` | CC-01: se elige en el panel, se resuelve en el ventilador con la mecánica oculta y se revela al entregar | passed | 2818 |
| desktop-1280 | `clinicalCases.spec.ts` | cada caso se lee entero en el panel sin desplazarse, con el título en una línea, antes y después de entregar | skipped | 82 |
| desktop-1280 | `clinicalCases.spec.ts` | el panel abre en Paciente (perfiles, mecánica y eventos) en escritorio y cerrado en móvil; Casos tiene la lista | passed | 417 |
| desktop-1280 | `clinicalCases.spec.ts` | el resumen de práctica se descarga con el caso y su estado | passed | 442 |
| desktop-1280 | `clinicalCases.spec.ts` | la URL heredada ?view=teaching lleva a los Fundamentos y el monitor sigue en Curvas | passed | 329 |
| desktop-1280 | `clinicalCases.spec.ts` | volver al caso en curso no lo reinicia; elegir otro caso carga su paciente y limpia la reflexión | passed | 716 |
| desktop-1280 | `clinicalCases.spec.ts` | «Aula» lleva a los Fundamentos bajo el equipo; en escritorio el caso sigue a la vista y nada desborda | passed | 492 |
| desktop-1280 | `clinicalCases.spec.ts` | «Salir del caso» vuelve al banco pasivo con el panel Paciente abierto | passed | 365 |
| desktop-1280 | `clockStartup.spec.ts` | SC-02 respeta paused=1 durante el arranque | passed | 574 |
| desktop-1280 | `clockStartup.spec.ts` | SC-12 respeta paused=1 durante el arranque | passed | 777 |
| desktop-1280 | `clockStartup.spec.ts` | autopause=12001 detiene el reloj a 12004 | passed | 397 |
| desktop-1280 | `controls.spec.ts` | Descripción de variables muestra el glosario y las ayudas persisten al recargar | passed | 869 |
| desktop-1280 | `controls.spec.ts` | Modo: el paso de VT cruza 300 mL por la regla, slider sincroniza y Cancelar no aplica | passed | 1626 |
| desktop-1280 | `controls.spec.ts` | Paciente: − y deslizador modifican la mecánica simulada | passed | 440 |
| desktop-1280 | `controls.spec.ts` | el diálogo conserva su caja y no desborda al cambiar de pestaña | passed | 644 |
| desktop-1280 | `controls.spec.ts` | la barra muestra exactamente Pausar, Personalizar vista y las ayudas sobre las curvas; Sesión sólo en Más opciones | passed | 346 |
| desktop-1280 | `controls.spec.ts` | las pestañas usan flechas/Home/End, el diálogo atrapa el foco y Escape lo cierra | passed | 941 |
| desktop-1280 | `controls.spec.ts` | las preferencias de ayudas no se escriben en una referencia fotográfica | passed | 480 |
| desktop-1280 | `controls.spec.ts` | los estados activos sobreviven al cierre y la pausa conserva la velocidad | passed | 806 |
| desktop-1280 | `controls.spec.ts` | los segmentados de Pantalla cambian sus controles y las preferencias persisten al recargar | passed | 965 |
| desktop-1280 | `controls.spec.ts` | límites: Off vuelve al mínimo, admite Off y confirma sólo el borrador válido | passed | 883 |
| desktop-1280 | `controls.spec.ts` | minRate respeta Off y su mínimo; switches y ayudas responden al teclado y al foco | passed | 974 |
| desktop-1280 | `instrument.spec.ts` | device dialog follows visible monitor bounds, scrolls internally, and resets before global personalization | passed | 812 |
| desktop-1280 | `instrument.spec.ts` | mode edits stay draft on cancel and confirming sends only changed settings | passed | 4543 |
| desktop-1280 | `instrument.spec.ts` | resizing to 390×844 recomputes device dialog bounds without horizontal overflow | passed | 323 |
| desktop-1280 | `interaction.spec.ts` | ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela | passed | 1354 |
| desktop-1280 | `interaction.spec.ts` | ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia | passed | 4373 |
| desktop-1280 | `interaction.spec.ts` | Casillas vive en Pantalla y se oculta fuera de Curvas | passed | 853 |
| desktop-1280 | `interaction.spec.ts` | Comparar última respiración dibuja el ciclo previo atenuado bajo la traza actual | passed | 3934 |
| desktop-1280 | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 398 |
| desktop-1280 | `interaction.spec.ts` | INT-02 · confirmar edición válida: se aplica en la siguiente respiración | passed | 1284 |
| desktop-1280 | `interaction.spec.ts` | INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima | passed | 378 |
| desktop-1280 | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 3767 |
| desktop-1280 | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 1462 |
| desktop-1280 | `interaction.spec.ts` | INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor | passed | 1027 |
| desktop-1280 | `interaction.spec.ts` | INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada | passed | 1190 |
| desktop-1280 | `interaction.spec.ts` | Modo explica en texto los modos que no se simulan | passed | 371 |
| desktop-1280 | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel | passed | 3236 |
| desktop-1280 | `interaction.spec.ts` | Pausar, velocidad y Congelar viven en .signal-toolbar y no se confunden | passed | 707 |
| desktop-1280 | `interaction.spec.ts` | SC-09 · la oclusión se resuelve con controles visibles: reconocer y Restablecer mecánica | passed | 2274 |
| desktop-1280 | `interaction.spec.ts` | SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel | passed | 522 |
| desktop-1280 | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa discreta y reanudación manual sin salto de reloj | passed | 2853 |
| desktop-1280 | `interaction.spec.ts` | abrir el circuito en Eventos dispara la alarma alta; deshacer la resuelve y reconocer devuelve la banda al azul | passed | 5785 |
| desktop-1280 | `interaction.spec.ts` | aplica, deshace y restablece mecánica con perfiles completos | passed | 709 |
| desktop-1280 | `interaction.spec.ts` | aplicar un perfil en Paciente conserva sesión, tiempo, ajustes y lo hecho en la práctica | passed | 2544 |
| desktop-1280 | `interaction.spec.ts` | cada tarjeta deja como máximo un párrafo visible fuera de «Por qué» | passed | 826 |
| desktop-1280 | `interaction.spec.ts` | cargar SC-24 muestra la amplitud evocada 8 en el panel del paciente | passed | 379 |
| desktop-1280 | `interaction.spec.ts` | el Menú del equipo conserva sólo sus cuatro entradas funcionales | passed | 373 |
| desktop-1280 | `interaction.spec.ts` | el bucle Pva·V con presión total se ve en el panel docente | passed | 399 |
| desktop-1280 | `interaction.spec.ts` | el campo vacío no vale como cero y el Resumen no revela las cifras tapadas | passed | 1860 |
| desktop-1280 | `interaction.spec.ts` | el contexto del encabezado muestra el caso y abre la lista de casos en el panel, sin diálogo | passed | 405 |
| desktop-1280 | `interaction.spec.ts` | el cursor cae donde apunta el puntero: el centro de la rejilla es el centro de la ventana | passed | 5336 |
| desktop-1280 | `interaction.spec.ts` | el cursor se maneja con el teclado, se anuncia, y sigue midiendo al recorrer la historia | passed | 5175 |
| desktop-1280 | `interaction.spec.ts` | el diálogo de personalización cierra con Escape y devuelve el foco | passed | 526 |
| desktop-1280 | `interaction.spec.ts` | el interruptor vive en el menú «…» y no en el monitor | passed | 372 |
| desktop-1280 | `interaction.spec.ts` | escritorio agrupa las opciones en ⋯ y Audio alterna aria-checked | passed | 930 |
| desktop-1280 | `interaction.spec.ts` | la barra muestra como máximo cinco controles interactivos | passed | 324 |
| desktop-1280 | `interaction.spec.ts` | la escala alterna entre automática y fija | passed | 786 |
| desktop-1280 | `interaction.spec.ts` | la pantalla de protección lee el índice de estrés y construye la titulación con lo medido | passed | 4809 |
| desktop-1280 | `interaction.spec.ts` | la pantalla de ventilación muestra la gasometría del modelo y el monitor nunca la muestra | passed | 828 |
| desktop-1280 | `interaction.spec.ts` | la primera visita ofrece explorar o casos clínicos; la bienvenida no se repite | passed | 373 |
| desktop-1280 | `interaction.spec.ts` | la selección de 6 casillas grandes persiste y vuelve a 13 sin romper la tabla | passed | 812 |
| desktop-1280 | `interaction.spec.ts` | la tecla muestra lo entregado; la propuesta confirmada se anuncia aparte con su flecha | passed | 385 |
| desktop-1280 | `interaction.spec.ts` | la velocidad se actualiza desde el menú y Escape devuelve el foco | passed | 653 |
| desktop-1280 | `interaction.spec.ts` | la versión vive en el panel docente y ya no existe el listón de seguridad | passed | 333 |
| desktop-1280 | `interaction.spec.ts` | los controles de tiempo caben sin desbordar el ancho del viewport | passed | 429 |
| desktop-1280 | `interaction.spec.ts` | los paneles laterales: uno a la vez, Esc devuelve el foco y se cierran al ir a Casos | passed | 544 |
| desktop-1280 | `interaction.spec.ts` | los perfiles están deshabilitados en una referencia fotográfica | passed | 433 |
| desktop-1280 | `interaction.spec.ts` | los valores medidos se ocultan hasta que el alumno los estima | passed | 905 |
| desktop-1280 | `interaction.spec.ts` | recorrer la historia desplaza la ventana en el tiempo | passed | 5212 |
| desktop-1280 | `interaction.spec.ts` | restablecer preferencias las borra y avisa que se aplicará al recargar | passed | 376 |
| desktop-1280 | `interaction.spec.ts` | restaura escenario, vista y ventana de curvas al recargar | passed | 560 |
| desktop-1280 | `interaction.spec.ts` | sin bloqueo no inventa números; con bloqueo enseña la cuenta con los del monitor | passed | 1444 |
| desktop-1280 | `interaction.spec.ts` | subir PEEP por encima de la apertura recluta; bajarla por encima del cierre lo conserva | passed | 4816 |
| desktop-1280 | `interaction.spec.ts` | tocar o pulsar la curva congelada basta para medir | passed | 7134 |
| desktop-1280 | `interaction.spec.ts` | tres controles a la vista; la mecánica avanzada sale de la barra en cuatro pestañas, un grupo a la vez | passed | 634 |
| desktop-1280 | `interaction.spec.ts` | un `speed` ilegible se descarta con aviso y el motor avanza igual | passed | 268 |
| desktop-1280 | `interaction.spec.ts` | un escenario de la dirección tiene prioridad sobre el guardado | passed | 233 |
| desktop-1280 | `interaction.spec.ts` | una intervención conserva automáticamente la última respiración completa como «Antes» | passed | 1362 |
| desktop-1280 | `interaction.spec.ts` | una sesión importada no evalúa el caso clínico que estaba abierto | passed | 558 |
| desktop-1280 | `interaction.spec.ts` | una velocidad personalizada de la URL aparece en Revisar curvas y tiempo | passed | 437 |
| desktop-1280 | `interaction.spec.ts` | «TET 7,0 mm» fija el deslizador K₂ a 9,2 y moverlo a mano deja «Personalizado» | passed | 862 |
| desktop-1280 | `measurementFidelity.spec.ts` | SC-09 prolongada: fuga sin denominador muestra motivo | passed | 4186 |
| desktop-1280 | `measurementFidelity.spec.ts` | SC-18: el bloqueo espiratorio con esfuerzo no delata el músculo en la cara del equipo | passed | 13473 |
| desktop-1280 | `measurementFidelity.spec.ts` | meseta estable con esfuerzo: el equipo muestra lo que mide y el Aula avisa que no es mecánica pasiva | passed | 1002 |
| desktop-1280 | `measurementFidelity.spec.ts` | pausa de ciclo: el equipo publica la meseta estable con o sin esfuerzo, sin delatar el músculo | passed | 1417 |
| desktop-1280 | `mobile.spec.ts` | Paciente conserva targets táctiles; la mecánica avanzada se abre a pantalla completa sobre la hoja | skipped | 0 |
| desktop-1280 | `mobile.spec.ts` | datos grandes: los seis valores a la vista en dos columnas; bucles apilados; la alarma no se recorta | skipped | 0 |
| desktop-1280 | `mobile.spec.ts` | el diálogo conserva su caja y cabe en cada pestaña a 375 px | skipped | 0 |
| desktop-1280 | `mobile.spec.ts` | elimina la barra redundante y arranca con el panel cerrado y compacto | skipped | 0 |
| desktop-1280 | `mobile.spec.ts` | escritorio: la ventana arranca en 12 s | passed | 244 |
| desktop-1280 | `mobile.spec.ts` | guía: cerrar, campos, deslizadores, interruptores y pestañas | skipped | 0 |
| desktop-1280 | `mobile.spec.ts` | la cabecera muestra Buscar y ⋯; el menú añade Sesión | skipped | 64 |
| desktop-1280 | `mobile.spec.ts` | la hoja del panel docente abre, cierra con el botón o Escape y devuelve el foco | skipped | 0 |
| desktop-1280 | `mobile.spec.ts` | la hoja vuelve a la columna del panel al ensanchar el viewport | skipped | 0 |
| desktop-1280 | `mobile.spec.ts` | las cuatro pestañas dan la misma ventana, en el mismo sitio | passed | 420 |
| desktop-1280 | `mobile.spec.ts` | límites: cerrar, campos, deslizadores, interruptores y pestañas | skipped | 0 |
| desktop-1280 | `mobile.spec.ts` | menú: cerrar, campos, deslizadores, interruptores y pestañas | skipped | 0 |
| desktop-1280 | `mobile.spec.ts` | modos: cerrar, campos, deslizadores, interruptores y pestañas | skipped | 0 |
| desktop-1280 | `mobile.spec.ts` | móvil (< 700 px): la ventana arranca en 6 s | skipped | 64 |
| desktop-1280 | `mobile.spec.ts` | nada flota sobre los ajustes: Pausar y Personalizar quedan en la cabecera, siempre a la vista | skipped | 0 |
| desktop-1280 | `mobile.spec.ts` | sin desbordamiento; las trece cifras a la vista y legibles; el monitor cabe en su ventana; el editor fuera del monitor | skipped | 0 |
| desktop-1280 | `mobile.spec.ts` | sin desborde al cargar, abrir Menú y cambiar cada vista | skipped | 0 |
| desktop-1280 | `palette.spec.ts` | Ctrl+K abre la paleta y permite aplicar un perfil | passed | 317 |
| desktop-1280 | `palette.spec.ts` | Escape cierra la paleta y devuelve el foco al botón | passed | 430 |
| desktop-1280 | `palette.spec.ts` | filtra vistas y ejecuta la selección con las flechas | passed | 466 |
| desktop-1280 | `palette.spec.ts` | la cabecera no desborda horizontalmente | passed | 304 |
| desktop-1280 | `palette.spec.ts` | permite cargar un caso clínico por su identificador y lo presenta en el panel | passed | 406 |
| desktop-1280 | `palette.spec.ts` | una consulta sin coincidencias no ejecuta nada | passed | 402 |
| desktop-1280 | `pc.spec.ts` | Escape cierra primero el diálogo y el reloj del monitor muestra la hora del día | passed | 349 |
| desktop-1280 | `pc.spec.ts` | PEEP: el primer paso del deslizador es Off, no 0 | passed | 354 |
| desktop-1280 | `pc.spec.ts` | VTesp bajo y FR alta configurados en el diálogo se activan mientras ventila y se reflejan en la banda | passed | 698 |
| desktop-1280 | `pc.spec.ts` | bloqueo inspiratorio rechazado por Pmáx: resultado no válido con motivo legible y aviso | passed | 1293 |
| desktop-1280 | `pc.spec.ts` | cambiar a A/C PC desde el menú de modos: teclas rápidas, curvas y VT esperado | passed | 2646 |
| desktop-1280 | `pc.spec.ts` | deslizador recorre sólo valores admitidos; ± y deslizador coinciden; escritura fuera de rejilla sugiere el más cercano | passed | 1371 |
| desktop-1280 | `pc.spec.ts` | el VTesp mostrado cambia entre ciclos alrededor del volumen programado | passed | 12382 |
| desktop-1280 | `pc.spec.ts` | la columna de presión desciende de forma progresiva al terminar la inspiración | passed | 8288 |
| desktop-1280 | `pc.spec.ts` | menú de modo: flujo de base y disparo por presión; el disparo por flujo no puede superar el flujo de base | passed | 1356 |
| desktop-1280 | `pc.spec.ts` | ▶ es idempotente mientras hay solicitud; «Cancelar» la anula y se anuncia | passed | 737 |
| desktop-1280 | `ps.spec.ts` | SC-19: apnea provocada → alarma alta y respaldo; al deshacerla la apnea se resuelve y el respaldo sigue hasta confirmar el modo | passed | 7834 |
| desktop-1280 | `ps.spec.ts` | cambiar a CPAP/PS desde el menú de modos: bloque de respaldo, teclas rápidas y respiraciones espontáneas | passed | 5454 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · alarma-alta | passed | 2811 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · aula | passed | 899 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · ayudas | passed | 2799 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · bloqueo | passed | 1702 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · bucles | passed | 2036 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · curvas | passed | 1524 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · datos-grandes | passed | 1599 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · datos-modelo | passed | 3809 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · editor | passed | 4114 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · espera | passed | 1687 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · fuga | passed | 1966 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · guia | passed | 420 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · limites | passed | 1516 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · modos | passed | 1662 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · panel | passed | 632 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · sesion | passed | 492 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · tabla | passed | 1592 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · tendencias | passed | 5119 |
| desktop-1280 | `regresion.spec.ts` | VR-01 · vista | passed | 428 |
| desktop-1280 | `teachingHonesty.spec.ts` | SC-25 mantiene sus límites visibles en los Fundamentos | passed | 571 |
| desktop-1280 | `teachingHonesty.spec.ts` | la ayuda del bloqueo anuncia la maniobra que está abierta | passed | 569 |
| desktop-1280 | `visual.spec.ts` | DAT-08 · grupos y estado Pplat cambian al completar un bloqueo válido | passed | 1779 |
| desktop-1280 | `visual.spec.ts` | VIS · el exterior usa tema claro y conserva el fondo del equipo | passed | 347 |
| desktop-1280 | `visual.spec.ts` | VIS · panel Paciente compacto a 1440 px: gases, perfiles, mecánica y eventos sin desplazarse | skipped | 66 |
| desktop-1280 | `visual.spec.ts` | VIS-01 + DAT-02 · P1: panel denso y bloqueo; Pplat de bloqueo 32 y Cstat 19 fechados | passed | 426 |
| desktop-1280 | `visual.spec.ts` | VIS-02 + DAT-01 · P3: datos grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 483 |
| desktop-1280 | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro | passed | 725 |
| desktop-1280 | `visual.spec.ts` | VIS-04 · alarma de Pmáx (SC-09): banda roja, luz del bisel y celda resaltada | passed | 2412 |
| desktop-1280 | `visual.spec.ts` | VIS-05 · vistas de bucles, tabla, tendencias y registro son funcionales | passed | 1755 |
| desktop-1280 | `visual.spec.ts` | VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3 | passed | 1582 |
| desktop-1280 | `visual.spec.ts` | VIS-08 · CPAP/PS (SC-19): presión a PEEP + PS, flujo cortado al 25 % del pico, volumen del paciente | passed | 1452 |
| desktop-1280 | `visual.spec.ts` | no usa iconos informativos y sus descendientes caben | passed | 270 |
| desktop-1440 | `build.spec.ts` | el build carga los Fundamentos sólo al llegar a ellos y reutiliza su módulo sin red | passed | 1214 |
| desktop-1440 | `build.spec.ts` | una carga fallida deja el simulador operativo y permite recuperar los Fundamentos | passed | 2255 |
| desktop-1440 | `clinicalCases.spec.ts` | CC-01: se elige en el panel, se resuelve en el ventilador con la mecánica oculta y se revela al entregar | passed | 3435 |
| desktop-1440 | `clinicalCases.spec.ts` | cada caso se lee entero en el panel sin desplazarse, con el título en una línea, antes y después de entregar | passed | 3059 |
| desktop-1440 | `clinicalCases.spec.ts` | el panel abre en Paciente (perfiles, mecánica y eventos) en escritorio y cerrado en móvil; Casos tiene la lista | passed | 1031 |
| desktop-1440 | `clinicalCases.spec.ts` | el resumen de práctica se descarga con el caso y su estado | passed | 434 |
| desktop-1440 | `clinicalCases.spec.ts` | la URL heredada ?view=teaching lleva a los Fundamentos y el monitor sigue en Curvas | passed | 337 |
| desktop-1440 | `clinicalCases.spec.ts` | volver al caso en curso no lo reinicia; elegir otro caso carga su paciente y limpia la reflexión | passed | 783 |
| desktop-1440 | `clinicalCases.spec.ts` | «Aula» lleva a los Fundamentos bajo el equipo; en escritorio el caso sigue a la vista y nada desborda | passed | 530 |
| desktop-1440 | `clinicalCases.spec.ts` | «Salir del caso» vuelve al banco pasivo con el panel Paciente abierto | passed | 513 |
| desktop-1440 | `clockStartup.spec.ts` | SC-02 respeta paused=1 durante el arranque | passed | 1262 |
| desktop-1440 | `clockStartup.spec.ts` | SC-12 respeta paused=1 durante el arranque | passed | 1162 |
| desktop-1440 | `clockStartup.spec.ts` | autopause=12001 detiene el reloj a 12004 | passed | 484 |
| desktop-1440 | `controls.spec.ts` | Descripción de variables muestra el glosario y las ayudas persisten al recargar | passed | 911 |
| desktop-1440 | `controls.spec.ts` | Modo: el paso de VT cruza 300 mL por la regla, slider sincroniza y Cancelar no aplica | passed | 1707 |
| desktop-1440 | `controls.spec.ts` | Paciente: − y deslizador modifican la mecánica simulada | passed | 578 |
| desktop-1440 | `controls.spec.ts` | el diálogo conserva su caja y no desborda al cambiar de pestaña | passed | 714 |
| desktop-1440 | `controls.spec.ts` | la barra muestra exactamente Pausar, Personalizar vista y las ayudas sobre las curvas; Sesión sólo en Más opciones | passed | 421 |
| desktop-1440 | `controls.spec.ts` | las pestañas usan flechas/Home/End, el diálogo atrapa el foco y Escape lo cierra | passed | 1081 |
| desktop-1440 | `controls.spec.ts` | las preferencias de ayudas no se escriben en una referencia fotográfica | passed | 638 |
| desktop-1440 | `controls.spec.ts` | los estados activos sobreviven al cierre y la pausa conserva la velocidad | passed | 1042 |
| desktop-1440 | `controls.spec.ts` | los segmentados de Pantalla cambian sus controles y las preferencias persisten al recargar | passed | 1692 |
| desktop-1440 | `controls.spec.ts` | límites: Off vuelve al mínimo, admite Off y confirma sólo el borrador válido | passed | 1156 |
| desktop-1440 | `controls.spec.ts` | minRate respeta Off y su mínimo; switches y ayudas responden al teclado y al foco | passed | 1160 |
| desktop-1440 | `instrument.spec.ts` | device dialog follows visible monitor bounds, scrolls internally, and resets before global personalization | passed | 1405 |
| desktop-1440 | `instrument.spec.ts` | mode edits stay draft on cancel and confirming sends only changed settings | passed | 4619 |
| desktop-1440 | `instrument.spec.ts` | resizing to 390×844 recomputes device dialog bounds without horizontal overflow | passed | 462 |
| desktop-1440 | `interaction.spec.ts` | ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela | passed | 1390 |
| desktop-1440 | `interaction.spec.ts` | ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia | passed | 4426 |
| desktop-1440 | `interaction.spec.ts` | Casillas vive en Pantalla y se oculta fuera de Curvas | passed | 1030 |
| desktop-1440 | `interaction.spec.ts` | Comparar última respiración dibuja el ciclo previo atenuado bajo la traza actual | passed | 3698 |
| desktop-1440 | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 460 |
| desktop-1440 | `interaction.spec.ts` | INT-02 · confirmar edición válida: se aplica en la siguiente respiración | passed | 1438 |
| desktop-1440 | `interaction.spec.ts` | INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima | passed | 579 |
| desktop-1440 | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 3509 |
| desktop-1440 | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 1469 |
| desktop-1440 | `interaction.spec.ts` | INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor | passed | 1136 |
| desktop-1440 | `interaction.spec.ts` | INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada | passed | 1294 |
| desktop-1440 | `interaction.spec.ts` | Modo explica en texto los modos que no se simulan | passed | 483 |
| desktop-1440 | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel | passed | 3473 |
| desktop-1440 | `interaction.spec.ts` | Pausar, velocidad y Congelar viven en .signal-toolbar y no se confunden | passed | 837 |
| desktop-1440 | `interaction.spec.ts` | SC-09 · la oclusión se resuelve con controles visibles: reconocer y Restablecer mecánica | passed | 2373 |
| desktop-1440 | `interaction.spec.ts` | SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel | passed | 588 |
| desktop-1440 | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa discreta y reanudación manual sin salto de reloj | passed | 2879 |
| desktop-1440 | `interaction.spec.ts` | abrir el circuito en Eventos dispara la alarma alta; deshacer la resuelve y reconocer devuelve la banda al azul | passed | 5703 |
| desktop-1440 | `interaction.spec.ts` | aplica, deshace y restablece mecánica con perfiles completos | passed | 650 |
| desktop-1440 | `interaction.spec.ts` | aplicar un perfil en Paciente conserva sesión, tiempo, ajustes y lo hecho en la práctica | passed | 2598 |
| desktop-1440 | `interaction.spec.ts` | cada tarjeta deja como máximo un párrafo visible fuera de «Por qué» | passed | 918 |
| desktop-1440 | `interaction.spec.ts` | cargar SC-24 muestra la amplitud evocada 8 en el panel del paciente | passed | 644 |
| desktop-1440 | `interaction.spec.ts` | el Menú del equipo conserva sólo sus cuatro entradas funcionales | passed | 392 |
| desktop-1440 | `interaction.spec.ts` | el bucle Pva·V con presión total se ve en el panel docente | passed | 512 |
| desktop-1440 | `interaction.spec.ts` | el campo vacío no vale como cero y el Resumen no revela las cifras tapadas | passed | 2037 |
| desktop-1440 | `interaction.spec.ts` | el contexto del encabezado muestra el caso y abre la lista de casos en el panel, sin diálogo | passed | 530 |
| desktop-1440 | `interaction.spec.ts` | el cursor cae donde apunta el puntero: el centro de la rejilla es el centro de la ventana | passed | 5221 |
| desktop-1440 | `interaction.spec.ts` | el cursor se maneja con el teclado, se anuncia, y sigue midiendo al recorrer la historia | passed | 4999 |
| desktop-1440 | `interaction.spec.ts` | el diálogo de personalización cierra con Escape y devuelve el foco | passed | 568 |
| desktop-1440 | `interaction.spec.ts` | el interruptor vive en el menú «…» y no en el monitor | passed | 483 |
| desktop-1440 | `interaction.spec.ts` | escritorio agrupa las opciones en ⋯ y Audio alterna aria-checked | passed | 993 |
| desktop-1440 | `interaction.spec.ts` | la barra muestra como máximo cinco controles interactivos | passed | 369 |
| desktop-1440 | `interaction.spec.ts` | la escala alterna entre automática y fija | passed | 648 |
| desktop-1440 | `interaction.spec.ts` | la pantalla de protección lee el índice de estrés y construye la titulación con lo medido | passed | 4773 |
| desktop-1440 | `interaction.spec.ts` | la pantalla de ventilación muestra la gasometría del modelo y el monitor nunca la muestra | passed | 878 |
| desktop-1440 | `interaction.spec.ts` | la primera visita ofrece explorar o casos clínicos; la bienvenida no se repite | passed | 549 |
| desktop-1440 | `interaction.spec.ts` | la selección de 6 casillas grandes persiste y vuelve a 13 sin romper la tabla | passed | 909 |
| desktop-1440 | `interaction.spec.ts` | la tecla muestra lo entregado; la propuesta confirmada se anuncia aparte con su flecha | passed | 472 |
| desktop-1440 | `interaction.spec.ts` | la velocidad se actualiza desde el menú y Escape devuelve el foco | passed | 617 |
| desktop-1440 | `interaction.spec.ts` | la versión vive en el panel docente y ya no existe el listón de seguridad | passed | 355 |
| desktop-1440 | `interaction.spec.ts` | los controles de tiempo caben sin desbordar el ancho del viewport | passed | 381 |
| desktop-1440 | `interaction.spec.ts` | los paneles laterales: uno a la vez, Esc devuelve el foco y se cierran al ir a Casos | passed | 571 |
| desktop-1440 | `interaction.spec.ts` | los perfiles están deshabilitados en una referencia fotográfica | passed | 406 |
| desktop-1440 | `interaction.spec.ts` | los valores medidos se ocultan hasta que el alumno los estima | passed | 1015 |
| desktop-1440 | `interaction.spec.ts` | recorrer la historia desplaza la ventana en el tiempo | passed | 5059 |
| desktop-1440 | `interaction.spec.ts` | restablecer preferencias las borra y avisa que se aplicará al recargar | passed | 533 |
| desktop-1440 | `interaction.spec.ts` | restaura escenario, vista y ventana de curvas al recargar | passed | 651 |
| desktop-1440 | `interaction.spec.ts` | sin bloqueo no inventa números; con bloqueo enseña la cuenta con los del monitor | passed | 2584 |
| desktop-1440 | `interaction.spec.ts` | subir PEEP por encima de la apertura recluta; bajarla por encima del cierre lo conserva | passed | 4862 |
| desktop-1440 | `interaction.spec.ts` | tocar o pulsar la curva congelada basta para medir | passed | 5054 |
| desktop-1440 | `interaction.spec.ts` | tres controles a la vista; la mecánica avanzada sale de la barra en cuatro pestañas, un grupo a la vez | passed | 900 |
| desktop-1440 | `interaction.spec.ts` | un `speed` ilegible se descarta con aviso y el motor avanza igual | passed | 323 |
| desktop-1440 | `interaction.spec.ts` | un escenario de la dirección tiene prioridad sobre el guardado | passed | 338 |
| desktop-1440 | `interaction.spec.ts` | una intervención conserva automáticamente la última respiración completa como «Antes» | passed | 1439 |
| desktop-1440 | `interaction.spec.ts` | una sesión importada no evalúa el caso clínico que estaba abierto | passed | 577 |
| desktop-1440 | `interaction.spec.ts` | una velocidad personalizada de la URL aparece en Revisar curvas y tiempo | passed | 469 |
| desktop-1440 | `interaction.spec.ts` | «TET 7,0 mm» fija el deslizador K₂ a 9,2 y moverlo a mano deja «Personalizado» | passed | 614 |
| desktop-1440 | `measurementFidelity.spec.ts` | SC-09 prolongada: fuga sin denominador muestra motivo | passed | 4395 |
| desktop-1440 | `measurementFidelity.spec.ts` | SC-18: el bloqueo espiratorio con esfuerzo no delata el músculo en la cara del equipo | passed | 13673 |
| desktop-1440 | `measurementFidelity.spec.ts` | meseta estable con esfuerzo: el equipo muestra lo que mide y el Aula avisa que no es mecánica pasiva | passed | 1385 |
| desktop-1440 | `measurementFidelity.spec.ts` | pausa de ciclo: el equipo publica la meseta estable con o sin esfuerzo, sin delatar el músculo | passed | 1668 |
| desktop-1440 | `mobile.spec.ts` | Paciente conserva targets táctiles; la mecánica avanzada se abre a pantalla completa sobre la hoja | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | datos grandes: los seis valores a la vista en dos columnas; bucles apilados; la alarma no se recorta | skipped | 1 |
| desktop-1440 | `mobile.spec.ts` | el diálogo conserva su caja y cabe en cada pestaña a 375 px | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | elimina la barra redundante y arranca con el panel cerrado y compacto | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | escritorio: la ventana arranca en 12 s | passed | 303 |
| desktop-1440 | `mobile.spec.ts` | guía: cerrar, campos, deslizadores, interruptores y pestañas | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | la cabecera muestra Buscar y ⋯; el menú añade Sesión | skipped | 88 |
| desktop-1440 | `mobile.spec.ts` | la hoja del panel docente abre, cierra con el botón o Escape y devuelve el foco | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | la hoja vuelve a la columna del panel al ensanchar el viewport | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | las cuatro pestañas dan la misma ventana, en el mismo sitio | passed | 539 |
| desktop-1440 | `mobile.spec.ts` | límites: cerrar, campos, deslizadores, interruptores y pestañas | skipped | 1 |
| desktop-1440 | `mobile.spec.ts` | menú: cerrar, campos, deslizadores, interruptores y pestañas | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | modos: cerrar, campos, deslizadores, interruptores y pestañas | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | móvil (< 700 px): la ventana arranca en 6 s | skipped | 116 |
| desktop-1440 | `mobile.spec.ts` | nada flota sobre los ajustes: Pausar y Personalizar quedan en la cabecera, siempre a la vista | skipped | 1 |
| desktop-1440 | `mobile.spec.ts` | sin desbordamiento; las trece cifras a la vista y legibles; el monitor cabe en su ventana; el editor fuera del monitor | skipped | 0 |
| desktop-1440 | `mobile.spec.ts` | sin desborde al cargar, abrir Menú y cambiar cada vista | skipped | 1 |
| desktop-1440 | `palette.spec.ts` | Ctrl+K abre la paleta y permite aplicar un perfil | passed | 566 |
| desktop-1440 | `palette.spec.ts` | Escape cierra la paleta y devuelve el foco al botón | passed | 561 |
| desktop-1440 | `palette.spec.ts` | filtra vistas y ejecuta la selección con las flechas | passed | 589 |
| desktop-1440 | `palette.spec.ts` | la cabecera no desborda horizontalmente | passed | 315 |
| desktop-1440 | `palette.spec.ts` | permite cargar un caso clínico por su identificador y lo presenta en el panel | passed | 440 |
| desktop-1440 | `palette.spec.ts` | una consulta sin coincidencias no ejecuta nada | passed | 497 |
| desktop-1440 | `pc.spec.ts` | Escape cierra primero el diálogo y el reloj del monitor muestra la hora del día | passed | 447 |
| desktop-1440 | `pc.spec.ts` | PEEP: el primer paso del deslizador es Off, no 0 | passed | 390 |
| desktop-1440 | `pc.spec.ts` | VTesp bajo y FR alta configurados en el diálogo se activan mientras ventila y se reflejan en la banda | passed | 786 |
| desktop-1440 | `pc.spec.ts` | bloqueo inspiratorio rechazado por Pmáx: resultado no válido con motivo legible y aviso | passed | 3330 |
| desktop-1440 | `pc.spec.ts` | cambiar a A/C PC desde el menú de modos: teclas rápidas, curvas y VT esperado | passed | 2695 |
| desktop-1440 | `pc.spec.ts` | deslizador recorre sólo valores admitidos; ± y deslizador coinciden; escritura fuera de rejilla sugiere el más cercano | passed | 1312 |
| desktop-1440 | `pc.spec.ts` | el VTesp mostrado cambia entre ciclos alrededor del volumen programado | passed | 12405 |
| desktop-1440 | `pc.spec.ts` | la columna de presión desciende de forma progresiva al terminar la inspiración | passed | 8292 |
| desktop-1440 | `pc.spec.ts` | menú de modo: flujo de base y disparo por presión; el disparo por flujo no puede superar el flujo de base | passed | 1364 |
| desktop-1440 | `pc.spec.ts` | ▶ es idempotente mientras hay solicitud; «Cancelar» la anula y se anuncia | passed | 811 |
| desktop-1440 | `ps.spec.ts` | SC-19: apnea provocada → alarma alta y respaldo; al deshacerla la apnea se resuelve y el respaldo sigue hasta confirmar el modo | passed | 6932 |
| desktop-1440 | `ps.spec.ts` | cambiar a CPAP/PS desde el menú de modos: bloque de respaldo, teclas rápidas y respiraciones espontáneas | passed | 5283 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · alarma-alta | skipped | 66 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · aula | skipped | 74 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · ayudas | skipped | 70 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · bloqueo | skipped | 68 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · bucles | skipped | 67 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · curvas | skipped | 67 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · datos-grandes | skipped | 65 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · datos-modelo | skipped | 68 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · editor | skipped | 71 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · espera | skipped | 70 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · fuga | skipped | 67 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · guia | skipped | 70 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · limites | skipped | 66 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · modos | skipped | 68 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · panel | skipped | 68 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · sesion | skipped | 65 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · tabla | skipped | 50 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · tendencias | skipped | 64 |
| desktop-1440 | `regresion.spec.ts` | VR-01 · vista | skipped | 77 |
| desktop-1440 | `teachingHonesty.spec.ts` | SC-25 mantiene sus límites visibles en los Fundamentos | passed | 1488 |
| desktop-1440 | `teachingHonesty.spec.ts` | la ayuda del bloqueo anuncia la maniobra que está abierta | passed | 601 |
| desktop-1440 | `visual.spec.ts` | DAT-08 · grupos y estado Pplat cambian al completar un bloqueo válido | passed | 1409 |
| desktop-1440 | `visual.spec.ts` | VIS · el exterior usa tema claro y conserva el fondo del equipo | passed | 538 |
| desktop-1440 | `visual.spec.ts` | VIS · panel Paciente compacto a 1440 px: gases, perfiles, mecánica y eventos sin desplazarse | passed | 617 |
| desktop-1440 | `visual.spec.ts` | VIS-01 + DAT-02 · P1: panel denso y bloqueo; Pplat de bloqueo 32 y Cstat 19 fechados | passed | 853 |
| desktop-1440 | `visual.spec.ts` | VIS-02 + DAT-01 · P3: datos grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 577 |
| desktop-1440 | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro | passed | 830 |
| desktop-1440 | `visual.spec.ts` | VIS-04 · alarma de Pmáx (SC-09): banda roja, luz del bisel y celda resaltada | passed | 2620 |
| desktop-1440 | `visual.spec.ts` | VIS-05 · vistas de bucles, tabla, tendencias y registro son funcionales | passed | 1873 |
| desktop-1440 | `visual.spec.ts` | VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3 | passed | 1689 |
| desktop-1440 | `visual.spec.ts` | VIS-08 · CPAP/PS (SC-19): presión a PEEP + PS, flujo cortado al 25 % del pico, volumen del paciente | passed | 1455 |
| desktop-1440 | `visual.spec.ts` | no usa iconos informativos y sus descendientes caben | passed | 305 |
| mobile | `build.spec.ts` | el build carga los Fundamentos sólo al llegar a ellos y reutiliza su módulo sin red | passed | 819 |
| mobile | `build.spec.ts` | una carga fallida deja el simulador operativo y permite recuperar los Fundamentos | passed | 1870 |
| mobile | `clinicalCases.spec.ts` | CC-01: se elige en el panel, se resuelve en el ventilador con la mecánica oculta y se revela al entregar | passed | 3750 |
| mobile | `clinicalCases.spec.ts` | cada caso se lee entero en el panel sin desplazarse, con el título en una línea, antes y después de entregar | skipped | 115 |
| mobile | `clinicalCases.spec.ts` | el panel abre en Paciente (perfiles, mecánica y eventos) en escritorio y cerrado en móvil; Casos tiene la lista | passed | 636 |
| mobile | `clinicalCases.spec.ts` | el resumen de práctica se descarga con el caso y su estado | passed | 631 |
| mobile | `clinicalCases.spec.ts` | la URL heredada ?view=teaching lleva a los Fundamentos y el monitor sigue en Curvas | passed | 535 |
| mobile | `clinicalCases.spec.ts` | volver al caso en curso no lo reinicia; elegir otro caso carga su paciente y limpia la reflexión | passed | 751 |
| mobile | `clinicalCases.spec.ts` | «Aula» lleva a los Fundamentos bajo el equipo; en escritorio el caso sigue a la vista y nada desborda | passed | 715 |
| mobile | `clinicalCases.spec.ts` | «Salir del caso» vuelve al banco pasivo con el panel Paciente abierto | passed | 612 |
| mobile | `clockStartup.spec.ts` | SC-02 respeta paused=1 durante el arranque | passed | 1117 |
| mobile | `clockStartup.spec.ts` | SC-12 respeta paused=1 durante el arranque | passed | 1302 |
| mobile | `clockStartup.spec.ts` | autopause=12001 detiene el reloj a 12004 | passed | 891 |
| mobile | `controls.spec.ts` | Descripción de variables muestra el glosario y las ayudas persisten al recargar | passed | 1361 |
| mobile | `controls.spec.ts` | Modo: el paso de VT cruza 300 mL por la regla, slider sincroniza y Cancelar no aplica | passed | 1823 |
| mobile | `controls.spec.ts` | Paciente: − y deslizador modifican la mecánica simulada | passed | 753 |
| mobile | `controls.spec.ts` | el diálogo conserva su caja y no desborda al cambiar de pestaña | passed | 896 |
| mobile | `controls.spec.ts` | la barra muestra exactamente Pausar, Personalizar vista y las ayudas sobre las curvas; Sesión sólo en Más opciones | passed | 639 |
| mobile | `controls.spec.ts` | las pestañas usan flechas/Home/End, el diálogo atrapa el foco y Escape lo cierra | passed | 933 |
| mobile | `controls.spec.ts` | las preferencias de ayudas no se escriben en una referencia fotográfica | passed | 799 |
| mobile | `controls.spec.ts` | los estados activos sobreviven al cierre y la pausa conserva la velocidad | passed | 1233 |
| mobile | `controls.spec.ts` | los segmentados de Pantalla cambian sus controles y las preferencias persisten al recargar | passed | 1079 |
| mobile | `controls.spec.ts` | límites: Off vuelve al mínimo, admite Off y confirma sólo el borrador válido | passed | 1191 |
| mobile | `controls.spec.ts` | minRate respeta Off y su mínimo; switches y ayudas responden al teclado y al foco | passed | 1157 |
| mobile | `instrument.spec.ts` | device dialog follows visible monitor bounds, scrolls internally, and resets before global personalization | passed | 1257 |
| mobile | `instrument.spec.ts` | mode edits stay draft on cancel and confirming sends only changed settings | passed | 4908 |
| mobile | `instrument.spec.ts` | resizing to 390×844 recomputes device dialog bounds without horizontal overflow | passed | 522 |
| mobile | `interaction.spec.ts` | ACC-01 · teclado: Tab llega a la tecla, Enter la abre, flechas ajustan, Enter confirma, Escape cancela | passed | 1813 |
| mobile | `interaction.spec.ts` | ALM-02/03 (UI) · reconocer no resuelve; resolver sin reconocer deja banda gris; reconocer después la limpia | passed | 4549 |
| mobile | `interaction.spec.ts` | Casillas vive en Pantalla y se oculta fuera de Curvas | passed | 653 |
| mobile | `interaction.spec.ts` | Comparar última respiración dibuja el ciclo previo atenuado bajo la traza actual | passed | 3314 |
| mobile | `interaction.spec.ts` | INT-01 · seleccionar PEEP y girar sin confirmar no cambia ajustes ni motor | passed | 593 |
| mobile | `interaction.spec.ts` | INT-02 · confirmar edición válida: se aplica en la siguiente respiración | passed | 1557 |
| mobile | `interaction.spec.ts` | INT-02b · valor escrito fuera de rejilla se rechaza con explicación, no se aproxima | passed | 605 |
| mobile | `interaction.spec.ts` | INT-03 · cancelar y vencimiento del plazo no mutan ajustes | passed | 3995 |
| mobile | `interaction.spec.ts` | INT-04 · EN ESPERA: cancelar sigue ventilando; confirmar entra en espera; iniciar reanuda | passed | 1690 |
| mobile | `interaction.spec.ts` | INT-05 · cambiar de vista 100 veces no reinicia ni duplica el motor | passed | 1381 |
| mobile | `interaction.spec.ts` | INT-06 · rueda sin selección, flechas sin selección y bloqueo de controles no cambian nada | passed | 1989 |
| mobile | `interaction.spec.ts` | Modo explica en texto los modos que no se simulan | passed | 409 |
| mobile | `interaction.spec.ts` | PRC-01 (UI) · bloqueo inspiratorio válido, con hora, que persiste al cerrar y reabrir el panel | passed | 4042 |
| mobile | `interaction.spec.ts` | Pausar, velocidad y Congelar viven en .signal-toolbar y no se confunden | passed | 694 |
| mobile | `interaction.spec.ts` | SC-09 · la oclusión se resuelve con controles visibles: reconocer y Restablecer mecánica | passed | 2369 |
| mobile | `interaction.spec.ts` | SEC-01/02 · sin tráfico externo; marca de simulación discreta presente en todas las vistas y en el bisel | passed | 667 |
| mobile | `interaction.spec.ts` | TIM-03 · pestaña oculta: pausa discreta y reanudación manual sin salto de reloj | passed | 3040 |
| mobile | `interaction.spec.ts` | abrir el circuito en Eventos dispara la alarma alta; deshacer la resuelve y reconocer devuelve la banda al azul | passed | 5869 |
| mobile | `interaction.spec.ts` | aplica, deshace y restablece mecánica con perfiles completos | passed | 606 |
| mobile | `interaction.spec.ts` | aplicar un perfil en Paciente conserva sesión, tiempo, ajustes y lo hecho en la práctica | passed | 2549 |
| mobile | `interaction.spec.ts` | cada tarjeta deja como máximo un párrafo visible fuera de «Por qué» | passed | 941 |
| mobile | `interaction.spec.ts` | cargar SC-24 muestra la amplitud evocada 8 en el panel del paciente | passed | 467 |
| mobile | `interaction.spec.ts` | el Menú del equipo conserva sólo sus cuatro entradas funcionales | passed | 447 |
| mobile | `interaction.spec.ts` | el bucle Pva·V con presión total se ve en el panel docente | passed | 477 |
| mobile | `interaction.spec.ts` | el campo vacío no vale como cero y el Resumen no revela las cifras tapadas | passed | 728 |
| mobile | `interaction.spec.ts` | el contexto del encabezado muestra el caso y abre la lista de casos en el panel, sin diálogo | passed | 440 |
| mobile | `interaction.spec.ts` | el cursor cae donde apunta el puntero: el centro de la rejilla es el centro de la ventana | passed | 5217 |
| mobile | `interaction.spec.ts` | el cursor se maneja con el teclado, se anuncia, y sigue midiendo al recorrer la historia | passed | 5008 |
| mobile | `interaction.spec.ts` | el diálogo de personalización cierra con Escape y devuelve el foco | passed | 636 |
| mobile | `interaction.spec.ts` | el interruptor vive en el menú «…» y no en el monitor | passed | 410 |
| mobile | `interaction.spec.ts` | escritorio agrupa las opciones en ⋯ y Audio alterna aria-checked | skipped | 127 |
| mobile | `interaction.spec.ts` | la barra muestra como máximo cinco controles interactivos | passed | 381 |
| mobile | `interaction.spec.ts` | la escala alterna entre automática y fija | passed | 507 |
| mobile | `interaction.spec.ts` | la pantalla de protección lee el índice de estrés y construye la titulación con lo medido | passed | 3794 |
| mobile | `interaction.spec.ts` | la pantalla de ventilación muestra la gasometría del modelo y el monitor nunca la muestra | passed | 1949 |
| mobile | `interaction.spec.ts` | la primera visita ofrece explorar o casos clínicos; la bienvenida no se repite | passed | 504 |
| mobile | `interaction.spec.ts` | la selección de 6 casillas grandes persiste y vuelve a 13 sin romper la tabla | passed | 664 |
| mobile | `interaction.spec.ts` | la tecla muestra lo entregado; la propuesta confirmada se anuncia aparte con su flecha | passed | 615 |
| mobile | `interaction.spec.ts` | la velocidad se actualiza desde el menú y Escape devuelve el foco | passed | 575 |
| mobile | `interaction.spec.ts` | la versión vive en el panel docente y ya no existe el listón de seguridad | passed | 500 |
| mobile | `interaction.spec.ts` | los controles de tiempo caben sin desbordar el ancho del viewport | passed | 381 |
| mobile | `interaction.spec.ts` | los paneles laterales: uno a la vez, Esc devuelve el foco y se cierran al ir a Casos | skipped | 72 |
| mobile | `interaction.spec.ts` | los perfiles están deshabilitados en una referencia fotográfica | passed | 386 |
| mobile | `interaction.spec.ts` | los valores medidos se ocultan hasta que el alumno los estima | passed | 811 |
| mobile | `interaction.spec.ts` | recorrer la historia desplaza la ventana en el tiempo | passed | 5063 |
| mobile | `interaction.spec.ts` | restablecer preferencias las borra y avisa que se aplicará al recargar | passed | 483 |
| mobile | `interaction.spec.ts` | restaura escenario, vista y ventana de curvas al recargar | passed | 729 |
| mobile | `interaction.spec.ts` | sin bloqueo no inventa números; con bloqueo enseña la cuenta con los del monitor | passed | 3476 |
| mobile | `interaction.spec.ts` | subir PEEP por encima de la apertura recluta; bajarla por encima del cierre lo conserva | passed | 4936 |
| mobile | `interaction.spec.ts` | tocar o pulsar la curva congelada basta para medir | passed | 5216 |
| mobile | `interaction.spec.ts` | tres controles a la vista; la mecánica avanzada sale de la barra en cuatro pestañas, un grupo a la vez | passed | 637 |
| mobile | `interaction.spec.ts` | un `speed` ilegible se descarta con aviso y el motor avanza igual | passed | 411 |
| mobile | `interaction.spec.ts` | un escenario de la dirección tiene prioridad sobre el guardado | passed | 383 |
| mobile | `interaction.spec.ts` | una intervención conserva automáticamente la última respiración completa como «Antes» | passed | 2289 |
| mobile | `interaction.spec.ts` | una sesión importada no evalúa el caso clínico que estaba abierto | passed | 559 |
| mobile | `interaction.spec.ts` | una velocidad personalizada de la URL aparece en Revisar curvas y tiempo | passed | 492 |
| mobile | `interaction.spec.ts` | «TET 7,0 mm» fija el deslizador K₂ a 9,2 y moverlo a mano deja «Personalizado» | passed | 714 |
| mobile | `measurementFidelity.spec.ts` | SC-09 prolongada: fuga sin denominador muestra motivo | passed | 4622 |
| mobile | `measurementFidelity.spec.ts` | SC-18: el bloqueo espiratorio con esfuerzo no delata el músculo en la cara del equipo | passed | 14211 |
| mobile | `measurementFidelity.spec.ts` | meseta estable con esfuerzo: el equipo muestra lo que mide y el Aula avisa que no es mecánica pasiva | passed | 1721 |
| mobile | `measurementFidelity.spec.ts` | pausa de ciclo: el equipo publica la meseta estable con o sin esfuerzo, sin delatar el músculo | passed | 1826 |
| mobile | `mobile.spec.ts` | Paciente conserva targets táctiles; la mecánica avanzada se abre a pantalla completa sobre la hoja | passed | 841 |
| mobile | `mobile.spec.ts` | datos grandes: los seis valores a la vista en dos columnas; bucles apilados; la alarma no se recorta | passed | 2887 |
| mobile | `mobile.spec.ts` | el diálogo conserva su caja y cabe en cada pestaña a 375 px | passed | 813 |
| mobile | `mobile.spec.ts` | elimina la barra redundante y arranca con el panel cerrado y compacto | passed | 519 |
| mobile | `mobile.spec.ts` | escritorio: la ventana arranca en 12 s | skipped | 112 |
| mobile | `mobile.spec.ts` | guía: cerrar, campos, deslizadores, interruptores y pestañas | passed | 572 |
| mobile | `mobile.spec.ts` | la cabecera muestra Buscar y ⋯; el menú añade Sesión | passed | 657 |
| mobile | `mobile.spec.ts` | la hoja del panel docente abre, cierra con el botón o Escape y devuelve el foco | passed | 742 |
| mobile | `mobile.spec.ts` | la hoja vuelve a la columna del panel al ensanchar el viewport | passed | 828 |
| mobile | `mobile.spec.ts` | las cuatro pestañas dan la misma ventana, en el mismo sitio | passed | 663 |
| mobile | `mobile.spec.ts` | límites: cerrar, campos, deslizadores, interruptores y pestañas | passed | 531 |
| mobile | `mobile.spec.ts` | menú: cerrar, campos, deslizadores, interruptores y pestañas | passed | 505 |
| mobile | `mobile.spec.ts` | modos: cerrar, campos, deslizadores, interruptores y pestañas | passed | 679 |
| mobile | `mobile.spec.ts` | móvil (< 700 px): la ventana arranca en 6 s | passed | 462 |
| mobile | `mobile.spec.ts` | nada flota sobre los ajustes: Pausar y Personalizar quedan en la cabecera, siempre a la vista | passed | 568 |
| mobile | `mobile.spec.ts` | sin desbordamiento; las trece cifras a la vista y legibles; el monitor cabe en su ventana; el editor fuera del monitor | passed | 969 |
| mobile | `mobile.spec.ts` | sin desborde al cargar, abrir Menú y cambiar cada vista | passed | 3101 |
| mobile | `palette.spec.ts` | Ctrl+K abre la paleta y permite aplicar un perfil | passed | 723 |
| mobile | `palette.spec.ts` | Escape cierra la paleta y devuelve el foco al botón | passed | 743 |
| mobile | `palette.spec.ts` | filtra vistas y ejecuta la selección con las flechas | passed | 754 |
| mobile | `palette.spec.ts` | la cabecera no desborda horizontalmente | passed | 485 |
| mobile | `palette.spec.ts` | permite cargar un caso clínico por su identificador y lo presenta en el panel | passed | 567 |
| mobile | `palette.spec.ts` | una consulta sin coincidencias no ejecuta nada | passed | 765 |
| mobile | `pc.spec.ts` | Escape cierra primero el diálogo y el reloj del monitor muestra la hora del día | passed | 1476 |
| mobile | `pc.spec.ts` | PEEP: el primer paso del deslizador es Off, no 0 | passed | 708 |
| mobile | `pc.spec.ts` | VTesp bajo y FR alta configurados en el diálogo se activan mientras ventila y se reflejan en la banda | passed | 961 |
| mobile | `pc.spec.ts` | bloqueo inspiratorio rechazado por Pmáx: resultado no válido con motivo legible y aviso | passed | 1540 |
| mobile | `pc.spec.ts` | cambiar a A/C PC desde el menú de modos: teclas rápidas, curvas y VT esperado | passed | 2716 |
| mobile | `pc.spec.ts` | deslizador recorre sólo valores admitidos; ± y deslizador coinciden; escritura fuera de rejilla sugiere el más cercano | passed | 2091 |
| mobile | `pc.spec.ts` | el VTesp mostrado cambia entre ciclos alrededor del volumen programado | passed | 12517 |
| mobile | `pc.spec.ts` | la columna de presión desciende de forma progresiva al terminar la inspiración | passed | 8511 |
| mobile | `pc.spec.ts` | menú de modo: flujo de base y disparo por presión; el disparo por flujo no puede superar el flujo de base | passed | 1539 |
| mobile | `pc.spec.ts` | ▶ es idempotente mientras hay solicitud; «Cancelar» la anula y se anuncia | passed | 890 |
| mobile | `ps.spec.ts` | SC-19: apnea provocada → alarma alta y respaldo; al deshacerla la apnea se resuelve y el respaldo sigue hasta confirmar el modo | passed | 7227 |
| mobile | `ps.spec.ts` | cambiar a CPAP/PS desde el menú de modos: bloque de respaldo, teclas rápidas y respiraciones espontáneas | passed | 5552 |
| mobile | `regresion.spec.ts` | VR-01 · alarma-alta | passed | 2680 |
| mobile | `regresion.spec.ts` | VR-01 · aula | skipped | 122 |
| mobile | `regresion.spec.ts` | VR-01 · ayudas | skipped | 93 |
| mobile | `regresion.spec.ts` | VR-01 · bloqueo | skipped | 91 |
| mobile | `regresion.spec.ts` | VR-01 · bucles | skipped | 111 |
| mobile | `regresion.spec.ts` | VR-01 · curvas | passed | 1751 |
| mobile | `regresion.spec.ts` | VR-01 · datos-grandes | skipped | 109 |
| mobile | `regresion.spec.ts` | VR-01 · datos-modelo | skipped | 98 |
| mobile | `regresion.spec.ts` | VR-01 · editor | skipped | 82 |
| mobile | `regresion.spec.ts` | VR-01 · espera | passed | 1528 |
| mobile | `regresion.spec.ts` | VR-01 · fuga | skipped | 111 |
| mobile | `regresion.spec.ts` | VR-01 · guia | passed | 604 |
| mobile | `regresion.spec.ts` | VR-01 · limites | passed | 1518 |
| mobile | `regresion.spec.ts` | VR-01 · modos | passed | 1468 |
| mobile | `regresion.spec.ts` | VR-01 · panel | passed | 459 |
| mobile | `regresion.spec.ts` | VR-01 · sesion | skipped | 141 |
| mobile | `regresion.spec.ts` | VR-01 · tabla | skipped | 82 |
| mobile | `regresion.spec.ts` | VR-01 · tendencias | skipped | 81 |
| mobile | `regresion.spec.ts` | VR-01 · vista | skipped | 134 |
| mobile | `teachingHonesty.spec.ts` | SC-25 mantiene sus límites visibles en los Fundamentos | passed | 1378 |
| mobile | `teachingHonesty.spec.ts` | la ayuda del bloqueo anuncia la maniobra que está abierta | passed | 1020 |
| mobile | `visual.spec.ts` | DAT-08 · grupos y estado Pplat cambian al completar un bloqueo válido | passed | 1838 |
| mobile | `visual.spec.ts` | VIS · el exterior usa tema claro y conserva el fondo del equipo | passed | 417 |
| mobile | `visual.spec.ts` | VIS · panel Paciente compacto a 1440 px: gases, perfiles, mecánica y eventos sin desplazarse | skipped | 117 |
| mobile | `visual.spec.ts` | VIS-01 + DAT-02 · P1: panel denso y bloqueo; Pplat de bloqueo 32 y Cstat 19 fechados | passed | 843 |
| mobile | `visual.spec.ts` | VIS-02 + DAT-01 · P3: datos grandes; FiO2 set 100 / medida 97; VT set 285 / VTesp 295 | passed | 745 |
| mobile | `visual.spec.ts` | VIS-03 · banco SC-01 a t = 12 s: curvas, números y manómetro | passed | 1027 |
| mobile | `visual.spec.ts` | VIS-04 · alarma de Pmáx (SC-09): banda roja, luz del bisel y celda resaltada | passed | 2682 |
| mobile | `visual.spec.ts` | VIS-05 · vistas de bucles, tabla, tendencias y registro son funcionales | passed | 2084 |
| mobile | `visual.spec.ts` | VIS-06 · A/C PC: presión cuadrada con rampa, flujo decelerante y volumen exponencial; vista básica como P3 | passed | 1963 |
| mobile | `visual.spec.ts` | VIS-08 · CPAP/PS (SC-19): presión a PEEP + PS, flujo cortado al 25 % del pico, volumen del paciente | passed | 1688 |
| mobile | `visual.spec.ts` | no usa iconos informativos y sus descendientes caben | passed | 477 |

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
