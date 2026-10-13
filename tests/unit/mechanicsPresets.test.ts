import { describe, expect, it } from 'vitest';
import { TISSUE_PRESETS, TUBE_PRESETS } from '../../src/domain/mechanicsPresets';
import { PATIENT_EXTRA, PATIENT_MAIN, PHYS } from '../../src/ui/patientControls';

// PRE · presets de referencia (U-37): datos sanos, dentro de los rangos de los deslizadores, y 'none' = por omisión.
describe('PRE · presets de mecánica del paciente', () => {
  it('K₂ crece al bajar el diámetro del TET', () => {
    const conTubo = TUBE_PRESETS.filter((p) => p.id !== 'none');
    for (let i = 1; i < conTubo.length; i++)
      expect((conTubo[i] as { r2: number }).r2).toBeGreaterThan((conTubo[i - 1] as { r2: number }).r2);
  });

  it('todos los presets caben en los rangos de sus deslizadores', () => {
    for (const p of TISSUE_PRESETS) {
      expect(p.eVisc).toBeGreaterThanOrEqual(PHYS.viscoelastic!.min);
      expect(p.eVisc).toBeLessThanOrEqual(PHYS.viscoelastic!.max);
      expect(p.tauViscS).toBeGreaterThanOrEqual(PHYS.viscTau!.min);
      expect(p.tauViscS).toBeLessThanOrEqual(PHYS.viscTau!.max);
    }
    for (const p of TUBE_PRESETS) {
      expect(p.r2).toBeGreaterThanOrEqual(PHYS.rohrer!.min);
      expect(p.r2).toBeLessThanOrEqual(PHYS.rohrer!.max);
    }
  });

  it('los grupos de paciente cubren cada control fisiológico exactamente una vez', () => {
    const keys = [...PATIENT_MAIN, ...PATIENT_EXTRA];
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(Object.keys(PHYS).sort());
  });

  it("'none' reproduce los valores por omisión (sin viscoelasticidad, sin tubo)", () => {
    expect(TISSUE_PRESETS[0]!.eVisc).toBe(0);
    expect(TUBE_PRESETS[0]!.r2).toBe(0);
    expect(TISSUE_PRESETS[0]!.id).toBe('none');
    expect(TUBE_PRESETS[0]!.id).toBe('none');
  });
});

// En un pulmón con curva sigmoidea la presión elástica sale de la curva: el control C la escala (antes no hacía nada).
describe('PRE · el control de compliance actúa también sobre la curva sigmoidea', () => {
  it('duplicar C duplica la capacidad de la curva y conserva sus codos', () => {
    const patient = { crs: 0.028, rInsp: 10, rExp: 10, r2: 0, p0: 0, sigmoid: { b: 2.2, c: 4, d: 14 } };
    const fr = { truth: { patient } } as unknown as never;
    const cmd = PHYS.compliance!.cmd(56, fr) as { type: string; params: { crs: number; sigmoid: { b: number; c: number; d: number } } };
    expect(cmd.params.crs).toBeCloseTo(0.056, 9);
    expect(cmd.params.sigmoid.b).toBeCloseTo(4.4, 9);
    expect(cmd.params.sigmoid.c).toBe(4);
    expect(cmd.params.sigmoid.d).toBe(14);
    // Sin curva, como siempre.
    const lineal = PHYS.compliance!.cmd(40, { truth: { patient: { ...patient, sigmoid: undefined } } } as never) as { params: object };
    expect(lineal.params).toEqual({ crs: 0.04 });
  });
});
