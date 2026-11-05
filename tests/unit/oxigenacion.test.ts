import { describe, expect, it } from 'vitest';
import { DEFAULT_GAS, gasParams } from '../../src/engine/gasExchange';
import { Oxygenation, PAO2_TAU_S, oxygenEquilibrium, po2FromSaturation, saturation } from '../../src/engine/oxygenation';
import { Simulator } from '../../src/engine/simulator';
import { REFERENCE_PROFILE, defaultInit } from '../../src/profiles';
import { SCENARIOS, findScenario } from '../../src/scenarios';
import type { GasExchangeParams } from '../../src/domain/types';
import { validatePatientParams } from '../../src/domain/validation';

const sano = gasParams(undefined);
/** Un paciente con shunt y V/Q bajo dados, todo lo demás como el adulto sano. */
const con = (shuntBase: number, lowVqFrac = 0, lowVqRatio = 0.1) => gasParams({ shuntBase, lowVqFrac, lowVqRatio });

describe('OXI-01 · curva de disociación (Severinghaus 1979)', () => {
  it('la ecuación da los puntos de la curva estándar y su inversa vuelve al mismo PO₂', () => {
    expect(saturation(26.6)).toBeCloseTo(0.5, 1); // P50 estándar
    expect(saturation(40)).toBeCloseTo(0.75, 1); // venosa mixta
    expect(saturation(100)).toBeGreaterThan(0.97);
    for (const p of [20, 40, 60, 90, 150, 400]) expect(po2FromSaturation(saturation(p))).toBeCloseTo(p, 0);
  });
});

describe('OXI-02 · adulto sano en aire ambiente', () => {
  const e = oxygenEquilibrium(sano, 0.21, 39, 0);
  it('PaO₂ 85–100 mmHg, SaO₂ ≥ 96 %, PaO₂/FiO₂ > 400 y gradiente A-a normal', () => {
    expect(e.pao2).toBeGreaterThan(85);
    expect(e.pao2).toBeLessThan(100);
    expect(e.sao2).toBeGreaterThanOrEqual(0.96);
    expect(e.pao2 / 0.21).toBeGreaterThan(400);
    expect(e.pAO2 - e.pao2).toBeGreaterThan(3);
    expect(e.pAO2 - e.pao2).toBeLessThan(20);
  });
  it('la sangre venosa cierra el balance de Fick: CaO₂ − CvO₂ = VO₂/GC', () => {
    expect(e.cao2MlL - e.cvo2MlL).toBeCloseTo(DEFAULT_GAS.vo2MlMin / DEFAULT_GAS.cardiacOutputLMin, 5);
  });
});

describe('OXI-03 · ecuación del gas alveolar: la hipoventilación también baja la PaO₂', () => {
  it('PaCO₂ + 20 mmHg → PAO₂ − 25 mmHg con R 0,8, y la PaO₂ cae', () => {
    const a = oxygenEquilibrium(sano, 0.21, 40, 0),
      b = oxygenEquilibrium(sano, 0.21, 60, 0);
    expect(DEFAULT_GAS.vco2MlMin / DEFAULT_GAS.vo2MlMin).toBeCloseTo(0.8, 5);
    expect(a.pAO2 - b.pAO2).toBeCloseTo(25, 5);
    expect(a.pAO2).toBeCloseTo(0.21 * 713 - 40 / 0.8, 5);
    expect(b.pao2).toBeLessThan(a.pao2 - 15);
  });
});

describe('OXI-04 · el shunt no responde a la FiO₂; el V/Q bajo, sí', () => {
  const pao2 = (p: ReturnType<typeof gasParams>, fio2: number) => oxygenEquilibrium(p, fio2, 40, 0).pao2;
  it('shunt 30 %: de FiO₂ 0,5 a 1,0 la PaO₂ sube menos de 50 mmHg y no llega a una PaO₂/FiO₂ normal', () => {
    const d = pao2(con(0.3), 1) - pao2(con(0.3), 0.5);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(50);
    expect(pao2(con(0.3), 1)).toBeLessThan(150);
  });
  it('V/Q bajo con el mismo gasto y sin shunt: la misma subida de FiO₂ la lleva sobre 300', () => {
    const d = pao2(con(0, 0.3), 1) - pao2(con(0, 0.3), 0.5);
    expect(d).toBeGreaterThan(300);
    expect(pao2(con(0, 0.3), 1)).toBeGreaterThan(400);
  });
});

