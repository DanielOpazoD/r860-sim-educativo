import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { exportSession, importSession, replaySession } from '../../src/history/session';
import { DEFAULT_PROFILE, REFERENCE_PROFILE, defaultInit, findProfile, profileFor } from '../../src/profiles';
import { benchSim, runUntilBreath } from '../helpers';

describe('ARQ-01 · perfil inyectado en el motor', () => {
  it('defaultInit declara el perfil; profileFor resuelve el de referencia y rechaza ids desconocidos', () => {
    expect(defaultInit().profileId).toBe(REFERENCE_PROFILE.profileId);
    expect(profileFor({ profileId: undefined })).toBe(DEFAULT_PROFILE);
    expect(findProfile('otro')).toBeNull();
    expect(() => profileFor({ profileId: 'otro' })).toThrow(/Perfil desconocido/);
  });
  it('el motor rechaza una inicialización cuyo profileId no coincide con el perfil inyectado', () => {
    expect(() => new Simulator({ ...defaultInit(), profileId: 'otro' }, REFERENCE_PROFILE)).toThrow(/perfil otro/);
  });
  it('el motor usa las reglas del perfil inyectado (no un módulo concreto)', () => {
    const strict = { ...REFERENCE_PROFILE, profileId: 'estricto', crossLimits: { ...REFERENCE_PROFILE.crossLimits, flowMaxLpm: 20 } };
    const init = defaultInit({}, strict);
    expect(() => new Simulator(init, strict)).toThrow(/flujo máximo de 20/);
  });
  it('una sesión sin profileId (anterior a 0.3.3) se importa con el perfil de referencia; un profileId desconocido se rechaza', () => {
    const sim = benchSim();
    runUntilBreath(sim, 1);
    const good = exportSession(sim);
    const legacy = { ...good, init: { ...good.init } } as Record<string, unknown> & { init: Record<string, unknown> };
    delete legacy.init.profileId;
    expect(importSession(JSON.stringify(legacy)).ok).toBe(true);
    const r = importSession(JSON.stringify({ ...good, profileId: 'otro' }));
    expect(r.ok).toBe(false);
    expect((r as { errors: string[] }).errors.join(' ')).toMatch(/profileId desconocido/);
  });
  it('una sesión guardada con el identificador anterior al cambio de nombre se importa y se reproduce igual', () => {
    const sim = benchSim();
    runUntilBreath(sim, 3);
    const good = exportSession(sim);
    const old = 'r860-es-photo-reference-v1';
    expect(REFERENCE_PROFILE.legacyProfileIds).toContain(old);
    const legacy = { ...good, profileId: old, init: { ...good.init, profileId: old } };
    const imp = importSession(JSON.stringify(legacy));
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    expect(replaySession(imp.session).breaths.map((b) => b.vtExp)).toEqual(sim.breaths.map((b) => b.vtExp));
  });
});
