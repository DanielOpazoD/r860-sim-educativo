import { describe, expect, it } from 'vitest';
import type { VcSettings } from '../../src/domain/types';
import { BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// La PEEPe se mide antes de que el esfuerzo de disparo hunda la Pva, como hace el ventilador real.
const PS: VcSettings = {
  ...BENCH_SETTINGS,
  mode: 'CPAP_PS',
  peep: 5,
  psupport: 10,
  expTriggerPct: 0.25,
  riseMs: 100,
  flowTrigger: 2 / 60,
  biasFlow: 4 / 60,
  minRate: 'off',
  apneaTimeS: 20,
  backupPinsp: 12,
  backupTinspS: 1,
};

describe('PEEPe medida antes de la deflexión de disparo', () => {
  it('CPAP/PS con esfuerzo: la PEEPe queda en la PEEP programada, no en el fondo del valle de disparo', () => {
    const sim = benchSim({ settings: PS, effort: { enabled: true, amplitude: 8, ratePerMin: 15, tiS: 0.8, phaseS: 0.5 } });
    sim.run(20_000);
    const b = sim.breaths.at(-1)!;
    expect(b.type).toBe('spontaneous');
    expect(Math.abs(b.peepe - 5)).toBeLessThan(0.5);
  });

  it('banco pasivo A/C VC: la PEEPe sigue en la PEEP programada (sin regresión)', () => {
    const sim = benchSim();
    runUntilBreath(sim, 5);
    expect(Math.abs(sim.breaths.at(-1)!.peepe - 5)).toBeLessThan(0.3);
  });
});
