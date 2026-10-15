import { describe, expect, it } from 'vitest';
import { ACCEPTED_ENGINE_VERSIONS, ENGINE_VERSION } from '../../src/engine/version';
import { exportSession, importSession, replaySession } from '../../src/history/session';
import { findScenario } from '../../src/scenarios';
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

  it('setPatient y setEffort reemplazan mecánica opcional y se reproducen desde la sesión', () => {
    const sc01 = findScenario('SC-01')!,
      sc19 = findScenario('SC-19')!,
      sc25 = findScenario('SC-25')!;
    const sim = benchSim({
      patient: {
        ...BENCH_PATIENT,
        sigmoid: { b: 1.6, c: 18, d: 5 },
        recruit: { frac: 0.6, pOpen: 28, pClose: 9, tauOpenS: 0.6, tauCloseS: 8 },
        second: { crs: 0.03, rInsp: 8, rExp: 8 },
      },
    });

    expect(sim.command({ type: 'setPatient', params: { crs: 0.04 } }).accepted).toBe(true);
    expect(sim.frame().truth.patient.sigmoid).toBeDefined();
    expect(sim.command({ type: 'setPatient', params: { ...sc01.patient }, replace: true }).accepted).toBe(true);
    expect(sim.frame().truth.patient.sigmoid).toBeUndefined();
    expect(sim.frame().truth.patient.recruit).toBeUndefined();
    expect(sim.frame().truth.patient.second).toBeUndefined();
    expect(sim.command({ type: 'setEffort', params: { reverse: { amplitude: 8, delayS: 0.5 } } }).accepted).toBe(true);
    expect(sim.frame().truth.effort.reverse).toBeDefined();
    expect(sim.frame().truth.effort.enabled).toBe(false);
    expect(sim.command({ type: 'setPatient', params: { ...sc25.patient }, replace: true }).accepted).toBe(true);
    expect(sim.command({ type: 'setEffort', params: { ...sc19.effort }, replace: true }).accepted).toBe(true);
    expect(sim.frame().truth.effort.reverse).toBeUndefined();
    sim.run(1000);

    const imported = importSession(JSON.stringify(exportSession(sim)));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    const replay = replaySession(imported.session);
    expect(replay.frame().truth.patient).toEqual(sim.frame().truth.patient);
    expect(replay.frame().truth.effort).toEqual(sim.frame().truth.effort);
  });

  it('rechaza reemplazos parciales de paciente y esfuerzo', () => {
    const sim = benchSim();
    expect(sim.command({ type: 'setPatient', params: { crs: 0.03 }, replace: true }).accepted).toBe(false);
    expect(sim.command({ type: 'setEffort', params: { enabled: true }, replace: true }).accepted).toBe(false);
  });
});

describe('VER-01 · la versión del motor de una sesión decide si se importa y con qué aviso (U-46)', () => {
  const sesion = (): ReturnType<typeof exportSession> => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    return exportSession(sim);
  };
  const importar = (s: object) => importSession(JSON.stringify(s));

  it('una sesión de este motor se importa sin aviso', () => {
    const r = importar(sesion());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toEqual([]);
  });

  it('una de un motor anterior aceptado se importa y se reproduce, avisando que puede no ser idéntica', () => {
    const anteriores = ACCEPTED_ENGINE_VERSIONS.filter((v) => v !== ENGINE_VERSION);
    expect(anteriores).toEqual(['0.2.0', '0.3.0', '0.4.0']);
    const buena = sesion();
    for (const v of anteriores) {
      const r = importar({ ...buena, engineVersion: v });
      expect(r.ok, v).toBe(true);
      if (!r.ok) continue;
      expect(r.warnings).toHaveLength(1);
      expect(r.warnings[0]).toContain(`motor ${v} y reproducida con el ${ENGINE_VERSION}`);
      expect(r.warnings[0]).toContain('la reproducción puede no ser idéntica');
      expect(replaySession(r.session).breaths.length).toBe(buena.breaths.length);
    }
  });

  it('una de un motor desconocido se rechaza diciendo cuáles se aceptan', () => {
    const buena = sesion();
    for (const v of ['0.1.0', '0.5.0', '0.6.2', '9.9.9', '']) {
      const r = importar({ ...buena, engineVersion: v });
      expect(r.ok, v).toBe(false);
      if (!r.ok)
        expect(r.errors.join(' ')).toContain(`engineVersion no soportada: ${v} (se aceptan ${ACCEPTED_ENGINE_VERSIONS.join(', ')})`);
    }
  });

  it('una sin versión del motor se rechaza: no se sabe con qué física se grabó', () => {
    const { engineVersion: _v, ...sinVersion } = sesion();
    for (const s of [sinVersion, { ...sinVersion, engineVersion: 0.4 }, { ...sinVersion, engineVersion: null }]) {
      const r = importar(s);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.join(' ')).toMatch(/engineVersion ausente/);
    }
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

  it('rechaza replace no booleano en comandos de sesión importados', () => {
    const sim = benchSim();
    runUntilBreath(sim, 1);
    const bad = JSON.parse(JSON.stringify(exportSession(sim))) as { finalSimTimeMs: number; commands: unknown[] };
    bad.commands.push({
      simTimeMs: bad.finalSimTimeMs,
      actor: 'instructor',
      command: { type: 'setPatient', params: { ...BENCH_PATIENT }, replace: 'yes' },
    });
    const result = importSession(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('replace debe ser booleano');
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
