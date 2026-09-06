import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(ts|css|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('SEC-01 · inspección estática: sin WebUSB/WebSerial/Bluetooth ni conexiones externas en el código fuente', () => {
  it('ninguna referencia a navigator.usb/serial/bluetooth, WebSocket, fetch externo ni eval', () => {
    const files = walk(path.resolve(__dirname, '../../src'));
    const bad: string[] = [];
    for (const f of files) {
      const s = fs.readFileSync(f, 'utf8');
      for (const re of [/navigator\.(usb|serial|bluetooth|hid)/, /new WebSocket\(/, /\beval\(/, /new Function\(/, /fetch\(\s*['"]https?:/, /XMLHttpRequest/]) if (re.test(s)) bad.push(`${path.basename(f)}: ${re}`);
    }
    expect(bad).toEqual([]);
  });
  it('sin dependencias de ejecución en package.json (aplicación local, sin backend)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies ?? {}).toEqual({});
  });
});
