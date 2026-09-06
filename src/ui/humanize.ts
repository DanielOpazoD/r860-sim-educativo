/** Diccionario de textos para el alumno: la procedencia técnica (códigos, canales, motivos internos) vive en evidence.json y en el registro exportado. */
import type { MetricSample, SessionEvent } from '../domain/types';

const REASONS: Record<string, string> = {
  noPause: 'sin pausa inspiratoria programada: requiere bloqueo',
  pauseTooShort: 'pausa demasiado corta para medir',
  insufficientSamples: 'muestras insuficientes',
  unstable: 'meseta inestable',
  mesetaInestable: 'meseta inestable (esfuerzo o fuga)',
  noOcclusion: 'en presión control no hay oclusión: requiere bloqueo',
  plimitReached: 'Plimit alcanzada: la pausa no fue una oclusión',
  endedByPmax: 'inspiración terminada por Pmáx',
  canceladoPorUsuario: 'cancelado por el usuario',
  canceladoEnCola: 'cancelado antes de iniciar',
  pmaxDuranteBloqueo: 'Pmáx alcanzada durante el bloqueo',
  duracionInsuficiente: 'duración insuficiente',
  denominadorInsuficiente: 'Pplat − PEEP demasiado pequeña para estimar',
  sinRespiracionCompleta: 'esperando el primer ciclo completo',
  ventanaInsuficiente: 'esperando dos ciclos completos',
  sinRespiracionReciente: 'sin ciclos recientes: valor antiguo',
  sinRespiracionesEspontaneas: 'sin respiraciones espontáneas',
  standby: 'en espera',
  enCola: 'en cola',
  enCurso: 'en curso',
  fixture: 'transcripción de fotografía',
};
export function humanReason(reason: string | null | undefined): string {
  if (!reason) return '';
  if (REASONS[reason]) return REASONS[reason] as string;
  if (reason.startsWith('denominador=')) return 'Cstat = VT / (Pplat − PEEP) sin PEEP total medida';
  if (reason.startsWith('Pplat − PEEPe')) return 'Pplat − PEEP de esa respiración';
  if (reason.startsWith('Inspiración terminada por Pmáx')) return 'no elegible: la inspiración terminó por Pmáx';
  if (reason.startsWith('fin:'))
    return reason
      .replace('fin:timer', 'terminó por tiempo')
      .replace('fin:user', 'detenido por el usuario')
      .replace('fin:standby', 'detenido al pasar a espera')
      .replace(';FiO2EditadaPorUsuario:noRestaurada', ' · se respetó la FiO₂ editada')
      .replace(';restaurada', ' · FiO₂ restaurada');
  return reason;
}
export const QUALITY: Record<MetricSample['quality'], string> = {
  valid: 'válido',
  stale: 'antiguo',
  unavailable: 'no disponible',
  invalid: 'no válido',
  inProgress: 'en curso',
};
export const SOURCE: Record<MetricSample['source'], string> = {
  ventilator: 'sensor del ventilador',
  airwayModule: 'módulo de vía aérea',
  procedure: 'maniobra',
  derivedModel: 'calculado',
  fixture: 'transcripción',
};
export const CHANNEL: Record<string, string> = {
  'ventilator.paw': 'presión de vía aérea',
  'ventilator.flow': 'flujo espirado',
  'ventilator.o2': 'sensor de O₂',
};
export const PRIORITY: Record<string, string> = { high: 'alta', medium: 'media', informational: 'informativa' };
const MODE: Record<string, string> = { AC_VC: 'A/C VC', AC_PC: 'A/C PC' };
const SETTING: Record<string, string> = {
  fio2: 'FiO₂',
  vt: 'VT',
  rr: 'Frecuencia',
  ie: 'I:E',
  peep: 'PEEP',
  pmax: 'Pmáx',
  plimit: 'Plimit',
  pausePct: 'Pausa insp',
  assistControl: 'Disparo asistido',
  flowTrigger: 'Trigger',
  pinsp: 'Pinsp',
  riseMs: 'Rampa',
  mode: 'Modo',
};
const ieText = (r: number): string => (r <= 1 + 1e-9 ? `1:${Math.round((1 / r) * 100) / 100}` : `${Math.round(r * 100) / 100}:1`);
function settingText(k: string, v: unknown): string {
  if (v === 'off') return 'Off';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (k === 'mode') return MODE[String(v)] ?? String(v);
  if (typeof v !== 'number') return String(v);
  switch (k) {
    case 'fio2':
      return `${Math.round(v * 100)} %`;
    case 'vt':
      return `${Math.round(v * 1000)} mL`;
    case 'ie':
      return ieText(v);
    case 'pausePct':
      return `${Math.round(v * 100)} %`;
    case 'flowTrigger':
      return `${(v * 60).toFixed(1)} L/min`;
    case 'riseMs':
      return `${v} ms`;
    case 'rr':
      return `${v}/min`;
    default:
      return `${v} cmH₂O`;
  }
}
const changesText = (ch: Record<string, unknown>): string =>
  Object.entries(ch)
    .map(([k, v]) => `${SETTING[k] ?? k} → ${settingText(k, v)}`)
    .join(', ');
