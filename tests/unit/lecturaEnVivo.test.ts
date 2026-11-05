import { describe, expect, it } from 'vitest';
import { Simulator, type EngineFrame } from '../../src/engine/simulator';
import { defaultInit, REFERENCE_PROFILE } from '../../src/profiles';
import { findScenario } from '../../src/scenarios';
import { appendSamples, type Point, type WaveBreath } from '../../src/render/plots';
import { PATIENT_PROFILES, profileState } from '../../src/ui/patientProfiles';
import {
  flujoAlFinalDeLaEspiracion,
  lecturaAutoPeep,
  lecturasDeRespiracion,
  type ContextoLectura,
  type Lectura,
} from '../../src/ui/lecturaEnVivo';

// La lectura en vivo se calcula sobre lo que publica el motor, como lo recibe la interfaz: la traza cuadro a cuadro,
// las respiraciones terminadas y las detecciones de disparo. Cada caso usa el escenario que produce esa asincronía.

type Resultado = { lecturas: Lectura[]; flujoFinal: (number | null)[]; sim: Simulator };

function leer(sim: Simulator, hastaMs: number, perturbar?: (sim: Simulator) => void): Resultado {
  const puntos: Point[] = [];
  const disparos: number[] = [];
  let ultimaSeq = 0;
  while (sim.simTimeMs < hastaMs) {
    for (let k = 0; k < 25; k++) {
      sim.step();
      perturbar?.(sim);
    }
    const fr: EngineFrame = sim.frame();
    for (const e of fr.eventsTail) {
      if (e.kind !== 'breath' || e.sequence <= ultimaSeq) continue;
      ultimaSeq = e.sequence;
      if (typeof (e.payload as { trigger?: unknown }).trigger === 'number') disparos.push(e.simTimeMs / 1000);
    }
    appendSamples(puntos, fr.samples);
  }
  const fr = sim.frame();
  const c: ContextoLectura = {
    flowTriggerLpm: fr.settings.triggerByPressure ? null : fr.settings.flowTrigger * 60,
    pmax: fr.settings.pmax,
    expTriggerPct: fr.settings.expTriggerPct,
    peepi: fr.truth.peepiEndExp,
  };
  const respiraciones: WaveBreath[] = sim.breaths.map((b) => ({
    breathId: b.breathId,
    startSimTimeMs: b.startSimTimeMs,
    endSimTimeMs: b.endSimTimeMs,
    tInspS: b.tInspS,
    ppeak: b.ppeak,
    pplatCycle: b.pplatCycle,
    tauExpS: b.tauExpS ?? null,
    cyclingCause: b.cyclingCause,
    type: b.type,
  }));
  const lecturas: Lectura[] = [];
  const flujoFinal: (number | null)[] = [];
  respiraciones.forEach((b, i) => {
    lecturas.push(...lecturasDeRespiracion(b, respiraciones[i - 1] ?? null, puntos, disparos, c));
    flujoFinal.push(flujoAlFinalDeLaEspiracion(b, puntos));
  });
  return { lecturas, flujoFinal, sim };
}

function escenario(id: string, settings: Record<string, unknown> = {}): Simulator {
  const e = findScenario(id)!;
  const base = defaultInit({});
  return new Simulator(
    defaultInit({
      patient: { ...e.patient },
      effort: { ...e.effort },
      sensors: { ...e.sensors },
      settings: { ...base.settings, ...(e.settings ?? {}), ...settings },
      initialV: e.initialV ?? 'equilibrium',
    }),
    REFERENCE_PROFILE,
  );
}
const cuenta = (ls: Lectura[], kind: Lectura['kind'], desdeS = 0): number => ls.filter((l) => l.kind === kind && l.t >= desdeS).length;

