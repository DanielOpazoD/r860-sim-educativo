import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { exportSession, importSession } from '../../src/history/session';
import { DEFAULT_PROFILE, R860_PROFILE, defaultInit, findProfile, profileFor } from '../../src/profiles';
import { benchSim, runUntilBreath } from '../helpers';

describe('ARQ-01 · perfil inyectado en el motor', () => {
  it('defaultInit declara el perfil; profileFor resuelve el de referencia y rechaza ids desconocidos', () => {
    expect(defaultInit().profileId).toBe(R860_PROFILE.profileId);
    expect(profileFor({ profileId: undefined })).toBe(DEFAULT_PROFILE);
    expect(findProfile('otro')).toBeNull();
    expect(() => profileFor({ profileId: 'otro' })).toThrow(/Perfil desconocido/);
  });
  it('el motor rechaza una inicialización cuyo profileId no coincide con el perfil inyectado', () => {
    expect(() => new Simulator({ ...defaultInit(), profileId: 'otro' }, R860_PROFILE)).toThrow(/perfil otro/);
  });
  it('el motor usa las reglas del perfil inyectado (no un módulo concreto)', () => {
    const strict = { ...R860_PROFILE, profileId: 'estricto', crossLimits: { ...R860_PROFILE.crossLimits, flowMaxLpm: 20 } };
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
});
