import { describe, expect, it } from 'vitest';
import { planSteps } from '../../src/engine/clock';
import { cstatFromSamples } from '../../src/domain/consistency';
import type { MetricSample } from '../../src/domain/types';
import { EditController } from '../../src/app/uiState';
import { VC_ADULT_CROSS_LIMITS, VC_ADULT_RULES } from '../../src/profiles/r860-es-photo-reference/settings';
import { exportSession } from '../../src/history/session';
import { getBounds } from '../../src/render/plots';
import { clock, ieText, unitText } from '../../src/ui/format';
import { humanReason } from '../../src/ui/humanize';
import { BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// Un estudio de mutación introdujo catorce defectos deliberados en el motor y la suite completa —unitaria, banco y
// Playwright— sólo detectó seis. Este archivo cubre los que sobrevivían: mecanismos documentados sin ninguna prueba,
// valores que sólo se comparaban consigo mismos, y funciones puras de interfaz que nadie ejecutaba.

describe('TIM-04 · presupuesto de pasos del reloj', () => {
  it('reparte el tiempo acumulado en pasos enteros y guarda el resto', () => {
    expect(planSteps(10, 4, 1000)).toEqual({ steps: 2, remainderMs: 2, droppedMs: 0 });
    expect(planSteps(4, 4, 1000)).toEqual({ steps: 1, remainderMs: 0, droppedMs: 0 });
    expect(planSteps(3.9, 4, 1000)).toEqual({ steps: 0, remainderMs: 3.9, droppedMs: 0 });
  });

  it('al superar el presupuesto descarta el exceso en vez de dar un salto gigante', () => {
    // El mutante que multiplicaba maxSteps por mil sobrevivía a toda la suite: este mecanismo no tenía ninguna prueba.
    const p = planSteps(10_000, 4, 250);
    expect(p.steps).toBe(250);
    expect(p.droppedMs).toBe(10_000 - 250 * 4);
    expect(p.remainderMs).toBe(0);
    // Y nada se pierde por partida doble: pasos + descartado + resto es exactamente lo acumulado.
    expect(p.steps * 4 + p.droppedMs + p.remainderMs).toBe(10_000);
  });

  it('un acumulado imposible no produce pasos', () => {
    for (const malo of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(planSteps(malo, 4, 250)).toEqual({ steps: 0, remainderMs: 0, droppedMs: 0 });
    }
  });
});

describe('DAT-04 · la guarda del denominador de la Cstat', () => {
  const m = (key: string, value: number, unit: string): MetricSample => ({
    key,
    value,
    unit,
    source: 'ventilator',
    simTimeMs: 0,
    breathId: 'b1',
    procedureId: null,
    quality: 'valid',
    reason: null,
    windowMs: null,
  });

  it('con menos de 1 cmH2O de presión motriz no se publica una compliance inventada', () => {
    // Sin esta prueba, cambiar el umbral a 0,0001 pasaba desapercibido: dividir por 0,3 cmH2O da una Cstat absurda.
    const r = cstatFromSamples(m('vte', 0.5, 'L'), m('pplat', 15.3, 'cmH2O'), m('peepe', 15, 'cmH2O'));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/denominador/);
  });

  it('con presión motriz suficiente devuelve VT dividido por ella, sin redondear', () => {
    const r = cstatFromSamples(m('vte', 0.5, 'L'), m('pplat', 25, 'cmH2O'), m('peepe', 15, 'cmH2O'));
    expect(r.ok).toBe(true);
    expect(r.ok === true && r.value).toBeCloseTo(0.05, 12);
  });
});

