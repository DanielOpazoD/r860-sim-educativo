/**
 * Casos clínicos (Casos · Casos clínicos). Cada uno es un escenario sintético con su bloque `clinical`: viñeta,
 * pregunta, criterios de RESULTADO, revelación y referencias abiertas y leídas (registro en docs/08-casos-clinicos.md).
 * Los números de la viñeta y de la explicación salen del motor con esa mecánica (tests/unit/casosClinicos.test.ts).
 */
import type { EffortParams, SensorParams } from '../domain/types';
import { CARDIAC_REFERENCE, TISSUE_PRESETS, TUBE_PRESETS } from '../domain/mechanicsPresets';
import type { Scenario } from './index';

const passive: EffortParams = { enabled: false, amplitude: 0, ratePerMin: 12, tiS: 0.8, phaseS: 0, shape: 'riseRelax' };
const idealSensors: SensorParams = { fio2TauS: 6, fio2Bias: 0 };
const pubmed = (pmid: string): string => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
/** Peso corporal predicho del protocolo ARDSNet (kg), con la talla en cm. */
const pbwHombre = (cm: number): number => Math.round((50 + 2.3 * (cm / 2.54 - 60)) * 10) / 10;

const REF = {
  hess2014: {
    short: 'Hess, Respir Care 2014',
    citation: 'Hess DR. Respiratory mechanics in mechanically ventilated patients. Respir Care. 2014;59(11):1773-94.',
    url: pubmed('25336536'),
  },
  marini2011: {
    short: 'Marini, Am J Respir Crit Care Med 2011',
    citation:
      'Marini JJ. Dynamic hyperinflation and auto-positive end-expiratory pressure: lessons learned over 30 years. Am J Respir Crit Care Med. 2011;184(7):756-62.',
    url: pubmed('21700908'),
  },
  ardsnet2000: {
    short: 'ARDS Network, N Engl J Med 2000',
    citation:
      'Acute Respiratory Distress Syndrome Network. Ventilation with lower tidal volumes as compared with traditional tidal volumes for acute lung injury and the acute respiratory distress syndrome. N Engl J Med. 2000;342(18):1301-8.',
    url: pubmed('10793162'),
  },
  amato2015: {
    short: 'Amato, N Engl J Med 2015',
    citation:
      'Amato MB, Meade MO, Slutsky AS, et al. Driving pressure and survival in the acute respiratory distress syndrome. N Engl J Med. 2015;372(8):747-55.',
    url: pubmed('25693014'),
  },
  ardsnetCard: {
    short: 'ARDSNet, resumen del protocolo',
    citation:
      'NIH NHLBI ARDS Clinical Network. Mechanical Ventilation Protocol Summary (peso predicho, Pplat ≤ 30 cmH₂O, pH 7,30–7,45, FR hasta 35).',
    url: 'http://www.ardsnet.org/files/ventilator_protocol_2008-07.pdf',
  },
  nuckton2002: {
    short: 'Nuckton, N Engl J Med 2002',
    citation:
      'Nuckton TJ, Alonso JA, Kallet RH, et al. Pulmonary dead-space fraction as a risk factor for death in the acute respiratory distress syndrome. N Engl J Med. 2002;346(17):1281-6.',
    url: pubmed('11973365'),
  },
  suarez2007: {
    short: 'Suarez-Sipmann, Crit Care Med 2007',
    citation:
      'Suarez-Sipmann F, Böhm SH, Tusman G, et al. Use of dynamic compliance for open lung positive end-expiratory pressure titration in an experimental study. Crit Care Med. 2007;35(1):214-21.',
    url: pubmed('17110872'),
  },
  art2017: {
    short: 'ART, JAMA 2017',
    citation:
      'Writing Group for the Alveolar Recruitment for ARDS Trial (ART) Investigators. Effect of lung recruitment and titrated PEEP vs low PEEP on mortality in patients with ARDS. JAMA. 2017;318(14):1335-1345.',
    url: pubmed('28973363'),
  },
  robertson2015: {
    short: 'Robertson, Eur Respir J 2015',
    citation: 'Robertson HT. Dead space: the physiology of wasted ventilation. Eur Respir J. 2015;45(6):1704-16.',
    url: pubmed('25395032'),
  },
  thille2006: {
    short: 'Thille, Intensive Care Med 2006',
    citation:
      'Thille AW, Rodriguez P, Cabello B, Lellouche F, Brochard L. Patient-ventilator asynchrony during assisted mechanical ventilation. Intensive Care Med. 2006;32(10):1515-22.',
    url: pubmed('16896854'),
  },
  thille2008: {
    short: 'Thille, Intensive Care Med 2008',
    citation:
      'Thille AW, Cabello B, Galia F, Lyazidi A, Brochard L. Reduction of patient-ventilator asynchrony by reducing tidal volume during pressure-support ventilation. Intensive Care Med. 2008;34(8):1477-86.',
    url: pubmed('18437356'),
  },
  blanch2015: {
    short: 'Blanch, Intensive Care Med 2015',
    citation:
      'Blanch L, Villagra A, Sales B, et al. Asynchronies during mechanical ventilation are associated with mortality. Intensive Care Med. 2015;41(4):633-41.',
    url: pubmed('25693449'),
  },
  georgopoulos2006: {
    short: 'Georgopoulos, Intensive Care Med 2006',
    citation:
      'Georgopoulos D, Prinianakis G, Kondili E. Bedside waveforms interpretation as a tool to identify patient-ventilator asynchronies. Intensive Care Med. 2006;32(1):34-47.',
    url: pubmed('16283171'),
  },
  imanaka2000: {
    short: 'Imanaka, Crit Care Med 2000',
    citation:
      'Imanaka H, Nishimura M, Takeuchi M, et al. Autotriggering caused by cardiogenic oscillation during flow-triggered mechanical ventilation. Crit Care Med. 2000;28(2):402-7.',
    url: pubmed('10708174'),
  },
  alotair2020: {
    short: 'Al Otair y BaHammam, Ann Thorac Med 2020',
    citation:
      'Al Otair HA, BaHammam AS. Ventilator- and interface-related factors influencing patient-ventilator asynchrony during noninvasive ventilation. Ann Thorac Med. 2020;15(1):1-8.',
    url: pubmed('32002040'),
  },
  tassaux2005: {
    short: 'Tassaux, Am J Respir Crit Care Med 2005',
    citation:
      'Tassaux D, Gainnier M, Battisti A, Jolliet P. Impact of expiratory trigger setting on delayed cycling and inspiratory muscle workload. Am J Respir Crit Care Med. 2005;172(10):1283-9.',
    url: pubmed('16109983'),
  },
  armaganidis2000: {
    short: 'Armaganidis, Crit Care Med 2000',
    citation:
      'Armaganidis A, Stavrakaki-Kallergi K, Koutsoukou A, Lymberis A, Milic-Emili J, Roussos C. Intrinsic positive end-expiratory pressure in mechanically ventilated patients with and without tidal expiratory flow limitation. Crit Care Med. 2000;28(12):3837-42.',
    url: pubmed('11153623'),
  },
  ranieri1993: {
    short: 'Ranieri, Am Rev Respir Dis 1993',
    citation:
      'Ranieri VM, Giuliani R, Cinnella G, et al. Physiologic effects of positive end-expiratory pressure in patients with chronic obstructive pulmonary disease during acute ventilatory failure and controlled mechanical ventilation. Am Rev Respir Dis. 1993;147(1):5-13.',
    url: pubmed('8420430'),
  },
  hess2005: {
    short: 'Hess, Respir Care 2005',
    citation: 'Hess DR. Ventilator waveforms and the physiology of pressure support ventilation. Respir Care. 2005;50(2):166-86.',
    url: pubmed('15691390'),
  },
} as const;
const k2 = (id: string): number => TUBE_PRESETS.find((t) => t.id === id)!.r2;
const tejido = (id: string) => {
  const t = TISSUE_PRESETS.find((x) => x.id === id)!;
  return { eVisc: t.eVisc, tauViscS: t.tauViscS };
};
/**
 * Pulmón intubado real en todos los casos: la resistencia de flujo turbulento del tubo endotraqueal (K₂ por diámetro
 * interno, Anaesth Intensive Care 2011; 8,0 mm en los hombres y 7,5 en las mujeres, P) y la relajación de esfuerzos de
 * los tejidos (D'Angelo 1989 en anestesiados sanos; en el SDRA, Eissa 1991 la encontró mayor: aquí 2× la sana, el
 * extremo bajo del preset, con el que un bloqueo de 2 s sigue dando una meseta estable). La resistencia lineal de cada
 * caso es la del paciente sin el tubo: la que mide el bloqueo las suma, como en la cabecera. Y el latido: la
 * oscilación cardiogénica que se ve en el flujo y en la presión (Imanaka 2000).
 */
