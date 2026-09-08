/**
 * Pestaña «Resumen»: el esquema de una respiración con sus tres presiones marcadas, y las cuatro fórmulas con los
 * números de esta respiración sustituidos. Presentación pura sobre lo que el motor publica; aquí no se calcula física.
 */
import type { EngineFrame } from '../engine/simulator';
import type { AppContext } from './context';
import { $, esc } from './dom';
import { formatNumber as f } from '../domain/units';
import { niveles, tarjetas, type Tarjeta } from './teaching';

export interface TeachingView {
  render(): void;
}

/** Esquema de una respiración en volumen control: rampa, meseta y espiración, a la escala de lo medido. */
function esquema(fr: EngineFrame): string {
  const nv = niveles(fr);
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
  const pplat = nv.pplat;
  const ppico = nv.ppico;
  const hayMeseta = pplat !== null && ppico !== null;

  // Sin meseta medida se dibuja igualmente la forma, pero sin las llaves ni los números que exigen la oclusión.
  const pPico = ppico ?? peep + 15;
  const pPlat = pplat ?? peep + 10;
  const curva = `M ${x0} ${y(peep)} L ${xIns} ${y(pPico)} L ${xIns} ${y(pPlat)} L ${xMes} ${y(pPlat)} L ${xMes} ${y(peep)} L ${xFin} ${y(peep)}`;

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
    ? llave(pPico, pPlat, 'resistiva, R·Q', `${f(pPico - pPlat, 1)} cmH₂O`, '#ffd27a') +
      llave(pPlat, peep, 'elástica, ΔP', `${f(pPlat - peep, 1)} cmH₂O`, '#7ce0b8') +
      llave(peep, 0, 'PEEP', `${f(peep, 1)} cmH₂O`, '#9fd0f0')
    : `<text x="${xFin + 14}" y="${y(pPlat)}" font-size="12" fill="#a6d0ed">Haz un bloqueo inspiratorio</text>` +
      `<text x="${xFin + 14}" y="${y(pPlat) + 15}" font-size="12" fill="#a6d0ed">para separar las dos cargas</text>`;

  return (
    `<svg viewBox="0 0 ${W} ${H}" class="edu-svg" role="img" aria-label="Esquema de la presión de vía aérea en una respiración, con la carga resistiva y la elástica separadas">` +
    `<line x1="${izq}" y1="${base}" x2="${xFin + 8}" y2="${base}" stroke="#4b7fb5" stroke-width="1"/>` +
    `<text x="${izq + 4}" y="14" font-size="12" fill="#bfe6ff" font-family="ui-monospace, Menlo, monospace">Paw = PEEP + R·Q + V/C</text>` +
    linea(peep, 'PEEP', '#9fd0f0') +
    (hayMeseta ? linea(pPlat, 'Pplat', '#7ce0b8') + linea(pPico, 'Ppico', '#ffd27a') : '') +
    `<path d="${curva}" fill="none" stroke="#eaffff" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<text x="${(x0 + xIns) / 2}" y="${base + 14}" text-anchor="middle" font-size="11" fill="#8fb8d8">flujo entrando</text>` +
    `<text x="${(xIns + xMes) / 2}" y="${base + 14}" text-anchor="middle" font-size="11" fill="#8fb8d8">oclusión</text>` +
    `<text x="${(xMes + xFin) / 2}" y="${base + 14}" text-anchor="middle" font-size="11" fill="#8fb8d8">espiración</text>` +
    llaves +
    `</svg>`
  );
}

function tarjetaHTML(t: Tarjeta): string {
  const valor = t.valor === null ? '—' : f(t.valor, t.decimales);
  // La sustitución puede faltar por dos motivos que no se pueden confundir: o no hay medición todavía, o la hay pero
  // la descomposición necesita la meseta. La Ppico se lee siempre; su desglose en carga resistiva y elástica, no.
  // Fórmula y sustitución en una sola línea: se leen juntas y así las cuatro tarjetas caben sin desplazar la pestaña.
  const linea = t.sustituida
    ? `<code class="edu-formula">${esc(t.formula)} <span class="edu-flecha">→</span> <b>${esc(t.sustituida)}</b></code>`
    : `<code class="edu-formula">${esc(t.formula)}</code><p class="edu-falta">${esc(t.faltaPara)}</p>`;
  const ref = t.referencia
    ? `<p class="edu-ref">Referencia <b>${esc(t.referencia.texto)}</b> <small>${esc(t.referencia.fuente)}</small></p>`
    : '<p class="edu-ref edu-sinref">Sin rango de referencia</p>';
  return (
    `<article class="edu-card edu-${t.estado}">` +
    `<header><h3>${esc(t.titulo)}</h3><b>${esc(valor)}<small>${esc(t.unidad)}</small></b></header>` +
    linea +
    ref +
    `<p class="edu-nota">${esc(t.nota.trim())}</p>` +
    `</article>`
  );
}

export function createTeachingView(ctx: AppContext): TeachingView {
  let firma = '';
  return {
    render() {
      const fr = ctx.frame;
      if (!fr || ctx.view !== 'teaching') return;
      const t = tarjetas(fr);
      // Sólo se vuelve a pintar cuando algún número cambia: la pestaña no debe parpadear a cada cuadro.
      const nueva = JSON.stringify([t.map((x) => [x.valor, x.estado, x.sustituida]), niveles(fr)]);
      if (nueva === firma) return;
      firma = nueva;
      $('#teaching-body').innerHTML =
        `<div class="edu-diagram">${esquema(fr)}</div><div class="edu-cards">${t.map(tarjetaHTML).join('')}</div>` +
        `<p class="edu-pie">Rangos de <b>literatura clínica</b>, no del fabricante: valen para un paciente <b>pasivo</b> en ` +
        `ventilación controlada y no son ajustes sugeridos para ningún paciente.</p>`;
    },
  };
}