describe('Pmedia y fuga con referencia independiente, no consigo mismas', () => {
  it('la presión media publicada es la integral de la curva dibujada, calculada aparte', () => {
    // Multiplicar Pmean por 1,1 sobrevivía a toda la suite porque sólo se comparaba entre dos simuladores iguales.
    // Aquí la referencia se calcula por trapecios sobre las muestras de la traza, que es otro camino distinto.
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, plimit: 100 } });
    runUntilBreath(sim, 6);
    const b = sim.breaths.at(-1)!;
    const { t, paw } = sim.frame().samples;
    let integral = 0;
    let dentro = 0;
    for (let i = 1; i < t.length; i++) {
      const t0 = t[i - 1] as number;
      const t1 = t[i] as number;
      if (t0 < b.startSimTimeMs || t1 > b.endSimTimeMs) continue;
      integral += (((paw[i - 1] as number) + (paw[i] as number)) / 2) * (t1 - t0);
      dentro++;
    }
    expect(dentro, 'la traza tiene que cubrir la respiración medida').toBeGreaterThan(100);
    const esperada = integral / (b.endSimTimeMs - b.startSimTimeMs);
    expect(esperada).toBeGreaterThan(0);
    // 1 % de margen: la traza va en Float32 y el motor integra por rectángulos a nivel de sub-paso.
    expect(sim.frame().metrics.pmean?.value as number, `publicada ${b.pmean} · trapecios ${esperada}`).toBeCloseTo(esperada, 1);
    expect(Math.abs((b.pmean - esperada) / esperada)).toBeLessThan(0.01);
  });

  it('la fuga publicada nunca es negativa, ni cuando el pulmón exhala más de lo que recibió', () => {
    // La dispersión del sensor no sirve para esto: la misma ganancia se aplica a VTinsp y a VTesp, así que se cancela
    // en el cociente. Lo que sí produce VTesp > VTinsp es bajar la PEEP: el pulmón devuelve además el gas que tenía
    // retenido. Sin el Math.max(0, ...) la pantalla mostraría una «fuga» negativa, que no existe.
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, peep: 12 } });
    runUntilBreath(sim, 6);
    expect(sim.command({ type: 'confirmSettings', changes: { peep: 4 } }).accepted).toBe(true);
    let exhaloDeMas = false;
    let vistas = 0;
    for (let n = 7; n <= 14; n++) {
      runUntilBreath(sim, n);
      const b = sim.breaths.at(-1)!;
      if (b.vtExp > b.vtInsp + 1e-9) exhaloDeMas = true;
      const f = sim.frame().metrics.leakPct;
      if (f?.value === null || f?.value === undefined) continue;
      vistas++;
      expect(f.value, `respiración ${n} · VTi ${b.vtInsp} VTe ${b.vtExp}`).toBeGreaterThanOrEqual(0);
    }
    expect(vistas).toBeGreaterThan(5);
    expect(exhaloDeMas, 'bajar la PEEP tiene que producir al menos una respiración con VTesp mayor que VTinsp').toBe(true);
  });
});

describe('La sesión exportada sólo contiene lo que el motor aceptó', () => {
  it('un comando rechazado no entra en el registro exportable', () => {
    const sim = benchSim();
    runUntilBreath(sim, 2);
    const bueno = sim.command({ type: 'setAlarmLimits', changes: { rrHigh: 40 } });
    const malo = sim.command({ type: 'setAlarmLimits', changes: { rrHigh: 9999 } });
    expect(bueno.accepted).toBe(true);
    expect(malo.accepted).toBe(false);
    const f = exportSession(sim);
    const limites = f.commands.filter((c) => c.command.type === 'setAlarmLimits');
    expect(limites).toHaveLength(1);
    expect(JSON.stringify(f.commands)).not.toContain('9999');
  });
});

describe('Las teclas booleanas se pueden editar por el mismo camino que las numéricas', () => {
  it('seleccionar, girar y confirmar una tecla booleana da el valor interno booleano', () => {
    // Las dos ramas booleanas de EditController se daban por inalcanzables porque las teclas rápidas son numéricas.
    // Son alcanzables: el controlador acepta cualquier SettingsKey, y aquí queda fijado su comportamiento.
    const eventos: { type: string; changes?: Record<string, unknown> }[] = [];
    const activo = { ...BENCH_SETTINGS, assistControl: true };
    const ec = new EditController(VC_ADULT_RULES, VC_ADULT_CROSS_LIMITS, () => activo, 20_000);
    ec.on((e) => eventos.push(e));
    expect(ec.select('assistControl', 0)).toBe(true);
    expect(ec.state.kind === 'selected' && ec.state.draftDisplay).toBe(1); // true se muestra como 1
    ec.adjust(-1, 1);
    expect(ec.state.kind === 'editing' && ec.state.draftDisplay).toBe(0);
    ec.confirm();
    expect(eventos.at(-1)?.changes?.assistControl).toBe(false); // y vuelve a booleano, no a 0
  });
});

