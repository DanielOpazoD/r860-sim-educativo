import { describe, expect, it } from 'vitest';
import { benchSim } from '../helpers';
import { limitPair } from '../../src/ui/metricsTable';

// La pareja «alto / bajo» de la casilla numérica: un límite apagado deja su renglón vacío, no la palabra «Off».
describe('limitPair · límites de alarma en la casilla', () => {
  const fr = benchSim().frame();

  it('vte 0,5 / 0,2 L se lee «500\n200» en mL', () => {
    fr.alarmLimits.vteHigh = 0.5;
    fr.alarmLimits.vteLow = 0.2;
    expect(limitPair(fr, 'vte')).toBe('500\n200');
  });

  it('peepe con ambos límites en Off no muestra nada', () => {
    fr.alarmLimits.peepeHigh = 'off';
    fr.alarmLimits.peepeLow = 'off';
    expect(limitPair(fr, 'peepe')).toBe('');
  });

  it('rr con el alto en Off deja el renglón de arriba vacío', () => {
    fr.alarmLimits.rrHigh = 'off';
    fr.alarmLimits.rrLow = 6;
    expect(limitPair(fr, 'rr')).toBe('\n6');
  });
});
