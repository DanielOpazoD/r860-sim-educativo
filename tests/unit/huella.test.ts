import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { ACCEPTED_ENGINE_VERSIONS, ENGINE_VERSION } from '../../src/engine/version';
import { defaultInit, REFERENCE_PROFILE } from '../../src/profiles';
import { SCENARIOS } from '../../src/scenarios';

// HUE-01 · la huella del motor. Cada escenario corre 30 s con sus perturbaciones y se resume en un hash de todas las
// muestras (Paw, flujo, volumen, Pmus), de la banda de alarmas y de los registros de respiración, y en otro de la
// gasometría del modelo, que una sesión reproducida también recalcula aunque no realimente la mecánica (sólo ve lo que
// cambia en esos 30 s: una ventana de promedio más larga, por ejemplo, no la mueve). Es la red de la física,
// como VR-01 lo es de la imagen: un refactor del motor debe dejarla idéntica, y un cambio de física intencional la cambia
// sólo en los escenarios que toca —el diff de huella-motor.json lo muestra—. Los valores se redondean a 10 cifras
// significativas antes de resumirlos, para que una última cifra distinta entre plataformas no la mueva.
// Actualizar tras un cambio intencional: HUELLA_ACTUALIZAR=1 npx vitest run tests/unit/huella.test.ts (docs/04 §5).
// El archivo guarda también la versión del motor que la produjo (U-46): si la física cambió, la actualización se niega
// mientras ENGINE_VERSION no suba, para que las sesiones guardadas con la física anterior se reproduzcan con aviso.

const ARCHIVO = new URL('./huella-motor.json', import.meta.url);
const DURACION_MS = 30_000;

interface Huella {
  hash: string;
  gas: string;
  respiraciones: number;
}
interface ArchivoHuella {
  motor: string;
  escenarios: Record<string, Huella>;
}

function huella(id: string): Huella {
  const e = SCENARIOS.find((s) => s.id === id)!;
  const base = defaultInit({});
  const sim = new Simulator(
    defaultInit({
      patient: { ...e.patient },
      effort: { ...e.effort },
      sensors: { ...e.sensors },
      settings: { ...base.settings, ...(e.settings ?? {}) },
      initialV: e.initialV ?? 'equilibrium',
    }),
    REFERENCE_PROFILE,
  );
  const pendientes = [...(e.perturbations ?? [])];
  const h = createHash('sha256');
  const hGas = createHash('sha256');
  const redondear = (x: number): string => (Number.isFinite(x) ? x.toPrecision(10) : String(x));
  const cifras = (_k: string, v: unknown): unknown => (typeof v === 'number' ? redondear(v) : v);
  let paso = 0;
  while (sim.simTimeMs < DURACION_MS) {
    sim.step();
    while (pendientes.length && sim.simTimeMs >= pendientes[0]!.atSimTimeMs) {
      const p = pendientes.shift()!;
      if (p.patient) sim.command({ type: 'setPatient', params: p.patient });
      if (p.effort) sim.command({ type: 'setEffort', params: p.effort });
      if (p.sensors) sim.command({ type: 'setSensors', params: p.sensors });
    }
    if (++paso % 25 === 0) {
      const f = sim.frame();
      for (const canal of [f.samples.paw, f.samples.flow, f.samples.vol, f.samples.pmus]) h.update(Array.from(canal, redondear).join(','));
      h.update(JSON.stringify(f.alarmBar));
      hGas.update(JSON.stringify(f.truth.gas, cifras));
    }
  }
  h.update(JSON.stringify(sim.breaths, cifras));
  return { hash: h.digest('hex').slice(0, 16), gas: hGas.digest('hex').slice(0, 16), respiraciones: sim.breaths.length };
}

const leer = (): ArchivoHuella => JSON.parse(readFileSync(ARCHIVO, 'utf8')) as ArchivoHuella;

describe('HUE-01 · la física de cada escenario no cambia sin querer', () => {
  const actual: Record<string, Huella> = Object.fromEntries(SCENARIOS.map((s) => [s.id, huella(s.id)]));
  if (process.env.HUELLA_ACTUALIZAR) {
    const guardada = leer();
    const ids = new Set([...Object.keys(actual), ...Object.keys(guardada.escenarios)]);
    const cambio = [...ids].some((id) => JSON.stringify(actual[id]) !== JSON.stringify(guardada.escenarios[id]));
    if (cambio && guardada.motor === ENGINE_VERSION)
      throw new Error(
        `La física cambió y ENGINE_VERSION sigue en ${ENGINE_VERSION}: súbela en src/engine/version.ts y añade la nueva a ACCEPTED_ENGINE_VERSIONS antes de actualizar la huella (U-46, docs/04 §5).`,
      );
    writeFileSync(ARCHIVO, JSON.stringify({ motor: ENGINE_VERSION, escenarios: actual }, null, 2) + '\n');
  }
  const referencia = leer();

  it('la huella se tomó con esta versión del motor, y sus sesiones se aceptan (U-46)', () => {
    expect(referencia.motor, 'ENGINE_VERSION subió: vuelve a tomar la huella (docs/04 §5)').toBe(ENGINE_VERSION);
    expect(ACCEPTED_ENGINE_VERSIONS).toContain(ENGINE_VERSION);
  });
  it('cubre todos los escenarios y ninguno más', () =>
    expect(Object.keys(referencia.escenarios).sort()).toEqual(Object.keys(actual).sort()));
  for (const s of SCENARIOS)
    it(`${s.id} · ${s.name}`, () =>
      expect(actual[s.id], 'si el cambio es intencional, sube ENGINE_VERSION y actualiza la huella (docs/04 §5)').toEqual(
        referencia.escenarios[s.id],
      ));
});
