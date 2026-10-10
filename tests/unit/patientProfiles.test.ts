import { describe, expect, it } from 'vitest';
import { matchesProfile, PATIENT_PROFILES, profileHint, profileState } from '../../src/ui/patientProfiles';

describe('Perfiles del paciente', () => {
  it('resuelve los escenarios de referencia y coincide con cada estado propio', () => {
    expect(PATIENT_PROFILES).toHaveLength(6);
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
});
