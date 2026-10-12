# Casos clínicos

Casos con viñeta que se resuelven en el ventilador y se entregan para evaluarlos (Casos · Catálogo · Casos clínicos). Complementan las prácticas guiadas: aquéllas acompañan paso a paso; un caso plantea una pregunta y juzga el resultado.

## Formato

- **Escenario sintético con bloque `clinical`** (`src/scenarios/cases.ts`): tema, viñeta, pregunta, tipo (`ajuste` o `diagnostico`), opciones con su porqué, criterios, explicación y referencias. Comparte la carga y el motor con los escenarios; no aparece en el selector rápido de prácticas.
- **Criterios de resultado** (`src/ui/caseEvaluation.ts`): funciones puras sobre el cuadro con umbrales por caso (VT por kg de peso predicho, Pplat, presión motriz, pH de equilibrio, auto-PEEP verdadera, esfuerzos disparados, retraso de ciclado, autodisparo). Aceptan cualquier ajuste que logre el resultado. Un bloqueo cuenta si es válido como mecánica pasiva y posterior al último ajuste.
- **Verdad oculta:** mientras el caso no se entrega, el panel Paciente/Eventos no se muestra (`case-locked`). Al entregar se revelan el veredicto por criterio, la respuesta correcta con su porqué, la explicación y «Lo que el modelo sabía» (C, R, auto-PEEP verdadera, esfuerzo, PaCO₂ y pH de equilibrio).
- **Referencias visibles:** en la tarjeta del catálogo (cita corta) y en el caso (cita completa con enlace a PubMed), antes y después de entregar.
- **Fidelidad:** los números de cada viñeta salen del motor con la mecánica del caso; `tests/unit/casosClinicos.test.ts` lo comprueba caso por caso, junto con que la solución de referencia aprueba y una incorrecta no.

## Referencias verificadas

Cada referencia se abrió y se leyó su resumen en PubMed (E-utilities, `efetch`) antes de citarla. Se citan por lo que el resumen dice; no se atribuyen al artículo cifras que el resumen no contiene.

| Referencia | PMID | Qué se tomó |
| --- | --- | --- |
| Hess DR. Respiratory mechanics in mechanically ventilated patients. *Respir Care* 2014;59(11):1773-94 | 25336536 | Presión meseta como presión de distensión al final de la inspiración; índices derivados de presión y flujo (resistencia, distensibilidad). |
| Mireles-Cabodevila E, Chatburn RL. The equation of motion: a brief guide to ventilator adjustment. *Eur Heart J Acute Cardiovasc Care* 2025;14(8):494-496 | 40631448 | Ecuación de movimiento como guía de ajuste (también citada en `docs/03`). |

Durante la verificación se descartó un identificador que no correspondía al artículo buscado (PMID 21719755 es un estudio de fibrosis pulmonar, no la revisión de Marini sobre auto-PEEP): por eso cada cita lleva su PMID comprobado.
