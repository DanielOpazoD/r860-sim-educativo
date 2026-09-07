import { describe, expect, it } from 'vitest';
import { PatientModel } from '../../src/engine/patient';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// EFL-01 · resistor de Starling. Con la vía aérea por debajo del punto crítico, el flujo espiratorio queda fijado por
// el retroceso elástico y la resistencia aguas arriba:  Qmax = (Pel − pcrit)/(f·Rexp), independiente de la presión
// aguas abajo y del esfuerzo. El vaciamiento pasa de exponencial hacia PEEP a exponencial hacia C·pcrit con tau = f·Rexp·C.
const EFL = { pcrit: 8, rusFraction: 0.4 };
const patient = { ...BENCH_PATIENT, rExp: 20, efl: EFL };

describe('EFL-01 · limitación al flujo frente a su solución analítica', () => {
  it('sin limitación el flujo espiratorio es (Pel − Paw)/Rexp; con ella queda en (Pel − pcrit)/(f·Rexp)', () => {
    const libre = new PatientModel({ ...BENCH_PATIENT, rExp: 20 }, 0.6);
    const limitado = new PatientModel(patient, 0.6);
    const pel = 0.6 / 0.05; // 12 cmH2O
    expect(libre.flowForPaw(0, 0)).toBeCloseTo((0 - pel) / 20, 12);
    expect(limitado.flowForPaw(0, 0)).toBeCloseTo(-(pel - 8) / (0.4 * 20), 12);
    expect(limitado.maxExpiratoryFlow(0)).toBeCloseTo(0.5, 12);
  });

  it('es independiente del esfuerzo espiratorio y de la presión aguas abajo: eso es la meseta de flujo', () => {
    const p = new PatientModel(patient, 0.6);
    const base = p.flowForPaw(0, 0);
    expect(p.flowForPaw(-10, 0)).toBeCloseTo(base, 12); // aspirar más fuerte no saca más gas
    expect(p.flowForPaw(0, -15)).toBeCloseTo(base, 12); // los músculos espiratorios tampoco
    // Con menos gradiente el flujo libre no alcanza el techo y la limitación no actúa: la meseta sólo aparece arriba.
    expect(p.flowForPaw(4, 0)).toBeCloseTo((4 - 12) / 20, 12);
  });

  it('con Paw ≥ pcrit no hay colapso y el flujo vuelve a ser el de la ecuación de movimiento', () => {
    const p = new PatientModel(patient, 0.6);
    expect(p.maxExpiratoryFlow(8)).toBe(Number.POSITIVE_INFINITY);
    expect(p.flowForPaw(8, 0)).toBeCloseTo((8 - 12) / 20, 12);
  });

  it('durante la limitación el volumen decae hacia C·pcrit con tau = f·Rexp·C, no hacia el volumen de PEEP', () => {
    // La limitación actúa mientras el flujo libre supere el techo, es decir por debajo de Pel = 13,33 con estos valores.
    const p = new PatientModel(patient, 0.6);
    const tau = 0.4 * 20 * 0.05; // 0.4 s
    const vInf = 0.05 * 8; // 0.4 L
    const v0 = p.v;
    const t = 0.6;
    for (let i = 0; i < 600; i++) p.integratePressureSource(0, () => 0, 0, t / 600);
    expect(p.v).toBeCloseTo(vInf + (v0 - vInf) * Math.exp(-t / tau), 4);
  });

  it('el resultado no depende del paso de integración', () => {
    const a = new PatientModel(patient, 0.9);
    const b = new PatientModel(patient, 0.9);
    for (let i = 0; i < 150; i++) a.integratePressureSource(0, () => 0, 0, 0.004);
    for (let i = 0; i < 600; i++) b.integratePressureSource(0, () => 0, 0, 0.001);
    expect(a.v).toBeCloseTo(b.v, 5);
  });
});

