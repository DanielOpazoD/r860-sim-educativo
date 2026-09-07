import { describe, expect, it } from 'vitest';
import { TRIGGER_REFRACTORY_S } from '../../src/engine/controller';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim } from '../helpers';

// ASI-01 · asincronías EMERGENTES. No hay ninguna regla que las produzca: salen de la mecánica, del perfil de esfuerzo
// y del disparo. Estas pruebas fijan ese comportamiento para que no se pierda en futuros cambios del motor.
const settings = { ...BENCH_SETTINGS, assistControl: true, flowTrigger: 2 / 60, biasFlow: 4 / 60, plimit: 100, rr: 15, ie: 1 / 3 };
// Ti neural (2 s) mayor que el mecánico (1 s): el esfuerzo sigue vivo cuando el ventilador ya ciclo.
const effort = { enabled: true, amplitude: 12, ratePerMin: 12, tiS: 2, phaseS: 0 };
const intervalos = (sim: ReturnType<typeof benchSim>): number[] => {
  const t = sim.breaths.map((b) => b.startSimTimeMs);
  return t.slice(1).map((x, i) => x - (t[i] as number));
};
/** Corre hasta completar n respiraciones devolviendo la PEEP intrínseca máxima vista: alterna entre ciclos y un valor suelto engaña. */
function corre(sim: ReturnType<typeof benchSim>, n: number): number {
  let maxPeepi = 0;
  while (sim.breaths.length < n) {
    sim.step();
    maxPeepi = Math.max(maxPeepi, sim.frame().truth.peepiEndExp);
  }
  return maxPeepi;
}

describe('ASI-01 · doble disparo con Ti neural mayor que el mecánico', () => {
  it('el esfuerzo que sobrevive al ciclado dispara una segunda respiración en cuanto pasa el periodo refractario', () => {
    const sim = benchSim({ effort, settings });
    while (sim.breaths.length < 14) sim.step();
    const cortos = intervalos(sim).filter((g) => g < 2000);
    expect(cortos.length).toBeGreaterThanOrEqual(4);
    // El segundo disparo llega lo antes que el motor lo permite: tiempo inspiratorio mecánico + refractario.
    const esperado = 1000 + TRIGGER_REFRACTORY_S * 1000;
    for (const g of cortos) expect(Math.abs(g - esperado)).toBeLessThan(60);
    expect(sim.breaths.filter((b) => b.type === 'assisted').length).toBeGreaterThan(8);
  });

  it('la respiración apilada entra sobre un pulmón sin vaciar: más volumen y más presión', () => {
    const sim = benchSim({ effort, settings });
    while (sim.breaths.length < 14) sim.step();
    const gaps = intervalos(sim);
    const apiladas: number[] = [];
    const normales: number[] = [];
    sim.breaths.forEach((b, i) => {
      if (i === 0) return;
      ((gaps[i - 1] as number) < 2000 ? apiladas : normales).push(b.ppeak);
    });
    const media = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
    expect(apiladas.length).toBeGreaterThan(2);
    expect(media(apiladas)).toBeGreaterThan(media(normales) + 3); // apilamiento: la presión sube varios cmH2O
  });

  it('el apilamiento genera atrapamiento por sí solo: sin obstrucción ninguna, la PEEP intrínseca sube', () => {
    const conApilamiento = benchSim({ effort, settings });
    const peepiApilando = corre(conApilamiento, 20);
    const sinDisparo = benchSim({ effort, settings: { ...settings, assistControl: false } });
    const peepiSinDisparo = corre(sinDisparo, 20);
    // Mismo pulmón y mismas resistencias: la única diferencia es que las respiraciones se apilan.
    // Sin disparo el esfuerzo ya mete algo de gas contra el flujo de base, pero el apilamiento añade mucho más.
    expect(peepiApilando).toBeGreaterThan(peepiSinDisparo + 3);
    expect(peepiApilando).toBeGreaterThan(6);
  });

  it('sin control asistido el mismo esfuerzo no dispara nada: el ciclado sigue siendo por tiempo', () => {
    const sim = benchSim({ effort, settings: { ...settings, assistControl: false } });
    while (sim.breaths.length < 12) sim.step();
    expect(sim.breaths.every((b) => b.type === 'mandatory')).toBe(true);
    for (const g of intervalos(sim)) expect(g).toBeCloseTo(4000, 0);
  });
});

