# Casos clínicos

Ocho casos con viñeta que se resuelven en el ventilador y se entregan para evaluarlos. Se eligen en el panel lateral (pestaña Casos), que los presenta enteros sin desplazarse: tema, título breve en una línea, viñeta, objetivo —cada consigna nombra sus criterios, que se marcan con ✓ o × al entregar— y referencias con autor y año; el desarrollo se lee bajo el equipo. Las prácticas guiadas antiguas quedan como datos para escribir más casos.

## Formato

- **Escenario sintético con bloque `clinical`** (`src/scenarios/cases.ts`): tema, viñeta, pregunta, tipo (`ajuste` o `diagnostico`), opciones con su porqué, criterios, explicación y referencias. Comparte la carga y el motor con los escenarios; no aparece en el selector rápido de prácticas.
- **Criterios de resultado** (`src/ui/caseEvaluation.ts`): funciones puras sobre el cuadro con umbrales por caso (VT por kg de peso predicho, Pplat, presión motriz, pH de equilibrio, auto-PEEP verdadera, esfuerzos disparados, retraso de ciclado, autodisparo). Aceptan cualquier ajuste que logre el resultado. Un bloqueo cuenta si es válido como mecánica pasiva y posterior al último ajuste.
- **Verdad revelada al entregar:** el desarrollo bajo el equipo (veredicto por criterio, respuesta correcta con su porqué, explicación y «Lo que el modelo sabía»: C, R, auto-PEEP verdadera, esfuerzo, PaCO₂ y pH de equilibrio) se muestra sólo al entregar. El panel Paciente sigue operativo durante el caso, a discreción del docente o del alumno: una línea recuerda que cambiar el paciente altera el caso. En los casos de diagnóstico, sus valores (C, R) están a la vista: el caso pide medir, y el docente decide si se mira el panel.
- **Referencias visibles:** en la tarjeta del catálogo (cita corta) y en el caso (cita completa con enlace a PubMed), antes y después de entregar.
- **Fidelidad:** los números de cada viñeta salen del motor con la mecánica del caso; `tests/unit/casosClinicos.test.ts` lo comprueba caso por caso, junto con que la solución de referencia aprueba y una incorrecta no.

## Los ocho casos

| Caso | Tema | Qué se evalúa | Solución de referencia (prueba) | Referencias |
| --- | --- | --- | --- | --- |
| CC-01 · Presión pico alta | Mecánica respiratoria | Meseta medida y causa elegida (diagnóstico) | Bloqueo inspiratorio: Pplat ≈ 15 con Ppico ≈ 29 → resistencia | Hess 2014; Mireles-Cabodevila y Chatburn 2025 |
| CC-02 · Atrapamiento en EPOC | EPOC · hiperinflación dinámica con limitación al flujo | PEEP total medida ≤ 10; pH de equilibrio 7,30–7,50 | FR 12, I:E 1:4 (PEEP total 12,9 → 9,6; pH 7,49 → 7,34; bloqueo espiratorio de 3 s). PEEP externa hasta 7 no la sube (cascada); 11 sí. Sólo I:E o VT 400: no | Marini 2011; Armaganidis 2000; Ranieri 1993; Hess 2014 |
| CC-03 · SDRA: VT protector | SDRA · ventilación protectora | VT ≤ 6,5 mL/kg PBW; Pplat ≤ 30; ΔP < 15; pH 7,30–7,45; FR ≤ 35 | VT 425, FR 22–28 (ΔP ≈ 20 → 15; pH 7,35–7,43; VD/VT 0,53 → 0,60). VT 425 con FR 16: pH 7,24 | ARDSNet 2000; Amato 2015; protocolo ARDSNet; Nuckton 2002 |
| CC-04 · PEEP decremental | SDRA · reclutamiento y PEEP | Cstat antes de abrir; apertura; Cstat ≥ 1,3× a PEEP 9–12; PEEP final ≥ 10 | PEEP 5 → 20 (30 s) → 11: Cstat 29 → 43. Sin abrir: no | Suarez-Sipmann 2007; ART 2017 |
| CC-05 · Hipercapnia | CO₂ · espacio muerto | PaCO₂ de equilibrio 35–45; VT ≤ 8 mL/kg PBW; PEEPi ≤ 2 | VT 500 FR 14 o VT 400 FR 22 (PaCO₂ 88 → 42 o 40). FR 18 sola: 49 mmHg | Robertson 2015; protocolo ARDSNet |
| CC-06 · Esfuerzos inefectivos | Asincronía · esfuerzos inefectivos | ≥ 95 % de esfuerzos disparados en el último minuto; VTe ≥ 5 mL/kg PBW | Soporte 13–16 (con 20 disparan 13 de 26 con VT 9,7 mL/kg; con 13, todos con 5,2 mL/kg; PaCO₂ 40 → 53, pH 7,47 → 7,38). Soporte 6: VT insuficiente | Thille 2008; Thille 2006; Blanch 2015; Georgopoulos 2006 |
| CC-07 · Autodisparo por fuga | Asincronía · autodisparo | Sin autodisparo tras el ajuste; disparo ≤ 6 L/min | Disparo 4 L/min (fuga ≈ 3 L/min a PEEP 5). 8 L/min: de más | Imanaka 2000; Al Otair y BaHammam 2020 |
| CC-08 · Ciclado tardío | Asincronía · ciclado | Ti mecánico − Ti neural ≤ 0,3 s; ≥ 95 % de esfuerzos disparados | Ciclado 25 % (con 5 %: ≈ 1 s de más y la mitad sin disparar) | Tassaux 2005; Hess 2005 |

