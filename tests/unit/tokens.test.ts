import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesDir = new URL('../../src/ui/styles/', import.meta.url);
const cssNames = readdirSync(stylesDir)
  .filter((file) => file.endsWith('.css'))
  .sort();
const cssFiles = cssNames.map((file) => readFileSync(new URL(file, stylesDir), 'utf8'));
const css = cssFiles.join('\n');

/** Hojas del exterior (cromo claro, diálogos, panel y Aula); la pantalla del equipo conserva sus px. */
const EXTERIOR = [
  '03-laboratorio.css',
  '04-adaptaciones.css',
  '05-retroalimentacion.css',
  '06-diseno.css',
  '08-minimal.css',
  '10-classroom.css',
];
/** Tamaños que ya tienen token en la escala --type-*; en el exterior no se escriben en px. */
const SCALE_PX = ['10px', '11px', '12px', '13px', '15px', '20px', '28px'];
/** Únicos usos legítimos de !important: utilidades de estado global, no sobrescrituras de la cascada. */
const IMPORTANT_ALLOWED = [/^\[hidden\]$/, /^\*$/, /^@media print/];

interface Rule {
  context: string;
  selectors: string[];
}
/** Lista reglas (selector + contexto de at-rules) de una hoja sin dependencias externas. */
function parseRules(source: string): Rule[] {
  const out: Rule[] = [];
  const stack: string[] = [];
  let buffer = '';
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const ch of clean) {
    if (ch === '{') {
      const head = buffer.trim();
      buffer = '';
      if (head.startsWith('@')) stack.push(head);
      else {
        out.push({
          context: stack.join(' / '),
          selectors: head
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        });
        stack.push('');
      }
    } else if (ch === '}') {
      buffer = '';
      stack.pop();
    } else if (ch === ';') buffer = '';
    else buffer += ch;
  }
  return out.filter((rule) => !/keyframes/.test(rule.context));
}
const ruleKey = (rule: Rule): string => `${rule.context}||${[...rule.selectors].sort().join(',')}`;
const perFile = cssNames.map((name, i) => ({ name, source: cssFiles[i] ?? '', rules: parseRules(cssFiles[i] ?? '') }));
const declaredProperties = new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((match) => match[1]));
const usedProperties = new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]));

describe('tokens CSS', () => {
  it('declara todas las propiedades personalizadas usadas por las parciales', () => {
    const missing = [...usedProperties].filter((property) => !declaredProperties.has(property)).sort();
    expect(missing).toEqual([]);
  });

  it('centraliza los neutros fusionados de 08-minimal.css en sus tokens', () => {
    const minimal = readFileSync(new URL('08-minimal.css', stylesDir), 'utf8');
    const rootTokens = /:root\s*\{[^}]*\}/.exec(minimal)?.[0] ?? '';
    const rules = minimal.replace(rootTokens, '').toLowerCase();
    const centralizedNeutrals = [
      '#e5edf5',
      '#a5b0b9',
      '#7c8993',
      '#141414',
      '#1c1c1c',
      '#262626',
      '#46505a',
      '#7b8792',
      '#65717c',
      '#5d6f80',
      '#7a8a98',
      '#82909d',
      '#9aa4ae',
      '#77838e',
      '#c2ccd5',
      '#0d0d0d',
      '#303030',
      '#a9bdcc',
      '#292929',
      '#101010',
      '#cbd4dc',
      '#26313a',
      '#0b0f12',
      '#dce4e9',
      '#e1e8ed',
    ];
    for (const color of centralizedNeutrals) expect(rules).not.toContain(color);
  });

  it('no redefine un selector dentro de la misma hoja ni reparte más de los ya conocidos entre hojas', () => {
    const owners = new Map<string, Set<string>>();
    const repeatedWithin: string[] = [];
    for (const { name, rules: list } of perFile) {
      const seen = new Set<string>();
      for (const rule of list) {
        const key = ruleKey(rule);
        if (seen.has(key)) repeatedWithin.push(`${name}: ${rule.selectors.join(', ')}`);
        seen.add(key);
        if (!owners.has(key)) owners.set(key, new Set());
        owners.get(key)?.add(name);
      }
    }
    const acrossSheets = [...owners.values()].filter((set) => set.size > 1).length;
    // Trinquete: sólo puede bajar. Las 10 repeticiones restantes separan propiedades que otra regla intermedia también declara.
    expect(repeatedWithin.length).toBeLessThanOrEqual(10);
    expect(acrossSheets).toBeLessThanOrEqual(76);
  });

  it('reserva !important para [hidden], movimiento reducido e impresión', () => {
    const offenders: string[] = [];
    for (const { name, source: raw, rules: list } of perFile) {
      const source = raw.replace(/\/\*[\s\S]*?\*\//g, '');
      const blocks = [...source.matchAll(/([^{}]+)\{([^{}]*!important[^{}]*)\}/g)];
      for (const block of blocks) {
        const selector = (block[1]?.split('{').pop() ?? '').replace(/\s+/g, ' ').trim();
        const context = list.find((rule) => rule.selectors.join(', ') === selector)?.context ?? '';
        if (!IMPORTANT_ALLOWED.some((re) => re.test(selector) || re.test(context))) offenders.push(`${name}: ${selector}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('usa la escala --type-* en el exterior en vez de px sueltos', () => {
    const offenders: string[] = [];
    for (const { name, source } of perFile.filter((file) => EXTERIOR.includes(file.name))) {
      for (const match of source.matchAll(/font-size:\s*([^;]+);/g))
        if (SCALE_PX.includes(match[1]?.trim() ?? '')) offenders.push(`${name}: ${match[1]}`);
    }
    expect(offenders).toEqual([]);
  });
});
