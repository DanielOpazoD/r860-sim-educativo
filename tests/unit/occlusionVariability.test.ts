import { expect, it } from 'vitest';
import { benchSim, BENCH_SETTINGS, runUntilBreath } from '../helpers';

it('la pausa conserva Pmus inicial al cruzar la frontera de un período variable', () => {
  const sim = benchSim({
    seed: 1,
    settings: { ...BENCH_SETTINGS, pausePct: 0.2 },
    effort: {
      enabled: true,
      amplitude: 0.2,
      ratePerMin: 12,
      tiS: 4,
      phaseS: -4.198,
      shape: 'riseRelax',
      relaxTauS: 2,
      variability: { amplitudeFrac: 0.5, periodFrac: 0 },
    },
  });
  // El período cambia en 0.802 s, dentro del primer paso de pausa [0.800,0.804].
  sim.run(800);
  const at = sim.effort.pmusAt.bind(sim.effort);
  const samples: { t: number; pmus: number }[] = [];
  sim.effort.pmusAt = (t) => {
    const pmus = at(t);
    samples.push({ t, pmus });
    return pmus;
  };
  sim.step();
  const initial = samples.find((s) => Math.abs(s.t - 0.8) < 1e-9)!;
  expect(initial.pmus).toBeGreaterThan(0.05);
  // Una consulta retrospectiva devuelve 0 tras cambiar onsetS y perdería el confusor.
  expect.soft(samples.filter((s) => Math.abs(s.t - 0.8) < 1e-9).every((s) => s.pmus === initial.pmus)).toBe(true);
  runUntilBreath(sim, 1);
  expect(sim.breaths.at(-1)!.effortDuringPause).toBe(true);
});
