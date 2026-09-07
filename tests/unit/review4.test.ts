import { describe, expect, it } from 'vitest';
import { PatientModel } from '../../src/engine/patient';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// Regresiones de la cuarta revisión adversarial (07-09-2026): todos los defectos que introdujo la extensión a dos
// unidades alveolares sin propagarla al controlador, a la pantalla ni al manejo de fallos.
const dos = { ...BENCH_PATIENT, crs: 0.03, second: { crs: 0.03, rInsp: 1, rExp: 1 } };

describe('R4-01 · ningún número no finito sale como válido', () => {
  it('un tramo de duración nula no produce NaN, ni siquiera con elastancia viscoelástica cero', () => {
    const p = new PatientModel({ ...dos, eVisc: 0 }, 0.3);
    p.integrateFlowSource(0.5, 0);
    p.integratePressureSource(10, () => 0, 0, 0);
    expect(Number.isFinite(p.vVisc)).toBe(true);
    expect(Number.isFinite(p.pel())).toBe(true);
    expect(p.pVisc).toBe(0);
  });
  it('el barrido de dos unidades con Plimit ya no diverge a ningún paso', () => {
    for (const r2 of [0.1, 0.3, 1, 3]) {
      for (const dtMs of [0.5, 4, 8]) {
        const sim = benchSim({
          patient: { ...BENCH_PATIENT, crs: 0.02, second: { crs: 0.02, rInsp: r2, rExp: r2 } },
          settings: { ...BENCH_SETTINGS, plimit: 18 },
          dtMs,
        });
        for (let i = 0; i < 2000; i++) sim.step();
        expect(Number.isFinite(sim.frame().truth.vAbsL), `r2=${r2} dt=${dtMs}`).toBe(true);
        expect(Number.isFinite(sim.frame().live.paw)).toBe(true);
      }
    }
  });
  it('si el modelo divergiera, la métrica se publica como inválida y queda un evento en el registro', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    sim.patient.v = Number.NaN; // se fuerza la divergencia para comprobar la vigilancia, no el modelo
    sim.step();
    expect(sim.events.some((e) => e.kind === 'discontinuity' && JSON.stringify(e.payload).includes('finitos'))).toBe(true);
    // Y ninguna métrica derivada del estado roto puede salir con calidad válida.
    runUntilBreath(sim, 4);
    const vte = sim.frame().metrics.vte;
    expect(vte?.value === null || Number.isFinite(vte?.value as number)).toBe(true);
    if (vte?.value === null) expect(vte.quality).not.toBe('valid');
  });
});

describe('R4-02 · el circuito y el tope del ventilador son restricciones del nodo', () => {
  it('con la válvula cerrada ninguna unidad sortea la resistencia en serie', () => {
    const p = new PatientModel(dos, 0.6);
    const nodo = p.nodeState(5, 0, 200, Number.POSITIVE_INFINITY, false);
    // Las dos ramas en paralelo (10 y 1) y después la serie del circuito (200): el total sale de la resistencia completa.
    const rParalelo = 1 / (1 / 10 + 1 / 1);
    const esperado = (p.pel() - 5) / (rParalelo + 200);
    expect(-(nodo.q1 + nodo.q2)).toBeCloseTo(esperado, 6);
    // Y ninguna rama sortea la serie: sin ella el flujo sería más de veinte veces mayor.
    expect(-(nodo.q1 + nodo.q2)).toBeLessThan((p.pel() - 5) / rParalelo / 20);
  });
  it('el tope de flujo del actuador acota el flujo TOTAL, no sólo el de una rama', () => {
    const tope = 160 / 60;
    const p = new PatientModel({ ...dos, second: { crs: 0.03, rInsp: 0.3, rExp: 0.3 } }, 0);
    const nodo = p.nodeState(60, 0, 0, tope, false);
    expect(nodo.q1 + nodo.q2).toBeLessThanOrEqual(tope + 1e-9);
    expect(nodo.clamped).toBe(true);
  });
  it('en presión control con dos unidades el flujo pico respeta el tope del actuador', () => {
    const sim = benchSim({
      patient: { ...BENCH_PATIENT, crs: 0.03, rInsp: 0.3, rExp: 0.3, second: { crs: 0.03, rInsp: 0.3, rExp: 0.3 } },
      settings: { ...BENCH_SETTINGS, mode: 'AC_PC', pinsp: 30, riseMs: 0, pmax: 60, plimit: 100 },
    });
    let pico = 0;
    while (sim.breaths.length < 4) {
      sim.step();
      pico = Math.max(pico, sim.frame().live.flowLps);
    }
    expect(pico).toBeLessThanOrEqual(160 / 60 + 0.01);
  });
  it('el flujo de base acota lo que el paciente puede inhalar en espiración también con dos unidades', () => {
    const sim = benchSim({
      patient: dos,
      effort: { enabled: true, amplitude: 14, ratePerMin: 15, tiS: 0.8, phaseS: 2 },
      settings: { ...BENCH_SETTINGS, assistControl: false, biasFlow: 2 / 60, plimit: 100 },
    });
    let qMax = -Infinity;
    let prev = false;
    while (sim.breaths.length < 8) {
      sim.step();
      const exp = sim.frame().live.phase === 'exp';
      if (exp && prev) qMax = Math.max(qMax, sim.frame().live.flowLps);
      prev = exp;
    }
    expect(qMax).toBeLessThanOrEqual(2 / 60 + 1e-6);
  });
});

