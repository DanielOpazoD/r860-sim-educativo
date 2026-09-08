/**
 * Resumen docente: las cuatro presiones que se miden a la cabecera, su fórmula y su rango de referencia.
 *
 * No calcula física. Todo sale de lo que el motor ya publica con su calidad y su procedencia (`metrics`, y los valores
 * de un bloqueo inspiratorio válido), de modo que esta pestaña no puede decir algo distinto del resto del monitor.
 *
 * Sobre los rangos: son referencias de LITERATURA CLÍNICA, no del fabricante, y no son ajustes sugeridos para ningún
 * paciente. Valen para un paciente **pasivo** en ventilación controlada; con esfuerzo espontáneo la Pplat y la ΔP
 * dejan de medir lo que se cree que miden. La Ppico no lleva rango a propósito: no tiene uno.
 */
import type { EngineFrame } from '../engine/simulator';
import { formatNumber } from '../domain/units';

export interface Referencia {
  /** Extremo inferior del rango, o null si sólo hay techo. */
  min: number | null;
  /** Extremo superior, o null si sólo hay suelo. */
  max: number | null;
  texto: string;
  fuente: string;
}

export interface Tarjeta {
  id: string;
  titulo: string;
  /** La fórmula con símbolos. */
  formula: string;
  /** La misma fórmula con los números de esta respiración, o null si falta el dato. */
  sustituida: string | null;
  /** Qué falta para poder sustituir, cuando no se puede. Vacío si no falta nada. */
  faltaPara: string;
  valor: number | null;
  unidad: string;
  decimales: number;
  referencia: Referencia | null;
  /** `dentro` / `fuera` sólo cuando hay valor Y hay rango; `sinDato` cuando falta la medición. */
  estado: 'dentro' | 'fuera' | 'sinRango' | 'sinDato';
  /** Qué significa, o qué hay que hacer para medirlo. */
  nota: string;
}

const REF_PPLAT: Referencia = {
  min: null,
  max: 30,
  texto: '≤ 30 cmH₂O',
  fuente: 'ARDS Network, NEJM 2000',
};
const REF_DRIVING: Referencia = {
  min: null,
  max: 15,
  texto: '< 15 cmH₂O',
  fuente: 'Amato, NEJM 2015',
};
const REF_CSTAT: Referencia = {
  min: 50,
  max: 100,
  texto: '50–100 mL/cmH₂O',
  fuente: 'orientativo, adulto pasivo intubado',
};

/** Presión medida más reciente, o null si no hay dato válido. */
function metrica(fr: EngineFrame, clave: string): number | null {
  const m = fr.metrics[clave];
  return m && m.quality === 'valid' ? m.value : null;
}

/** Valor de un bloqueo inspiratorio válido, o null. Los tres derivados sólo existen tras una oclusión. */
function delBloqueo(fr: EngineFrame, clave: string): { valor: number | null; motivo: string | null } {
  const h = fr.procedure.last.inspHold;
  if (!h || h.quality !== 'valid') return { valor: null, motivo: null };
  const v = h.values[clave];
  return v && v.quality === 'valid' ? { valor: v.value, motivo: v.reason } : { valor: null, motivo: v?.reason ?? null };
}

/**
 * El veredicto se decide sobre el valor REDONDEADO como se muestra. Comparar el valor crudo hacía que una Cstat de
 * 49,86 apareciera como «50» y a la vez marcada fuera del rango 50–100: la tarjeta se contradecía a sí misma.
 */
function estado(valor: number | null, decimales: number, ref: Referencia | null): Tarjeta['estado'] {
  if (valor === null) return 'sinDato';
  if (!ref) return 'sinRango';
  const factor = 10 ** decimales;
  const v = Math.round(valor * factor) / factor;
  if (ref.max !== null && v > ref.max) return 'fuera';
  if (ref.min !== null && v < ref.min) return 'fuera';
  return 'dentro';
}

const n = (v: number | null, d = 0): string => formatNumber(v, d);

/**
 * Qué PEEP hay de verdad en el denominador. Es el error más común al calcular la presión motriz: con atrapamiento
 * aéreo, restar la PEEP programada en vez de la total la subestima. El motor ya lo declara en el motivo de la muestra.
 */
function denominador(motivo: string | null): string {
  if (!motivo) return '';
  return motivo.includes('PEEPtot') ? 'Denominador con PEEP total medida.' : 'Denominador con PEEPe: sin PEEP total medida.';
}

