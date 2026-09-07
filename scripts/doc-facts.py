#!/usr/bin/env python3
"""Sincroniza los hechos numéricos de la documentación con los artefactos reales del proyecto.

Por qué existe. Una revisión adversarial encontró doce afirmaciones falsas en README y docs/, y casi todas eran
números que habían quedado congelados en una versión anterior: cobertura, umbrales, número de pruebas, escenarios,
modos habilitados. La prosa se escribe a mano; los números no deben escribirse a mano. Este script los inyecta en
bloques marcados y, con `--check`, falla si alguien los editó a mano o si la prosa quedó atrás.

Bloques, en README.md y en docs/: `<!-- hechos:CLAVE -->…<!-- /hechos:CLAVE -->`. Todo lo de fuera es prosa libre.

Fuentes, todas artefactos o código real:
  coverage/coverage-summary.json   `npm run test:coverage`
  test-results/vitest.json          `npm run results:doc`
  test-results/e2e-results.json     `npm run e2e`
  vitest.config.ts · playwright.config.ts · src/scenarios/index.ts · src/engine/version.ts · package.json
  el perfil de referencia (modos habilitados)

Uso:
  python3 scripts/doc-facts.py            reescribe los bloques
  python3 scripts/doc-facts.py --check    no escribe; sale con 1 si algún bloque está desactualizado
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
CHECK = '--check' in sys.argv


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def load(path, que_ejecutar):
    if not os.path.exists(path):
        sys.exit(f'falta {path}: ejecuta `{que_ejecutar}` antes de sincronizar los hechos de la documentación')
    return json.load(open(path, encoding='utf-8'))


def num(x):
    """Número con coma decimal, como el resto de la documentación en español."""
    return f'{x:.1f}'.replace('.', ',')


# --- fuentes ------------------------------------------------------------------------------------------------------
cov = load('coverage/coverage-summary.json', 'npm run test:coverage')
vit = load('test-results/vitest.json', 'npm run results:doc')
e2e = load('test-results/e2e-results.json', 'npm run e2e')

vitest_cfg = read('vitest.config.ts')
umbrales = {k: int(v) for k, v in re.findall(r'(lines|branches|functions|statements):\s*(\d+)', vitest_cfg)}
excluidos = re.findall(r"'([^']+)'", re.search(r'exclude:\s*\[([^\]]*)\]', vitest_cfg).group(1))

proyectos = re.findall(r"\{\s*name:\s*'([^']+)'", re.search(r'projects:\s*\[(.*?)\n\s*\],', read('playwright.config.ts'), re.S).group(1))

escenarios = re.findall(r"id:\s*'(SC-[0-9P]+)'", read('src/scenarios/index.ts'))
ensenanza = sorted(s for s in escenarios if s != 'SC-P')

paquete = json.load(open('package.json', encoding='utf-8'))['version']
motor = re.search(r"ENGINE_VERSION\s*=\s*'([^']+)'", read('src/engine/version.ts')).group(1)

perfil = read(glob.glob('src/profiles/*/profile.ts')[0])
ETIQUETA_MODO = {'AC_VC': 'A/C VC', 'AC_PC': 'A/C PC', 'CPAP_PS': 'CPAP/PS'}
modos = [ETIQUETA_MODO.get(m, m) for m in re.findall(r"'([A-Z_]+)'", re.search(r'enabledModes:\s*\[([^\]]*)\]', perfil).group(1))]


# --- cobertura: total y excluyendo la capa que sólo ejercita Playwright ---------------------------------------------
CLAVES = ('lines', 'branches', 'functions', 'statements')
SOLO_E2E = re.compile(r'/src/(ui|render)/|/src/main\.ts$')


def porcentajes(predicado):
    tot = {k: [0, 0] for k in CLAVES}
    for ruta, datos in cov.items():
        if ruta == 'total' or not predicado(ruta):
            continue
        for k in CLAVES:
            tot[k][0] += datos[k]['covered']
            tot[k][1] += datos[k]['total']
    return {k: (100.0 * c / t if t else 0.0) for k, (c, t) in tot.items()}


todo = porcentajes(lambda r: True)
sin_interfaz = porcentajes(lambda r: not SOLO_E2E.search(r))
archivos_e2e = sum(1 for r in cov if r != 'total' and SOLO_E2E.search(r))

# --- recuentos de pruebas -------------------------------------------------------------------------------------------
unit_total = vit['numTotalTests']
unit_fallidas = vit['numFailedTests']


def specs(nodo, vistos, ejecuciones):
    for sp in nodo.get('specs', []):
        vistos.add((sp['file'], sp['title']))
        for t in sp.get('tests', []):
            for r in t.get('results', []):
                ejecuciones.append(r['status'])
    for hijo in nodo.get('suites', []):
        specs(hijo, vistos, ejecuciones)


vistos, ejecuciones = set(), []
for s in e2e['suites']:
    specs(s, vistos, ejecuciones)
e2e_pruebas = len(vistos)
e2e_omitidas = sum(1 for r in ejecuciones if r == 'skipped')
e2e_ejecutadas = len(ejecuciones) - e2e_omitidas

# --- hechos ---------------------------------------------------------------------------------------------------------
HECHOS = {
    'version': f'Versión {paquete} del paquete, motor {motor}',
    'pruebas': (
        f'{unit_total} pruebas Vitest y {e2e_pruebas} pruebas Playwright × {len(proyectos)} proyectos '
        f'({e2e_ejecutadas} ejecuciones, {e2e_omitidas} omitidas por diseño: la prueba móvil sólo corre en el proyecto móvil)'
    ),
    'modos': ' y '.join(modos),
    'escenarios': (
        f'{ensenanza[0]}…{ensenanza[-1]} ({len(ensenanza)} escenarios de enseñanza; la numeración salta los no '
        f'implementados) y SC-P de referencia fotográfica'
    ),
    'cobertura': (
        f'**Cobertura honesta.** Medida sobre todo `src/` (excluidos {", ".join(f"`{e}`" for e in excluidos)}): '
        f'líneas {num(todo["lines"])} % · ramas {num(todo["branches"])} % · funciones {num(todo["functions"])} % · '
        f'sentencias {num(todo["statements"])} %. Los umbrales de `vitest.config.ts` '
        f'({umbrales["lines"]} · {umbrales["branches"]} · {umbrales["functions"]} · {umbrales["statements"]}) van por '
        f'debajo de lo medido para que la integración continua falle ante una regresión y pase hoy. La cifra global es '
        f'baja porque los {archivos_e2e} archivos de `src/ui/`, `src/render/` y `main.ts` sólo los ejercita Playwright y '
        f'aquí figuran con 0 %; excluyendo esa capa la cobertura es líneas {num(sin_interfaz["lines"])} % · ramas '
        f'{num(sin_interfaz["branches"])} % · funciones {num(sin_interfaz["functions"])} % · sentencias '
        f'{num(sin_interfaz["statements"])} %. Ninguna de las dos cifras se presenta como fidelidad frente al equipo: '
        f'miden qué parte del código ejecuta la suite, no cuánto se parece el simulador a un R860.'
    ),
}

# --- sincronización ---------------------------------------------------------------------------------------------------
DOCUMENTOS = ['README.md'] + sorted(glob.glob('docs/*.md'))
desactualizados, escritos, usados = [], [], set()

for doc in DOCUMENTOS:
    texto = original = read(doc)
    for clave, valor in HECHOS.items():
        patron = re.compile(r'(<!-- hechos:' + clave + r' -->)(.*?)(<!-- /hechos:' + clave + r' -->)', re.S)
        if not patron.search(texto):
            continue
        usados.add(clave)
        texto = patron.sub(lambda m: m.group(1) + valor + m.group(3), texto)
    if texto == original:
        continue
    if CHECK:
        for clave in HECHOS:
            if re.search(r'<!-- hechos:' + clave + r' -->', original) and HECHOS[clave] not in original:
                desactualizados.append(f'{doc} · {clave}')
    else:
        open(doc, 'w', encoding='utf-8').write(texto)
        escritos.append(doc)

huerfanos = sorted(set(HECHOS) - usados)

if CHECK:
    if desactualizados:
        print('Hechos desactualizados en la documentación:', file=sys.stderr)
        for d in desactualizados:
            print(f'  - {d}', file=sys.stderr)
        print('\nEjecuta `npm run docs:facts` y revisa el resultado antes de integrar.', file=sys.stderr)
        sys.exit(1)
    if unit_fallidas:
        sys.exit(f'la salida de Vitest trae {unit_fallidas} pruebas fallidas: los hechos no son publicables')
    print(f'hechos de la documentación: al día ({len(usados)} claves en {len(DOCUMENTOS)} documentos)')
else:
    print('hechos actualizados en:', ', '.join(escritos) if escritos else 'ninguno (ya estaban al día)')
if huerfanos:
    print('aviso · claves sin ningún bloque que las use:', ', '.join(huerfanos), file=sys.stderr)
