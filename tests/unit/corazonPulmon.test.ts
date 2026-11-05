import { describe, expect, it } from 'vitest';
import { DEFAULT_CIRCULATION, circulationEquilibrium, circulationParams, pleuralTransmission } from '../../src/engine/circulation';
import { gasParams } from '../../src/engine/gasExchange';
import { oxygenEquilibrium } from '../../src/engine/oxygenation';
import { Simulator } from '../../src/engine/simulator';
import { REFERENCE_PROFILE, defaultInit } from '../../src/profiles';
import { findScenario, type Scenario } from '../../src/scenarios';
import { validatePatientParams } from '../../src/domain/validation';
import type { CirculationParams, VcSettings } from '../../src/domain/types';

const simular = (sc: Scenario, patient: Partial<Scenario['patient']> = {}): Simulator => {
  const base = defaultInit();
  return new Simulator(
    defaultInit({
      patient: { ...sc.patient, ...patient },
      effort: sc.effort,
      sensors: sc.sensors,
      settings: { ...base.settings, ...sc.settings },
    }),
    REFERENCE_PROFILE,
  );
};
const ajustar = (sim: Simulator, changes: Partial<VcSettings>, ms = 60_000): void => {
  expect(sim.command({ type: 'confirmSettings', changes }).accepted).toBe(true);
  sim.run(ms);
};
const circ = (sim: Simulator) => sim.frame().truth.circ!;
const oxy = (sim: Simulator) => sim.frame().truth.oxy!;

describe('CP-01 · la presión que llega a la pleura depende de la rigidez del pulmón', () => {
  it('Cpulmón / (Cpulmón + Cpared): 0,25 con 50 mL/cmH₂O, 0,15 con 30, y nunca más que con un pulmón normal', () => {
    expect(pleuralTransmission(0.05, 0.2)).toBeCloseTo(0.25, 5);
    expect(pleuralTransmission(0.03, 0.2)).toBeCloseTo(0.15, 2);
    // Pulmón y pared de igual compliance (Crs = la mitad de cada una): llega la mitad.
    expect(pleuralTransmission(0.1, 0.2)).toBeCloseTo(0.5, 5);
    expect(pleuralTransmission(0.3, 0.2)).toBe(0.9);
    // Monótona hasta el tope: un sistema casi tan distensible como la pared no pasa de 0,9.
    expect(pleuralTransmission(0.199, 0.2)).toBe(0.9);
    expect(pleuralTransmission(0.15, 0.2)).toBeLessThanOrEqual(pleuralTransmission(0.19, 0.2));
  });
});

describe('CP-02 · retorno venoso de Guyton', () => {
  const c = DEFAULT_CIRCULATION;
  it('GC = (Pmsf − Pad)/Rrv y PAM = Pad + GC·Rvs, con la abdominal compensando la mitad de la subida pleural', () => {
    const e = circulationEquilibrium(c, 0.05, 10);
    const ppl = 0.25 * 10 * 0.7356;
    expect(e.pplMmHg).toBeCloseTo(ppl, 6);
    expect(e.praMmHg).toBeCloseTo(c.praBaseMmHg + ppl, 6);
    expect(e.pmsfMmHg).toBeCloseTo(c.pmsfMmHg + 0.5 * ppl, 6);
    expect(e.cardiacOutputLMin).toBeCloseTo((e.pmsfMmHg - e.praMmHg) / c.rvrMmHgMinL, 6);
    expect(e.mapMmHg).toBeCloseTo(e.praMmHg + e.cardiacOutputLMin * c.svrMmHgMinL, 6);
  });
  it('un gradiente nulo no da un gasto negativo', () => {
    const e = circulationEquilibrium({ ...c, pmsfMmHg: 4 }, 0.1, 40);
    expect(e.cardiacOutputLMin).toBeGreaterThan(0);
  });
});

