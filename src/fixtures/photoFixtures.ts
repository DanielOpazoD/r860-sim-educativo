import type { AlarmLimits, MetricSample, ProcedureResult, VcSettings } from '../domain/types';
import type { EngineFrame } from '../engine/simulator';

/**
 * FIXTURES VISUALES (O): transcripción de las fotografías P1/P2/P3 (dossier §4). Son evidencia de interfaz, no condiciones
 * físicas completas ni ajustes clínicos sugeridos. Las discrepancias observadas se conservan a propósito (DAT-01, DAT-02):
 * P3 FiO2 programada 100 / medida 97; VT programado 285 / VTesp 295; P1 Pplat de panel 35 / bloqueo guardado 32.
 */
export interface PhotoFixture {
  id: 'P1' | 'P2' | 'P3';
  view: 'advanced' | 'basic';
  set: { mode: 'A/C VC'; fio2Pct: number; vtMl: number; rrPerMin: number; ie: string; peepCmH2O: number; pmaxCmH2O: number };
  measured: {
    fio2Pct: number;
    vteMl: number;
    rrPerMin: number;
    mveLMin: number;
    ppeakCmH2O: number;
    pplatMainCmH2O: number | null;
    peepeCmH2O: number;
    pmeanCmH2O: number | null;
    leakPct: number | null;
    mveSpont: number | null;
    rrSpont: number | null;
  };
  limits: {
    ppeakHigh: number;
    ppeakLow: number | null;
    mveHigh: number;
    mveLow: number;
    rrHigh: number;
    rrLow: number;
    vteHigh: number;
    vteLow: number;
    fio2High: number;
    fio2Low: number;
    peepe: 'off' | null;
  };
  hold: { durationS: number; pplatCmH2O: number; cstatMlCmH2O: number; displayTimestampLocal: string };
  clock: string;
}

export const PHOTO_FIXTURES: Record<'P1' | 'P3', PhotoFixture> = {
  P1: {
    id: 'P1',
    view: 'advanced',
    set: { mode: 'A/C VC', fio2Pct: 100, vtMl: 285, rrPerMin: 32, ie: '1:1.5', peepCmH2O: 18, pmaxCmH2O: 50 },
    measured: {
      fio2Pct: 100,
      vteMl: 285,
      rrPerMin: 29,
      mveLMin: 8.2,
      ppeakCmH2O: 38,
      pplatMainCmH2O: 35,
      peepeCmH2O: 18,
      pmeanCmH2O: 23,
      leakPct: 0,
      mveSpont: 0,
      rrSpont: 0,
    },
    limits: {
      ppeakHigh: 50,
      ppeakLow: 22,
      mveHigh: 20,
      mveLow: 5.0,
      rrHigh: 40,
      rrLow: 10,
      vteHigh: 425,
      vteLow: 250,
      fio2High: 100,
      fio2Low: 21,
      peepe: null,
    },
    hold: { durationS: 3, pplatCmH2O: 32, cstatMlCmH2O: 19, displayTimestampLocal: '2026-08-18T21:04:05' },
    clock: '21:04',
  },
  P3: {
    id: 'P3',
    view: 'basic',
    set: { mode: 'A/C VC', fio2Pct: 100, vtMl: 285, rrPerMin: 32, ie: '1:1.5', peepCmH2O: 16, pmaxCmH2O: 50 },
    measured: {
      fio2Pct: 97,
      vteMl: 295,
      rrPerMin: 30,
      mveLMin: 8.9,
      ppeakCmH2O: 33,
      pplatMainCmH2O: null,
      peepeCmH2O: 16,
      pmeanCmH2O: null,
      leakPct: null,
      mveSpont: null,
      rrSpont: null,
    },
    limits: {
      ppeakHigh: 50,
      ppeakLow: 20,
      mveHigh: 20,
      mveLow: 5.0,
      rrHigh: 40,
      rrLow: 10,
      vteHigh: 425,
      vteLow: 250,
      fio2High: 100,
      fio2Low: 21,
      peepe: 'off',
    },
    hold: { durationS: 3, pplatCmH2O: 28, cstatMlCmH2O: 25, displayTimestampLocal: '2026-08-19T09:31:10' },
    clock: '09:31',
  },
};

function fx(key: string, value: number | null, unit: string, reason: string | null = null): MetricSample {
  return {
    key,
    value,
    unit,
    source: 'fixture',
    simTimeMs: 0,
    breathId: null,
    procedureId: null,
    quality: value === null ? 'unavailable' : 'valid',
    reason,
    windowMs: null,
  };
}

