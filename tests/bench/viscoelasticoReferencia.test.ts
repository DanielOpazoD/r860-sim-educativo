import { describe, expect, it } from 'vitest';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';
import { TISSUE_PRESETS, TUBE_PRESETS } from '../../src/ui/mechanicsPresets';

// BM-VE · presets de referencia (U-37): con el preset sano la caída P1→P2 de una oclusión queda en el rango de la
// literatura de oclusión rápida; con SDRA se amplifica; y el K₂ del TET 7,0 suma ≈ K₂·Q² a la presión pico.
const sano = TISSUE_PRESETS.find((p) => p.id === 'healthy')!;
const sdra = TISSUE_PRESETS.find((p) => p.id === 'ards')!;
const tet70 = TUBE_PRESETS.find((p) => p.id === 'id70')!;

/** P1 − P2 medido sobre la traza de Pva de una oclusión inspiratoria de 3 s (VC 500 mL a 0,5 L/s del banco). */
function p1MenosP2(eVisc: number, tauViscS: number): number {
  const sim = benchSim({ patient: { ...BENCH_PATIENT, eVisc, tauViscS } });
  runUntilBreath(sim, 3);
  expect(sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 }).accepted).toBe(true);
  let p1 = 0,
    p2 = 0,
    muestras = 0;
  // La oclusión en curso no aparece en `last` hasta completarse: se sigue por `hold.phase` y se muestrea la Pva.
  while (sim.frame().procedure.last.inspHold?.phase !== 'completed') {
    sim.step();
    if (sim.frame().procedure.hold?.phase === 'running') {
      const paw = sim.frame().live.paw;
      muestras++;
      if (muestras === 2) p1 = paw; // el primer punto aún arrastra la presión antes del cierre; el segundo ya es P1
      if (muestras >= 2) p2 = paw;
    }
  }
  expect(p1).toBeGreaterThan(0);
  return p1 - p2;
}

describe('BM-VE · preset sano de viscoelasticidad en una oclusión de 3 s', () => {
  it('P1 − P2 queda en 0,8–2,5 cmH₂O y P2 ≈ P0 + VT/Crs', () => {
    const dif = p1MenosP2(sano.eVisc, sano.tauViscS);
    expect(dif).toBeGreaterThan(0.8);
    expect(dif).toBeLessThan(2.5);
    const sim = benchSim({ patient: { ...BENCH_PATIENT, eVisc: sano.eVisc, tauViscS: sano.tauViscS } });
    runUntilBreath(sim, 3);
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    while (sim.procedures.last.inspHold?.phase !== 'completed') sim.step();
    const p2 = sim.procedures.last.inspHold!.values.pplat!.value!;
    const p0 = Number(BENCH_SETTINGS.peep),
      vt = Number(BENCH_SETTINGS.vt);
    expect(Math.abs(p2 - (p0 + vt / BENCH_PATIENT.crs))).toBeLessThanOrEqual(0.3);
  });

  it('con el preset SDRA la diferencia P1 − P2 es más del doble que la sana', () => {
    const sana = p1MenosP2(sano.eVisc, sano.tauViscS);
    const restrictiva = p1MenosP2(sdra.eVisc, sdra.tauViscS);
    expect(restrictiva).toBeGreaterThan(2 * sana);
  });
});

describe('BM-VE · preset TET 7,0 mm (K₂ 9,2)', () => {
  it('a 0,5 L/s la presión pico sube ≈ K₂·Q² = 2,3 ± 0,4 cmH₂O respecto a K₂ 0', () => {
    const pico = (r2: number): number => {
      const sim = benchSim({ patient: { ...BENCH_PATIENT, r2 } });
      runUntilBreath(sim, 4);
      return Math.max(...sim.breaths.slice(-2).map((b) => b.ppeak));
    };
    const sinTubo = pico(0),
      conTubo = pico(tet70.r2);
    const subida = conTubo - sinTubo;
    // Q inspiratorio del banco ≈ 0,5 L/s: la componente turbulenta del tubo añade ≈ 9,2·0,25 = 2,3 cmH₂O.
    expect(subida).toBeCloseTo(tet70.r2 * 0.25, 1);
    expect(Math.abs(subida - 2.3)).toBeLessThanOrEqual(0.4);
  });
});
