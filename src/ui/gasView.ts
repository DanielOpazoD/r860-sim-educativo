/**
 * Gasometría del modelo en el panel lateral, en dos líneas: PaCO₂ y pH de ahora con su valor al inicio, y la trayectoria
 * de la PaCO₂ con la marca del último cambio. El equipo no la mide: se rotula «modelo» y nunca va al monitor. Junto al
 * rótulo, la salvedad de que el modelo llega a su equilibrio ≈ 10 veces más deprisa que un paciente (ACELERACION_EQUILIBRIO).
 */
import { formatNumber as f } from '../domain/units';
import { ACELERACION_EQUILIBRIO, EQUILIBRIUM_WINDOW_S } from '../engine/gasExchange';
import type { AppContext } from './context';
import { $, element } from './dom';

interface Punto {
  /** Tiempo simulado (s). */
  t: number;
  paco2: number;
}
/** Una muestra cada 2 s simulados; al pasar del máximo se diezma y la curva conserva su forma. */
const PASO_S = 2;
const MAX_PUNTOS = 400;
const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Trayectoria de la PaCO₂ en miniatura: lo ocurrido, el punto de ahora y la marca del último cambio. */
function tendencia(puntos: Punto[], cambioS: number | null, resumen: string): SVGSVGElement {
  const W = 120,
    H = 18,
    PAD = 2;
  // Sin proporción fija: en un panel angosto la tendencia cede ancho y se estira, no se encoge entera.
  const raiz = svg('svg', {
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: 'none',
    class: 'gas-trend',
    role: 'img',
    'aria-label': resumen,
  });
  const t0 = puntos[0]!.t;
  const t1 = Math.max(puntos.at(-1)!.t, t0 + 60);
  const valores = puntos.map((p) => p.paco2);
  const lo = Math.min(...valores) - 1,
    hi = Math.max(...valores) + 1;
  const x = (t: number): number => PAD + ((W - 2 * PAD) * (t - t0)) / (t1 - t0);
  const y = (v: number): number => H - PAD - ((H - 2 * PAD) * (v - lo)) / (hi - lo);
  if (cambioS !== null && cambioS > t0) {
    raiz.append(svg('line', { x1: x(cambioS), x2: x(cambioS), y1: 0, y2: H, class: 'gas-trend-change' }));
  }
  raiz.append(
    svg('polyline', { points: puntos.map((p) => `${x(p.t).toFixed(1)},${y(p.paco2).toFixed(1)}`).join(' '), class: 'gas-trend-line' }),
  );
  const ultimo = puntos.at(-1)!;
  raiz.append(svg('circle', { cx: x(ultimo.t), cy: y(ultimo.paco2), r: 2, class: 'gas-trend-now' }));
  return raiz;
}

