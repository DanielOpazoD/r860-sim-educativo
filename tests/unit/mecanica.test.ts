import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { defaultInit, R860_PROFILE } from '../../src/profiles';
import { SCENARIOS } from '../../src/scenarios';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// La oclusión inspiratoria da dos números, no uno. La meseta separa lo elástico de lo resistivo, y el simulador se
// quedaba sólo con la mitad elástica: publicaba Cstat y tiraba la resistencia, que es la que explica el atrapamiento
// aéreo que el propio programa enseña en otros escenarios.

/** Bloqueo inspiratorio sobre un simulador ya estacionario. */
function bloquear(sim: Simulator, durationS = 3) {
  runUntilBreath(sim, sim.breaths.length + 3);
  sim.command({ type: 'requestHold', kind: 'inspHold', durationS });
  for (let i = 0; i < 200_000 && !sim.frame().procedure.last.inspHold; i++) sim.step();
  const h = sim.frame().procedure.last.inspHold!;
  const v = (k: string) => h.values[k];
  return {
    calidad: h.quality,
    pplat: v('pplat')?.value ?? null,
    cstat: v('cstat')?.value ?? null,
    raw: v('raw')?.value ?? null,
    rawMotivo: v('raw')?.reason ?? null,
  };
}
function deEscenario(id: string): Simulator {
  const e = SCENARIOS.find((s) => s.id === id)!;
  const base = defaultInit({});
  return new Simulator(
    defaultInit({
      patient: { ...e.patient },
      effort: { ...e.effort },
      sensors: { ...e.sensors },
      settings: { ...base.settings, ...(e.settings ?? {}) },
      initialV: e.initialV ?? 'equilibrium',
    }),
    R860_PROFILE,
  );
}

describe('MEC-01 · la resistencia sale de la misma oclusión que la distensibilidad', () => {
  it('en el banco lineal da exactamente el número del modelo', () => {
    // C 50 mL/cmH2O, R 10 cmH2O·s/L, flujo 0,5 L/s: Ppico 20, Pplat 15. R = (20 − 15)/0,5 = 10 y tau = R·C = 0,5 s.
    // Es la misma cuenta que el diálogo «Modelo» imprime como ecuación y que el simulador nunca dejaba comprobar.
    const r = bloquear(benchSim({ settings: { ...BENCH_SETTINGS, plimit: 100 } }));
    expect(r.calidad).toBe('valid');
    expect(r.pplat as number).toBeCloseTo(15, 1);
    expect(r.raw as number).toBeCloseTo(10, 2);
    expect((r.cstat as number) * 1000).toBeCloseTo(50, 0);
  });

  it('al triplicar la resistencia el número la sigue, y la distensibilidad no se mueve', () => {
    // La comprobación que un alumno hace de verdad: cambio una cosa y miro cuál de los dos números se entera.
    const base = bloquear(benchSim({ settings: { ...BENCH_SETTINGS, plimit: 100 } }));
    const dura = bloquear(benchSim({ patient: { ...BENCH_PATIENT, rInsp: 30 }, settings: { ...BENCH_SETTINGS, plimit: 100 } }));
    expect(dura.raw as number).toBeCloseTo(30, 1);
    expect((dura.cstat as number) * 1000).toBeCloseTo((base.cstat as number) * 1000, 1);
  });

  it('la resistencia inspiratoria NO predice el vaciamiento, y por eso la constante se mide aparte', () => {
    // SC-03 tiene Rinsp 10 y Rexp 30: la oclusión inspiratoria mide 10 y el pulmón se vacía con 30. Multiplicar la
    // resistencia medida por la distensibilidad daría 0,5 s cuando el vaciamiento real tarda el triple.
    const sim = deEscenario('SC-03');
    const r = bloquear(sim);
    expect(r.calidad).toBe('valid');
    expect(r.raw as number, 'la oclusión mide la resistencia INSPIRATORIA').toBeCloseTo(10, 0);
    const tauExp = sim.frame().metrics.tauExp;
    expect(tauExp?.quality).toBe('valid');
    expect(tauExp?.value as number, 'el vaciamiento va con Rexp 30, no con Rinsp 10').toBeGreaterThan(1.2);
  });
});

