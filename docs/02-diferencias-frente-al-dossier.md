# Diferencias frente al dossier y decisiones tomadas en esta etapa

Referencia: dossier v1.0 (06-09-2026). Se listan sólo desviaciones o precisiones; lo que coincide no se repite.

## Investigación propia añadida

| Fuente nueva o reverificada | Qué aporta | Consecuencia |
| --- | --- | --- |
| Guía rápida JB77395XX (2020, 16 pp) leída íntegra | Confirma seleccionar→girar→pulsar (p.8), banda gris con alarma previa (p.8), colores y tonos (p.9), tecla de pausa de audio 2 min (p.4), ↑O2 2 min +100 % adulto (p.12), Standby→Pause Ventilation/Cancel (p.14), cinco vistas del presente (p.13), plazo de cancelación no cuantificado (p.9) | Marcas D directas en `evidence.json` (E-001…E-009) |
| Ficha JB23840CO (2014, 8 pp) leída íntegra | Rangos y escalones, bloqueos 2–40 s / 2–60 s, familias de temporización, precisión de monitorización, tendencias, capturas | Reglas de ajuste con evidencia por tramo; familia 2 elegida por O |
| Guía de resolución de problemas JB79437XX (2020) leída íntegra | Plimit impide entregar todo el VT en VC; Pmax limita en adaptativos; alarma de Ppico evaluada antes de refrescar pantalla; auto-disparo por fuga | Evaluación de Pmáx sobre valor bruto por sub-paso (ALM-05) |
| Curso «Modos de ventilación invasiva» JB72469XX (ES, 2020, 49 diapositivas) — no citado en el dossier | En VC, al alcanzar el límite el flujo baja para sostener la presión; el ventilador ajusta el flujo en las respiraciones siguientes; cotas de PRVC (PEEP+Pmin…Pmax−2; ±3/resp; −0,5 tras alarma); compensación de tubo limitada a Pmax−5 | Nueva brecha U-19 (adaptación de flujo no implementada); cotas guardadas para la etapa de adaptativos |
| Guía SW10 (ManualMachine) | HTTP 403 | Sus citas quedan «D-secundario» (fin de inspiración por Pmáx) |
| URM Rev F (GE/ASPR) | HTTP 502 | U-17 confirmada |

## Desviaciones respecto a propuestas del dossier

1. **Vista básica sin curvas, dividida y tabulada**: el dossier las mapea; aquí se desactivan con motivo (composición no observada, U-04) en lugar de construirlas como decoración.
2. **Pplat de panel**: el dossier deja abierto (U-13) cómo lo obtiene el equipo. Decisión: sólo con pausa ≥ 0,1 s y meseta estable; sin pausa el panel muestra `---`. La fixture P1 (35 sin pausa aparente) se conserva como transcripción, no como comportamiento del motor.
3. **BM-03**: el dossier lo formula como «PC ideal». Como PC no está habilitado, se ejecuta sobre el integrador de fuente de presión del modelo (mismas cifras analíticas: 0,432332 L, 1 y 0,135335 L/s). Se declara como prueba de modelo, no de modo.
4. **BM-06**: mis primeras cifras analíticas sumaban PEEP dos veces (error que la regla 3 prohíbe); el motor tenía razón. Cifras correctas registradas en el test: Plimit 25 se alcanza a 0,6 s (VT 0,38647 L); Pmáx 30 a 0,8 s (VT 0,4 L).
5. **Estabilidad del bloqueo**: la primera versión evaluaba sólo el último 30 % de la ventana y dejaba pasar un esfuerzo a mitad del bloqueo (PRC-02 lo detectó). Ahora se evalúa toda la ventana tras un arranque de min(0,5 s, 30 %).
6. **Hora del resultado**: se toma del instante exacto del fin de la maniobra en tiempo simulado, no del paso del reloj (desfase de 4 ms detectado por PRC-01).
7. **Presión en el cruce de Pmáx/Plimit**: se fija exactamente al umbral en el instante del cruce; antes se registraba la presión hipotética del flujo completo (Ppico 205 en SC-09).
8. **Pestaña oculta** *(superado en v0.2: la reanudación es manual)*: política P = pausa explícita al ocultar y reanudación automática al volver sin recuperar el tiempo perdido; la discontinuidad queda en el registro y en la barra de navegación. El dossier admite cualquiera de las dos políticas si es explícita.
9. **FR y VMesp**: ventana de 8 respiraciones (Σ VTesp / Σ periodo × 60) en vez de ventana temporal de 60 s, para evitar cuantización en los primeros segundos. Documentado en cada muestra (`windowMs`).
10. **Escalas de curvas**: manuales con tres juegos (P1, P3, amplia). Sin autoescala con histéresis todavía.
11. **Audio**: patrones D; timbre, frecuencias y cadencia P; sin certificación normativa.
12. **Bias flow**: figura como control D del modo pero no tiene efecto en el modelo mínimo; no se expone como editable.
13. **Tipografía e iconos**: sustitutos del sistema y glifos Unicode (U-02/U-03); no se afirma resolución nativa.

