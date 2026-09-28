/**
 * Pestaña «Resumen»: el esquema de una respiración con sus tres presiones marcadas, y las cuatro fórmulas con los
 * números de esta respiración sustituidos. Presentación pura sobre lo que el motor publica; aquí no se calcula física.
 */
import type { EngineFrame } from '../engine/simulator';
import type { AppContext } from './context';
import { $, $$, esc } from './dom';
import { formatNumber as f } from '../domain/units';
import { estres, niveles, tarjetas, titulacion, type PuntoTitulacion, type Tarjeta } from './teaching';
import { humanReason } from './humanize';

export interface TeachingView {
  render(): void;
}

/** Esquema de una respiración en volumen control: rampa, meseta y espiración, a la escala de lo medido. */
function esquema(fr: EngineFrame, oculto: (k: string) => boolean): string {
  const nv = niveles(fr);
  // En examen cada llave enseña su número sólo si todas las mediciones que lo componen ya se estimaron; la consigna
  // (PEEP programada) no se tapa nunca: no es una medición.
  const ver = (k: string): boolean => !oculto(k);
  const verPeep = nv.peepOrigen === 'bloqueo' ? ver('pplat') && ver('driving') : nv.peepOrigen === 'peepe' ? ver('peepe') : true;
  const cifra = (visible: boolean, texto: string): string => (visible ? texto : '?');
  const techo = Math.max(40, (nv.ppico ?? 20) * 1.25);
  const W = 880,
    H = 156,
    izq = 58,
    der = 200, // se reserva la banda derecha para las llaves y sus rótulos
    base = H - 24,
    alto = base - 20;
  const y = (p: number): number => base - (p / techo) * alto;
  const x0 = izq,
    xIns = izq + 190, // fin de la rampa: Ppico
    xMes = izq + 300, // fin de la meseta: Pplat
    xFin = W - der;
  const peep = nv.peep;
  const peepe = nv.peepe; // sólo cuando difiere de la anterior: entre las dos está la PEEP intrínseca
  const pplat = nv.pplat;
  const ppico = nv.ppico;
  const hayMeseta = pplat !== null && ppico !== null;

  // Sin meseta medida se dibuja igualmente la forma, pero sin las llaves ni los números que exigen la oclusión.
  const pPico = ppico ?? peep + 15;
  const pPlat = pplat ?? peep + 10;
  // La curva de la vía aérea vuelve a la PEEP PROGRAMADA al espirar: la total es alveolar y no se ve en el trazado.
  const pBase = peepe ?? peep;
  const curva = `M ${x0} ${y(pBase)} L ${xIns} ${y(pPico)} L ${xIns} ${y(pPlat)} L ${xMes} ${y(pPlat)} L ${xMes} ${y(pBase)} L ${xFin} ${y(pBase)}`;

  const linea = (p: number, rotulo: string, color: string): string =>
    `<line x1="${izq}" y1="${y(p)}" x2="${xFin + 8}" y2="${y(p)}" stroke="${color}" stroke-width="1" stroke-dasharray="4 4" opacity=".65"/>` +
    `<text x="${izq - 8}" y="${y(p) + 4}" text-anchor="end" font-size="12" fill="${color}">${rotulo}</text>`;

  /**
   * Llave vertical con su rótulo en UNA línea, a la derecha del trazo. Las tres comparten columna: como cada una abarca
   * un tramo distinto de presión, sus rótulos caen a alturas distintas y no se pisan. Repartirlas en tres columnas los
   * hacía solaparse en horizontal, porque el texto es más ancho que la separación.
   */
  const llave = (pa: number, pb: number, titulo: string, valor: string, color: string): string => {
    const xs = xFin + 14;
    const ya = y(pa),
      yb = y(pb),
      ym = (ya + yb) / 2;
    return (
      `<path d="M ${xs} ${ya} h 8 V ${yb} h -8" fill="none" stroke="${color}" stroke-width="1.5"/>` +
      `<text x="${xs + 16}" y="${ym + 4}" font-size="12" fill="${color}" font-weight="600">${esc(valor)}` +
      `<tspan fill="#a6d0ed" font-weight="400"> · ${esc(titulo)}</tspan></text>`
    );
  };

  const llaves = hayMeseta
    ? llave(pPico, pPlat, 'resistiva, R·Q', cifra(ver('ppeak') && ver('pplat'), `${f(pPico - pPlat, 1)} cmH₂O`), '#ffd27a') +
      llave(pPlat, peep, 'elástica, ΔP', cifra(ver('pplat') && verPeep, `${f(pPlat - peep, 1)} cmH₂O`), '#7ce0b8') +
      // Con atrapamiento la carga elástica se mide desde la PEEP TOTAL, y el tramo que va de la programada a la total
      // es la PEEP intrínseca: el esquema la dibuja aparte en vez de esconderla dentro de la elástica.
      (peepe !== null
        ? llave(peep, peepe, 'PEEP intrínseca', cifra(ver('peepe') && verPeep, `${f(peep - peepe, 1)} cmH₂O`), '#ffb0c8')
        : '') +
      llave(
        peepe ?? peep,
        0,
        peepe !== null ? 'PEEP programada' : 'PEEP',
        cifra(peepe !== null ? ver('peepe') : verPeep, `${f(peepe ?? peep, 1)} cmH₂O`),
        '#9fd0f0',
      )
    : `<text x="${xFin + 14}" y="${y(pPlat)}" font-size="12" fill="#a6d0ed">Haz un bloqueo inspiratorio</text>` +
      `<text x="${xFin + 14}" y="${y(pPlat) + 15}" font-size="12" fill="#a6d0ed">para separar las dos cargas</text>`;

  return (
    `<svg viewBox="0 0 ${W} ${H}" class="edu-svg" role="img" aria-label="Esquema de la presión de vía aérea en una respiración, con la carga resistiva y la elástica separadas">` +
    `<line x1="${izq}" y1="${base}" x2="${xFin + 8}" y2="${base}" stroke="#4b7fb5" stroke-width="1"/>` +
    `<text x="${izq + 4}" y="14" font-size="12" fill="#bfe6ff" font-family="ui-monospace, Menlo, monospace">Paw = PEEP + R·Q + V/C</text>` +
    linea(peepe ?? peep, peepe !== null ? 'PEEP' : 'PEEP', '#9fd0f0') +
    (peepe !== null ? linea(peep, 'PEEPtot', '#ffb0c8') : '') +
    (hayMeseta ? linea(pPlat, 'Pplat', '#7ce0b8') + linea(pPico, 'Ppico', '#ffd27a') : '') +
    `<path d="${curva}" fill="none" stroke="#eaffff" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<text x="${(x0 + xIns) / 2}" y="${base + 14}" text-anchor="middle" font-size="11" fill="#8fb8d8">flujo entrando</text>` +
    `<text x="${(xIns + xMes) / 2}" y="${base + 14}" text-anchor="middle" font-size="11" fill="#8fb8d8">oclusión</text>` +
    `<text x="${(xMes + xFin) / 2}" y="${base + 14}" text-anchor="middle" font-size="11" fill="#8fb8d8">espiración</text>` +
    llaves +
    `</svg>`
  );
}