describe('MEC-02 · cuando la resta no mide una resistencia, no se publica un número', () => {
  it('en presión control no hay un caudal único que dividir, y se dice', () => {
    // El flujo decae durante toda la inspiración: (Ppico − Pplat)/Q no tiene denominador. Inventarlo daría una
    // resistencia que cambia con el tiempo inspiratorio, que es justo el error que la maniobra debe enseñar a evitar.
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, mode: 'AC_PC', pinsp: 10, plimit: 100 } });
    const r = bloquear(sim);
    expect(r.raw).toBeNull();
    expect(r.rawMotivo).toBe('sinRampaAFlujoConstante');
  });

  it('con Plimit recortando la entrega tampoco, aunque el modo sea volumen control', () => {
    // Al alcanzar Plimit el ventilador deja de mandar flujo constante y pasa a sostener presión: la rampa se acabó.
    const sim = benchSim({ patient: { ...BENCH_PATIENT, crs: 0.02 }, settings: { ...BENCH_SETTINGS, plimit: 25, pmax: 60 } });
    const r = bloquear(sim);
    expect(r.raw).toBeNull();
    expect(r.rawMotivo).toBe('sinRampaAFlujoConstante');
  });

  it('con esfuerzo durante la rampa la resta ya no es sólo del pulmón', () => {
    // Los músculos restan presión en la vía aérea: atribuir esa diferencia a la resistencia da un número más bajo que
    // el real. Es el mismo criterio con el que el índice de estrés se declara no interpretable.
    const sim = benchSim({
      effort: { enabled: true, amplitude: 6, ratePerMin: 15, tiS: 0.9, phaseS: 0 },
      settings: { ...BENCH_SETTINGS, plimit: 100 },
    });
    const r = bloquear(sim);
    expect(r.raw).toBeNull();
    expect(r.rawMotivo).toBe('sinRampaAFlujoConstante');
  });

  it('si la meseta se rechaza, la resistencia y la constante caen con ella', () => {
    const dos = { ...BENCH_PATIENT, crs: 0.03, rInsp: 5, rExp: 5, second: { crs: 0.03, rInsp: 400, rExp: 400 } };
    const r = bloquear(benchSim({ patient: dos, settings: { ...BENCH_SETTINGS, plimit: 100 } }), 2);
    expect(r.calidad).toBe('invalid');
    expect(r.raw).toBeNull();
    expect(r.rawMotivo).toBe('mesetaInestable');
  });
});

describe('MEC-03 · la constante de tiempo se lee en la curva, y sólo si la curva es una recta', () => {
  /** Corre un escenario hasta estado estacionario y devuelve su métrica de constante de tiempo. */
  function tau(id: string) {
    const sim = deEscenario(id);
    runUntilBreath(sim, 8);
    return sim.frame().metrics.tauExp;
  }

  it('en un compartimento lineal sale exactamente Rexp × C, sin ninguna maniobra', () => {
    // SC-01: Rexp 10, C 0,05 → 0,5 s. El número está en la rama espiratoria del bucle: no hace falta ocluir nada.
    const m = tau('SC-01');
    expect(m?.quality).toBe('valid');
    expect(m?.value as number).toBeCloseTo(0.5, 2);
  });

  it('en el obstructivo sale la resistencia espiratoria, que es el triple de la inspiratoria', () => {
    // SC-03: Rinsp 10, Rexp 30, C 0,05 → 1,5 s. Y el tiempo espiratorio programado no llega a tres constantes: por eso
    // ese escenario atrapa aire. Ése es el enlace entre el número y el fenómeno.
    const sim = deEscenario('SC-03');
    runUntilBreath(sim, 8);
    const m = sim.frame().metrics.tauExp;
    expect(m?.quality).toBe('valid');
    expect(m?.value as number).toBeCloseTo(1.5, 1);
    const tExp = sim.breaths[sim.breaths.length - 1]!.tExpS;
    expect(tExp / (m?.value as number), 'menos de tres constantes: no termina de vaciar').toBeLessThan(3);
  });

  it('con la espiración estrangulada la recta deja de ajustar y no se publica un número', () => {
    // SC-16 tiene limitación al flujo y resistencia que crece al vaciarse: el vaciamiento no es una exponencial.
    // Publicar 0,96 s como si lo fuera contradiría la lección del propio escenario.
    const m = tau('SC-16');
    expect(m?.value).toBeNull();
    expect(m?.reason).toBe('vaciamientoNoExponencial');
  });

  it('con tejido viscoelástico tampoco: la relajación sigue durante toda la espiración', () => {
    const m = tau('SC-14');
    expect(m?.value).toBeNull();
    expect(m?.reason).toBe('vaciamientoNoExponencial');
  });

  it('si el paciente hace fuerza durante la espiración, el vaciamiento no es pasivo y se dice', () => {
    // Esfuerzos al doble de la frecuencia del ventilador: uno de cada dos cae dentro de la espiración. La pendiente de
    // la rama deja de ser sólo del pulmón, y una constante de tiempo sacada de ahí sería del paciente y de la máquina.
    const sim = benchSim({
      effort: { enabled: true, amplitude: 6, ratePerMin: 30, tiS: 0.8, phaseS: 0.2 },
      settings: { ...BENCH_SETTINGS, plimit: 100, assistControl: false },
    });
    runUntilBreath(sim, 8);
    const m = sim.frame().metrics.tauExp;
    expect(m?.value).toBeNull();
    expect(m?.reason).toBe('esfuerzoDuranteLaEspiracion');
  });
});
