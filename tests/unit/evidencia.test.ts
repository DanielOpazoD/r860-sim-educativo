import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import evidence from '../../src/profiles/adulto-referencia/evidence.json';
import gaps from '../../src/profiles/adulto-referencia/gaps.json';
import { SCENARIOS } from '../../src/scenarios';

// EVI · el registro de evidencia no puede apuntar a lo que no existe. Cada afirmación cita archivos que la implementan,
// pruebas que la sostienen y fuentes que la respaldan; si un archivo se mueve, una prueba cambia de nombre o una fuente
// se retira, la afirmación queda sosteniéndose en el aire sin que nadie lo note. Aquí se comprueba que todo lo citado
// exista: rutas, identificadores de prueba en su archivo, escenarios, fuentes y referencias E-/U- en la documentación.

const RAIZ = new URL('../../', import.meta.url).pathname;
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');
function archivos(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(join(RAIZ, dir))) {
    const ruta = `${dir}/${nombre}`;
    if (statSync(join(RAIZ, ruta)).isDirectory()) out.push(...archivos(ruta, ext));
    else if (ext.test(nombre)) out.push(ruta);
  }
  return out;
}

type Afirmacion = { id: string; status: string; source?: string; implemented?: string; tests?: string[] };
const AFIRMACIONES = evidence.claims as Afirmacion[];
const FUENTES = new Set(evidence.sources.map((s) => s.id));
const ESCENARIOS = new Set(SCENARIOS.map((s) => s.id));
const PRUEBAS = Object.fromEntries(archivos('tests', /\.ts$/).map((f) => [f, leer(f)]));
const TODAS_LAS_PRUEBAS = Object.values(PRUEBAS).join('\n');
/** Identificadores de prueba («GAS-08», «ALM-URM-AUDIO») y de escenario («SC-22», «CC-03»). */
const CODIGO = /\b[A-Z]{2,6}-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g;
const esEscenario = (c: string): boolean => /^(SC|CC)-[0-9A-Z]+$/.test(c);

describe('EVI · el registro de evidencia sólo cita lo que existe', () => {
  it('identificadores únicos, con forma E-nnn y U-nn, y fuentes únicas', () => {
    const ids = AFIRMACIONES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^E-\d{3}$/);
    expect(FUENTES.size).toBe(evidence.sources.length);
    const u = gaps.gaps.map((g) => g.id);
    expect(new Set(u).size).toBe(u.length);
    for (const id of u) expect(id).toMatch(/^U-\d{2}$/);
  });

  it('cada afirmación lleva su marca D, D-secundario, O, P o U', () => {
    for (const c of AFIRMACIONES) expect(c.status, c.id).toMatch(/^(D-secundario|D|O|P|U)\b/);
  });

  it('las fuentes citadas están en la lista de fuentes', () => {
    for (const c of AFIRMACIONES)
      for (const f of (c.source ?? '').match(/\b(?:[RC]\d{2}|P\d|DOSSIER|BIBLIO)\b/g) ?? [])
        expect(FUENTES.has(f), `${c.id} cita ${f}`).toBe(true);
  });

  it('los archivos que la implementan existen', () => {
    for (const c of AFIRMACIONES)
      for (const ruta of (c.implemented ?? '').match(/\b(?:src|tests|docs|scripts)\/[\w./-]+\.(?:ts|css|json|md|mjs|py|html)\b/g) ?? [])
        expect(existsSync(join(RAIZ, ruta)), `${c.id}: ${ruta}`).toBe(true);
  });

  it('las pruebas citadas existen: el archivo, y en él cada identificador; los escenarios, en la lista de escenarios', () => {
    for (const c of AFIRMACIONES)
      for (const cita of c.tests ?? []) {
        const m = /^(tests\/\S+)(?:\s*\((.*)\))?$/.exec(cita);
        const texto = m ? PRUEBAS[m[1]!] : TODAS_LAS_PRUEBAS;
        if (m) expect(texto, `${c.id}: ${m[1]} no existe`).toBeDefined();
        for (const codigo of (m ? (m[2] ?? '') : cita).match(CODIGO) ?? []) {
          if (esEscenario(codigo)) expect(ESCENARIOS.has(codigo), `${c.id}: escenario ${codigo}`).toBe(true);
          else expect(texto!.includes(codigo), `${c.id}: ${codigo} no aparece en ${m?.[1] ?? 'las pruebas'}`).toBe(true);
        }
      }
  });

  it('las referencias E-nnn y U-nn de la documentación y del código existen', () => {
    const ids = new Set(AFIRMACIONES.map((c) => c.id));
    const u = new Set(gaps.gaps.map((g) => g.id));
    const textos = ['README.md', ...archivos('docs', /\.md$/).filter((f) => !f.endsWith('01-resultados.md')), ...archivos('src', /\.ts$/)];
    for (const f of textos) {
      const t = leer(f);
      for (const e of t.match(/\bE-\d{3}\b/g) ?? []) expect(ids.has(e), `${f} cita ${e}`).toBe(true);
      for (const g of t.match(/\bU-\d{2}\b/g) ?? []) expect(u.has(g), `${f} cita ${g}`).toBe(true);
    }
  });
});
