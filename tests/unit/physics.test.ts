import { describe, expect, it } from 'vitest';
import { benchSim, runUntilBreath, BENCH_PATIENT, BENCH_SETTINGS } from '../helpers';

describe('PHY-06 · cambiar PEEP conserva el volumen pulmonar; no se suma PEEP dos veces', () => {
  it('PEEP 5 → 10: V continuo en el instante del cambio, PEEPe medida sube a 10 y Pplat = 10 + VT/C = 20', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    const vBefore = sim.patient.v;
    expect(sim.command({ type: 'confirmSettings', changes: { peep: 10 } }).accepted).toBe(true);
    // Sin transición instantánea de volumen: el volumen sólo cambia por integración.
    expect(sim.patient.v).toBe(vBefore);
    sim.step();
    expect(Math.abs(sim.patient.v - vBefore)).toBeLessThan(0.5 * 0.004 * 2);
    runUntilBreath(sim, 8);
    const last = sim.breaths[sim.breaths.length - 1]!;
    expect(last.peepe).toBeCloseTo(10, 6);
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    runUntilBreath(sim, 10);
    const hold = sim.procedures.last.inspHold!;
    // Transitorio físico: el pulmón se llena hacia C·10 con tau = 0.5 s durante las espiraciones (residuo e⁻⁶ por ciclo).
    expect(hold.values.pplat!.value).toBeCloseTo(20, 1);
    expect(hold.values.pplat!.value!).toBeLessThan(21); // 25 delataría PEEP sumada dos veces
    expect(hold.values.cstat!.value! * 1000).toBeCloseTo(50, 0);
  });
  it('la curva de volumen tidal se reinicia por respiración sin reiniciar el volumen absoluto', () => {
    const sim = benchSim();
    runUntilBreath(sim, 3);
    const f = sim.frame();
    expect(f.truth.vAbsL).toBeGreaterThan(0.2);
    expect(Math.abs(f.live.volTidalL)).toBeLessThan(0.51);
  });
});

describe('PHY-07 · el vaciamiento determina la auto-PEEP (BM-04 en el motor)', () => {
  it('Rexp 30 y Texp corto producen PEEPtot > PEEP; alargar la espiración la reduce', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, rExp: 30 }, settings: { ...BENCH_SETTINGS, rr: 25, ie: 1 } });
    runUntilBreath(sim, 12);
    sim.command({ type: 'requestHold', kind: 'expHold', durationS: 3 });
    runUntilBreath(sim, 14);
    const h1 = sim.procedures.last.expHold!;
    expect(h1.quality).toBe('valid');
    const peepi1 = h1.values.peepi!.value!;
    expect(h1.values.peepTot!.value!).toBeGreaterThan(5.5);
    expect(peepi1).toBeGreaterThan(0.5);
    // Alargar Texp: FR 8, I:E 1:4 → Texp 6 s = 4·tau (tau = Rexp·C = 1.5 s) → residuo e⁻⁴ ≈ 1.8 % del exceso
    sim.command({ type: 'confirmSettings', changes: { rr: 8, ie: 1 / 4 } });
    runUntilBreath(sim, 26);
    sim.command({ type: 'requestHold', kind: 'expHold', durationS: 3 });
    runUntilBreath(sim, 28);
    const h2 = sim.procedures.last.expHold!;
    expect(h2.values.peepi!.value!).toBeLessThan(peepi1);
    expect(h2.values.peepi!.value!).toBeLessThan(0.3);
  });
});

