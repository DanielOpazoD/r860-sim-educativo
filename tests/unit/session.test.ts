import { describe, expect, it } from 'vitest';
import { exportSession, importSession, replaySession } from '../../src/history/session';
import { benchSim, runUntilBreath, BENCH_PATIENT } from '../helpers';

describe('TIM · reproducibilidad', () => {
  it('TIM-02: misma inicialización y comandos → mismos registros de respiración', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, rExp: 25 } });
    runUntilBreath(sim, 2);
    sim.command({ type: 'confirmSettings', changes: { peep: 8, vt: 0.45 } });
    runUntilBreath(sim, 4);
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    runUntilBreath(sim, 7);
    sim.command({ type: 'setPatient', params: { crs: 0.03 } }, 'instructor');
    runUntilBreath(sim, 10);
    const file = exportSession(sim);
    const text = JSON.stringify(file);
    const imp = importSession(text);
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    const re = replaySession(imp.session);
    expect(re.breaths.length).toBe(sim.breaths.length);
    for (let i = 0; i < sim.breaths.length; i++) {
      const a = sim.breaths[i]!,
        b = re.breaths[i]!;
      expect(b.vtInsp).toBeCloseTo(a.vtInsp, 12);
      expect(b.ppeak).toBeCloseTo(a.ppeak, 12);
      expect(b.endSimTimeMs).toBe(a.endSimTimeMs);
    }
    expect(re.procedures.last.inspHold!.values.pplat!.value).toBe(sim.procedures.last.inspHold!.values.pplat!.value);
  });
  it('TIM-01: la cadencia de lectura de cuadros no altera la fisiología', () => {
    const a = benchSim();
    const b = benchSim();
    for (let i = 0; i < 5000; i++) {
      a.step();
      if (i % 4 === 0) a.frame();
    }
    for (let i = 0; i < 5000; i++) {
      b.step();
      if (i % 16 === 0) b.frame();
    }
    expect(a.breaths.length).toBe(b.breaths.length);
    expect(a.breaths[3]!.pmean).toBe(b.breaths[3]!.pmean);
  });
});

describe('SEC-03 · importación robusta', () => {
  it('rechaza JSON malformado, tamaño excesivo, comandos no permitidos, números no finitos y claves desconocidas', () => {
    expect(importSession('{').ok).toBe(false);
    expect(importSession('x'.repeat(3 * 1024 * 1024)).ok).toBe(false);
    const sim = benchSim();
    runUntilBreath(sim, 1);
    const good = exportSession(sim);
    const evil = JSON.parse(JSON.stringify(good));
    evil.commands.push({ simTimeMs: 1, actor: 'learner', command: { type: 'eval', code: 'alert(1)' } });
    const r1 = importSession(JSON.stringify(evil));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.errors.join(' ')).toMatch(/no permitido/);
    const nan = JSON.stringify(good).replace('"dtMs":4', '"dtMs":"NaN"');
    expect(importSession(nan).ok).toBe(false);
    const extra = { ...good, script: '<script>' };
    expect(importSession(JSON.stringify(extra)).ok).toBe(false);
    const other = { ...good, schemaVersion: '9.9.9' };
    expect(importSession(JSON.stringify(other)).ok).toBe(false);
  });

  it('rechaza un paciente incompleto y campos opcionales nulos sin lanzar excepciones (auditoría)', () => {
    const sim = benchSim();
    runUntilBreath(sim, 1);
    const good = exportSession(sim);
    // Objeto presente pero sin las magnitudes obligatorias: `Object.entries` no ve las claves ausentes y el
    // integrador habría trabajado con undefined.
    const pacienteIncompleto = JSON.parse(JSON.stringify(good)) as { init: { patient: unknown } };
    pacienteIncompleto.init.patient = { crs: 0.05 };
    const r1 = importSession(JSON.stringify(pacienteIncompleto));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.errors.join(' ')).toMatch(/rInsp|rExp|r2|p0/);
    // Campos opcionales nulos: antes el validador desestructuraba el null y la importación lanzaba TypeError
    // (en el Worker eso se veía como fallo del motor); ahora es un motivo de rechazo legible.
    const nulos = JSON.parse(JSON.stringify(good)) as { init: { effort: Record<string, unknown> } };
    nulos.init.effort.variability = null;
    nulos.init.effort.reverse = null;
    const r2 = importSession(JSON.stringify(nulos));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors.join(' ')).toMatch(/variabilidad|reverso/);
  });

  it('la reproducción hasta t no aplica comandos previstos para después de t', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    sim.run(Math.max(0, 60_000 - sim.simTimeMs)); // manda a t ≈ 60 s
    const rrAntes = sim.controller.settings.rr;
    const r = sim.command({ type: 'confirmSettings', changes: { rr: rrAntes + 4 } }, 'instructor');
    expect(r.accepted).toBe(true);
    sim.run(500);
    const file = exportSession(sim);
    // Reproducir sólo hasta los 30 s no puede ejecutar el ajuste de los 60 s (antes el vaciado final lo aplicaba
    // igual: con untilMs=30 s salía el confirmSettings de los 60 s en el registro).
    const corta = replaySession(file, 30_000);
    expect(corta.commandLog.some((c) => c.command.type === 'confirmSettings')).toBe(false);
    const entera = replaySession(file);
    expect(entera.commandLog.some((c) => c.command.type === 'confirmSettings')).toBe(true);
  });
});