describe('EFL-02 · consecuencias en el ventilador', () => {
  const settings = { ...BENCH_SETTINGS, rr: 15, ie: 1 / 3, plimit: 100, pmax: 60 };
  function corre(peep: number): { peepi: number; qPico: number; vte: number; vFinal: number; qFinal: number } {
    const sim = benchSim({ patient, settings: { ...settings, peep } });
    let qPico = 0;
    while (sim.breaths.length < 12) {
      sim.step();
      if (sim.frame().live.phase === 'exp') qPico = Math.min(qPico, sim.frame().live.flowLps);
    }
    return {
      peepi: sim.frame().truth.peepiEndExp,
      qPico: -qPico,
      vte: sim.breaths.at(-1)?.vtExp as number,
      vFinal: sim.frame().truth.vAbsL,
      qFinal: -sim.frame().live.flowLps,
    };
  }
  it('con PEEP por debajo del punto crítico el pulmón atrapa hasta que el retroceso iguala pcrit', () => {
    const bajo = corre(3);
    expect(bajo.peepi).toBeGreaterThan(4); // atrapa hasta Pel ≈ 8: PEEPi ≈ 5 sobre una PEEP de 3
    expect(bajo.peepi).toBeLessThan(5.2);
  });
  it('subir la PEEP hasta el punto crítico quita la limitación sin aumentar apenas la PEEP total', () => {
    const bajo = corre(3);
    const alto = corre(8);
    // Con limitación el pulmón atrapa hasta que el retroceso iguala pcrit: la PEEP total la fija el colapso, no la PEEP.
    expect(bajo.peepi + 3).toBeCloseTo(8, 1);
    // Al abrir la vía aérea con PEEP 8 desaparece el estrangulamiento y sólo queda el residuo normal del tiempo finito.
    expect(Math.abs(alto.peepi + 8 - (bajo.peepi + 3))).toBeLessThan(0.7);
    expect(alto.peepi).toBeLessThan(0.8);
    // Firma del estrangulamiento: al final de la espiración el flujo es nulo pese a haber 5 cmH2O de gradiente entre
    // el alvéolo y la vía aérea. Sin limitación, flujo nulo significa gradiente nulo.
    expect(bajo.qFinal).toBeLessThan(0.02);
    expect(bajo.peepi).toBeGreaterThan(4);
    expect(alto.qFinal).toBeLessThan(0.04); // sin limitación el flujo residual es el del tiempo espiratorio finito
    expect(alto.peepi).toBeLessThan(0.8);
    expect(bajo.vte).toBeCloseTo(alto.vte, 2); // el volumen corriente es el mismo: cambia la forma, no la entrega
  });
  it('sin limitación el mismo pulmón no atrapa nada a PEEP 3', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, rExp: 20 }, settings: { ...settings, peep: 3 } });
    runUntilBreath(sim, 12);
    // Sólo el residuo del tiempo espiratorio finito (3 constantes): medio cmH2O, diez veces menos que con limitación.
    expect(sim.frame().truth.peepiEndExp).toBeLessThan(0.8);
  });
  it('una limitación fuera de rango se rechaza', () => {
    expect(() => benchSim({ patient: { ...BENCH_PATIENT, efl: { pcrit: 50, rusFraction: 0.4 } } })).toThrow(/crítica/);
    expect(() => benchSim({ patient: { ...BENCH_PATIENT, efl: { pcrit: 8, rusFraction: 2 } } })).toThrow(/aguas arriba/);
  });
});

// EFL-03 · calibre dependiente del volumen: Rexp(V) = Rexp·(1 + gain·máx(0, 1 − V/vRef)).
// Es lo que curva la rama espiratoria del bucle flujo-volumen: sin él, el flujo es exactamente proporcional al
// volumen (recta); con él, cae más deprisa a volúmenes bajos y la rama queda excavada.
describe('EFL-03 · resistencia espiratoria dependiente del volumen', () => {
  const dep = { gain: 3, vRefL: 0.9 };
  it('la resistencia crece al vaciarse y coincide con la nominal en el volumen de referencia', () => {
    const p = new PatientModel({ ...BENCH_PATIENT, rExp: 20, rExpVolumeDep: dep }, 0.9);
    expect(p.expiratoryResistance(0.9)).toBeCloseTo(20, 12);
    expect(p.expiratoryResistance(0.45)).toBeCloseTo(20 * (1 + 3 * 0.5), 12);
    expect(p.expiratoryResistance(0)).toBeCloseTo(20 * 4, 12);
    expect(p.expiratoryResistance(1.5)).toBeCloseTo(20, 12); // por encima de la referencia no se ensancha más
  });

  it('sin dependencia la relación flujo-volumen es una recta; con ella la rama queda por debajo de la cuerda', () => {
    const puntos = (over: Parameters<typeof benchSim>[0]): { v: number; q: number }[] => {
      const sim = benchSim({ ...over, settings: { ...BENCH_SETTINGS, rr: 15, peep: 3, plimit: 100 } });
      runUntilBreath(sim, 6);
      const out: { v: number; q: number }[] = [];
      while (out.length === 0 || sim.frame().live.phase === 'exp') {
        sim.step();
        if (sim.frame().live.phase === 'exp') out.push({ v: sim.frame().truth.vAbsL, q: -sim.frame().live.flowLps });
      }
      return out.slice(2); // la primera muestra tras el cambio de fase todavía lleva el flujo inspiratorio (un retardo del anillo)
    };
    const desviacion = (pts: { v: number; q: number }[]): number => {
      const a = pts[0] as { v: number; q: number },
        b = pts[pts.length - 1] as { v: number; q: number };
      const cuerda = (v: number): number => a.q + ((b.q - a.q) * (v - a.v)) / (b.v - a.v);
      return pts.reduce((acc, p) => acc + (p.q - cuerda(p.v)), 0) / pts.length;
    };
    const recta = desviacion(puntos({ patient: { ...BENCH_PATIENT, rExp: 20 } }));
    const excavada = desviacion(puntos({ patient: { ...BENCH_PATIENT, rExp: 20, rExpVolumeDep: dep } }));
    expect(Math.abs(recta)).toBeLessThan(0.01); // el modelo lineal da una recta exacta
    expect(excavada).toBeLessThan(-0.05); // la rama se hunde por debajo de la cuerda: bucle excavado
  });

  it('una dependencia fuera de rango se rechaza', () => {
    expect(() => benchSim({ patient: { ...BENCH_PATIENT, rExpVolumeDep: { gain: 20, vRefL: 0.9 } } })).toThrow(/Ganancia/);
    expect(() => benchSim({ patient: { ...BENCH_PATIENT, rExpVolumeDep: { gain: 3, vRefL: 9 } } })).toThrow(/referencia/);
  });
});
