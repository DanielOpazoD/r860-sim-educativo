# Correcciones de medición y fidelidad causal

Contrato previo a implementación (2026-10-12), base ea39875b93e449a921f19ad0109988cefa54bc0b.

- Defecto/aprendizaje: una meseta estable con músculo activo aparenta mecánica pasiva; Plimit omite gas fugado del canal del ventilador; la oclusión publica presión alveolar en vez del nodo con fuga; fuga porcentual sin denominador aparece válida.
- Dominio: simulación adulta existente VC/PC/PS, mecánica y sensores sintéticos. Sin alterar parámetros del paciente, reloj ni textos docentes.
- Predicción: banco C50/R10/VT500/PEEP5 pasivo → Pplat15, Cstat50, ΔP10. RiseRelax4/3min/ti3/fase0 y hold2 al inicio → Paw11 conservada, señal estable, mecánica pasiva inválida. Plimit12/fuga6 → sumar integral de fuga a VTi y flujo final; oclusión → presión del nodo, flujo ventilatorio cero aunque se pierda gas. VTi cero → porcentaje no disponible con motivo.
- Invariantes/confusores: conservación por canales; controles sin fuga y sin esfuerzo; músculo durante toda oclusión (incluido arranque), no sólo último instante; ruido y circuit compliance cero en bancos cuantitativos. La detección usa Pmus sintético, no pretende ser un algoritmo clínico de detección.
- Refutación: corregir los valores a la verdad pasiva, cambiar el pulmón, perder reproducibilidad o mantener etiquetas válidas con denominador ausente refuta la solución.
- Aceptación: regresiones rojas antes/verdes después, controles VC/PC/PS, check/cobertura/build y E2E pertinente, capturas reales. Pendiente validación clínica y educativa independiente. Referencia primaria propuesta por auditoría: https://pmc.ncbi.nlm.nih.gov/articles/PMC7385937/ (acceso automatizado bloqueado por captcha en esta sesión; no se presume leído).

## Resultado técnico

Regresiones iniciales: 5 fallos y 3 controles pasados. Reproducidos antes de editar: meseta con esfuerzo etiquetada válida; esfuerzo inicial descartado por el filtro; VTi 0.334922258 L (faltan 0.071363671 L); Paw 12.118969175 frente nodo 11.017244704; porcentaje nulo etiquetado válido.

Tras corregir:
- La presión observada estable permanece 11 cmH2O. `signalQuality=valid` y `passiveMechanicsValid=false` distinguen estabilidad del criterio muscular. Calidad global inválida con motivo `esfuerzoDuranteBloqueo`; Cstat, ΔP y R no se derivan. El control pasivo conserva 15 / 50 / 10.
- Plimit12 integra VTi 0.406285930 L y publica qEnd + qLeakEnd. La prueba contabiliza gas entregado, acumulado en pulmón y fugado; compara además el flujo final. Plimit100 conserva VTi500 mL. El modelo del paciente no se modifica.
- En oclusión con fuga, Paw13100ms = 11.017244704 cmH2O, Qvent=0 y volumen pulmonar descendente. Control sin fuga: volumen constante.
- VTi ≤ 1e-6 L da porcentaje no disponible con motivo explícito, también en SC-09 prolongada. El umbral ya existía: se corrige su calidad, no su definición.
- Repetición determinista VC/PC/PS con semilla73, fuga y maniobra; regresiones existentes de modos, circuito y esfuerzos conservadas.

Verificación del commit 56e716ed351697f3d254b7cae37512a09985cdda en este Mac: Node22.22.0, Chromium1243/Playwright1.63.0. `check`: 556/556; cobertura: líneas69.28%, ramas60.47%, funciones67%, sentencias67.09%, umbrales sin cambios; build correcto; E2E completo: 366 pasadas, 27 omisiones preexistentes por viewport, 0 fallidas (131 pruebas × 3 proyectos). `results:doc` y `docs:facts -- --check` sincronizados. La matriz completa se ejecutó una vez tras resolver las pruebas focalizadas.

