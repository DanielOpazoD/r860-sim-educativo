import { expect, it } from 'vitest';
import { EngineHost } from '../../src/app/engineHost';
import type { EngineToMain } from '../../src/app/protocol';
import { defaultInit } from '../../src/profiles';
import { findScenario } from '../../src/scenarios';

function harness() {
  const posts: EngineToMain[] = [];
  const host = new EngineHost((m) => posts.push(m));
  const frame = () => {
    host.handle({ type: 'requestFrame' });
    return posts.filter((m) => m.type === 'frame').at(-1)!;
  };
  const advance = () => {
    for (let t = 0; t <= 1000; t += 20) host.tick(t);
  };
  return { host, posts, frame, advance };
}
it('autopausa no alineada se detiene en el primer paso que alcanza el objetivo', () => {
  const { host, frame, advance } = harness();
  host.handle({ type: 'init', init: defaultInit(), speed: 1, running: true, autopauseAtMs: 12001 });
  host.stop();
  advance();
  expect(frame()).toMatchObject({ running: false, pauseReason: 'pausa automática', frame: { simTimeMs: 12004 } });
});
it('el calentamiento de SC-12 aplica el sesgo en 10000 ms', () => {
  const { host, posts, advance } = harness();
  host.handle({ type: 'init', init: defaultInit(), speed: 1, running: true });
  host.stop();
  host.handle({ type: 'loadScenario', scenario: findScenario('SC-12')!, keepSettings: false });
  advance();
  host.handle({ type: 'exportSession', id: 1 });
  const file = posts.find((m) => m.type === 'session')!;
  expect(file.type).toBe('session');
  if (file.type === 'session') expect(file.file.commands.find((c) => c.command.type === 'setSensors')?.simTimeMs).toBe(10000);
});
it('cambiar escenario descarta la autopausa del mundo anterior', () => {
  const { host, frame, advance } = harness();
  host.handle({ type: 'init', init: defaultInit(), speed: 1, running: true, autopauseAtMs: 12001 });
  host.stop();
  host.handle({ type: 'loadScenario', scenario: findScenario('SC-01')!, keepSettings: false });
  advance();
  expect(frame().running).toBe(true);
  expect(frame().frame.simTimeMs).toBeGreaterThan(12004);
});

for (const [target, expected] of [
  [0, 0],
  [1, 4],
  [12000, 12000],
  [12001, 12004],
  [12003, 12004],
  [12004, 12004],
] as const) {
  it(`autopausa ${target} → ${expected}, una sola vez, también durante calentamiento`, () => {
    const { host, frame, advance } = harness();
    host.handle({ type: 'init', init: defaultInit(), speed: 1, running: true, autopauseAtMs: target });
    host.stop();
    advance();
    expect(frame()).toMatchObject({ running: false, pauseReason: 'pausa automática', frame: { simTimeMs: expected } });
    host.handle({ type: 'control', action: 'resume', reason: '' });
    advance();
    expect(frame().running).toBe(true);
    expect(frame().frame.simTimeMs).toBeGreaterThan(expected);
  });
}
for (const id of ['SC-02', 'SC-12']) {
  it(`${id}: un único init conserva la pausa y programa perturbaciones desde cero`, () => {
    const { host, frame, advance, posts } = harness();
    const scenario = findScenario(id)!;
    host.handle({
      type: 'init',
      init: defaultInit({ patient: scenario.patient, effort: scenario.effort, sensors: scenario.sensors }),
      scenario,
      speed: 1,
      running: false,
    });
    host.stop();
    const before = frame();
    advance();
    expect(frame()).toEqual(before);
    expect(before).toMatchObject({ running: false, pauseReason: 'inicio', generation: 1 });
    if (id === 'SC-12') {
      host.handle({ type: 'exportSession', id: 1 });
      const file = posts.find((m) => m.type === 'session')!;
      if (file.type === 'session')
        expect(file.file.commands.filter((c) => c.command.type === 'setSensors').map((c) => c.simTimeMs)).toEqual([10000]);
    }
  });
}
it('sin eventos, calentamiento y avance normal producen el mismo estado', () => {
  const a = harness();
  const b = harness();
  a.host.handle({ type: 'init', init: defaultInit(), speed: 1, running: false });
  a.host.stop();
  b.host.handle({ type: 'init', init: defaultInit(), speed: 1, running: true, warmUp: false });
  b.host.stop();
  for (let t = 0; t <= 12000; t += 20) b.host.tick(t);
  const fa = a.frame().frame;
  const fb = b.frame().frame;
  // Las muestras son deltas de transporte y se vacían al publicar; comparar el estado persistente.
  expect({ ...fa, samples: null }).toEqual({ ...fb, samples: null });
});
