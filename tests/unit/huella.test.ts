import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { defaultInit, REFERENCE_PROFILE } from '../../src/profiles';
import { SCENARIOS } from '../../src/scenarios';

// HUE-01 · la huella del motor. Cada escenario corre 30 s con sus perturbaciones y se resume en un hash de todas las
// muestras (Paw, flujo, volumen, Pmus), de la banda de alarmas y de los registros de respiración. Es la red de la física,
// como VR-01 lo es de la imagen: un refactor del motor debe dejarla idéntica, y un cambio de física intencional la cambia
// sólo en los escenarios que toca —el diff de huella-motor.json lo muestra—. Los valores se redondean a 10 cifras
// significativas antes de resumirlos, para que una última cifra distinta entre plataformas no la mueva.
// Actualizar tras un cambio intencional: HUELLA_ACTUALIZAR=1 npx vitest run tests/unit/huella.test.ts (docs/04 §5).

const ARCHIVO = new URL('./huella-motor.json', import.meta.url);
const DURACION_MS = 30_000;

function huella(id: string): { hash: string; respiraciones: number } {
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
  const redondear = (x: number): string => (Number.isFinite(x) ? x.toPrecision(10) : String(x));
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
    }
  }
  h.update(JSON.stringify(sim.breaths, (_k, v: unknown) => (typeof v === 'number' ? redondear(v) : v)));
  return { hash: h.digest('hex').slice(0, 16), respiraciones: sim.breaths.length };
}

describe('HUE-01 · la física de cada escenario no cambia sin querer', () => {
  const actual = Object.fromEntries(SCENARIOS.map((s) => [s.id, huella(s.id)]));
  if (process.env.HUELLA_ACTUALIZAR) writeFileSync(ARCHIVO, JSON.stringify(actual, null, 2) + '\n');
  const referencia = JSON.parse(readFileSync(ARCHIVO, 'utf8')) as typeof actual;

  it('cubre todos los escenarios y ninguno más', () => expect(Object.keys(referencia).sort()).toEqual(Object.keys(actual).sort()));
  for (const s of SCENARIOS)
    it(`${s.id} · ${s.name}`, () =>
      expect(actual[s.id], 'si el cambio es intencional, actualiza la huella (docs/04 §5)').toEqual(referencia[s.id]));
});
