#!/usr/bin/env node
/**
 * /verify-r860 · arranca la app, comprueba que responde con el motor correcto, la conduce como un alumno y deja
 * evidencia etiquetada (medido / inferido / supuesto) con capturas y cifras de antes y después.
 *
 *   node .claude/skills/verify-r860/scripts/verificar.mjs [--url http://127.0.0.1:5173] [--port 5190] [--out dir]
 *
 * Sin --url arranca su propio `vite` en PORT (por omisión 5190, para no chocar con el 5173 de nadie) y lo detiene al
 * terminar. Con --url usa un servidor ya levantado y no lo toca. Sale con 0 si todo pasó, 1 si una comprobación falló
 * y 2 si el doctor encontró un problema antes de conducir.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const { chromium } = await import(join(RAIZ, 'node_modules/@playwright/test/index.mjs'));

const arg = (nombre, defecto) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : defecto;
};
const PORT = Number(arg('port', process.env.PORT || 5190));
const URL_BASE = arg('url', `http://127.0.0.1:${PORT}`);
const SELLO = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SALIDA = resolve(arg('out', join(RAIZ, 'test-results/verify-r860', SELLO)));
mkdirSync(SALIDA, { recursive: true });

/** Cada afirmación lleva su etiqueta: medido (leído de la app o del motor), inferido (calculado de lo medido), supuesto. */
const evidencia = [];
const anotar = (paso, afirmacion, valor, etiqueta, fuente, ok = null) => evidencia.push({ paso, afirmacion, valor, etiqueta, fuente, ok });
const fallos = [];
const comprobar = (paso, ok, texto) => {
  if (!ok) fallos.push(`${paso}: ${texto}`);
  return ok;
};

// ---------- Launch ----------
let servidor = null;
async function responde(url, ms) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    try {
      const r = await fetch(url);
      if (r.ok) return r.status;
    } catch {
      /* todavía no */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}