Los umbrales con cita salen de su fuente (ARDSNet: VT por peso predicho, Pplat ≤ 30, pH 7,30–7,45 y FR hasta 35; Amato: presión motriz). Los demás son objetivos docentes del caso (p. ej. PEEPi ≤ 3, 95 % de esfuerzos disparados) y así se presentan: no se atribuyen a una guía.

Los criterios que dependen de una secuencia (CC-04) leen la historia de bloqueos anotados, no el último bloqueo: al entregar, el último ya es el posterior. Los de sincronía (CC-06, CC-08) exigen un minuto completo de respiraciones posterior al último ajuste. Los de equilibrio (pH, PaCO₂) usan la ventilación de las últimas respiraciones, de modo que un cambio se refleja en pocas respiraciones y no se mezcla con la ventilación anterior.

## Referencias verificadas

Cada referencia se abrió antes de citarla: los artículos, leyendo su resumen en PubMed (E-utilities, `efetch`); el protocolo ARDSNet, leyendo el PDF. Se citan por lo que esa fuente dice; no se les atribuyen cifras que no contiene.

| Referencia | Identificador | Qué se tomó |
| --- | --- | --- |
| Hess DR. Respiratory mechanics in mechanically ventilated patients. *Respir Care* 2014;59(11):1773-94 | PMID 25336536 | Pplat como presión de distensión al final de la inspiración; índices derivados de presión y flujo. |
| Mireles-Cabodevila E, Chatburn RL. The equation of motion. *Eur Heart J Acute Cardiovasc Care* 2025;14(8):494-496 | PMID 40631448 | Ecuación de movimiento como guía de ajuste. |
| Marini JJ. Dynamic hyperinflation and auto-PEEP: lessons learned over 30 years. *Am J Respir Crit Care Med* 2011;184(7):756-62 | PMID 21700908 | Consecuencias de la auto-PEEP (hemodinamia, barotrauma, trabajo, sincronía, interpretación de la mecánica). |
| ARDS Network. Lower vs traditional tidal volumes in ALI/ARDS. *N Engl J Med* 2000;342(18):1301-8 | PMID 10793162 | VT 6 frente a 12 mL/kg de peso predicho con Pplat ≤ 30; mortalidad 31,0 % frente a 39,8 %. |
| NIH NHLBI ARDS Clinical Network. Mechanical Ventilation Protocol Summary | ardsnet.org (PDF) | Peso predicho (hombres 50 + 2,3 × [talla en pulgadas − 60]); Pplat ≤ 30; pH 7,30–7,45; FR hasta 35. |
| Amato MB et al. Driving pressure and survival in ARDS. *N Engl J Med* 2015;372(8):747-55 | PMID 25693014 | ΔP la variable que mejor estratificó el riesgo; +1 DE (≈ 7 cmH₂O) RR 1,41. |
| Nuckton TJ et al. Pulmonary dead-space fraction and death in ARDS. *N Engl J Med* 2002;346(17):1281-6 | PMID 11973365 | VD/VT temprana media 0,58 en SDRA. |
| Suarez-Sipmann F et al. Dynamic compliance for open lung PEEP titration. *Crit Care Med* 2007;35(1):214-21 | PMID 17110872 | PEEP decremental tras reclutamiento guiada por la distensibilidad (estudio experimental). |
| ART Investigators. Lung recruitment and titrated PEEP vs low PEEP in ARDS. *JAMA* 2017;318(14):1335-45 | PMID 28973363 | Mortalidad a 28 días 55,3 % frente a 49,3 % y más barotrauma con reclutamiento y PEEP titulada. |
| Robertson HT. Dead space: the physiology of wasted ventilation. *Eur Respir J* 2015;45(6):1704-16 | PMID 25395032 | Fisiología del espacio muerto y su valor pronóstico. |
| Armaganidis A et al. Intrinsic PEEP with and without tidal expiratory flow limitation. *Crit Care Med* 2000;28(12):3837-42 | PMID 11153623 | Limitación al flujo en 11 de 13 pacientes ventilados por insuficiencia de origen pulmonar; PEEPi estática 7,1 ± 2,8 frente a 1,2 ± 0,9 sin ella. |
| Ranieri VM et al. Physiologic effects of PEEP in COPD during controlled mechanical ventilation. *Am Rev Respir Dis* 1993;147(1):5-13 | PMID 8420430 | Con PEEPi 9,8, PEEP 5 y 10 no cambiaron el volumen ni la PEEP total; por encima del 85 % de la PEEPi (presión crítica) hubo más hiperinflación. |
| Thille AW et al. Patient-ventilator asynchrony during assisted ventilation. *Intensive Care Med* 2006;32(10):1515-22 | PMID 16896854 | Esfuerzos inefectivos asociados a más soporte (17,5 frente a 15), mayor VT y disparo menos sensible. |
| Thille AW et al. Reducing tidal volume during pressure support to reduce asynchrony. *Intensive Care Med* 2008;34(8):1477-86 | PMID 18437356 | Soporte 20 → 13: VT 10,2 → 5,9 mL/kg, esfuerzos inefectivos 45 % → 0 %, sin cambios en la frecuencia del paciente, el esfuerzo ni la PaCO₂. |
| Blanch L et al. Asynchronies during mechanical ventilation are associated with mortality. *Intensive Care Med* 2015;41(4):633-41 | PMID 25693449 | Los esfuerzos inefectivos espiratorios, la asincronía más frecuente. |
| Georgopoulos D et al. Bedside waveforms interpretation to identify asynchronies. *Intensive Care Med* 2006;32(1):34-47 | PMID 16283171 | Reconocer asincronías en las curvas de flujo, volumen y presión. |
| Imanaka H et al. Autotriggering caused by cardiogenic oscillation. *Crit Care Med* 2000;28(2):402-7 | PMID 10708174 | Autodisparo por señales que no son esfuerzo con disparo por flujo sensible. |
| Al Otair HA, BaHammam AS. Factors influencing asynchrony during NIV. *Ann Thorac Med* 2020;15(1):1-8 | PMID 32002040 | La fuga entre los factores principales de asincronía (incluido el autodisparo). |
| Tassaux D et al. Expiratory trigger setting and delayed cycling. *Am J Respir Crit Care Med* 2005;172(10):1283-9 | PMID 16109983 | En obstructivos, subir el criterio de ciclado reduce el retraso (1,26 → 0,25 s) y la PEEPi. |
| Hess DR. Ventilator waveforms and the physiology of pressure support. *Respir Care* 2005;50(2):166-86 | PMID 15691390 | Asincronía cuando el ciclado no coincide con el fin de la inspiración neural. |

