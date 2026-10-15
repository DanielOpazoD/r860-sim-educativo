# Ventila Lab · cómo trabajar en este repositorio

Simulador educativo de ventilación mecánica (Vite + TypeScript, motor en Web Worker). Antes de tocar algo, lee
`docs/04-arquitectura.md` (capas, contratos, puertas). Todo se escribe en español: código, comentarios, commits y PR.

## Cómo pedir una tarea

Una buena petición trae tres cosas:

1. **Objetivo**: qué debe pasar en la app, dicho como lo vería el alumno o el docente.
2. **Comprobación de «terminado»** que pueda pasar o fallar. Por ejemplo: «en CC-05, con VT 500 y FR 14, entregar da
   "Caso resuelto"»; no «que quede mejor».
3. **La prueba que quieres ver**: una captura, una cifra de antes y después, o el nombre de una prueba.

Si falta alguna, pregunta antes de empezar.

## Antes de decir que algo funciona

- Usa **/verify-r860** (`.claude/skills/verify-r860/`). Una CI en verde no basta: dice que las pruebas pasan, no que
  la app haga lo pedido.
- Entrega **evidencia etiquetada**: *medido* (leído en la app o en el cuadro del motor), *inferido* (calculado o sólo
  visible en una captura) o *supuesto* (no comprobado). Siempre con cifras de antes y después.
- Todo PR que toque la física (`src/engine/`, la gasometría, la mecánica de los escenarios o los perfiles de paciente)
  pasa por el agente **`revisor`** antes de fusionarse.
- `npm run check` es la puerta rápida; `npm run ci` repite la integración continua y regenera las cifras.

## Qué hace cumplir cada regla

| Regla | La hace cumplir |
| --- | --- |
| Las cifras de README y `docs/` salen de los artefactos, no de memoria | `scripts/doc-facts.py` (`npm run docs:facts`; `--check` en la CI) |
| Cada capa sólo importa las de abajo | `scripts/check-deps.mjs` (`npm run deps`, dentro de `check`) |
| Si cambia la física, sube la versión del motor | Huella HUE-01 (`tests/unit/huella.test.ts` y `huella-motor.json`): no se deja actualizar sin subir `ENGINE_VERSION` |
| La imagen del equipo no cambia sin querer | Capturas de Playwright VR-01 (`tests/e2e/regresion.spec.ts`; criterios en `docs/09-auditoria-visual.md`) |
| Cada afirmación lleva marca D/O/P/U y cita algo que existe | `evidence.json` y `tests/unit/evidencia.test.ts` (EVI) |
| main sólo recibe PR con la verificación en verde | Protección de `main`: exige el check «verificar» |

## Trabajo en paralelo

- Varias sesiones a la vez **sólo si tocan archivos distintos**, cada una en su worktree y con su puerto
  (`PORT` para dev o preview, `E2E_PORT` para la e2e).
- Lo que toque **el motor o la gasometría, de uno en uno**. #174 y #177 cambiaron la gasometría a la vez: el segundo
  tuvo que rehacer la huella, y los dos numeraron igual una entrada de `evidence.json`.
- Al fusionar en serie, el **segundo PR** se pone al día con `main` y regenera: la huella
  (`HUELLA_ACTUALIZAR=1 npx vitest run tests/unit/huella.test.ts`), las cifras (`npm run ci`: README y
  `docs/01-resultados.md`) y las capturas que cambien (las de macOS en local; las de Linux, desde el artefacto
  `capturas-linux` de la CI). Si dos PR toman el mismo E-nnn, el segundo renumera el suyo.
- La protección de `main` no exige que la rama esté al día: compruébalo tú antes de fusionar.
- No fusiones sin la aprobación explícita del usuario.

## Commits y PR

Prefijo por tema («técnico:», «visual:», «mecánica:», «evidencia:») y un cuerpo que diga qué cambió y por qué.
Los commits que haga Claude terminan con su línea `Co-Authored-By`.
