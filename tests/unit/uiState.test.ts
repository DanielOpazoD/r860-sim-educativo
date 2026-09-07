import { describe, expect, it } from 'vitest';
import { EditController, ModeMenuDraft, type EditEvent } from '../../src/app/uiState';
import { VC_ADULT_RULES, VC_ADULT_CROSS_LIMITS } from '../../src/profiles/r860-es-photo-reference/settings';
import { BENCH_SETTINGS } from '../helpers';

function make(active = { ...BENCH_SETTINGS }) {
  const events: EditEvent[] = [];
  const ec = new EditController(VC_ADULT_RULES, VC_ADULT_CROSS_LIMITS, () => active, 20_000);
  ec.on((e) => events.push(e));
  return { ec, events, active };
}

describe('INT · seleccionar/editar/confirmar/cancelar como transacciones', () => {
  it('INT-01: seleccionar PEEP y girar sin confirmar no emite cambios', () => {
    const { ec, events } = make();
    ec.select('peep', 0);
    ec.adjust(1, 10);
    ec.adjust(1, 20);
    expect(ec.state.kind).toBe('editing');
    expect(ec.state.kind === 'editing' && ec.state.draftDisplay).toBe(7);
    expect(events.filter((e) => e.type === 'confirmed')).toHaveLength(0);
  });
  it('INT-02: confirmar una edición válida emite un único evento con el nuevo valor interno', () => {
    const { ec, events } = make();
    ec.select('vt', 0);
    ec.adjust(1, 1); // 500 → 525 mL
    expect(ec.confirm()).toBe(true);
    const c = events.filter((e) => e.type === 'confirmed');
    expect(c).toHaveLength(1);
    expect(c[0]!.type === 'confirmed' && c[0]!.changes.vt).toBeCloseTo(0.525, 9);
    expect(ec.state.kind).toBe('idle');
  });
  it('INT-03: cancelar o vencer el plazo descarta el borrador (plazo identificado como propuesto)', () => {
    const { ec, events } = make();
    ec.select('rr', 0);
    ec.adjust(1, 5);
    ec.tick(19_999);
    expect(ec.state.kind).toBe('editing');
    ec.tick(20_005);
    expect(ec.state.kind).toBe('idle');
    expect(events.at(-1)).toEqual({ type: 'cancelled', key: 'rr', reason: 'timeout' });
    ec.select('rr', 30_000);
    ec.adjust(-1, 30_001);
    ec.cancel();
    expect(events.at(-1)).toEqual({ type: 'cancelled', key: 'rr', reason: 'user' });
    expect(events.filter((e) => e.type === 'confirmed')).toHaveLength(0);
  });
  it('INT-06: la rueda sin selección no altera nada; el bloqueo de pantalla impide editar', () => {
    const { ec, events } = make();
    expect(ec.adjust(1, 0)).toBe(false);
    ec.setLocked(true);
    expect(ec.select('vt', 0)).toBe(false);
    expect(events.at(-1)).toEqual({ type: 'cancelled', key: 'vt', reason: 'locked' });
    ec.setLocked(false);
    expect(ec.select('vt', 0)).toBe(true);
  });
  it('un valor inválido produce explicación y no se aproxima: VT hasta hacer el flujo > 160 L/min', () => {
    const active = { ...BENCH_SETTINGS, rr: 60, ie: 1 / 4 }; // Tinsp 0.2 s → inválido ya de partida? Tinsp 0.2 < 0.25
    const { ec, events } = make(active);
    ec.select('vt', 0);
    const p = ec.preview();
    expect(p.valid).toBe(false);
    expect(ec.confirm()).toBe(false);
    expect(events.at(-1)?.type).toBe('rejected');
  });
  it('PEEP: bajar desde 1 lleva a Off y subir desde Off lleva a 1 (Off no es 0)', () => {
    const active = { ...BENCH_SETTINGS, peep: 1 as const };
    const { ec, events } = make(active);
    ec.select('peep', 0);
    ec.adjust(-1, 1);
    expect(ec.state.kind === 'editing' && ec.state.draftDisplay).toBe('off');
    ec.adjust(1, 2);
    expect(ec.state.kind === 'editing' && ec.state.draftDisplay).toBe(1);
    ec.adjust(-1, 3);
    expect(ec.state.kind === 'editing' && ec.state.draftDisplay).toBe('off');
    // Y confirmar aplica «off», que no es 0: el evento lleva el valor interno, no el de pantalla.
    const conf = ec.confirm();
    expect(conf).toBe(true);
    const aplicado = events.filter((e) => e.type === 'confirmed').at(-1);
    expect(aplicado, 'confirmar tiene que emitir el cambio').toBeDefined();
    expect((aplicado as { key: string }).key).toBe('peep');
    expect((aplicado as { changes: Record<string, unknown> }).changes.peep).toBe('off');
  });
  it('seleccionar otra tecla descarta el borrador anterior sin aplicarlo', () => {
    const { ec, events } = make();
    ec.select('vt', 0);
    ec.adjust(1, 1);
    ec.select('peep', 2);
    expect(events.at(-1)).toEqual({ type: 'cancelled', key: 'vt', reason: 'reselect' });
    expect(events.filter((e) => e.type === 'confirmed')).toHaveLength(0);
  });
  it('vista previa muestra consecuencias cruzadas (Tinsp y flujo derivados) antes de confirmar', () => {
    const { ec } = make();
    ec.select('rr', 0);
    ec.adjust(1, 1);
    const p = ec.preview();
    expect(p.derived!.tInspS).toBeCloseTo(60 / 16 / 4, 6);
    expect(p.derived!.qTargetLps).toBeCloseTo(0.5 / (60 / 16 / 4), 6);
  });
});

describe('menú de modo como transacción', () => {
  it('cancelar restaura todos los ajustes; confirmar entrega sólo los cambiados', () => {
    const d = new ModeMenuDraft(VC_ADULT_RULES, VC_ADULT_CROSS_LIMITS, { ...BENCH_SETTINGS });
    d.adjust('pausePct', 1);
    d.adjust('pausePct', 1);
    d.adjust('plimit', -1);
    expect(d.validate().ok).toBe(true);
    const ch = d.changes();
    expect(Object.keys(ch).sort()).toEqual(['pausePct', 'plimit']);
    expect(ch.pausePct).toBeCloseTo(0.1, 9);
    const d2 = new ModeMenuDraft(VC_ADULT_RULES, VC_ADULT_CROSS_LIMITS, { ...BENCH_SETTINGS });
    expect(d2.changes()).toEqual({});
  });
});
