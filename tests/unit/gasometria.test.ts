import { describe, expect, it } from 'vitest';
import { validatePatientParams } from '../../src/domain/validation';
import {
  ALVEOLAR_K,
  DEFAULT_GAS,
  ACELERACION_EQUILIBRIO,
  ACELERACION_TEJIDOS,
  GasExchange,
  LUNG_CO2_STORE_L,
  VENOARTERIAL_PCO2_MMHG,
  bicarbonate,
  phFrom,
  slowTauMin,
  steadyPaco2,
  tissueStoreL,
} from '../../src/engine/gasExchange';
import { exportSession, importSession, replaySession } from '../../src/history/session';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// Gasometría de modelo (P). Oráculo: la ecuación de la ventilación alveolar, PaCO₂ = 0,863·VCO₂/V̇A, y
// Henderson-Hasselbalch, con V̇A = (VT − VDaw)·(1 − f)·FR. Banco SC-01: VT 0,5 L a 15/min, vía aérea 0,165 L y
// fracción alveolar 0,12 → V̇A = 0,335·0,88·15 = 4,42 L/min, PaCO₂ de equilibrio 39,0 mmHg, pH 7,41 y VDfis/VT 0,41:
// normocapnia, como se espera de esa ventilación.

/** Una respiración de volumen `vt` y `durS` segundos que termina en `t` (s): entra y sale del pulmón, y se cierra. */
function respirar(g: GasExchange, t: number, vt: number, p = DEFAULT_GAS, durS = 4): void {
  g.move(vt, p);
  g.move(-vt, p);
  g.onBreath(t, durS, p);
}
/** V̇A de una respiración regular con los parámetros por omisión (L/min). */
const vaRegular = (vt: number, fr: number): number => (vt - DEFAULT_GAS.deadspaceL) * (1 - DEFAULT_GAS.alveolarDeadspaceFrac) * fr;
const minutos = (sim: ReturnType<typeof benchSim>, min: number): void => sim.run(Math.round(min * 60_000));
/** Segundos sin ventilación, a paso de 4 ms como el motor. */
function apnea(g: GasExchange, segundos: number, p = DEFAULT_GAS): void {
  for (let i = 0; i < Math.round(segundos / 0.004); i++) g.step(0.004, p);
}
/** Ventilación regular a paso de 4 ms: inspiración, espiración y cierre de cada respiración de `durS` segundos. */
function ventilar(g: GasExchange, t0: number, segundos: number, vt = 0.5, durS = 4, p = DEFAULT_GAS): number {
  const pasos = Math.round(durS / 0.004);
  let t = t0;
  for (let n = 0; n < Math.round(segundos / durS); n++) {
    for (let i = 0; i < pasos; i++) {
      g.step(0.004, p);
      if (i === Math.round(pasos / 3)) g.move(vt, p);
      if (i === Math.round(pasos / 2)) g.move(-vt, p);
    }
    t += durS;
    g.onBreath(t, durS, p);
  }
  return t;
}
/** Un paciente ventilado 30 min con VT 0,5 a 15/min: en su equilibrio de dos compartimentos. Por omisión, el adulto real. */
function enEquilibrio(aceleracion = 1): { g: GasExchange; t: number } {
  const g = new GasExchange('equilibrium', aceleracion);
  return { g, t: ventilar(g, 0, 1800) };
}
/** Pendiente de la apnea pasado el tramo rápido (mmHg/min): la producción repartida en los dos depósitos. */
const pendienteApnea = (aceleracion: number): number =>
  (ALVEOLAR_K * DEFAULT_GAS.vco2MlMin) / (LUNG_CO2_STORE_L + tissueStoreL(DEFAULT_GAS.storeL, aceleracion));
const gas = (sim: ReturnType<typeof benchSim>) => sim.frame().truth.gas!;

