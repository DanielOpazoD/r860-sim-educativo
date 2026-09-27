import { describe, expect, it } from 'vitest';
import { PatientModel, equilibriumVolumeFor, recruitmentAtRest } from '../../src/engine/patient';
import { validatePatientParams } from '../../src/domain/validation';
import { BENCH_PATIENT } from '../helpers';

// RC-01 · reclutamiento con histéresis (U-47): una fracción de la capacidad elástica está cerrada hasta que la
// distensión supera pOpen; abierta, no se cierra hasta caer por debajo de pClose. La capacidad efectiva es
// C·(1 + r·frac), así que reclutar baja Pel al mismo volumen y sube la compliance medida.
const REC = { frac: 0.6, pOpen: 25, pClose: 9, tauOpenS: 0.6, tauCloseS: 8 };
const P = { crs: 0.03, rInsp: 10, rExp: 12, r2: 0, p0: 0 };

describe('RC-01 · modelo de reclutamiento con histéresis', () => {
  it('el equilibrio escala con la fracción reclutada: V(r) = C·(1 + r·frac)·(P − P0)', () => {
    const sinRec = equilibriumVolumeFor({ ...P, recruit: REC }, 15, 0);
    const aLaMitad = equilibriumVolumeFor({ ...P, recruit: REC }, 15, 0.5);
    const abierto = equilibriumVolumeFor({ ...P, recruit: REC }, 15, 1);
    expect(sinRec).toBeCloseTo(0.03 * 15, 12);
    expect(aLaMitad).toBeCloseTo(sinRec * 1.3, 12);
    expect(abierto).toBeCloseTo(sinRec * 1.6, 12);
  });

  it('al arrancar ventilado sólo nace abierto si la distensión ya supera pOpen', () => {
    expect(recruitmentAtRest({ ...P, recruit: REC }, 10)).toBe(0);
    expect(recruitmentAtRest({ ...P, recruit: REC }, 25)).toBe(0); // en la banda, sin historia: cerrado
    expect(recruitmentAtRest({ ...P, recruit: REC }, 30)).toBe(1);
    expect(recruitmentAtRest({ ...P }, 30)).toBe(0);
  });

  it('la banda pClose–pOpen conserva el estado: eso ES la histéresis', () => {
    const m = new PatientModel({ ...P, recruit: REC }, 0);
    // Sube hasta abrir: equilibrateTo a 30 recluta.
    m.equilibrateTo(30);
    expect(m.recruited).toBe(1);
    expect(m.v).toBeCloseTo(0.03 * 1.6 * 30, 10);
    // Baja a la banda: sigue abierto (a 12 un pulmón lineal valdría 0,36 L; este conserva 0,576).
    m.equilibrateTo(12);
    expect(m.recruited).toBe(1);
    expect(m.v).toBeCloseTo(0.03 * 1.6 * 12, 10);
    expect(m.pelStatic()).toBeCloseTo(12, 10);
    // Baja del cierre: se vacía.
    m.equilibrateTo(5);
    expect(m.recruited).toBe(0);
    expect(m.v).toBeCloseTo(0.03 * 5, 10);
  });

  it('reclutar baja la presión elástica al mismo volumen y sube la compliance local', () => {
    const m = new PatientModel({ ...P, recruit: REC }, 0.15);
    const cerrada = m.pelStatic();
    m.recruited = 1;
    expect(m.pelStatic()).toBeCloseTo(0.15 / (0.03 * 1.6), 12);
    expect(m.pelStatic()).toBeLessThan(cerrada);
    expect(m.compliance()).toBeCloseTo(0.03 * 1.6, 12);
  });

  it('quitar recruit devuelve la fracción abierta a 0', () => {
    const m = new PatientModel({ ...P, recruit: REC }, 0);
    m.equilibrateTo(30);
    expect(m.recruited).toBe(1);
    m.applyParams({ ...P });
    expect(m.recruited).toBe(0);
  });

  it('sin recruit el modelo es exactamente el de siempre', () => {
    const m = new PatientModel({ ...BENCH_PATIENT }, 0.25);
    expect(m.recruited).toBe(0);
    expect(m.pelStatic()).toBeCloseTo(0.25 / BENCH_PATIENT.crs, 12);
    expect(m.equilibriumVolume(5)).toBeCloseTo(BENCH_PATIENT.crs * 5, 12);
  });

  it('la validación exige 0 < frac ≤ 1, pClose < pOpen y constantes de tiempo en rango', () => {
    expect(validatePatientParams({ ...P, recruit: REC })).toEqual([]);
    expect(validatePatientParams({ ...P, recruit: { ...REC, frac: 0 } })).not.toEqual([]);
    expect(validatePatientParams({ ...P, recruit: { ...REC, frac: 1.2 } })).not.toEqual([]);
    expect(validatePatientParams({ ...P, recruit: { ...REC, pClose: 26 } })).not.toEqual([]);
    expect(validatePatientParams({ ...P, recruit: { ...REC, pClose: -1 } })).not.toEqual([]);
    expect(validatePatientParams({ ...P, recruit: { ...REC, tauOpenS: 0 } })).not.toEqual([]);
    expect(validatePatientParams({ ...P, recruit: { ...REC, tauCloseS: 1000 } })).not.toEqual([]);
  });
});
