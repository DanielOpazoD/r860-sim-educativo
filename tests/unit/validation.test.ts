import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isOnGrid, stepDisplayValue, validateVcSettings, deriveVcTiming } from '../../src/domain/validation';
import { VC_ADULT_RULES, VC_ADULT_CROSS_LIMITS, IE_VALUES } from '../../src/profiles/r860-es-photo-reference/settings';
import { BENCH_SETTINGS } from '../helpers';

describe('escalones por tramo (D ficha 2014) en ambos sentidos', () => {
  const vt = VC_ADULT_RULES.vt;
  it('VT: 300 → 325 al subir; 300 → 295 al bajar; 1000 → 1050 / 975', () => {
    expect(stepDisplayValue(vt, 300, 1)).toBe(325);
    expect(stepDisplayValue(vt, 300, -1)).toBe(295);
    expect(stepDisplayValue(vt, 1000, 1)).toBe(1050);
    expect(stepDisplayValue(vt, 1000, -1)).toBe(975);
    expect(stepDisplayValue(vt, 285, 1)).toBe(290);
    expect(stepDisplayValue(vt, 2000, 1)).toBe(2000);
    expect(stepDisplayValue(vt, 100, -1)).toBe(100);
  });
  it('285 mL está en rejilla; 287 no; 300 no se convierte en 325 al cambiar de vista', () => {
    expect(isOnGrid(vt, 285)).toBe(true);
    expect(isOnGrid(vt, 287)).toBe(false);
    expect(isOnGrid(vt, 300)).toBe(true);
  });
  it('trigger de flujo: 3.0 → 3.5 al subir; 3.0 → 2.9 al bajar', () => {
    const r = VC_ADULT_RULES.flowTrigger;
    expect(stepDisplayValue(r, 3, 1)).toBeCloseTo(3.5, 9);
    expect(stepDisplayValue(r, 3, -1)).toBeCloseTo(2.9, 9);
  });
  it('I:E discreto: 1:1.5 sube a 1:1 y baja a 1:2; extremos 1:9 y 4:1', () => {
    const r = VC_ADULT_RULES.ie;
    expect(stepDisplayValue(r, 1 / 1.5, 1)).toBeCloseTo(1, 9);
    expect(stepDisplayValue(r, 1 / 1.5, -1)).toBeCloseTo(0.5, 9);
    expect(stepDisplayValue(r, 1 / 9, -1)).toBeCloseTo(1 / 9, 9);
    expect(stepDisplayValue(r, 4, 1)).toBe(4);
    expect(IE_VALUES.length).toBe(17 + 6);
  });
  it('propiedad: subir y bajar desde un valor en rejilla (no extremo) devuelve el mismo valor', () => {
    for (const rule of [VC_ADULT_RULES.vt, VC_ADULT_RULES.flowTrigger, VC_ADULT_RULES.rr, VC_ADULT_RULES.peep]) {
      const segs = rule.domain;
      const min = segs[0]!.min, max = segs[segs.length - 1]!.max;
      fc.assert(fc.property(fc.double({ min, max, noNaN: true }), (x) => {
        // llevar a rejilla desde abajo
        let v = min;
        while (v < x - 1e-9 && v < max) v = stepDisplayValue(rule, v, 1);
        if (v <= min + 1e-9 || v >= max - 1e-9) return true;
        const up = stepDisplayValue(rule, v, 1);
        const back = stepDisplayValue(rule, up, -1);
        return Math.abs(back - v) < 1e-6 && isOnGrid(rule, v);
      }), { numRuns: 300 });
    }
  });
});

describe('restricciones cruzadas (P sobre rangos D)', () => {
  it('VT 2 L con Tinsp 0.5 s exige 240 L/min > 160: inválido con explicación, sin aproximar', () => {
    const r = validateVcSettings({ ...BENCH_SETTINGS, vt: 2, rr: 30, ie: 1 / 3 }, VC_ADULT_CROSS_LIMITS);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/L\/min/);
  });
  it('FR 120 con I:E 4:1 deja Texp 0.1 s < 0.25: inválido', () => {
    const r = validateVcSettings({ ...BENCH_SETTINGS, rr: 120, ie: 4 }, VC_ADULT_CROSS_LIMITS);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/espiratorio/);
  });
  it('Pmáx ≤ PEEP es inválido; el banco es válido y deriva flujo 0.5 L/s', () => {
    expect(validateVcSettings({ ...BENCH_SETTINGS, pmax: 5 }, VC_ADULT_CROSS_LIMITS).ok).toBe(false);
    const v = validateVcSettings(BENCH_SETTINGS, VC_ADULT_CROSS_LIMITS);
    expect(v.ok).toBe(true);
    expect(v.derived.qTargetLps).toBeCloseTo(0.5, 9);
    expect(deriveVcTiming({ rr: 32, ie: 1 / 1.5, vt: 0.285, pausePct: 0 }).tInspS).toBeCloseTo(0.75, 9);
  });
});