describe('GAS-01 · ecuaciones', () => {
  it('equilibrio alveolar y pH de referencia', () => {
    expect(steadyPaco2(200, 5.25)).toBeCloseTo(32.88, 2);
    expect(steadyPaco2(200, 0)).toBeNull();
    expect(phFrom(24, 40)).toBeCloseTo(7.4, 2);
    // Duplicar la PaCO₂ con bicarbonato fijo baja el pH en log10(2).
    expect(phFrom(24, 40) - phFrom(24, 80)).toBeCloseTo(Math.log10(2), 9);
  });

  it('en apnea, pasado el tramo rápido, la PaCO₂ sube 0,863·VCO₂/C mmHg por minuto', () => {
    // C es la capacidad que cuenta: la total en el adulto real; con la aceleración docente, el pulmón más C_t / 20.
    expect(pendienteApnea(1)).toBeCloseTo((ALVEOLAR_K * DEFAULT_GAS.vco2MlMin) / DEFAULT_GAS.storeL, 9);
    for (const aceleracion of [1, ACELERACION_TEJIDOS]) {
      const g = new GasExchange(40, aceleracion);
      apnea(g, 180);
      const a = g.paco2;
      apnea(g, 120);
      expect((g.paco2 - a) / 2).toBeCloseTo(pendienteApnea(aceleracion), 3);
      expect(g.state(300, DEFAULT_GAS).vaLMin).toBeNull();
    }
  });

  it('una respiración menor que el espacio muerto no ventila el alvéolo', () => {
    const g = new GasExchange(40);
    respirar(g, 4, 0.12);
    expect(g.paco2).toBe(40);
    expect(g.state(4, DEFAULT_GAS).vaLMin).toBe(0);
  });

  it('el espacio muerto fisiológico reproduce las dos medianas de Fletcher y Jonson (0,44 con VT 0,45; 0,31 con 0,75)', () => {
    for (const [vt, vdvt] of [
      [0.45, 0.44],
      [0.75, 0.31],
    ] as const) {
      const g = new GasExchange(40);
      respirar(g, 4, vt);
      expect(g.state(4, DEFAULT_GAS).vdVt!).toBeCloseTo(vdvt, 2);
    }
  });

  it('el gas que mueve un esfuerzo que no dispara entra y sale de la vía aérea: no ventila', () => {
    const limpia = new GasExchange(40),
      conEsfuerzo = new GasExchange(40);
    for (let t = 4; t <= 40; t += 4) {
      respirar(limpia, t, 0.5);
      // La misma respiración, con un esfuerzo a mitad de la espiración que mete y saca 80 mL.
      conEsfuerzo.move(0.5, DEFAULT_GAS);
      conEsfuerzo.move(-0.3, DEFAULT_GAS);
      conEsfuerzo.move(0.08, DEFAULT_GAS);
      conEsfuerzo.move(-0.28, DEFAULT_GAS);
      conEsfuerzo.onBreath(t, 4, DEFAULT_GAS);
    }
    expect(conEsfuerzo.vaLMin(40)!).toBeCloseTo(limpia.vaLMin(40)!, 12);
    expect(conEsfuerzo.paco2).toBeCloseTo(limpia.paco2, 12);
    // Dos respiraciones apiladas sin espiración entre ellas pagan el espacio muerto una sola vez.
    const apiladas = new GasExchange(40);
    apiladas.move(0.4, DEFAULT_GAS);
    apiladas.move(0.4, DEFAULT_GAS);
    apiladas.move(-0.8, DEFAULT_GAS);
    apiladas.onBreath(8, 8, DEFAULT_GAS);
    expect(apiladas.vaLMin(8)!).toBeCloseTo(vaRegular(0.8, 7.5), 12);
  });
});

