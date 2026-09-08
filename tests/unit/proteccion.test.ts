import { describe, expect, it } from 'vitest';
import { stressIndex } from '../../src/engine/controller';
import { estres, titulacion } from '../../src/ui/teaching';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// El índice de estrés es el exponente b de Paw(t) = a·t^b + c sobre la rampa a flujo constante. Con flujo constante el
// volumen crece con el tiempo, así que esa forma es la de la curva presión-volumen dentro del volumen corriente.

const SIGMOIDE = { b: 1.2, c: 18, d: 5 };
function indice(over: Parameters<typeof benchSim>[0]): { valor: number | null; motivo: string | null } {
  const sim = benchSim({ settings: { ...BENCH_SETTINGS, plimit: 100, pmax: 90 }, ...over });
  runUntilBreath(sim, 8);
  const b = sim.breaths.at(-1)!;
  return { valor: b.stressIndex ?? null, motivo: b.stressIndexReason ?? null };
}

describe('PROT-01 · el estimador recupera el exponente que se le da', () => {
  it('sobre curvas sintéticas acierta a tres decimales', () => {
    const curva = (b: number) => {
      const m: { t: number; paw: number }[] = [];
      for (let t = 0; t <= 1.0001; t += 0.004) m.push({ t, paw: 10 + 8 * Math.pow(t, b) });
      return m;
    };
    for (const b of [0.6, 0.8, 1.0, 1.3, 1.8]) expect(stressIndex(curva(b)), `b=${b}`).toBeCloseTo(b, 3);
  });

  it('con muestras insuficientes devuelve null en vez de un número inventado', () => {
    expect(stressIndex([])).toBeNull();
    expect(
      stressIndex([
        { t: 0, paw: 10 },
        { t: 0.5, paw: 12 },
      ]),
    ).toBeNull();
  });
});

describe('PROT-02 · sobre el motor distingue los tres regímenes', () => {
  it('un pulmón lineal da exactamente la recta', () => {
    // Distensibilidad constante: con flujo constante la presión sube en línea recta, así que b = 1.
    expect(indice({}).valor as number).toBeCloseTo(1, 2);
  });

  it('con sigmoide, subir la PEEP lleva el índice de reclutamiento a sobredistensión', () => {
    const bajo = indice({
      patient: { ...BENCH_PATIENT, sigmoid: SIGMOIDE },
      settings: { ...BENCH_SETTINGS, plimit: 100, pmax: 90, peep: 4 },
    });
    const alto = indice({
      patient: { ...BENCH_PATIENT, sigmoid: SIGMOIDE },
      settings: { ...BENCH_SETTINGS, plimit: 100, pmax: 90, peep: 20, vt: 0.25 },
    });
    // Por debajo del codo inferior la distensibilidad mejora al insuflar: cóncava hacia abajo.
    expect(bajo.valor as number, `bajo ${bajo.valor}`).toBeLessThan(0.9);
    // Cerca del codo superior empeora al insuflar: cóncava hacia arriba.
    expect(alto.valor as number, `alto ${alto.valor}`).toBeGreaterThan(1.02);
    expect(alto.valor as number).toBeGreaterThan(bajo.valor as number);
  });
});

describe('PROT-03 · no se publica cuando la forma no es del pulmón', () => {
  it('en presión control no hay rampa a flujo constante', () => {
    const r = indice({ settings: { ...BENCH_SETTINGS, mode: 'AC_PC', pinsp: 15, plimit: 100, pmax: 90 } });
    expect(r.valor).toBeNull();
    expect(r.motivo).toBe('sinRampaAFlujoConstante');
  });

  it('con esfuerzo del paciente la curva es suya y del ventilador, no del pulmón', () => {
    const r = indice({ effort: { enabled: true, amplitude: 6, ratePerMin: 15, tiS: 0.8, phaseS: 0 } });
    expect(r.valor).toBeNull();
    expect(r.motivo).toBe('esfuerzoDuranteLaRampa');
  });

  it('con la presión recortada por un techo la forma ya no es la del pulmón', () => {
    const r = indice({ settings: { ...BENCH_SETTINGS, plimit: 100, pmax: 15 } });
    expect(r.valor).toBeNull();
    expect(r.motivo).toBe('presionRecortadaPorElTecho');
  });

  it('y la métrica lo publica como no disponible con su motivo, nunca como válida', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, mode: 'AC_PC', pinsp: 15, plimit: 100, pmax: 90 } });
    runUntilBreath(sim, 8);
    const m = sim.frame().metrics.stressIndex;
    expect(m?.value).toBeNull();
    expect(m?.quality).not.toBe('valid');
    expect(m?.reason).toBe('sinRampaAFlujoConstante');
    expect(estres(sim.frame()).valor).toBeNull();
  });
});

describe('PROT-04 · la lectura y la curva de titulación', () => {
  it('cada banda del índice tiene su lectura', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, plimit: 100, pmax: 90 } });
    runUntilBreath(sim, 8);
    const e = estres(sim.frame());
    expect(e.regimen).toBe('recta');
    expect(e.lectura).toMatch(/recta/i);
  });

  it('la titulación ordena por PEEP y señala la mejor distensibilidad', () => {
    const t = titulacion([
      { peep: 14, cstat: 75 },
      { peep: 5, cstat: 39 },
      { peep: 22, cstat: 50 },
      { peep: 10, cstat: 60 },
    ]);
    expect(t.puntos.map((p) => p.peep)).toEqual([5, 10, 14, 22]);
    expect(t.mejor).toEqual({ peep: 14, cstat: 75 });
  });

  it('sin puntos no inventa ninguno', () => {
    expect(titulacion([])).toEqual({ puntos: [], mejor: null });
  });
});