/** Qué métrica muestra cada tarjeta y qué mediciones mezcla su fórmula sustituida (para taparlas en examen). */
const CLAVE_TARJETA: Record<string, string> = { ppico: 'ppeak', pplat: 'pplat', driving: 'driving', cstat: 'cstat' };
const MEZCLA_TARJETA: Record<string, string[]> = {
  ppico: ['ppeak', 'pplat', 'driving', 'peepe'],
  pplat: ['pplat', 'driving'],
  driving: ['pplat', 'driving'],
  cstat: ['cstat', 'driving', 'vte'],
};

function tarjetaHTML(t: Tarjeta, oculto: (k: string) => boolean): string {
  const clave = CLAVE_TARJETA[t.id] ?? t.id;
  // Tapar el número pero dejar el color «dentro/fuera» delataría el veredicto: con el «?» el estado se neutraliza.
  const tapado = oculto(clave) && t.valor !== null;
  const valor = tapado ? '?' : t.valor === null ? '—' : f(t.valor, t.decimales);
  // La sustitución mezcla otras mediciones: se oculta entera si cualquiera de sus ingredientes sigue tapado,
  // o si la propia medición de la tarjeta lo está (enseñar «23 = 5 + 8 + 10» ya responde la estimación).
  const tapaSustitucion = tapado || (t.sustituida !== null && (MEZCLA_TARJETA[t.id] ?? []).some(oculto));
  const linea = tapaSustitucion
    ? `<code class="edu-formula">${esc(t.formula)}</code><p class="edu-falta">En examen se revela al estimar la medición en la columna numérica.</p>`
    : t.sustituida
      ? `<code class="edu-formula">${esc(t.formula)} <span class="edu-flecha">→</span> <b>${esc(t.sustituida)}</b></code>`
      : `<code class="edu-formula">${esc(t.formula)}</code><p class="edu-falta">${esc(t.faltaPara)}</p>`;
  const ref = t.referencia
    ? `<p class="edu-ref">Referencia <b>${esc(t.referencia.texto)}</b> <small>${esc(t.referencia.fuente)}</small></p>`
    : '<p class="edu-ref edu-sinref">Sin rango de referencia</p>';
  return (
    `<article class="edu-card edu-${tapado ? 'sinDato' : t.estado}">` +
    `<header><h3>${esc(t.titulo)}</h3><b>${esc(valor)}<small>${esc(t.unidad)}</small></b></header>` +
    linea +
    ref +
    `<p class="edu-nota">${esc(t.nota.trim())}</p>` +
    `</article>`
  );
}

