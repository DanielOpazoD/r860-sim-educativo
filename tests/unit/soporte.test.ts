import { describe, expect, it } from 'vitest';
import type { VcSettings } from '../../src/domain/types';
import { validateVcSettings } from '../../src/domain/validation';
import {
  APNEA_BACKUP_RATE_PER_MIN,
  BACKUP_DELAY_AFTER_BACKUP_S,
  BACKUP_DELAY_AFTER_MODE_S,
  SUPPORT_TI_MAX_S,
} from '../../src/engine/controller';
import { exportSession, importSession } from '../../src/history/session';
import { DEFAULT_ALARM_LIMITS, VC_ADULT_CROSS_LIMITS } from '../../src/profiles/adulto-referencia/settings';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// PHY-03 · CPAP/PS: esfuerzo, disparo, ciclaje y respaldo. Banco propio del modo antes de habilitarlo en el perfil.
// Fuente de presión PEEP + PS con rampa (D ficha 2014), ciclada cuando el flujo cae al porcentaje programado de su pico
// (D «Trigger Espiratorio: 5 a 80 % de flujo pico»), con frecuencia mínima, tiempo de apnea y respaldo por presión.

const PS: VcSettings = {
  ...BENCH_SETTINGS,
  mode: 'CPAP_PS',
  peep: 5,
  psupport: 10,
  expTriggerPct: 0.25,
  riseMs: 100,
  flowTrigger: 2 / 60,
  biasFlow: 4 / 60,
  minRate: 'off',
  apneaTimeS: 20,
  backupPinsp: 12,
  backupTinspS: 1,
};
const esfuerzo = { enabled: true, amplitude: 8, ratePerMin: 15, tiS: 0.8, phaseS: 0.5 };

/** Por respiración: flujo pico inspiratorio y flujo en la última muestra inspiratoria (L/s). */
function ciclado(sim: ReturnType<typeof benchSim>, breaths: number): { qPeak: number; qEnd: number; tiS: number }[] {
  const out: { qPeak: number; qEnd: number; tiS: number }[] = [];
  let qPeak = 0,
    qEnd = 0,
    enInsp = false,
    seq = sim.breaths.length;
  while (sim.breaths.length < breaths) {
    sim.step();
    const f = sim.frame();
    const insp = f.live.phase === 'inspSupport';
    if (insp) {
      qPeak = Math.max(qPeak, f.live.flowLps);
      qEnd = f.live.flowLps;
    } else if (enInsp) {
      const b = sim.breaths.at(-1);
      if (b && sim.breaths.length > seq) {
        out.push({ qPeak, qEnd, tiS: b.tInspS });
        seq = sim.breaths.length;
      }
      qPeak = 0;
    }
    enInsp = insp;
  }
  return out;
}