export function tarjetas(fr: EngineFrame): Tarjeta[] {
  const peepProg = fr.settings.peep === 'off' ? 0 : (fr.settings.peep as number);
  const ppico = metrica(fr, 'ppeak');
  const peepe = metrica(fr, 'peepe');
  const pplat = delBloqueo(fr, 'pplat');
  const driving = delBloqueo(fr, 'driving');
  const cstat = delBloqueo(fr, 'cstat');
  const vtHold = delBloqueo(fr, 'vt');
  const base = peepe ?? peepProg;

  // Ppico: lo que la vía aérea alcanza con el flujo entrando. Se descompone en los tres sumandos de la ecuación de
  // movimiento, que es lo que hace legible el resto de la pestaña.
  const resistiva = ppico !== null && pplat.valor !== null ? ppico - pplat.valor : null;
  const elastica = pplat.valor !== null ? pplat.valor - base : null;
  const tarjetaPpico: Tarjeta = {
    id: 'ppico',
    titulo: 'Presión pico',
    formula: 'Ppico = PEEP + R·Q + VT/C',
    sustituida:
      ppico !== null && resistiva !== null && elastica !== null
        ? `${n(ppico, 1)} = ${n(base, 1)} + ${n(resistiva, 1)} + ${n(elastica, 1)}`
        : null,
    valor: ppico,
    unidad: 'cmH₂O',
    decimales: 1,
    referencia: null,
    estado: estado(ppico, 1, null),
    faltaPara: 'Haz un bloqueo inspiratorio para separar la parte resistiva de la elástica.',
    nota: 'Sin rango propio: sube con el flujo y con la resistencia.',
  };

  const tarjetaPplat: Tarjeta = {
    id: 'pplat',
    titulo: 'Presión meseta',
    formula: 'Pplat = PEEP + ΔP',
    sustituida: pplat.valor !== null && driving.valor !== null ? `${n(pplat.valor, 1)} = ${n(base, 1)} + ${n(driving.valor, 1)}` : null,
    valor: pplat.valor,
    unidad: 'cmH₂O',
    decimales: 1,
    referencia: REF_PPLAT,
    estado: estado(pplat.valor, 1, REF_PPLAT),
    faltaPara: 'Se mide ocluyendo al final de la inspiración: bloqueo inspiratorio.',
    nota: 'Con flujo cero sólo queda carga elástica. Exige ocluir.',
  };

  const tarjetaDriving: Tarjeta = {
    id: 'driving',
    titulo: 'Presión motriz (ΔP)',
    formula: 'ΔP = Pplat − PEEPtot',
    sustituida: pplat.valor !== null && driving.valor !== null ? `${n(driving.valor, 1)} = ${n(pplat.valor, 1)} − ${n(base, 1)}` : null,
    valor: driving.valor,
    unidad: 'cmH₂O',
    decimales: 1,
    referencia: REF_DRIVING,
    estado: estado(driving.valor, 1, REF_DRIVING),
    faltaPara: 'Necesita la meseta: bloqueo inspiratorio.',
    nota: 'El VT normalizado por la distensibilidad: ΔP = VT / Cstat. ' + denominador(cstat.motivo),
  };

  const cstatMl = cstat.valor === null ? null : cstat.valor * 1000;
  const vtMl = vtHold.valor === null ? null : vtHold.valor * 1000;
  const tarjetaCstat: Tarjeta = {
    id: 'cstat',
    titulo: 'Distensibilidad estática',
    formula: 'Cstat = VT / ΔP',
    sustituida: cstatMl !== null && vtMl !== null && driving.valor !== null ? `${n(cstatMl)} = ${n(vtMl)} / ${n(driving.valor, 1)}` : null,
    valor: cstatMl,
    unidad: 'mL/cmH₂O',
    decimales: 0,
    referencia: REF_CSTAT,
    estado: estado(cstatMl, 0, REF_CSTAT),
    faltaPara: 'Necesita la meseta: bloqueo inspiratorio.',
    nota: 'Volumen admitido por cmH₂O elástico. Sólo vale con el paciente pasivo.',
  };

  return [tarjetaPpico, tarjetaPplat, tarjetaDriving, tarjetaCstat];
}

/** Las tres alturas que el esquema de la curva necesita, o null si aún no hay meseta medida. */
export interface Niveles {
  peep: number;
  pplat: number | null;
  ppico: number | null;
}

export function niveles(fr: EngineFrame): Niveles {
  const peepProg = fr.settings.peep === 'off' ? 0 : (fr.settings.peep as number);
  return { peep: metrica(fr, 'peepe') ?? peepProg, pplat: delBloqueo(fr, 'pplat').valor, ppico: metrica(fr, 'ppeak') };
}
