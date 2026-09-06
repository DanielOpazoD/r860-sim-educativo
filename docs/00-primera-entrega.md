# Primera entrega · Simulador educativo inspirado en CARESCAPE R860

**SIMULACIÓN EDUCATIVA · NO USO CLÍNICO.** Este documento es la primera entrega exigida por el dossier (perfil objetivo, funciones P0, mapa de pantallas, contratos de datos, decisiones de aproximación, lista de pruebas y brechas bloqueantes). Se escribió antes de dar por cerrada la franja funcional y se mantiene como referencia de diseño. Cada decisión lleva su marca: **D** documentado · **O** observado · **P** propuesto · **U** no resuelto. Las fuentes y sus hashes están en `src/profiles/r860-es-photo-reference/evidence.json`; las brechas en `gaps.json`.

## 1. Perfil objetivo

| Campo | Valor | Marca |
| --- | --- | --- |
| profileId | `r860-es-photo-reference-v1` | P |
| Referencia visual | Fotos P1, P2, P3 (español, punto decimal, reloj HH:MM) | O |
| Población / modo habilitado | Adulto · A/C VC | O (teclas de P1/P3) |
| Familia de temporización | Familia 2: control de flujo apagado, tiempo inspiratorio por I:E (tecla I:E presente, sin tecla de flujo) | D ficha 2014 «Familias de modos» + O |
| Firmware de la unidad fotografiada | `null` — no se asigna | U-01 |
| Fuentes leídas íntegras en esta etapa | Guía rápida JB77395XX (2020), ficha técnica JB23840CO (2014), guía de resolución de problemas JB79437XX (2020), curso «Modos de ventilación invasiva» JB72469XX (ES, 2020) | D |
| Fuentes sólo vía dossier | Guía rápida SW10 2065492-001 (403), URM SW10 2065490-001, URM Rev F (502) | D-secundario / U-17 |
| Política ante lo desconocido | `disabled_with_reason`: la función no existe como pantalla decorativa; muestra el motivo | mandato |

## 2. Funciones P0 (esta etapa)

Implementadas y probadas:

- Seleccionar → editar (mando, flechas, rueda sobre el mando, +/−) → confirmar / cancelar / vencer plazo, con vista previa de consecuencias (Tinsp, Texp, flujo) antes de confirmar (D patrón QRG p.8; plazo P 20 s, U-07).
- Motor lineal de un compartimento con volumen absoluto continuo; VC de flujo constante; Plimit (mantiene presión) y Pmáx (termina inspiración); pausa inspiratoria; disparo por flujo con control asistido; espera y reinicio.
- Curvas Pva/Flujo/Volumen en canvas con barrido y decimación por extremos; escalas O de P1 y P3 y una escala amplia P.
- Panel denso (P1) y panel de seis valores (P3); barra de presión con Pmáx/Ppico/PEEP; teclas rápidas; menú de modo transaccional; configuración de alarmas transaccional; lista de alarmas con reconocimiento.
- Procedimientos: bloqueo inspiratorio (Pplat, Cstat, fecha, hora, calidad), bloqueo espiratorio (PEEPtot, PEEPi; P), respiración manual, ↑O2 de 2 min con restauración idempotente y precedencia del usuario.
- Alarmas: Pmáx (respuesta fin de inspiración), Ppico baja, VTesp, VMesp, FR, FiO2, PEEPe; estados activa / reconocida / resuelta separados; pausa de audio 120 s; audio aproximado que exige gesto.
- Panel docente fuera del marco: mecánica verdadera, esfuerzo, sesgo del sensor de O2, escenarios sintéticos, fixtures P1/P3, pausa/velocidad, exportación e importación validada, registro de eventos.
- Historial: eventos con actor y tiempo simulado, registros inmutables por respiración, exportación/replay determinista.

