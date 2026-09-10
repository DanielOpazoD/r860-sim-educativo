import { describe, expect, it } from 'vitest';
import type { EngineFrame } from '../../src/engine/simulator';
import { Simulator } from '../../src/engine/simulator';
import { defaultInit, R860_PROFILE } from '../../src/profiles';
import { SCENARIOS, type LessonTask } from '../../src/scenarios';
import { LESSON_TESTS, nextCompletedTask, type LessonContext } from '../../src/ui/lesson';
import { runUntilBreath } from '../helpers';

// Un objetivo que no se puede cumplir es peor que no tener objetivo: el alumno cree que hace mal lo que hace bien.
// Tres escenarios tenían uno —SC-04, SC-05 y SC-17— y, como sólo se evaluaba el primer pendiente, bloqueaban también
// a los que venían detrás: SC-04 quedaba en 0 de 3 alcanzables. Aquí se recorre cada lección haciendo lo que pide.

function simular(id: string) {
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

/** Alumno virtual: acumula banderas como lo hace la interfaz y marca los objetivos que se van cumpliendo. */
class Alumno {
  readonly hechos = new Set<string>();
  readonly flags: Record<string, unknown> = {};
  settingsChangeMs = -1;
  constructor(
    private readonly id: string,
    private readonly tareas: LessonTask[],
  ) {}
  mirar(frame: EngineFrame): void {
    const ctx: LessonContext = {
      frame,
      scenarioId: this.id,
      lessonStartMs: 0,
      patientChangeMs: -1,
      settingsChangeMs: this.settingsChangeMs,
      flags: this.flags,
    };
    for (let i = 0; i < this.tareas.length; i++) {
      const t = nextCompletedTask(this.tareas, this.hechos, ctx);
      if (!t) break;
      this.hechos.add(t.id);
    }
  }
  /** Anota un bloqueo válido como hace el panel de bloqueo, para el objetivo que compara mesetas. */
  anotarBloqueo(frame: EngineFrame): void {
    const h = frame.procedure.last.inspHold;
    if (!h || h.quality !== 'valid' || h.values.pplat?.value === null || h.values.pplat?.value === undefined) return;
    const previos = (this.flags.inspHolds as { d: number; p: number }[] | undefined) ?? [];
    this.flags.inspHolds = [...previos, { d: h.requestedDurationS ?? 0, p: h.values.pplat.value }];
  }
}

/** Corre un bloqueo inspiratorio de la duración pedida y devuelve el cuadro cuando termina. */
function bloqueo(sim: Simulator, durationS: number): EngineFrame {
  sim.command({ type: 'requestHold', kind: 'inspHold', durationS });
  for (let i = 0; i < 80_000 && sim.frame().procedure.current; i++) sim.step();
  for (let i = 0; i < 80_000 && !sim.frame().procedure.last.inspHold; i++) sim.step();
  return sim.frame();
}

describe('OBJ · las lecciones se pueden terminar', () => {
  it('SC-04 · Plimit recorta la entrega: los tres objetivos se cumplen', () => {
    const esc = SCENARIOS.find((s) => s.id === 'SC-04')!;
    const sim = simular('SC-04');
    const a = new Alumno('SC-04', esc.lesson!.tasks);
    runUntilBreath(sim, 4);
    // La perturbación de los 20 s: la resistencia inspiratoria sube.
    sim.command({ type: 'setPatient', params: { rInsp: esc.perturbations?.[0]?.patient?.rInsp as number } });
    runUntilBreath(sim, 12);
    a.mirar(sim.frame());
    // Objetivo 1: el VTesp cae por debajo del programado de forma visible, no por un pelo.
    const vte = (sim.frame().metrics.vte?.value as number) * 1000;
    expect(vte, `VTesp ${vte.toFixed(0)} mL`).toBeLessThan((sim.frame().settings.vt as number) * 900);
    expect(a.hechos.has('observe'), `VTesp ${vte.toFixed(0)} mL contra un umbral de 450`).toBe(true);
    // Objetivo 2: subir Plimit.
    a.flags.plimitChanged = true;
    runUntilBreath(sim, 14);
    a.mirar(sim.frame());
    expect(a.hechos.has('plimit')).toBe(true);
    // Objetivo 3: un bloqueo inspiratorio válido.
    runUntilBreath(sim, 16);
    a.mirar(bloqueo(sim, 3));
    expect(a.hechos.has('hold')).toBe(true);
    expect(a.hechos.size).toBe(esc.lesson!.tasks.length);
  });

  it('SC-05 · esfuerzos que no disparan: los tres objetivos se cumplen', () => {
    const esc = SCENARIOS.find((s) => s.id === 'SC-05')!;
    const sim = simular('SC-05');
    const a = new Alumno('SC-05', esc.lesson!.tasks);
    runUntilBreath(sim, 3);
    a.mirar(sim.frame());
    expect(a.hechos.size, 'sin tocar nada no debería haber ningún objetivo cumplido').toBe(0);
    // Objetivo 1: bajar el disparo por flujo a 1 L/min, que es lo que pide la tarea.
    expect(sim.command({ type: 'confirmSettings', changes: { flowTrigger: 1 / 60 } }).accepted).toBe(true);
    a.settingsChangeMs = sim.simTimeMs;
    // Objetivo 2: basta con conseguir UNA asistida, no con mover la media de ocho respiraciones.
    for (let n = 5; n <= 14; n++) {
      runUntilBreath(sim, n);
      a.mirar(sim.frame());
    }
    const asistidas = sim.breaths.filter((b) => b.type === 'assisted').length;
    expect(asistidas, 'el disparo bajado tiene que producir asistidas').toBeGreaterThan(0);
    expect(a.hechos.has('trig')).toBe(true);
    expect(a.hechos.has('assisted'), `${asistidas} asistidas y el objetivo sin marcar`).toBe(true);
    // Objetivo 3: intentar un bloqueo, válido o no.
    a.mirar(bloqueo(sim, 3));
    expect(a.hechos.size).toBe(esc.lesson!.tasks.length);
  });

  it('SC-19 · presión de soporte: espontáneas, PS a 15 y apnea con recuperación', () => {
    const esc = SCENARIOS.find((s) => s.id === 'SC-19')!;
    const sim = simular('SC-19');
    const a = new Alumno('SC-19', esc.lesson!.tasks);
    runUntilBreath(sim, 6);
    a.mirar(sim.frame());
    expect(sim.breaths.every((b) => b.type === 'spontaneous')).toBe(true);
    expect(a.hechos.has('spont')).toBe(true);
    expect(a.hechos.size, 'PS sigue en 10 y no hubo apnea').toBe(1);
    // Objetivo 2: PS 15 → el VT sube claramente (≈ 750 mL con C 50 y Pmus 8).
    expect(sim.command({ type: 'confirmSettings', changes: { psupport: 15 } }).accepted).toBe(true);
    runUntilBreath(sim, 14);
    a.mirar(sim.frame());
    expect(sim.frame().metrics.vte!.value!).toBeGreaterThan(0.65);
    expect(a.hechos.has('ps')).toBe(true);
    // Objetivo 3: apnea (el evento del panel apaga el esfuerzo) → alarma; deshacerla → espontánea → resuelta.
    expect(sim.command({ type: 'setEffort', params: { enabled: false } }).accepted).toBe(true);
    sim.run(26_000);
    a.mirar(sim.frame());
    expect(sim.alarms.get('apnea')!.conditionActive).toBe(true);
    expect(a.hechos.has('apnea'), 'con la alarma activa el objetivo aún no está cumplido').toBe(false);
    expect(sim.command({ type: 'setEffort', params: { enabled: true } }).accepted).toBe(true);
    sim.run(10_000);
    a.mirar(sim.frame());
    expect(sim.alarms.get('apnea')!.conditionActive).toBe(false);
    expect(a.hechos.has('apnea')).toBe(true);
    expect(a.hechos.size).toBe(esc.lesson!.tasks.length);
  });

  it('SC-20 · ciclado tardío: el Ti supera al esfuerzo hasta subir el ciclaje al 50 %', () => {
    const esc = SCENARIOS.find((s) => s.id === 'SC-20')!;
    const sim = simular('SC-20');
    const a = new Alumno('SC-20', esc.lesson!.tasks);
    runUntilBreath(sim, 6);
    a.mirar(sim.frame());
    const ti = sim.breaths.at(-1)!.tInspS;
    expect(ti, `Ti ${ti.toFixed(2)} s frente a un esfuerzo de 0,6 s`).toBeGreaterThan(0.9);
    expect(a.hechos.has('late')).toBe(true);
    expect(a.hechos.size).toBe(1);
    expect(sim.command({ type: 'confirmSettings', changes: { expTriggerPct: 0.5 } }).accepted).toBe(true);
    runUntilBreath(sim, 12);
    a.mirar(sim.frame());
    const ti2 = sim.breaths.at(-1)!.tInspS;
    expect(ti2, `Ti ${ti2.toFixed(2)} s con ciclaje al 50 %`).toBeLessThan(0.7);
    expect(a.hechos.has('ets')).toBe(true);
    expect(a.hechos.has('fixed')).toBe(true);
    expect(a.hechos.size).toBe(esc.lesson!.tasks.length);
  });

  it('SC-17 · pendelluft: la meseta corta que se pide es una que el equipo acepta', () => {
    const esc = SCENARIOS.find((s) => s.id === 'SC-17')!;
    const sim = simular('SC-17');
    const a = new Alumno('SC-17', esc.lesson!.tasks);
    runUntilBreath(sim, 3);
    // Una oclusión de 2 s no da meseta válida en este pulmón: la presión sigue cayendo. Eso es correcto y por eso la
    // tarea pide 4 s, que es la más corta que el equipo da por asentada.
    const corta2 = bloqueo(sim, 2);
    expect(corta2.procedure.last.inspHold?.quality).toBe('invalid');

    runUntilBreath(sim, 8);
    const corta = bloqueo(sim, 4);
    expect(corta.procedure.last.inspHold?.quality).toBe('valid');
    a.anotarBloqueo(corta);
    a.mirar(corta);
    expect(a.hechos.has('corto')).toBe(true);

    runUntilBreath(sim, 14);
    const larga = bloqueo(sim, 15);
    expect(larga.procedure.last.inspHold?.quality).toBe('valid');
    a.anotarBloqueo(larga);
    a.mirar(larga);
    const pCorta = corta.procedure.last.inspHold!.values.pplat!.value as number;
    const pLarga = larga.procedure.last.inspHold!.values.pplat!.value as number;
    expect(pLarga, `corta ${pCorta} · larga ${pLarga}`).toBeLessThan(pCorta - 0.5);
    expect(a.hechos.has('largo')).toBe(true);

    a.flags.truthOpen = true;
    a.mirar(sim.frame());
    expect(a.hechos.size).toBe(esc.lesson!.tasks.length);
  });

  it('un objetivo que no se cumple ya no bloquea a los que vienen detrás', () => {
    // La regla anterior evaluaba sólo el primer pendiente y devolvía sin mirar los demás, así que un objetivo
    // imposible dejaba muertos a todos los siguientes: SC-04 quedaba en 0 de 3 alcanzables.
    const tareas: LessonTask[] = [
      { id: 'imposible', text: 'nunca', test: 'noExisteEsteTest' as never },
      { id: 'alcanzable', text: 'sí', test: 'truthOpen' },
    ];
    const sim = simular('SC-01');
    runUntilBreath(sim, 2);
    const ctx: LessonContext = {
      frame: sim.frame(),
      scenarioId: 'SC-01',
      lessonStartMs: 0,
      patientChangeMs: -1,
      settingsChangeMs: -1,
      flags: { truthOpen: true },
    };
    expect(LESSON_TESTS['noExisteEsteTest']).toBeUndefined();
    expect(nextCompletedTask(tareas, new Set(), ctx)?.id).toBe('alcanzable');
  });
  it('SC-09 · la lección de alarmas sigue siendo terminable con los límites puestos', () => {
    // Con límites configurados, un ventilador que entrega 0 mL alarma por Pmáx y además por VTesp y VMesp bajos. La
    // banda no vuelve a verde hasta reconocer también esas dos: el objetivo «vuelve a verde» tiene que seguir siendo
    // alcanzable, que es justo lo que se rompió en otros escenarios.
    const esc = SCENARIOS.find((s) => s.id === 'SC-09')!;
    const sim = simular('SC-09');
    const a = new Alumno('SC-09', esc.lesson!.tasks);
    runUntilBreath(sim, 4);
    sim.command({ type: 'setPatient', params: { rInsp: esc.perturbations?.[0]?.patient?.rInsp as number } });
    for (let n = 6; n <= 16; n++) runUntilBreath(sim, n);
    expect(
      sim.frame().alarms.some((x) => x.conditionActive),
      'la perturbación tiene que alarmar',
    ).toBe(true);
    a.flags.alarmSeen = true; // el alumno abre la lista con la alarma activa
    a.mirar(sim.frame());
    expect(a.hechos.has('alarm')).toBe(true);
    sim.command({ type: 'acknowledgeAlarms' });
    a.mirar(sim.frame());
    expect(a.hechos.has('ack')).toBe(true);
    // Deshacer el evento y reconocer lo que se activó después: la banda vuelve a verde.
    sim.command({ type: 'setPatient', params: { rInsp: esc.patient.rInsp } });
    for (let n = 18; n <= 34; n++) runUntilBreath(sim, n);
    sim.command({ type: 'acknowledgeAlarms' });
    for (let n = 35; n <= 38; n++) runUntilBreath(sim, n);
    a.mirar(sim.frame());
    expect(
      sim.frame().alarmBar.color,
      JSON.stringify(sim.frame().alarms.map((x) => [x.id, x.conditionActive, x.acknowledgedAtMs !== null])),
    ).toBe('green');
    expect(a.hechos.size).toBe(esc.lesson!.tasks.length);
  });
});

describe('ALM · los límites por omisión vigilan sin molestar', () => {
  it('ninguno viene en Off salvo la PEEP espiratoria, como en las fotografías', () => {
    // Un ventilador de enseñanza cuyo estado inicial es «no se evalúa ninguna alarma» enseña lo contrario de lo que
    // debe: el alumno nunca se topa con una alarma que no haya provocado él a propósito.
    const l = defaultInit({}).alarmLimits;
    const enOff = Object.entries(l)
      .filter(([, v]) => v === 'off')
      .map(([k]) => k);
    expect(enOff.sort()).toEqual(['peepeHigh', 'peepeLow']);
  });

  it('sólo el escenario de asincronías alarma, y por lo que debe', () => {
    // Los valores están dimensionados sobre los ajustes por omisión. Esta prueba fija el resultado del ajuste: que
    // trece escenarios recorran su lección sin ruido y que el del doble disparo sí avise.
    const ruidosos: string[] = [];
    for (const e of SCENARIOS) {
      if (e.id === 'SC-P') continue;
      const base = defaultInit({});
      const sim = new Simulator(
        defaultInit({
          patient: { ...e.patient },
          effort: { ...e.effort },
          sensors: { ...e.sensors },
          settings: { ...base.settings, ...(e.settings ?? {}) },
          alarmLimits: { ...base.alarmLimits, ...(e.alarmLimits ?? {}) },
          initialV: e.initialV ?? 'equilibrium',
        }),
        R860_PROFILE,
      );
      const vistas = new Set<string>();
      for (let n = 6; n <= 22; n++) {
        runUntilBreath(sim, n);
        for (const a of sim.frame().alarms) if (a.conditionActive) vistas.add(a.id);
      }
      if (vistas.size) ruidosos.push(`${e.id}: ${[...vistas].sort().join(',')}`);
    }
    expect(ruidosos).toEqual(['SC-18: ppeakLow,vteHigh,vteLow']);
  });
});
