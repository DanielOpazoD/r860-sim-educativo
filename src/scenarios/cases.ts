/**
 * Casos clínicos (Casos · Casos clínicos). Cada uno es un escenario sintético con su bloque `clinical`: viñeta,
 * pregunta, criterios de RESULTADO, revelación y referencias abiertas y leídas (registro en docs/08-casos-clinicos.md).
 * Los números de la viñeta y de la explicación salen del motor con esa mecánica (tests/unit/casosClinicos.test.ts).
 */
import type { EffortParams, SensorParams } from '../domain/types';
import type { Scenario } from './index';

const passive: EffortParams = { enabled: false, amplitude: 0, ratePerMin: 12, tiS: 0.8, phaseS: 0, shape: 'riseRelax' };
const idealSensors: SensorParams = { fio2TauS: 6, fio2Bias: 0 };
const pubmed = (pmid: string): string => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

export const CLINICAL_CASES: Scenario[] = [
  {
    id: 'CC-01',
    name: 'Presión pico alta: ¿resistencia o distensibilidad?',
    synthetic: true,
    category: 'Mecánica respiratoria',
    level: 1,
    description: 'La presión pico subió sin cambios en la programación. Mide antes de decidir.',
    clinical: {
      theme: 'Mecánica respiratoria',
      vignette:
        'Hombre de 64 años, intubado por neumonía, en volumen control desde ayer. Enfermería avisa que la presión pico subió a 29 cmH₂O en la última hora; la programación no ha cambiado y el volumen corriente se entrega completo.',
      question: '¿Qué explica el aumento de la presión pico? Mide en el ventilador antes de responder.',
      kind: 'diagnostico',
      options: [
        {
          id: 'r',
          text: 'Aumento de la resistencia de la vía aérea (secreciones, broncoespasmo, tubo acodado)',
          correct: true,
          why: 'La meseta es normal y casi todo el exceso desaparece al parar el flujo: Ppico − Pplat es la carga resistiva (R·Q).',
        },
        {
          id: 'c',
          text: 'Caída de la distensibilidad (edema, atelectasia, neumotórax, intubación selectiva)',
          correct: false,
          why: 'Una distensibilidad menor eleva también la presión meseta; aquí la Pplat sigue siendo normal.',
        },
        {
          id: 'autopeep',
          text: 'Auto-PEEP por tiempo espiratorio insuficiente',
          correct: false,
          why: 'El flujo espiratorio vuelve a cero antes del ciclo siguiente y un bloqueo espiratorio no encuentra PEEP intrínseca relevante.',
        },
        {
          id: 'fuga',
          text: 'Fuga en el circuito o en el balón del tubo',
          correct: false,
          why: 'Una fuga baja las presiones y el volumen espirado; no eleva la presión pico.',
        },
      ],
      criteria: [{ id: 'mide', text: 'Mediste la presión meseta con un bloqueo inspiratorio', test: 'inspHold' }],
      reveal:
        'Con flujo constante, Paw = PEEP + R·Q + VT/C. El bloqueo inspiratorio detiene el flujo: lo que cae de Ppico a Pplat es la carga resistiva y lo que queda sobre la PEEP es la elástica. Este paciente tiene una resistencia inspiratoria de 30 cmH₂O·s/L —el triple del banco de referencia— con distensibilidad normal (50 mL/cmH₂O). En la cabecera, el siguiente paso es buscar la causa: aspirar secreciones, revisar el tubo y valorar broncoespasmo.',
      references: [
        {
          short: 'Hess, Respir Care 2014',
          citation: 'Hess DR. Respiratory mechanics in mechanically ventilated patients. Respir Care. 2014;59(11):1773-94.',
          url: pubmed('25336536'),
        },
        {
          short: 'Mireles-Cabodevila y Chatburn, Eur Heart J Acute Cardiovasc Care 2025',
          citation:
            'Mireles-Cabodevila E, Chatburn RL. The equation of motion: a brief guide to ventilator adjustment. Eur Heart J Acute Cardiovasc Care. 2025;14(8):494-496.',
          url: pubmed('40631448'),
        },
      ],
    },
    question: '¿Por qué un bloqueo inspiratorio separa la causa resistiva de la elástica?',
    answer: 'Porque con flujo cero desaparece el término R·Q: la presión que queda (Pplat) es sólo elástica.',
    patient: { crs: 0.05, rInsp: 30, rExp: 20, r2: 0, p0: 0 },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.45, rr: 16, ie: 1 / 3, peep: 5, pmax: 50, plimit: 100, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Ppico alta con Pplat normal: diferencia resistiva grande.',
    caution: 'Mecánica sintética de un compartimento; los valores ilustran la ecuación de movimiento, no a un paciente.',
  },
];
