import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '../../src/domain/types';
import { REFERENCE_PROFILE } from '../../src/profiles';
import { eventSentence, humanReason } from '../../src/ui/humanize';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

const emittedReasons = new Set(
  ['engine', 'history', 'app']
    .flatMap((directory) => sourceFiles(join(repoRoot, 'src', directory)))
    .flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/[Rr]eason:\s*'([A-Za-z]+)'/g)].map((match) => match[1])),
);

const event = (kind: SessionEvent['kind'], payload: unknown): SessionEvent => ({
  sequence: 1,
  simTimeMs: 0,
  wallTimeIso: '2026-01-01T00:00:00.000Z',
  kind,
  actor: 'learner',
  payload,
  profileVersion: 'test',
  engineVersion: 'test',
});

describe('textos internos del motor', () => {
  it('traduce todos los códigos de razón emitidos por engine, history y app', () => {
    expect(emittedReasons.size).toBeGreaterThan(0);
    for (const reason of emittedReasons) {
      const translated = humanReason(reason);
      expect(translated, `${reason} debe tener traducción`).not.toBe(reason);
      expect(translated, `${reason} no debe conservar camelCase`).not.toMatch(/[a-záéíóúñ][A-Z]/);
    }
    expect(humanReason('presionRecortadaPorElTecho')).toBe('inspiración recortada por Pmáx/Plimit: la curva no es interpretable');
  });

  it('traduce la mecánica del escenario a etiquetas y capitaliza la frase', () => {
    const sentence = eventSentence(event('scenario', { patient: { crs: 0.05 } }));
    expect(sentence).toContain('compliance');
    expect(sentence).not.toMatch(/\bcrs\b/i);
    expect(sentence.charAt(0)).toBe(sentence.charAt(0).toLocaleUpperCase('es'));

    const unknown = eventSentence(event('scenario', { patient: { internalField: true } }));
    expect(unknown).toContain('otros parámetros');
    expect(unknown).not.toContain('internalField');
  });

  it('nombra el modo CPAP/PS y sus ajustes con su escala y unidad, no con cmH₂O para todo', () => {
    const rules = REFERENCE_PROFILE.rules;
    const confirmado = eventSentence(
      event('setting', { changes: { mode: 'CPAP_PS', psupport: 12, expTriggerPct: 0.3, minRate: 'off', fio2: 0.45, apneaTimeS: 20 } }),
      rules,
    );
    expect(confirmado).toBe(
      'Usuario confirmó Modo → CPAP/PS, Presión de soporte → 12 cmH₂O, Ciclado espiratorio → 30 %, Frecuencia mínima → Off, FiO₂ → 45 %, Tiempo de apnea → 20 s',
    );
    const aplicado = eventSentence(event('setting', { applied: { backupTinspS: 1.2, vt: 0.45 } }), rules);
    expect(aplicado).toBe('Aplicado: Tinsp de respaldo → 1,20 s, Volumen corriente → 450 mL');
    expect(aplicado).not.toContain('cmH₂O');
  });

  it('omite la razón user al pausar y no expone comandos internos rechazados', () => {
    const pause = eventSentence(event('pause', { paused: true, reason: 'user' }));
    const rejected = eventSentence(event('rejected', { command: 'setPatient', reason: 'En espera: no hay ventilación' }));
    expect(pause).not.toContain('user');
    expect(rejected).not.toContain('setPatient');
    expect(rejected.charAt(0)).toBe(rejected.charAt(0).toLocaleUpperCase('es'));
  });
});
