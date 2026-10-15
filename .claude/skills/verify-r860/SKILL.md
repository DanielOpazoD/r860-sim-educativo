---
name: verify-r860
description: Verifica Ventila Lab de punta a punta antes de decir que algo funciona. Arranca la app, comprueba que sirve el motor correcto, la conduce como un alumno (cambio de modo, entrega de un caso y «Cómo se resuelve», PaCO₂ hasta su equilibrio) y deja capturas y cifras de antes y después, cada una etiquetada como medida, inferida o supuesta. Úsala tras cualquier cambio en el motor, la gasometría, las curvas o los casos, y antes de pedir la fusión de un PR.
---

# /verify-r860

Una CI en verde dice que las pruebas pasan, no que la app haga lo que se pidió. Esta skill lo comprueba en la app de verdad y deja evidencia que se puede pegar en un PR.

Atajo: `node .claude/skills/verify-r860/scripts/verificar.mjs` hace Launch → Doctor → Drive → Evidence → Cleanup de una vez y escribe todo en `test-results/verify-r860/<fecha>/` (ignorado por git). Sale con 0 si todo pasó, 1 si falló una comprobación y 2 si el doctor encontró un problema antes de conducir. Los pasos siguientes son los que hace, por si hay que hacerlos a mano o ampliarlos.

## 1. Launch

- **Con el script:** arranca su propio `vite` en `PORT` (por omisión 5190, para no chocar con el 5173 de otra sesión) y lo detiene al terminar. `--port N` elige otro. `--url http://127.0.0.1:N` usa un servidor ya levantado y no lo toca.
- **A mano, en la app de escritorio:** `preview_start` con `ventila-dev` (de `.claude/launch.json`; la app fija `PORT` con `autoPort`). Fuera de ella, `PORT=5180 npm run dev`. `vite.config.ts` usa `strictPort`: si el puerto está ocupado falla en vez de saltar a otro, así que elige uno libre.
- La e2e usa `E2E_PORT` (por omisión 4173) y sirve el build con `vite preview`: no es el mismo servidor.

## 2. Doctor

Antes de conducir, todo esto tiene que ser cierto (si no, se para con código 2):

- El servidor responde 200 en la URL.
- `ENGINE_VERSION` de `src/engine/version.ts` es igual a la versión de `package.json` (`vite.config.ts` se niega a arrancar si no).
- La app publica ese motor: `#version-tag` empieza por `v<ENGINE_VERSION>` y `window.__ventila.frame.engineVersion` lo repite. Si no, el servidor está sirviendo otra copia o un build viejo.

## 3. Drive

`window.__ventila.frame` es el cuadro del motor: `settings`, `metrics.<clave>.value`, `truth.gas` (PaCO₂ del modelo), `simTimeMs`. Los parámetros de URL útiles son `scenario=<id>` y `speed=0.1…10`; Escape cierra la bienvenida.

1. **Cambio de modo** (`?scenario=SC-01&speed=2`): captura de `#view-waves` en A/C VC → «Modo actual» → `.mode-option[data-mode="AC_PC"]` → `[data-action="confirmModes"]` → espera a que `settings.mode` sea `AC_PC` y unos segundos más → segunda captura. La marca «Modo A/C PC» se dibuja en el canvas: sólo la captura la muestra.
2. **Caso y «Cómo se resuelve»** (`?scenario=CC-05&speed=10`): ajusta VT 500 y FR 14 (`#setting-vt` en mL y `#setting-rr`, la solución que declara el caso) → entrega (`#instructor-case [data-action="submitCase"]`) → lee `#learn-case .case-verdict`, la tabla `.case-solution` y los pasos `.case-steps`.
3. **PaCO₂ hasta el equilibrio**: sigue en CC-05 hasta que `truth.gas.paco2` quede a 1 mmHg o menos de `truth.gas.paco2Target` (con límite de 10 min simulados). Anota los minutos simulados, `tauMin` y el texto de `#case-gas`, que declara la aceleración.

Para otro cambio, añade un paso que haga lo que haría el alumno y lea el resultado en el cuadro o en el DOM, no en el código.

