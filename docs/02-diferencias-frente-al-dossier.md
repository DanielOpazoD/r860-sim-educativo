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
