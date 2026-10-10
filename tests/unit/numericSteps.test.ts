import { describe, expect, it } from 'vitest';
import { gridValues } from '../../src/domain/validation';
import { R860_PROFILE } from '../../src/profiles';
import { ruleRangeIndex, ruleRangeValue, stepInputValue } from '../../src/ui/numericSteps';

describe('pasos numéricos según las reglas del perfil R860', () => {
  const vt = R860_PROFILE.rules.vt;
  const rrLow = R860_PROFILE.alarmLimitRules.rrLow;

  it('cruza el escalón de VT de 300 a 325 mL y vuelve a 300', () => {
    expect(stepInputValue(vt, '300', 1)).toBe('325');
    expect(stepInputValue(vt, '325', -1)).toBe('300');
  });

  it('un campo requerido vacío vuelve al mínimo al decrementar', () => {
    expect(stepInputValue(vt, '', -1)).toBe(String(gridValues(vt)[0]));
  });

  it('conserva Off en el mínimo y sube desde Off al mínimo permitido', () => {
    const minimum = gridValues(rrLow)[0];
    expect(stepInputValue(rrLow, String(minimum), -1)).toBe('');
    expect(stepInputValue(rrLow, '', 1)).toBe(String(minimum));
  });

  it('convierte Off y los límites de VT entre índices del deslizador y valores', () => {
    expect(ruleRangeIndex(rrLow, 'off')).toBe(0);
    expect(ruleRangeValue(rrLow, ruleRangeIndex(rrLow, 'off'))).toBe('off');
    for (const value of [300, 325]) {
      expect(ruleRangeValue(vt, ruleRangeIndex(vt, value))).toBe(value);
    }
  });
});
