import { describe, expect, it } from 'vitest';
import type { EngineFrame } from '../../src/engine/simulator';
import { Simulator } from '../../src/engine/simulator';
import { defaultInit, R860_PROFILE } from '../../src/profiles';
import { SCENARIOS } from '../../src/scenarios';
import { niveles, tarjetas } from '../../src/ui/teaching';
import { BENCH_PATIENT, BENCH_SETTINGS, benchSim, runUntilBreath } from '../helpers';

// La pestaña «Resumen» no calcula física: presenta lo que el motor publica. Estas pruebas fijan justo eso —que sus
// números salgan de la misma fuente que el resto del monitor y que sus fórmulas cuadren— y la honestidad de lo que
// dice cuando falta la medición.

function conBloqueo(over: Parameters<typeof benchSim>[0] = {}, durationS = 3): EngineFrame {
  const sim = benchSim({ settings: { ...BENCH_SETTINGS, plimit: 100 }, ...over });
  runUntilBreath(sim, 3);
  sim.command({ type: 'requestHold', kind: 'inspHold', durationS });
  for (let i = 0; i < 60_000 && !sim.frame().procedure.last.inspHold; i++) sim.step();
  return sim.frame();
}
const por = (fr: EngineFrame, id: string) => tarjetas(fr).find((t) => t.id === id)!;

describe('RES · el resumen dice lo mismo que el monitor', () => {
  it('sin bloqueo sólo se lee la Ppico; las otras tres dicen qué falta', () => {
    const sim = benchSim({ settings: { ...BENCH_SETTINGS, plimit: 100 } });
    runUntilBreath(sim, 4);
    const fr = sim.frame();
    const t = tarjetas(fr);
    expect(t.map((x) => x.id)).toEqual(['ppico', 'pplat', 'driving', 'cstat']);

    const ppico = por(fr, 'ppico');
    expect(ppico.valor).toBe(fr.metrics.ppeak?.value); // el mismo número que la columna numérica, no otro
    expect(ppico.sustituida, 'el desglose sí necesita la meseta').toBeNull();

    for (const id of ['pplat', 'driving', 'cstat']) {
      const c = por(fr, id);
      expect(c.valor, id).toBeNull();
      expect(c.estado, id).toBe('sinDato');
      expect(c.faltaPara, id).toMatch(/bloqueo inspiratorio/i);
    }
  });

  it('tras un bloqueo válido las cuatro fórmulas cuadran entre sí', () => {
    const fr = conBloqueo();
    const h = fr.procedure.last.inspHold!;
    expect(h.quality).toBe('valid');
    const peep = fr.metrics.peepe?.value as number;
    const ppico = por(fr, 'ppico').valor as number;
    const pplat = por(fr, 'pplat').valor as number;
    const dp = por(fr, 'driving').valor as number;
    const cstat = por(fr, 'cstat').valor as number;

    // Pplat = PEEP + ΔP, y Ppico = PEEP + resistiva + elástica: la descomposición del esquema tiene que cerrar.
    expect(pplat).toBeCloseTo(peep + dp, 9);
    expect(ppico).toBeGreaterThan(pplat);
    // Cstat = VT / ΔP, con el VT del propio bloqueo y en mL/cmH2O.
    const vtMl = (h.values.vt?.value as number) * 1000;
    expect(cstat).toBeCloseTo(vtMl / dp, 6);

    // Y cada tarjeta enseña esa misma cuenta con sus números, no un texto suelto.
    expect(por(fr, 'pplat').sustituida).toBe(`${pplat.toFixed(1)} = ${peep.toFixed(1)} + ${dp.toFixed(1)}`);
    expect(por(fr, 'driving').sustituida).toBe(`${dp.toFixed(1)} = ${pplat.toFixed(1)} − ${peep.toFixed(1)}`);
    expect(por(fr, 'cstat').sustituida).toBe(`${cstat.toFixed(0)} = ${vtMl.toFixed(0)} / ${dp.toFixed(1)}`);
  });

  it('la Ppico no lleva rango de referencia, porque no tiene uno', () => {
    // Sube con el flujo y con la resistencia sin que el pulmón cambie: inventarle un «normal» enseñaría algo falso.
    const fr = conBloqueo();
    expect(por(fr, 'ppico').referencia).toBeNull();
    expect(por(fr, 'ppico').estado).toBe('sinRango');
    for (const id of ['pplat', 'driving', 'cstat']) expect(por(fr, id).referencia, id).not.toBeNull();
  });

  it('el veredicto se decide sobre el número que se muestra, no sobre el crudo', () => {
    // Con Cstat 49,9 la tarjeta muestra «50» y el rango es 50–100: marcarla fuera sería contradecirse a sí misma.
    const fr = conBloqueo({ patient: { ...BENCH_PATIENT, crs: 0.0499 } });
    const c = por(fr, 'cstat');
    expect(c.valor as number).toBeLessThan(50);
    expect((c.valor as number).toFixed(0)).toBe('50');
    expect(c.estado).toBe('dentro');
  });

  it('una meseta alta se marca fuera de su referencia', () => {
    // Pulmón rígido: la meseta supera los 30 cmH2O y la tarjeta tiene que decirlo.
    const fr = conBloqueo({ patient: { ...BENCH_PATIENT, crs: 0.015 }, settings: { ...BENCH_SETTINGS, plimit: 100, pmax: 90 } });
    const p = por(fr, 'pplat');
    expect(p.valor as number).toBeGreaterThan(30);
    expect(p.estado).toBe('fuera');
    expect(p.referencia?.max).toBe(30);
  });

  it('con la meseta rechazada no se publica ningún número derivado', () => {
    // Dos unidades muy dispares y una oclusión corta: el equipo no da la meseta por asentada, y el resumen tampoco.
    const dos = { ...BENCH_PATIENT, crs: 0.03, rInsp: 5, rExp: 5, second: { crs: 0.03, rInsp: 400, rExp: 400 } };
    const fr = conBloqueo({ patient: dos }, 2);
    expect(fr.procedure.last.inspHold?.quality).toBe('invalid');
    for (const id of ['pplat', 'driving', 'cstat']) {
      expect(por(fr, id).valor, id).toBeNull();
      expect(por(fr, id).sustituida, id).toBeNull();
    }
  });
});

