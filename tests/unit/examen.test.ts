import { describe, expect, it } from 'vitest';
import { veredictoEstimacion } from '../../src/ui/metricsTable';

// Auditoría (hallazgo 7): contra un valor real de cero cualquier respuesta informaba «error 0 %», y el campo vacío
// pasaba como 0. Estas pruebas fijan el veredicto apropiado cerca de cero y la frontera del redondeo mostrado.
describe('EXM · el veredicto de la estimación informa lo correcto cerca de cero', () => {
  it('dentro del medio dígito mostrado es exacto, aunque no sea idéntico', () => {
    expect(veredictoEstimacion(20.3, 20.4, 0, 'cmH₂O')).toBe('exacto');
    expect(veredictoEstimacion(0.3, 0, 0, 'cmH₂O')).toBe('exacto');
  });

  it('contra un cero real informa la diferencia absoluta, no un porcentaje', () => {
    expect(veredictoEstimacion(5, 0, 0, 'cmH₂O')).toBe('diferencia de 5 cmH₂O');
    expect(veredictoEstimacion(0.9, 0, 2, '')).toBe('diferencia de 0.90');
  });

  it('lejos de cero informa el porcentaje redondeado', () => {
    expect(veredictoEstimacion(24, 20, 0, 'cmH₂O')).toBe('error 20 %');
    expect(veredictoEstimacion(450, 500, 0, 'mL')).toBe('error 10 %');
  });
});