Desactivadas con motivo visible (ver `gaps.json › disabledFeatures`): vista básica sin curvas, dividida, tabulada, Pasado/Futuro, otros modos, nuevo paciente, aspiración, nebulizador, compensaciones, Auto Limits, captura, energía.

## 3. Mapa de pantallas

| Pantalla | Estado | Qué conserva al salir |
| --- | --- | --- |
| Presente · curvas avanzadas (P1) | habilitada | selección/borrador, ventana de bloqueo abierta, escala |
| Presente · curvas básicas (P3) | habilitada | ídem; mismo motor y misma base temporal |
| Presente · bucles, tabla, tendencias, registro | habilitadas desde v0.2 (reinterpretación, no observadas en fotos) | selección de bucle de referencia, filtro del registro |
| Presente · dividida | desactivada (CFG-05) | — |
| Pasado / Futuro | desactivados (etapas 4–6) | — |
| Menú de modo | diálogo transaccional (A/C VC y A/C PC desde v0.3; otros modos listados con motivo) | nada hasta confirmar |
| Config. de alarmas | diálogo transaccional | nada hasta confirmar |
| Lista de alarmas | diálogo | reconocimiento por alarma o todas |
| Espera | diálogo de confirmación → estado con superposición «EN ESPERA» | métricas no disponibles; numeración de respiraciones continúa al reanudar |
| Ventanas de bloqueo insp/esp | ancladas a sus teclas | último resultado con hora aunque se cierre y reabra |
| Panel docente | fuera del marco, estética distinta | estado verdadero, escenarios, sesión |

## 4. Contratos de datos

- `MetricSample` (`src/domain/types.ts`): `value: number | null`, unidad interna, `source` (ventilator / procedure / derivedModel / fixture), `simTimeMs`, `breathId`, `procedureId`, `quality` (valid / stale / unavailable / invalid / inProgress), `reason`, `windowMs`. `null` se muestra «---».
- `VcSettings`: fracción, L, /min, razón I/E, cmH2O u `'off'`, fracción de pausa, booleano de control asistido, L/s de trigger.
- `SettingRule`: dominio por tramos en unidad mostrada, `allowOff`, dependencias, `applyPolicy`, evidencia del rango y evidencia de la política.
- `BreathRecord`: registro inmutable con tipo, causa de ciclado, Ppico, Pplat de ciclo con motivo, PEEPe, Pmedia, VTinsp, VTesp, indicadores de Plimit/Pmáx y volumen absoluto de verdad al inicio.
- `ProcedureResult`: id, tipo, fase, horas de solicitud/inicio/fin, hora de pared del resultado, duración pedida y real, respiración, calidad, motivo y `values` (muestras con `source: 'procedure'`).
- `AlarmState`: condición activa, inicio, resolución, reconocimiento, valor bruto y mostrado al inicio, umbral, prioridad con evidencia, acción de respuesta, enclavamiento.
- `Command` / `SessionEvent` / `SessionFile`: órdenes tipadas; eventos con secuencia, tiempo simulado, hora de pared, actor y versiones; sesión exportable con inicialización y comandos para replay.
- Mensajes Worker ↔ UI (`src/app/protocol.ts`): `init`, `command`, `control`, `setSpeed`, `visibility`, `exportSession`, `importSession`, `loadScenario` → `frame`, `commandResult`, `session`, `importResult`.

## 5. Decisiones de aproximación (P) y su justificación