describe('GAS-07 · tamponamiento agudo: el bicarbonato sigue a la PaCO₂ en minutos', () => {
  it('+1 mEq/L por cada 10 mmHg de hipercapnia aguda y −2 por cada 10 de hipocapnia aguda (reglas de Boston)', () => {
    expect(bicarbonate(DEFAULT_GAS, 40)).toBe(24);
    expect(bicarbonate(DEFAULT_GAS, 60)).toBeCloseTo(26, 9);
    expect(bicarbonate(DEFAULT_GAS, 30)).toBeCloseTo(22, 9);
    // Con PaCO₂ 60 el pH queda ≈ 0,04 por encima del que daría el bicarbonato fijo.
    expect(phFrom(bicarbonate(DEFAULT_GAS, 60), 60) - phFrom(24, 60)).toBeCloseTo(Math.log10(26 / 24), 9);
  });

  it('en el EPOC hipercápnico crónico el bicarbonato habitual es el de su PaCO₂ habitual, no el de 40', () => {
    const epoc = { ...DEFAULT_GAS, hco3: 32, paco2Basal: 60 };
    expect(bicarbonate(epoc, 60)).toBe(32);
    // Hiperventilado hasta 37 en minutos: los tampones restan ≈ 4,6 mEq/L y el pH no llega a lo que daría el 32 fijo.
    expect(bicarbonate(epoc, 37)).toBeCloseTo(27.4, 9);
    expect(phFrom(bicarbonate(epoc, 37), 37)).toBeLessThan(phFrom(32, 37) - 0.05);
  });

  it('el pH de equilibrio usa el bicarbonato de la PaCO₂ de equilibrio', () => {
    const g = new GasExchange(40);
    for (let t = 4; t <= 40; t += 4) respirar(g, t, 0.3);
    const st = g.state(40, DEFAULT_GAS);
    expect(st.phTarget!).toBeCloseTo(phFrom(bicarbonate(DEFAULT_GAS, st.paco2Target!), st.paco2Target!), 9);
  });
});

describe('GAS-05 · V̇A del último minuto', () => {
  const regular = (g: GasExchange, hasta: number): void => {
    for (let t = 4; t <= hasta; t += 4) respirar(g, t, 0.5);
  };
  it('una ventilación regular da (VT − VD)·FR en cualquier fase del ciclo', () => {
    const g = new GasExchange(40);
    regular(g, 120);
    for (const ahora of [120, 121, 122.5, 123.9]) expect(g.vaLMin(ahora)!).toBeCloseTo(vaRegular(0.5, 15), 9);
  });
  it('en apnea la V̇A baja y llega a 0 cuando las respiraciones salen de la ventana', () => {
    const g = new GasExchange(40);
    regular(g, 120);
    const a = g.vaLMin(150)!,
      b = g.vaLMin(170)!;
    expect(a).toBeLessThan(vaRegular(0.5, 15));
    expect(b).toBeLessThan(a);
    expect(g.vaLMin(181)).toBe(0);
  });
});

describe('GAS-02 · banco SC-01: la ventilación del pulmón fija la PaCO₂', () => {
  it('la primera respiración fija el equilibrio y la PaCO₂ se mantiene', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    const inicio = gas(sim).paco2;
    expect(inicio).toBeCloseTo(39, 0);
    minutos(sim, 5);
    const g = gas(sim);
    expect(Math.abs(g.paco2 - inicio)).toBeLessThan(0.6);
    expect(g.vaLMin!).toBeCloseTo(vaRegular(0.5, 15), 1);
    // Sin depender de en qué punto del ciclo se lea.
    for (let i = 0; i < 4; i++) {
      sim.run(1000);
      expect(gas(sim).vaLMin!).toBeCloseTo(g.vaLMin!, 2);
    }
    expect(g.paco2Target!).toBeCloseTo(39, 0);
    expect(g.vdVt!).toBeCloseTo(0.41, 2);
    expect(g.ph).toBeCloseTo(phFrom(bicarbonate(DEFAULT_GAS, g.paco2), g.paco2), 9);
    // Normocapnia en el paciente por omisión: nadie programó una hiperventilación.
    expect(g.ph).toBeGreaterThan(7.38);
    expect(g.ph).toBeLessThan(7.45);
  });

  it('el CO₂ no realimenta la mecánica: presiones y volúmenes idénticos con otra gasometría', () => {
    const a = benchSim();
    const b = benchSim({ patient: { ...BENCH_PATIENT, gas: { vco2MlMin: 400, deadspaceL: 0.3 } } });
    runUntilBreath(a, 6);
    runUntilBreath(b, 6);
    expect(b.breaths.map((x) => [x.ppeak, x.vtExp])).toEqual(a.breaths.map((x) => [x.ppeak, x.vtExp]));
    expect(gas(b).paco2).toBeGreaterThan(gas(a).paco2 * 2);
  });
});