describe('ASI-02 · esfuerzos inefectivos cuando aparece auto-PEEP', () => {
  it('el mismo esfuerzo deja de disparar al subir la resistencia espiratoria, porque antes debe vencer la PEEP intrínseca', () => {
    const sano = benchSim({ effort, settings });
    while (sano.breaths.length < 20) sano.step();
    const obstruido = benchSim({ patient: { ...BENCH_PATIENT, rExp: 60 }, effort, settings });
    expect(corre(obstruido, 20)).toBeGreaterThan(5);
    const asistSano = sano.breaths.filter((b) => b.type === 'assisted').length;
    const asistObs = obstruido.breaths.filter((b) => b.type === 'assisted').length;
    expect(asistObs).toBeLessThan(asistSano / 2);
    expect(asistObs).toBeGreaterThan(0); // algunos todavía lo consiguen: es intermitente, no un apagado
    // Y el doble disparo desaparece: los esfuerzos ya no llegan a tiempo ni con fuerza suficiente.
    const cortosSano = intervalos(sano).filter((g) => g < 2000).length;
    const cortosObs = intervalos(obstruido).filter((g) => g < 2000).length;
    expect(cortosSano).toBeGreaterThan(4);
    expect(cortosObs).toBeLessThan(cortosSano / 4); // el doble disparo prácticamente desaparece, sin ser un apagado
  });

  it('el esfuerzo inefectivo deja su huella en la curva de flujo: el vaciamiento deja de ser monótono', () => {
    const traza = (amplitude: number): number[] => {
      const sim = benchSim({
        patient: { ...BENCH_PATIENT, rExp: 30 },
        effort: { enabled: true, amplitude, ratePerMin: 25, tiS: 0.8, phaseS: 1.2 },
        settings: { ...settings, flowTrigger: 3 / 60, biasFlow: 8 / 60, rr: 25, ie: 1 },
      });
      while (sim.breaths.length < 12) sim.step();
      const q: number[] = [];
      let prev = false;
      while (q.length < 3 || sim.frame().live.phase === 'exp') {
        sim.step();
        const exp = sim.frame().live.phase === 'exp';
        if (exp && prev) q.push(-sim.frame().live.flowLps);
        prev = exp;
      }
      return q;
    };
    const subidas = (q: number[]): number => q.slice(1).filter((v, i) => v > (q[i] as number) + 1e-6).length;
    const sinEsfuerzo = traza(0);
    const conEsfuerzo = traza(8);
    expect(subidas(sinEsfuerzo)).toBe(0); // vaciamiento pasivo: siempre decreciente
    expect(subidas(conEsfuerzo)).toBeGreaterThan(20); // muesca clara del esfuerzo que no llegó a disparar
    const desv = Math.max(...conEsfuerzo.map((v, i) => Math.abs(v - (sinEsfuerzo[i] ?? v))));
    expect(desv * 60).toBeGreaterThan(5); // más de 5 L/min de diferencia: visible en la curva
  });

  it('la Pva no se deforma durante un esfuerzo inefectivo: la válvula sostiene la PEEP mientras la demanda no supere el flujo de base', () => {
    // Límite declarado del modelo: la deflexión de presión de un esfuerzo inefectivo depende del ancho de banda del
    // regulador de PEEP, que aquí es ideal. La huella del esfuerzo está en el flujo, no en la presión (U-43).
    const sim = benchSim({
      patient: { ...BENCH_PATIENT, rExp: 30 },
      effort: { enabled: true, amplitude: 8, ratePerMin: 25, tiS: 0.8, phaseS: 1.2 },
      settings: { ...settings, flowTrigger: 3 / 60, biasFlow: 8 / 60, rr: 25, ie: 1 },
    });
    let pawMin = Infinity;
    let prev = false;
    while (sim.breaths.length < 14) {
      sim.step();
      const exp = sim.frame().live.phase === 'exp';
      if (exp && prev) pawMin = Math.min(pawMin, sim.frame().live.paw);
      prev = exp;
    }
    expect(pawMin).toBeCloseTo(5, 6);
  });
});