const INTUBADO_H = { r2: k2('id80'), ...tejido('healthy'), cardiac: CARDIAC_REFERENCE };
const INTUBADA_M = { r2: k2('id75'), ...tejido('healthy'), cardiac: CARDIAC_REFERENCE };
const SDRA_TEJIDO = { eVisc: 2 * tejido('healthy').eVisc, tauViscS: 1.0, cardiac: CARDIAC_REFERENCE };
/**
 * Limitación al flujo espiratorio del EPOC (resistor de Starling): Armaganidis (Crit Care Med 2000) la encontró en 11 de
 * 13 pacientes ventilados por una insuficiencia de origen pulmonar, con PEEPi estática 7,1 ± 2,8 frente a 1,2 sin
 * ella; Ranieri (Am Rev Respir Dis 1993) midió en EPOC limitados PEEPi 9,8 y que la PEEP externa hasta ≈ 85 % de ella
 * (la presión crítica) no aumentaba el volumen ni la PEEP total. Presión crítica 9 cmH₂O (P, de ese orden).
 */
const EPOC_EFL = { pcrit: 9, rusFraction: 0.5 };
/**
 * Gasometría del EPOC (CC-02, CC-06, CC-08): la misma vía aérea que el adulto de referencia y un espacio muerto
 * alveolar mayor (unidades con V/Q alta), que da VDfis/VT ≈ 0,55–0,65 con VT de 6–7 mL/kg (P). Que lo alveolar escale
 * con el VT y no sea todo en serie es lo que deja la PaCO₂ casi igual cuando el VT baja y la frecuencia sube, como
 * midió Thille (2008). Bicarbonato de retención crónica de CO₂: con la gasometría a la vista, un EPOC con bicarbonato
 * normal mostraría una alcalosis respiratoria pura que no corresponde a su enfermedad.
 */