describe('GAS-06 · equilibrio inicial con atrapamiento', () => {
  it('se fija con la ventilación ya estable, no con la primera respiración', () => {
    // Obstructivo con Te corto: el volumen espirado tarda varios ciclos en estabilizarse.
    const sim = benchSim({
      patient: { ...BENCH_PATIENT, crs: 0.06, rInsp: 20, rExp: 30 },
      settings: { ...BENCH_SETTINGS, rr: 20, ie: 1 / 2 },
    });
    // A los 70 s la ventana de V̇A ya sólo contiene respiraciones con el atrapamiento asentado.
    sim.run(70_000);
    const g = gas(sim);
    expect(Math.abs(g.paco2 - g.paco2Target!)).toBeLessThan(1);
  });
});

describe('GAS-03 · cinética: la PaCO₂ sigue a la ventilación con el tramo lento de los tejidos', () => {
  it('duplicar la frecuencia lleva la PaCO₂ hacia la mitad y, pasado el tramo rápido, recorre ≈ 63 % en una τ', () => {
    const sim = benchSim();
    // Pasada la ventana inicial (EQUILIBRIUM_WINDOW_S) la PaCO₂ ya sólo cambia por el balance de masa.
    sim.run(25_000);
    const p0 = gas(sim).paco2;
    sim.command({ type: 'confirmSettings', changes: { rr: 30 } });
    // Un minuto después la ventana de V̇A ya sólo contiene respiraciones a 30/min: desde ahí la aproximación es una
    // exponencial pura hacia el nuevo equilibrio.
    minutos(sim, 1);
    const g = gas(sim);
    const objetivo = g.paco2Target!;
    expect(objetivo).toBeLessThan(p0 * 0.6);
    expect(g.vaLMin!).toBeGreaterThan(1.8 * vaRegular(0.5, 15));
    const tau = g.tauMin!;
    expect(tau).toBeCloseTo(slowTauMin(DEFAULT_GAS.storeL, g.vaLMin!)!, 9);
    // El tramo lento es el de los tejidos, que se vacían por la sangre y el pulmón en serie: τ ≈ C_t · (1/V̇A + 1/G).
    const g1 = (ALVEOLAR_K * DEFAULT_GAS.vco2MlMin) / VENOARTERIAL_PCO2_MMHG,
      serie = 1 / g.vaLMin! + 1 / g1;
    const ct = tissueStoreL(DEFAULT_GAS.storeL);
    expect(tau).toBeGreaterThan(ct * serie);
    expect(tau).toBeLessThan((ct + LUNG_CO2_STORE_L) * serie);
    const p1 = g.paco2;
    minutos(sim, tau);
    const recorrido = (p1 - gas(sim).paco2) / (p1 - objetivo);
    // 1 − e⁻¹ = 0,63 en el modelo continuo; el lavado ocurre por respiración y se lee en un punto del diente de sierra.
    expect(recorrido).toBeGreaterThan(0.55);
    expect(recorrido).toBeLessThan(0.72);
    expect(sim.simTimeMs).toBeGreaterThan((1 + tau) * 60_000);
  });

  it('más espacio muerto con el mismo VT sube la PaCO₂ de equilibrio', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    sim.command({ type: 'setPatient', params: { gas: { deadspaceL: 0.25 } } }, 'instructor');
    minutos(sim, 1);
    expect(gas(sim).paco2Target!).toBeCloseTo((ALVEOLAR_K * 200) / (0.25 * 0.88 * 15), 0);
    sim.command({ type: 'setPatient', params: { gas: { deadspaceL: 0.25, alveolarDeadspaceFrac: 0.4 } } }, 'instructor');
    minutos(sim, 1);
    expect(gas(sim).paco2Target!).toBeCloseTo((ALVEOLAR_K * 200) / (0.25 * 0.6 * 15), 0);
  });

  it('el espacio muerto de la vía aérea pesa más con VT bajos; el alveolar, igual con cualquier VT', () => {
    // Mismo volumen minuto (7,5 L/min) con VT 0,75 × 10 y 0,375 × 20: la vía aérea castiga al VT pequeño; la fracción
    // alveolar recorta la V̇A en la misma proporción en los dos.
    const va = (vt: number, fr: number, p: typeof DEFAULT_GAS) => (vt - p.deadspaceL) * (1 - p.alveolarDeadspaceFrac) * fr;
    const viaAerea = { ...DEFAULT_GAS, deadspaceL: 0.3, alveolarDeadspaceFrac: 0 },
      alveolar = { ...DEFAULT_GAS, deadspaceL: 0, alveolarDeadspaceFrac: 0.4 };
    for (const p of [viaAerea, alveolar]) {
      const grande = new GasExchange(40),
        chico = new GasExchange(40);
      for (let t = 6; t <= 60; t += 6) respirar(grande, t, 0.75, p, 6);
      for (let t = 3; t <= 60; t += 3) respirar(chico, t, 0.375, p, 3);
      expect(grande.vaLMin(60)!).toBeCloseTo(va(0.75, 10, p), 9);
      expect(chico.vaLMin(60)!).toBeCloseTo(va(0.375, 20, p), 9);
    }
    expect(va(0.375, 20, viaAerea) / va(0.75, 10, viaAerea)).toBeCloseTo(0.33, 2);
    expect(va(0.375, 20, alveolar) / va(0.75, 10, alveolar)).toBe(1);
  });
});