describe('CP-03 · banco SC-01 en reposo', () => {
  it('GC ≈ 5 L/min, Pad ≈ 4 mmHg, PAM ≈ 89 mmHg y DO₂ ≈ 1000 mL/min, con el gradiente de retorno cerca de 4–8 mmHg', () => {
    const sim = simular(findScenario('SC-01')!);
    sim.run(30_000);
    const h = circ(sim);
    expect(h.cardiacOutputLMin).toBeCloseTo(5, 1);
    expect(h.praMmHg).toBeCloseTo(4, 0);
    expect(h.mapMmHg).toBeCloseTo(89, -1);
    expect(h.do2MlMin).toBeGreaterThan(900);
    expect(h.do2MlMin).toBeLessThan(1100);
    expect(h.pmsfMmHg - h.praMmHg).toBeGreaterThan(7);
    expect(h.pmsfMmHg - h.praMmHg).toBeLessThan(8.5);
  });
});

describe('CP-04 · la PEEP cuesta gasto, más al hipovolémico y menos con el pulmón rígido', () => {
  const caida = (patient: Partial<Scenario['patient']>, sc = findScenario('SC-01')!) => {
    const sim = simular(sc, patient);
    sim.run(30_000);
    const antes = circ(sim);
    ajustar(sim, { peep: 15 });
    const despues = circ(sim);
    return { antes, despues, frac: 1 - despues.cardiacOutputLMin / antes.cardiacOutputLMin };
  };
  it('SC-01 de PEEP 5 a 15: el gasto baja entre un 5 y un 20 %, y la PAM también', () => {
    const r = caida({});
    expect(r.frac).toBeGreaterThan(0.05);
    expect(r.frac).toBeLessThan(0.2);
    expect(r.despues.mapMmHg).toBeLessThan(r.antes.mapMmHg - 3);
  });
  it('hipovolémico (Pmsf 9): de un gasto más bajo y cae más en proporción', () => {
    const normo = caida({}),
      hipo = caida({ circulation: { pmsfMmHg: 9 } });
    expect(hipo.antes.cardiacOutputLMin).toBeLessThan(normo.antes.cardiacOutputLMin - 0.8);
    expect(hipo.frac).toBeGreaterThan(normo.frac + 0.02);
  });
  it('el mismo cambio de PEEP con un pulmón de 28 mL/cmH₂O cuesta menos gasto que con uno de 50', () => {
    const blando = caida({}),
      rigido = caida({ crs: 0.028 });
    expect(rigido.frac).toBeLessThan(blando.frac * 0.7);
  });
});

describe('CP-05 · el gasto cierra el círculo con la oxigenación', () => {
  it('menos gasto baja la PvO₂ y con ella la PaO₂, mucho más con shunt que en un pulmón sano', () => {
    const caida = (p: ReturnType<typeof gasParams>, fio2: number) =>
      oxygenEquilibrium(p, fio2, 40, 0, 5).pao2 - oxygenEquilibrium(p, fio2, 40, 0, 3.5).pao2;
    const conShunt = caida(gasParams({ shuntBase: 0.3, lowVqFrac: 0 }), 0.5),
      sano = caida(gasParams(undefined), 0.21);
    expect(conShunt).toBeGreaterThan(5);
    expect(sano).toBeGreaterThan(0);
    expect(conShunt).toBeGreaterThan(sano);
  });
});

describe('CP-06 · CC-04: la DO₂ tiene un máximo frente a la PEEP', () => {
  const cc04 = findScenario('CC-04')!;
  it('de PEEP 5 a 15 sin maniobra: cae el gasto y sube la PaO₂ (abre una parte)', () => {
    const sim = simular(cc04);
    sim.run(30_000);
    const antes = { gc: circ(sim).cardiacOutputLMin, pao2: oxy(sim).pao2 };
    ajustar(sim, { peep: 15 });
    expect(circ(sim).cardiacOutputLMin).toBeLessThan(antes.gc - 0.1);
    expect(oxy(sim).pao2).toBeGreaterThan(antes.pao2);
  });
  it('abierto, la DO₂ es mayor a PEEP 11 que a 16 y a 20; y cerrado a PEEP 5, menor que abierto a 11', () => {
    const sim = simular(cc04);
    sim.run(30_000);
    const cerrado = circ(sim).do2MlMin;
    ajustar(sim, { peep: 20 }, 30_000);
    const do2: Record<number, number> = {};
    for (const peep of [20, 16, 11]) {
      ajustar(sim, { peep }, 90_000);
      expect(sim.frame().truth.recruited, `PEEP ${peep}`).toBeGreaterThan(0.95);
      do2[peep] = circ(sim).do2MlMin;
    }
    expect(do2[11]!).toBeGreaterThan(do2[16]!);
    expect(do2[16]!).toBeGreaterThan(do2[20]!);
    expect(do2[11]!).toBeGreaterThan(cerrado * 1.03);
  });
});