/** Silueta de la rampa de presión para un exponente dado: la forma que tiene el índice de estrés. */
function silueta(b: number, activo: boolean, titulo: string, pie: string): string {
  const W = 132,
    H = 62,
    m = 8;
  const pts: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    pts.push(`${(m + u * (W - 2 * m)).toFixed(1)},${(H - m - Math.pow(u, b) * (H - 2 * m)).toFixed(1)}`);
  }
  const color = activo ? '#eaffff' : '#5f8bae';
  return (
    `<figure class="edu-silueta${activo ? ' activa' : ''}">` +
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo)}">` +
    `<polyline points="${m},${H - m} ${W - m},${H - m}" fill="none" stroke="#4b7fb5" stroke-width="1"/>` +
    `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>` +
    `</svg><figcaption><b>${esc(titulo)}</b><span>${esc(pie)}</span></figcaption></figure>`
  );
}

/** Curva de titulación con los puntos que el alumno midió; sin puntos, dice cómo construirla. */
function graficoTitulacion(puntos: PuntoTitulacion[], oculto: (k: string) => boolean): string {
  const { puntos: p, mejor } = titulacion(puntos);
  // Cada punto es una Cstat: con la métrica tapada, sus rótulos también (la posición ya la dibuja la geometría).
  const verCstat = !oculto('cstat');
  if (p.length < 2)
    return (
      `<p class="edu-falta">Mide la distensibilidad con un bloqueo inspiratorio a distintas PEEP y aquí se dibuja tu curva. ` +
      `Llevas ${p.length} de los 2 puntos que hacen falta para empezar a verla.</p>`
    );
  const W = 380,
    H = 150,
    izq = 44,
    aba = 26;
  const xs = p.map((q) => q.peep),
    ys = p.map((q) => q.cstat);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y1 = Math.max(...ys) * 1.12;
  const X = (v: number): number => izq + ((v - x0) / Math.max(1e-9, x1 - x0)) * (W - izq - 12);
  const Y = (v: number): number => H - aba - (v / y1) * (H - aba - 12);
  const linea = p.map((q) => `${X(q.peep).toFixed(1)},${Y(q.cstat).toFixed(1)}`).join(' ');
  const circulos = p
    .map(
      (q) =>
        `<circle cx="${X(q.peep).toFixed(1)}" cy="${Y(q.cstat).toFixed(1)}" r="${q === mejor ? 5 : 3.5}" fill="${q === mejor ? '#7ce0b8' : '#bfe6ff'}"/>`,
    )
    .join('');
  const marca = mejor
    ? `<text x="${Math.min(W - 90, X(mejor.peep) + 8).toFixed(1)}" y="${(Y(mejor.cstat) - 8).toFixed(1)}" font-size="11" fill="#7ce0b8" font-weight="600">` +
      `${verCstat ? f(mejor.cstat, 0) : '?'} a PEEP ${f(mejor.peep, 0)}</text>`
    : '';
  return (
    `<svg viewBox="0 0 ${W} ${H}" class="edu-titulacion" role="img" aria-label="Distensibilidad estática medida a distintas PEEP">` +
    `<line x1="${izq}" y1="${H - aba}" x2="${W - 12}" y2="${H - aba}" stroke="#4b7fb5" stroke-width="1"/>` +
    `<line x1="${izq}" y1="12" x2="${izq}" y2="${H - aba}" stroke="#4b7fb5" stroke-width="1"/>` +
    `<polyline points="${linea}" fill="none" stroke="#bfe6ff" stroke-width="1.5"/>` +
    circulos +
    marca +
    `<text x="${izq + 4}" y="12" font-size="10" fill="#9dc4e2">${verCstat ? `${f(y1, 0)} mL/cmH₂O` : '?'}</text>` +
    `<text x="${izq - 6}" y="${H - aba}" text-anchor="end" font-size="10" fill="#9dc4e2">0</text>` +
    `<text x="${izq}" y="${H - 8}" font-size="10" fill="#9dc4e2">PEEP ${f(x0, 0)}</text>` +
    `<text x="${W - 12}" y="${H - 8}" text-anchor="end" font-size="10" fill="#9dc4e2">PEEP ${f(x1, 0)}</text>` +
    `</svg>`
  );
}

