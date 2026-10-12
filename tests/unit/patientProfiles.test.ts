import { describe, expect, it } from 'vitest';
import { matchesProfile, PATIENT_PROFILES, profileHint, profileShort, profileState } from '../../src/ui/patientProfiles';

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