describe('OXI-04b · cifras frente a un cálculo independiente', () => {
  // Resueltas aparte, con otro código y a mano (shunt 30 %: CaO₂ 199,45 mL/L a FiO₂ 1,0): fijan la constante 0,863 y Fick.
  it.each([
    ['shunt 30 %, FiO₂ 0,5', con(0.3), 0.5, 66.5],
    ['shunt 30 %, FiO₂ 1,0', con(0.3), 1, 99.8],
    ['V/Q bajo 30 %, FiO₂ 0,5', con(0, 0.3), 0.5, 134.4],
    ['V/Q bajo 30 %, FiO₂ 1,0', con(0, 0.3), 1, 565.6],
  ] as const)('%s', (_n, p, fio2, pao2) => {
    expect(oxygenEquilibrium(p, fio2, 40, 0).pao2).toBeCloseTo(pao2, 0);
  });
});

describe('OXI-04c · cinética', () => {
  const correr = (o: Oxygenation, s: number, fio2: number, fijar = false) => {
    for (let i = 0; i < s / 0.004; i++) o.step(0.004, sano, fio2, 40, 0, fijar, () => 40);
  };
  it('sigue a su equilibrio con τ = 30 s: a un τ ha recorrido el 63 % del camino', () => {
    const o = new Oxygenation();
    correr(o, 1, 0.21);
    const a = o.pao2!,
      meta = oxygenEquilibrium(sano, 0.5, 40, 0).pao2;
    correr(o, PAO2_TAU_S, 0.5);
    expect(PAO2_TAU_S).toBe(30);
    expect((o.pao2! - a) / (meta - a)).toBeCloseTo(1 - Math.exp(-1), 1);
  });
  it('mientras la gasometría fija el estado inicial no hay retraso', () => {
    const o = new Oxygenation();
    correr(o, 1, 0.21, true);
    correr(o, 1, 0.5, true);
    expect(o.pao2!).toBeCloseTo(oxygenEquilibrium(sano, 0.5, 40, 0).pao2, 5);
  });
  it('el equilibrio que se informa usa la PaCO₂ de equilibrio, no la de ahora', () => {
    const o = new Oxygenation();
    expect(o.state()).toBeNull();
    o.step(0.004, sano, 0.21, 70, 0, false, () => 40);
    const e = o.state()!;
    expect(e.pao2Target!).toBeCloseTo(oxygenEquilibrium(sano, 0.21, 40, 0).pao2, 5);
    expect(e.pAO2).toBeCloseTo(oxygenEquilibrium(sano, 0.21, 70, 0).pAO2, 5);
    const apnea = new Oxygenation();
    apnea.step(0.004, sano, 0.21, 70, 0, false, () => null);
    expect(apnea.state()!.pafiTarget).toBeNull();
  });
});

describe('OXI-05 · el shunt reclutable depende de la fracción reclutada', () => {
  const p = gasParams({ shuntBase: 0.15, shuntRecruitable: 0.15, lowVqFrac: 0.05, lowVqRatio: 0.1 });
  it('shunt = base + reclutable × (1 − reclutado)', () => {
    expect(oxygenEquilibrium(p, 0.5, 45, 0).shunt).toBeCloseTo(0.3, 5);
    expect(oxygenEquilibrium(p, 0.5, 45, 1).shunt).toBeCloseTo(0.15, 5);
    expect(oxygenEquilibrium(p, 0.5, 45, 0.5).shunt).toBeCloseTo(0.225, 5);
  });
  it('sin parte reclutable, abrir no cambia nada', () => {
    const q = con(0.25, 0.05);
    expect(oxygenEquilibrium(q, 0.5, 45, 1).pao2).toBeCloseTo(oxygenEquilibrium(q, 0.5, 45, 0).pao2, 5);
  });
});

describe('OXI-06 · límites del modelo', () => {
  it('la PAO₂ no baja del suelo aunque la PaCO₂ sea absurda, y todo sigue siendo finito', () => {
    const e = oxygenEquilibrium(sano, 0.21, 300, 0);
    expect(e.pAO2).toBeGreaterThan(0);
    for (const v of [e.pao2, e.sao2, e.cvo2MlL]) expect(Number.isFinite(v)).toBe(true);
    expect(e.cvo2MlL).toBeGreaterThanOrEqual(0);
  });
  it('la validación rechaza un shunt imposible y una clave desconocida', () => {
    const conGas = (gas: Partial<GasExchangeParams>) => validatePatientParams({ ...defaultInit().patient, gas });
    expect(conGas({ shuntBase: 0.2 })).toEqual([]);
    expect(conGas({ shuntBase: 1.2 }).length).toBeGreaterThan(0);
    expect(conGas({ hbGdL: 1 }).length).toBeGreaterThan(0);
    // Físicamente imposibles aunque cada valor esté en rango: más consumo del que se puede entregar, y un R absurdo.
    expect(conGas({ cardiacOutputLMin: 1, vo2MlMin: 300 }).length).toBeGreaterThan(0);
    expect(conGas({ vco2MlMin: 50, vo2MlMin: 800 }).length).toBeGreaterThan(0);
    expect(conGas({ shuntBase: 0.6, shuntRecruitable: 0.3, lowVqFrac: 0.2 }).length).toBeGreaterThan(0);
  });
});