describe('PHY-03a · con esfuerzo, el paciente manda: espontáneas a PEEP + PS cicladas por flujo', () => {
  it('todas las respiraciones son espontáneas, la Ppico es PEEP + PS y terminan al 25 % del flujo pico', () => {
    const sim = benchSim({ effort: esfuerzo, settings: PS });
    const c = ciclado(sim, 8);
    const b = sim.breaths;
    expect(b.length).toBeGreaterThanOrEqual(8);
    expect(b.every((r) => r.type === 'spontaneous')).toBe(true);
    expect(b.every((r) => r.cyclingCause === 'flow')).toBe(true);
    for (const r of b) expect(r.ppeak).toBeCloseTo(15, 0); // PEEP 5 + PS 10 (D: presión de soporte sobre nivel PEEP)
    // El ciclado: la última muestra que aún es inspiratoria queda un paso (4 ms) ANTES del cruce del 25 %, así que está
    // justo por encima del umbral; la siguiente ya es espiratoria. Se exige que esté dentro de un paso de decaimiento.
    for (const x of c.slice(1)) {
      expect(x.qPeak).toBeGreaterThan(0.3);
      expect(x.qEnd / x.qPeak).toBeLessThan(0.26);
      expect(x.qEnd / x.qPeak).toBeGreaterThan(0.22);
    }
    // Frecuencia: la del paciente (15/min), y toda ella espontánea.
    const m = sim.frame().metrics;
    expect(m.rr!.value!).toBeCloseTo(15, 0);
    expect(m.rrSpont!.value!).toBeCloseTo(15, 0);
    expect(m.mveSpont!.value!).toBeCloseTo(m.mve!.value!, 2);
    expect(m.vteSpont!.quality).toBe('valid');
    expect(m.vteSpont!.value!).toBeCloseTo(b.at(-1)!.vtExpMeasured ?? b.at(-1)!.vtExp, 3);
    expect(sim.alarms.get('apnea')!.conditionActive).toBe(false);
  });

  it('el ciclaje espiratorio gobierna el Ti: 50 % acorta la inspiración frente a 25 %, y una resistencia alta la alarga (ciclado tardío)', () => {
    const ti = (over: Partial<VcSettings>, patient = BENCH_PATIENT): number => {
      const sim = benchSim({ effort: esfuerzo, settings: { ...PS, ...over }, patient: { ...patient } });
      const c = ciclado(sim, 8);
      return c.slice(2).reduce((a, x) => a + x.tiS, 0) / (c.length - 2);
    };
    const t25 = ti({}),
      t50 = ti({ expTriggerPct: 0.5 }),
      tObs = ti({}, { ...BENCH_PATIENT, rInsp: 25, rExp: 25 });
    expect(t50).toBeLessThan(t25 - 0.05);
    expect(tObs).toBeGreaterThan(t25 + 0.1); // τ = R·C más larga: el flujo tarda más en caer al 25 %
  });

  it('cuando el flujo no cae al umbral, el tope de tiempo del soporte corta la inspiración', () => {
    // Pulmón lento (τ = R·C = 20 × 0,1 = 2 s) y ciclaje al 5 %: haría falta ~3 τ = 6 s para caer al umbral.
    const sim = benchSim({
      effort: esfuerzo,
      settings: { ...PS, expTriggerPct: 0.05 },
      patient: { ...BENCH_PATIENT, crs: 0.1, rInsp: 20, rExp: 20 },
    });
    runUntilBreath(sim, 4);
    const cortadas = sim.breaths.filter((b) => b.cyclingCause === 'tiMax');
    expect(cortadas.length).toBeGreaterThan(0);
    for (const b of cortadas) expect(b.tInspS).toBeCloseTo(SUPPORT_TI_MAX_S, 2);
  });
});