describe('GAS-04 · validación y reproducción', () => {
  it('rechaza valores fuera de rango y claves desconocidas', () => {
    expect(validatePatientParams({ ...BENCH_PATIENT, gas: { deadspaceL: 0.15 } })).toEqual([]);
    expect(validatePatientParams({ ...BENCH_PATIENT, gas: { deadspaceL: 1 } })).toContain('Espacio muerto fuera de 0–600 mL');
    expect(validatePatientParams({ ...BENCH_PATIENT, gas: { alveolarDeadspaceFrac: 0.9 } }).join()).toMatch(/alveolar fuera/);
    expect(validatePatientParams({ ...BENCH_PATIENT, gas: { vco2: 200 } as never }).join()).toMatch(/clave desconocida/);
    expect(validatePatientParams({ ...BENCH_PATIENT, gas: { hco3: Number.NaN } })).toContain('Bicarbonato fuera de 5–50 mEq/L');
  });

  it('la sesión reproducida da la misma gasometría', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS } });
    runUntilBreath(sim, 3);
    sim.command({ type: 'confirmSettings', changes: { rr: 20 } });
    sim.command({ type: 'setPatient', params: { gas: { vco2MlMin: 250 } } }, 'instructor');
    runUntilBreath(sim, 12);
    const imp = importSession(JSON.stringify(exportSession(sim)));
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    const re = replaySession(imp.session);
    expect(re.frame().truth.gas).toEqual(sim.frame().truth.gas);
  });
});

