import { describe, expect, it } from 'vitest';
import { Simulator, type EngineFrame } from '../../src/engine/simulator';
import { defaultInit, R860_PROFILE } from '../../src/profiles';
import {
  appendSamples,
  cursorTimeAt,
  cyclePoints,
  getBounds,
  nearestSample,
  stableBounds,
  timeAxisLabels,
  visiblePoints,
  type Bounds,
  type Point,
  type SampleBuffers,
  type ScaleState,
} from '../../src/render/plots';
import { formatNumber } from '../../src/domain/units';
import { SCENARIOS } from '../../src/scenarios';

// Lo que se dibuja tiene que decir lo mismo que el número y la alarma, y no cambiar de tamaño bajo el ojo del alumno.
// Estas pruebas reconstruyen la traza como la interfaz —cuadro a cuadro, con las muestras que publica el motor— en vez
// de mirar la señal del motor directamente: los dos defectos vivían justo en ese paso.

type Ingerir = (pts: Point[], s: SampleBuffers) => void;

/** El diezmado que había: una de cada cinco muestras, reempezando en cada cuadro. */
const diezmadoAntiguo: Ingerir = (pts, s) => {
  const lastT = pts[pts.length - 1]?.[0] ?? -1;
  for (let i = 0; i < s.t.length; i += 5) {
    const t = (s.t[i] as number) / 1000;
    if (t <= lastT) continue;
    pts.push([t, s.paw[i] as number, (s.flow[i] as number) * 60, (s.vol[i] as number) * 1000, s.pmus[i] as number, s.breath[i] as number]);
  }
};

/** Corre un escenario con sus perturbaciones y entrega un cuadro cada `pasosPorCuadro` pasos, como el Worker. */
function correr(id: string, hastaMs: number, pasosPorCuadro: number | (() => number), alCuadro: (fr: EngineFrame) => void): Simulator {
  const e = SCENARIOS.find((s) => s.id === id)!;
  const base = defaultInit({});
  const sim = new Simulator(
    defaultInit({
      patient: { ...e.patient },
      effort: { ...e.effort },
      sensors: { ...e.sensors },
      settings: { ...base.settings, ...(e.settings ?? {}) },
      initialV: e.initialV ?? 'equilibrium',
    }),
    R860_PROFILE,
  );
  const pendientes = [...(e.perturbations ?? [])];
  while (sim.simTimeMs < hastaMs) {
    const pedido = typeof pasosPorCuadro === 'number' ? pasosPorCuadro : pasosPorCuadro();
    // El último cuadro no se pasa del final: así todas las particiones simulan exactamente el mismo tramo.
    const n = Math.min(pedido, Math.ceil((hastaMs - sim.simTimeMs) / sim.clock.dtMs - 1e-9));
    // Las perturbaciones se aplican por paso y no por cuadro: así la física no depende de cómo se agrupen las muestras.
    for (let k = 0; k < n; k++) {
      sim.step();
      while (pendientes.length && sim.simTimeMs >= pendientes[0]!.atSimTimeMs) {
        const p = pendientes.shift()!;
        if (p.patient) sim.command({ type: 'setPatient', params: p.patient });
      }
    }
    alCuadro(sim.frame());
  }
  return sim;
}

/** Máximo de Paw dibujado dentro de cada respiración que Pmáx cortó tras la perturbación. */
function picosCortados(id: string, desdeMs: number, hastaMs: number, pasosPorCuadro: number, ingerir: Ingerir) {
  const pts: Point[] = [];
  const sim = correr(id, hastaMs, pasosPorCuadro, (fr) => ingerir(pts, fr.samples));
  return sim.breaths
    .filter((b) => b.pmaxReached && b.startSimTimeMs >= desdeMs)
    .map((b) => {
      const tramo = pts.filter((p) => p[0] * 1000 >= b.startSimTimeMs - 1e-6 && p[0] * 1000 < b.endSimTimeMs - 1e-6);
      return { id: b.breathId, ppeak: b.ppeak, dibujado: Math.max(...tramo.map((p) => p[1])) };
    });
}

