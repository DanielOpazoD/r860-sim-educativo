import { describe, it, expect } from 'vitest';
import { benchSim, runUntilBreath, BENCH_PATIENT, BENCH_SETTINGS, BENCH_SENSORS } from '../helpers';
import type { EffortParams } from '../../src/domain/types';
import type { Simulator } from '../../src/engine/simulator';

// BM-EA · espiración activa. VC sobre el pulmón del banco con esfuerzo neural (12/min, ti 0,8, riseRelax — alineado
// como en SC-19/SC-20): la contracción espiratoria (Pmus negativa) sube el flujo espiratorio y puede vaciar por
// debajo de la FRC; con limitación al flujo (Starling) el flujo no aumenta — el punto docente.
const ESF = { enabled: true, amplitude: 8, ratePerMin: 12, tiS: 0.8, phaseS: 0.5, shape: 'riseRelax' } as const;
const simEa = (expAmplitude: number, patient = BENCH_PATIENT) =>
  benchSim({
    patient: { ...patient },
    settings: { ...BENCH_SETTINGS, rr: 12 },
    sensors: { ...BENCH_SENSORS },
    effort: { ...ESF, expAmplitude } as EffortParams,
  });

/** Pico |Q| espiratorio y volumen pulmonar mínimo del siguiente ciclo completo, leídos del sensor/verdad. */
function expStats(sim: Simulator): { qMin: number; vMin: number } {
  const n0 = sim.breaths.length;
  let qMin = 0,
    vMin = Infinity,
    enExp = false;
  for (let i = 0; i < 9000 && !(enExp && sim.breaths.length > n0); i++) {
    sim.step();
    if (sim.controller.phase === 'exp') {
      enExp = true;
      qMin = Math.min(qMin, sim.controller.q);
      vMin = Math.min(vMin, sim.patient.v);
    }
  }
  return { qMin, vMin };
}

/** |Q| en el instante en que el volumen pulmonar cruza `vRef` durante la espiración (comparación a volumen igual). */
function qAtVolume(sim: Simulator, vRef: number): number {
  const n0 = sim.breaths.length;
  for (let i = 0; i < 9000; i++) {
    sim.step();
    if (sim.controller.phase === 'exp' && sim.controller.q < 0 && sim.patient.v <= vRef) return sim.controller.q;
    if (sim.breaths.length > n0) break;
  }
  return Number.NaN;
}

describe('BM-EA espiración activa', () => {
  it('el pico de flujo espiratorio crece ≥15 % con expAmplitude 8', () => {
    const pasivo = simEa(0),
      activo = simEa(8);
    runUntilBreath(pasivo, 4);
    runUntilBreath(activo, 4);
    const qp = Math.abs(expStats(pasivo).qMin),
      qa = Math.abs(expStats(activo).qMin);
    expect(qa).toBeGreaterThan(qp * 1.15);
  });

  it('en estado estable VTe ≥ VTi·0,99 y el pulmón vacía por debajo de su FRC pasiva', () => {
    const pasivo = simEa(0),
      activo = simEa(8),
      fuerte = simEa(15);
    runUntilBreath(pasivo, 5);
    runUntilBreath(activo, 5);
    runUntilBreath(fuerte, 5);
    const ba = activo.breaths.at(-1)!;
    expect(ba.vtExp).toBeGreaterThanOrEqual(ba.vtInsp * 0.99);
    // El pulmón baja de la FRC durante el pulso espiratorio; el sensor no lo ve porque el pulmón se relena después.
    expect(expStats(activo).vMin).toBeLessThan(expStats(pasivo).vMin);
    // Con un esfuerzo fuerte el VTe mostrado sí supera al pasivo (el gas extra sale por la válvula).
    const bf = fuerte.breaths.at(-1)!;
    expect(bf.vtExp).toBeGreaterThan(bf.vtInsp * 1.05);
  });

  it('con limitación al flujo espiratorio, a igual volumen el flujo activo no supera al pasivo en más de 3 % (Starling)', () => {
    // Paciente con colapso espiratorio como el escenario de EFL (SC-16). El tope es (Pel − Pcrit)/Rus a cada
    // volumen: al inicio de la espiración (volumen alto) queda holgado y el esfuerzo sí sube el pico temprano, pero
    // a VOLUMEN IGUAL el flujo no puede exceder el tope iso-volumen — el punto docente del resistor de Starling.
    const efl = { ...BENCH_PATIENT, rInsp: 15, rExp: 25, efl: { pcrit: 8, rusFraction: 0.5 } };
    const pasivo = simEa(0, efl),
      activo = simEa(8, efl),
      fuerte = simEa(15, efl);
    runUntilBreath(pasivo, 4);
    runUntilBreath(activo, 4);
    runUntilBreath(fuerte, 4);
    const vRef = 0.55;
    const qp = Math.abs(qAtVolume(pasivo, vRef)),
      qa = Math.abs(qAtVolume(activo, vRef)),
      qf = Math.abs(qAtVolume(fuerte, vRef));
    expect(qa).toBeLessThanOrEqual(qp * 1.03 + 1e-9);
    expect(qf).toBeLessThanOrEqual(qa * 1.03 + 1e-9); // doblar el esfuerzo tampoco sube el flujo a ese volumen
  });
});