// Dos compartimentos (Farhi y Rahn): pulmón pequeño y rápido, sangre y tejidos grandes y lentos. Oráculos medidos:
// apnea de anestesiados con el tubo ocluido —Stock 1989 (PMID 2516732): +12 mmHg el primer minuto y 3,4 mmHg/min
// después, aproximación lineal por tramos de una curva logarítmica; Kobayashi 1994 (PMID 7933492): +9,8 ± 1,9 el
// primer minuto y 3,4–4,4 mmHg/min después—, la hipocapnia aguda previa (Gentz 1998, PMID 9603587) y la respuesta a
// un cambio de ventilación de ±10 % (Taskar 1995, PMID 7606958). Se comprueban sobre el adulto real (aceleración 1):
// el simulador recorre el mismo camino ≈ 10 veces más deprisa (GAS-09).
describe('GAS-08 · cinética de dos compartimentos (adulto real)', () => {
  it('apnea: el primer minuto sube rápido y después 3,4–4,4 mmHg/min, como en los anestesiados con el tubo ocluido', () => {
    const { g } = enEquilibrio();
    const p0 = g.paco2;
    apnea(g, 60);
    const primerMinuto = g.paco2 - p0;
    const p1 = g.paco2;
    apnea(g, 240);
    const despues = (g.paco2 - p1) / 4;
    // Dentro de una desviación de Kobayashi (9,8 ± 1,9) y por debajo de los 12 de Stock: el modelo no lleva lo que
    // añaden el colapso del pulmón que absorbe O₂ ni el efecto Haldane.
    expect(primerMinuto).toBeGreaterThan(7.9);
    expect(primerMinuto).toBeLessThan(12);
    expect(despues).toBeGreaterThan(3.4);
    expect(despues).toBeLessThan(4.4);
    // La forma: el primer minuto vale el doble que cualquiera de los siguientes.
    expect(primerMinuto).toBeGreaterThan(2 * despues);
  });

  it('en equilibrio la sangre venosa queda ≈ 6 mmHg por encima de la arterial, y en proporción a la producción', () => {
    const { g } = enEquilibrio();
    expect(g.venosa - g.paco2).toBeCloseTo(VENOARTERIAL_PCO2_MMHG, 0);
    const p = { ...DEFAULT_GAS, vco2MlMin: 250 };
    const h = new GasExchange('equilibrium', 1);
    ventilar(h, 0, 1800, 0.5, 4, p);
    expect((h.venosa - h.paco2) / (g.venosa - g.paco2)).toBeCloseTo(250 / 200, 1);
  });

  it('tras una hiperventilación aguda el primer minuto de apnea sube más: el gradiente venoarterial está abierto (Gentz)', () => {
    const subida = (minutosHiper: number) => {
      const { g, t } = enEquilibrio();
      if (minutosHiper) ventilar(g, t, minutosHiper * 60, 0.8);
      const gradiente = g.venosa - g.paco2,
        p0 = g.paco2;
      apnea(g, 60);
      return { gradiente, primerMinuto: g.paco2 - p0 };
    };
    const eucapnia = subida(0),
      aguda = subida(5),
      asentada = subida(30);
    expect(aguda.gradiente).toBeGreaterThan(eucapnia.gradiente + 1);
    expect(aguda.primerMinuto).toBeGreaterThan(eucapnia.primerMinuto + 1);
    // Con la hipocapnia ya asentada el gradiente vuelve al de reposo y la subida es la misma.
    expect(asentada.gradiente).toBeCloseTo(eucapnia.gradiente, 0);
    expect(asentada.primerMinuto).toBeCloseTo(eucapnia.primerMinuto, 0);
  });

  it('±10 % de VT: la PaCO₂ apenas se mueve en diez respiraciones y recorre la mayor parte en 20 min; bajando, más lento', () => {
    const camino = (factor: number) => {
      const { g, t } = enEquilibrio();
      const p0 = g.paco2,
        vt = 0.5 * factor;
      let tt = ventilar(g, t, 40, vt);
      const diez = g.paco2;
      tt = ventilar(g, tt, 20 * 60 - 40, vt);
      const veinte = g.paco2;
      const tau = g.state(tt, DEFAULT_GAS).tauMin!;
      expect(tau).toBeCloseTo(slowTauMin(DEFAULT_GAS.storeL, g.vaLMin(tt)!, 1)!, 9);
      ventilar(g, tt, 120 * 60, vt);
      const final = g.paco2;
      return { diez: (diez - p0) / (final - p0), veinte: (veinte - p0) / (final - p0), tau };
    };
    const sube = camino(1.1),
      baja = camino(0.9);
    for (const c of [sube, baja]) {
      expect(c.diez).toBeLessThan(0.2);
      expect(c.veinte).toBeGreaterThan(0.7);
    }
    expect(baja.tau).toBeGreaterThan(sube.tau * 1.2);
  });

  it('la muestra arterial no oscila con cada respiración; el alvéolo sí', () => {
    const { g, t } = enEquilibrio();
    let min = Infinity,
      max = -Infinity,
      aMin = Infinity,
      aMax = -Infinity;
    // Cuatro respiraciones más de 4 s (1000 pasos), leídas paso a paso.
    for (let n = 1; n <= 4; n++) {
      for (let i = 0; i < 1000; i++) {
        g.step(0.004, DEFAULT_GAS);
        if (i === 333) g.move(0.5, DEFAULT_GAS);
        if (i === 500) g.move(-0.5, DEFAULT_GAS);
        min = Math.min(min, g.paco2);
        max = Math.max(max, g.paco2);
        aMin = Math.min(aMin, g.alveolar);
        aMax = Math.max(aMax, g.alveolar);
      }
      g.onBreath(t + 4 * n, 4, DEFAULT_GAS);
    }
    expect(max - min).toBeLessThan(0.3);
    expect(aMax - aMin).toBeGreaterThan(2);
  });
});

