# Diseño: oxigenación y corazón-pulmón (pendiente de implementar)

Estado al 24-10-2026: **diseño acordado, sin código**. Aquí está todo lo necesario para que otra persona o IA lo
implemente sin depender de la conversación en que se decidió. Cuando una parte se implemente, sus afirmaciones pasan
a `evidence.json` con su marca D/O/P/U, y este documento queda como registro de la decisión.

## Por qué

Hoy el motor calcula PaCO₂ y pH (`src/engine/gasExchange.ts`), pero no oxigenación ni hemodinamia. Eso deja dos
huecos docentes:

- **Sin PaO₂ ni shunt, la PEEP en el SDRA no se enseña por su objetivo real.** El caso de PEEP decremental (CC-04)
  sólo puede evaluar la distensibilidad. En CC-03 la PEEP se exige por la viñeta, porque sin oxigenación bajarla no
  tiene costo (lo anota su prueba en `tests/unit/casosClinicos.test.ts`).
- **La PEEP alta no tiene costo hemodinámico.** No existe el compromiso clásico de la «mejor PEEP».

## Decisiones del usuario (sesión del 18-10-2026)

| Pregunta | Respuesta |
| --- | --- |
| ¿Qué abarca la primera entrega? | **Sólo A, oxigenación**: shunt ligado al reclutamiento, V/Q bajo, PaO₂/SaO₂/PaO₂/FiO₂, con gasto cardíaco fijo. B va en un segundo PR, sobre A ya validada. |
| ¿Dónde se muestran PaO₂, SaO₂ y, después, la hemodinamia? | **Panel lateral, rotulado «modelo»**, junto a la PaCO₂. Nunca en el monitor del ventilador, igual que hoy la gasometría. |
| ¿Qué se hace con los casos clínicos? | **Adaptar CC-04 y CC-03.** Con B, un caso nuevo de mejor PEEP por entrega de O₂. |

Reglas del proyecto que aplican (`CLAUDE.md`): los cambios de física van de uno en uno. Cada PR que toque la física
pasa por el agente `revisor` antes de fusionarse y se verifica con `/verify-r860`. Si cambia la huella, sube
`ENGINE_VERSION`.

## A · Oxigenación (primera entrega)

### Modelo

Modelo de mezcla venosa con tres tipos de unidad (Riley): unidades ideales, unidades de V/Q bajo y shunt verdadero.
La oxigenación **no realimenta la mecánica**: lee el estado del motor y publica su resultado en `truth`.

1. **PAO₂ por la ecuación del gas alveolar**, con la PaCO₂ que ya calcula el motor:
   `PAO₂ = FiO₂ · (PB − PH₂O) − PaCO₂ / R`, con PB 760 mmHg, PH₂O 47 mmHg y R 0,8.
   Consecuencia buscada: la hipoventilación también baja la PaO₂.
   La FiO₂ es la que entrega el mezclador (la misma que alimenta el sensor de O₂ de `simulator.ts`), no la programada:
   así el ↑O₂ y su retardo cuentan.
2. **Shunt ligado al reclutamiento:**
   `shunt = shuntBase + shuntReclutable × (1 − fracción reclutada)`.
   La fracción reclutada es la que ya integra `PatientModel.recruited` (`src/engine/patient.ts`), con apertura sobre
   `pOpen`, cierre bajo `pClose` y sus constantes de tiempo. Abrir el pulmón y sostenerlo con PEEP baja el shunt.
   Bajar la PEEP lo sube con el retraso del desreclutamiento. Un paciente sin `recruit` sólo tiene `shuntBase`: la PEEP
   no lo mejora, que es lo que pasa en un SDRA poco reclutable.
3. **Compartimento de V/Q bajo**: una fracción del gasto que perfunde unidades mal ventiladas, con una PAO₂ propia más
   baja. A diferencia del shunt, responde a la FiO₂. Es lo que distingue una hipoxemia corregible con O₂ de una
   refractaria.
4. **Contenido de O₂ y curva de disociación:**
   `CxO₂ = 1,34 · Hb · SxO₂ + 0,003 · PxO₂` (mL/dL), con la curva de Severinghaus
   `SO₂ = 1 / (23400 / (PO₂³ + 150 · PO₂) + 1)` y su inversa para volver de contenido a presión.