describe('R4-03 · lo que se publica es lo que se mide', () => {
  it('durante una oclusión la Pva es la del nodo, no la de una unidad', () => {
    const sim = benchSim({
      patient: { ...BENCH_PATIENT, crs: 0.035, rInsp: 5, rExp: 5, second: { crs: 0.025, rInsp: 200, rExp: 200 } },
      settings: { ...BENCH_SETTINGS, plimit: 100 },
    });
    runUntilBreath(sim, 3);
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    while (sim.frame().procedure.hold?.phase !== 'running') sim.step();
    sim.step();
    const f = sim.frame();
    const nodo = sim.patient.nodePressureForFlow(0, 0);
    expect(f.live.paw).toBeCloseTo(nodo, 6);
    expect(Math.abs(f.live.paw - sim.patient.pel())).toBeGreaterThan(0.1); // y difiere de la unidad principal
  });
  it('la curva de volumen suma las dos unidades: coincide con el VT entregado', () => {
    const sim = benchSim({
      patient: { ...BENCH_PATIENT, crs: 0.03, second: { crs: 0.03, rInsp: 30, rExp: 30 } },
      settings: { ...BENCH_SETTINGS, plimit: 100 },
    });
    runUntilBreath(sim, 3);
    while (sim.frame().live.phase === 'exp') sim.step();
    while (sim.frame().live.phase !== 'exp') sim.step();
    const f = sim.frame();
    expect(Math.abs(f.live.volTidalL - 0.5)).toBeLessThan(0.02); // el VC entrega 500 mL: la curva debe llegar ahí
  });
});

describe('R4-04 · órdenes de banco que dejan el estado coherente', () => {
  it('fijar el volumen absoluto no inventa presión viscoelástica ni descuadra el total', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, eVisc: 20, tauViscS: 1.5 } });
    runUntilBreath(sim, 3);
    expect(sim.command({ type: 'setLungVolume', vAbsL: 0.9 }).accepted).toBe(true);
    expect(sim.patient.vTotal).toBeCloseTo(0.9, 9);
    expect(sim.patient.pVisc).toBeCloseTo(0, 9);
    expect(sim.frame().truth.pel).toBeCloseTo(sim.patient.pelStatic(), 9);
  });
  it('quitar la segunda unidad conserva el gas en vez de hacerlo desaparecer', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, crs: 0.03, second: { crs: 0.03, rInsp: 30, rExp: 30 } } });
    runUntilBreath(sim, 4);
    const antes = sim.frame().truth.vAbsL;
    expect(sim.command({ type: 'setPatient', params: { second: undefined } }).accepted).toBe(true);
    expect(sim.frame().truth.vAbsL).toBeCloseTo(antes, 9);
  });
  it('al reanudar tras espera la primera Cstat usa la PEEP y no cero', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, plimit: 100, pausePct: 0 } });
    runUntilBreath(sim, 3);
    sim.command({ type: 'enterStandby' });
    for (let i = 0; i < 200; i++) sim.step();
    sim.command({ type: 'startVentilation' });
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    runUntilBreath(sim, 8);
    const h = sim.frame().procedure.last.inspHold;
    expect(h?.quality).toBe('valid');
    expect((h?.values.cstat?.value as number) * 1000).toBeCloseTo(50, 0);
  });
});

describe('R4-05 · el elástico se describe con una sola función', () => {
  it('la presión de equilibrio coincide con la meseta real de una oclusión larga, también con sigmoide', () => {
    const p = new PatientModel(
      { ...BENCH_PATIENT, crs: 0.03, sigmoid: { b: 0.5, c: 12, d: 4 }, second: { crs: 0.02, rInsp: 20, rExp: 20 } },
      0,
    );
    p.v = 0.4;
    p.vVisc = 0.4;
    p.v2 = 0.2;
    const previsto = p.equilibratedPressure();
    for (let i = 0; i < 20000; i++) p.integrateFlowSource(0, 0.005); // 100 s ocluido
    expect(p.pelStatic()).toBeCloseTo(previsto, 2);
    expect(p.pel2()).toBeCloseTo(previsto, 2);
  });
});