describe('LEC-V · la lectura en vivo nombra lo que pasa en la curva', () => {
  it('banco pasivo (SC-01): nada que anotar y el flujo vuelve a cero', () => {
    const r = leer(escenario('SC-01'), 40_000);
    expect(r.lecturas).toEqual([]);
    expect(r.flujoFinal.slice(2).every((q) => q !== null && q > -1)).toBe(true);
    expect(lecturaAutoPeep(r.flujoFinal.at(-1) ?? null)).toBeNull();
  });

  it('SC-18: Ti neural 2 s frente a Ti mecánico 1 s da dobles disparos; con Rexp 60 los esfuerzos se vuelven inefectivos', () => {
    const e = findScenario('SC-18')!;
    const pendientes = [...e.perturbations];
    const r = leer(escenario('SC-18'), 90_000, (sim) => {
      while (pendientes.length && sim.simTimeMs >= pendientes[0]!.atSimTimeMs) {
        const p = pendientes.shift()!;
        if (p.patient) sim.command({ type: 'setPatient', params: p.patient });
      }
    });
    expect(cuenta(r.lecturas, 'doble')).toBeGreaterThanOrEqual(3);
    expect(r.lecturas.filter((l) => l.kind === 'doble' && l.t < 40).length).toBeGreaterThanOrEqual(3);
    expect(cuenta(r.lecturas, 'inefectivo', 45)).toBeGreaterThanOrEqual(3);
    expect(cuenta(r.lecturas, 'autodisparo')).toBe(0);
    const doble = r.lecturas.find((l) => l.kind === 'doble')!;
    expect(doble.porque).toMatch(/seguía inspirando/);
    expect(doble.porque).toMatch(/\d,\d\d s/); // coma decimal: es texto, no el monitor
  });

  it('«Esfuerzo débil» (Pmus 3 a 20/min, Rexp 35): esfuerzos inefectivos, sin dobles ni autodisparos', () => {
    const { patient, effort } = profileState(PATIENT_PROFILES.find((p) => p.id === 'weak')!);
    const base = defaultInit({});
    const sim = new Simulator(
      defaultInit({ patient, effort, settings: { ...base.settings, rr: 15, flowTrigger: 2 / 60 } }),
      REFERENCE_PROFILE,
    );
    const r = leer(sim, 60_000);
    expect(cuenta(r.lecturas, 'inefectivo')).toBeGreaterThanOrEqual(5);
    expect(cuenta(r.lecturas, 'doble')).toBe(0);
    expect(cuenta(r.lecturas, 'autodisparo')).toBe(0);
    expect(r.lecturas.find((l) => l.kind === 'inefectivo')!.porque).toMatch(/auto-PEEP/);
  });

  it('SC-22: la fuga dispara respiraciones que nadie pidió', () => {
    const r = leer(escenario('SC-22'), 60_000);
    expect(cuenta(r.lecturas, 'autodisparo')).toBeGreaterThanOrEqual(3);
    expect(cuenta(r.lecturas, 'inefectivo')).toBe(0);
    expect(r.lecturas.find((l) => l.kind === 'autodisparo')!.porque).toMatch(/fuga/);
  });

  it('SC-09: desde la oclusión, cada inspiración se corta por Pmáx', () => {
    const e = findScenario('SC-09')!;
    const pendientes = [...e.perturbations];
    const r = leer(escenario('SC-09'), 30_000, (sim) => {
      while (pendientes.length && sim.simTimeMs >= pendientes[0]!.atSimTimeMs) {
        const p = pendientes.shift()!;
        if (p.patient) sim.command({ type: 'setPatient', params: p.patient });
      }
    });
    expect(cuenta(r.lecturas, 'pmax', 12)).toBeGreaterThanOrEqual(3);
    expect(r.lecturas.filter((l) => l.kind === 'pmax' && l.t < 11).length).toBe(0);
    expect(r.lecturas.find((l) => l.kind === 'pmax')!.porque).toMatch(/Pmáx 40/);
  });

  it('CC-02: el flujo espiratorio no vuelve a cero y la lectura manda a medir la PEEP total', () => {
    const r = leer(escenario('CC-02'), 30_000);
    const q = r.flujoFinal.at(-1)!;
    expect(q).toBeLessThan(-3);
    expect(lecturaAutoPeep(q)).toMatch(/aire atrapado.*bloqueo espiratorio/);
  });

  it('los rótulos sobre la curva son cortos', () => {
    const r = leer(escenario('SC-22'), 30_000);
    for (const l of r.lecturas) expect(l.titulo.length).toBeLessThanOrEqual(20);
  });
});