describe('CP-07 · validación y límites', () => {
  const conCirc = (circulation: Partial<CirculationParams>) => validatePatientParams({ ...defaultInit().patient, circulation });
  it('acepta lo plausible y rechaza lo imposible o desconocido', () => {
    expect(conCirc({ pmsfMmHg: 9 })).toEqual([]);
    expect(conCirc({ pmsfMmHg: 50 }).length).toBeGreaterThan(0);
    expect(conCirc({ chestWallComplianceL: 0 }).length).toBeGreaterThan(0);
    expect(conCirc({ gastoLMin: 5 } as Partial<CirculationParams>).length).toBeGreaterThan(0);
  });
  it('la circulación no realimenta la mecánica: otra volemia deja la misma presión y el mismo volumen', () => {
    const correr = (pmsfMmHg: number) => {
      const sim = new Simulator(defaultInit({ patient: { ...defaultInit().patient, circulation: { pmsfMmHg } } }), REFERENCE_PROFILE);
      sim.run(20_000);
      return [sim.frame().live.paw, sim.frame().truth.vAbsL];
    };
    expect(correr(7)).toEqual(correr(15));
  });
  it('los parámetros que faltan son los del adulto por omisión', () => {
    expect(circulationParams({ pmsfMmHg: 9 })).toEqual({ ...DEFAULT_CIRCULATION, pmsfMmHg: 9 });
  });
});

describe('CP-09 · dinámica, espera y cableado', () => {
  it('una presión media negativa no sube el gasto por encima del de presión cero', () => {
    expect(circulationEquilibrium(DEFAULT_CIRCULATION, 0.05, -10).cardiacOutputLMin).toBe(
      circulationEquilibrium(DEFAULT_CIRCULATION, 0.05, 0).cardiacOutputLMin,
    );
  });
  it('el gasto sigue al cambio de PEEP en segundos, no al instante (τ 10 s)', () => {
    const sim = simular(findScenario('SC-01')!);
    sim.run(30_000);
    const antes = circ(sim).cardiacOutputLMin;
    ajustar(sim, { peep: 15 }, 6_000);
    const pronto = circ(sim).cardiacOutputLMin;
    sim.run(60_000);
    const final = circ(sim).cardiacOutputLMin;
    expect(pronto).toBeLessThan(antes);
    expect(pronto).toBeGreaterThan(final + 0.05);
  });
  it('en espera, sin presión positiva, el gasto vuelve al de presión cero', () => {
    const sim = simular(findScenario('SC-01')!);
    sim.run(30_000);
    ajustar(sim, { peep: 20 });
    sim.command({ type: 'enterStandby' });
    sim.run(120_000);
    expect(circ(sim).cardiacOutputLMin).toBeGreaterThan(5.3);
  });
  it('en el motor, menos volemia baja la PaO₂ de un pulmón con shunt (el gasto entra en el Fick)', () => {
    const cc04 = findScenario('CC-04')!;
    const normal = simular(cc04),
      hipo = simular(cc04, { circulation: { pmsfMmHg: 8 } });
    normal.run(30_000);
    hipo.run(30_000);
    expect(oxy(hipo).pao2).toBeLessThan(oxy(normal).pao2 - 3);
  });
});
