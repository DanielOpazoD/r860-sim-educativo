import { describe, expect, it } from 'vitest';
import { PLATEAU_DRIFT_RATE_CMH2O_S, PLATEAU_DRIFT_RATE_EXP_CMH2O_S } from '../../src/engine/controller';
import { Simulator } from '../../src/engine/simulator';
import { defaultInit, R860_PROFILE } from '../../src/profiles';
import { SCENARIOS } from '../../src/scenarios';
import { runUntilBreath } from '../helpers';

// Quinta ronda de revisión (08-09-2026). Lo que se corrige aquí no es un número mal calculado sino un número mal
// certificado: el equipo daba por buena una PEEP total que todavía estaba subiendo.

function escenario(id: string): Simulator {
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

/** Bloqueo espiratorio de la duración pedida, desde un estado ya estacionario. */
function bloquear(id: string, durationS: number): { valida: boolean; motivo: string | null; peepTot: number | null } {
  const sim = escenario(id);
  runUntilBreath(sim, 6);
  sim.command({ type: 'requestHold', kind: 'expHold', durationS });
  for (let i = 0; i < 200_000 && !sim.frame().procedure.last.expHold; i++) sim.step();
  const h = sim.frame().procedure.last.expHold!;
  return { valida: h.quality === 'valid', motivo: h.reason, peepTot: h.values.peepTot?.value ?? null };
}

describe('R7-01 · la PEEP total no se certifica mientras sigue subiendo', () => {
  it('en un pulmón que redistribuye despacio una oclusión corta se rechaza con motivo', () => {
    // SC-17 tarda unos 12 s en llegar a su asíntota de 5,63. A los 2 s la presión iba por 5,33 y el equipo la daba por
    // buena: PEEPi 0,33 medida contra 0,63 real, la mitad del dato, y sin ninguna marca de que faltara nada.
    for (const d of [2, 3, 4]) {
      const r = bloquear('SC-17', d);
      expect(r.valida, `SC-17 a ${d} s`).toBe(false);
      expect(r.motivo, `SC-17 a ${d} s`).toBe('mesetaInestable');
      expect(r.peepTot, 'un resultado inválido no publica número').toBeNull();
    }
  });

  it('alargando la oclusión el mismo pulmón sí da una PEEP total, y ya casi no le falta nada', () => {
    const asintota = bloquear('SC-17', 40);
    expect(asintota.valida).toBe(true);
    for (const d of [6, 8, 12]) {
      const r = bloquear('SC-17', d);
      expect(r.valida, `SC-17 a ${d} s`).toBe(true);
      // El criterio existe para acotar lo que falta por subir: dentro de la cifra que la pantalla muestra.
      expect(Math.abs((r.peepTot as number) - (asintota.peepTot as number)), `SC-17 a ${d} s`).toBeLessThan(0.1);
    }
  });

  it('un pulmón que vacía rápido no paga el criterio: a los 2 s ya está asentado', () => {
    // El riesgo del arreglo era exigir a todos lo que sólo hace falta en unos pocos.
    for (const id of ['SC-03', 'SC-16']) {
      const corta = bloquear(id, 2);
      const larga = bloquear(id, 8);
      expect(corta.valida, id).toBe(true);
      expect(Math.abs((corta.peepTot as number) - (larga.peepTot as number)), id).toBeLessThan(0.05);
    }
  });

  it('el listón del bloqueo espiratorio es más estrecho que el del inspiratorio, y eso es deliberado', () => {
    // No es simetría rota por descuido: la maniobra espiratoria publica una resta de dos presiones casi iguales.
    expect(PLATEAU_DRIFT_RATE_EXP_CMH2O_S).toBeLessThan(PLATEAU_DRIFT_RATE_CMH2O_S);
  });
});

describe('R7-02 · si la lección pide un bloqueo espiratorio, dice cuánto tiene que durar', () => {
  it('todo objetivo «validExp» se cumple con la duración que su propio texto nombra', () => {
    // Al estrechar el criterio, SC-14 dejó de aceptar los 3 s que trae el selector por omisión. Un objetivo que sólo
    // se cumple con un ajuste que la tarea no menciona es un objetivo imposible disfrazado.
    const conExp = SCENARIOS.filter((e) => e.lesson?.tasks.some((t) => t.test === 'validExp'));
    expect(conExp.length).toBeGreaterThan(0);
    for (const e of conExp) {
      const texto = e.lesson!.tasks.find((t) => t.test === 'validExp')!.text;
      const nombrada = /(\d+)\s*s\b/.exec(texto);
      const d = nombrada ? Number(nombrada[1]) : 3; // 3 s es lo que el selector ofrece al abrirse
      const r = bloquear(e.id, d);
      expect(r.valida, `${e.id} a ${d} s → ${r.motivo}`).toBe(true);
    }
  });
});

describe('R7-03 · un límite recién puesto se compara enseguida con lo último medido', () => {
  /** Ventila unas cuantas respiraciones a la frecuencia pedida y devuelve el simulador listo. */
  function ventilando(rr: number): Simulator {
    const sim = new Simulator(defaultInit({ settings: { ...defaultInit({}).settings, rr } }), R860_PROFILE);
    runUntilBreath(sim, 6);
    return sim;
  }
  const activa = (sim: Simulator, id: string): boolean => sim.frame().alarms.some((a) => a.id === id && a.conditionActive);
  /** Un límite de VTesp por encima de lo entregado, en la rejilla de 1 mL que admite el ajuste. */
  const porEncimaDelVte = (sim: Simulator): number => Math.round(((sim.frame().metrics.vte?.value as number) + 0.1) * 1000) / 1000;

  it('subir el límite de VTesp bajo por encima de lo entregado alarma sin esperar a la respiración siguiente', () => {
    // A 5 /min una respiración dura 12 s. Confirmar un límite que el paciente ya incumple y ver la banda en verde
    // durante doce segundos enseña lo contrario de lo que la maniobra existe para enseñar.
    const sim = ventilando(5);
    const vte = sim.frame().metrics.vte?.value as number;
    expect(vte).toBeGreaterThan(0);
    expect(activa(sim, 'vteLow')).toBe(false);
    const t0 = sim.simTimeMs;
    expect(sim.command({ type: 'setAlarmLimits', changes: { vteLow: porEncimaDelVte(sim) } }).accepted).toBe(true);
    sim.step();
    expect(activa(sim, 'vteLow'), `${(sim.simTimeMs - t0) / 1000} s tras confirmar el límite`).toBe(true);
    expect(sim.frame().alarmBar.color).not.toBe('green');
  });

  it('bajarlo otra vez lo resuelve igual de rápido', () => {
    const sim = ventilando(5);
    expect(sim.command({ type: 'setAlarmLimits', changes: { vteLow: porEncimaDelVte(sim) } }).accepted).toBe(true);
    sim.step();
    expect(activa(sim, 'vteLow')).toBe(true);
    sim.command({ type: 'setAlarmLimits', changes: { vteLow: 0.05 } });
    sim.step();
    expect(activa(sim, 'vteLow')).toBe(false);
  });

  it('en espera no se inventa una alarma con la última respiración de antes', () => {
    // Sin monitorización no hay dato que comparar: el límite se guarda y no activa nada (D QRG p.14).
    const sim = ventilando(15);
    const limite = porEncimaDelVte(sim);
    expect(sim.command({ type: 'enterStandby' }).accepted).toBe(true);
    expect(sim.command({ type: 'setAlarmLimits', changes: { vteLow: limite } }).accepted).toBe(true);
    sim.step();
    expect(activa(sim, 'vteLow')).toBe(false);
  });
});

describe('R7-04 · lo que la tarea dice que se verá es lo que se ve', () => {
  /** Aplica la perturbación programada del escenario como lo hace el panel docente. */
  function conPerturbacion(id: string, tras: number): Simulator {
    const e = SCENARIOS.find((s) => s.id === id)!;
    const sim = escenario(id);
    runUntilBreath(sim, 4);
    sim.command({ type: 'setPatient', params: e.perturbations![0]!.patient! });
    runUntilBreath(sim, tras);
    return sim;
  }
  function meseta(sim: Simulator): { valida: boolean; pplat: number | null } {
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    for (let i = 0; i < 200_000 && !sim.frame().procedure.last.inspHold; i++) sim.step();
    const h = sim.frame().procedure.last.inspHold!;
    return { valida: h.quality === 'valid', pplat: h.values.pplat?.value ?? null };
  }

  it('SC-02 · la PEEP que la tarea nombra deja sitio bajo Pmáx; la que descarta, no', () => {
    // La tarea decía «cambia la PEEP» sin más. Con C 20 y Pmáx 40 el margen es de cuatro cmH2O: a PEEP 10 la
    // inspiración termina por Pmáx, el bloqueo deja de ser elegible y el objetivo anterior se vuelve inalcanzable.
    const base = meseta(conPerturbacion('SC-02', 8));
    expect(base.valida).toBe(true);

    const subida = conPerturbacion('SC-02', 8);
    expect(subida.command({ type: 'confirmSettings', changes: { peep: 8 } }).accepted).toBe(true);
    runUntilBreath(subida, 14);
    const conPeep8 = meseta(subida);
    expect(conPeep8.valida).toBe(true);
    // Sube exactamente lo que subió la PEEP: es la afirmación que la tarea hace.
    expect((conPeep8.pplat as number) - (base.pplat as number)).toBeCloseTo(3, 1);

    const alta = conPerturbacion('SC-02', 8);
    expect(alta.command({ type: 'confirmSettings', changes: { peep: 10 } }).accepted).toBe(true);
    runUntilBreath(alta, 14);
    expect(meseta(alta).valida, 'a PEEP 10 el bloqueo ya no es elegible').toBe(false);

    const texto = SCENARIOS.find((e) => e.id === 'SC-02')!.lesson!.tasks.find((t) => t.id === 'peep')!.text;
    expect(texto, 'la tarea tiene que nombrar la PEEP que sí cabe').toContain('8');
  });

  it('SC-13 · en PC el VT que devuelve I:E 1:1 es el de la mecánica nueva, no el de antes', () => {
    // La tarea invitaba a ver el VT «acercarse a C·ΔP = 500 mL». Con la R ya doblada, I:E 1:1 son dos constantes de
    // tiempo: el VT vuelve a ~430 mL y ahí se queda. Prometer 500 es prometer lo que el propio escenario impide.
    const sim = conPerturbacion('SC-13', 14);
    const tras = (sim.frame().metrics.vte?.value as number) * 1000;
    expect(tras, 'la R doblada tiene que bajar el VT').toBeLessThan(340);

    expect(sim.command({ type: 'confirmSettings', changes: { ie: 1 } }).accepted).toBe(true);
    runUntilBreath(sim, 26);
    const conIe1 = (sim.frame().metrics.vte?.value as number) * 1000;
    expect(conIe1).toBeGreaterThan(tras + 80);
    expect(conIe1, `I:E 1:1 da ${conIe1.toFixed(0)} mL, no 500`).toBeLessThan(460);
  });
});