describe('RES · con atrapamiento aéreo la resta es contra la PEEP total', () => {
  /** Un obstructivo con auto-PEEP, con la PEEP total ya medida por un bloqueo espiratorio válido. */
  function conAutoPeep(): EngineFrame {
    const e = SCENARIOS.find((s) => s.id === 'SC-03')!;
    const base = defaultInit({});
    const sim = new Simulator(
      defaultInit({
        patient: { ...e.patient },
        effort: { ...e.effort },
        sensors: { ...e.sensors },
        settings: { ...base.settings, ...(e.settings ?? {}) },
        initialV: 'equilibrium',
      }),
      R860_PROFILE,
    );
    const bloqueo = (kind: 'inspHold' | 'expHold', durationS: number): void => {
      sim.command({ type: 'requestHold', kind, durationS });
      for (let i = 0; i < 80_000 && sim.frame().procedure.current; i++) sim.step();
      for (let i = 0; i < 80_000; i++) {
        sim.step();
        if (sim.frame().procedure.last[kind]) break;
      }
    };
    runUntilBreath(sim, 6);
    bloqueo('expHold', 10);
    runUntilBreath(sim, sim.breaths.length + 3);
    bloqueo('inspHold', 5);
    return sim.frame();
  }

  it('las identidades de la pantalla cuadran, y el esquema no contradice a la tarjeta', () => {
    // El defecto: se restaba siempre la PEEP espiratoria. Con auto-PEEP 8,3 la tarjeta decía «23,4 = 5,0 + 10,0»
    // —que suma 15— y el esquema marcaba una ΔP de 18,4 junto a una tarjeta que decía 10,0. Dos presiones motrices a
    // la vez, en la pantalla que existe para enseñar precisamente eso.
    const fr = conAutoPeep();
    const exp = fr.procedure.last.expHold!;
    expect(exp.quality).toBe('valid');
    const peepTot = exp.values.peepTot?.value as number;
    const peepe = fr.metrics.peepe?.value as number;
    expect(peepTot - peepe, 'el escenario tiene que tener atrapamiento').toBeGreaterThan(3);

    const pplat = por(fr, 'pplat').valor as number;
    const dp = por(fr, 'driving').valor as number;
    // La resta es contra la PEEP total medida, no contra la espiratoria.
    expect(pplat - dp).toBeCloseTo(peepTot, 1);
    // Y las dos sustituciones que se muestran son aritméticamente ciertas.
    expect(por(fr, 'pplat').sustituida).toBe(`${pplat.toFixed(1)} = ${peepTot.toFixed(1)} + ${dp.toFixed(1)}`);
    expect(por(fr, 'driving').sustituida).toBe(`${dp.toFixed(1)} = ${pplat.toFixed(1)} − ${peepTot.toFixed(1)}`);

    // El esquema mide la carga elástica desde la misma PEEP que la tarjeta, y separa la intrínseca.
    const nv = niveles(fr);
    expect(nv.peep).toBeCloseTo(peepTot, 1);
    expect(nv.pplat! - nv.peep).toBeCloseTo(dp, 1);
    expect(nv.peepe as number).toBeCloseTo(peepe, 1);
  });

  it('el motor dice qué PEEP hay en la resta, y lo dice bien', () => {
    // El motivo estaba escrito a mano y decía siempre «PEEPe», aunque el denominador fuera la PEEP total.
    const fr = conAutoPeep();
    expect(fr.procedure.last.inspHold?.values.driving?.reason).toMatch(/PEEPtot/);
  });
});
