import { describe, expect, it } from 'vitest';
import { benchSim, runUntilBreath, BENCH_SETTINGS } from '../helpers';
import type { MetricSample } from '../../src/domain/types';
import type { EngineFrame } from '../../src/engine/simulator';
import { ALL_METRICS, DATA_TABLE_GROUPS, metricQuality, metricStatus, type MetricSpec } from '../../src/ui/metricsTable';

const ppeak = ALL_METRICS.find((m) => m.key === 'ppeak') as MetricSpec;
const pplat = ALL_METRICS.find((m) => m.key === 'pplat') as MetricSpec;

function frameWithBreaths(): EngineFrame {
  const sim = benchSim();
  runUntilBreath(sim, 2);
  return sim.frame();
}

function ppeakSample(frame: EngineFrame): MetricSample {
  return frame.metrics.ppeak!;
}

describe('metricStatus · calidad compacta y procedencia', () => {
  it('no hay frame', () => {
    expect(metricStatus(null, ppeak)).toEqual({ tone: 'off', label: '', source: '', detail: '' });
  });

  it('en espera', () => {
    const frame = frameWithBreaths();
    frame.ventilation = 'standby';
    expect(metricStatus(frame, ppeak)).toMatchObject({ tone: 'off', label: 'En espera', source: '', detail: 'En espera' });
  });

  it('muestra ausente', () => {
    const frame = frameWithBreaths();
    delete frame.metrics.ppeak;
    expect(metricStatus(frame, ppeak)).toMatchObject({ tone: 'off', label: 'Sin dato', source: '', detail: 'Sin dato' });
  });

  it.each([
    ['valid', 'ok', 'Válido'],
    ['stale', 'warn', 'Antiguo'],
    ['inProgress', 'warn', 'En curso'],
    ['invalid', 'warn', 'No válido'],
    ['unavailable', 'off', 'No disponible'],
  ] as const)('traduce quality=%s a tono %s y etiqueta «%s»', (quality, tone, label) => {
    const frame = frameWithBreaths();
    ppeakSample(frame).quality = quality;
    expect(metricStatus(frame, ppeak)).toEqual({
      tone,
      label,
      source: 'Sensor',
      detail: metricQuality(frame, ppeak),
    });
  });

  it.each([
    ['ventilator', 'Sensor'],
    ['airwayModule', 'Módulo vía aérea'],
    ['procedure', 'Maniobra'],
    ['derivedModel', 'Calculado'],
    ['fixture', 'Transcripción'],
  ] as const)('abrevia el origen %s', (source, expected) => {
    const frame = frameWithBreaths();
    ppeakSample(frame).source = source;
    expect(metricStatus(frame, ppeak).source).toBe(expected);
  });

  it('sin bloqueo inspiratorio', () => {
    expect(metricStatus(frameWithBreaths(), pplat)).toMatchObject({
      tone: 'off',
      label: 'Requiere bloqueo',
      source: '',
    });
  });

  it('muestra válida de bloqueo informa el tiempo transcurrido y conserva el detalle completo', () => {
    const sim = benchSim();
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    runUntilBreath(sim, 2);
    const frame = sim.frame();
    const status = metricStatus(frame, pplat);
    expect(status.tone).toBe('ok');
    expect(status.label).toMatch(/^Bloqueo · hace \d{2}:\d{2}$/);
    expect(status.label.replace('Bloqueo · ', '')).toBe(metricQuality(frame, pplat).match(/hace \d{2}:\d{2}/)?.[0]);
    expect(status.source).toBe('');
    expect(status.detail).toBe(metricQuality(frame, pplat));
  });

  it('bloqueo existente sin muestra', () => {
    const sim = benchSim();
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    runUntilBreath(sim, 2);
    const frame = sim.frame();
    delete frame.procedure.last.inspHold!.values.pplat;
    expect(metricStatus(frame, pplat)).toMatchObject({
      tone: 'off',
      label: 'Sin dato',
      source: '',
      detail: 'Sin dato',
    });
  });

  it('bloqueo inspiratorio no válido', () => {
    const sim = benchSim({
      effort: { enabled: true, amplitude: 8, ratePerMin: 30, tiS: 0.8, phaseS: 0.2 },
      settings: { ...BENCH_SETTINGS, assistControl: false },
    });
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    runUntilBreath(sim, 2);
    expect(metricStatus(sim.frame(), pplat)).toMatchObject({
      tone: 'warn',
      label: 'Bloqueo no válido',
      source: '',
    });
  });
});

describe('DATA_TABLE_GROUPS · cobertura de la tabla', () => {
  it('incluye todas las mediciones exactamente una vez', () => {
    const keys = DATA_TABLE_GROUPS.flatMap((table) => table.flatMap((group) => group.keys));
    expect(keys).toHaveLength(ALL_METRICS.length);
    expect(new Set(keys).size).toBe(ALL_METRICS.length);
    expect([...keys].sort()).toEqual(ALL_METRICS.map((m) => m.key).sort());
  });
});