if (!process.argv.includes('--url')) {
  servidor = spawn('npx', ['vite', '--host', '127.0.0.1'], {
    cwd: RAIZ,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  servidor.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
}
const detener = () => {
  if (servidor && servidor.exitCode === null) {
    try {
      process.kill(-servidor.pid, 'SIGTERM');
    } catch {
      /* ya terminó */
    }
  }
};
process.on('exit', detener);
process.on('SIGINT', () => process.exit(130));

let navegador = null;
try {
  // ---------- Doctor ----------
  const estado = await responde(URL_BASE, 30_000);
  anotar('doctor', 'el servidor responde', estado ?? 'sin respuesta en 30 s', 'medido', URL_BASE, estado === 200);
  if (!comprobar('doctor', estado === 200, `${URL_BASE} no responde`)) throw new Error('doctor');
  const motor = /ENGINE_VERSION = '([^']+)'/.exec(readFileSync(join(RAIZ, 'src/engine/version.ts'), 'utf8'))?.[1];
  const paquete = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version;
  anotar(
    'doctor',
    'versión del motor en el código / del paquete',
    `${motor} / ${paquete}`,
    'medido',
    'src/engine/version.ts, package.json',
    motor === paquete,
  );
  comprobar('doctor', motor === paquete, `ENGINE_VERSION ${motor} distinta de package.json ${paquete}`);

  navegador = await chromium.launch();
  const errores = [];
  const pagina = async (query, viewport = { width: 1280, height: 900 }) => {
    const page = await navegador.newPage({ viewport });
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
    await page.goto(`${URL_BASE}/?${query}`);
    await page.waitForFunction(() => window.__ventila?.frame);
    await page.keyboard.press('Escape'); // la bienvenida de la primera visita
    return page;
  };
  const cuadro = (page) =>
    page.evaluate(() => {
      const f = window.__ventila.frame;
      const m = (k) => f.metrics[k]?.value ?? null;
      return {
        tSimS: f.simTimeMs / 1000,
        motor: f.engineVersion,
        modo: f.settings.mode,
        vtProgramadoMl: f.settings.vt * 1000,
        frProgramada: f.settings.rr,
        ppico: m('ppeak'),
        vteMl: m('vte') === null ? null : m('vte') * 1000,
        frMedida: m('rr'),
        paco2: f.truth.gas?.paco2 ?? null,
        paco2Equilibrio: f.truth.gas?.paco2Target ?? null,
        ph: f.truth.gas?.ph ?? null,
        tauMin: f.truth.gas?.tauMin ?? null,
      };
    });
  const esperarSim = (page, s) =>
    page.waitForFunction((objetivo) => window.__ventila.frame.simTimeMs / 1000 >= objetivo, s, { timeout: 120_000 });
  const ajustar = async (page, { modo, vtMl, fr }) => {
    await page.getByText('Modo actual').click();
    if (modo) await page.locator(`.mode-option[data-mode="${modo}"]`).click();
    if (vtMl !== undefined) await page.fill('#setting-vt', String(vtMl));
    if (fr !== undefined) await page.fill('#setting-rr', String(fr));
    for (const id of ['#setting-vt', '#setting-rr']) if (await page.locator(id).count()) await page.locator(id).dispatchEvent('change');
    await page.locator('[data-action="confirmModes"]').click();
  };

  const inicio = await pagina('scenario=SC-01&speed=2');
  const versionPantalla = (await inicio.locator('#version-tag').textContent())?.trim();
  const motorCuadro = (await cuadro(inicio)).motor;
  anotar(
    'doctor',
    'versión que muestra la app / que publica el motor',
    `${versionPantalla} / ${motorCuadro}`,
    'medido',
    '#version-tag, frame.engineVersion',
    motorCuadro === motor && versionPantalla?.startsWith(`v${motor}`),
  );
  if (
    !comprobar(
      'doctor',
      motorCuadro === motor && versionPantalla?.startsWith(`v${motor}`),
      `la app sirve el motor ${motorCuadro}, el código dice ${motor}`,
    )
  )
    throw new Error('doctor');

  // ---------- Drive 1 · cambio de modo ----------
  await esperarSim(inicio, 14);
  const antesModo = await cuadro(inicio);
  await inicio.locator('#view-waves').screenshot({ path: join(SALIDA, '1-curvas-antes-AC_VC.png') });
  await ajustar(inicio, { modo: 'AC_PC' });
  await inicio.waitForFunction(() => window.__ventila.frame.settings.mode === 'AC_PC', null, { timeout: 30_000 });
  const tCambio = (await cuadro(inicio)).tSimS;
  await esperarSim(inicio, tCambio + 6); // la marca y la pasada en curso, antes de que el barrido la reescriba
  const despuesModo = await cuadro(inicio);
  await inicio.locator('#view-waves').screenshot({ path: join(SALIDA, '2-curvas-despues-AC_PC.png') });
  anotar(
    'modo',
    'modo antes → después',
    `${antesModo.modo} → ${despuesModo.modo}`,
    'medido',
    'frame.settings.mode',
    despuesModo.modo === 'AC_PC',
  );
  anotar(
    'modo',
    'Ppico antes → después (cmH₂O)',
    `${antesModo.ppico?.toFixed(1)} → ${despuesModo.ppico?.toFixed(1)}`,
    'medido',
    'frame.metrics.ppeak',
  );
  anotar(
    'modo',
    'VTe antes → después (mL)',
    `${antesModo.vteMl?.toFixed(0)} → ${despuesModo.vteMl?.toFixed(0)}`,
    'medido',
    'frame.metrics.vte',
  );
  anotar(
    'modo',
    'la curva marca el cambio con «Modo A/C PC» y oculta la pasada anterior',
    'ver 2-curvas-despues-AC_PC.png',
    'inferido',
    'captura (el canvas no expone texto)',
  );
  comprobar('modo', despuesModo.modo === 'AC_PC', 'el modo no cambió a A/C PC');
  await inicio.close();

  // ---------- Drive 2 · un caso: entregar y revisar «Cómo se resuelve» ----------
  const caso = await pagina('scenario=CC-05&speed=10');
  await esperarSim(caso, 25);
  const antesCaso = await cuadro(caso);
  await caso.locator('#case-gas').screenshot({ path: join(SALIDA, '3-gasometria-antes.png') });
  await ajustar(caso, { vtMl: 500, fr: 14 }); // la solución que declara CC-05 (src/scenarios/cases.ts)
  await caso.waitForFunction(() => window.__ventila.frame.settings.rr === 14 && window.__ventila.frame.settings.vt === 0.5, null, {
    timeout: 30_000,
  });
  const tAjuste = (await cuadro(caso)).tSimS;
  await esperarSim(caso, tAjuste + 20); // el equilibrio objetivo se fija con las últimas respiraciones
  await caso.evaluate(() => document.querySelector('#instructor-case [data-action="submitCase"]').click());
  await caso.locator('#learn-case .case-solution').waitFor();
  const veredicto = (await caso.locator('#learn-case .case-verdict').first().textContent())?.trim();
  const tabla = await caso.$$eval('#learn-case .case-solution tr', (filas) =>
    filas.map((f) => [...f.children].map((c) => c.textContent.trim()).join(' · ')),
  );
  const pasos = await caso.$$eval('#learn-case .case-steps li', (li) =>
    li.map((x) => [...x.children].map((c) => c.textContent.trim()).join(' — ')),
  );
  await caso.locator('#learn-case').screenshot({ path: join(SALIDA, '4-desarrollo-del-caso.png') });
  anotar('caso', 'veredicto de CC-05 con VT 500 y FR 14', veredicto, 'medido', '#learn-case .case-verdict', veredicto === 'Caso resuelto');
  anotar('caso', 'tabla «Cómo se resuelve»', tabla, 'medido', '#learn-case .case-solution');
  anotar('caso', 'pasos', pasos, 'medido', '#learn-case .case-steps');
  comprobar('caso', veredicto === 'Caso resuelto', `el veredicto fue «${veredicto}»`);
  comprobar(
    'caso',
    tabla.some((f) => f.startsWith('Frecuencia') && f.includes('14 /min')),
    'la tabla no muestra la FR de la solución',
  );

  // ---------- Drive 3 · la PaCO₂ hasta su equilibrio ----------
  const serie = [];
  let ahora = await cuadro(caso);
  const limite = tAjuste + 10 * 60;
  while (Math.abs(ahora.paco2 - ahora.paco2Equilibrio) > 1 && ahora.tSimS < limite) {
    serie.push({ tMin: (ahora.tSimS - tAjuste) / 60, paco2: ahora.paco2 });
    await caso.waitForTimeout(1000);
    ahora = await cuadro(caso);
  }
  serie.push({ tMin: (ahora.tSimS - tAjuste) / 60, paco2: ahora.paco2 });
  const salvedad = (await caso.locator('#case-gas').innerText()).replace(/\s+/g, ' ').trim();
  await caso.locator('#case-gas').screenshot({ path: join(SALIDA, '5-gasometria-equilibrio.png') });
  const llego = Math.abs(ahora.paco2 - ahora.paco2Equilibrio) <= 1;
  const minutos = (ahora.tSimS - tAjuste) / 60;
  anotar(
    'paco2',
    'PaCO₂ antes del ajuste / equilibrio previsto (mmHg)',
    `${antesCaso.paco2.toFixed(1)} / ${antesCaso.paco2Equilibrio.toFixed(1)}`,
    'medido',
    'frame.truth.gas',
  );
  anotar(
    'paco2',
    'PaCO₂ al final / equilibrio con VT 500 y FR 14 (mmHg)',
    `${ahora.paco2.toFixed(1)} / ${ahora.paco2Equilibrio.toFixed(1)}`,
    'medido',
    'frame.truth.gas',
    llego,
  );
  anotar(
    'paco2',
    'minutos simulados hasta quedar a ≤ 1 mmHg del equilibrio',
    llego ? minutos.toFixed(2) : `> ${minutos.toFixed(1)}`,
    'medido',
    'frame.simTimeMs',
  );
  anotar('paco2', 'constante de tiempo lenta con la ventilación nueva (min)', ahora.tauMin?.toFixed(2), 'medido', 'frame.truth.gas.tauMin');
  anotar('paco2', 'el panel declara la aceleración', salvedad, 'medido', '#case-gas', /10/.test(salvedad ?? ''));
  anotar(
    'paco2',
    'un adulto real tardaría unas 10 veces más',
    llego ? `≈ ${(minutos * 10).toFixed(0)} min` : '—',
    'inferido',
    'factor ≈ 10 declarado en la app (E-128)',
  );
  anotar('paco2', 'el monitor del equipo real no muestra PaCO₂: es dato del modelo', 'rótulo «modelo»', 'supuesto', 'diseño del simulador');
  comprobar('paco2', llego, `la PaCO₂ no llegó a ±1 mmHg del equilibrio en ${minutos.toFixed(1)} min simulados`);
  writeFileSync(join(SALIDA, 'paco2-serie.json'), JSON.stringify(serie, null, 2));
  await caso.close();

  // ---------- Drive 4 · oxigenación: abrir el pulmón y la FiO₂ ----------
  const oxi = await pagina('scenario=CC-04&speed=10');
  await esperarSim(oxi, 25);
  const leerOxi = () =>
    oxi.evaluate(() => {
      const f = window.__ventila.frame;
      const o = f.truth.oxy;
      return {
        tSimS: f.simTimeMs / 1000,
        peep: f.settings.peep,
        fio2: f.settings.fio2,
        pao2: o.pao2,
        sao2: o.sao2,
        pafi: o.pafi,
        shunt: o.shunt,
        gc: f.truth.circ?.cardiacOutputLMin ?? null,
        do2: f.truth.circ?.do2MlMin ?? null,
      };
    });
  const texto = (o) =>
    `PEEP ${o.peep} · FiO₂ ${o.fio2} · PaO₂ ${o.pao2.toFixed(0)} · SaO₂ ${(o.sao2 * 100).toFixed(1)} % · PaO₂/FiO₂ ${o.pafi.toFixed(0)} · shunt ${(o.shunt * 100).toFixed(0)} %${o.gc === null ? '' : ` · GC ${o.gc.toFixed(2)} · DO₂ ${o.do2.toFixed(0)}`}`;
  const ponerPeep = async (valor) => {
    await oxi.getByText('Modo actual').click();
    await oxi.fill('#setting-peep', String(valor));
    await oxi.locator('#setting-peep').dispatchEvent('change');
    await oxi.locator('[data-action="confirmModes"]').click();
    await oxi.waitForFunction((v) => window.__ventila.frame.settings.peep === v, valor, { timeout: 30_000 });
    return (await leerOxi()).tSimS;
  };
  const cerrado = await leerOxi();
  await oxi.locator('#case-gas').screenshot({ path: join(SALIDA, '6-oxigenacion-cerrado.png') });
  await esperarSim(oxi, (await ponerPeep(20)) + 30);
  await esperarSim(oxi, (await ponerPeep(16)) + 180);
  const abierto16 = await leerOxi();
  await esperarSim(oxi, (await ponerPeep(11)) + 180);
  const abierto = await leerOxi();
  if (abierto.do2 !== null) {
    anotar('corazón-pulmón', 'CC-04 abierto a PEEP 16', texto(abierto16), 'medido', 'frame.truth.oxy, frame.truth.circ');
    anotar(
      'corazón-pulmón',
      'la DO₂ es mayor a PEEP 11 que a 16 y que cerrado a PEEP 5',
      `${abierto.do2.toFixed(0)} frente a ${abierto16.do2.toFixed(0)} y ${cerrado.do2.toFixed(0)}`,
      'medido',
      'frame.truth.circ',
      abierto.do2 > abierto16.do2 && abierto.do2 > cerrado.do2,
    );
    comprobar(
      'corazón-pulmón',
      abierto.do2 > abierto16.do2 && abierto.do2 > cerrado.do2,
      'la DO₂ no tiene su máximo en la PEEP baja que mantiene abierto',
    );
  }
  await oxi.locator('#case-gas').screenshot({ path: join(SALIDA, '7-oxigenacion-abierto.png') });
  const mejora = abierto.pafi / cerrado.pafi;
  anotar('oxigenación', 'CC-04 cerrado (PEEP 5)', texto(cerrado), 'medido', 'frame.truth.oxy', cerrado.pafi < 200);
  anotar('oxigenación', 'CC-04 abierto (PEEP 20 → 11)', texto(abierto), 'medido', 'frame.truth.oxy');
  anotar(
    'oxigenación',
    'mejora de la PaO₂/FiO₂ al abrir',
    `× ${mejora.toFixed(2)}`,
    'inferido',
    'cociente de las dos anteriores',
    mejora >= 1.5,
  );
  comprobar('oxigenación', cerrado.pafi < 200 && mejora >= 1.5, `PaO₂/FiO₂ ${cerrado.pafi.toFixed(0)} → ${abierto.pafi.toFixed(0)}`);
  await esperarSim(oxi, (await ponerPeep(5)) + 180);
  const cerrado2 = await leerOxi();
  anotar(
    'oxigenación',
    'de vuelta a PEEP 5, 3 min después',
    texto(cerrado2),
    'medido',
    'frame.truth.oxy',
    cerrado2.pafi < abierto.pafi * 0.7,
  );
  comprobar('oxigenación', cerrado2.pafi < abierto.pafi * 0.7, 'no se perdió lo ganado al volver a PEEP 5');
  await oxi.close();

  // ---------- Drive 5 · corazón-pulmón: la PEEP cuesta gasto ----------
  const cp = await pagina('scenario=SC-01&speed=10');
  await esperarSim(cp, 30);
  const leerCp = () =>
    cp.evaluate(() => {
      const f = window.__ventila.frame;
      return f.truth.circ
        ? { peep: f.settings.peep, gc: f.truth.circ.cardiacOutputLMin, pam: f.truth.circ.mapMmHg, pao2: f.truth.oxy.pao2 }
        : null;
    });
  const cp5 = await leerCp();
  if (cp5) {
    await cp.getByText('Modo actual').click();
    await cp.fill('#setting-peep', '15');
    await cp.locator('#setting-peep').dispatchEvent('change');
    await cp.locator('[data-action="confirmModes"]').click();
    await cp.waitForFunction(() => window.__ventila.frame.settings.peep === 15, null, { timeout: 30_000 });
    const t15 = (await cp.evaluate(() => window.__ventila.frame.simTimeMs)) / 1000;
    await esperarSim(cp, t15 + 60);
    const cp15 = await leerCp();
    await cp.locator('#case-gas').screenshot({ path: join(SALIDA, '9-corazon-pulmon-peep15.png') });
    anotar(
      'corazón-pulmón',
      'SC-01 PEEP 5 → 15: GC (L/min)',
      `${cp5.gc.toFixed(2)} → ${cp15.gc.toFixed(2)}`,
      'medido',
      'frame.truth.circ',
      cp15.gc < cp5.gc,
    );
    anotar(
      'corazón-pulmón',
      'SC-01 PEEP 5 → 15: PAM (mmHg)',
      `${cp5.pam.toFixed(0)} → ${cp15.pam.toFixed(0)}`,
      'medido',
      'frame.truth.circ',
      cp15.pam < cp5.pam,
    );
    comprobar('corazón-pulmón', cp15.gc < cp5.gc, 'subir la PEEP no bajó el gasto');
  }
  await cp.close();

  const refractaria = await pagina('scenario=CC-03&speed=10');
  await esperarSim(refractaria, 25);
  const leerR = () => refractaria.evaluate(() => window.__ventila.frame.truth.oxy.pao2);
  const con05 = await leerR();
  await refractaria.getByText('Modo actual').click();
  await refractaria.fill('#setting-fio2', '100');
  await refractaria.locator('#setting-fio2').dispatchEvent('change');
  await refractaria.locator('[data-action="confirmModes"]').click();
  await refractaria.waitForFunction(() => window.__ventila.frame.settings.fio2 === 1, null, { timeout: 30_000 });
  const tF = (await refractaria.evaluate(() => window.__ventila.frame.simTimeMs)) / 1000;
  await esperarSim(refractaria, tF + 180);
  const con10 = await leerR();
  await refractaria.locator('#case-gas').screenshot({ path: join(SALIDA, '8-oxigenacion-fio2-1.png') });
  const subida = con10 - con05;
  anotar(
    'oxigenación',
    'CC-03 (shunt 25 %): PaO₂ con FiO₂ 0,5 → 1,0 (mmHg)',
    `${con05.toFixed(0)} → ${con10.toFixed(0)}`,
    'medido',
    'frame.truth.oxy',
    subida < 100,
  );
  comprobar('oxigenación', subida < 100, `la PaO₂ subió ${subida.toFixed(0)} mmHg: no se comporta como refractaria`);
  await refractaria.close();

  anotar(
    'general',
    'errores de página o de consola',
    errores.length ? errores : 'ninguno',
    'medido',
    'page.on(pageerror|console)',
    errores.length === 0,
  );
  comprobar('general', errores.length === 0, `${errores.length} errores de página`);
} catch (e) {
  if (e.message !== 'doctor') fallos.push(`excepción: ${e.message}`);
} finally {
  // ---------- Evidence + Cleanup ----------
  const filas = evidencia.map(
    (x) =>
      `| ${x.paso} | ${x.afirmacion} | ${Array.isArray(x.valor) ? x.valor.join('<br>') : x.valor} | ${x.etiqueta} | ${x.ok === null ? '' : x.ok ? '✅' : '❌'} |`,
  );
  const resumen = [
    `# /verify-r860 · ${SELLO}`,
    '',
    `Servidor: ${URL_BASE}${servidor ? ' (arrancado por el script)' : ''}`,
    '',
    '| Paso | Afirmación | Valor | Etiqueta | |',
    '| --- | --- | --- | --- | --- |',
    ...filas,
    '',
    fallos.length ? `**Fallos (${fallos.length})**\n\n${fallos.map((f) => `- ${f}`).join('\n')}` : '**Todo pasó.**',
    '',
    'Capturas: 1-curvas-antes-AC_VC.png, 2-curvas-despues-AC_PC.png, 3-gasometria-antes.png, 4-desarrollo-del-caso.png, 5-gasometria-equilibrio.png, 6-oxigenacion-cerrado.png, 7-oxigenacion-abierto.png, 8-oxigenacion-fio2-1.png, 9-corazon-pulmon-peep15.png',
  ].join('\n');
  writeFileSync(join(SALIDA, 'evidencia.json'), JSON.stringify({ sello: SELLO, url: URL_BASE, evidencia, fallos }, null, 2));
  writeFileSync(join(SALIDA, 'resumen.md'), resumen + '\n');
  await navegador?.close();
  detener();
  console.log(resumen);
  console.log(`\nEvidencia en ${SALIDA}`);
  process.exitCode = fallos.some((f) => f.startsWith('doctor')) ? 2 : fallos.length ? 1 : 0;
}