describe('OXI-07 · en el motor', () => {
  const simular = (id: string): Simulator => {
    const sc = findScenario(id)!;
    const base = defaultInit();
    return new Simulator(
      defaultInit({ patient: sc.patient, effort: sc.effort, sensors: sc.sensors, settings: { ...base.settings, ...sc.settings } }),
      REFERENCE_PROFILE,
    );
  };
  const oxy = (sim: Simulator) => sim.frame().truth.oxy!;

  it('SC-01 arranca ya en su equilibrio y se mantiene en él', () => {
    const sim = simular('SC-01');
    sim.run(30_000);
    const o = oxy(sim);
    expect(o.pao2).toBeGreaterThan(85);
    expect(o.pao2).toBeLessThan(100);
    expect(o.sao2).toBeGreaterThanOrEqual(0.96);
    expect(o.pafi).toBeGreaterThan(400);
    expect(Math.abs(o.pao2 - o.pao2Target!)).toBeLessThan(2);
  });
  it('subir la FiO₂ sube la PaO₂ en segundos, no al instante: sigue al mezclador y a la muestra arterial', () => {
    const sim = simular('SC-01');
    sim.run(30_000);
    const antes = oxy(sim).pao2;
    sim.command({ type: 'confirmSettings', changes: { fio2: 1 } });
    sim.run(2_000);
    const pronto = oxy(sim).pao2;
    expect(pronto).toBeGreaterThan(antes);
    expect(pronto).toBeLessThan(antes + 150);
    sim.run(180_000);
    expect(oxy(sim).pao2).toBeGreaterThan(450);
  });
  it('en apnea la PaO₂ cae, porque sube la PaCO₂', () => {
    const sim = simular('SC-01');
    sim.run(30_000);
    const antes = oxy(sim).pao2;
    sim.command({ type: 'enterStandby' });
    sim.run(60_000);
    expect(oxy(sim).pao2).toBeLessThan(antes - 10);
  });
  it('es determinista: dos corridas dan la misma cifra', () => {
    const a = simular('CC-04'),
      b = simular('CC-04');
    a.run(25_000);
    b.run(25_000);
    expect(oxy(a).pao2).toBe(oxy(b).pao2);
  });
  it('la oxigenación no realimenta la mecánica: otro shunt deja la misma presión y el mismo volumen', () => {
    const correr = (shuntBase: number) => {
      const sim = new Simulator(defaultInit({ patient: { ...defaultInit().patient, gas: { shuntBase } } }), REFERENCE_PROFILE);
      sim.run(20_000);
      return [sim.frame().live.paw, sim.frame().truth.vAbsL];
    };
    expect(correr(0.4)).toEqual(correr(0.03));
  });
});

describe('OXI-08 · CC-03: un SDRA moderado y poco reclutable', () => {
  it('arranca con PaO₂/FiO₂ ≈ 140 (Berlín moderado), la de su viñeta, y subir la PEEP casi no la cambia', () => {
    const sc = findScenario('CC-03')!;
    const base = defaultInit();
    const sim = new Simulator(
      defaultInit({ patient: sc.patient, effort: sc.effort, sensors: sc.sensors, settings: { ...base.settings, ...sc.settings } }),
      REFERENCE_PROFILE,
    );
    sim.run(25_000);
    const o = sim.frame().truth.oxy!;
    expect(o.pafi).toBeGreaterThan(100);
    expect(o.pafi).toBeLessThanOrEqual(200);
    expect(Math.abs(o.pafi - 140)).toBeLessThan(10);
    sim.command({ type: 'confirmSettings', changes: { peep: 14 } });
    sim.run(60_000);
    expect(Math.abs(sim.frame().truth.oxy!.pafi - o.pafi)).toBeLessThan(10);
  });
});

describe('OXI-11 · ningún escenario arranca con un paciente que nadie dejaría así', () => {
  // La FiO₂ no tenía consecuencia y todos venían con 0,21: con la oxigenación, una PaCO₂ de 88 daba SaO₂ 48 %.
  for (const sc of SCENARIOS)
    it(`${sc.id}: SaO₂ ≥ 90 % a los 30 s, con su FiO₂`, () => {
      const base = defaultInit();
      const sim = new Simulator(
        defaultInit({ patient: sc.patient, effort: sc.effort, sensors: sc.sensors, settings: { ...base.settings, ...sc.settings } }),
        REFERENCE_PROFILE,
      );
      sim.run(30_000);
      expect(sim.frame().truth.oxy!.sao2).toBeGreaterThanOrEqual(0.9);
    });
});