## 4. Evidence

`resumen.md` (para pegar en el PR), `evidencia.json` y las capturas `1-…png` a `5-…png`. Cada afirmación lleva su etiqueta:

- **medido**: leído en la app o en el cuadro del motor durante esta corrida (con su fuente: selector o campo).
- **inferido**: calculado a partir de lo medido, o visible sólo en una captura (el canvas no expone texto).
- **supuesto**: lo que no se comprobó en esta corrida. Dilo, no lo escondas.

Pon siempre las cifras de **antes y después** (modo, Ppico, VTe; PaCO₂ y su equilibrio) y los errores de página o de consola, aunque sean cero.

## 5. Cleanup

El script cierra el navegador y detiene su `vite` también si algo falla. Si lo arrancaste a mano, detenlo con `preview_stop` o terminando el proceso. Y no dejes servidores colgados en puertos que otra sesión espera.

## Mapa de funcionalidades

| Funcionalidad | Código (`src/`) | Prueba que la cubre |
| --- | --- | --- |
| Modos A/C VC, A/C PC y CPAP/PS; el cambio se aplica en la respiración siguiente | `engine/controller.ts` | `tests/bench/bm.test.ts` (BM-01…), `tests/bench/pc.test.ts`, `tests/unit/soporte.test.ts` (PHY-03c) |
| Marca del cambio de modo en las curvas, sin la pasada anterior | `render/waves.ts`, `render/signal.ts`, `ui/plotsView.ts` | `tests/unit/curvas.test.ts` (CUR-06) |
| «Esfuerzo normal» baja la FR para no apilar respiraciones | `ui/patientProfiles.ts`, `ui/instructorPanel.ts` | `tests/unit/patientProfiles.test.ts` (PRF-01) |
| Asincronías emergentes (doble disparo, esfuerzos inefectivos) | `engine/trigger.ts`, `engine/effort.ts` | `tests/unit/asynchrony.test.ts` (ASI-01, ASI-02) |
| Disparo, flujo de base y su retardo | `engine/trigger.ts` | `tests/unit/sync.test.ts` (SYN-01…04) |
| Bloqueos y mecánica (Pplat, Cstat, R) | `engine/procedures.ts`, `engine/breathAnalysis.ts` | `tests/unit/procedures.test.ts` (PRC-01…), `tests/unit/mecanica.test.ts` (MEC-01…) |
| Fuga, autodisparo y desconexión | `engine/patient.ts`, `engine/sensors.ts` | `tests/unit/fuga.test.ts` (LEAK-01…07) |
| Alarmas como las del manual | `engine/alarms.ts` | `tests/unit/alarms.test.ts` (ALM-URM) |
| Gasometría del modelo y su equilibrio acelerado (≈ 10×) | `engine/gasExchange.ts`, `ui/gasView.ts` | `tests/unit/gasometria.test.ts` (GAS-01…09) |
| Casos clínicos: entrega, criterios y «Cómo se resuelve» | `scenarios/cases.ts`, `ui/caseEvaluation.ts`, `ui/caseView.ts` | `tests/unit/casosClinicos.test.ts` (CAS-SOL), `tests/e2e/clinicalCases.spec.ts` |
| Versión del motor y aviso al importar sesiones | `engine/version.ts`, `history/session.ts` | `tests/unit/session.test.ts` (VER-01), `tests/unit/huella.test.ts` (HUE-01) |
| La física de cada escenario no cambia sin querer | todo `engine/` | `tests/unit/huella.test.ts` (HUE-01) |
| Un manejador por comando del dominio | `engine/commandHandlers.ts` | `tests/unit/commandHandlers.test.ts` (ARQ-02) |
| Regresión visual del equipo y del exterior | `render/`, `ui/styles/` | `tests/e2e/regresion.spec.ts` (VR-01), `tests/unit/capturas.test.ts` (VR-02) |
| Puertos por entorno para sesiones en paralelo | `vite.config.ts`, `playwright.config.ts` (fuera de `src/`) | `tests/e2e/interaction.spec.ts` (SEC-01/02) |