describe('CUR-01 · la curva llega a donde dicen el número y la alarma', () => {
  it('cada respiración que Pmáx corta se ve tocar Pmáx en la curva', () => {
    // SC-09: la resistencia sube a 400 a los 12 s, la presión toca Pmáx 40 durante un solo paso y la inspiración se
    // corta. Cuadros de 13 pasos: el tamaño con el que el diezmado antiguo perdía todos los picos.
    const picos = picosCortados('SC-09', 12_000, 30_000, 13, (pts, s) => appendSamples(pts, s));
    expect(picos.length, 'la perturbación tiene que cortar respiraciones por Pmáx').toBeGreaterThanOrEqual(3);
    for (const p of picos) expect(p.dibujado, `${p.id}: Ppico ${p.ppeak}`).toBeGreaterThanOrEqual(p.ppeak - 0.5);
  });

  it('con el diezmado de antes esos picos no llegaban a la pantalla: la prueba mide algo', () => {
    const picos = picosCortados('SC-09', 12_000, 30_000, 13, diezmadoAntiguo);
    const perdidos = picos.filter((p) => p.dibujado < p.ppeak - 10);
    expect(perdidos.length, JSON.stringify(picos)).toBeGreaterThan(0);
  });

  it('lo que se dibuja no depende de cómo el motor agrupe las muestras en cuadros', () => {
    // El diezmado antiguo reempezaba en cada cuadro: el mismo pulmón se dibujaba distinto según cuántos pasos trajera
    // cada uno, y el pico de Pmáx salía o no. La traza tiene que ser idéntica con cuadros de 1, 10, 13 o 25 pasos, y con
    // cuadros de tamaño variable como los que produce un Worker con la máquina ocupada.
    const trazaCon = (pasos: number | (() => number)): Point[] => {
      const pts: Point[] = [];
      correr('SC-09', 30_000, pasos, (fr) => appendSamples(pts, fr.samples));
      return pts;
    };
    const referencia = trazaCon(1);
    let semilla = 20_260_910;
    const variable = (): number => {
      semilla = (semilla * 1_103_515_245 + 12_345) % 2_147_483_648;
      return 1 + (semilla % 29);
    };
    for (const pasos of [10, 13, 25, variable]) {
      const t = trazaCon(pasos);
      expect(t.length, `cuadros de ${typeof pasos === 'number' ? pasos : 'tamaño variable'}`).toBe(referencia.length);
      expect(t).toEqual(referencia);
    }
    expect(Math.max(...referencia.map((p) => p[1])), 'y la referencia contiene el pico de Pmáx').toBeCloseTo(40, 6);
  });

  it('la traza no crece sin tope: guarda 120 s, descarta lo más antiguo y no repite instantes', () => {
    const pts: Point[] = [];
    const muestras = (desde: number, n: number): SampleBuffers => {
      const t = Float64Array.from({ length: n }, (_, i) => (desde + i) * 4);
      const cero = new Float32Array(n);
      return { t, paw: cero, flow: cero, vol: cero, pmus: cero, breath: cero };
    };
    appendSamples(pts, muestras(0, 20_000), 30_000);
    appendSamples(pts, muestras(20_000, 20_000), 30_000);
    expect(pts.length).toBe(30_000);
    expect(pts[0]![0]).toBeCloseTo(10_000 * 0.004, 9);
    appendSamples(pts, muestras(39_999, 1), 30_000);
    expect(pts.length, 'una muestra del mismo instante no entra dos veces').toBe(30_000);
  });
});

