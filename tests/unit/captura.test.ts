import { describe, expect, it } from 'vitest';
import { Simulator, type EngineFrame } from '../../src/engine/simulator';
import { defaultInit, REFERENCE_PROFILE } from '../../src/profiles';
import { MON_CSS } from '../../src/render/monitorPalette';
import { SCENARIOS } from '../../src/scenarios';
import { paintSnapshot } from '../../src/ui/exports';
import { alarmBandLabel, learnerText } from '../../src/ui/humanize';

// CAP-01 · la «Captura PNG» dice lo mismo que el monitor. Se pinta a mano en un lienzo propio y se había quedado atrás:
// escribía el mensaje interno de la alarma (no el del alumno), sin la prioridad encima, sin el borde de color de la
// medición que alarma (URM SW10 8-7) y sin la línea «Fuga %». El lienzo falso graba lo que se escribe y se traza.

function cuadro(id: string, hastaMs: number): EngineFrame {
  const e = SCENARIOS.find((s) => s.id === id)!;
  const base = defaultInit({});
  const sim = new Simulator(
    defaultInit({
      patient: { ...e.patient },
      effort: { ...e.effort },
      sensors: { ...e.sensors },
      settings: { ...base.settings, ...(e.settings ?? {}) },
      initialV: e.initialV ?? 'equilibrium',
    }),
    REFERENCE_PROFILE,
  );
  const pendientes = [...(e.perturbations ?? [])];
  while (sim.simTimeMs < hastaMs) {
    sim.step();
    while (pendientes.length && sim.simTimeMs >= pendientes[0]!.atSimTimeMs) {
      const p = pendientes.shift()!;
      if (p.patient) sim.command({ type: 'setPatient', params: p.patient });
      if (p.effort) sim.command({ type: 'setEffort', params: p.effort });
      if (p.sensors) sim.command({ type: 'setSensors', params: p.sensors });
    }
  }
  return sim.frame();
}

function pintar(fr: EngineFrame) {
  const textos: { s: string; color: string }[] = [];
  const bordes: string[] = [];
  const estado = { fillStyle: '', strokeStyle: '' };
  const ctx = new Proxy(estado as Record<string, unknown>, {
    get(t, p) {
      if (p === 'fillText') return (s: string) => textos.push({ s: String(s), color: String(t.fillStyle) });
      if (p === 'stroke') return () => bordes.push(String(t.strokeStyle));
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: () => undefined });
      if (p in t) return t[p as string];
      return () => undefined;
    },
    set(t, p, v) {
      t[p as string] = v;
      return true;
    },
  });
  const lienzo = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  paintSnapshot(lienzo, {
    frame: fr,
    view: 'waves',
    waveCanvas: lienzo,
    gaugeCanvas: lienzo,
    holdVisible: false,
    scenarioName: 'prueba',
    quickItems: [['Modo actual', 'A/C VC']],
  });
  return { textos: textos.map((t) => t.s), bordes };
}

describe('CAP-01 · la captura exportada dice lo mismo que el monitor', () => {
  it('SC-09 en alarma alta: prioridad arriba, mensaje del alumno debajo y Ppico con borde rojo', () => {
    const fr = cuadro('SC-09', 20_000);
    expect(fr.alarmBar.color).toBe('red');
    const { textos, bordes } = pintar(fr);
    const [prioridad, mensaje] = alarmBandLabel(fr.alarmBar).split(' · ');
    expect(textos).toContain(prioridad);
    expect(textos).toContain(mensaje);
    expect(mensaje).toBe(learnerText(fr.alarmBar.message));
    expect(bordes).toContain(MON_CSS.alta);
  });

  it('sin alarmas: «Sin alarmas», ningún borde de prioridad, y la línea de fuga con su cifra', () => {
    const fr = cuadro('SC-22', 20_000);
    expect(fr.alarmBar.color).toBe('green');
    const { textos, bordes } = pintar(fr);
    expect(textos).toContain('Sin alarmas');
    expect(bordes).not.toContain(MON_CSS.alta);
    expect(bordes).not.toContain(MON_CSS.media);
    expect(textos.find((t) => t.startsWith('Fuga % '))).toMatch(/^Fuga % \d+$/);
  });
});
