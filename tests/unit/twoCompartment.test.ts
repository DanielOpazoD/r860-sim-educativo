import { describe, expect, it } from 'vitest';
import { PatientModel } from '../../src/engine/patient';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// PEN-01 · dos unidades alveolares en paralelo sobre un nodo común.
// Ocluido:  dV1/dt = (P2 − P1)/(R1 + R2)  →  la diferencia de presiones decae con
//   tau_pendelluft = (R1 + R2)·C1·C2/(C1 + C2)   y la presión común final es (V1 + V2)/(C1 + C2).
const C1 = 0.05,
  C2 = 0.03,
  R1 = 10,
  R2 = 60;
const dos = { ...BENCH_PATIENT, crs: C1, rInsp: R1, rExp: R1, second: { crs: C2, rInsp: R2, rExp: R2 } };
const tauPen = ((R1 + R2) * C1 * C2) / (C1 + C2);

describe('PEN-01 · pendelluft con el circuito ocluido', () => {
  it('el gas pasa de la unidad rápida a la lenta y las presiones convergen con tau = (R1+R2)·C1·C2/(C1+C2)', () => {
    const p = new PatientModel(dos, 0);
    p.v = 0.6; // unidad rápida llena
    p.vVisc = p.v;
    p.v2 = 0.15; // unidad lenta vacía
    const dp0 = p.pel() - p.pel2();
    expect(dp0).toBeCloseTo(0.6 / C1 - 0.15 / C2, 12);
    const total = p.v + p.v2;
    const pFinal = total / (C1 + C2);
    for (let i = 0; i < 500; i++) p.integrateFlowSource(0, tauPen / 500); // una constante de tiempo
    expect(p.v + p.v2).toBeCloseTo(total, 9); // con el circuito cerrado no entra ni sale gas
    expect(p.pel() - p.pel2()).toBeCloseTo(dp0 * Math.exp(-1), 4);
    for (let i = 0; i < 2000; i++) p.integrateFlowSource(0, (6 * tauPen) / 2000);
    expect(p.pel()).toBeCloseTo(pFinal, 2);
    expect(p.pel2()).toBeCloseTo(pFinal, 2);
    expect(p.equilibratedPressure()).toBeCloseTo(pFinal, 6);
  });

  it('el reparto no depende del paso de integración', () => {
    const mk = (): PatientModel => {
      const p = new PatientModel(dos, 0);
      p.v = 0.6;
      p.vVisc = 0.6;
      p.v2 = 0.15;
      return p;
    };
    const a = mk(),
      b = mk();
    for (let i = 0; i < 100; i++) a.integrateFlowSource(0, 0.004);
    for (let i = 0; i < 400; i++) b.integrateFlowSource(0, 0.001);
    expect(a.v).toBeCloseTo(b.v, 6);
    expect(a.v2).toBeCloseTo(b.v2, 6);
  });

  it('la presión del nodo con flujo impuesto es la media ponderada por las conductancias', () => {
    const p = new PatientModel(dos, 0);
    p.v = 0.6;
    p.vVisc = 0.6;
    p.v2 = 0.15;
    const py = p.nodePressureForFlow(0, 0);
    expect(py).toBeCloseTo((p.pel() / R1 + p.pel2() / R2) / (1 / R1 + 1 / R2), 6);
    expect(p.branch1Flow(py, 0) + p.branch2Flow(py, 0)).toBeCloseTo(0, 9);
  });
});

describe('PEN-02 · consecuencias en las curvas', () => {
  it('el vaciamiento deja de ser una sola exponencial: al final domina la constante lenta', () => {
    const sim = benchSim({ patient: dos, settings: { ...BENCH_SETTINGS, plimit: 100, rr: 10 } });
    runUntilBreath(sim, 6);
    const q: number[] = [];
    let prevExp = false;
    while (q.length < 2 || sim.frame().live.phase === 'exp') {
      sim.step();
      const exp = sim.frame().live.phase === 'exp';
      if (exp && prevExp) q.push(-sim.frame().live.flowLps);
      prevExp = exp;
    }
    // Constante de tiempo aparente al principio y al final del vaciamiento: si fuera monoexponencial serían iguales.
    const tauDe = (a: number, b: number, dt: number): number => dt / Math.log(a / b);
    const dt = 0.004;
    const tauIni = tauDe(q[5] as number, q[30] as number, 25 * dt);
    const tauFin = tauDe(q[q.length - 60] as number, q[q.length - 10] as number, 50 * dt);
    expect(tauFin / tauIni).toBeGreaterThan(1.5); // la cola es claramente más lenta
  });

  it('la meseta de una oclusión depende de su duración: el pendelluft sigue moviendo gas', () => {
    const sim = benchSim({ patient: dos, settings: { ...BENCH_SETTINGS, plimit: 100, rr: 10 } });
    runUntilBreath(sim, 4);
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    runUntilBreath(sim, 8);
    const corto = sim.frame().procedure.last.inspHold;
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 10 });
    runUntilBreath(sim, 14);
    const largo = sim.frame().procedure.last.inspHold;
    expect(corto?.quality).toBe('valid');
    expect(largo?.quality).toBe('valid');
    // Con dos constantes la presión sigue cayendo mientras el gas se redistribuye: la oclusión larga mide menos.
    expect(largo?.values.pplat?.value as number).toBeLessThan((corto?.values.pplat?.value as number) - 0.15);
  });

  it('con una sola unidad la meseta no depende de la duración', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, plimit: 100, rr: 10 } });
    runUntilBreath(sim, 4);
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    runUntilBreath(sim, 8);
    const corto = sim.frame().procedure.last.inspHold?.values.pplat?.value as number;
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 10 });
    runUntilBreath(sim, 14);
    const largo = sim.frame().procedure.last.inspHold?.values.pplat?.value as number;
    expect(Math.abs(largo - corto)).toBeLessThan(0.05);
  });

  it('el volumen absoluto del panel docente suma las dos unidades', () => {
    const sim = benchSim({ patient: dos });
    runUntilBreath(sim, 3);
    expect(sim.frame().truth.vAbsL).toBeCloseTo(sim.patient.v + sim.patient.v2, 9);
  });
});
