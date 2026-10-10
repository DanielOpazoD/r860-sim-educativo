import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/ui/styles/08-minimal.css', import.meta.url), 'utf8');
const root = /:root\s*\{([\s\S]*?)\}/.exec(css)?.[1];

if (!root) throw new Error('No se encontró el bloque :root del tema exterior.');

const tokens = new Map<string, string>();
for (const match of root.matchAll(/(--[\w-]+)\s*:\s*(#[\da-fA-F]{3}|#[\da-fA-F]{6})\s*;/g)) {
  const token = match[1];
  const value = match[2];
  if (token && value) tokens.set(token, value);
}

function rgb(token: string): [number, number, number] {
  const value = tokens.get(token);
  if (!value) throw new Error(`Falta el color ${token} en :root.`);
  const hex = value.slice(1);
  const expanded = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
  return [Number.parseInt(expanded.slice(0, 2), 16), Number.parseInt(expanded.slice(2, 4), 16), Number.parseInt(expanded.slice(4, 6), 16)];
}

function luminance(color: [number, number, number]): number {
  const channels = color.map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  const [red = Number.NaN, green = Number.NaN, blue = Number.NaN] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(rgb(foreground)), luminance(rgb(background))].sort((a, b) => b - a);
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
}

describe('contraste del tema exterior', () => {
  it('mantiene una relación WCAG 2 de al menos 4.5:1', () => {
    const combinations: [string, string][] = [];
    for (const foreground of ['--shell-text', '--shell-muted', '--shell-dim']) {
      for (const background of ['--shell-bg', '--shell-surface', '--shell-raised']) {
        combinations.push([foreground, background]);
      }
    }
    combinations.push(['--shell-accent', '--shell-surface'], ['--shell-accent', '--shell-bg'], ['--shell-accent-ink', '--shell-accent']);

    for (const [foreground, background] of combinations) {
      expect(contrast(foreground, background), `${foreground} sobre ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
