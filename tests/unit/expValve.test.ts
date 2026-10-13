import { describe, expect, it } from 'vitest';
import { DEFAULT_EXP_BRANCH_R_CMH2O_S_L, DEFAULT_EXP_VALVE_OPEN_MS } from '../../src/engine/controller';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim } from '../helpers';

// VAL-01 · apertura progresiva de la válvula espiratoria. Al terminar la inspiración la válvula no pasa de cerrada a
// abierta de golpe: su resistencia decae en ≈ 110 ms (el Carescape en el banco de Pinède 2021), así que la Pva parte de
// la presión alveolar y baja hasta la PEEP, y el flujo espiratorio alcanza su pico después de abrirse, no en el primer instante.
const APERTURA_S = DEFAULT_EXP_VALVE_OPEN_MS / 1000;
function trazaEspiratoria(over: Parameters<typeof benchSim>[0]): { t: number; paw: number; q: number }[] {
  const sim = benchSim({ ...over, settings: { ...BENCH_SETTINGS, plimit: 100 } });
  while (sim.breaths.length < 3) sim.step();
  const out: { t: number; paw: number; q: number }[] = [];
  let t = 0;
  while (sim.frame().live.phase !== 'exp') sim.step();
  while (sim.frame().live.phase === 'exp') {
    out.push({ t, paw: sim.frame().live.paw, q: -sim.frame().live.flowLps });
    sim.step();
    t += 0.004;
  }
  return out;
}

describe('VAL-01 · la válvula espiratoria abre en ≈ 110 ms, como el Carescape en banco', () => {
  it('con válvula ideal la Pva salta a PEEP en un paso y el flujo arranca en su pico', () => {
    const tr = trazaEspiratoria({ patient: { ...BENCH_PATIENT, expValveOpenMs: 0 } });
    expect(tr[1]?.paw).toBeCloseTo(5, 6);
    const pico = Math.max(...tr.map((x) => x.q));
    expect(tr.findIndex((x) => x.q >= pico - 1e-9)).toBeLessThanOrEqual(2);
  });

  it('con la apertura del equipo la Pva parte cerca de la presión alveolar y desciende hasta la PEEP', () => {
    const tr = trazaEspiratoria({ patient: { ...BENCH_PATIENT, expValveOpenMs: DEFAULT_EXP_VALVE_OPEN_MS } });
    expect(tr[1]?.paw).toBeGreaterThan(11); // arranca cerca de la meseta alveolar (15), no en PEEP
    expect(tr[1]?.paw).toBeLessThan(15.5);
    const enApertura = tr.filter((x) => x.t <= APERTURA_S);
    for (let i = 1; i < enApertura.length; i++) expect(enApertura[i]!.paw).toBeLessThanOrEqual(enApertura[i - 1]!.paw + 1e-9);
    const tras = tr.find((x) => x.t > APERTURA_S + 0.02) as { paw: number };
    expect(tras.paw).toBeCloseTo(5, 1); // ya abierta, la Pva es la PEEP
  });

  it('el flujo espiratorio alcanza su pico después de abrirse la válvula, no en el primer instante', () => {
    const tr = trazaEspiratoria({ patient: { ...BENCH_PATIENT, expValveOpenMs: DEFAULT_EXP_VALVE_OPEN_MS } });
    const pico = Math.max(...tr.map((x) => x.q));
    const iPico = tr.findIndex((x) => x.q >= pico - 1e-9);
    expect(tr[0]!.q).toBeLessThan(pico * 0.35); // el flujo arranca casi nulo con la válvula cerrada
    expect(tr[iPico]!.t).toBeGreaterThan(0.02);
    expect(tr[iPico]!.t).toBeLessThan(APERTURA_S + 0.04);
  });

  it('la apertura no cambia el volumen espirado ni la PEEP total de forma apreciable', () => {
    const ideal = benchSim({ patient: { ...BENCH_PATIENT, expValveOpenMs: 0 } });
    const real = benchSim({ patient: { ...BENCH_PATIENT, expValveOpenMs: DEFAULT_EXP_VALVE_OPEN_MS } });
    while (ideal.breaths.length < 8) ideal.step();
    while (real.breaths.length < 8) real.step();
    expect(real.breaths.at(-1)?.vtExp).toBeCloseTo(ideal.breaths.at(-1)?.vtExp as number, 3);
    expect(real.frame().truth.peepiEndExp - ideal.frame().truth.peepiEndExp).toBeLessThan(0.05);
  });

  it('una apertura fuera de 0–200 ms se rechaza', () => {
    expect(() => benchSim({ patient: { ...BENCH_PATIENT, expValveOpenMs: 500 } })).toThrow(/válvula espiratoria/);
  });
});

describe('VAL-02 · la rama espiratoria del equipo frena lo que sale, no lo que entra', () => {
  it('con la rama por omisión la Pva queda sobre la PEEP en R_rama·|Q| mientras se espira', () => {
    const { rExpValve: _, ...sinRama } = BENCH_PATIENT;
    const tr = trazaEspiratoria({ patient: { ...sinRama, expValveOpenMs: 0 } });
    // Ya abierta y con flujo apreciable: la diferencia sobre la PEEP es la caída en la rama.
    for (const x of tr.filter((y) => y.t > 0.05 && y.t < 0.6)) expect(x.paw - 5).toBeCloseTo(DEFAULT_EXP_BRANCH_R_CMH2O_S_L * x.q, 1);
  });

  it('un esfuerzo tardío inhala lo mismo con rama o sin ella: ese gas viene del flujo de base por la rama inspiratoria', () => {
    const pico = (rExpValve: number): number => {
      const sim = benchSim({
        patient: { ...BENCH_PATIENT, rExpValve },
        // Esfuerzo débil al final de una espiración larga (pulmón ya vacío), sin asistencia: no dispara nada.
        effort: { enabled: true, amplitude: 1, ratePerMin: 10, tiS: 0.6, phaseS: 5 },
        settings: { ...BENCH_SETTINGS, assistControl: false, rr: 10, ie: 1 / 4 },
      });
      let qMax = 0;
      while (sim.breaths.length < 6) {
        sim.step();
        if (sim.frame().live.phase === 'exp') qMax = Math.max(qMax, sim.frame().live.flowLps);
      }
      return qMax;
    };
    const sin = pico(0);
    expect(sin).toBeGreaterThan(0.01);
    expect(pico(DEFAULT_EXP_BRANCH_R_CMH2O_S_L)).toBeCloseTo(sin, 3);
  });
});