## Lo que no se afirma

- Ningún porcentaje de fidelidad frente al equipo (U-18).
- Ninguna equivalencia de versión de firmware (U-01).
- Ninguna validación clínica ni conformidad normativa de alarmas.

## Revisión adversarial de contexto limpio (06-09-2026)

Un agente revisor independiente leyó el motor contra las 12 reglas críticas y reprodujo empíricamente los hallazgos. Resultado: 13 hallazgos (1 alto, 5 medios, 7 bajos). Todos los altos y medios y la mayoría de los bajos quedaron corregidos con prueba de regresión (`tests/unit/review.test.ts`):

| # | Hallazgo | Arreglo |
| --- | --- | --- |
| 1 (alto) | Al terminar ↑O2 por temporizador o por espera se restauraba el ajuste de FiO2 pero no el mezclador: pantalla 21 %, sensor 100 % | El evento `settingsApplied` es la única fuente del objetivo del mezclador |
| 2 | Orden manual y disparo en el mismo sub-paso apilaban una respiración con espiración de 4 ms | La orden manual tiene precedencia y nunca queda pendiente |
| 3 | Espera durante un bloqueo espiratorio en curso creaba una respiración fantasma y activaba alarmas en espera | El controlador cierra el bloqueo sin reanudar; los eventos se drenan antes de apagar la monitorización |
| 4 | Poner un límite en Off dejaba la alarma activa para siempre | Off resuelve y reconoce (U-27) |
| 5 | Una inspiración acortada por Pmáx acortaba el periodo: FR medida 15,8 con FR 15 | El temporizador de FR gobierna la obligatoria (U-26) |
| 6 | Inicialización, comandos e importación sin validar podían congelar el motor o producir NaN | Validación de dominios y de paciente en constructor, comandos e importación; tope de sub-pasos; evento de discontinuidad si se agota la guarda |
| 7 | Importar una sesión heredaba perturbaciones del escenario anterior | Se limpian al importar |
| 8 | Pplat de ciclo podía publicarse válida en una respiración terminada por Pmáx | Siempre null con motivo |
| 9 | La curva de volumen tidal tomaba su base al final del paso, no al inicio real de la respiración | El evento de inicio lleva el volumen exacto |
| 10 | La vista previa de la UI validaba sin los ajustes pendientes | Se valida contra activos + pendientes, como el motor |
| 11 | Reseleccionar la misma tecla descartaba el borrador | Conserva el borrador |
| 12 | Literales de unidades en vez de `units.ts` | Sustituidos |
| 13 | Varios: pausa pre-empted por Plimit mal etiquetada; flujo inverso dentro de un sub-paso limitado; bloqueo espiratorio nunca ejecutado con paciente que dispara; pausa de audio no reproducible en replay | Corregidos (válvula unidireccional en la integración; U-28; la pausa de audio es estado del motor) |

También señaló dos pruebas vacías: BM-08 usaba una referencia numérica del mismo orden de error que el paso fino (ahora usa la solución analítica) y PHY-10 pasaba con inspiraciones de duración cero (ahora exige volumen y tiempo positivos y trata la oclusión total como caso aparte).

## v0.2 · adopción del sistema visual y de interacción de «R860 Lab» (06-09-2026)