describe('PHY-08 · R, C y Pmus cambian señales y métricas distintas', () => {
  it('subir Rinsp sube Ppico y no Pplat; bajar C sube ambas', () => {
    const base = benchSim();
    base.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    runUntilBreath(base, 1);
    const b0 = base.breaths[0]!;
    const p0 = base.procedures.last.inspHold!.values.pplat!.value!;
    const hiR = benchSim({ patient: { ...BENCH_PATIENT, rInsp: 20 } });
    hiR.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    runUntilBreath(hiR, 1);
    expect(hiR.breaths[0]!.ppeak).toBeCloseTo(b0.ppeak + 5, 3);
    expect(hiR.procedures.last.inspHold!.values.pplat!.value!).toBeCloseTo(p0, 3);
    const loC = benchSim({ patient: { ...BENCH_PATIENT, crs: 0.025 } });
    loC.command({ type: 'requestHold', kind: 'inspHold', durationS: 2 });
    runUntilBreath(loC, 1);
    expect(loC.breaths[0]!.ppeak).toBeCloseTo(b0.ppeak + 10, 3);
    expect(loC.procedures.last.inspHold!.values.pplat!.value!).toBeCloseTo(p0 + 10, 3);
  });
  it('el esfuerzo dispara respiraciones asistidas (no espontáneas) sólo si supera el trigger', () => {
    const weak = benchSim({
      effort: { enabled: true, amplitude: 0.5, ratePerMin: 30, tiS: 0.6, phaseS: 0.3 },
      settings: { ...BENCH_SETTINGS, assistControl: true, flowTrigger: 5 / 60, biasFlow: 6 / 60 },
    });
    runUntilBreath(weak, 8);
    expect(weak.breaths.every((b) => b.type === 'mandatory')).toBe(true);
    const strong = benchSim({
      effort: { enabled: true, amplitude: 6, ratePerMin: 30, tiS: 0.6, phaseS: 0.3 },
      settings: { ...BENCH_SETTINGS, assistControl: true, flowTrigger: 2 / 60 },
    });
    runUntilBreath(strong, 12);
    expect(strong.breaths.some((b) => b.type === 'assisted')).toBe(true);
    expect(strong.breaths.some((b) => b.type === 'spontaneous')).toBe(false);
    const f = strong.frame();
    expect(f.metrics.rrSpont!.value).toBe(0);
    expect(f.metrics.rr!.value!).toBeGreaterThan(15);
  });
});

describe('PHY-10 · dominio de fallo del ensayo', () => {
  it('resistencia alta (Rinsp 60) y C baja (5 mL/cmH2O): sin NaN ni infinitos; Pmáx termina la inspiración con volumen parcial', () => {
    // Paw(t) = 5 + 30 + 100·t → Pmáx 40 a t = 0.05 s → VT 0.025 L (no vacío: tInsp > 0 y VT > 0).
    const sim = benchSim({ patient: { ...BENCH_PATIENT, rInsp: 60, crs: 0.005 }, settings: { ...BENCH_SETTINGS, plimit: 60, pmax: 40 } });
    runUntilBreath(sim, 5);
    for (const b of sim.breaths) {
      expect(Number.isFinite(b.ppeak)).toBe(true);
      expect(Number.isFinite(b.vtInsp)).toBe(true);
      expect(b.pmaxReached).toBe(true);
      expect(b.tInspS).toBeCloseTo(0.05, 3);
      expect(b.vtInsp).toBeCloseTo(0.025, 3);
      expect(b.ppeak).toBeCloseTo(40, 6);
    }
    // Oclusión total de ensayo (Rinsp 400): la presión de arranque ya supera Pmáx; la inspiración termina en t = 0 sin volumen y sin NaN.
    const occl = benchSim({ patient: { ...BENCH_PATIENT, rInsp: 400, crs: 0.002 }, settings: { ...BENCH_SETTINGS, plimit: 60, pmax: 40 } });
    runUntilBreath(occl, 3);
    for (const b of occl.breaths) {
      expect(b.pmaxReached).toBe(true);
      expect(b.vtInsp).toBe(0);
      expect(Number.isFinite(b.pmean)).toBe(true);
    }
    const sim2 = occl;
    {
      const f = sim2.frame();
      for (const k of Object.keys(f.metrics)) {
        const v = f.metrics[k]!.value;
        if (v !== null) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