// HCO₃⁻ 32 a su PaCO₂ habitual de 60 mmHg: la compensación renal crónica de +4 mEq/L por cada 10 mmHg (reglas de Boston).
const EPOC_GAS = { alveolarDeadspaceFrac: 0.3, hco3: 32, paco2Basal: 60 };
/** Paciente EPOC en soporte: obstrucción espiratoria y esfuerzo propio (CC-06, CC-08). */
const EPOC_PS = { crs: 0.06, rInsp: 15, rExp: 25, r2: 0, p0: 0, gas: EPOC_GAS };
/**
 * Variabilidad respiración a respiración de un paciente en destete difícil: Wysocki (Crit Care Med 2006) separó a los
 * que fracasaban por un coeficiente de variación del impulso (VT/Ti) menor de 19 %; aquí la amplitud varía ±12 %
 * (CV ≈ 7 %). La frecuencia del esfuerzo queda fija para que los criterios de sincronía cuenten esfuerzos.
 */
const VARIABILIDAD_DESTETE = { amplitudeFrac: 0.12, periodFrac: 0 };
const ESFUERZO_EPOC: EffortParams = {
  enabled: true,
  amplitude: 7,
  ratePerMin: 22,
  tiS: 0.8,
  phaseS: 0.3,
  shape: 'riseRelax',
  variability: VARIABILIDAD_DESTETE,
};
/**
 * CC-06, calibrado con Thille (Intensive Care Med 2008) sobre el paciente intubado (tubo 8,0 y rama espiratoria del
 * equipo, con limitación al flujo y la variabilidad de un destete difícil): con soporte 20 no dispara el 38 % de los
 * esfuerzos (45 % en el estudio, RIC 36–52) con VT ≈ 8,6 mL/kg (10,2; RIC 7,2–11,5); con 13, disparan todos con
 * ≈ 5,2 mL/kg (5,9; 4,9–6,7). Frecuencia neural 26/min (26,5 en el estudio). Con
 * Rexp 24 (sólo en este caso).
 */
const ESFUERZO_THILLE: EffortParams = {
  enabled: true,
  amplitude: 8.25,
  ratePerMin: 26,
  tiS: 1,
  phaseS: 0.3,
  shape: 'riseRelax',
  variability: VARIABILIDAD_DESTETE,
};
const PS_BASE = { mode: 'CPAP_PS' as const, peep: 5, flowTrigger: 2 / 60, minRate: 'off' as const, pmax: 40 };