A petición del usuario se conservó el motor, el protocolo y las pruebas de este proyecto y se sustituyó la capa de interfaz por el diseño de R860 Lab v1.1 (código MIT; nota de licencia en `LICENSES/R860-LAB-MIT.txt`): `assets/styles.css`, los símbolos SVG de `index.html`, la estructura de interacción de `src/app.js`, el estilo de dibujo de `src/plots.js` y los textos de ayuda de `src/help.js`, portados a TypeScript sobre los cuadros del motor propio.

Desviaciones respecto al dossier que esto implica:

- **Marca de simulación**: el mandato pedía «SIMULACIÓN EDUCATIVA · NO USO CLÍNICO» siempre visible en el marco. El usuario pidió eliminar las franjas llamativas. Se conserva de forma discreta: franja inferior de la página, firma del bisel, encabezado de cada diálogo, marca de agua de las capturas PNG y aviso en la superposición de espera. Registrado como U-29.
- **Cromado exterior, iconos y otras vistas** (bucles, tabla, tendencias, registro): reinterpretación de R860 Lab, no observación de las fotografías. Las vistas ya no están desactivadas: se alimentan de los mismos cuadros del motor (bucles y tendencias por ciclo, tabla con calidad y origen, registro de eventos).
- **Pestaña oculta**: la reanudación pasa a ser manual (aviso + botón Reanudar), como en R860 Lab.
- **Etiquetas**: se conservan las observadas (Ppico, PEEPe, Pplat, Pmedia, VMesp, FR, VTesp, FiO₂, Bloqueo insp/esp, EN ESPERA, punto decimal); se añaden ΔP estática y Cstat de bloqueo con antigüedad («Med. mm:ss»).
- **Códigos D/P/U fuera de la interfaz del alumno**: la procedencia vive en evidence.json, gaps.json y en la guía; los diálogos hablan en lenguaje clínico.

Defectos de R860 Lab documentados en su memoria técnica (H1 balance de fuga en PC, H2 restauración JSON laxa, H3 cronómetro SBT, H4 FR/VM antiguas, H5 panel de maniobra tapando controles) no se heredan: PC/SBT/fuga no existen aquí; la importación se valida (SEC-03, H6); FR/VM llevan calidad «antiguo» y ventana publicada; el panel de maniobra se cierra al cambiar de vista con una acción explícita.

## v0.3 · presión control, ajuste libre y bloqueos honestos (06-09-2026)

- **A/C PC habilitado** (E-029, E-030): fase `inspPressure` con objetivo PEEP + Pinsp, rampa lineal en `riseMs` (U-30) y tope de flujo del actuador de 160 L/min (U-31). Pplat de ciclo queda nula con motivo «sin oclusión» porque en PC no hay pausa de flujo cero garantizada; la Pplat válida sigue siendo la del bloqueo inspiratorio. Banco: BM-03 resuelto en el motor (VT 432 mL, flujo pico 60 L/min, flujo final 8,1 L/min) y pruebas por propiedades PHY-02 (R × 2 halva el flujo pico; C / 2 halva el VT; Ti > 4 τ no añade volumen; PEEP desplaza la curva sin cambiar el VT). La fisiología y las citas están en `docs/03-fisiologia-curvas.md`.
- **Ajuste con el ratón** (E-031, U-32): el deslizador del editor rápido recorre por índice la rejilla de valores admitidos (tramos de paso distinto, Off como primer paso si la regla lo permite). Así el arrastre nunca produce un valor fuera de rejilla ni fuera de dominio, y ± / deslizador / rueda de la perilla producen exactamente el mismo escalón. La escritura libre sigue permitida; fuera de rejilla se rechaza indicando el valor admitido más cercano (no se aproxima en silencio).
- **Bloqueos** (E-032): el fallo observado («no siempre gatilla la pausa») tenía dos causas. (1) Cuando Pmáx termina la inspiración, el controlador rechazaba el bloqueo inspiratorio sin dejar rastro: ahora queda como resultado no válido con motivo legible y hora, y se avisa. (2) Pulsar ▶ con una solicitud en cola la cancelaba sin decirlo: el botón pasa a «Cancelar solicitud» y la cancelación se anuncia. En móvil la ventana de bloqueo sale del monitor escalado, como el editor.
- **Lenguaje**: calidad de dato, canal, prioridad y registro de eventos en frases (sin `pmaxEndedInspiration`, `(P)` ni `SC-01` en la pantalla del alumno); el reloj del monitor muestra la hora del día (la hora de sesión sigue en la barra de señal), como en las fotos.
- **Vista básica** como en P3: tres curvas estrechas a la izquierda y seis valores grandes con unidad y límites de alarma en cian.
- **Herramientas**: oxlint (typescript-eslint no admite el paquete `typescript` 7 nativo), Prettier, cobertura v8 (82 % de líneas) y CI en GitHub Actions. `app.ts` se reformateó; la separación en módulos (`humanize.ts`) es parcial y sigue pendiente extraer lección y exportaciones.