/** Potencia mecánica con su descomposición: la energía que va contra la PEEP, la resistiva y la elástica de la última respiración. */
function potenciaHTML(fr: EngineFrame, oculto: (k: string) => boolean): string {
  const pm = fr.metrics.mechPower;
  const valor = pm && pm.value !== null ? (oculto('mechPower') ? '?' : `${f(pm.value, 1)}<small>J/min</small>`) : '—';
  const s = fr.settings;
  const peep = s.peep === 'off' ? 0 : s.peep;
  const vte = fr.metrics.vte?.value ?? null,
    ppeak = fr.metrics.ppeak?.value ?? null,
    pplat = fr.metrics.pplatCycle?.value ?? fr.procedure.last.inspHold?.values.pplat?.value ?? null,
    rr = fr.metrics.rr?.value ?? null;
  // En examen cada cifra medida se tapa por separado; la PEEP es consigna y queda a la vista.
  const cifra = (keys: string[], texto: string): string => (keys.every((k) => !oculto(k)) ? texto : '?');
  const hayVteRr = vte !== null && rr !== null;
  const partes =
    hayVteRr && ppeak !== null
      ? `Con la última respiración (${cifra(['vte'], f(vte * 1000, 0))} mL a ${cifra(['rr'], f(rr, 0))}/min): contra la PEEP ${cifra(['vte', 'rr'], f(0.098 * rr * vte * peep, 1))} J/min` +
        (pplat !== null
          ? ` · resistiva ${cifra(['vte', 'rr', 'ppeak', 'pplat'], f(0.098 * rr * vte * Math.max(0, ppeak - pplat), 1))} · elástica ${cifra(['vte', 'rr', 'pplat'], f(0.098 * rr * vte * 0.5 * Math.max(0, pplat - peep), 1))}`
          : ' · resistiva y elástica juntas: mide una Pplat para separarlas') +
        '.'
      : 'Aparece con la ventana de respiraciones completa.';
  return (
    `<section class="edu-bloque">` +
    `<header><h3>Potencia mecánica</h3><b>${valor}</b></header>` +
    `<p class="edu-nota">${esc(partes)}</p>` +
    `<p class="edu-ref">Es el área presión-volumen de cada inspiración por la frecuencia: presión, volumen y frecuencia en un solo número. ` +
    `Bajar el VT la reduce; subir la frecuencia para recuperar el volumen minuto la devuelve.</p>` +
    `</section>`
  );
}

