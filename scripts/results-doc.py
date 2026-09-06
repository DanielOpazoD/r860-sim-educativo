#!/usr/bin/env python3
"""Regenera docs/01-resultados.md desde test-results/vitest.json y test-results/e2e-results.json (salidas reales)."""
import json, datetime, glob, os
v=json.load(open('test-results/vitest.json')); e=json.load(open('test-results/e2e-results.json'))
L=['# Resultados de pruebas ejecutadas · v0.2 (adulto A/C VC · interfaz R860 Lab)\n',
 f"Generado el {datetime.datetime.now().isoformat(timespec='seconds')} con `npm run results:doc` a partir de `test-results/vitest.json` y `test-results/e2e-results.json` (salidas reales). Motor 0.2.0 · perfil r860-es-photo-reference-v1 · dt 4 ms · semilla 1 · t0 2026-08-18T21:04:05-04:00 · Node 24.14 · Chromium (Playwright 1.63, build 1243).\n",
 '## Niveles de validación\n',
 '- **L0 visual**: capturas deterministas en `docs/capturas/` con JSON de metadatos. Comparación por zonas con P1/P3 hecha por la IA constructora; sin baseline aprobada por revisor humano.\n- **L1 interacción**: Playwright (abajo).\n- **L2 modelo analítico**: Vitest, banco BM-01…BM-08, físicas y regresiones.\n- **L3 revisión experta**: pendiente.\n',
 f"## Vitest · {v['numPassedTests']} pasadas / {v['numFailedTests']} fallidas / {v['numTotalTests']} totales\n",
 '| Archivo | Prueba | Estado | ms |\n| --- | --- | --- | --- |']
for f in v['testResults']:
    fn=f['name'].split('/tests/')[-1]
    for t in f['assertionResults']:
        L.append(f"| `{fn}` | {' › '.join(t['ancestorTitles']+[t['title']]).replace('|','/')} | {t['status']} | {t.get('duration',0) or 0:.0f} |")
rows=[]
def walk(s):
    for sp in s.get('specs',[]):
        for t in sp.get('tests',[]):
            for r in t.get('results',[]): rows.append((t.get('projectName',''), sp['file'], sp['title'].replace('|','/'), r['status'], r.get('duration',0)))
    for c in s.get('suites',[]): walk(c)
for s in e['suites']: walk(s)
passed=sum(1 for r in rows if r[3]=='passed'); skipped=sum(1 for r in rows if r[3]=='skipped'); failed=len(rows)-passed-skipped
L.append(f"\n## Playwright · {passed} pasadas / {failed} fallidas / {skipped} omitidas (por diseño: la prueba móvil sólo corre en el proyecto móvil)\n")
L.append('| Proyecto | Archivo | Prueba | Estado | ms |\n| --- | --- | --- | --- | --- |')
for r in sorted(rows): L.append(f"| {r[0]} | `{r[1]}` | {r[2]} | {r[3]} | {r[4]:.0f} |")
L.append('\n## Capturas (docs/capturas)\n'); L.append('| Archivo | Contenido | Metadatos |\n| --- | --- | --- |')
for p in sorted(glob.glob('docs/capturas/*.json')):
    m=json.load(open(p)); L.append(f"| `{os.path.basename(p).replace('.json','.png')}` | {m['name']} | {m['project']} {m['viewport']['width']}×{m['viewport']['height']} · t={m['simTimeMs']} ms · motor {m.get('engine')} |")
L.append('\n## No ejecutado en esta etapa\n'); L.append('ALM-04 automatizada de extremo a extremo; PHY-02/03 (PC, CPAP/PS no habilitados); PHY-05 (fuga); PRC-04 (SBT); DAT-05/06 en UI; CFG-04; ACC-02 automatizada; auditoría de accesibilidad formal; revisión experta L3; contraste con equipo de demostración.\n')
open('docs/01-resultados.md','w').write('\n'.join(L)); print('resultados:', v['numPassedTests'], 'vitest ·', passed, 'e2e ·', skipped, 'omitidas ·', failed, 'fallidas')