## v0.3.1 · correcciones tras la tercera revisión adversarial (06-09-2026)

Una tercera lectura adversarial de contexto limpio revisó el motor de PC, los bloqueos, la importación y la capa de interfaz. Lo que cambió, con su marca:

- **Flujo de base espiratorio** (E-033, U-33; **P**): la válvula espiratoria de v0.3 era una fuente de presión ideal (Pva = PEEP siempre), de modo que un esfuerzo del paciente nunca deflectaba la presión y el disparo por flujo era la única señal visible. Ahora la válvula sostiene la PEEP sólo hasta un flujo de base de 10 L/min hacia el paciente; por encima, la Pva cae por debajo de PEEP (deflexión de disparo). El valor del equipo no está en las fuentes leídas y el disparo por presión no existe (U-33). La cota del flujo espiratorio pico sigue sin modelarse (U-35; resistencia de válvula no documentada).
- **Tope de flujo en PC dentro del integrador** (E-034; **P**): el tope de 160 L/min se aplicaba fuera del RK2 y producía un sobreimpulso de presión que dependía de dt; ahora se integra dentro del mismo RK2 con sub-pasos (`tests/bench/pc.test.ts`).
- **Cstat del bloqueo con PEEPtot** (E-035; **P**): si existe un bloqueo espiratorio válido reciente con la misma PEEP programada, el denominador de Cstat es Pplat − PEEPtot; si no, Pplat − PEEPe y el motivo lo dice. Antes, con auto-PEEP, la carga elástica se sobreestimaba (Natalini 2016, docs/03 §5).
- **Aviso «Presión limitada por Plimit»** (E-036; **P**, comportamiento del R860 **no verificado**): alarma de prioridad media cuando la inspiración termina limitada por Plimit, para que el alumno vea por qué el VT queda corto. R07 describe el evento, no la alarma.
- **Plimit > Pmáx** (U-34; **P**): se permite con una advertencia no bloqueante; SC-09 depende de ello. Si el equipo lo prohíbe, no está documentado en lo leído.
- **Duraciones de bloqueo por tipo** (E-018; **D** rangos, **P** aplicación): el motor exigía 1–60 s para ambos bloqueos; ahora exige 2–40 s (inspiratorio) y 2–60 s (espiratorio) según `INSP_HOLD_RULE`/`EXP_HOLD_RULE`, igual que el deslizador de la interfaz.
- **Importación** (E-037; **P**): se validan esfuerzo, sensores, modo y claves desconocidas; se aceptan sesiones de motor 0.2.0 y 0.3.0 con aviso de reproducción no idéntica (`tests/unit/session.test.ts`, `tests/unit/boundaries.test.ts`).
- **Citas de evidencia**: E-014 citaba una prueba «ALM-01» inexistente; ahora cita las pruebas reales de fin de inspiración por Pmáx (ALM-05/06, FR bajo Pmáx, dominio de fallo, VIS-04). `PROFILE.enabledModes` declara `['AC_VC', 'AC_PC']` y la interfaz lo lee.
- **Interfaz** (**P**, reinterpretación de R860 Lab): el editor emergente ya no tapa las teclas de vista; el botón ▶ del bloqueo es idempotente (repetirlo no cancela) y la cancelación tiene su propio botón «Cancelar»; la banda de alarmas es región `aria-live` y muestra el estado «reconocida»; objetivos táctiles ≥ 44 px en móvil; tema claro para el cromado exterior (el monitor conserva su paleta); cuenta atrás visible del plazo de edición (U-07); si el motor degrada (Worker caído o guarda de sub-pasos agotada) aparece un aviso permanente en lugar de curvas congeladas en silencio.
- **Estructura**: `src/ui/app.ts` se dividió en `exports.ts` (JSON/CSV/PNG), `lesson.ts` (panel docente), `metricsTable.ts` (tabla de mediciones), `patientControls.ts`, `dom.ts` y `format.ts`; `app.ts` conserva la composición y los diálogos.
- **Cobertura honesta**: `vitest.config.ts` fija umbrales medidos (líneas 36 · ramas 31 · funciones 30 · sentencias 35; valor medido menos dos, redondeado hacia abajo). La cifra sobre todo `src/` (38,7 % de líneas) es baja porque la capa de interfaz sólo la ejercita Playwright y figura con 0 %; excluyendo `src/ui/**`, `src/render/**` y `main.ts` la cobertura medida es 87,8 % de líneas. La cifra «82 % de líneas» de la nota v0.3 no era comparable (se calculó sobre los archivos que Vitest importaba, no sobre todo `src/`). CI publica `coverage/coverage-summary.json` y falla si falta.

