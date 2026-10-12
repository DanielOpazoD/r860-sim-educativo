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

La revisión del padre detectó dos inconsistencias que no debían quedar para después: el objetivo válido de SC-18 y la etiqueta de pausa de ciclo con músculo. Se resolvieron en un segundo commit local, sin repetir suites por instrucción expresa.

- SC-18 ahora solicita reconocer la invalidez por esfuerzo de un bloqueo espiratorio de 2 s tras la perturbación. Si cae entre esfuerzos, indica repetir. El objetivo exige inicio posterior a la perturbación y al inicio de lección, duración real 2 s ±1e-6 s, calidad inválida, confusor muscular presente y motivo de esfuerzo/meseta perturbada/inestable. No premia cancelaciones, Pmáx ni resultados anteriores. La prueba general de objetivos `validExp` recupera su expectativa original, sin una excepción para SC-18.
- La pausa de ciclo vigila |Pmus|>0.05 cmH2O en todos sus pasos. Si cumple estabilidad, mantiene la presión observada; con esfuerzo publica calidad inválida y motivo `esfuerzoDurantePausa`. Sin estabilidad conserva el contrato previo de dato nulo. No se sustituye por la presión pasiva interna.
- `HoldOutcome.effortDuringHold` pasa a ser obligatorio: el productor interno debe declarar el confusor.
- Nuevas regresiones redactadas (4 casos): pausa pasiva/activa estable, esfuerzo sólo inicial y objetivo SC-18. No se ejecutaron como suite. Un probe focalizado independiente del runner, `../evidence/closure-probe.ts`, ejecutó esos bancos y verificó magnitudes/calidad, cumplimiento del objetivo y rechazo de resultados previos/cancelación. Pasaron typecheck, lint y fronteras de capas. La matriz y cobertura previas corresponden al primer commit; no se atribuyen al cierre posterior.

## Límites y siguiente bloque

La pasividad se vigila desde Pmus conocido del escenario durante toda la oclusión (bloqueo o pausa de ciclo), incluido su inicio, con |Pmus|>0.05 cmH2O. Es un umbral numérico del simulador, no un criterio clínico validado. `passiveMechanicsValid` registra el criterio muscular, no certifica todas las hipótesis del modelo. Se conserva la presión observada estable con esfuerzo; nunca se sustituye por presión pasiva interna. Señales inestables siguen sin ofrecer Pplat utilizable conforme al contrato previo. Estos cambios no calibran la mecánica frente a pacientes ni demuestran utilidad docente.

SC-18 ya no exige obtener PEEP total pasiva mientras el músculo invalida la maniobra: enseña a reconocer esa limitación y permite repetir si la oclusión cae entre esfuerzos. La pausa de ciclo también advierte esfuerzo aunque su cola sea estable. No se tocaron reloj/autopausa ni otras lecciones.

Validación clínica y educativa externa pendiente. La referencia primaria fue verificada por la auditoría del padre; esta sesión no la reabrió ni afirma haber superado el captcha. Las suites, cobertura, build y capturas completas documentadas arriba verifican 56e716ed; el cierre posterior sólo tiene revisión estática, typecheck, lint, fronteras y probes numéricos focalizados. Las cuatro regresiones nuevas y la UI de SC-18/pausa quedan pendientes de ejecución cuando el padre autorice la siguiente validación.
