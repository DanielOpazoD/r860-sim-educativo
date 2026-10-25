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
    expect(corto('weak')).toBe('Pmus 3 · 20/min');
  });
});

describe('PRF-02 · «Esfuerzo débil»: esfuerzos que se ven y no disparan', () => {
  const { patient, effort } = profileState(PATIENT_PROFILES.find((profile) => profile.id === 'weak')!);
  // Con y sin músculo, la misma programación: la diferencia de las curvas es lo que el alumno ve del esfuerzo.
  function medir(settings: { rr: number; flowTrigger: number }) {
    const base = defaultInit();
    const crear = (amplitude: number) =>
      new Simulator(
        defaultInit({ patient: { ...patient }, effort: { ...effort, amplitude }, settings: { ...base.settings, ...settings } }),
        REFERENCE_PROFILE,
      );
    const con = crear(effort.amplitude),
      sin = crear(0);
    let dPaw = 0,
      dFlujo = 0;
    for (let i = 0; i < 90_000 / 4; i++) {
      con.step();
      sin.step();
      const a = con.frame().samples,
        b = sin.frame().samples;
      for (let k = 0; k < Math.min(a.t.length, b.t.length); k++) {
        dPaw = Math.max(dPaw, Math.abs(a.paw[k]! - b.paw[k]!));
        dFlujo = Math.max(dFlujo, Math.abs(a.flow[k]! - b.flow[k]!) * 60);
      }
    }
    return { asistidas: con.breaths.filter((b) => b.type !== 'mandatory').length, dPaw, dFlujo, peepi: con.frame().truth.peepiEndExp };
  }
  it.each([
    ['el banco (FR 15, disparo 2 L/min)', { rr: 15, flowTrigger: 2 / 60 }],
    ['SC-05 (FR 12, disparo 3 L/min)', { rr: 12, flowTrigger: 3 / 60 }],
  ])('con %s ningún esfuerzo dispara, pero mueve la presión y el flujo', (_, settings) => {
    const m = medir(settings);
    expect(m.asistidas).toBe(0);
    expect(m.dPaw).toBeGreaterThan(2);
    expect(m.dFlujo).toBeGreaterThan(3);
    expect(m.peepi).toBeGreaterThan(1);
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
