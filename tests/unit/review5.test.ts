import { describe, expect, it } from 'vitest';
import { EXP_MAX_FLOW_LPS, plateauQuality, thresholdCrossing } from '../../src/engine/controller';
import { guardFiniteness } from '../../src/engine/metrics';
import { sigmoidPressure, sigmoidVolume } from '../../src/engine/patient';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// Regresiones de la quinta revisión adversarial (07-09-2026): defectos que dos revisores independientes encontraron
// ejecutando el motor, no leyéndolo. Cada prueba fija el número que delataba el defecto.

describe('R5-01 · el criterio de meseta es monótono en la duración de la oclusión', () => {
  /** Muestras de una relajación exponencial, que es la forma que toma la presión tras ocluir. */
  const relajacion = (durS: number, tauS: number, deltaP = 6): { t: number; paw: number }[] => {
    const m: { t: number; paw: number }[] = [];
    for (let t = 0; t <= durS + 1e-9; t += 0.004) m.push({ t, paw: 15 + deltaP * Math.exp(-t / tauS) });
    return m;
  };

  it('esperar más nunca empeora la tasa de deriva medida', () => {
    // El defecto: la ventana de deriva crecía con la oclusión, así que el criterio no era monótono y la medición peor
    // (la más corta) pasaba mientras una mejor se rechazaba. Con una tasa sobre ventana fija esto no puede ocurrir.
    for (const tau of [1.5, 6.1]) {
      const tasas = [2, 3, 5, 10, 15].map((d) => plateauQuality(relajacion(d, tau), d)?.driftRate ?? Number.NaN);
      for (const x of tasas) expect(Number.isFinite(x)).toBe(true);
      for (let i = 1; i < tasas.length; i++) expect(tasas[i]!, `tau=${tau} ${tasas.join(' ')}`).toBeLessThan(tasas[i - 1]!);
    }
  });

  it('con dos unidades muy dispares, el bloqueo corto se rechaza y el largo se acepta', () => {
    // Antes: 2 s salía «válido» con la Cstat un 40 % baja, 5 s se rechazaba y 15 s volvía a valer.
    const dos = { ...BENCH_PATIENT, crs: 0.03, rInsp: 5, rExp: 5, second: { crs: 0.03, rInsp: 400, rExp: 400 } };
    const bloqueo = (durationS: number) => {
      const sim = benchSim({ patient: dos, settings: { ...BENCH_SETTINGS, plimit: 100 } });
      runUntilBreath(sim, 2);
      sim.command({ type: 'requestHold', kind: 'inspHold', durationS });
      for (let i = 0; i < 40000 && !sim.frame().procedure.last.inspHold; i++) sim.step();
      return sim.frame().procedure.last.inspHold!;
    };
    const corto = bloqueo(2);
    expect(corto.quality).toBe('invalid');
    expect(corto.values.pplat?.reason).toBe('mesetaInestable');
    const largo = bloqueo(15);
    expect(largo.quality).toBe('valid');
    // Sigue sesgada respecto de la suma de las dos unidades (60 mL/cmH2O): eso es el sistema, no el filtro (U-49).
    expect((largo.values.cstat?.value as number) * 1000).toBeGreaterThan(45);
  });
});

describe('R5-02 · la métrica no puede contradecir a la curva', () => {
  it('el Ppico publicado aparece en alguna muestra de la pantalla', () => {
    // Con Pmáx 7 y PEEP 5 la inspiración termina en el cruce, a mitad de un paso fijo: el equipo mostraba Ppico 7
    // con la curva plana en 5 porque el anillo sólo guardaba una muestra al final de cada paso.
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, peep: 5, pmax: 7, plimit: 100 } });
    runUntilBreath(sim, 4);
    const f = sim.frame();
    const ppeak = f.metrics.ppeak?.value as number;
    expect(f.metrics.ppeak?.quality).toBe('valid');
    let maxCurva = -Infinity;
    for (let i = 0; i < f.samples.paw.length; i++) maxCurva = Math.max(maxCurva, f.samples.paw[i] as number);
    expect(maxCurva, `Ppico ${ppeak} · máximo de la curva ${maxCurva}`).toBeGreaterThanOrEqual(ppeak - 1e-6);
  });
});