5. **Fick y mezcla**:
   - venoso: `CvO₂ = CaO₂ − VO₂ / GC`;
   - arterial: `CaO₂ = (1 − shunt − fVQbajo) · Cc'O₂ + fVQbajo · CO₂(VQbajo) + shunt · CvO₂`.

   Como CvO₂ depende de CaO₂, se resuelve por punto fijo, que converge en pocas iteraciones. En A el gasto cardíaco
   (GC) es fijo; en B lo da el retorno venoso.
6. **Cinética**: los depósitos de O₂ son pequeños frente a los de CO₂, y la PaO₂ sigue a su equilibrio en segundos o
   pocos minutos. Primer orden con una constante del orden de 30–60 s, a calibrar. Sin la aceleración docente de la
   PaCO₂ (E-128), salvo que la calibración muestre que hace falta. Como con la PaCO₂, la PaO₂ informada es la de una
   muestra arterial.
7. **Valores por omisión de un adulto sano** (a confirmar con la bibliografía): Hb 15 g/dL, VO₂ 250 mL/min, GC 5 L/min,
   shuntBase ≈ 2–5 % y V/Q bajo pequeño.

### Interfaz

- **Panel lateral**, en la tarjeta de gasometría (`src/ui/gasView.ts`): PaO₂, SaO₂ y PaO₂/FiO₂ junto a PaCO₂ y pH,
  rotulados «modelo», con su valor al inicio como hoy.
- **«Datos del modelo»**: shunt, fracción de V/Q bajo, PAO₂, gradiente A-a y CvO₂.
- **Desarrollo del caso** («Lo que el modelo sabía»): PaO₂/FiO₂ y shunt al entregar.
- **Nada en el monitor del ventilador.**

### Casos

- **CC-04 · PEEP decremental**: hoy evalúa la Cstat. Gana un criterio de oxigenación: tras abrir el pulmón y dejar la
  PEEP decremental, la PaO₂/FiO₂ mejora al menos un 50 % respecto de la inicial. La viñeta y el desarrollo dicen la
  PaO₂/FiO₂ de antes y de después. Su `solution` (CAS-SOL) debe seguir aprobando.
- **CC-03 · SDRA, VT protector**: arranca con PaO₂/FiO₂ en rango moderado (Berlín, 100–200). Su pulmón es poco
  reclutable (no declara `recruit`): la PEEP sube poco la oxigenación, coherente con lo que ya enseña sobre la presión
  motriz (Grasso). El desarrollo lo explica.

### Criterios de «terminado» — **pendientes de aprobación del usuario**

Las cifras exactas se calibran contra la bibliografía antes de fijarlas en pruebas.

1. **Banco sano** (SC-01, FiO₂ 0,21): PaO₂ entre 85 y 100 mmHg, SaO₂ ≥ 96 % y PaO₂/FiO₂ > 400.
2. **Shunt frente a V/Q bajo**:
   - con un shunt del 30 %, pasar de FiO₂ 0,5 a 1,0 sube poco la PaO₂ (hipoxemia refractaria);
   - con V/Q bajo y sin shunt, la sube mucho.
3. **Hipoventilación**: si la PaCO₂ sube 20 mmHg, la PAO₂ baja ≈ 25 mmHg (ecuación del gas alveolar con R 0,8).
4. **CC-04**:
   - el pulmón desreclutado a PEEP 5 tiene PaO₂/FiO₂ < 200;
   - tras abrirlo y dejar PEEP 11, la PaO₂/FiO₂ sube al menos un 50 %;
   - si se vuelve a PEEP 5, cae de nuevo con el retraso del desreclutamiento;
   - el caso exige esa mejora.
5. **CC-03**: arranca con PaO₂/FiO₂ entre 100 y 200.
6. **La mecánica no cambia**: las huellas mecánicas de HUE-01 quedan idénticas. Sólo cambia el hash de gasometría, y
   `ENGINE_VERSION` sube de 0.7.0 a 0.8.0 (con la nueva en `ACCEPTED_ENGINE_VERSIONS`).
7. **Puertas**: `npm run ci` en verde, revisión del agente `revisor` sin hallazgos bloqueantes, y `/verify-r860`
   ampliada con un paso de oxigenación:
   - PaO₂/FiO₂ antes y después de abrir el pulmón;
   - PaO₂ con FiO₂ 0,5 y 1,0;
   - capturas del panel.

   Cada afirmación etiquetada como medido, inferido o supuesto.

### Evidencia por citar