function proteccionHTML(fr: EngineFrame, puntos: PuntoTitulacion[], oculto: (k: string) => boolean): string {
  const e = estres(fr);
  // En examen el número, el régimen que describe y la silueta activa van tapados: cualquiera de los tres respondería
  // la estimación antes de que el alumno la escriba.
  const taparEstres = oculto('stressIndex') && e.valor !== null;
  const activo = (r: string): boolean => !taparEstres && e.regimen === r;
  const cabecera = taparEstres ? '?' : e.valor === null ? '—' : f(e.valor, 2);
  const lectura = taparEstres
    ? 'En examen se revela al estimar la medición en la columna numérica.'
    : e.valor === null
      ? `No se puede leer aquí: ${humanReason(e.motivo)}.`
      : e.lectura;
  return (
    `<div class="edu-prot">` +
    `<section class="edu-bloque">` +
    `<header><h3>Índice de estrés</h3><b>${esc(cabecera)}</b></header>` +
    `<div class="edu-siluetas">` +
    silueta(0.6, activo('reclutando'), 'b < 0,9', 'sigue reclutando') +
    silueta(1.0, activo('recta'), 'b ≈ 1', 'recta') +
    silueta(1.55, activo('sobredistension'), 'b > 1,1', 'sobredistensión') +
    `</div>` +
    `<p class="edu-nota">${esc(lectura)}</p>` +
    `<p class="edu-ref">Es la forma de la rampa de presión con <b>flujo constante</b>: con el volumen creciendo a ritmo fijo, ` +
    `esa forma es la de la curva presión-volumen dentro del volumen corriente. Sólo se lee con el paciente pasivo y sin techo de presión de por medio.</p>` +
    `</section>` +
    `<section class="edu-bloque">` +
    `<header><h3>Titulación de PEEP</h3><b>${puntos.length}<small>${puntos.length === 1 ? 'punto' : 'puntos'}</small></b></header>` +
    graficoTitulacion(puntos, oculto) +
    `<p class="edu-nota">Tu propia curva: cada punto es una distensibilidad que mediste con un bloqueo a esa PEEP. ` +
    `El máximo es el compromiso entre reclutar lo que falta y no sobredistender lo que ya está abierto.</p>` +
    `</section>` +
    potenciaHTML(fr, oculto) +
    `</div>`
  );
}

export function createTeachingView(ctx: AppContext): TeachingView {
  let firma = '';
  let pantalla: 'presiones' | 'proteccion' = 'presiones';
  let montado = false;

  /** Dos pantallas breves en vez de una larga: el resumen tiene que caber de un vistazo. */
  function montarNav(): void {
    if (montado) return;
    montado = true;
    $('#teaching-tabs').addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest('[data-edu-tab]') as HTMLElement | null;
      if (!b) return;
      pantalla = b.dataset.eduTab === 'proteccion' ? 'proteccion' : 'presiones';
      firma = '';
      ctx.lesson.flags[`edu-${pantalla}`] = true;
      render();
    });
  }

  function render(): void {
    const fr = ctx.frame;
    if (!fr || ctx.view !== 'teaching') return;
    montarNav();
    for (const b of $$('[data-edu-tab]')) {
      const activa = b.dataset.eduTab === pantalla;
      b.classList.toggle('chosen', activa);
      b.setAttribute('aria-pressed', String(activa));
    }
    const puntos = (ctx.lesson.flags.titulacion as PuntoTitulacion[] | undefined) ?? [];
    const t = tarjetas(fr);
    const oculto = (k: string): boolean => ctx.examMasked(k);
    // Sólo se vuelve a pintar cuando algún número cambia: la pestaña no debe parpadear a cada cuadro. La firma
    // incluye qué métricas están tapadas: al estimar una, el resumen tiene que revelar su parte.
    const tapadas = ctx.examMode
      ? ['ppeak', 'peepe', 'pplat', 'driving', 'cstat', 'vte', 'rr', 'mechPower', 'stressIndex'].filter(oculto)
      : [];
    const nueva = JSON.stringify([pantalla, t.map((x) => [x.valor, x.estado, x.sustituida]), niveles(fr), estres(fr), puntos, tapadas]);
    if (nueva === firma) return;
    firma = nueva;
    $('#teaching-body').innerHTML =
      pantalla === 'presiones'
        ? `<div class="edu-diagram">${esquema(fr, oculto)}</div><div class="edu-cards">${t.map((x) => tarjetaHTML(x, oculto)).join('')}</div>` +
          `<p class="edu-pie">Las referencias valen para un paciente <b>pasivo</b> en ventilación controlada: con esfuerzo ` +
          `espontáneo la meseta y la presión motriz dejan de medir lo que se cree que miden.</p>`
        : proteccionHTML(fr, puntos, oculto);
  }

  return { render };
}
