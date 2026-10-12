/**
 * Gasometría del modelo en el panel lateral: cómo empezó, cómo está y hacia dónde va con la ventilación actual, con la
 * trayectoria de la PaCO₂ y la marca del último cambio. El equipo no la mide: se rotula «modelo» y nunca va al monitor.
 */
import { formatNumber as f } from '../domain/units';
import { EQUILIBRIUM_WINDOW_S, phFrom } from '../engine/gasExchange';
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
/** Distancia al equilibrio que ya se da por alcanzada (mmHg). */
const LLEGADA_MMHG = 1;
const SVG = 'http://www.w3.org/2000/svg';

/** Estado del pH en palabras del clínico; null si está en rango. */
export function estadoPh(ph: number): 'acidemia' | 'alcalemia' | null {
  return ph < 7.35 ? 'acidemia' : ph > 7.45 ? 'alcalemia' : null;
}

/** Minutos simulados hasta quedar a 1 mmHg del equilibrio (aproximación exponencial con su constante de tiempo). */
export function minutosAlEquilibrio(paco2: number, objetivo: number, tauMin: number): number {
  const d = Math.abs(paco2 - objetivo);
  return d <= LLEGADA_MMHG ? 0 : tauMin * Math.log(d / LLEGADA_MMHG);
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Trayectoria de la PaCO₂: línea de lo ocurrido, punto de ahora, raya del equilibrio y marca del último cambio. */
function tendencia(puntos: Punto[], objetivo: number | null, cambioS: number | null, resumen: string): SVGSVGElement {
  const W = 300,
    H = 34,
    PAD = 4;
  const raiz = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gas-trend', role: 'img', 'aria-label': resumen });
  const t0 = puntos[0]!.t;
  const t1 = Math.max(puntos.at(-1)!.t, t0 + 60);
  const valores = puntos.map((p) => p.paco2).concat(objetivo === null ? [] : [objetivo]);
  const lo = Math.min(...valores) - 2,
    hi = Math.max(...valores) + 2;
  const x = (t: number): number => PAD + ((W - 2 * PAD - 34) * (t - t0)) / (t1 - t0);
  const y = (v: number): number => H - PAD - ((H - 2 * PAD) * (v - lo)) / (hi - lo);
  if (cambioS !== null && cambioS > t0) {
    raiz.append(svg('line', { x1: x(cambioS), x2: x(cambioS), y1: PAD, y2: H - PAD, class: 'gas-trend-change' }));
  }
  if (objetivo !== null) {
    raiz.append(svg('line', { x1: PAD, x2: W - 34, y1: y(objetivo), y2: y(objetivo), class: 'gas-trend-target' }));
    const etiqueta = svg('text', { x: W - 30, y: y(objetivo) + 3, class: 'gas-trend-label' });
    etiqueta.textContent = f(objetivo, 0);
    raiz.append(etiqueta);
  }
  raiz.append(
    svg('polyline', { points: puntos.map((p) => `${x(p.t).toFixed(1)},${y(p.paco2).toFixed(1)}`).join(' '), class: 'gas-trend-line' }),
  );
  const ultimo = puntos.at(-1)!;
  raiz.append(svg('circle', { cx: x(ultimo.t), cy: y(ultimo.paco2), r: 2.6, class: 'gas-trend-now' }));
  return raiz;
}

export function createGasView(ctx: AppContext): { render(): void } {
  let inicio: { paco2: number; ph: number } | null = null;
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
    if (!inicio || t <= EQUILIBRIUM_WINDOW_S) inicio = { paco2: g.paco2, ph: g.ph };
    const ultimo = puntos.at(-1);
    if (!ultimo || t - ultimo.t >= PASO_S) {
      puntos.push({ t, paco2: g.paco2 });
      if (puntos.length > MAX_PUNTOS) puntos = puntos.filter((_, i) => i % 2 === 0 || i === puntos.length - 1);
    }
  }

  function render(): void {
    registrar();
    const g = ctx.frame?.truth.gas ?? null;
    const host = $('#case-gas');
    if (!g || !inicio) {
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
    const objetivo = g.paco2Target;
    const phObjetivo = objetivo === null ? null : phFrom(g.hco3, objetivo);
    const contexto = ctx.lesson.context();
    const cambioMs = contexto ? Math.max(contexto.patientChangeMs, contexto.settingsChangeMs) : -1;
    const cambioS = cambioMs >= 0 ? cambioMs / 1000 : null;
    const faltan = objetivo !== null && g.tauMin !== null ? minutosAlEquilibrio(g.paco2, objetivo, g.tauMin) : null;
    const nueva = JSON.stringify([
      f(inicio.paco2, 0),
      f(inicio.ph, 2),
      f(g.paco2, 0),
      f(g.ph, 2),
      objetivo === null ? null : f(objetivo, 0),
      phObjetivo === null ? null : f(phObjetivo, 2),
      faltan === null ? null : Math.ceil(faltan),
      puntos.length,
      cambioS,
    ]);
    if (nueva === firma) return;
    firma = nueva;

    const estado = estadoPh(g.ph);
    const celda = (texto: string, clase = ''): HTMLTableCellElement => element('td', clase, texto);
    const fila = (nombre: string, unidad: string, a: string, b: string, c: string): HTMLTableRowElement => {
      const th = element('th', '', nombre, unidad ? element('small', '', unidad) : '');
      th.scope = 'row';
      return element('tr', '', th, celda(a), celda(b, 'gas-now'), celda(c, 'gas-target'));
    };
    const cabecera = (texto: string): HTMLTableCellElement => {
      const th = element('th', '', texto);
      th.scope = 'col';
      return th;
    };
    const tabla = element(
      'table',
      'gas-table',
      element('thead', '', element('tr', '', element('td', ''), cabecera('Inicio'), cabecera('Ahora'), cabecera('Tiende a'))),
      element(
        'tbody',
        '',
        fila('PaCO₂', 'mmHg', f(inicio.paco2, 0), f(g.paco2, 0), objetivo === null ? '↑' : f(objetivo, 0)),
        fila('pH', '', f(inicio.ph, 2), f(g.ph, 2), phObjetivo === null ? '↓' : f(phObjetivo, 2)),
      ),
    );
    const nota =
      objetivo === null
        ? 'Sin ventilación alveolar: la PaCO₂ sube sin techo.'
        : faltan === 0
          ? 'En equilibrio con la ventilación actual.'
          : `Llega al equilibrio en ≈ ${f(Math.max(1, Math.ceil(faltan!)), 0)} min de simulación. Acelera el tiempo para verlo.`;
    const resumen = `PaCO₂ de ${f(inicio.paco2, 0)} al inicio a ${f(g.paco2, 0)} mmHg ahora${objetivo === null ? ', subiendo' : `; tiende a ${f(objetivo, 0)}`}.`;
    const cabeza = element('header', 'gas-head', element('span', 'gas-title', 'Gasometría'), element('small', 'gas-tag', 'modelo'));
    if (estado) cabeza.append(element('span', `gas-state ${estado}`, estado));
    host.replaceChildren(
      element(
        'div',
        'gas-card',
        cabeza,
        tabla,
        ...(puntos.length > 1 ? [tendencia(puntos, objetivo, cambioS, resumen)] : []),
        element('p', 'gas-note', nota),
      ),
    );
  }

  return { render };
}