// Aceleración docente (P): la sangre y los tejidos guardan 20 veces menos CO₂ que en un adulto real para que el
// equilibrio llegue en minutos. Lo que se rotula en la interfaz —«≈ 10 veces más rápido»— tiene que ser verdad en
// todo el rango de ventilación, y el destino no puede cambiar.
describe('GAS-09 · aceleración docente del equilibrio', () => {
  it('el tramo lento es ≈ 10 veces más corto que en el adulto real con cualquier V̇A habitual', () => {
    for (const va of [2, 3, 4.4, 6, 9]) {
      const veces = slowTauMin(DEFAULT_GAS.storeL, va, 1)! / slowTauMin(DEFAULT_GAS.storeL, va)!;
      expect(veces).toBeGreaterThan(ACELERACION_EQUILIBRIO * 0.9);
      expect(veces).toBeLessThan(ACELERACION_EQUILIBRIO * 1.1);
    }
  });

  it('el mismo camino en una décima parte del tiempo y hacia el mismo equilibrio', () => {
    const real = enEquilibrio(1),
      docente = enEquilibrio(ACELERACION_TEJIDOS);
    expect(docente.g.paco2).toBeCloseTo(real.g.paco2, 1);
    const p0 = real.g.paco2,
      objetivo = steadyPaco2(DEFAULT_GAS.vco2MlMin, vaRegular(0.4, 15))!;
    // VT de 500 a 400: la PaCO₂ sube. Lo que el adulto recorre en 20 min, el simulador lo recorre en 2: más de la mitad.
    ventilar(real.g, real.t, 20 * 60, 0.4);
    const t = ventilar(docente.g, docente.t, 2 * 60, 0.4);
    const recorrido = (g: GasExchange) => (g.paco2 - p0) / (objetivo - p0);
    expect(Math.abs(recorrido(docente.g) - recorrido(real.g))).toBeLessThan(0.1);
    expect(recorrido(docente.g)).toBeGreaterThan(0.5);
    // Y llega al mismo sitio.
    ventilar(docente.g, t, 15 * 60, 0.4);
    expect(docente.g.paco2).toBeCloseTo(objetivo, 0);
  });

  it('la muestra arterial tampoco oscila con la aceleración', () => {
    const { g, t } = enEquilibrio(ACELERACION_TEJIDOS);
    let min = Infinity,
      max = -Infinity;
    for (let n = 1; n <= 4; n++) {
      for (let i = 0; i < 1000; i++) {
        g.step(0.004, DEFAULT_GAS);
        if (i === 333) g.move(0.5, DEFAULT_GAS);
        if (i === 500) g.move(-0.5, DEFAULT_GAS);
        min = Math.min(min, g.paco2);
        max = Math.max(max, g.paco2);
      }
      g.onBreath(t + 4 * n, 4, DEFAULT_GAS);
    }
    expect(max - min).toBeLessThan(0.3);
  });

  it('banco: bajar la FR de 15 a 10 lleva la PaCO₂ a su nuevo equilibrio en minutos, no en media hora', () => {
    const sim = benchSim();
    sim.run(25_000);
    const p0 = gas(sim).paco2;
    sim.command({ type: 'confirmSettings', changes: { rr: 10 } });
    minutos(sim, 5);
    const g = gas(sim);
    const objetivo = g.paco2Target!;
    expect(objetivo).toBeGreaterThan(p0 + 15);
    expect((g.paco2 - p0) / (objetivo - p0)).toBeGreaterThan(0.9);
    // En el adulto real, con esa ventilación, el tramo lento dura más de un cuarto de hora.
    expect(slowTauMin(DEFAULT_GAS.storeL, g.vaLMin!, 1)!).toBeGreaterThan(15);
    expect(g.tauMin!).toBeLessThan(2);
  });
});
