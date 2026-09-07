import { describe, expect, it } from 'vitest';
import { DEFAULT_EXP_VALVE_OPEN_MS } from '../../src/engine/controller';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim } from '../helpers';

// VAL-01 · apertura progresiva de la válvula espiratoria. Al terminar la inspiración la válvula no pasa de cerrada a
// abierta de golpe: su resistencia decae en unas decenas de ms, así que la Pva parte de la presión alveolar y baja
// hasta la PEEP, y el flujo espiratorio alcanza su pico después de abrirse, no en el primer instante.
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

describe('VAL-01 · la válvula espiratoria abre en decenas de milisegundos', () => {
  it('con válvula ideal la Pva salta a PEEP en un paso y el flujo arranca en su pico', () => {
    const tr = trazaEspiratoria({ patient: { ...BENCH_PATIENT, expValveOpenMs: 0 } });
    expect(tr[1]?.paw).toBeCloseTo(5, 6);
    const pico = Math.max(...tr.map((x) => x.q));
    expect(tr.findIndex((x) => x.q >= pico - 1e-9)).toBeLessThanOrEqual(2);
  });

  it('con apertura de 40 ms la Pva parte cerca de la presión alveolar y desciende hasta la PEEP', () => {
    const tr = trazaEspiratoria({ patient: { ...BENCH_PATIENT, expValveOpenMs: DEFAULT_EXP_VALVE_OPEN_MS } });
    expect(tr[1]?.paw).toBeGreaterThan(11); // arranca cerca de la meseta alveolar (15), no en PEEP
    expect(tr[1]?.paw).toBeLessThan(15.5);
    const enApertura = tr.filter((x) => x.t <= 0.04);
    for (let i = 1; i < enApertura.length; i++) expect(enApertura[i]!.paw).toBeLessThanOrEqual(enApertura[i - 1]!.paw + 1e-9);
    const tras = tr.find((x) => x.t > 0.06) as { paw: number };
    expect(tras.paw).toBeCloseTo(5, 1); // ya abierta, la Pva es la PEEP
  });

  it('el flujo espiratorio alcanza su pico después de abrirse la válvula, no en el primer instante', () => {
    const tr = trazaEspiratoria({ patient: { ...BENCH_PATIENT, expValveOpenMs: DEFAULT_EXP_VALVE_OPEN_MS } });
    const pico = Math.max(...tr.map((x) => x.q));
    const iPico = tr.findIndex((x) => x.q >= pico - 1e-9);
    expect(tr[0]!.q).toBeLessThan(pico * 0.35); // el flujo arranca casi nulo con la válvula cerrada
    expect(tr[iPico]!.t).toBeGreaterThan(0.02);
    expect(tr[iPico]!.t).toBeLessThan(0.08);
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