## v0.3.2 · cierre de las brechas U-33, U-34 y U-35 (06-09-2026)

- **Flujo de base** (E-038, D ficha JB23840CO p.2): ajuste `Flujo de base` 2–10 L/min en pasos de 0,5, en el menú de sincronización de ambos modos. Sustituye la constante de 10 L/min. Regla P derivada de la física del disparo: el umbral de disparo por flujo no puede superar el flujo de base (mensaje legible). Valor inicial 2 L/min (P).
- **Disparo por presión** (E-039, D ficha p.2): casilla «Disparo por presión» y umbral −10 a −0,25 cmH₂O con los dos tramos de paso de la ficha; dispara cuando la Pva cae bajo PEEP + umbral. Con el flujo de base ya modelado, la deflexión de presión existe y el disparo por presión es funcional.
- **Plimit frente a Pmáx** (E-040): revisadas la ficha 2014, el curso JB72469XX y la guía rápida: ninguna impone Plimit ≤ Pmáx; el curso sólo documenta Pmáx − 2 cmH₂O en PRVC y Pmáx − 5 con compensación de tubo. Se conserva el aviso no bloqueante. La brecha queda cerrada en lo público; sólo el manual de usuario completo (inaccesible: 403/502) podría añadir una regla.
- **Resistencia de la rama espiratoria** (E-041): nuevo parámetro `rExpValve` 0–6 cmH₂O·s/L (techo normativo ≤ 6 cmH₂O citado por el manual) en serie con Rexp, deslizador en «más parámetros» del panel docente, 0 por omisión para no alterar el banco. Acota el flujo espiratorio pico y eleva la Pva sobre PEEP durante la espiración (SYN-03).
- Pruebas: `tests/unit/sync.test.ts` (SYN-01…03) y e2e del diálogo de modo; 105 pruebas unitarias.

## v0.3.3 · tema negro y ajuste a pantallas bajas (06-09-2026)

- **Tema de página negro fijo** por decisión del usuario: el cromo (cabecera, panel docente, diálogos, avisos) pasa a negro puro; el monitor del equipo conserva su azul de referencia. El tema claro introducido en v0.3.1 se retiró.
- **El equipo se encoge para caber en pantallas bajas** (MacBook Air 13″): la anchura de la carcasa se limita a `(alto de ventana − 290 px) × 1120/735`, de modo que el monitor completo, con teclas y perilla, queda visible sin desplazamiento vertical (verificado a 1440×820 y 1280×740). El panel docente sigue debajo cuando no cabe al lado.

## v0.3.4 · recorrido de escenarios y poda de la interfaz (06-09-2026)