describe('PHY-03b · respaldo: apnea con alarma y respiraciones por presión; frecuencia mínima', () => {
  it('sin esfuerzo: apnea a los 20 s (alarma alta), respaldo a PEEP + Pinsp de respaldo durante Tinsp de respaldo, a 12/min', () => {
    const sim = benchSim({ settings: PS });
    sim.run(19_500);
    expect(sim.breaths.length).toBe(0);
    expect(sim.alarms.get('apnea')!.conditionActive).toBe(false);
    sim.run(20_000 + 60_000 / APNEA_BACKUP_RATE_PER_MIN + 2500 - 19_500);
    const a = sim.alarms.get('apnea')!;
    expect(a.conditionActive).toBe(true);
    expect(a.priority).toBe('high');
    expect(a.onsetAtMs).toBeGreaterThanOrEqual(20_000);
    expect(a.onsetAtMs).toBeLessThan(20_100);
    expect(sim.alarms.bar().color).toBe('red');
    const b = sim.breaths;
    expect(b.length).toBeGreaterThanOrEqual(1);
    expect(b[0]!.type).toBe('backup');
    expect(b[0]!.startSimTimeMs).toBeGreaterThanOrEqual(20_000);
    expect(b[0]!.ppeak).toBeCloseTo(17, 0); // PEEP 5 + Pinsp de respaldo 12
    expect(b[0]!.tInspS).toBeCloseTo(1, 2);
    // Segunda de respaldo 60/12 = 5 s después de la primera.
    const inicio2 = sim.frame().live.phase === 'exp' ? null : sim.breaths.at(-1)!.endSimTimeMs;
    expect(inicio2 === null ? b[0]!.endSimTimeMs : inicio2).toBeGreaterThan(b[0]!.startSimTimeMs);
    expect(sim.breaths.at(-1)!.endSimTimeMs - b[0]!.startSimTimeMs).toBeCloseTo(5000, -3);
  });

  it('cuando el paciente vuelve a disparar, la apnea se resuelve pero el respaldo sigue hasta que se confirma el modo', () => {
    // Como el equipo (URM SW10 5-11 y 8-9): el respaldo es A/C PC con los ajustes de respaldo; los disparos del paciente son
    // asistidas por presión, no soporte, hasta que alguien confirma el modo en el diálogo de modos.
    const sim = benchSim({ settings: PS });
    sim.run(31_000); // apnea a los 20 s, dos de respaldo (20 s y 25 s), la tercera a los 30 s
    expect(sim.breaths.filter((b) => b.type === 'backup').length).toBeGreaterThanOrEqual(2);
    expect(sim.alarms.get('backup')!.conditionActive).toBe(true);
    expect(sim.alarms.get('backup')!.priority).toBe('medium');
    sim.command({ type: 'setEffort', params: { ...esfuerzo } });
    const antes = sim.breaths.length;
    sim.run(12_000);
    const nuevas = sim.breaths.slice(antes);
    expect(nuevas.length).toBeGreaterThanOrEqual(2);
    // El paciente dispara y la apnea se resuelve, pero sus respiraciones son asistidas a PEEP + Pinsp de respaldo.
    const a = sim.alarms.get('apnea')!;
    expect(a.conditionActive).toBe(false);
    expect(a.resolvedAtMs).not.toBeNull();
    expect(nuevas.some((b) => b.type === 'assisted')).toBe(true);
    expect(nuevas.some((b) => b.type === 'spontaneous')).toBe(false);
    for (const b of nuevas.filter((x) => x.type === 'assisted')) expect(b.ppeak).toBeCloseTo(5 + 12, 0);
    expect(sim.frame().live.respaldo).toBe('apnea');
    // Confirmar el modo termina el respaldo: vuelven las espontáneas a PEEP + PS.
    expect(sim.command({ type: 'confirmSettings', changes: { mode: 'CPAP_PS' } }).accepted).toBe(true);
    const tras = sim.breaths.length;
    sim.run(12_000);
    expect(sim.frame().live.respaldo).toBeNull();
    expect(sim.alarms.get('backup')!.conditionActive).toBe(false);
    const despues = sim.breaths.slice(tras + 1);
    expect(despues.length).toBeGreaterThanOrEqual(2);
    expect(despues.every((b) => b.type === 'spontaneous')).toBe(true);
  });

  it('un ajuste rápido (FiO2) no termina el respaldo: sólo confirmar el modo', () => {
    const sim = benchSim({ settings: PS });
    sim.run(31_000);
    sim.command({ type: 'confirmSettings', changes: { fio2: 0.4 } });
    sim.run(6_000);
    expect(sim.frame().live.respaldo).toBe('apnea');
  });

  it('respaldo por VMesp: en CPAP/PS, un VMesp bajo la mitad de su límite bajo pasa al respaldo aunque haya disparos', () => {
    // Paciente que dispara poco y con poco volumen: VMesp ≈ 1,7 L/min frente a un límite bajo de 4 (la mitad, 2).
    const sim = benchSim({
      effort: { ...esfuerzo, amplitude: 3, ratePerMin: 6 },
      settings: { ...PS, psupport: 4 },
      alarmLimits: { ...DEFAULT_ALARM_LIMITS, mveLow: 4 },
    });
    sim.run(90_000);
    expect(sim.frame().live.respaldo).toBe('vmesp');
    expect(sim.alarms.get('backup')!.conditionActive).toBe(true);
  });

  it('frecuencia mínima 10/min con paciente a 6/min: entran obligatorias por presión entre las espontáneas y no hay apnea', () => {
    const sim = benchSim({ effort: { ...esfuerzo, ratePerMin: 6 }, settings: { ...PS, minRate: 10, apneaTimeS: 20 } });
    sim.run(70_000);
    const tipos = new Set(sim.breaths.map((b) => b.type));
    expect(tipos.has('spontaneous')).toBe(true);
    expect(tipos.has('mandatory')).toBe(true);
    expect(tipos.has('backup')).toBe(false);
    expect(sim.alarms.get('apnea')!.conditionActive).toBe(false);
    const m = sim.frame().metrics;
    expect(m.rrSpont!.value!).toBeCloseTo(6, 0);
    expect(m.rr!.value!).toBeGreaterThan(m.rrSpont!.value! + 3);
    // Las obligatorias van a PEEP + Pinsp de respaldo; las espontáneas a PEEP + PS.
    for (const b of sim.breaths.slice(2)) expect(b.ppeak).toBeCloseTo(b.type === 'mandatory' ? 17 : 15, 0);
  });
});