Navegador: 1440×1000, 1280×900 y Pixel7; importar sesión sintética → abrir bloqueo → Pplat11 visible + advertencia + Cstat ausente. SC-09 → tabla → detalle de fuga: no disponible y motivo. Capturas reales en `test-results/measurementFidelity-*`; inspección visual de escritorio y móvil sin recorte de la advertencia. Probe adicional contra servidor temporal propio 127.0.0.1:4174: VTi406 en tabla (valor interno 406.285930mL), presión del nodo11.017245 y flujo0 durante hold. Sin errores de página en los probes. Artefactos consolidados fuera del repositorio, en `../evidence/`, con JSON numérico y capturas. Los servidores temporales se detienen al terminar.

## Cierre de revisión local

La revisión del padre detectó dos inconsistencias que no debían quedar para después: el objetivo válido de SC-18 y la etiqueta de pausa de ciclo con músculo. Se resolvieron en el commit local 9f22643cf6ef1dd85fd43626a773d506ebaf44f1. En la fase inicial de revisión se usaron probes por la instrucción de no repetir suites; después el padre autorizó la validación completa necesaria, documentada abajo.

- SC-18 ahora solicita reconocer la invalidez por esfuerzo de un bloqueo espiratorio de 2 s tras la perturbación. Si cae entre esfuerzos, indica repetir. El objetivo exige inicio posterior a la perturbación y al inicio de lección, duración real 2 s ±1e-6 s, calidad inválida, confusor muscular presente y motivo de esfuerzo/meseta perturbada/inestable. No premia cancelaciones, Pmáx ni resultados anteriores. La prueba general de objetivos `validExp` recupera su expectativa original, sin una excepción para SC-18.
- La pausa de ciclo vigila |Pmus|>0.05 cmH2O en todos sus pasos. Si cumple estabilidad, mantiene la presión observada; con esfuerzo publica calidad inválida y motivo `esfuerzoDurantePausa`. Sin estabilidad conserva el contrato previo de dato nulo. No se sustituye por la presión pasiva interna.
- `HoldOutcome.effortDuringHold` pasa a ser obligatorio: el productor interno debe declarar el confusor.
- Nuevas regresiones (4 casos): pausa pasiva/activa estable, esfuerzo sólo inicial y objetivo SC-18. Un probe focalizado inicial, `../evidence/closure-probe.ts`, verificó esos bancos. Tras autorización del padre se ejecutaron también las regresiones y la validación descrita en la siguiente sección. Las cifras previas de 556 pruebas y 366 E2E corresponden sólo al primer commit.

## Validación del cierre

Código de producto idéntico a 9f22643 (el commit de evidencia posterior sólo añade/refina pruebas y documentación). Se ejecutó el archivo actual de 15 regresiones en copias aisladas obtenidas por `git archive`, sin alterar la rama de trabajo:

| Código de producto | Resultado de las 15 regresiones actuales |
| --- | --- |
| ea39875 (base) | 8 fallos, 7 controles aprobados |
| 56e716ed (antes del cierre) | 3 fallos: pausa con esfuerzo estable, esfuerzo sólo inicial y objetivo SC-18; 12 aprobadas |
| 9f22643 y árbol final | 15 aprobadas |

Las pruebas focalizadas de medición, procedimientos, fuga, objetivos, lección y revisión7 pasan: 65 casos. `check` final pasa con 560 pruebas; cobertura final: líneas69.31%, ramas60.54%, funciones67.03%, sentencias67.12%, sin cambios de umbral. Build aprobado. Los 12 E2E focalizados (4 flujos × 3 viewports) pasan: bloqueo con esfuerzo, denominador cero, pausa pasiva/activa/esfuerzo sólo inicial y SC-18. Se inspeccionaron capturas reales de la pausa activa y del objetivo SC-18 completado en escritorio y móvil; advertencia visible y dato inválido sin inventar PEEP pasiva. Sin errores de página en esos flujos.

Matriz final: 372 E2E aprobados, 27 omisiones preexistentes por viewport y 0 fallos (133 pruebas × 3 proyectos). `results-doc.py`, `docs:facts` y `docs:facts -- --check` pasan con artefactos nuevos. La matriz completa final se amplió por dependencia del flujo documental: `docs:facts` calcula el recuento global desde el JSON E2E completo. No se mezclaron ejecuciones de SHAs diferentes. Los artefactos finales se guardan con prefijo `final-` en `../evidence/`, separados de los históricos.

