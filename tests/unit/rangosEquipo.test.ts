import { describe, expect, it } from 'vitest';
import { gridValues, isOnGrid, stepDisplayValue, validateAlarmLimitChanges } from '../../src/domain/validation';
import { REFERENCE_PROFILE } from '../../src/profiles';
import {
  ALARM_LIMIT_RULES,
  DEFAULT_ALARM_LIMITS,
  DEFAULT_VC_SETTINGS,
  IE_VALUES,
  VC_ADULT_RULES,
} from '../../src/profiles/adulto-referencia/settings';
import { SCENARIOS } from '../../src/scenarios';
import { benchSim } from '../helpers';

// RAN-URM · rangos y resoluciones de ajustes y límites como en las tablas del manual de referencia (URM SW10
// 2065490-001, 13-12 a 13-15, adulto): donde la ficha de 2014 no daba el paso o el proyecto lo había propuesto, manda
// el manual.

describe('RAN-URM · ajustes', () => {
  it('I:E de 1:9 a 4:1 en pasos de 0,1 en las dos partes', () => {
    const textos = IE_VALUES.map((r) => (r <= 1 + 1e-9 ? 1 / r : r));
    for (const x of textos) expect(Math.abs(x * 10 - Math.round(x * 10))).toBeLessThan(1e-9);
    expect(Math.min(...IE_VALUES)).toBeCloseTo(1 / 9, 12);
    expect(Math.max(...IE_VALUES)).toBe(4);
    expect(IE_VALUES).toContain(1);
    expect(IE_VALUES.some((r) => Math.abs(r - 1 / 2.1) < 1e-12)).toBe(true);
  });

  it('Tinsp de respaldo de 0,25 a 15 s: 0,05 hasta 1 s, 0,1 hasta 4 s y 0,25 hasta 15 s', () => {
    const r = VC_ADULT_RULES.backupTinspS;
    expect(gridValues(r)[0]).toBe(0.25);
    expect(gridValues(r).at(-1)).toBe(15);
    expect(stepDisplayValue(r, 1, -1)).toBeCloseTo(0.95, 9);
    expect(stepDisplayValue(r, 1, 1)).toBeCloseTo(1.1, 9);
    expect(stepDisplayValue(r, 4, 1)).toBeCloseTo(4.25, 9);
    expect(isOnGrid(r, 1.7)).toBe(true);
    expect(isOnGrid(r, 1.75)).toBe(false);
  });

  it('tiempo de apnea de 5 a 60 s: de 1 en 1 hasta 20 y de 5 en 5 después', () => {
    const r = VC_ADULT_RULES.apneaTimeS;
    expect(stepDisplayValue(r, 20, 1)).toBe(25);
    expect(stepDisplayValue(r, 20, -1)).toBe(19);
    expect(isOnGrid(r, 30)).toBe(true);
    expect(isOnGrid(r, 23)).toBe(false);
    expect(gridValues(r)).toHaveLength(16 + 8);
  });

  it('los valores de fábrica del perfil caen en la rejilla', () => {
    for (const [k, v] of Object.entries(DEFAULT_VC_SETTINGS)) {
      const r = VC_ADULT_RULES[k as keyof typeof VC_ADULT_RULES];
      if (!r || typeof v !== 'number') continue;
      expect(isOnGrid(r, v * r.displayFactor), k).toBe(true);
    }
  });
});

describe('RAN-URM · límites de alarma', () => {
  it('VTesp: de 0,5 en 0,5 mL hasta 20, de 1 hasta 100, de 5 hasta 350, de 25 hasta 1000 y de 50 después', () => {
    for (const r of [ALARM_LIMIT_RULES.vteLow, ALARM_LIMIT_RULES.vteHigh]) {
      expect(isOnGrid(r, 12.5)).toBe(true);
      expect(isOnGrid(r, 12.3)).toBe(false);
      expect(isOnGrid(r, 255)).toBe(true);
      expect(isOnGrid(r, 610)).toBe(false);
      expect(stepDisplayValue(r, 350, 1)).toBe(375);
      expect(stepDisplayValue(r, 1000, 1)).toBe(1050);
    }
    expect(gridValues(ALARM_LIMIT_RULES.vteLow).at(-1)).toBe(1950);
    expect(gridValues(ALARM_LIMIT_RULES.vteHigh)[0]).toBe(3);
  });

  it('VMesp: de 0,01 L/min bajo 1, de 0,1 hasta 10 y de 1 después; sin Off en invasiva', () => {
    const lo = ALARM_LIMIT_RULES.mveLow,
      hi = ALARM_LIMIT_RULES.mveHigh;
    expect(gridValues(lo)[0]).toBe(0.01);
    expect(gridValues(hi)[0]).toBe(0.02);
    expect(isOnGrid(lo, 0.35)).toBe(true);
    expect(isOnGrid(lo, 4.5)).toBe(true);
    expect(isOnGrid(hi, 12.5)).toBe(false);
    expect(stepDisplayValue(hi, 10, 1)).toBe(11);
    expect(lo.allowOff).toBe(false);
    expect(hi.allowOff).toBe(false);
  });

  it('FiO2 baja no se apaga; FiO2 alta sí', () => {
    expect(ALARM_LIMIT_RULES.fio2Low.allowOff).toBe(false);
    expect(ALARM_LIMIT_RULES.fio2High.allowOff).toBe(true);
    const sim = benchSim();
    for (const k of ['mveLow', 'mveHigh', 'fio2Low'] as const)
      expect(sim.command({ type: 'setAlarmLimits', changes: { [k]: 'off' } }).accepted, k).toBe(false);
    expect(sim.command({ type: 'setAlarmLimits', changes: { fio2High: 'off', vteLow: 'off' } }).accepted).toBe(true);
  });

  it('los límites por omisión y los de todos los escenarios caen en la rejilla del equipo', () => {
    const reglas = REFERENCE_PROFILE.alarmLimitRules as unknown as Parameters<typeof validateAlarmLimitChanges>[1],
      actuales = DEFAULT_ALARM_LIMITS as unknown as Record<string, number | 'off'>;
    expect(validateAlarmLimitChanges(DEFAULT_ALARM_LIMITS, reglas, actuales).reasons).toEqual([]);
    const conLimites = SCENARIOS.filter((sc) => sc.alarmLimits);
    expect(conLimites.length).toBeGreaterThan(2);
    for (const sc of conLimites) expect(validateAlarmLimitChanges(sc.alarmLimits, reglas, actuales).reasons, sc.id).toEqual([]);
  });
});