Cada referencia se abre y se lee antes de citarla en `evidence.json`, como exige el registro de
`docs/08-casos-clinicos.md`. Ninguna está leída todavía en el contexto de este diseño.

- Riley RL, Cournand A (1949 y 1951): el análisis de tres compartimentos (ideal, espacio muerto y shunt).
- Severinghaus JW (1979): la ecuación de la curva de disociación de la hemoglobina.
- West JB: la relación V/Q y sus efectos sobre el intercambio de O₂ y CO₂ (libro de texto, D-secundario).
- ARDS Definition Task Force, JAMA 2012 (Berlín): los rangos de PaO₂/FiO₂ del SDRA leve, moderado y grave.
- Dantzker DR et al., 1979: la distribución V/Q en el SDRA (shunt y V/Q bajo medidos con gases inertes).
- Gattinoni L et al., N Engl J Med 2006: la reclutabilidad pulmonar en el SDRA y su relación con la oxigenación.
- Suter PM et al., N Engl J Med 1975: la «PEEP óptima» por distensibilidad y entrega de O₂ (para B).
- Jardin F et al., N Engl J Med 1981: la caída del gasto cardíaco con la PEEP (para B).
- Guyton AC (1957 y siguientes): el retorno venoso y la presión media de llenado sistémico (para B).

## Orden de las entregas

1. **A · Oxigenación** (esta especificación). Sube la versión del motor y la huella de gasometría.
2. **B · Corazón-pulmón**, en un PR aparte, cuando A esté fusionada y validada:
   - retorno venoso de Guyton: `GC = (Pmsf − Pad) / Rrv`;
   - la presión intratorácica media frena el retorno: sale de la presión alveolar media y de la fracción que el pulmón
     transmite al tórax, `≈ Cpulmón / (Cpulmón + Cpared)`, de modo que un pulmón rígido transmite menos;
   - la volemia como parámetro del paciente: el hipovolémico cae más con la PEEP;
   - salen gasto cardíaco y presión arterial media;
   - el gasto alimenta el Fick de A: menos gasto da menos CvO₂ y, con shunt, menos PaO₂;
   - la entrega de O₂, `DO₂ = GC × CaO₂`, tiene un máximo en la «mejor PEEP» (Suter). Caso nuevo: encontrarla.
3. **C · Más adelante**: una curva de presión arterial latido a latido en el panel, con la variación de presión de
   pulso (VPP) que produce la ventilación, y su lectura como predictor de respuesta a volumen. Necesita un canal de
   muestras nuevo y su propio dibujo.

## Cómo retomar

1. Lee `CLAUDE.md`, `docs/04-arquitectura.md` (capas: la física va en `src/engine/`; la interfaz sólo lee `truth`) y
   este documento.
2. **Pide al usuario que apruebe o ajuste los criterios de «terminado»** de A: están pendientes.
3. Lee `src/engine/gasExchange.ts` (el modelo de CO₂ que se reutiliza: PaCO₂, muestra arterial, `GasState`),
   `src/engine/patient.ts` (`recruited`, `recruit`), `src/engine/simulator.ts` (dónde avanza la gasometría y cómo se
   publica `truth.gas`) y `src/ui/gasView.ts`.
4. Crea la rama (`mecanica/oxigenacion`) y escribe primero las pruebas de los criterios. Una buena convención sería
   `tests/unit/oxigenacion.test.ts`, con identificadores OXI-01… Deben fallar antes del modelo.
5. Implementa el modelo en un módulo propio del motor, sin realimentar la mecánica, y publícalo en `truth`. Después
   añade el panel, «Datos del modelo» y los cambios de CC-03 y CC-04, con su `solution` al día.
6. Abre y lee cada referencia, y añade sus entradas a `evidence.json` con el número siguiente libre (la prueba EVI
   comprueba que cada E-nnn citado exista).
7. Sube `ENGINE_VERSION` y `package.json` a 0.8.0, añádela a `ACCEPTED_ENGINE_VERSIONS` y regenera la huella
   (`HUELLA_ACTUALIZAR=1 npx vitest run tests/unit/huella.test.ts`). Comprueba en el diff que sólo cambian los hashes
   de gasometría.
8. `npm run ci` (regenera las cifras del README y `docs/01-resultados.md`). Amplía `/verify-r860` con el paso de
   oxigenación y córrela. Pide la revisión del agente `revisor` y abre el PR **sin fusionar**, con la evidencia
   etiquetada en la descripción.
