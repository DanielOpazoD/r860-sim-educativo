// Verificador de fronteras entre capas (sin dependencias). Falla si un módulo importa en valor una capa que no le corresponde.
// Capas (de abajo arriba): domain → engine → profiles/scenarios → history → app → ui. render es hoja; workers sólo usa app.
// Los `import type` no cuentan: desaparecen en tiempo de ejecución y no acoplan comportamiento.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';

const ROOT = resolve('src');
const ALLOWED = {
  domain: ['domain'],
  engine: ['domain', 'engine'],
  profiles: ['domain', 'profiles'],
  scenarios: ['domain', 'scenarios'],
  fixtures: ['domain', 'engine', 'profiles', 'fixtures'],
  history: ['domain', 'engine', 'profiles', 'history'],
  app: ['domain', 'engine', 'profiles', 'scenarios', 'history', 'app'],
  render: ['render'],
  ui: ['domain', 'engine', 'profiles', 'scenarios', 'history', 'app', 'render', 'fixtures', 'ui'],
  workers: ['app'],
  '': ['ui'],
};
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.ts$/.test(e) && !/\.d\.ts$/.test(e)) out.push(p);
  }
  return out;
}
const layerOf = (file) => relative(ROOT, file).split(sep)[0].replace(/\.ts$/, '') === 'main' ? '' : relative(ROOT, file).split(sep)[0];
const problems = [];
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  const layer = layerOf(file);
  const allowed = ALLOWED[layer];
  if (!allowed) {
    problems.push(`${relative(ROOT, file)}: capa desconocida «${layer}»`);
    continue;
  }
  const seen = new Map();
  for (const m of src.matchAll(/^import\s+(type\s+)?(?:[^'"]*?)\s*from\s+['"]([^'"]+)['"]/gm)) {
    const [, typeOnly, spec] = m;
    if (!spec.startsWith('.')) continue;
    const target = resolve(dirname(file), spec);
    const rel = relative(ROOT, target);
    if (rel.startsWith('..')) continue;
    const key = spec.replace(/\.(ts|js|json)$/, '');
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (typeOnly) continue;
    const targetLayer = rel.split(sep)[0].replace(/\.ts$/, '');
    if (!allowed.includes(targetLayer)) problems.push(`${relative(ROOT, file)} → ${spec}: la capa «${layer}» no puede importar «${targetLayer}» en valor`);
  }
  for (const [k, n] of seen) if (n > 1) problems.push(`${relative(ROOT, file)}: importa «${k}» ${n} veces (unifica la declaración)`);
}
if (problems.length) {
  console.error('Fronteras entre capas violadas:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('fronteras de capas: correctas');