const ACTOR: Record<string, string> = {
  learner: 'usuario',
  instructor: 'docente',
  controller: 'ventilador',
  scenario: 'escenario',
  system: 'sistema',
};

/** Frase legible para el registro de eventos. */
export function eventSentence(e: SessionEvent): string {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const who = ACTOR[e.actor] ?? e.actor;
  switch (e.kind) {
    case 'setting':
      if (p.applied) return `Aplicado: ${changesText(p.applied as Record<string, unknown>)}`;
      if (p.changes) return `${who} confirmó ${changesText(p.changes as Record<string, unknown>)}`;
      return 'Ajuste';
    case 'breath': {
      if (p.plimitReached !== undefined) return `Plimit alcanzada a ${(p.plimitReached as number).toFixed(1)} cmH₂O`;
      if (p.trigger !== undefined) return `Disparo del paciente (${((p.trigger as number) * 60).toFixed(1)} L/min)`;
      const type: Record<string, string> = { mandatory: 'obligatoria', assisted: 'asistida', manual: 'manual', spontaneous: 'espontánea' };
      return `Respiración ${String(p.breathId).replace('b', '')} ${type[String(p.type)] ?? ''} · VTe ${Math.round((p.vte as number) * 1000)} mL · Ppico ${(p.ppeak as number).toFixed(0)}${p.cause === 'pmax' ? ' · terminada por Pmáx' : ''}`;
    }
    case 'alarm':
      if (p.pmaxReached !== undefined) return `Alarma: Pmáx alcanzada (${(p.pmaxReached as number).toFixed(1)} cmH₂O)`;
      if (p.acknowledge) return `${who} reconoció las alarmas`;
      if (p.limits) return `${who} cambió límites de alarma`;
      return 'Alarma';
    case 'procedure':
      if (p.kind === 'inspHold' || p.kind === 'expHold')
        return `${who} solicitó bloqueo ${p.kind === 'inspHold' ? 'inspiratorio' : 'espiratorio'} de ${String(p.durationS)} s`;
      if (p.holdEnded) return `Bloqueo terminado (${p.cancelled ? 'cancelado' : String(p.quality) === 'valid' ? 'válido' : 'no válido'})`;
      if (p.kind === 'manualBreath') return `${who} pidió una respiración manual`;
      if (p.kind === 'increaseO2') return p.phase === 'started' ? '↑O₂ iniciado (100 % por 120 s)' : '↑O₂ detenido';
      if (p.cancel) return `${who} canceló el procedimiento`;
      if (p.type === 'holdStarted') return `Bloqueo ${p.kind === 'inspHold' ? 'inspiratorio' : 'espiratorio'} en curso`;
      if (p.type === 'rejected') return `Bloqueo no elegible: ${humanReason(String(p.reason))}`;
      return 'Procedimiento';
    case 'state':
      return p.ventilation === 'standby' ? `${who} pasó a espera` : 'Ventilación iniciada';
    case 'scenario':
      if (p.scenarioId) return `Escenario cargado: ${String(p.name)}`;
      if (p.patient) return `${who} cambió la mecánica (${Object.keys(p.patient as object).join(', ')})`;
      if (p.effort) return `${who} cambió el esfuerzo`;
      if (p.sensors) return `${who} cambió el sensor de O₂`;
      return 'Escenario';
    case 'pause':
      return p.paused ? `Simulación pausada${p.reason ? ' (' + String(p.reason) + ')' : ''}` : 'Simulación reanudada';
    case 'audio':
      return 'Pausa de audio 120 s';
    case 'discontinuity':
      return `Tiempo descartado: ${Math.round((p.droppedMs as number) ?? 0)} ms`;
    case 'rejected':
      return `Orden rechazada (${String(p.command)}): ${String(p.reason)}`;
    case 'mode':
      return 'Cambio de modo';
    default:
      return e.kind;
  }
}
