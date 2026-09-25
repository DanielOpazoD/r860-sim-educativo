import { describe, it, expect } from 'vitest';
import { benchSim, runUntilBreath, BENCH_PATIENT, BENCH_SETTINGS, BENCH_SENSORS } from '../helpers';
import { ACTUATOR_MAX_FLOW_LPS } from '../../src/engine/controller';

// BM-CC · compliance del circuito. Pulmón lineal C = 50 mL/cmH₂O, R = 10, PEEP 5, VC VT 500, Ti 1 s con pausa 0,3 s y
// circuito compresible Cc = 2 mL/cmH₂O. El sensor es de la máquina: el VTi mostrado sigue siendo el ajustado, pero el
// pulmón recibe menos y la Cstat medida por bloqueo sale ≈ C + Cc (punto docente del banco).
const simCc = () =>
  benchSim({
    patient: { ...BENCH_PATIENT, circuitComplianceLPerCmH2O: 0.002 },
    settings: { ...BENCH_SETTINGS, pausePct: 0.3 },
    sensors: { ...BENCH_SENSORS },
  });

describe('BM-CC circuito compresible', () => {
  it('el pulmón recibe ≈ VT·C/(C+Cc) y la meseta baja acorde', () => {
    const sim = simCc();
    runUntilBreath(sim, 4);
    const last = sim.breaths.length;
    expect(last).toBeGreaterThanOrEqual(4);
    // Volumen pulmonar por respiración: oscilación de vAbsL durante el último ciclo completo.
    const b = sim.breaths.at(-1)!;
    expect(b.pplatCycle).not.toBeNull();
    // ΔV pulmón = C·(Pplat − p0) − volumen base a PEEP: con p0 = 0 es C·(Pplat − PEEP)… mejor midiendo el balance:
    // entregado 500 mL = ΔV_pulmón + Cc·(Pplat − PEEP_exp). Con valores esperados: 480,8 + 2·9,62 ≈ 500.
    const vtPulmonMl = b.pplatCycle! * 0.05 * 1000 - (5 - 0) * 0.05 * 1000; // C·Pplat − C·PEEP
    expect(vtPulmonMl).toBeCloseTo((500 * 50) / 52, -1); // 480,8 mL ± ~1 % (tolerancia en la precisión del toBeCloseTo decimal)
    const pplatSobrePeep = b.pplatCycle! - 5;
    expect(pplatSobrePeep).toBeCloseTo(9.62, 1);
    // VTe de pantalla: el gas comprimido vuelve por la válvula espiratoria.
    expect(b.vtExp * 1000).toBeGreaterThan(500 * 0.98);
    expect(b.vtExp * 1000).toBeLessThan(500 * 1.02);
  });

  it('la Cstat del bloqueo inspiratorio sale ≈ C + Cc', () => {
    const sim = simCc();
    runUntilBreath(sim, 3);
    expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 }).accepted).toBe(true);
    runUntilBreath(sim, 5);
    const r = sim.procedures.last.inspHold!;
    expect(r.values.cstat?.quality).toBe('valid');
    expect(r.values.cstat!.value! * 1000).toBeCloseTo(52, 0);
  });

  it('la descompresión al espirar nunca supera el tope del actuador', () => {
    const sim = simCc();
    runUntilBreath(sim, 2);
    // Vigila el primer tramo de la espiración siguiente: la salida del gas comprimido se reparte en varios pasos.
    const breathsAntes = sim.breaths.length;
    let qMin = 0;
    let enExp = false;
    for (let i = 0; i < 4000 && !(enExp && sim.breaths.length > breathsAntes); i++) {
      sim.step();
      if (sim.controller.phase === 'exp') {
        enExp = true;
        qMin = Math.min(qMin, sim.controller.q);
      }
    }
    expect(enExp).toBe(true);
    expect(Math.abs(qMin)).toBeLessThanOrEqual(ACTUATOR_MAX_FLOW_LPS + 1e-9);
  });
});