describe('PHY-03c · validación y cambio de modo', () => {
  it('PEEP + PS y PEEP + Pinsp de respaldo deben quedar bajo Pmáx; el ciclaje sólo admite su rejilla de 5 %', () => {
    const v = validateVcSettings({ ...PS, psupport: 35, pmax: 40 }, VC_ADULT_CROSS_LIMITS);
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/PEEP \+ PS/);
    expect(validateVcSettings({ ...PS, backupPinsp: 36, pmax: 40 }, VC_ADULT_CROSS_LIMITS).reasons.join(' ')).toMatch(/respaldo/);
    // La frecuencia mínima tiene que dejar espirar tras el Tinsp de respaldo.
    expect(validateVcSettings({ ...PS, minRate: 60, backupTinspS: 1 }, VC_ADULT_CROSS_LIMITS).ok).toBe(false);
    expect(validateVcSettings({ ...PS, minRate: 12 }, VC_ADULT_CROSS_LIMITS).ok).toBe(true);
    const sim = benchSim({ settings: PS });
    expect(sim.command({ type: 'confirmSettings', changes: { expTriggerPct: 0.27 } }).accepted).toBe(false);
    expect(sim.command({ type: 'confirmSettings', changes: { expTriggerPct: 0.3 } }).accepted).toBe(true);
  });

  it('al pasar de A/C VC a CPAP/PS con paciente activo no se cuela la obligatoria del temporizador: se espera al paciente', () => {
    const sim = benchSim({ effort: esfuerzo, settings: { ...BENCH_SETTINGS, assistControl: true, biasFlow: 4 / 60 } });
    runUntilBreath(sim, 3);
    expect(sim.command({ type: 'confirmSettings', changes: { mode: 'CPAP_PS', psupport: 10 } }).accepted).toBe(true);
    const antes = sim.breaths.length;
    sim.run(15_000);
    expect(sim.frame().settings.mode).toBe('CPAP_PS');
    const nuevas = sim.breaths.slice(antes + 1); // la respiración en curso al confirmar terminó como empezó
    expect(nuevas.length).toBeGreaterThanOrEqual(2);
    expect(nuevas.every((b) => b.type === 'spontaneous')).toBe(true);
  });

  it('una sesión de un motor anterior sin los ajustes de CPAP/PS se importa completándolos con el valor por omisión', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    const good = exportSession(sim) as unknown as { engineVersion: string; init: { settings: Record<string, unknown> } };
    const legacy = { ...good, engineVersion: '0.3.0', init: { ...good.init, settings: { ...good.init.settings } } };
    for (const k of ['psupport', 'expTriggerPct', 'minRate', 'backupPinsp', 'backupTinspS', 'apneaTimeS']) delete legacy.init.settings[k];
    const r = importSession(JSON.stringify(legacy));
    expect(r.ok).toBe(true);
    expect((r as { warnings: string[] }).warnings.join(' ')).toMatch(/completados con el valor por omisión/);
  });
});

// SUP-URM · el soporte termina y sube como el del equipo (URM SW10 5-3, 5-4 y 11-9).
describe('SUP-URM · ciclado por presión, rampa propia y Tsupp del equipo', () => {
  it('si algo empuja el gas de vuelta de golpe (tos), la inspiración termina al pasar PEEP + PS + 2,5 cmH₂O', () => {
    // A mitad de una inspiración soportada la compliance cae de 50 a 15 mL/cmH₂O (como una tos o una compresión): el
    // pulmón empuja el gas de vuelta, la válvula inspiratoria no lo admite, la Pva sube y el equipo corta por presión.
    const sim = benchSim({ settings: { ...PS, expTriggerPct: 0.05 }, effort: esfuerzo });
    runUntilBreath(sim, 3);
    while (sim.controller.phase !== 'inspSupport') sim.step();
    sim.run(200);
    sim.command({ type: 'setPatient', params: { crs: 0.015 } });
    const n = sim.breaths.length;
    while (sim.breaths.length === n) sim.step();
    const b = sim.breaths.at(-1)!;
    expect(b.cyclingCause).toBe('pressure');
    // Con un esfuerzo suave el flujo cae bajo el 5 % antes de invertirse: cicla por flujo, también en el equipo.
    const suave = benchSim({ settings: { ...PS, expTriggerPct: 0.05 }, effort: { ...esfuerzo, shape: 'riseRelax', expAmplitude: 10 } });
    runUntilBreath(suave, 8);
    expect(suave.breaths.some((x) => x.cyclingCause === 'pressure')).toBe(false);
  });

  it('la rampa del soporte llega al 90 % de PS en el tiempo programado, como define el equipo la PS Rise Time', () => {
    // Fuente ideal (sin el lazo de presión) para leer la rampa sola; 50 ms es la PS Rise Time de fábrica del equipo.
    const sim = benchSim({ patient: { ...BENCH_PATIENT, pressureLoopGain: 0 }, settings: { ...PS, riseMs: 50 }, effort: esfuerzo });
    runUntilBreath(sim, 3);
    let t0: number | null = null,
      t90: number | null = null;
    while (sim.breaths.length < 4 && t90 === null) {
      sim.step();
      const f = sim.frame();
      if (f.live.phase === 'inspSupport' && t0 === null) t0 = sim.simTimeMs - 4;
      if (t0 !== null && t90 === null && f.live.paw >= 5 + 0.9 * 10) t90 = sim.simTimeMs - t0;
    }
    expect(t90).not.toBeNull();
    expect(t90!).toBeGreaterThan(40);
    expect(t90!).toBeLessThan(62);
  });

  it('Tsupp: el tope de la inspiración soportada es 4 s en adultos', () => {
    expect(SUPPORT_TI_MAX_S).toBe(4);
  });
});

