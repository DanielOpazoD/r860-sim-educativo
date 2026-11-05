# Cierre docente y accesibilidad

Este bloque ajusta las afirmaciones a lo que el simulador comprueba. No añade
modelos ni modos, ni inicia validación externa.

- SC-25 presenta PEEP 20 y reclutamiento 90 % como condiciones del modelo.
  El máximo de Cstat es el máximo mecánico de los puntos medidos; no demuestra
  beneficio ni identifica una PEEP clínicamente segura. La cautela declara la
  ausencia de intercambio gaseoso y hemodinámica. No se equipara esta secuencia
  con el protocolo ni los resultados del estudio ART.
- `Scenario.caution` aparece en Aula · Fundamentos (las tres pestañas: Presiones,
  Protección y Ventilación) y viaja en el resumen descargable. Las vistas Lección
  y Resultados de entonces ya no existen. Se reutilizan las cajas y componentes
  existentes.
- SC-04 acredita practicar y confirmar un cambio de Plimit, y su texto dice que no
  se comprueba el efecto. SC-22 sí comprueba el efecto (revisión de integración):
  disparo por flujo de al menos 4 L/min y las tres últimas respiraciones terminadas
  tras el cambio sin ninguna asistida; con el esfuerzo apagado, una asistida sólo
  puede ser la fuga. Un ajuste solo, o una fuga que sigue superando el umbral, no
  lo acredita. Se corrige además la descripción desfasada de SC-04: Rinsp
  cambia a 60, como ya hacían la perturbación y la lección.
- La referencia ΔP <15 es exclusiva: 15 mostrado queda fuera; se conserva el
  criterio de comparar el valor redondeado que ve el alumno. Los techos
  inclusivos de otras referencias permanecen iguales.
- b≈1 describe una forma global aproximadamente recta; no excluye reclutamiento
  y sobredistensión regionales simultáneos.
- La ayuda de bloqueo anuncia inspiratorio o espiratorio según el panel abierto.

## Comprobación antes y después

Antes fallan dos de cuatro regresiones de presentación: ΔP=15 se marca dentro y
b≈1 excluye indebidamente procesos regionales. En navegador fallan la cautela de
SC-25 ausente y el nombre accesible espiratorio. Después pasan ambos recorridos,
y 41 pruebas focalizadas de presentación, objetivos y DOM. Dos controles de
objetivos demuestran que sin ciclos completados sólo se acredita el ajuste,
coherente con los nuevos textos.

Las capturas reales de SC-25 en Lección y Fundamentos (vistas de entonces)
fueron inspeccionadas; el navegador comprobó también Resultados y el nombre
accesible al alternar los bloqueos. Evidencia fuera del árbol: `../evidence/teaching-*` y gates finales
`../evidence/closure-*`. Estas pruebas usan datos sintéticos y no demuestran
validez clínica ni eficacia educativa externa. La revisión externa de contenido
y la evaluación educativa quedan propuestas para una decisión posterior, sin
iniciar estudios ni incorporar participantes.

## Gates finales del árbol

Al cerrar este bloque, `check` pasó 579/579 pruebas en 75 archivos, con
cobertura de líneas 69,69 %, ramas 60,86 %, funciones 67,33 % y sentencias
67,55 %; la E2E, 387 aprobadas y 27 omitidas en tres proyectos. Son cifras de
entonces. Las vigentes salen de los artefactos de la última corrida y están en el
README (`hechos:pruebas`, `hechos:cobertura`): hoy, 879 pruebas Vitest y 155
Playwright × 3 proyectos (402 ejecuciones, 63 omitidas por diseño); cobertura de
líneas 73,0 %, ramas 64,5 %, funciones 70,2 % y sentencias 71,0 %.
