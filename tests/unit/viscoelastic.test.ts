import { describe, expect, it } from 'vitest';
import { PatientModel } from '../../src/engine/patient';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// VIS-01 · relajación de esfuerzo (cuerpo de Maxwell). Referencias analíticas, no numéricas:
//   inflado a flujo constante Q desde reposo:  V − Vve = Q·tau·(1 − e^(−t/tau))
//   oclusión:                                  Pel(t) = P0 + V/C1 + E2·(V − Vve)|oclusión · e^(−t/tau)
const C1 = 0.05,
  R = 10,
  E2 = 10,
  TAU = 1.5,
  Q = 0.5,
  TI = 1;
const visc = { ...BENCH_PATIENT, eVisc: E2, tauViscS: TAU };
const gap = (t: number): number => Q * TAU * (1 - Math.exp(-t / TAU)); // V − Vve durante el inflado

describe('VIS-01 · modelo viscoelástico contra su solución analítica', () => {
  it('con E2 = 0 el modelo es exactamente el de un compartimento', () => {
    const p = new PatientModel({ ...BENCH_PATIENT }, 0.25);
    p.integrateFlowSource(Q, TI);
    expect(p.pVisc).toBe(0);
    expect(p.pel()).toBeCloseTo(0.75 / C1, 12);
    expect(p.pel()).toBe(p.pelStatic());
  });

  it('inflado a flujo constante: la separación V − Vve sigue Q·tau·(1 − e^(−t/tau)) y no depende del paso', () => {
    const uno = new PatientModel(visc, 0.25);
    uno.integrateFlowSource(Q, TI); // un solo tramo
    const muchos = new PatientModel(visc, 0.25);
    for (let i = 0; i < 250; i++) muchos.integrateFlowSource(Q, TI / 250); // 250 tramos de 4 ms
    expect(uno.v - uno.vVisc).toBeCloseTo(gap(TI), 12);
    expect(muchos.v - muchos.vVisc).toBeCloseTo(gap(TI), 12);
    expect(uno.pVisc).toBeCloseTo(E2 * gap(TI), 12);
    expect(uno.pVisc).toBeCloseTo(3.649372, 5);
  });

  it('oclusión: caída inmediata resistiva (Ppico − P1 = R·Q) y luego decaimiento exponencial hasta la meseta estática', () => {
    const p = new PatientModel(visc, 0.25);
    p.integrateFlowSource(Q, TI);
    const ppico = p.pawForFlow(Q, 0);
    const p1 = p.pel();
    expect(ppico - p1).toBeCloseTo(R * Q, 12); // la interrupción sólo quita lo resistivo
    expect(ppico).toBeCloseTo(23.649372, 5);
    expect(p1).toBeCloseTo(18.649372, 5);
    const pInf = p.pelStatic();
    expect(pInf).toBeCloseTo(15, 12);
    for (const [t, esperado] of [
      [0.5, 15 + E2 * gap(TI) * Math.exp(-0.5 / TAU)],
      [3, 15 + E2 * gap(TI) * Math.exp(-3 / TAU)],
    ] as [number, number][]) {
      const q = new PatientModel(visc, 0.25);
      q.integrateFlowSource(Q, TI);
      q.integrateFlowSource(0, t); // oclusión: el volumen no cambia, sólo relaja
      expect(q.v).toBeCloseTo(0.75, 12);
      expect(q.pel()).toBeCloseTo(esperado, 10);
    }
  });

  it('tras 6 constantes la meseta está a menos de 1 % del valor estático', () => {
    const p = new PatientModel(visc, 0.25);
    p.integrateFlowSource(Q, TI);
    p.integrateFlowSource(0, 6 * TAU);
    expect((p.pel() - 15) / (E2 * gap(TI))).toBeLessThan(0.01);
  });
});