## Límites y siguiente bloque

La pasividad se vigila desde Pmus conocido del escenario durante toda la oclusión (bloqueo o pausa de ciclo), incluido su inicio, con |Pmus|>0.05 cmH2O. Es un umbral numérico del simulador, no un criterio clínico validado. `passiveMechanicsValid` registra el criterio muscular, no certifica todas las hipótesis del modelo. Se conserva la presión observada estable con esfuerzo; nunca se sustituye por presión pasiva interna. Señales inestables siguen sin ofrecer Pplat utilizable conforme al contrato previo. Estos cambios no calibran la mecánica frente a pacientes ni demuestran utilidad docente.

SC-18 ya no exige obtener PEEP total pasiva mientras el músculo invalida la maniobra: enseña a reconocer esa limitación y permite repetir si la oclusión cae entre esfuerzos. La pausa de ciclo también advierte esfuerzo aunque su cola sea estable. No se tocaron reloj/autopausa ni otras lecciones.

Validación clínica y educativa externa pendiente. La referencia primaria fue verificada por la auditoría del padre; esta sesión no la reabrió ni afirma haber superado el captcha. La validación del cierre anterior verifica el código de producto de 9f22643 y las pruebas del árbol final; las cifras históricas de 56e716ed permanecen identificadas por separado. No queda pendiente la ejecución de las cuatro regresiones ni de los E2E de SC-18/pausa. Persisten los límites del modelo y la validación externa pendiente.

### Cierre: frontera de esfuerzo variable

Se reproduce con semilla 1, amplitud 0.2 cmH₂O, 12/min, Ti neural 4 s,
fase −4.198 s, riseRelax τ=2 s, variabilidad de amplitud 0.5 y pausa 20%.
El período cambia a 0.802 s dentro del paso [0.800, 0.804]. Antes del ajuste,
reconsultar el inicio después del final devuelve cero y la meseta queda válida;
el Pmus inicial era 0.061046 cmH₂O. Se captura una sola vez antes de avanzar y
se reutiliza para integración y vigilancia. La regresión falla antes (incluida
la validez fisiológica) y pasa después; los 15 controles de fidelidad también.
No se modifica el generador ni las ecuaciones. Evidencia: `pmus-boundary-red.log`
y `pmus-boundary-green.log` en el directorio externo de evidencias de esta tarea.

## Revisión de integración: el equipo no ve el músculo

Al integrar con la gasometría de modelo (#100) se separó lo que ve el ventilador de lo que sabe el modelo. Un ventilador real sólo juzga la forma de la presión: ante una meseta estable con músculo activo publica Pplat, Cstat y ΔP sin aviso. Marcarla «no válida por esfuerzo» en la cara del equipo atribuía al ventilador una información (Pmus) que no tiene y resolvía por el alumno el reto de reconocerla en la curva.

- `quality`/`reason` del bloqueo y de la Pplat de ciclo vuelven a ser sólo de la señal. Con el banco de esfuerzo (riseRelax 4 cmH₂O, 3/min, Ti 3 s) el equipo muestra Pplat 11, ΔP 6 y Cstat 83 mL/cmH₂O, «Medido».
- `passiveMechanicsValid` (bloqueos) y `BreathRecord.effortDuringPause` (pausa de ciclo) conservan el criterio |Pmus| > 0,05 cmH₂O de este documento como verdad del modelo. Se retiran `signalQuality`/`signalReason`, redundantes con `quality`.
- Capa docente: las tarjetas de Aula · Fundamentos conservan el número del equipo y añaden «Según el modelo hubo esfuerzo muscular durante este bloqueo…»; la curva de titulación y los objetivos de lección sólo aceptan bloqueos pasivos (`valida` en `lesson.ts`); SC-18 se acredita con la maniobra completa de 2 s y `passiveMechanicsValid === false`.
- Se mantiene la anulación existente, también por Pmus, del índice de estrés y de τ espiratoria: son índices derivados del simulador, no lecturas del equipo.

Pruebas: `measurementFidelity` (unitarias y e2e) reescritas al contrato separado, más una de tarjetas con y sin esfuerzo; SC-22 comprueba el cese del autodisparo (`teachingHonesty`, `objetivos`).
