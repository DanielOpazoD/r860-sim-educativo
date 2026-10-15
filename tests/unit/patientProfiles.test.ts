import { describe, expect, it } from 'vitest';
import { Simulator } from '../../src/engine/simulator';
import { defaultInit, REFERENCE_PROFILE } from '../../src/profiles';
import type { VentMode } from '../../src/domain/types';
import { frRespaldoQueCede, matchesProfile, PATIENT_PROFILES, profileHint, profileShort, profileState } from '../../src/ui/patientProfiles';

describe('Perfiles del paciente', () => {
  it('resuelve los escenarios de referencia y coincide con cada estado propio', () => {
    expect(PATIENT_PROFILES.map((profile) => profile.label)).toEqual([
      'Sano, sedado',
      'Restrictivo',
      'Obstructivo',
      'Esfuerzo normal',
      'Esfuerzo débil',
    ]);
    for (const profile of PATIENT_PROFILES) {
      const state = profileState(profile);
      expect(matchesProfile(state.patient, state.effort, profile)).toBe(true);
      expect(matchesProfile({ ...state.patient, crs: state.patient.crs + 1e-6 }, state.effort, profile)).toBe(false);
    }
  });

  it('compara ignorando claves indefinidas y con tolerancia numérica', () => {
    const profile = PATIENT_PROFILES[0]!;
    const state = profileState(profile);
    expect(
      matchesProfile(
        { ...state.patient, crs: state.patient.crs + 5e-10, sigmoid: undefined },
        { ...state.effort, reverse: undefined },
        profile,
      ),
    ).toBe(true);
  });

  it('genera hints desde los parámetros del escenario', () => {
    const stiff = PATIENT_PROFILES.find((profile) => profile.id === 'stiff')!;
    expect(profileHint(stiff)).toContain('C 25');
  });

  it('resume bajo el nombre lo que define al perfil: C y R si es pasivo, el esfuerzo si respira', () => {
    const corto = (id: string): string => profileShort(PATIENT_PROFILES.find((profile) => profile.id === id)!);
    expect(corto('healthy')).toBe('C 50 · R 10');
    expect(corto('obstructive')).toBe('C 60 · R 15/25');
    expect(corto('spontaneous')).toBe('Pmus 8 · 15/min');
  });
});

describe('PRF-01 · el perfil que respira lleva el ritmo en A/C', () => {
  const perfil = (id: string) => PATIENT_PROFILES.find((profile) => profile.id === id)!;
  it('sólo «Esfuerzo normal» pide FR: 12/min, cuyo ciclo (5 s) supera su período más largo (4 s + 20 % = 4,8 s)', () => {
    expect(frRespaldoQueCede(perfil('spontaneous'))).toBe(12);
    for (const id of ['healthy', 'stiff', 'obstructive', 'weak']) expect(frRespaldoQueCede(perfil(id))).toBeNull();
  });

  // Cinco minutos de «Esfuerzo normal» en A/C con tres semillas: respiraciones mandatorias y apiladas (Te < 0,8 s).
  function ventilar(mode: VentMode, rr: number): { mandatorias: number; apiladas: number } {
    const { patient, effort } = profileState(perfil('spontaneous'));
    let mandatorias = 0,
      apiladas = 0;
    for (const seed of [1, 2, 3]) {
      const sim = new Simulator(defaultInit({ seed, patient: { ...patient }, effort: { ...effort } }), REFERENCE_PROFILE);
      expect(sim.command({ type: 'confirmSettings', changes: { mode, rr } }).accepted).toBe(true);
      sim.run(300_000);
      const registradas = sim.breaths.slice(3);
      mandatorias += registradas.filter((b) => b.type === 'mandatory').length;
      apiladas += registradas.filter((b) => b.tExpS < 0.8).length;
    }
    return { mandatorias, apiladas };
  }
  it.each(['AC_VC', 'AC_PC'] as VentMode[])('%s con FR 12: el paciente dispara todas y ninguna se apila', (mode) => {
    expect(ventilar(mode, 12)).toEqual({ mandatorias: 0, apiladas: 0 });
  });
  it.each(['AC_VC', 'AC_PC'] as VentMode[])('%s con la FR 15 por omisión sí se apilan: la prueba mide algo', (mode) => {
    expect(ventilar(mode, 15).apiladas).toBeGreaterThan(5);
  });
});