describe('CUR-02 · la escala no cambia de tamaño en mitad del barrido', () => {
  /** Recorre el escenario dibujando cada 40 ms con ventana de 12 s en barrido; cuenta encogimientos a destiempo y recortes. */
  function recorrer(id: string, desdeMs: number, hastaMs: number, conHisteresis: boolean) {
    const win = 12;
    const pts: Point[] = [];
    const aDestiempo: string[] = [];
    let recortes = 0;
    let estado: ScaleState | null = null;
    let anterior: Bounds | null = null;
    correr(id, hastaMs, 10, (fr) => {
      appendSamples(pts, fr.samples);
      const end = fr.simTimeMs / 1000;
      const vis = visiblePoints(pts, end, win);
      const medido = getBounds(vis, fr.settings.peep === 'off' ? 0 : fr.settings.peep, fr.settings.vt * 1000);
      let b = medido;
      if (conHisteresis) {
        estado = stableBounds(estado, medido, end, win, 'sweep');
        b = estado.bounds;
      }
      if (fr.simTimeMs >= desdeMs && anterior) {
        const fase = (end % win) / win;
        const encoge =
          b.pressure < anterior.pressure ||
          b.flow < anterior.flow ||
          b.volume < anterior.volume ||
          b.minPressure > anterior.minPressure ||
          b.minVolume > anterior.minVolume;
        // Encoger con el barrido a medio camino es el salto que se ve; en el origen la traza empieza a redibujarse.
        if (encoge && fase > 0.02) aDestiempo.push(`t=${end.toFixed(2)} (barrido al ${Math.round(fase * 100)} %)`);
      }
      if (vis.some((p) => p[1] > b.pressure || p[1] < b.minPressure || Math.abs(p[2]) > b.flow || p[3] > b.volume || p[3] < b.minVolume))
        recortes++;
      anterior = b;
    });
    return { aDestiempo, recortes };
  }

  it('SC-18: con la escala de cada cuadro el eje encoge a medio barrido; con histéresis nunca, y nada se recorta', () => {
    const directa = recorrer('SC-18', 40_000, 75_000, false);
    expect(directa.aDestiempo.length, 'control: el defecto tiene que reproducirse').toBeGreaterThan(0);
    const estable = recorrer('SC-18', 40_000, 75_000, true);
    expect(estable.aDestiempo, estable.aDestiempo.join(' · ')).toEqual([]);
    expect(estable.recortes).toBe(0);
  });

  it('SC-09 igual: al cortar Pmáx las escalas no se desploman a medio barrido', () => {
    const estable = recorrer('SC-09', 12_000, 40_000, true);
    expect(estable.aDestiempo, estable.aDestiempo.join(' · ')).toEqual([]);
    expect(estable.recortes).toBe(0);
  });

  it('la regla: crece en el acto, y encoge sólo tras una ventana entera y con el barrido en el origen', () => {
    const grande: Bounds = { pressure: 80, flow: 160, volume: 1000, minPressure: -10, minVolume: -100 };
    const chico: Bounds = { pressure: 40, flow: 60, volume: 600, minPressure: -10, minVolume: -60 };
    let s = stableBounds(null, grande, 10, 12, 'sweep');
    s = stableBounds(s, chico, 13, 12, 'sweep');
    expect(s.bounds, 'recién empieza a caber en menos').toEqual(grande);
    s = stableBounds(s, chico, 23.9, 12, 'sweep');
    expect(s.bounds, 'misma pasada del barrido').toEqual(grande);
    s = stableBounds(s, chico, 24.05, 12, 'sweep');
    expect(s.bounds, 'en el origen, pero aún no lleva una ventana entera').toEqual(grande);
    s = stableBounds(s, chico, 36.02, 12, 'sweep');
    expect(s.bounds, 'siguiente origen y más de una ventana: encoge').toEqual(chico);
    s = stableBounds(s, grande, 36.06, 12, 'sweep');
    expect(s.bounds, 'crecer no espera').toEqual(grande);
    expect(stableBounds(s, chico, 1, 12, 'sweep').bounds, 'tiempo hacia atrás: sesión nueva').toEqual(chico);
    // En continuo no hay origen: basta la ventana entera.
    let c = stableBounds(null, grande, 0, 12, 'scroll');
    c = stableBounds(c, chico, 1, 12, 'scroll');
    c = stableBounds(c, chico, 13.5, 12, 'scroll');
    expect(c.bounds).toEqual(chico);
  });
});