export const CLINICAL_CASES: Scenario[] = [
  {
    id: 'CC-01',
    name: 'Presión pico alta',
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
        'Con flujo constante, Paw = PEEP + R·Q + VT/C. El bloqueo inspiratorio detiene el flujo: lo que cae de Ppico a Pplat es la carga resistiva y lo que queda sobre la PEEP es la elástica. La carga resistiva medida es de ≈ 28 cmH₂O·s/L —su vía aérea, 25, más el tubo de 8,0 mm, que pesa más cuanto mayor es el flujo—, casi el triple del banco de referencia, con distensibilidad normal (50 mL/cmH₂O). En la cabecera, el siguiente paso es buscar la causa: aspirar secreciones, revisar el tubo y valorar broncoespasmo.',
      references: [
        REF.hess2014,
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
    patient: { crs: 0.05, rInsp: 25, rExp: 20, p0: 0, ...INTUBADO_H },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.45, rr: 16, ie: 1 / 3, peep: 5, pmax: 50, plimit: 100, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Ppico alta con Pplat normal: diferencia resistiva grande.',
    caution: 'Mecánica sintética de un compartimento; los valores ilustran la ecuación de movimiento, no a un paciente.',
  },
  {
    id: 'CC-02',
    name: 'Atrapamiento aéreo en EPOC',
    synthetic: true,
    category: 'Mecánica obstructiva',
    level: 2,
    description: 'El flujo espiratorio no vuelve a cero: hay PEEP intrínseca. Ajusta los tiempos sin perder el control del pH.',
    clinical: {
      theme: 'EPOC · hiperinflación dinámica',
      vignette:
        'Mujer de 71 años con EPOC grave, intubada por una exacerbación. Antes de intubarla: pH 7,26, PaCO₂ 78 mmHg, HCO₃⁻ 34 mEq/L. Está sedada, sin esfuerzo propio, en volumen control: VT 500 mL, FR 20, I:E 1:2. El flujo espiratorio no vuelve a cero antes de cada inspiración.',
      question:
        'Reduce el atrapamiento hasta una PEEP total de 10 cmH₂O o menos, sin acidosis ni alcalosis marcadas (pH de equilibrio 7,30–7,50). Mídela con un bloqueo espiratorio.',
      kind: 'ajuste',
      criteria: [
        { id: 'mide', text: 'Mediste la PEEP total con un bloqueo espiratorio después de tu último ajuste', test: 'expHold' },
        { id: 'peeptot', text: 'La PEEP total medida queda en 10 cmH₂O o menos', test: 'peepTotMax', params: { max: 10 } },
        {
          id: 'ph',
          text: 'El pH de equilibrio con tu ventilación queda entre 7,30 y 7,50',
          test: 'phEqRange',
          params: { min: 7.3, max: 7.5 },
        },
      ],
      reveal:
        'La constante de tiempo espiratoria de esta paciente es (Rexp + rama espiratoria del ventilador)·C = (40 + 3) × 0,06 ≈ 2,6 s. Con FR 20 e I:E 1:2 el tiempo espiratorio es de 2 s, menos de una constante de tiempo: cada inspiración empieza antes de que el pulmón vuelva a su volumen de reposo y queda una PEEP total de ≈ 13 cmH₂O (PEEP intrínseca ≈ 8). El tiempo espiratorio crece sobre todo bajando la frecuencia —y con ella el volumen minuto—; alargar sólo el I:E ayuda poco. Con FR 12 e I:E 1:4 la PEEP total baja a ≈ 9,6, pero no mucho más: la paciente tiene limitación al flujo espiratorio, como casi todos los EPOC ventilados por una insuficiencia de origen pulmonar (Armaganidis), y por debajo de una presión crítica (≈ 9 cmH₂O) el pulmón deja de vaciarse por más tiempo que se le dé. Por eso la PEEP externa hasta ≈ 85 % de esa presión no aumenta el atrapamiento (Ranieri): con FR 12 e I:E 1:4, subir la PEEP de 5 a 7 deja la PEEP total en ≈ 10; por encima, la suma. En una paciente pasiva tampoco la reduce: lo que desinfla es menos ventilación y más tiempo espiratorio. Para medirla, el bloqueo espiratorio necesita unos 4 s: los tejidos siguen redistribuyendo presión después de cerrar la válvula y la meseta late con el corazón, así que una oclusión corta no llega a una meseta estable. Además, ventilar de más a una paciente con retención crónica de CO₂ (HCO₃⁻ 32 a su PaCO₂ habitual de ≈ 60) baja su PaCO₂ por debajo de lo habitual para ella: con la programación inicial la PaCO₂ de equilibrio sería ≈ 37 y el pH ≈ 7,49, en el límite alto aunque los tampones restan ≈ 5 mEq/L de bicarbonato en la hipocapnia aguda. Su riñón no compensa en minutos.',
      references: [REF.marini2011, REF.armaganidis2000, REF.ranieri1993, REF.hess2014],
    },
    question: '¿Por qué bajar la frecuencia reduce el atrapamiento más que alargar sólo el I:E?',
    answer:
      'Porque el tiempo espiratorio depende de la duración del ciclo: a menor frecuencia, más segundos para vaciar el pulmón con la misma constante de tiempo.',
    patient: { crs: 0.06, rInsp: 20, rExp: 40, p0: 0, ...INTUBADA_M, efl: EPOC_EFL, gas: EPOC_GAS },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.5, rr: 20, ie: 1 / 2, peep: 5, pmax: 60, plimit: 100, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Flujo espiratorio que no llega a cero y PEEP total mayor que la programada.',
    caution:
      'Limitación al flujo como resistor de Starling con presión crítica fija (9 cmH₂O, P); sin la hemodinámica de la hiperinflación.',
  },
  {
    id: 'CC-03',
    name: 'SDRA: volumen corriente protector',
    synthetic: true,
    category: 'Ventilación protectora',
    level: 2,
    description: 'VT de 8,5 mL/kg y presión motriz de 20 en un SDRA. Protege el pulmón sin perder el control del CO₂.',
    clinical: {
      theme: 'SDRA · ventilación protectora',
      vignette:
        'Hombre de 52 años, 175 cm, con SDRA por neumonía: PaO₂/FiO₂ 140 con PEEP 10. Lleva VT 600 mL (8,5 mL/kg de peso predicho) y FR 16. Gasometría: pH 7,42, PaCO₂ 38 mmHg.',
      question:
        'Programa una ventilación protectora: VT ≈ 6 mL/kg de peso predicho (hasta 6,5), Pplat ≤ 30 cmH₂O, presión motriz < 15 cmH₂O y pH de equilibrio 7,30–7,45 con FR ≤ 35. Mide la meseta con un bloqueo inspiratorio.',
      kind: 'ajuste',
      criteria: [
        {
          id: 'vt',
          text: `VT de 6,5 mL/kg de peso predicho o menos (≤ ${Math.round(6.5 * pbwHombre(175))} mL)`,
          test: 'vtMaxPerKg',
          params: { mlPerKg: 6.5, pbw: pbwHombre(175) },
        },
        { id: 'mide', text: 'Mediste la meseta con un bloqueo inspiratorio después de tu último ajuste', test: 'inspHold' },
        { id: 'pplat', text: 'Pplat ≤ 30 cmH₂O', test: 'pplatMax', params: { max: 30 } },
        { id: 'dp', text: 'Presión motriz < 15 cmH₂O', test: 'drivingBelow', params: { max: 15 } },
        { id: 'ph', text: 'pH de equilibrio entre 7,30 y 7,45', test: 'phEqRange', params: { min: 7.3, max: 7.45 } },
        { id: 'fr', text: 'FR de 35 o menos', test: 'rrMax', params: { max: 35 } },
      ],
      reveal: `Peso predicho (ARDSNet): 50 + 2,3 × (talla en pulgadas − 60) = ${String(pbwHombre(175)).replace('.', ',')} kg; 6 mL/kg ≈ 425 mL. Con una distensibilidad de ≈ 31 mL/cmH₂O, bajar el VT de 600 a 425 mL lleva la presión motriz de ≈ 20 a ≈ 15 cmH₂O —la variable que mejor estratificó la supervivencia en el análisis de Amato— y la Pplat a ≈ 25. La meseta sigue bajando unas décimas durante el bloqueo: el tejido del SDRA relaja esfuerzos más que el sano (Eissa). El precio es la ventilación alveolar. El espacio muerto del SDRA es sobre todo alveolar —unidades ventiladas con poca perfusión— y Nuckton midió una fracción fisiológica media de 0,58; aquí VD/VT pasa de 0,53 con 600 mL a 0,60 con 425 mL, porque la vía aérea pesa más en un VT pequeño. Con FR 16 la PaCO₂ de equilibrio subiría a ≈ 64 mmHg (pH 7,24, ya con el bicarbonato que sube ≈ 2 mEq/L en la hipercapnia aguda). El protocolo ARDSNet sube la FR hasta 35 para mantener el pH ≥ 7,30: con FR 22 el pH de equilibrio vuelve a ≈ 7,35 y con FR 28, a ≈ 7,43.`,
      references: [REF.ardsnet2000, REF.amato2015, REF.ardsnetCard, REF.nuckton2002],
    },
    question: '¿Por qué hay que subir la frecuencia al bajar el volumen corriente en un SDRA?',
    answer:
      'Porque el espacio muerto de la vía aérea no cambia: con un VT menor pesa más, el alvéolo se ventila menos y, sin más frecuencia, la PaCO₂ sube.',
    patient: { crs: 0.032, rInsp: 10, rExp: 10, p0: 0, r2: INTUBADO_H.r2, ...SDRA_TEJIDO, gas: { alveolarDeadspaceFrac: 0.35 } },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.6, rr: 16, ie: 1 / 2, peep: 10, pmax: 50, plimit: 100, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Presión motriz alta con VT de 8,5 mL/kg.',
    caution:
      'Distensibilidad lineal y fracción de espacio muerto alveolar constante: el SDRA real es heterogéneo y su espacio muerto cambia con la PEEP y el VT.',
  },
  {
    id: 'CC-04',
    name: 'PEEP decremental tras reclutamiento',
    synthetic: true,
    category: 'Ventilación protectora',
    level: 3,
    description: 'La misma PEEP da distinta distensibilidad según la historia. Mide antes y después de abrir.',
    clinical: {
      theme: 'SDRA · reclutamiento y PEEP',
      vignette:
        'Mujer de 45 años con SDRA moderado. En volumen control: VT 400 mL, FR 18, PEEP 5. La distensibilidad estática es baja. El equipo decide probar una maniobra de reclutamiento seguida de una PEEP decremental guiada por la distensibilidad.',
      question:
        'Mide la Cstat a PEEP 5, abre el pulmón con PEEP 20 sostenida al menos 30 s, baja a PEEP 10–12 y vuelve a medir. Deja la PEEP final en 10 o más.',
      kind: 'ajuste',
      criteria: [
        { id: 'antes', text: 'Mediste la Cstat a la PEEP inicial, antes de abrir el pulmón', test: 'cstatBeforeOpening' },
        { id: 'abre', text: 'Abriste el pulmón con una PEEP alta sostenida', test: 'lesson:recruitedFull' },
        { id: 'despues', text: 'A PEEP 9–12 tras abrir, la Cstat supera en un 30 % o más a la inicial', test: 'lesson:cstatDecremental' },
        { id: 'peep', text: 'La PEEP final queda en 10 cmH₂O o más', test: 'peepMin', params: { min: 10 } },
      ],
      reveal:
        'Este pulmón tiene unidades que sólo abren por encima de ≈ 28 cmH₂O de distensión y no se cierran hasta bajar de ≈ 9: histéresis. A PEEP 5 están cerradas y la Cstat es ≈ 29 mL/cmH₂O. Tras abrirlas con PEEP 20, a PEEP 10–12 siguen abiertas y la Cstat sube a ≈ 43: la misma PEEP da distinta mecánica según la historia, que es lo que aprovecha la titulación decremental (Suarez-Sipmann). Pero mecánica no es pronóstico: en el ensayo ART, en SDRA moderado-grave, la estrategia de reclutamiento con PEEP titulada aumentó la mortalidad a 28 días frente a PEEP baja (55,3 % frente a 49,3 %) y el barotrauma. El máximo de Cstat no identifica por sí solo una PEEP segura.',
      references: [REF.suarez2007, REF.art2017],
    },
    question: '¿Por qué la PEEP decremental encuentra más distensibilidad que la ascendente a la misma PEEP?',
    answer: 'Porque lo abierto a presión alta no se cierra hasta caer por debajo de su presión de cierre, que es menor.',
    patient: {
      crs: 0.03,
      rInsp: 10,
      rExp: 12,
      p0: 0,
      r2: INTUBADA_M.r2,
      ...SDRA_TEJIDO,
      recruit: { frac: 0.6, pOpen: 28, pClose: 9, tauOpenS: 0.6, tauCloseS: 8 },
    },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.4, rr: 18, ie: 1 / 2, peep: 5, pmax: 60, plimit: 100, pausePct: 0 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'La Cstat a la misma PEEP cambia tras la apertura.',
    caution:
      'Un único par de umbrales de apertura y cierre; sin intercambio de oxígeno ni hemodinámica. No es una pauta clínica de reclutamiento.',
  },
  {
    id: 'CC-05',
    name: 'Hipercapnia con pulmones sanos',
    synthetic: true,
    category: 'Intercambio gaseoso',
    level: 2,
    description: 'PaCO₂ 86 con pulmones sanos. El volumen minuto no lo es todo.',
    clinical: {
      theme: 'CO₂ · espacio muerto',
      vignette:
        'Hombre de 58 años, 175 cm, sin enfermedad pulmonar, en el posoperatorio de una cirugía abdominal y aún sedado. Programa: VT 400 mL, FR 10. Lleva un intercambiador de calor y humedad y un alargador en la pieza en Y. Suena la alarma de volumen minuto bajo. Gasometría: pH 7,14, PaCO₂ 88 mmHg, HCO₃⁻ 29 mEq/L.',
      question: 'Normaliza la PaCO₂ de equilibrio (35–45 mmHg) sin superar 8 mL/kg de peso predicho y sin provocar atrapamiento.',
      kind: 'ajuste',
      criteria: [
        { id: 'paco2', text: 'La PaCO₂ de equilibrio queda entre 35 y 45 mmHg', test: 'paco2EqRange', params: { min: 35, max: 45 } },
        {
          id: 'vt',
          text: `VT de 8 mL/kg de peso predicho o menos (≤ ${Math.round(8 * pbwHombre(175))} mL)`,
          test: 'vtMaxPerKg',
          params: { mlPerKg: 8, pbw: pbwHombre(175) },
        },
        { id: 'peepi', text: 'Sin atrapamiento: PEEP intrínseca de 2 cmH₂O o menos', test: 'autoPeepMax', params: { max: 2 } },
      ],
      reveal:
        'La PaCO₂ depende de la ventilación alveolar, no del volumen minuto: V̇A = (VT − VD) × (1 − f) × FR, con VD el espacio muerto de la vía aérea y f la pequeña fracción alveolar de un pulmón sano (0,12). Con 200 mL de vía aérea (la anatómica y el tubo, más el intercambiador y el alargador), 400 mL × 10 dan 4 L/min de volumen minuto pero sólo 1,8 L/min de ventilación alveolar (VD/VT 0,56). Subir la FR a 18 ventila 3,2 L/min de alvéolo y deja la PaCO₂ en ≈ 49. Con VT 500 y FR 14 —casi el mismo volumen minuto, 7 frente a 7,2 L/min— la ventilación alveolar es 3,7 L/min y la PaCO₂ ≈ 42: con un VT mayor se desperdicia una fracción menor. En la cabecera, retirar el espacio muerto instrumental innecesario logra lo mismo sin tocar el ventilador. Y la PaCO₂ tarda minutos en llegar al nuevo equilibrio: la gasometría de control se pide a los 20–30 min.',
      references: [REF.robertson2015, REF.ardsnetCard],
    },
    question: '¿Por qué, a igual volumen minuto, un VT mayor baja más la PaCO₂?',
    answer:
      'Porque el espacio muerto se paga en cada respiración: con menos respiraciones de más volumen, la fracción desperdiciada (VD/VT) es menor.',
    // Sedado: VCO₂ algo menor que la de un adulto despierto en reposo (≈ 2,5 mL/kg/min, P).
    patient: { crs: 0.05, rInsp: 10, rExp: 10, p0: 0, ...INTUBADO_H, gas: { deadspaceL: 0.2, vco2MlMin: 180 } },
    effort: passive,
    sensors: idealSensors,
    settings: { vt: 0.4, rr: 10, ie: 1 / 2, peep: 5, pmax: 40, plimit: 100, pausePct: 0 },
    // Límite de volumen minuto bajo programado para este paciente (5 L/min): el de su viñeta, no el 4 por omisión.
    alarmLimits: { mveLow: 5 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Volumen minuto bajo y fracción de espacio muerto alta.',
    caution:
      'Espacio muerto de la vía aérea fijo y fracción alveolar constante; sin oxigenación. La gasometría es del modelo, no del equipo.',
  },
  {
    id: 'CC-06',
    name: 'Esfuerzos que no disparan',
    synthetic: true,
    category: 'Sincronía',
    level: 2,
    description: 'El paciente hace más esfuerzos de los que el ventilador detecta.',
    clinical: {
      theme: 'Asincronía · esfuerzos inefectivos',
      vignette:
        'Hombre de 66 años, 170 cm, con EPOC, en destete con presión de soporte 20 cmH₂O y PEEP 5. Respira con esfuerzo: cuentas 26 esfuerzos por minuto en el tórax, pero el ventilador marca una frecuencia menor y avisa de un volumen espirado alto.',
      question:
        'Ajusta el soporte para que todos los esfuerzos disparen el ventilador sin dejar un volumen corriente insuficiente (≥ 5 mL/kg de peso predicho). Espera un minuto tras tu último cambio antes de entregar.',
      kind: 'ajuste',
      criteria: [
        {
          id: 'disparo',
          text: 'Durante el último minuto disparan al menos el 95 % de los esfuerzos',
          test: 'effortsTriggered',
          params: { fraction: 0.95 },
        },
        {
          id: 'vt',
          text: `VT espirado de 5 mL/kg de peso predicho o más (≥ ${Math.round(5 * pbwHombre(170))} mL)`,
          test: 'vteMinPerKg',
          params: { mlPerKg: 5, pbw: pbwHombre(170) },
        },
      ],
      reveal:
        'Con soporte 20 el volumen corriente es grande (≈ 570 mL, 8,6 mL/kg) y, en un pulmón obstructivo, no alcanza a salir antes del esfuerzo siguiente: el esfuerzo llega cuando aún queda presión elástica por vencer —PEEP intrínseca— y no dispara. Casi cuatro de cada diez esfuerzos se pierden. Los esfuerzos inefectivos son la asincronía más frecuente; Thille los asoció a más soporte, volúmenes mayores y un disparo menos sensible —el paciente puede estar recibiendo soporte de más—, y Blanch, a mayor mortalidad. En un estudio fisiológico, Thille bajó el soporte de 20 a 13 cmH₂O: el VT pasó de 10 a 6 mL/kg y los esfuerzos inefectivos, del 45 % al 0 %, sin cambios en la frecuencia del paciente ni en la PaCO₂. Aquí, con 13–14 cmH₂O disparan todos con VT ≈ 345–360 mL: el tubo y la obstrucción frenan los flujos altos del soporte, y el esfuerzo de quien no progresa en el destete varía poco entre respiraciones (Wysocki). La PaCO₂ cambia mucho menos que el VT: la frecuencia del ventilador se duplica porque los esfuerzos que se perdían ahora disparan, y buena parte del espacio muerto de un EPOC es alveolar y se achica con el VT. Con soporte 20 la PaCO₂ de equilibrio queda en ≈ 40 mmHg (pH 7,47); con 13, en ≈ 52 (pH 7,39), cerca de su equilibrio habitual. En las curvas, un esfuerzo inefectivo es una muesca en el flujo espiratorio que no va seguida de una respiración (Georgopoulos).',
      references: [REF.thille2008, REF.thille2006, REF.blanch2015, REF.georgopoulos2006],
    },
    question: '¿Por qué más soporte puede significar peor sincronía?',
    answer:
      'Porque un VT mayor deja menos tiempo para vaciar el pulmón: la PEEP intrínseca resultante se interpone entre el esfuerzo y el disparo.',
    patient: { ...EPOC_PS, ...INTUBADO_H, rExp: 24, efl: EPOC_EFL },
    effort: ESFUERZO_THILLE,
    sensors: idealSensors,
    settings: { ...PS_BASE, psupport: 20, expTriggerPct: 0.25 },
    // Límite de VT alto programado para este paciente: ≈ 10 mL/kg de peso predicho (66 kg), no el 750 mL por omisión.
    alarmLimits: { vteHigh: 0.65 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Frecuencia del ventilador menor que la del paciente.',
    caution:
      'Esfuerzo sintético periódico de frecuencia fija; limitación al flujo como resistor de Starling (presión crítica 9, P). En el estudio de Thille la PaCO₂ no cambió al bajar el soporte; aquí sube algo más porque la frecuencia del esfuerzo no responde a la PaCO₂.',
  },
  {
    id: 'CC-07',
    name: 'Autodisparo por fuga',
    synthetic: true,
    category: 'Sincronía',
    level: 1,
    description: 'Respiraciones disparadas en un paciente que no respira.',
    clinical: {
      theme: 'Asincronía · autodisparo',
      vignette:
        'Mujer de 80 años, sedada y sin esfuerzo propio tras un paro cardiorrespiratorio, en asistida-controlada por volumen a FR 12 con disparo por flujo de 2 L/min. El monitor marca una frecuencia mayor que la programada y el VT espirado es menor que el inspirado. El balón del tubo pierde aire y el recambio no es inmediato.',
      question: 'Elimina el autodisparo sin insensibilizar de más el disparo (6 L/min o menos).',
      kind: 'ajuste',
      criteria: [
        { id: 'auto', text: 'Las tres últimas respiraciones tras tu ajuste no son disparadas', test: 'noAutotrigger' },
        { id: 'trig', text: 'Disparo por flujo de 6 L/min o menos', test: 'flowTriggerMax', params: { maxLpm: 6 } },
      ],
      reveal:
        'La fuga deja escapar gas de forma continua; el ventilador mide ese flujo como si el paciente inspirara y, si supera el umbral de disparo, entrega una respiración que nadie pidió: autodisparo. A PEEP 5 esta fuga pierde ≈ 3 L/min, más que el umbral de 2 L/min, y el latido suma al flujo que ve el sensor una oscilación de ≈ ±2 L/min (Imanaka la midió tras cirugía cardíaca): con 4–5 L/min el umbral todavía se cruza cuando coinciden, y con 6 el autodisparo cesa. Señales que no son esfuerzo —la fuga, las oscilaciones cardiogénicas— pueden disparar un ventilador con disparo por flujo sensible, y la fuga es uno de los factores principales de asincronía en ventilación no invasiva (Al Otair y BaHammam). Insensibilizar de más tiene su costo cuando el paciente sí respira: esfuerzos inefectivos. La solución definitiva es corregir la fuga.',
      references: [REF.imanaka2000, REF.alotair2020],
    },
    question: '¿Cómo distinguir un autodisparo de una respiración del paciente?',
    answer:
      'En el autodisparo no hay deflexión negativa de presión ni esfuerzo previo, y aparece aunque el paciente esté sedado y sin esfuerzo.',
    patient: { crs: 0.05, rInsp: 10, rExp: 10, p0: 0, ...INTUBADA_M, leakLpmAt10: 6 },
    effort: passive,
    sensors: idealSensors,
    settings: {
      vt: 0.5,
      rr: 12,
      ie: 1 / 3,
      peep: 5,
      pmax: 40,
      plimit: 100,
      pausePct: 0,
      assistControl: true,
      flowTrigger: 2 / 60,
      biasFlow: 8 / 60,
    },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Respiraciones asistidas con el esfuerzo apagado.',
    caution: 'Fuga lineal en la pieza en Y y sin compensación de fugas.',
  },
  {
    id: 'CC-08',
    name: 'Ciclado tardío en presión de soporte',
    synthetic: true,
    category: 'Sincronía',
    level: 3,
    description: 'El ventilador sigue insuflando cuando la paciente ya quiere espirar.',
    clinical: {
      theme: 'Asincronía · ciclado',
      vignette:
        'Mujer de 69 años con EPOC, en presión de soporte 12 cmH₂O con criterio de ciclado espiratorio del 5 % del flujo pico. Está incómoda: el ventilador sigue insuflando cuando ella ya quiere espirar, y algunos esfuerzos no disparan.',
      question:
        'Ajusta el ciclado para que la inspiración del ventilador termine con la de la paciente (retraso ≤ 0,3 s) y todos los esfuerzos disparen. Espera un minuto tras tu último cambio antes de entregar.',
      kind: 'ajuste',
      criteria: [
        {
          id: 'ciclado',
          text: 'Durante el último minuto, la inspiración del ventilador no dura más de 0,3 s que la de la paciente',
          test: 'cyclingDelayMax',
          params: { maxS: 0.3 },
        },
        {
          id: 'disparo',
          text: 'Durante el último minuto disparan al menos el 95 % de los esfuerzos',
          test: 'effortsTriggered',
          params: { fraction: 0.95 },
        },
      ],
      reveal:
        'En soporte de presión la inspiración termina cuando el flujo cae a un porcentaje del pico. En un pulmón obstructivo el flujo decae lento y, con un criterio del 5 %, la máquina sigue insuflando ≈ 1 s después de que la paciente terminó: ciclado tardío. La paciente empieza a espirar contra el ventilador, se acorta su tiempo espiratorio y alrededor de uno de cada cuatro esfuerzos siguientes no dispara. Tassaux mostró en pacientes obstructivos que subir el criterio de ciclado reduce el retraso y la PEEP intrínseca; aquí, con 25–50 % la inspiración mecánica termina con la neural. Un criterio demasiado alto corta la inspiración antes que la paciente: ciclado precoz, otra asincronía (Hess).',
      references: [REF.tassaux2005, REF.hess2005],
    },
    question: '¿Por qué el ciclado tardío es más frecuente en pulmones obstructivos?',
    answer:
      'Porque con una constante de tiempo larga el flujo inspiratorio tarda en caer al porcentaje del pico que termina la inspiración.',
    patient: { ...EPOC_PS, ...INTUBADA_M },
    effort: ESFUERZO_EPOC,
    sensors: idealSensors,
    settings: { ...PS_BASE, psupport: 12, expTriggerPct: 0.05 },
    initialV: 'equilibrium',
    perturbations: [],
    observe: 'Ti mecánico mucho mayor que el neural.',
    caution:
      'Esfuerzo sintético periódico. Sin limitación al flujo espiratorio, aunque una EPOC real suele tenerla: con ella este esfuerzo sintético ya no reproduce el ciclado tardío que enseña el caso.',
  },
];
