// Verificador de fronteras entre capas (sin dependencias). Falla si un módulo alcanza en valor una capa que no le corresponde.
// Capas (de abajo arriba): domain → engine → profiles/scenarios → history → app → ui. render es hoja; workers sólo usa app.
//
// Qué cuenta como alcanzar una capa, y por qué. Los `import type` no cuentan: desaparecen al compilar y no acoplan
// comportamiento. Sí cuentan las cuatro formas que dejan una dependencia en tiempo de ejecución, y las cuatro se
// comprueban porque las tres últimas fueron el agujero por el que una revisión adversarial burló este verificador:
//   import x from '…'          declaración normal
//   export … from '…'          re-exportación: acopla igual, y además propaga el módulo a quien importe éste
//   import '…'                 sólo por efecto secundario: no liga ningún nombre, pero ejecuta el módulo
//   await import('…')          dinámica: la carga es diferida, la dependencia es la misma
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
  // `domain` es la capa que no depende de nadie: dibujar puede usar sus tipos y sus conversiones de unidades sin
  // acoplarse a nada de arriba. Lo que `render` no puede es alcanzar el motor, la app ni la interfaz.
  render: ['render', 'domain'],
  ui: ['domain', 'engine', 'profiles', 'scenarios', 'history', 'app', 'render', 'fixtures', 'ui'],
  workers: ['app'],
  // main.ts es la raíz de composición: elige el perfil del equipo y se lo entrega a la interfaz. Es el único sitio
  // fuera de `profiles` que puede nombrar un perfil concreto, y por eso puede alcanzar esa capa.
  '': ['ui', 'profiles'],
};

/** Las cuatro formas de alcanzar otro módulo, con la etiqueta que se muestra en el error y si liga sólo tipos. */
const FORMAS = [
  { nombre: 'import', re: /^import\s+(type\s+)?(?:[^'"]*?)\s*from\s+['"]([^'"]+)['"]/gm, cuentaDuplicado: true },
  { nombre: 'export … from', re: /^export\s+(type\s+)?(?:[^'"]*?)\s*from\s+['"]([^'"]+)['"]/gm, cuentaDuplicado: false },
  { nombre: 'import por efecto', re: /^import\s+()['"]([^'"]+)['"]/gm, cuentaDuplicado: false },
  { nombre: 'import dinámico', re: /()\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, cuentaDuplicado: false },
];

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.ts$/.test(e) && !/\.d\.ts$/.test(e)) out.push(p);
  }
  return out;
}
const primerSegmento = (file) => relative(ROOT, file).split(sep)[0];
const layerOf = (file) => (primerSegmento(file).replace(/\.ts$/, '') === 'main' ? '' : primerSegmento(file));

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
  for (const forma of FORMAS) {
    for (const m of src.matchAll(forma.re)) {
      const [, typeOnly, spec] = m;
      if (!spec.startsWith('.')) continue;
      const rel = relative(ROOT, resolve(dirname(file), spec));
      if (rel.startsWith('..')) continue;
      if (forma.cuentaDuplicado) {
        const key = spec.replace(/\.(ts|js|json)$/, '');
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      if (typeOnly) continue;
      const targetLayer = rel.split(sep)[0].replace(/\.ts$/, '');
      if (!allowed.includes(targetLayer))
        problems.push(
          `${relative(ROOT, file)} → ${spec} (${forma.nombre}): la capa «${layer}» no puede alcanzar «${targetLayer}» en valor`,
        );
    }
  }
  for (const [k, n] of seen) if (n > 1) problems.push(`${relative(ROOT, file)}: importa «${k}» ${n} veces (unifica la declaración)`);
}
if (problems.length) {
  console.error('Fronteras entre capas violadas:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('fronteras de capas: correctas');