describe('CUR-03 · congeladas, el eje y el cursor dicen el mismo tiempo', () => {
  it('en continuo el eje rotula el tiempo de simulación y el cursor lo recorre de borde a borde', () => {
    const r = timeAxisLabels('scroll', 53.4, 12);
    [41.4, 45.4, 49.4, 53.4].forEach((v, k) => expect(r[k]!).toBeCloseTo(v, 9));
    expect(cursorTimeAt(0, 'scroll', 53.4, 12)).toBeCloseTo(41.4, 9);
    expect(cursorTimeAt(0.5, 'scroll', 53.4, 12)).toBeCloseTo(47.4, 9);
    expect(cursorTimeAt(1, 'scroll', 53.4, 12)).toBeCloseTo(53.4, 9);
    expect(cursorTimeAt(1.7, 'scroll', 53.4, 12), 'fuera de la ventana se acota').toBeCloseTo(53.4, 9);
  });

  it('en barrido el eje rotula la fase, y el cursor cae en la pasada que se ve a cada lado de la unión', () => {
    expect(timeAxisLabels('sweep', 53.4, 12)).toEqual([0, 4, 8, 12]);
    // Pasada en curso desde 48 s hasta 53,4 s (fase 0 a 0,45); a la derecha de la unión, la pasada anterior.
    expect(cursorTimeAt(0, 'sweep', 53.4, 12)).toBeCloseTo(48, 9);
    expect(cursorTimeAt(0.25, 'sweep', 53.4, 12)).toBeCloseTo(51, 9);
    expect(cursorTimeAt(0.5, 'sweep', 53.4, 12), 'pasada anterior').toBeCloseTo(42, 9);
    expect(cursorTimeAt(1, 'sweep', 53.4, 12), 'el borde derecho no salta al izquierdo').toBeCloseTo(48, 6);
    // Y cae exactamente donde se dibuja: la fase del instante devuelto es la fracción pedida.
    for (const r of [0, 0.1, 0.44, 0.46, 0.9]) {
      const t = cursorTimeAt(r, 'sweep', 53.4, 12);
      expect((((t % 12) + 12) % 12) / 12, `r=${r}`).toBeCloseTo(r, 9);
    }
  });

  it('la muestra más cercana es la misma que recorriendo la traza entera', () => {
    const pts: Point[] = Array.from({ length: 5000 }, (_, i) => [i * 0.004, i, 0, 0, 0, 1] as Point);
    for (const t of [-1, 0, 0.0021, 3.3339, 19.9959, 25]) {
      const lineal = pts.reduce((best, p) => (Math.abs(p[0] - t) < Math.abs(best[0] - t) ? p : best), pts[0]!);
      expect(nearestSample(pts, t), `t=${t}`).toBe(lineal);
    }
    expect(nearestSample([], 1)).toBeNull();
  });

  it('los dos últimos ciclos se encuentran igual buscando desde el final', () => {
    const antiguo = (points: Point[], which: 'last' | 'current'): Point[] => {
      const ids = [...new Set(points.map((p) => p[5]).filter((v) => v > 0))];
      const id = which === 'current' ? ids[ids.length - 1] : ids[ids.length - 2];
      return id === undefined ? [] : points.filter((p) => p[5] === id);
    };
    const traza = (ids: number[]): Point[] => ids.map((id, i) => [i * 0.004, 0, 0, 0, 0, id] as Point);
    for (const ids of [[], [0, 0], [1, 1, 1], [0, 1, 1, 2, 2, 2], [3, 3, 4, 5, 5, 6, 6, 6]]) {
      const pts = traza(ids);
      for (const w of ['last', 'current'] as const) expect(cyclePoints(pts, w), `${w} ${ids.join(',')}`).toEqual(antiguo(pts, w));
    }
  });

  it('el lector no escribe un cero con signo', () => {
    // Al final de la espiración el flujo y el volumen quedan en millonésimas negativas. «Flujo -0.0 L/min» se lee como
    // gas que sale cuando no sale nada: un valor que redondea a cero se escribe sin signo.
    expect(formatNumber(-0.0004, 1)).toBe('0.0');
    expect(formatNumber(-0.4, 0)).toBe('0');
    expect(formatNumber(-0, 2)).toBe('0.00');
    expect(formatNumber(-0.06, 1), 'lo que no redondea a cero conserva el signo').toBe('-0.1');
    expect(formatNumber(-12.34, 1)).toBe('-12.3');
    expect(formatNumber(null)).toBe('—');
  });
});