/** Construye un cuadro de motor «congelado» a partir de la fixture: sin física, sólo transcripción. */
export function frameFromFixture(f: PhotoFixture): EngineFrame {
  const ieParts = f.set.ie.split(':').map(Number) as [number, number];
  const settings: VcSettings = {
    mode: 'AC_VC',
    fio2: f.set.fio2Pct / 100,
    vt: f.set.vtMl / 1000,
    rr: f.set.rrPerMin,
    ie: ieParts[0] / ieParts[1],
    peep: f.set.peepCmH2O,
    pmax: f.set.pmaxCmH2O,
    plimit: f.set.pmaxCmH2O,
    pausePct: 0,
    assistControl: true,
    flowTrigger: 2 / 60,
    biasFlow: 2 / 60,
    triggerByPressure: false,
    pressureTrigger: -2,
    pinsp: 10,
    riseMs: 100,
    psupport: 10,
    expTriggerPct: 0.25,
    minRate: 'off',
    backupPinsp: 10,
    backupTinspS: 1,
    apneaTimeS: 20,
  };
  const limits: AlarmLimits = {
    ppeakLow: f.limits.ppeakLow ?? 'off',
    vteLow: f.limits.vteLow / 1000,
    vteHigh: f.limits.vteHigh / 1000,
    mveLow: f.limits.mveLow,
    mveHigh: f.limits.mveHigh,
    rrLow: f.limits.rrLow,
    rrHigh: f.limits.rrHigh,
    fio2Low: f.limits.fio2Low / 100,
    fio2High: f.limits.fio2High / 100,
    peepeLow: 'off',
    peepeHigh: 'off',
  };
  const wall = new Date(f.hold.displayTimestampLocal).getTime();
  const hold: ProcedureResult = {
    procedureId: `fixture-${f.id}`,
    kind: 'inspHold',
    phase: 'completed',
    requestedAtMs: 0,
    startedAtMs: 0,
    completedAtMs: 0,
    wallTimeMs: wall,
    requestedDurationS: f.hold.durationS,
    actualDurationS: f.hold.durationS,
    breathId: null,
    quality: 'valid',
    reason: 'fixture visual',
    values: {
      pplat: { ...fx('pplatHold', f.hold.pplatCmH2O, 'cmH2O'), source: 'fixture' },
      cstat: { ...fx('cstatHold', f.hold.cstatMlCmH2O / 1000, 'L/cmH2O'), source: 'fixture' },
    },
  };
  const m = f.measured;
  return {
    engineVersion: 'fixture',
    profileVersion: 'fixture',
    simTimeMs: 0,
    wallTimeMs: wall,
    ventilation: 'ventilating',
    live: { paw: m.peepeCmH2O, flowLps: 0, volTidalL: 0, ppeakCurrent: m.ppeakCmH2O, phase: 'exp', plimitLimited: false },
    settings,
    pending: null,
    alarmLimits: limits,
    metrics: {
      ppeak: fx('ppeak', m.ppeakCmH2O, 'cmH2O'),
      peepe: fx('peepe', m.peepeCmH2O, 'cmH2O'),
      pplatCycle: fx('pplatCycle', m.pplatMainCmH2O, 'cmH2O', m.pplatMainCmH2O === null ? 'noMostradaEnEsaVista' : null),
      pmean: fx('pmean', m.pmeanCmH2O, 'cmH2O'),
      leakPct: fx('leakPct', m.leakPct === null ? null : m.leakPct / 100, 'fraction'),
      mve: fx('mve', m.mveLMin, 'L/min'),
      rr: fx('rr', m.rrPerMin, 'perMin'),
      vte: fx('vte', m.vteMl / 1000, 'L'),
      vti: fx('vti', null, 'L'),
      fio2: fx('fio2', m.fio2Pct / 100, 'fraction'),
      mveSpont: fx('mveSpont', m.mveSpont, 'L/min'),
      rrSpont: fx('rrSpont', m.rrSpont, 'perMin'),
      vteSpont: fx('vteSpont', null, 'L', 'sinRespiracionesEspontaneas'),
    },
    alarms: [],
    alarmBar: { color: 'green', message: 'Sin alarmas', activeCount: 0, pendingAckCount: 0 },
    procedure: { current: null, hold: null, last: { inspHold: hold, expHold: null, manualBreath: null, increaseO2: null }, o2: null },
    breathCount: 0,
    audioPauseUntilMs: null,
    truth: {
      vAbsL: 0,
      pel: 0,
      pVisc: 0,
      cLocal: 0,
      pmus: 0,
      peepiEndExp: 0,
      patient: { crs: 0, rInsp: 0, rExp: 0, r2: 0, p0: 0 },
      effort: { enabled: false, amplitude: 0, ratePerMin: 0, tiS: 0, phaseS: 0 },
      sensors: { fio2TauS: 0, fio2Bias: 0 },
      fio2Delivered: f.set.fio2Pct / 100,
    },
    samples: {
      t: new Float64Array(0),
      paw: new Float32Array(0),
      flow: new Float32Array(0),
      vol: new Float32Array(0),
      pmus: new Float32Array(0),
      breath: new Float32Array(0),
    },
    eventsTail: [],
    trends: [],
  };
}