export function createGasView(ctx: AppContext): { render(): void } {
  let inicio: { paco2: number; ph: number; pao2: number } | null = null;
  let puntos: Punto[] = [];
  let ultimoMs = -1;
  let scenarioId = '';
  let firma = '';

  function registrar(): void {
    const fr = ctx.frame;
    const g = fr?.truth.gas;
    if (!fr || !g) return;
    // Otro escenario o una sesión que vuelve a empezar (reinicio, sesión importada): la historia es de otra sesión.
    if (fr.simTimeMs < ultimoMs || ctx.scenario.id !== scenarioId) {
      inicio = null;
      puntos = [];
      scenarioId = ctx.scenario.id;
    }
    ultimoMs = fr.simTimeMs;
    const t = fr.simTimeMs / 1000;
    // Mientras el modelo fija el equilibrio inicial con las primeras respiraciones, lo de ahora es lo basal.
    const o = fr.truth.oxy;
    if (o && (!inicio || t <= EQUILIBRIUM_WINDOW_S)) inicio = { paco2: g.paco2, ph: g.ph, pao2: o.pao2 };
    const ultimo = puntos.at(-1);
    if (!ultimo || t - ultimo.t >= PASO_S) {
      puntos.push({ t, paco2: g.paco2 });
      if (puntos.length > MAX_PUNTOS) puntos = puntos.filter((_, i) => i % 2 === 0 || i === puntos.length - 1);
    }
  }

  function render(): void {
    registrar();
    const g = ctx.frame?.truth.gas ?? null;
    const o = ctx.frame?.truth.oxy ?? null;
    const host = $('#case-gas');
    if (!g || !o || !inicio) {
      if (firma !== '—') {
        firma = '—';
        host.replaceChildren(
          element(
            'div',
            'gas-card',
            element('header', 'gas-head', element('span', 'gas-title', 'Gasometría'), element('small', 'gas-tag', 'modelo')),
          ),
        );
      }
      return;
    }
    const contexto = ctx.lesson.context();
    const cambioMs = contexto ? Math.max(contexto.patientChangeMs, contexto.settingsChangeMs) : -1;
    const cambioS = cambioMs >= 0 ? cambioMs / 1000 : null;
    const pct = (s: number): string => f(s * 100, 0);
    const nueva = JSON.stringify([
      f(inicio.paco2, 0),
      f(inicio.ph, 2),
      f(g.paco2, 0),
      f(g.ph, 2),
      f(inicio.pao2, 0),
      f(o.pao2, 0),
      pct(o.sao2),
      f(o.pafi, 0),
      puntos.length,
      cambioS,
    ]);
    if (nueva === firma) return;
    firma = nueva;

    const cifra = (nombre: string, ahora: string, unidad: string): HTMLElement =>
      element(
        'span',
        'gas-now',
        element('small', '', nombre),
        ' ',
        element('b', '', ahora),
        unidad ? element('small', '', ` ${unidad}`) : '',
      );
    // «P/F», la abreviatura de la cabecera: con «PaO₂/FiO₂» la fila se parte en dos en el panel estrecho.
    const pf = cifra('P/F', f(o.pafi, 0), '');
    pf.title = 'PaO₂/FiO₂ (mmHg)';
    pf.setAttribute('aria-label', `PaO₂/FiO₂ ${f(o.pafi, 0)} mmHg`);
    const valor = (nombre: string, ahora: string, unidad: string, alInicio: string): HTMLElement =>
      element('span', 'gas-item', cifra(nombre, ahora, unidad), element('small', 'gas-start', `inicio ${alInicio}`));
    const resumen = `PaCO₂ de ${f(inicio.paco2, 0)} al inicio a ${f(g.paco2, 0)} mmHg ahora.`;
    // La salvedad de la aceleración docente va en la cabecera, junto a «modelo»: el destino es el de un paciente, el ritmo
    // no. En una línea propia restaba al panel el alto que necesita un caso para leerse entero. La cabecera ocupa la fila
    // entera y la tendencia, al final, cede ancho: así la salvedad no se lo quita a las cifras de abajo. Sólo el CO₂ va
    // acelerado: la PaO₂ sigue a su equilibrio en segundos también en un paciente.
    const rapida = element('small', 'gas-rapida', `PaCO₂ ≈ ${ACELERACION_EQUILIBRIO}× más rápida`);
    rapida.title = `Equilibrio de la PaCO₂ ≈ ${ACELERACION_EQUILIBRIO} veces más rápido que en un paciente real`;
    rapida.setAttribute('aria-label', rapida.title);
    const cabeza = element('div', 'gas-head', element('span', 'gas-title', 'Gasometría'), element('small', 'gas-tag', 'modelo'), rapida);
    if (puntos.length > 1) cabeza.append(tendencia(puntos, cambioS, resumen));
    host.replaceChildren(
      element(
        'div',
        'gas-card',
        cabeza,
        valor('PaCO₂', f(g.paco2, 0), 'mmHg', f(inicio.paco2, 0)),
        valor('pH', f(g.ph, 2), '', f(inicio.ph, 2)),
        valor('PaO₂', f(o.pao2, 0), 'mmHg', f(inicio.pao2, 0)),
        // Dos filas: una tercera le quita a un caso el alto que necesita para leerse entero. La PaO₂ lleva el «inicio».
        element('span', 'gas-item', cifra('SaO₂', pct(o.sao2), '%'), pf),
      ),
    );
  }

  return { render };
}
