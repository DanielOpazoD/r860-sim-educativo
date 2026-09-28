/** Panel de bloqueos (inspiratorio / espiratorio): solicitud idempotente, resultado y avisos de medición. */
import type { SettingRule } from '../domain/settingRules';
import { gridValues } from '../domain/validation';
import { formatNumber as f } from '../domain/units';
import type { AppContext } from './context';
import { $, put } from './dom';
import { wallDate } from './format';
import { collapseHelp, helpContent } from './helpPanels';
import { humanReason, learnerText } from './humanize';
import { isMobile } from './labels';
import type { PuntoTitulacion } from './teaching';
import type { QuickEditor } from './quickEditor';

export type HoldKind = 'inspHold' | 'expHold';

export interface HoldPanel {
  readonly isOpen: boolean;
  openHold(kind: HoldKind): void;
  closeHoldPanel(): void;
  updateHold(): void;
  runHold(): Promise<void>;
  cancelHold(): Promise<void>;
  placeHoldPanel(): void;
}

export function createHoldPanel(ctx: AppContext, deps: { quick: QuickEditor }): HoldPanel {
  const holdRule = (kind: HoldKind): SettingRule => ctx.profile.holdRules[kind];
  let holdType: HoldKind = 'inspHold';
  let lastHoldToastId: string | null = null;
  let holdOpenedAtMs = 0;
  /** Solicitud en vuelo: ▶ es idempotente mientras se espera la respuesta del motor. */
  let holdRequestInFlight = false;

  function placeHoldPanel(): void {
    const panel = $('#hold-panel'),
      mobile = isMobile();
    const parent = mobile ? document.body : $('.monitor-body');
    if (panel.parentElement !== parent) parent.append(panel);
    panel.classList.toggle('mobile-hold', mobile);
    document.body.classList.toggle('hold-open', !panel.hidden && mobile);
  }
  function openHold(kind: HoldKind): void {
    const fr = ctx.frame;
    const active = fr?.procedure.hold;
    holdType = active ? active.kind : kind;
    if (deps.quick.edit.state.kind !== 'idle') {
      deps.quick.cancelQuick();
      ctx.toast('Ajuste cancelado al abrir el bloqueo. El valor anterior se mantiene.', true);
    }
    holdOpenedAtMs = fr?.simTimeMs ?? 0;
    lastHoldToastId = fr?.procedure.last[holdType]?.procedureId ?? null;
    const sel = $<HTMLSelectElement>('#hold-duration');
    const cur = sel.value;
    sel.innerHTML = gridValues(holdRule(holdType))
      .map((v) => `<option value="${v}" ${v === (Number(cur) || 3) ? 'selected' : ''}>${v} s</option>`)
      .join('');
    $('#hold-panel').hidden = false;
    placeHoldPanel();
    updateHold();
    ctx.dialog.close();
  }
  function closeHoldPanel(): void {
    $('#hold-panel').hidden = true;
    document.body.classList.remove('hold-open');
  }
  function updateHold(): void {
    const fr = ctx.frame;
    if ($('#hold-panel').hidden || !fr) return;
    const running = ctx.running;
    const active = fr.procedure.hold;
    if (active) holdType = active.kind;
    const insp = holdType === 'inspHold',
      key = insp ? 'procedure.inspiratory' : 'procedure.expiratory';
    put('#hold-title', `Bloqueo ${insp ? 'inspiratorio' : 'espiratorio'}`);
    put('#hold-value-label', insp ? 'Pplat' : 'PEEP total');
    put('#hold-second-label', insp ? 'Cstat' : 'PEEPi');
    put('#hold-second-unit', insp ? 'mL/cmH₂O' : 'cmH₂O');
    const helpBtn = $('#hold-help-button');
    if (helpBtn.dataset.helpKey !== key) {
      helpBtn.dataset.helpKey = key;
      $('#hold-help').innerHTML = helpContent(key);
      $('#hold-help').hidden = true;
      helpBtn.setAttribute('aria-expanded', 'false');
    }
    const h = !active ? fr.procedure.last[holdType] : null;
    const v1 = insp ? h?.values.pplat : h?.values.peepTot,
      v2 = insp ? h?.values.cstat : h?.values.peepi;
    // En examen el resultado es justo lo que se pide estimar: el panel lo tapa como las casillas numéricas.
    const tapar = ctx.examMode;
    put(
      '#hold-value',
      tapar && h?.quality === 'valid'
        ? '?'
        : h?.quality === 'valid' && v1?.value !== null && v1?.value !== undefined
          ? f(v1.value, 0)
          : '—',
    );
    put(
      '#hold-second',
      tapar && h?.quality === 'valid'
        ? '?'
        : h?.quality === 'valid' && v2?.value !== null && v2?.value !== undefined
          ? f(insp ? v2.value * 1000 : v2.value, insp ? 0 : 1)
          : '—',
    );
    // ▶ sólo inicia; mientras hay una solicitud en cola o en curso queda deshabilitado y aparece «Cancelar».
    const run = $<HTMLButtonElement>('#hold-run');
    const busy = !!active || holdRequestInFlight;
    const lbl = active
      ? active.phase === 'queued'
        ? 'Solicitud en cola'
        : 'Bloqueo en curso'
      : !running
        ? 'Reanudar e iniciar bloqueo'
        : 'Iniciar bloqueo';
    run.setAttribute('aria-label', lbl);
    run.title = lbl;
    run.disabled = busy;
    run.setAttribute('aria-disabled', String(busy));
    const cancel = $<HTMLButtonElement>('#hold-cancel');
    cancel.hidden = !active;
    put(cancel.querySelector('span'), active?.phase === 'queued' ? 'Cancelar solicitud' : 'Cancelar bloqueo');
    ($('#hold-duration') as HTMLSelectElement).disabled = !!active;
    let text = !running ? 'Pulsa iniciar para reanudar y medir.' : 'Selecciona tiempo y pulsa iniciar.';
    if (active?.phase === 'running')
      text = `${!running ? 'Pausado · ' : 'Oclusión · '}${f(active.durationS - active.elapsedS, 1)} s restantes`;
    else if (active?.phase === 'queued')
      text = `Esperando fin de ${insp ? 'inspiración' : 'espiración'}${!running ? ' · simulación pausada' : ''}`;
    else if (h)
      text =
        h.quality === 'valid'
          ? `Medido · ${wallDate(h.wallTimeMs ?? 0)}`
          : `No válida: ${humanReason(h.reason)} · ${wallDate(h.wallTimeMs ?? 0)}`;
    if (h && h.procedureId !== lastHoldToastId && (h.completedAtMs ?? 0) > holdOpenedAtMs) {
      lastHoldToastId = h.procedureId;
      if (h.kind === 'inspHold' && h.quality === 'valid' && h.values.pplat?.value !== null && h.values.pplat?.value !== undefined) {
        const previos = (ctx.lesson.flags.inspHolds as { d: number; p: number }[] | undefined) ?? [];
        ctx.lesson.flags.inspHolds = [...previos, { d: h.requestedDurationS ?? 0, p: h.values.pplat.value }];
        // Cada medición válida es un punto de la curva de titulación que el alumno construye por su cuenta: la PEEP a
        // la que midió y la distensibilidad que le salió. No se inventa ninguno; sólo se guardan los que él tomó.
        const cstat = h.values.cstat?.value;
        const peep = ctx.frame?.settings.peep;
        if (typeof cstat === 'number' && typeof peep === 'number') {
          // Historial cronológico: cada medición se conserva (la curva deduplica por PEEP quedándose la última;
          // las pruebas como la decremental necesitan el orden, no un solo punto por consigna — auditoría SC-25).
          const puntos = (ctx.lesson.flags.titulacion as PuntoTitulacion[] | undefined) ?? [];
          ctx.lesson.flags.titulacion = [...puntos, { peep, cstat: cstat * 1000, t: h.completedAtMs ?? ctx.frame?.simTimeMs }];
        }
      }
      ctx.toast(
        h.quality === 'valid'
          ? ctx.examMode
            ? `Bloqueo medido · estima ${insp ? 'Pplat y Cstat' : 'PEEP total y PEEPi'} en su casilla`
            : `Bloqueo medido: ${insp ? 'Pplat' : 'PEEP total'} ${f(v1?.value ?? null, 0)} cmH₂O`
          : `Bloqueo no válido: ${humanReason(h.reason)}`,
        h.quality !== 'valid',
      );
    }
    put('#hold-status', learnerText(text));
    $('#hold-status').classList.toggle('invalid', !!h && h.quality !== 'valid');
    $('#hold-panel').classList.toggle('is-occluding', active?.phase === 'running');
    $('#hold-panel').dataset.phase = active?.phase === 'running' ? 'occluding' : active ? 'waiting' : h ? 'measured' : 'ready';
  }
  async function runHold(): Promise<void> {
    // Idempotente: repeticiones mientras hay solicitud en vuelo, en cola o en curso se ignoran (no cancelan).
    if (holdRequestInFlight || ctx.frame?.procedure.hold) return;
    holdRequestInFlight = true;
    updateHold();
    try {
      const r = await ctx.send({
        type: 'requestHold',
        kind: holdType,
        durationS: Number(($('#hold-duration') as HTMLSelectElement).value),
      });
      if (r.accepted) {
        if (ctx.frozen) ctx.toggleFreeze();
        if (!['waves', 'basic'].includes(ctx.view)) ctx.switchView('waves');
        if (!ctx.running) ctx.client.resume();
        collapseHelp();
      }
    } finally {
      holdRequestInFlight = false;
      updateHold();
    }
  }
  async function cancelHold(): Promise<void> {
    const active = ctx.frame?.procedure.hold;
    if (!active) return;
    const r = await ctx.send({ type: 'cancelProcedure' });
    if (r.accepted) ctx.toast(active.phase === 'queued' ? 'Solicitud de bloqueo cancelada.' : 'Bloqueo cancelado.');
  }
  return {
    get isOpen() {
      return !$('#hold-panel').hidden;
    },
    openHold,
    closeHoldPanel,
    updateHold,
    runHold,
    cancelHold,
    placeHoldPanel,
  };
}
