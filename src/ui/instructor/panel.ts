import type { EngineClient } from '../../app/engineClient';
import type { Discontinuity } from '../../app/protocol';
import type { EngineFrame } from '../../engine/simulator';
import { ENGINE_VERSION } from '../../engine/version';
import { PROFILE } from '../../profiles/r860-es-photo-reference/profile';
import { SCENARIOS } from '../../scenarios';
import { h, setText } from '../r860/dom';
import type { AlarmAudio } from '../r860/audio';

/**
 * Panel docente (P · dossier §24/§25): estado verdadero, escenarios sintéticos, pausa/velocidad, exportación e importación.
 * Nunca forma parte del marco del equipo simulado.
 */
export class InstructorPanel {
  root: HTMLElement;
  private truth: HTMLElement;
  private log: HTMLElement;
  private status: HTMLElement;
  private audioStatus: HTMLElement;
  private msg: HTMLElement;
  private inputs: Record<string, HTMLInputElement> = {};
  private lastEventSeq = 0;

  constructor(private readonly client: EngineClient, private readonly audio: AlarmAudio, private readonly cb: { loadFixture: (id: 'P1' | 'P3' | null) => void; restart: () => void }) {
    const num = (key: string, label: string, value: number, step: number, min?: number, max?: number) => {
      const inp = h('input', { type: 'number', value: String(value), step: String(step), ...(min !== undefined ? { min: String(min) } : {}), ...(max !== undefined ? { max: String(max) } : {}), 'aria-label': label });
      this.inputs[key] = inp;
      return h('div', { class: 'row' }, h('label', { text: label }), inp);
    };
    this.truth = h('div', { class: 'truth', text: '' });
    this.log = h('div', { class: 'log', 'aria-label': 'Registro de eventos' });
    this.status = h('span', { text: '' });
    this.audioStatus = h('span', { text: '' });
    this.msg = h('div', { class: 'row', role: 'status' });
    const scenarioSel = h('select', { 'aria-label': 'Escenario sintético' }, ...SCENARIOS.map((s) => h('option', { value: s.id, text: `${s.id} · ${s.name}` })));
    const speedSel = h('select', { 'aria-label': 'Velocidad', onchange: () => client.setSpeed(Number(speedSel.value)) }, ...['0.5', '1', '2'].map((v) => h('option', { value: v, text: `×${v}`, ...(v === '1' ? { selected: 'selected' } : {}) })));
    const fileInput = h('input', { type: 'file', accept: 'application/json', 'aria-label': 'Importar sesión' });
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files?.[0]; if (!f) return;
      const text = await f.text();
      const r = await client.importSession(text);
      this.setMsg(r.ok ? `Importada y reproducida. ${r.warnings?.join(' ') ?? ''}` : `Rechazada: ${r.errors?.join(' · ')}`, r.ok);
      fileInput.value = '';
    });
    this.root = h('aside', { class: 'instructor', 'aria-label': 'Panel docente (fuera del equipo)' },
      h('h2', { text: 'Panel docente · fuera del marco del equipo' }),
      h('div', { class: 'row' }, h('span', { text: 'Estado: ' }), this.status),
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: () => client.pause('instructor') }, 'Pausar'), h('button', { type: 'button', onclick: () => client.resume() }, 'Reanudar'), h('label', { text: 'Velocidad' }), speedSel, h('button', { type: 'button', onclick: () => cb.restart() }, 'Reiniciar sesión')),
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: () => void audio.enable().then(() => this.refreshAudio(0)) }, 'Activar audio'), this.audioStatus),
      h('h3', { text: 'Escenario sintético (no paciente)' }),
      h('div', { class: 'row' }, scenarioSel, h('button', { type: 'button', class: 'primary', onclick: () => { const sc = SCENARIOS.find((s) => s.id === scenarioSel.value); if (sc) { client.loadScenario(sc, false); cb.loadFixture(null); this.setMsg(`${sc.id}: ${sc.description} Observar: ${sc.observe} Cautela: ${sc.caution}`, true); } } }, 'Cargar')),
      h('div', { class: 'row' }, h('span', { text: 'Fixtures visuales (fotos): ' }), h('button', { type: 'button', onclick: () => cb.loadFixture('P1') }, 'P1'), h('button', { type: 'button', onclick: () => cb.loadFixture('P3') }, 'P3'), h('button', { type: 'button', onclick: () => cb.loadFixture(null) }, 'Volver al motor')),
      h('h3', { text: 'Mecánica verdadera (L, s, cmH2O internos)' }),
      num('crs', 'C (mL/cmH2O)', 50, 1, 1, 150), num('rInsp', 'Rinsp (cmH2O·s/L)', 10, 1, 1, 500), num('rExp', 'Rexp (cmH2O·s/L)', 10, 1, 1, 500),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: () => void this.applyPatient() }, 'Aplicar mecánica')),
      h('h3', { text: 'Esfuerzo sintético (Pmus)' }),
      h('div', { class: 'row' }, h('label', { text: 'Habilitado' }), (this.inputs.effortOn = h('input', { type: 'checkbox', 'aria-label': 'Esfuerzo habilitado' }))),
      num('amp', 'Amplitud (cmH2O)', 3, 0.5, 0, 30), num('rate', 'Frecuencia (/min)', 15, 1, 1, 60), num('ti', 'Duración (s)', 0.8, 0.1, 0.2, 3),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: () => void this.applyEffort() }, 'Aplicar esfuerzo')),
      h('h3', { text: 'Sensor de O2' }),
      num('tau', 'Constante (s)', 6, 1, 0.5, 60), num('bias', 'Sesgo (%)', 0, 1, -20, 20),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: () => void this.applySensors() }, 'Aplicar sensor')),
      h('h3', { text: 'Estado verdadero (lo que el ventilador no ve)' }),
      this.truth,
      h('h3', { text: 'Sesión' }),
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: () => void this.exportSession() }, 'Exportar JSON'), fileInput),
      this.msg,
      h('h3', { text: 'Registro de eventos (últimos)' }),
      this.log,
      h('div', { class: 'row', style: { marginTop: '8px', fontSize: '11px', color: '#556' } }, h('span', { text: `motor ${ENGINE_VERSION} · perfil ${PROFILE.profileId} v${PROFILE.profileVersion} · ${client.mode === 'worker' ? 'Worker' : 'en página (respaldo)'}` })),
    );
  }

  private setMsg(text: string, ok: boolean): void { this.msg.replaceChildren(h('span', { class: ok ? 'ok' : 'warn', text })); }

  private async applyPatient(): Promise<void> {
    const r = await this.client.command({ type: 'setPatient', params: { crs: Number(this.inputs.crs!.value) / 1000, rInsp: Number(this.inputs.rInsp!.value), rExp: Number(this.inputs.rExp!.value) } }, 'instructor');
    this.setMsg(r.accepted ? 'Mecánica aplicada (continuidad de volumen conservada)' : `Rechazado: ${r.reason}`, r.accepted);
  }
  private async applyEffort(): Promise<void> {
    const r = await this.client.command({ type: 'setEffort', params: { enabled: (this.inputs.effortOn as HTMLInputElement).checked, amplitude: Number(this.inputs.amp!.value), ratePerMin: Number(this.inputs.rate!.value), tiS: Number(this.inputs.ti!.value) } }, 'instructor');
    this.setMsg(r.accepted ? 'Esfuerzo aplicado' : `Rechazado: ${r.reason}`, r.accepted);
  }
  private async applySensors(): Promise<void> {
    const r = await this.client.command({ type: 'setSensors', params: { fio2TauS: Number(this.inputs.tau!.value), fio2Bias: Number(this.inputs.bias!.value) / 100 } }, 'instructor');
    this.setMsg(r.accepted ? 'Sensor aplicado' : `Rechazado: ${r.reason}`, r.accepted);
  }
  private async exportSession(): Promise<void> {
    const file = await this.client.exportSession();
    const blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sesion-sintetica-${file.exportedAtIso.replace(/[:.]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    this.setMsg(`Exportada (${file.commands.length} comandos, ${file.breaths.length} respiraciones, motor ${file.engineVersion})`, true);
  }

  refreshAudio(simTimeMs: number): void { setText(this.audioStatus, this.audio.status(simTimeMs)); }

  update(f: EngineFrame, meta: { running: boolean; speed: number; pauseReason: string | null; discontinuities: Discontinuity[] }): void {
    setText(this.status, `${meta.running ? 'en marcha' : `pausado (${meta.pauseReason ?? ''})`} · ×${meta.speed} · t = ${(f.simTimeMs / 1000).toFixed(1)} s · ${f.breathCount} resp · disc. ${meta.discontinuities.length}`);
    this.refreshAudio(f.simTimeMs);
    const t = f.truth;
    setText(this.truth, [
      `V abs sobre relajación: ${(t.vAbsL * 1000).toFixed(0)} mL   Pel: ${t.pel.toFixed(2)} cmH2O   Pmus: ${t.pmus.toFixed(2)} cmH2O`,
      `C ${(t.patient.crs * 1000).toFixed(1)} mL/cmH2O · Rinsp ${t.patient.rInsp} · Rexp ${t.patient.rExp} · tau esp ${(t.patient.rExp * t.patient.crs).toFixed(2)} s`,
      `esfuerzo ${t.effort.enabled ? `${t.effort.amplitude} cmH2O @ ${t.effort.ratePerMin}/min, Ti ${t.effort.tiS} s` : 'off'}`,
      `FiO2 objetivo ${(f.settings.fio2 * 100).toFixed(0)} % · entregada ${(t.fio2Delivered * 100).toFixed(1)} % · sensor ${f.metrics.fio2?.value === null || f.metrics.fio2?.value === undefined ? '---' : (f.metrics.fio2.value * 100).toFixed(1)} % (sesgo ${(t.sensors.fio2Bias * 100).toFixed(0)} %, tau ${t.sensors.fio2TauS} s)`,
      `fase ${f.live.phase} · ajustes pendientes: ${f.pending ? Object.keys(f.pending).join(',') : 'ninguno'}`,
    ].join('\n'));
    const tail = f.eventsTail;
    const last = tail[tail.length - 1];
    if (last && last.sequence !== this.lastEventSeq) {
      this.lastEventSeq = last.sequence;
      this.log.replaceChildren(...tail.slice(-12).reverse().map((e) => h('div', { text: `#${e.sequence} t=${(e.simTimeMs / 1000).toFixed(2)}s ${e.kind}/${e.actor} ${JSON.stringify(e.payload).slice(0, 110)}` })));
    }
  }
}
