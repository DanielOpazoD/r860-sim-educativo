#!/usr/bin/env python3
"""Regenera docs/01-resultados.md desde test-results/vitest.json y test-results/e2e-results.json (salidas reales).

Nada del encabezado se escribe a mano: la versión sale de package.json, el motor de src/engine/version.ts, los modos
habilitados de profile.ts, las versiones de Node/Playwright del entorno, y la lista «no ejecutado» se calcula a partir de
los identificadores de prueba que aparecen (y pasan) en las salidas JSON.
"""
import datetime, glob, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def rx(pattern, text, default='?'):
    m = re.search(pattern, text)
    return m.group(1) if m else default


def cmd(args, default='?'):
    try:
        return subprocess.run(args, capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return default


# --- entorno derivado del repositorio ---------------------------------------------------------------------------
pkg = json.load(open('package.json', encoding='utf-8'))
version = pkg['version']
engine = rx(r"ENGINE_VERSION\s*=\s*'([^']+)'", read('src/engine/version.ts'))
profile_src = read('src/profiles/r860-es-photo-reference/profile.ts')
profile_id = rx(r"profileId:\s*'([^']+)'", profile_src)
modes = re.findall(r"'([A-Z_]+)'", rx(r'enabledModes:\s*\[([^\]]*)\]', profile_src, ''))
MODE_LABEL = {'AC_VC': 'A/C VC', 'AC_PC': 'A/C PC', 'CPAP_PS': 'CPAP/PS'}
modes_text = ' + '.join(MODE_LABEL.get(m, m) for m in modes) or 'ningún modo declarado'
node = cmd(['node', '--version']).lstrip('v')
pw = json.load(open('node_modules/@playwright/test/package.json', encoding='utf-8')).get('version', '?')
chromium = rx(r'"chromium"[^}]*?"revision":\s*"(\d+)"', read('node_modules/playwright-core/browsers.json'), '?') if os.path.exists('node_modules/playwright-core/browsers.json') else '?'

# --- salidas reales ---------------------------------------------------------------------------------------------
V_PATH, E_PATH = 'test-results/vitest.json', 'test-results/e2e-results.json'
if not os.path.exists(V_PATH):
    sys.exit(f'falta {V_PATH}: ejecuta `npm run results:doc` (genera la salida de Vitest)')
v = json.load(open(V_PATH, encoding='utf-8'))
e = json.load(open(E_PATH, encoding='utf-8')) if os.path.exists(E_PATH) else None
e_note = ''
if e is None:
    e_note = f'`{E_PATH}` no existe: la sección Playwright no se regeneró (ejecuta `npm run e2e`).'
elif os.path.getmtime(E_PATH) < os.path.getmtime(V_PATH) - 24 * 3600:
    e_note = f'`{E_PATH}` es más de un día anterior a la salida de Vitest: puede estar desactualizado.'

# identificadores (BM-01, PHY-02, ALM-05, …) presentes y su resultado; un id «pasa» sólo si todas sus pruebas pasan
ID_RX = re.compile(r'\b(BM|PHY|ALM|PRC|DAT|CFG|ACC|TIM|SEC|INT|VIS)-(\d{2})[a-z]?\b')
ids = {}  # id -> True si todas las pruebas donde aparece pasaron


def note_ids(title, passed):
    for grp, num in ID_RX.findall(title):
        k = f'{grp}-{num}'
        ids[k] = ids.get(k, True) and passed


unit_rows = []
for f in v['testResults']:
    fn = f['name'].split('/tests/')[-1]
    for t in f['assertionResults']:
        title = ' › '.join(t['ancestorTitles'] + [t['title']])
        note_ids(title, t['status'] == 'passed')
        unit_rows.append(f"| `{fn}` | {title.replace('|', '/')} | {t['status']} | {t.get('duration', 0) or 0:.0f} |")

e2e_rows = []


def walk(s):
    for sp in s.get('specs', []):
        for t in sp.get('tests', []):
            for r in t.get('results', []):
                e2e_rows.append((t.get('projectName', ''), sp['file'], sp['title'].replace('|', '/'), r['status'], r.get('duration', 0)))
                if r['status'] != 'skipped':
                    note_ids(sp['title'], r['status'] == 'passed')
    for c in s.get('suites', []):
        walk(c)


if e is not None:
    for s in e['suites']:
        walk(s)
e_passed = sum(1 for r in e2e_rows if r[3] == 'passed')
e_skipped = sum(1 for r in e2e_rows if r[3] == 'skipped')
e_failed = len(e2e_rows) - e_passed - e_skipped


def enabled(*keys):
    return all(ids.get(k) is True for k in keys)


# --- catálogo de lo que puede faltar (id → descripción); se lista sólo lo que NO aparece o no pasa ---------------
PENDING = [
    ('ALM-04', 'ALM-04 automatizada de extremo a extremo (pausa de audio)'),
    ('PHY-02', 'PHY-02 (presión control)'),
    ('PHY-03', 'PHY-03 (CPAP/PS: esfuerzo, disparo, ciclaje, respaldo; modo no habilitado)'),
    ('PHY-05', 'PHY-05 (fuga no modelada)'),
    ('PRC-04', 'PRC-04 (SBT)'),
    ('DAT-05', 'DAT-05 en UI'),
    ('DAT-06', 'DAT-06 en UI'),
    ('CFG-04', 'CFG-04'),
    ('ACC-02', 'ACC-02 automatizada'),
]
pending = [desc for k, desc in PENDING if not enabled(k)]
pending += ['auditoría de accesibilidad formal', 'revisión experta L3', 'contraste con equipo de demostración']

# --- documento ---------------------------------------------------------------------------------------------------
L = [
    f'# Resultados de pruebas ejecutadas · v{version} (adulto {modes_text} · interfaz R860 Lab)\n',
    f"Generado el {datetime.datetime.now().isoformat(timespec='seconds')} con `npm run results:doc` a partir de `{V_PATH}`"
    f" y `{E_PATH}` (salidas reales). Motor {engine} · perfil {profile_id} · dt 4 ms · semilla 1 · t0 2026-08-18T21:04:05-04:00"
    f" · Node {node} · Chromium (Playwright {pw}, build {chromium}).\n",
]
if e_note:
    L.append(f'> **Aviso**: {e_note}\n')
L += [
    '## Niveles de validación\n',
    '- **L0 visual**: capturas deterministas en `docs/capturas/` con JSON de metadatos. Comparación por zonas con P1/P3 hecha por la IA constructora; sin baseline aprobada por revisor humano.\n'
    '- **L1 interacción**: Playwright (abajo).\n'
    '- **L2 modelo analítico**: Vitest, banco BM-01…BM-08 y PC, físicas y regresiones.\n'
    '- **L3 revisión experta**: pendiente.\n',
    f"## Vitest · {v['numPassedTests']} pasadas / {v['numFailedTests']} fallidas / {v['numTotalTests']} totales\n",
    '| Archivo | Prueba | Estado | ms |\n| --- | --- | --- | --- |',
    *unit_rows,
]
if e is not None:
    L.append(f'\n## Playwright · {e_passed} pasadas / {e_failed} fallidas / {e_skipped} omitidas (por diseño: la prueba móvil sólo corre en el proyecto móvil)\n')
    L.append('| Proyecto | Archivo | Prueba | Estado | ms |\n| --- | --- | --- | --- | --- |')
    for r in sorted(e2e_rows):
        L.append(f'| {r[0]} | `{r[1]}` | {r[2]} | {r[3]} | {r[4]:.0f} |')
else:
    L.append('\n## Playwright\n')
    L.append(f'No regenerado: {e_note}\n')
L.append('\n## Capturas (docs/capturas)\n')
L.append('| Archivo | Contenido | Metadatos |\n| --- | --- | --- |')
for p in sorted(glob.glob('docs/capturas/*.json')):
    m = json.load(open(p, encoding='utf-8'))
    L.append(f"| `{os.path.basename(p).replace('.json', '.png')}` | {m['name']} | {m['project']} {m['viewport']['width']}×{m['viewport']['height']} · t={m['simTimeMs']} ms · motor {m.get('engine')} |")
L.append('\n## Identificadores de prueba presentes\n')
L.append('Un identificador cuenta como habilitado sólo si todas las pruebas que lo citan pasan. ' + ', '.join(f"{k}{'' if ok else ' (falla)'}" for k, ok in sorted(ids.items())) + '.\n')
L.append('\n## No ejecutado en esta etapa\n')
L.append('; '.join(pending) + '.\n')
open('docs/01-resultados.md', 'w', encoding='utf-8').write('\n'.join(L))
print('resultados:', v['numPassedTests'], 'vitest ·', e_passed, 'e2e ·', e_skipped, 'omitidas ·', e_failed, 'fallidas', f'· {e_note}' if e_note else '')
