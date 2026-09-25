import { describe, expect, it } from 'vitest';
import { TISSUE_PRESETS, TUBE_PRESETS } from '../../src/ui/mechanicsPresets';
import { PHYS } from '../../src/ui/patientControls';

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

  it("'none' reproduce los valores por omisión (sin viscoelasticidad, sin tubo)", () => {
    expect(TISSUE_PRESETS[0]!.eVisc).toBe(0);
    expect(TUBE_PRESETS[0]!.r2).toBe(0);
    expect(TISSUE_PRESETS[0]!.id).toBe('none');
    expect(TUBE_PRESETS[0]!.id).toBe('none');
  });
});