describe('R4-06 · la forma cerrada del nodo coincide con la bisección', () => {
  it('con ramas lineales el nodo resuelto en forma cerrada da el mismo flujo total pedido', () => {
    const p = new PatientModel({ ...BENCH_PATIENT, crs: 0.04, rInsp: 7, rExp: 13, second: { crs: 0.02, rInsp: 3, rExp: 40 } }, 0);
    p.v = 0.5;
    p.vVisc = 0.5;
    p.v2 = 0.1;
    for (const pmus of [0, 6, -4]) {
      for (const q of [-1.2, -0.3, 0, 0.4, 2.5]) {
        const py = p.nodePressureForFlow(q, pmus);
        expect(p.branch1Flow(py, pmus) + p.branch2Flow(py, pmus)).toBeCloseTo(q, 9);
      }
      for (const rs of [0.5, 3, 200]) {
        const py = p.nodePressureWithSeries(8, pmus, rs);
        expect(p.branch1Flow(py, pmus) + p.branch2Flow(py, pmus)).toBeCloseTo((8 - py) / rs, 9);
      }
    }
  });
  it('con ramas no lineales cae a la bisección y sigue invirtiendo', () => {
    const p = new PatientModel(
      { ...BENCH_PATIENT, crs: 0.04, r2: 6, efl: { pcrit: 5, rusFraction: 0.5 }, second: { crs: 0.02, rInsp: 3, rExp: 40 } },
      0,
    );
    p.v = 0.5;
    p.vVisc = 0.5;
    p.v2 = 0.1;
    for (const q of [-0.2, 0, 0.4, 2]) {
      const py = p.nodePressureForFlow(q, 0);
      expect(p.branch1Flow(py, 0) + p.branch2Flow(py, 0)).toBeCloseTo(q, 6);
    }
  });
});

describe('R4-07 · el solucionador del nodo no se dispara', () => {
  // El guardián cuenta trabajo, no tiempo. Contar es determinista y no depende de la máquina ni de la instrumentación
  // de cobertura; medir el reloj en integración continua daba un test que caducaba en un runner compartido. La medida
  // de reloj queda en docs/02 como dato, no como puerta.
  // A 30 por minuto una respiración dura 2 s, es decir 500 pasos de 4 ms: la ventana medida es exactamente un ciclo,
  // así que la media por paso está bien definida y el guardián hace el mínimo trabajo necesario.
  const PASOS = 500;
  const evalsPorPaso = (over: Parameters<typeof benchSim>[0]): number => {
    const sim = benchSim({ ...over, settings: { ...BENCH_SETTINGS, rr: 30, plimit: 100 } });
    for (let i = 0; i < PASOS; i++) sim.step();
    const base = sim.patient.solverEvals;
    for (let i = 0; i < PASOS; i++) sim.step();
    return (sim.patient.solverEvals - base) / PASOS;
  };

  it('con ramas lineales el nodo se resuelve en forma cerrada: cero bisecciones', () => {
    expect(evalsPorPaso({})).toBe(0);
    expect(evalsPorPaso({ patient: { ...BENCH_PATIENT, second: { crs: 0.03, rInsp: 1, rExp: 1 } } })).toBe(0);
  });

  it('la combinación más costosa se mantiene acotada', () => {
    // Rohrer + limitación al flujo + segunda unidad muy rígida obligan a bisecar en cada evaluación de la integración.
    // Medido: 10038 evaluaciones por paso. El tope deja margen para un reajuste del modelo, no para una regresión de orden.
    const pesado = evalsPorPaso({
      patient: {
        ...BENCH_PATIENT,
        eVisc: 10,
        tauViscS: 1.5,
        r2: 5,
        efl: { pcrit: 8, rusFraction: 0.5 },
        second: { crs: 0.0005, rInsp: 0.1, rExp: 0.1 },
      },
    });
    expect(pesado, `${pesado.toFixed(0)} evaluaciones por paso`).toBeLessThan(15000);
    // Plazo amplio y explícito: la aserción es determinista, así que el único riesgo es que un runner lento no
    // alcance a terminar el trabajo. El plazo por omisión de 5 s no le bastaba bajo instrumentación de cobertura.
  }, 60_000);
});