describe('R5-03 · la espiración tiene techo de máquina', () => {
  it('ninguna combinación deja pasar más flujo espiratorio del que abre la válvula', () => {
    // Sin techo el modelo llegaba a −2949 L/min, que ninguna tubuladura deja pasar.
    const sim = benchSim({
      patient: { ...BENCH_PATIENT, crs: 0.05, rInsp: 1, rExp: 1 },
      settings: { ...BENCH_SETTINGS, mode: 'AC_PC', pinsp: 60, peep: 20, pmax: 90, plimit: 100 },
    });
    runUntilBreath(sim, 4);
    const fl = sim.frame().samples.flow;
    let min = Infinity;
    for (let i = 0; i < fl.length; i++) min = Math.min(min, fl[i] as number);
    // La traza se guarda en Float32, así que la tolerancia es la de esa precisión, no la del doble.
    expect(min, `${(min * 60).toFixed(0)} L/min`).toBeGreaterThanOrEqual(EXP_MAX_FLOW_LPS - 1e-6);
    expect(min).toBeLessThan(EXP_MAX_FLOW_LPS + 1e-6); // y el techo se alcanza de verdad en este caso
  });
});

describe('R5-04 · un solo elástico', () => {
  it('el volumen de equilibrio es el inverso exacto de la presión elástica, también fuera del codo', () => {
    for (const S of [
      { b: 1.2, c: 18, d: 5 },
      { b: 0.5, c: 10, d: 2 },
    ]) {
      for (const p of [-5, 0, 5, 15, 25, 35, 50, 70]) {
        expect(sigmoidPressure(S, 0, sigmoidVolume(S, 0, p)), `b=${S.b} p=${p}`).toBeCloseTo(p, 9);
      }
    }
  });

  it('con sigmoide estrecha y PEEP alta el pulmón arranca exactamente en la PEEP', () => {
    // Antes arrancaba en 47,8 con PEEP 50 (y hasta 27 cmH2O de diferencia con sigmoides que el panel admite).
    const sim = benchSim({
      patient: { ...BENCH_PATIENT, sigmoid: { b: 0.5, c: 10, d: 2 } },
      settings: { ...BENCH_SETTINGS, peep: 50, pmax: 90, plimit: 100 },
    });
    expect(sim.frame().truth.pel).toBeCloseTo(50, 6);
  });
});

describe('R5-05 · conmutar la segunda unidad no crea ni destruye gas', () => {
  it('añadirla reparte el gas que hay en vez de inventar el suyo', () => {
    const sim = benchSim();
    runUntilBreath(sim, 3);
    const antes = sim.frame().truth.vAbsL;
    expect(sim.command({ type: 'setPatient', params: { second: { crs: 0.03, rInsp: 8, rExp: 8 } } }).accepted).toBe(true);
    expect(sim.frame().truth.vAbsL, `${((sim.frame().truth.vAbsL - antes) * 1000).toFixed(1)} mL creados`).toBeCloseTo(antes, 9);
  });

  it('quitarla une su gas al que queda', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, second: { crs: 0.03, rInsp: 8, rExp: 8 } } });
    runUntilBreath(sim, 3);
    const antes = sim.frame().truth.vAbsL;
    expect(sim.command({ type: 'setPatient', params: { second: undefined } }).accepted).toBe(true);
    expect(sim.frame().truth.vAbsL).toBeCloseTo(antes, 9);
  });
});

describe('R5-06 · el contrato de calidad también cubre los procedimientos', () => {
  it('la guarda de finitud anula el valor y quita la calidad válida', () => {
    // Vivía sólo en MetricEngine.sample; los procedimientos construían su muestra por otro camino y no la aplicaban.
    expect(guardFiniteness(Number.NaN, 'valid', null)).toEqual({ value: null, quality: 'invalid', reason: 'valorNoFinito' });
    expect(guardFiniteness(Number.POSITIVE_INFINITY, 'valid', 'loQueSea')).toEqual({
      value: null,
      quality: 'invalid',
      reason: 'valorNoFinito',
    });
    // Y no toca lo que ya es correcto, incluido el nulo legítimo: null ≠ 0 ≠ Off.
    expect(guardFiniteness(0, 'valid', null)).toEqual({ value: 0, quality: 'valid', reason: null });
    expect(guardFiniteness(null, 'unavailable', 'sinDato')).toEqual({ value: null, quality: 'unavailable', reason: 'sinDato' });
  });

  it('con el modelo divergido ningún valor del bloqueo sale válido', () => {
    // Hoy la comprobación de perturbación atrapa el NaN antes que la guarda, así que ésta es defensa en profundidad:
    // lo que se fija aquí es el resultado observable, no por qué camino se consigue.
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, plimit: 100 } });
    runUntilBreath(sim, 2);
    sim.command({ type: 'requestHold', kind: 'inspHold', durationS: 3 });
    for (let i = 0; i < 200; i++) sim.step();
    sim.patient.v = Number.NaN; // se fuerza para comprobar la vigilancia, no el modelo
    for (let i = 0; i < 40000 && !sim.frame().procedure.last.inspHold; i++) sim.step();
    const h = sim.frame().procedure.last.inspHold;
    expect(h?.values.pplat, 'el bloqueo tiene que haber terminado y publicado su Pplat').toBeDefined();
    expect(Object.keys(h!.values).length).toBeGreaterThan(0);
    expect(h!.values.pplat!.value).toBeNull();
    expect(h!.values.pplat!.quality).not.toBe('valid');
    for (const m of Object.values(h!.values)) {
      expect(m.quality === 'valid' && !Number.isFinite(m.value as number), `${m.key}=${m.value}`).toBe(false);
    }
  });
});

