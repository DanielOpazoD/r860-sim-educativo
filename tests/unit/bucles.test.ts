import { describe, expect, it } from 'vitest';
import { arrowIndices } from '../../src/render/plots';

// Las flechas de sentido del bucle van al 20 %, 50 % y 80 % del ciclo; con menos de 8 muestras no hay tangente fiable.
describe('arrowIndices · flechas de sentido del bucle', () => {
  it('devuelve tres posiciones repartidas por el ciclo', () => {
    expect(arrowIndices(100)).toEqual([20, 50, 80]);
    expect(arrowIndices(250)).toEqual([50, 125, 200]);
  });

  it('con menos de 8 muestras no dibuja flechas', () => {
    expect(arrowIndices(7)).toEqual([]);
    expect(arrowIndices(0)).toEqual([]);
  });
});
