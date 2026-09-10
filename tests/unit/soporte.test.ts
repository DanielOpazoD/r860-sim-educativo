import { describe, expect, it } from 'vitest';
import type { VcSettings } from '../../src/domain/types';
import { validateVcSettings } from '../../src/domain/validation';
import { APNEA_BACKUP_RATE_PER_MIN, SUPPORT_TI_MAX_S } from '../../src/engine/controller';
import { exportSession, importSession } from '../../src/history/session';
import { VC_ADULT_CROSS_LIMITS } from '../../src/profiles/r860-es-photo-reference/settings';
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

  it('cuando el paciente vuelve a disparar, la respiración es espontánea, la apnea se resuelve y el respaldo cesa', () => {
    const sim = benchSim({ settings: PS });
    sim.run(31_000); // apnea a los 20 s, dos de respaldo (20 s y 25 s), la tercera a los 30 s
    expect(sim.breaths.filter((b) => b.type === 'backup').length).toBeGreaterThanOrEqual(2);
    sim.command({ type: 'setEffort', params: { ...esfuerzo } });
    const antes = sim.breaths.length;
    sim.run(12_000);
    const nuevas = sim.breaths.slice(antes);
    expect(nuevas.length).toBeGreaterThanOrEqual(2);
    expect(nuevas.some((b) => b.type === 'spontaneous')).toBe(true);
    const a = sim.alarms.get('apnea')!;
    expect(a.conditionActive).toBe(false);
    expect(a.resolvedAtMs).not.toBeNull();
    // Desde la primera espontánea no hay más respaldo mientras el paciente respira.
    const primeraEspont = nuevas.findIndex((b) => b.type === 'spontaneous');
    expect(nuevas.slice(primeraEspont).every((b) => b.type === 'spontaneous')).toBe(true);
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