// PHY-03d · retardos del respaldo (D, URM SW10 8-26 y 8-27): «Backup ventilation on» espera 10 s desde que terminó el
// último respaldo, y tras confirmar un modo 10 s por apnea y 60 s por VMesp.
describe('PHY-03d · retardos del respaldo', () => {
  it('tras confirmar el modo, la apnea vuelve a alarmar enseguida pero el respaldo espera 10 s', () => {
    const sim = benchSim({ settings: { ...PS, apneaTimeS: 5 } });
    sim.run(12_000); // apnea a los 5 s y respaldo cada 5 s
    expect(sim.frame().live.respaldo).toBe('apnea');
    const t0 = sim.simTimeMs;
    expect(sim.command({ type: 'confirmSettings', changes: { mode: 'CPAP_PS' } }).accepted).toBe(true);
    expect(sim.frame().live.respaldo).toBeNull();
    expect(sim.controller.respaldoRetenido('apnea')).toBe(true);
    sim.run(9_000);
    // El paciente sigue sin respirar: la apnea sigue activa, pero en estos 9 s no entra ninguna de respaldo.
    expect(sim.alarms.get('apnea')!.conditionActive).toBe(true);
    expect(sim.breaths.filter((b) => b.startSimTimeMs > t0 + 100 && b.type === 'backup')).toHaveLength(0);
    expect(sim.frame().live.respaldo).toBeNull();
    // La respiración se registra al terminar: se deja correr hasta que la primera de respaldo haya acabado.
    sim.run(6_000);
    const primera = sim.breaths.find((b) => b.startSimTimeMs > t0 + 100 && b.type === 'backup');
    expect(primera).toBeDefined();
    expect(primera!.startSimTimeMs - t0).toBeGreaterThanOrEqual(BACKUP_DELAY_AFTER_MODE_S.apnea * 1000 - 5);
    expect(primera!.startSimTimeMs - t0).toBeLessThan(BACKUP_DELAY_AFTER_MODE_S.apnea * 1000 + 50);
    expect(sim.frame().live.respaldo).toBe('apnea');
  });

  it('por VMesp, tras confirmar el modo el respaldo no vuelve antes de 60 s aunque el VMesp siga bajo', () => {
    const sim = benchSim({
      effort: { ...esfuerzo, amplitude: 3, ratePerMin: 6 },
      settings: { ...PS, psupport: 4 },
      alarmLimits: { ...DEFAULT_ALARM_LIMITS, mveLow: 4 },
    });
    sim.run(90_000);
    expect(sim.frame().live.respaldo).toBe('vmesp');
    const t0 = sim.simTimeMs;
    sim.command({ type: 'confirmSettings', changes: { mode: 'CPAP_PS' } });
    let vuelta: number | null = null;
    for (let i = 0; i < 120_000 / 4 && vuelta === null; i++) {
      sim.step();
      if (sim.frame().live.respaldo !== null) vuelta = sim.simTimeMs - t0;
    }
    expect(vuelta).not.toBeNull();
    expect(vuelta!).toBeGreaterThanOrEqual(BACKUP_DELAY_AFTER_MODE_S.vmesp * 1000);
  });

  it('los plazos: 10 s desde el fin del respaldo para las dos causas, y desde el modo 10 s la apnea y 60 s el VMesp', () => {
    const sim = benchSim({ settings: { ...PS, apneaTimeS: 5 } });
    sim.run(8_000);
    sim.command({ type: 'confirmSettings', changes: { mode: 'CPAP_PS' } });
    const c = sim.controller;
    sim.run(9_900);
    expect(c.respaldoRetenido('apnea')).toBe(true);
    expect(c.respaldoRetenido('vmesp')).toBe(true);
    sim.run(200);
    expect(c.respaldoRetenido('apnea')).toBe(false);
    expect(c.respaldoRetenido('vmesp')).toBe(true);
    sim.run(50_000);
    expect(c.respaldoRetenido('vmesp')).toBe(false);
    expect(BACKUP_DELAY_AFTER_BACKUP_S).toBe(10);
  });
});
