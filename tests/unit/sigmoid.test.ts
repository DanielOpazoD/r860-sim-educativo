import { describe, expect, it } from 'vitest';
import { PatientModel, sigmoidCompliance, sigmoidPressure, sigmoidVolume } from '../../src/engine/patient';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';
import { SCENARIOS } from '../../src/scenarios';

// SIG-01 · curva presión-volumen sigmoidea de Venegas: V(P) = a + b/(1 + e^(−(P−c)/d)), anclada en V(P0) = 0.
// Cmax = b/(4d) en P = c; los codos de máxima curvatura caen en c ± 1,317·d.
const S = { b: 1.6, c: 18, d: 5 };
const P0 = 0;

describe('SIG-01 · la sigmoide contra su forma analítica', () => {
  it('está anclada en V(P0) = 0 y es su propia inversa en todo el intervalo útil', () => {
    expect(sigmoidVolume(S, P0, P0)).toBeCloseTo(0, 12);
    expect(sigmoidPressure(S, P0, 0)).toBeCloseTo(P0, 10);
    for (const p of [2, 5, 10, 18, 25, 32]) {
      expect(sigmoidPressure(S, P0, sigmoidVolume(S, P0, p))).toBeCloseTo(p, 8);
    }
  });

  it('la compliance máxima vale b/(4d) en P = c y es simétrica alrededor de ese punto', () => {
    const vMid = sigmoidVolume(S, P0, S.c);
    expect(sigmoidCompliance(S, P0, vMid)).toBeCloseTo(S.b / (4 * S.d), 10);
    for (const dp of [3, 6, 10]) {
      const abajo = sigmoidCompliance(S, P0, sigmoidVolume(S, P0, S.c - dp));
      const arriba = sigmoidCompliance(S, P0, sigmoidVolume(S, P0, S.c + dp));
      expect(abajo).toBeCloseTo(arriba, 10);
      expect(abajo).toBeLessThan(S.b / (4 * S.d));
    }
  });

  it('el mismo incremento de volumen cuesta mucha más presión arriba que en la zona media: eso es el pico de sobredistensión', () => {
    const p = new PatientModel({ ...BENCH_PATIENT, sigmoid: S }, sigmoidVolume(S, P0, S.c));
    const medio = sigmoidPressure(S, P0, p.v + 0.1) - sigmoidPressure(S, P0, p.v);
    const alto = sigmoidPressure(S, P0, sigmoidVolume(S, P0, 30) + 0.1) - sigmoidPressure(S, P0, sigmoidVolume(S, P0, 30));
    expect(alto / medio).toBeGreaterThan(3);
  });

  it('por encima de la capacidad la presión sigue siendo finita y monótona (extensión tangente)', () => {
    let prev = -Infinity;
    for (const v of [1.5, 1.56, 1.6, 1.8, 2.5, 4]) {
      const pr = sigmoidPressure(S, P0, v);
      expect(Number.isFinite(pr)).toBe(true);
      expect(pr).toBeGreaterThan(prev);
      prev = pr;
    }
    expect(sigmoidPressure(S, P0, -0.5)).toBeLessThan(0);
  });

  it('sin sigmoide el modelo sigue siendo lineal', () => {
    const p = new PatientModel({ ...BENCH_PATIENT }, 0.25);
    expect(p.compliance()).toBe(BENCH_PATIENT.crs);
    expect(p.pelStatic()).toBeCloseTo(5, 12);
  });
});

describe('SIG-02 · titulación de PEEP sobre la sigmoide', () => {
  const patient = { ...BENCH_PATIENT, sigmoid: S };
  const settings = { ...BENCH_SETTINGS, vt: 0.3, plimit: 100, pmax: 60 };
  function cstatConPeep(peep: number): number {
    const sim = benchSim({ patient, settings: { ...settings, peep } });
    runUntilBreath(sim, 3);
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    runUntilBreath(sim, 7);
    const h = sim.frame().procedure.last.inspHold;
    expect(h?.quality).toBe('valid');
    return (h?.values.cstat?.value as number) * 1000;
  }
  it('la compliance medida dibuja una U invertida: baja colapsada, máxima cerca de c y baja otra vez por sobredistensión', () => {
    const c5 = cstatConPeep(5);
    const c12 = cstatConPeep(12);
    const c18 = cstatConPeep(18);
    const c24 = cstatConPeep(24);
    expect(c5).toBeLessThan(c12);
    expect(c12).toBeLessThan(c18);
    expect(c24).toBeLessThan(c18);
    expect(c18).toBeGreaterThan(70); // cerca del máximo teórico b/(4d) = 80 mL/cmH2O
    expect(c5).toBeLessThan(45);
    expect(c24).toBeLessThan(45);
  });
  it('el volumen inicial de equilibrio usa la sigmoide, no la compliance lineal', () => {
    const sim = benchSim({ patient, settings: { ...settings, peep: 18 } });
    expect(sim.frame().truth.vAbsL).toBeCloseTo(sigmoidVolume(S, P0, 18), 6);
    expect(sim.frame().truth.cLocal).toBeCloseTo(S.b / (4 * S.d), 6);
  });
  it('una sigmoide fuera de rango se rechaza', () => {
    expect(() => benchSim({ patient: { ...BENCH_PATIENT, sigmoid: { b: 9, c: 18, d: 5 } } })).toThrow(/Capacidad/);
    expect(() => benchSim({ patient: { ...BENCH_PATIENT, sigmoid: { b: 1.6, c: 18, d: 40 } } })).toThrow(/Anchura/);
  });
});

// SIG-03 · la sigmoide de SC-15 es de pulmón con lesión aguda, no sólo una forma. Albaiceta 2007 (C16) ajustó el mismo
// modelo en 30 pacientes con lesión pulmonar aguda (rama inspiratoria): compliance máxima 67 ± 18 mL/cmH₂O y asíntota
// superior 1836 ± 680 mL; los puntos de máxima curvatura son c ∓ 1,317·d.
describe('SIG-03 · los parámetros de SC-15 caen dentro de lo publicado (E-125)', () => {
  const s = SCENARIOS.find((x) => x.id === 'SC-15')!.patient.sigmoid!;
  it('compliance máxima dentro de una desviación de 67 ± 18 mL/cmH₂O, y es la de la curva del motor', () => {
    const cmax = (s.b / (4 * s.d)) * 1000;
    expect(cmax).toBeGreaterThanOrEqual(67 - 18);
    expect(cmax).toBeLessThanOrEqual(67 + 18);
    const dP = 1e-4; // la pendiente de la curva del motor en c, por diferencia central
    const pendiente = (sigmoidVolume(s, 0, s.c + dP) - sigmoidVolume(s, 0, s.c - dP)) / (2 * dP);
    expect(pendiente * 1000).toBeCloseTo(cmax, 3);
  });
  it('capacidad dentro de una desviación de 1836 ± 680 mL', () => {
    expect(s.b * 1000).toBeGreaterThanOrEqual(1836 - 680);
    expect(s.b * 1000).toBeLessThanOrEqual(1836 + 680);
  });
  it('codos en c ∓ 1,317·d: 11,4 y 24,6 cmH₂O, los que cita el escenario', () => {
    expect(s.c - 1.317 * s.d).toBeCloseTo(11.4, 1);
    expect(s.c + 1.317 * s.d).toBeCloseTo(24.6, 1);
  });
});