describe('Formatos de pantalla y lenguaje del alumno', () => {
  it('las unidades se escriben como en el equipo', () => {
    // Quitar el subíndice de cmH₂O sobrevivía incluso a Playwright.
    expect(unitText('cmH2O')).toBe('cmH₂O');
    expect(unitText('ml')).toBe('mL');
    expect(unitText('l/min')).toBe('L/min');
    expect(unitText('L')).toBe('L'); // no toca lo que ya está bien
  });

  it('el reloj de sesión no retrocede ni con entradas absurdas', () => {
    expect(clock(0)).toBe('00:00');
    expect(clock(65)).toBe('01:05');
    expect(clock(3599)).toBe('59:59');
    expect(clock(-5)).toBe('00:00');
    expect(clock(Number.NaN)).toBe('00:00');
  });

  it('la relación I:E se escribe como la lee un clínico', () => {
    expect(ieText(1 / 2)).toBe('1:2');
    expect(ieText(1 / 3)).toBe('1:3');
    expect(ieText(1)).toBe('1:1');
    expect(ieText(2)).toBe('2:1'); // invertida
  });

  it('los códigos internos se traducen a lenguaje clínico, y lo desconocido no se inventa', () => {
    // Desactivar el diccionario entero no lo detectaba nadie: 0 % de cobertura y ninguna e2e lo miraba.
    expect(humanReason('mesetaInestable')).not.toBe('mesetaInestable');
    expect(humanReason('mesetaInestable').length).toBeGreaterThan('mesetaInestable'.length / 2);
    expect(humanReason('pmaxDuranteBloqueo')).not.toBe('pmaxDuranteBloqueo');
    expect(humanReason('fin:timer')).toBe('terminó por tiempo');
    expect(humanReason(null)).toBe('');
    expect(humanReason('')).toBe('');
  });
});

describe('Los ejes de las curvas tienen que caber los datos', () => {
  const traza = (vols: number[]): [number, number, number, number, number, number][] => vols.map((v, i) => [i * 0.02, 10, 30, v, 0, 0]);

  it('el suelo del eje de volumen baja hasta el mínimo real', () => {
    // La traza es el volumen desde el inicio de la respiración, así que baja de cero cuando el pulmón devuelve gas
    // que no recibió en ese ciclo (apilamiento, espiración activa). El suelo era un 10 % fijo de la escala superior,
    // de modo que en el escenario de doble disparo la curva llegaba a −516 mL contra un suelo de −60 y se recortaba.
    const b = getBounds(traza([0, 500, 250, -516, -300, 0]), 5, 500);
    expect(b.volume).toBeGreaterThanOrEqual(500);
    expect(b.minVolume).toBeLessThanOrEqual(-516);
  });

  it('sin excursión negativa el suelo se queda en la holgura del 5 %', () => {
    const b = getBounds(traza([0, 250, 500, 250, 0]), 5, 500);
    expect(b.minVolume).toBeCloseTo(-b.volume * 0.05, 9);
  });

  it('usa escalones legibles sin reservar presión y flujo innecesarios', () => {
    const puntos: [number, number, number, number, number, number][] = [
      [0, 5, 0, 0, 0, 0],
      [0.02, 15, -149, 430, 0, 0],
    ];
    const b = getBounds(puntos, 5, 500);
    expect(b.pressure).toBe(20);
    expect(b.flow).toBe(180);
    expect(b.minPressure).toBeLessThan(0);
  });

  it('los demás ejes siguen cabiendo sus extremos', () => {
    const pts: [number, number, number, number, number, number][] = [
      [0, 45, 150, 100, 0, 0],
      [0.02, -8, -190, 0, 0, 0],
    ];
    const b = getBounds(pts, 5, 500);
    expect(b.pressure).toBeGreaterThanOrEqual(45);
    expect(b.minPressure).toBeLessThanOrEqual(-8);
    expect(b.flow).toBeGreaterThanOrEqual(190);
  });
});