describe('VIS-02 · consecuencias en el ventilador', () => {
  it('el bloqueo inspiratorio mide una meseta por encima de la estática y la Cstat resultante subestima la compliance', () => {
    const sim = benchSim({ patient: visc, settings: { ...BENCH_SETTINGS, plimit: 100 } });
    runUntilBreath(sim, 2);
    expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 }).accepted).toBe(true);
    runUntilBreath(sim, 5);
    const h = sim.frame().procedure.last.inspHold;
    expect(h?.quality).toBe('valid');
    const pplat = h?.values.pplat?.value as number;
    expect(pplat).toBeGreaterThan(15); // todavía queda presión viscoelástica tras 3 s
    expect(pplat).toBeLessThan(16.5);
    expect(h?.values.cstat?.value as number).toBeLessThan(C1); // Cstat = VT/(Pplat − PEEP) infravalora
    expect(h?.values.cstat?.value as number).toBeGreaterThan(0.043);
  });

  it('una pausa corta no da meseta de ciclo: la presión sigue cayendo y se declara inestable', () => {
    const sim = benchSim({ patient: { ...visc, eVisc: 20 }, settings: { ...BENCH_SETTINGS, pausePct: 0.2 } });
    runUntilBreath(sim, 3);
    const b = sim.breaths.at(-1);
    expect(b?.pplatCycle).toBeNull();
    expect(b?.pplatCycleReason).toBeTruthy();
  });

  it('sin relajación la misma pausa sí da meseta estable', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, pausePct: 0.2 } });
    runUntilBreath(sim, 3);
    expect(sim.breaths.at(-1)?.pplatCycle).toBeCloseTo(15, 1);
  });
});

// VIS-03 · resistencia de Rohrer: R(Q) = R1 + R2·|Q|, la caída resistiva deja de ser proporcional al flujo.
describe('VIS-03 · resistencia no lineal de Rohrer', () => {
  it('con K2 = 5, duplicar el flujo multiplica la caída resistiva por 2,4 en vez de por 2', () => {
    const lento = benchSim({ patient: { ...BENCH_PATIENT, r2: 5 } }); // Q = 0.5 L/s
    runUntilBreath(lento, 1);
    const rapido = benchSim({ patient: { ...BENCH_PATIENT, r2: 5 }, settings: { ...BENCH_SETTINGS, rr: 30 } }); // Q = 1 L/s
    runUntilBreath(rapido, 1);
    expect(lento.breaths[0]?.ppeak).toBeCloseTo(21.25, 2); // 5 + (10 + 5·0.5)·0.5 + 10
    expect(rapido.breaths[0]?.ppeak).toBeCloseTo(30, 2); // 5 + (10 + 5·1)·1 + 10
    const caidaLenta = (lento.breaths[0]?.ppeak as number) - 15;
    const caidaRapida = (rapido.breaths[0]?.ppeak as number) - 15;
    expect(caidaRapida / caidaLenta).toBeCloseTo(2.4, 2);
  });

  it('K2 no cambia la meseta: la carga elástica es la misma', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, r2: 8 }, settings: { ...BENCH_SETTINGS, pausePct: 0.25 } });
    runUntilBreath(sim, 3);
    expect(sim.breaths.at(-1)?.pplatCycle).toBeCloseTo(15, 1);
  });

  it('K2 fuera de 0–50 se rechaza', () => {
    expect(() => benchSim({ patient: { ...BENCH_PATIENT, r2: 80 } })).toThrow(/Rohrer/);
    expect(() => benchSim({ patient: { ...BENCH_PATIENT, eVisc: 60 } })).toThrow(/viscoelástica/);
    expect(() => benchSim({ patient: { ...BENCH_PATIENT, eVisc: 5, tauViscS: 20 } })).toThrow(/viscoelástica/);
  });
});

// VIS-04 · regresión: la respiración que sigue a un bloqueo espiratorio no puede tomar la presión de la oclusión como PEEPe.
describe('VIS-04 · la PEEPe de referencia no se contamina con la oclusión previa', () => {
  it('tras un bloqueo espiratorio con atrapamiento, el ΔP y la Cstat del siguiente bloqueo usan PEEP, no PEEP total', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, rExp: 30 }, settings: { ...BENCH_SETTINGS, rr: 25, ie: 1, plimit: 100 } });
    runUntilBreath(sim, 10);
    sim.command({ type: 'requestHold', kind: 'expHold', durationS: 5 });
    runUntilBreath(sim, 14);
    const exp = sim.frame().procedure.last.expHold;
    expect(exp?.quality).toBe('valid');
    const peepTot = exp?.values.peepTot?.value as number;
    expect(peepTot).toBeGreaterThan(10); // hay atrapamiento: PEEP total muy por encima de la programada
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    runUntilBreath(sim, 18);
    const insp = sim.frame().procedure.last.inspHold;
    expect(insp?.quality).toBe('valid');
    // El denominador declarado y el usado tienen que coincidir: con PEEPtot medida, la Cstat recupera la compliance real.
    expect(insp?.values.cstat?.reason).toMatch(/PEEPtot/);
    expect(insp?.values.cstat?.value as number).toBeCloseTo(C1, 3);
    expect(sim.breaths.at(-1)?.peepe).toBeCloseTo(5, 6); // la PEEPe registrada sigue siendo la programada
  });
});