- **Escenarios verificados uno a uno** por URL y por diálogo (script reproducible en `scripts/dev/`, fuera del repositorio): SC-01 Ppico 20 / VT 500; SC-02 Plimit 35 recorta cuando C baja a 20 (Pplat 30); SC-03 PEEPi 8,15 con flujo espiratorio que no vuelve a cero; SC-04 Plimit 30 con VT 471; SC-05 esfuerzos que no disparan; SC-09 Pmáx termina la inspiración con VT 0; SC-10 VTe > VTi por el flujo de base con asistencia apagada; SC-12 FiO₂ medida 97,3 con entrega 100; SC-13 VT 306 mL tras doblar Rinsp en PC; SC-P Ppico 34 con PEEP 16.
- **Dos defectos corregidos**: SC-05 no arrancaba (disparo 3 L/min > flujo de base 2 L/min); un escenario en VC cargado tras uno en PC heredaba el modo PC (los ajustes parten ahora de los valores del perfil). SC-05 baja el esfuerzo a 0,4 cmH₂O para que realmente no dispare con 3 L/min.
- **Poda por decisión del usuario**: sin leyendas «Simulación de ventilación / Inspirado en», «REFERENCIA VISUAL», «FUERA DEL EQUIPO», pie de instrucciones, pie del panel docente ni franja «NO USO CLÍNICO» (queda la firma pequeña del bisel y «Acerca del simulador» en el pie); sin avisos rutinarios al cargar escenario, confirmar ajustes, reconocer alarmas, guardar captura o cambiar audio; tarjetas de escenario sin párrafo (descripción como tooltip); diálogos compactos (tipografía 11–15 px, rejilla de 4 columnas, lista de modos sin explicaciones).

## v0.3.5 · segunda poda y arranque inmediato (06-09-2026)

- **Calentamiento al cargar** (P, sólo presentación): al iniciar o cambiar de escenario el motor adelanta dos ciclos al instante, así la pantalla muestra curvas y valores desde el primer cuadro en vez de esperar 4–8 s a 1×. El registro de la sesión sigue empezando en t = 0.
- **Límites de alarma conservados al cambiar de escenario** (antes volvían a los valores iniciales y el usuario percibía que «la alarma no se activaba»).
- **Generación del motor** en cada cuadro: la lección se reinicia con el primer cuadro de la sesión nueva, lo que evitaba objetivos «cumplidos» con cuadros del escenario anterior. Sin aviso de «Objetivo realizado»: la lista de objetivos ya lo muestra.
- Poda: firma «SIMULACIÓN EDUCATIVA» del bisel retirada (queda «R860 LAB»); datos del modelo (τ, PEEPi, volumen absoluto, O₂, Pmus) plegados bajo «Datos del modelo»; el botón del panel docente pasa a icono en la cabecera; tarjetas de escenario con categoría a la izquierda y nivel a la derecha.

## v0.3.6 · Plimit como indicador, arranque con ventana llena y pasada de diseño (06-09-2026)

- **Plimit ya no es alarma**: cuando la inspiración termina limitada por Plimit, aparece una etiqueta «Plimit» junto a Ppico (E-036 pasa de alarma P a indicador P). Motivo: el usuario no configuró ninguna alarma y Plimit es un ajuste, no un límite de alarma; la conducta del R860 al respecto sigue sin verificar.
- **Carga de escenario**: medida en 0,2 s entre el toque y el primer cuadro; el motor adelanta tres ciclos (mínimo 12 s) para que la ventana de curvas aparezca llena; las curvas se siembran con el historial de la sesión nueva (antes el historial anterior filtraba las muestras nuevas y la pantalla quedaba vacía); velo con indicador giratorio sobre el monitor hasta el primer cuadro.
- **Diseño**: escala tipográfica 10/11/12/13/15 px y espaciado de 8 px en cabecera, título de escenario, panel docente (etiquetas cortas: «Compliance (C)», «Resistencia insp.», «Esfuerzo (Pmus)»), barra de señal y botones; sin subtítulo «Mecánica del paciente virtual» ni descargo de la lección.
- **Móvil**: la cabecera ya no ensancha el viewport de disposición (hacía inestables las capas fijas); botones del título de la ventana de bloqueo de 44 px y geometría estable.

## v0.3.7 · Pmáx como único techo visible (06-09-2026)

- Por decisión del usuario, **Pmáx es el techo de presión que el alumno ve y ajusta**; Plimit pasa a «Avanzado» en el menú de modo y por omisión queda en su máximo (100 cmH₂O), donde no actúa. Sólo el escenario «Mayor resistencia inspiratoria» lo baja a 30 para enseñar la diferencia entre limitar y terminar la inspiración. El aviso «Plimit por encima de Pmáx» no se muestra cuando Plimit está en su máximo. La tecla rápida de Plimit añadida en el PR #7 se retira.

## v0.3.8 · lectura de volumen con dispersión y manómetro amortiguado (07-09-2026)