describe('R5-07 · Plimit protege sin dejar de ventilar', () => {
  it('dentro de un tramo actúa el umbral que se cruza antes, que es el más bajo', () => {
    // Aritmética pura de la jerarquía de seguridad. Sacarla del switch la hace comprobable sin arrancar un simulador,
    // que es lo que este defecto pedía: aquí estuvo el peor fallo que ha tenido el proyecto.
    const P = { plimit: 30, pmax: 40 };
    // Ninguno se alcanza: el tramo se integra entero.
    expect(thresholdCrossing(20, 25, P.plimit, P.pmax)).toEqual({ frac: 1, hit: null });
    // Sólo Plimit, a dos tercios del tramo.
    const soloPlimit = thresholdCrossing(20, 35, P.plimit, P.pmax);
    expect(soloPlimit.hit).toBe('plimit');
    expect(soloPlimit.frac).toBeCloseTo(10 / 15, 12);
    // Los dos dentro del tramo: gana el más bajo, y con la fracción del más bajo.
    const ambos = thresholdCrossing(20, 50, P.plimit, P.pmax);
    expect(ambos.hit).toBe('plimit');
    expect(ambos.frac).toBeCloseTo(10 / 30, 12);
    // Ya superados al empezar: no se integra nada y actúa el más bajo, no el que se mirara primero.
    expect(thresholdCrossing(35, 40, P.plimit, P.pmax)).toEqual({ frac: 0, hit: 'plimit' });
    expect(thresholdCrossing(45, 60, P.plimit, P.pmax)).toEqual({ frac: 0, hit: 'plimit' });
  });

  it('con Pmáx por debajo de Plimit, o iguales, manda Pmáx', () => {
    // Pmáx termina la inspiración: es la acción de seguridad y por eso gana el empate.
    expect(thresholdCrossing(25, 30, 40, 20)).toEqual({ frac: 0, hit: 'pmax' });
    expect(thresholdCrossing(35, 40, 30, 30)).toEqual({ frac: 0, hit: 'pmax' });
    const dentro = thresholdCrossing(10, 30, 40, 20);
    expect(dentro.hit).toBe('pmax');
    expect(dentro.frac).toBeCloseTo(10 / 20, 12);
  });

  it('el volumen entregado decrece de forma continua al subir la resistencia', () => {
    // El defecto: Pmáx se evaluaba antes que Plimit y contra la presión del flujo ORDENADO, no contra la que la máquina
    // dejaría alcanzar. Con Plimit 30 y Pmáx 40, pasar de Rinsp 69 a 70 llevaba el volumen de 314 mL a CERO, con la
    // Ppico publicada en 40 y la curva plana: Plimit habría recortado la presión a 30 y Pmáx nunca se alcanza.
    const entregado = (rInsp: number): { vte: number; ppeak: number; causa: string } => {
      const sim = benchSim({
        patient: { ...BENCH_PATIENT, rInsp, rExp: 10 },
        settings: { ...BENCH_SETTINGS, plimit: 30, pmax: 40 },
      });
      runUntilBreath(sim, 6);
      const f = sim.frame();
      return {
        vte: (f.metrics.vte?.value as number) * 1000,
        ppeak: f.metrics.ppeak?.value as number,
        causa: sim.breaths.at(-1)!.cyclingCause,
      };
    };
    let previo = Infinity;
    for (const r of [40, 60, 69, 70, 71, 80, 120, 200, 400]) {
      const e = entregado(r);
      expect(e.ppeak, `R=${r}`).toBeCloseTo(30, 1); // Plimit sostiene el techo; Pmáx no se dispara nunca
      expect(e.causa, `R=${r}`).toBe('time'); // la inspiración dura lo programado, no la termina Pmáx
      expect(e.vte, `R=${r} entregó ${e.vte} mL tras ${previo}`).toBeGreaterThan(50);
      expect(e.vte, `R=${r} rompe la monotonía`).toBeLessThan(previo);
      previo = e.vte;
    }
  });

  it('con Pmáx por debajo de Plimit manda Pmáx, que es la acción de seguridad', () => {
    const sim = benchSim({ patient: { ...BENCH_PATIENT, rInsp: 40 }, settings: { ...BENCH_SETTINGS, plimit: 40, pmax: 20 } });
    runUntilBreath(sim, 6);
    expect(sim.frame().metrics.ppeak?.value).toBeCloseTo(20, 1);
    expect(sim.breaths.at(-1)!.cyclingCause).toBe('pmax');
  });
});