Durante la verificación se descartó un identificador que no correspondía al artículo buscado (PMID 21719755 es un estudio de fibrosis pulmonar, no la revisión de Marini, que es 21700908): por eso cada cita lleva su identificador comprobado.

Los tres casos EPOC (CC-02, CC-06, CC-08) comparten su perfil de gases: la misma vía aérea que el adulto de referencia (165 mL) con una fracción de espacio muerto alveolar de 0,30 (unidades con V/Q alta; VD/VT fisiológica ≈ 0,5–0,6), y bicarbonato de retención crónica: 32 mEq/L a su PaCO₂ habitual de 60, con el tamponamiento agudo de las reglas de Boston cuando la ventilación la aparta de ahí. Con la gasometría del modelo siempre a la vista, un EPOC con bicarbonato normal habría mostrado una alcalosis respiratoria pura que no corresponde a su enfermedad. Que el espacio muerto del EPOC sea sobre todo alveolar —escala con el VT— es lo que permite reproducir a Thille (2008): al bajar el soporte el VT cae a la mitad pero la frecuencia del ventilador casi se duplica, y la ventilación alveolar cambia mucho menos. Antes, con 250 mL de espacio muerto todo en serie, CC-06 pasaba de PaCO₂ 25 (pH 7,74) a 53 entre soporte 20 y 12, lo contrario de lo medido. Queda una diferencia declarada en el caso: el esfuerzo sintético tiene frecuencia fija, y en el estudio la frecuencia del paciente subió algo (26,5 → 29,4/min); por eso aquí la PaCO₂ con soporte 20 sale algo más baja que con 13.