| Decisión | Marca | Nota |
| --- | --- | --- |
| Modelo `Paw + Pmus = P0 + V/Crs + R·Q`, R2 = 0 | P | dossier §12; V absoluto sobre relajación |
| Integración: fuente de flujo exacta; fuente de presión RK2 con sub-pasos si dt/τ > 0.2; eventos programados con sub-paso exacto; cruces de Plimit/Pmáx localizados por interpolación lineal | P | BM-08 demuestra convergencia |
| dt = 4 ms por defecto (1–4 ms probados) | P | dossier §23 |
| Aplicación de ajustes: siguiente respiración; Pmáx y FiO2 inmediatos | P (U-06) | registrado en cada evento |
| PEEP Off ⇒ ambiente; espera ⇒ vía aérea a ambiente | P (U-24) | |
| Pplat de ciclo sólo con pausa ≥ 0,1 s y meseta estable ≤ 0,5 cmH2O | P (U-13) | sin pausa: `---` |
| Validez del bloqueo: duración completa, sin Pmáx, sin cancelación, máx−mín ≤ 0,5 cmH2O tras un arranque de min(0,5 s, 30 %) | P (U-20) | |
| Cstat = VTinsp / (Pplat − PEEPe al inicio de esa inspiración) | P | sin PEEPtot medida; el motivo lo dice |
| FR y VMesp: ventana de las últimas 8 respiraciones | P (U-08) | nunca VT programado × FR programada |
| Refractario de disparo 0,25 s | P (U-22) | |
| Prioridades y enclavamiento de alarmas | P (U-11) | |
| Timbre/cadencia de audio | P (U-12) | patrón de tonos D |
| Plazo de edición 20 s | P (U-07) | configurable |
| Escalones de I:E de 0,5 | P (U-05) | rango 1:9–4:1 D |

## 6. Lista de pruebas de esta etapa

Ejecutadas (ver `docs/01-resultados.md` para la salida real):

- Banco analítico (Vitest): BM-01, BM-02, BM-03 (modelo, no modo PC), BM-04, BM-05, BM-06 a/b, BM-07, BM-08 (dt 4/2/1 ms y eventos no múltiplos de dt).
- Físicas: PHY-06 (PEEP conserva V), PHY-07 (auto-PEEP emergente), PHY-08 (R, C, Pmus por separado), PHY-10 (dominio de fallo sin NaN).
- Validación: escalones en ambos sentidos en fronteras, propiedades con fast-check, restricciones cruzadas.
- Alarmas: ALM-02, ALM-03, ALM-05, ALM-06, ALM-07, FiO2 con sesgo (SC-12).
- Procedimientos: PRC-01, PRC-02, PRC-03, PRC-05, resp manual, DAT-04, espera.
- Sesión: TIM-01, TIM-02, SEC-03; SEC-01 estático.
- Interfaz (Playwright, tres proyectos: 1440×1000, 1280×900, Pixel 7): VIS-01/02/03/04, DAT-01/02, INT-01…06, PRC-01 (UI), ACC-01, TIM-03, SEC-01/02, móvil.

No ejecutadas todavía: ALM-04 automatizada de extremo a extremo, PHY-02/03 (PC y CPAP/PS no habilitados), PHY-05 (fuga no modelada), PRC-04 (SBT), DAT-05/06 en UI, CFG-04, ACC-02 automatizada, L3 revisión experta.

## 7. Brechas que bloquean funcionalidades

- **U-04/U-05**: menús y escalones no observados bloquean las vistas básica sin curvas, dividida y tabulada, y las poblaciones pediátrica/neonatal.
- **U-09**: sin algoritmo publicado, PRVC/VS/BiLevel VG quedan fuera; R23 aporta cotas para una futura aproximación declarada.
- **U-10**: sin submodelo de fuga/circuito no hay compensaciones ni auto-disparo por fuga (SC-07/SC-08).
- **U-11/U-23**: sin catálogo de alarmas, Auto Limits, apnea y High Alert Audio permanecen desactivados; límites iniciales Off.
- **U-14/U-15/U-16**: Futuro, oxigenoterapia, neonatal, energía y gases desactivados.
- **U-19** (nueva): la compensación de flujo entre respiraciones en VC descrita por el curso JB72469XX no se implementa; el VT real queda por debajo del programado bajo Plimit y así se muestra.
- PC y CPAP/PS se incorporarán sólo tras pasar sus pruebas de banco (BM-03 con rampa real; PHY-03 con esfuerzo/disparo/ciclaje y respaldo).