- **El volumen mostrado deja de ser el volumen verdadero** (E-042, U-36): el sensor de flujo lee cada respiración con una ganancia 1 ± 2,5 % (uniforme, determinista a partir de la semilla), así que VTesp y VMesp cambian entre ciclos alrededor del VT programado, como en un equipo real. La envolvente está documentada en la ficha 2014 (lecturas de volumen ±10 % o ±10 mL; administración ±10 % del ajuste); la dispersión típica es P. VTi y VTe comparten la ganancia, de modo que la fuga mostrada sigue siendo nula, y las alarmas de volumen comparan el valor medido, como el equipo. El volumen del modelo (`BreathRecord.vtExp`) y las referencias analíticas del banco no cambian: el banco corre con el ruido apagado.
- **La columna de presión desciende amortiguada** (E-043): sube siguiendo la señal y baja con una constante de 0,11 s, para que el final de la inspiración se vea como un movimiento y no como un salto. Es amortiguación de presentación y sólo afecta a la columna: las curvas, las métricas y las alarmas usan la señal instantánea.
- **Ajuste fino visual**: la barra de señal se alinea con el ancho del equipo, el bisel inferior cede 19 px de alto al monitor y los selectores de la barra son más bajos.

## v0.4.0 · mecánica del tejido: relajación de esfuerzo y resistencia de Rohrer (07-09-2026)

Primer bloque de las mejoras de fidelidad acordadas con el usuario el 07-09-2026.

- **Relajación viscoelástica** (E-044): el elástico deja de ser un resorte puro. Un cuerpo de Maxwell opcional (elastancia E2 en serie con un amortiguador de constante τ2) reproduce la relajación de esfuerzo: al ocluir, la presión cae de inmediato lo resistivo (Ppico → P1 = R·Q exacto) y después decae exponencialmente hasta la meseta estática P2 = P0 + V/Cest. Con E2 = 0 el modelo se reduce **exactamente** al compartimento único, así que todas las referencias analíticas del banco siguen valiendo. Validado contra la solución cerrada: V − Vve = Q·τ2·(1 − e^(−t/τ2)) e independencia del paso de integración.
- **Consecuencia emergente**: la relajación produce atrapamiento por sí sola. En SC-14, con espiración de 3 s, aparece una auto-PEEP verdadera de 1,3 cmH₂O sin tocar la resistencia espiratoria, y la Cstat medida sólo recupera la compliance real cuando se usa la PEEP total de un bloqueo espiratorio (E-035).
- **Criterio de meseta replanteado** (E-045, U-38): antes exigía presión plana en toda la ventana, lo que con relajación rechazaba cualquier bloqueo. Ahora separa la **deriva** en el tramo final (¿ya se asentó?) de la **excursión contra la tendencia** en toda la ventana (esfuerzo, fuga u oscilación). Una relajación es monótona y no invalida; un esfuerzo mueve la presión en ambos sentidos y sigue invalidando con motivo propio («meseta perturbada»).
- **Resistencia de Rohrer** (E-046): K2 pasa de existir sin uso a ser un control del panel docente. Con K2 = 5, duplicar el flujo multiplica la caída resistiva por 2,4 en vez de por 2, y la meseta no cambia.
- **Defecto propio corregido** (E-047): la respiración siguiente a un bloqueo espiratorio tomaba como PEEPe la presión de la oclusión, lo que falseaba el ΔP y el motivo declarado de la Cstat. Ahora la PEEPe de referencia viene de la última espiración sin ocluir.
- **Escenario SC-14 «La meseta que sigue bajando»**: con E2 20 y τ2 1,5 s, un bloqueo de 2 s se declara no válido porque la presión aún no se asienta y uno de 5 s sí es válido. Panel docente: nuevos controles de E2, τ2 y K2, y lectura de la presión viscoelástica en «Datos del modelo».

## v0.4.1 · curva presión-volumen sigmoidea (07-09-2026)

Segundo bloque de las mejoras de fidelidad acordadas.