**Limitación al flujo espiratorio.** CC-02 y CC-06 la tienen (resistor de Starling con presión crítica 9 cmH₂O, P, del orden de Ranieri 1993): por debajo de esa presión el pulmón deja de vaciarse por más tiempo que se le dé, y la PEEP externa hasta ≈ 85 % de ella no aumenta la PEEP total. Por eso CC-02 pide una PEEP **total** ≤ 10 y no una PEEPi: con limitación, subir la PEEP externa reduce la diferencia PEEPtot − PEEP sin desinflar nada. CC-08 no la tiene y lo declara: con ella el esfuerzo sintético ya no reproduce su ciclado tardío.

**Pulmón intubado real.** Desde el bloque A de fidelidad todos los casos llevan el tubo endotraqueal (K₂ por diámetro: 8,0 mm en los hombres, 7,5 en las mujeres; Anaesth Intensive Care 2011), tejido viscoelástico (D'Angelo 1989; en el SDRA, 2× el sano, porque Eissa 1991 la encontró mayor) y la rama espiratoria del equipo (3 cmH₂O·s/L y apertura de la válvula en 110 ms, del banco de Pinède 2021 con el Carescape). La resistencia de cada caso es la de su vía aérea: la que mide el bloqueo suma el tubo, como en la cabecera. Para conservar lo que cada caso enseña se recalibró: CC-01 25 de vía aérea (Ppico 29, carga resistiva medida ≈ 28), CC-02 Rexp 40 (τ con la rama ≈ 2,6 s), CC-03 distensibilidad 32 (ΔP ≈ 20 con 600 mL y ≈ 15 con 425), CC-06 Rexp 24 y CC-08 Pmus 7. La meseta deja de ser plana: el bloqueo espiratorio de CC-02 necesita 3 s (lo que ofrece el panel por omisión) para estabilizarse. CC-06 programa su límite de VT alto en 0,65 L (≈ 10 mL/kg).

El SDRA de CC-03 usa la misma vía aérea y una fracción alveolar de 0,35: VD/VT 0,53 con 600 mL y 0,60 con 425 mL, en torno a la media de 0,58 que midió Nuckton. CC-05 (pulmón sano) suma a la vía aérea el intercambiador y el alargador (200 mL) y conserva la fracción alveolar pequeña del adulto de referencia.