- **Compliance dependiente del volumen** (E-048, U-39): curva sigmoidea de Venegas opcional, V(P) = a + b/(1 + e^(−(P−c)/d)), anclada en V(P0) = 0. La compliance deja de ser un número único: vale b/(4d) en su máximo (P = c) y cae a los dos lados; los codos de máxima curvatura quedan en c ± 1,317·d. Fuera del intervalo útil la presión se prolonga con la tangente del borde, así que el modelo nunca devuelve infinitos aunque el ventilador insista por encima de la capacidad. Sin `sigmoid` el modelo es exactamente el lineal anterior.
- **Escenario SC-15 «Titular la PEEP sobre la curva P-V»**: con b 1,6 L, c 18 y d 5, la Cstat medida con bloqueo inspiratorio dibuja la U invertida esperada. Medido en la interfaz: 39 mL/cmH₂O a PEEP 5, 68 a PEEP 12, 74 a PEEP 18 y 32 a PEEP 24.
- **Panel docente**: controles de capacidad, punto de máxima compliance y anchura, más lectura de la compliance local al volumen actual y de la posición de los codos.

## v0.4.2 · espiración obstructiva: limitación al flujo y calibre dependiente del volumen (07-09-2026)

Tercer bloque de fidelidad mecánica. Hasta ahora la espiración era siempre un vaciamiento exponencial hacia la PEEP, por obstructivo que fuera el paciente.

- **Limitación al flujo espiratorio** (E-049, U-40): resistor de Starling. Por debajo de la presión crítica del segmento colapsable, el flujo deja de depender de la presión aguas abajo y queda fijado por el retroceso elástico y la resistencia aguas arriba, Qmax = (Pel − Pcrít)/(f·Rexp). Reproduce las tres consecuencias clásicas: espirar con más fuerza no saca más gas, el pulmón atrapa hasta que su retroceso iguala Pcrít (la PEEP total la fija el colapso, no la PEEP programada), y la limitación desaparece cuando la PEEP externa alcanza ese punto. Validado contra la solución analítica: durante la limitación el volumen decae hacia C·Pcrít con τ = f·Rexp·C.
- **Calibre dependiente del volumen** (E-050): Rexp(V) = Rexp·(1 + ganancia·(1 − V/Vref)). Sin él, el flujo espiratorio es exactamente proporcional al volumen y la rama espiratoria del bucle flujo-volumen es una **recta** (comprobado: desviación de la cuerda < 0,01 L/s). Con él la rama se hunde por debajo de la cuerda: es el bucle excavado del obstructivo.
- **Escenario SC-16 «Espiración estrangulada»**: colapso por debajo de 8 cmH₂O y resistencia que se triplica al vaciarse. Medido en la interfaz: con PEEP 3 la auto-PEEP es 6,0 cmH₂O; al subir la PEEP a 8 el estrangulamiento desaparece y el escalón que el paciente debe vencer para disparar cae a 2,7, mientras la PEEP total sólo pasa de 9,0 a 10,7.
- Panel docente: controles de presión crítica de colapso y de estrechamiento al vaciarse.

## v0.4.3 · dos unidades alveolares en paralelo: pendelluft y doble constante de tiempo (07-09-2026)

Cuarto bloque de fidelidad mecánica, y el que más cambia la forma de la espiración.

- **Segunda unidad en paralelo** (E-051, U-41): una unidad alveolar adicional con su propia compliance y resistencias, compartiendo el nodo de la vía aérea con la principal. El nodo se resuelve por bisección, así que las ramas pueden ser no lineales (Rohrer y limitación al flujo siguen actuando sobre la unidad principal) sin perder robustez. Los integradores avanzan ahora el par de volúmenes.
- **Consecuencias comprobadas contra su solución analítica**: con el circuito ocluido el gas pasa de una unidad a otra y la diferencia de presiones decae con τ = (R1+R2)·C1·C2/(C1+C2) hacia la presión común (V1+V2)/(C1+C2), sin que entre ni salga gas del pulmón. La presión del nodo con flujo nulo es la media ponderada por las conductancias.
- **En las curvas**: el vaciamiento deja de ser una sola exponencial y la constante aparente al final del flujo espiratorio es más del 50 % mayor que al principio; la meseta de una oclusión depende de su duración (en SC-17, 13,8 cmH₂O con 2 s frente a 13,5 con 10 s), mientras que con una sola unidad no cambia (< 0,05 cmH₂O). La auto-PEEP verdadera pasa a calcularse como la presión de equilibrio de todas las unidades.
- **Escenario SC-17 «Dos pulmones en uno»** y controles del panel docente para la compliance y la resistencia de la segunda unidad.
