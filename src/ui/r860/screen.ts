import type { Command, CommandResult } from '../../domain/commands';
import type { SettingsKey } from '../../domain/types';
import type { EngineFrame } from '../../engine/simulator';
import type { EditController } from '../../app/uiState';
import type { Discontinuity } from '../../app/protocol';
import { PROFILE } from '../../profiles/r860-es-photo-reference/profile';
import { EXP_HOLD_RULE, INSP_HOLD_RULE } from '../../profiles/r860-es-photo-reference/settings';
import { Bezel } from './bezel';
import { Dialogs } from './dialogs';
import { h, setClass, setText } from './dom';
import { fmtClock } from './format';
import { HoldWindow } from './holdWindow';
import { AdvancedPanel, BasicPanel } from './measured';
import { PressureBar } from './pressureBar';
import { QuickKeys } from './quickKeys';
import { WaveArea } from './waveArea';
import type { AlarmAudio } from './audio';

export type ViewId = 'basic' | 'basicWaves' | 'advancedWaves' | 'split' | 'charting';

export interface ScreenMeta { running: boolean; speed: number; pauseReason: string | null; discontinuities: Discontinuity[]; fixtureId: string | null }

export interface ScreenCallbacks {
  command: (cmd: Command) => Promise<CommandResult>;
  edit: EditController;
  audio: AlarmAudio;
}

/**
 * Pantalla del equipo simulado: HTML real para etiquetas y controles, canvas sólo para curvas.
 * Composición por zonas (dossier §5): barra superior, área de trabajo (curvas · datos · barra de presión), navegación, teclas rápidas.
 */
export class Screen {
  root: HTMLElement;
  private screenEl: HTMLElement;
  private waves = new WaveArea();
  private advPanel = new AdvancedPanel();
  private basicPanel = new BasicPanel();
  private pbar = new PressureBar();
  private quick: QuickKeys;
  private bezel: Bezel;
  private dialogs = new Dialogs();
  private inspHold: HoldWindow;
  private expHold: HoldWindow;
  private alarmBand: HTMLElement;
  private alarmMsg: HTMLElement;
  private alarmCount: HTMLElement;
  private clockEl: HTMLElement;
  private lockInd: HTMLElement;
  private standbyOverlay: HTMLElement;
  private pauseBanner: HTMLElement;
  private featureOverlay: HTMLElement;
  private editPreview: HTMLElement;
  private editPreviewText: HTMLElement;
  private editPreviewReasons: HTMLElement;
  private workEl: HTMLElement;
  private navBtns = new Map<ViewId, HTMLButtonElement>();
  private topKeys: Record<'inspHold' | 'expHold', HTMLButtonElement>;
  private o2Key: HTMLButtonElement;
  private srLive: HTMLElement;
  view: ViewId = 'advancedWaves';
  locked = false;
  private lastFrame: EngineFrame | null = null;
  private lastMeta: ScreenMeta | null = null;
  private lastAlarmMsg = '';

  constructor(private readonly cb: ScreenCallbacks) {
    this.quick = new QuickKeys(cb.edit, {
      onMode: () => this.openModeMenu(),
      onStandby: () => this.onStandbyKey(),
      onPower: () => void this.dialogs.info('Energía', ['El apagado/encendido del equipo no se simula en esta etapa (U-16: autonomía y secuencias no verificadas).', 'La aplicación permanece recuperable; use el panel docente para pausar o reiniciar la sesión.']),
      onConfirm: () => this.confirmEdit(),
    });
    this.bezel = new Bezel({
      audioPause: () => this.audioPause(),
      increaseO2: () => this.toggleO2(),
      snapshot: () => void this.dialogs.info('Captura', ['Captura de pantalla del equipo no implementada en esta etapa (hoja de ruta, etapa 4).', 'Las capturas de validación se toman con Playwright fijando semilla, hora y viewport.']),
      lock: () => this.toggleLock(),
      home: () => this.setView('advancedWaves'),
      turn: (d) => this.knobTurn(d),
      press: () => this.knobPress(),
    });
    this.inspHold = new HoldWindow('inspHold', INSP_HOLD_RULE, { start: (s) => void this.sendCommand({ type: 'requestHold', kind: 'inspHold', durationS: s }), cancel: () => void this.sendCommand({ type: 'cancelProcedure' }) });
    this.expHold = new HoldWindow('expHold', EXP_HOLD_RULE, { start: (s) => void this.sendCommand({ type: 'requestHold', kind: 'expHold', durationS: s }), cancel: () => void this.sendCommand({ type: 'cancelProcedure' }) });
    this.expHold.root.style.right = '12px';

    this.alarmMsg = h('span', { text: 'Sin alarmas' });
    this.alarmCount = h('span', { class: 'count', text: '' });
    this.alarmBand = h('button', { class: 'alarm-band green', type: 'button', 'aria-live': 'polite', 'aria-label': 'Banda de alarmas', onclick: () => this.openAlarmList() },
      h('span', { class: 'left' }, h('span', { class: 'bell', 'aria-hidden': 'true', text: '🔔' }), this.alarmMsg, this.alarmCount),
      h('span', { class: 'cfg', role: 'button', onclick: (e: Event) => { e.stopPropagation(); void this.openAlarmSetup(); } }, h('span', { text: 'Config. de alarmas' }), h('span', { class: 'ico', text: '⚙' })),
    );
    this.o2Key = h('button', { class: 'tb-key', type: 'button', 'aria-label': 'Aumentar O2', onclick: () => this.toggleO2() }, h('span', { class: 'ico', text: '↑O₂' }));
    this.topKeys = {
      inspHold: h('button', { class: 'tb-key', type: 'button', 'aria-label': 'Bloqueo inspiratorio', 'aria-expanded': 'false', onclick: () => this.toggleHold('inspHold') }, 'Bloqueo', h('br'), 'insp'),
      expHold: h('button', { class: 'tb-key', type: 'button', 'aria-label': 'Bloqueo espiratorio', 'aria-expanded': 'false', onclick: () => this.toggleHold('expHold') }, 'Bloqueo', h('br'), 'esp'),
    };
    const topbar = h('div', { class: 'topbar', role: 'toolbar', 'aria-label': 'Barra superior' },
      h('button', { class: 'tb-key menu', type: 'button', 'aria-label': 'Menú', onclick: () => void this.openMainMenu() }, 'Menú', h('span', { class: 'ico', text: '▤' })),
      h('button', { class: 'tb-key patient', type: 'button', 'aria-label': 'Tipo de paciente: Adulto', onclick: () => void this.dialogs.info('Paciente', ['Paciente SINTÉTICO · tipo Adulto · ID SIM-0001.', 'Sin datos reales. «Nuevo paciente», talla/peso y tipo de tubo: no habilitados en esta etapa (sólo adulto A/C VC).']) }, 'Adulto', h('span', { class: 'ico', text: '👥' })),
      this.alarmBand,
      this.o2Key,
      this.topKeys.inspHold,
      this.topKeys.expHold,
      h('button', { class: 'tb-key', type: 'button', 'aria-label': 'Respiración manual', onclick: () => void this.sendCommand({ type: 'manualBreath' }) }, 'Resp', h('br'), 'manual'),
    );

    this.workEl = h('div', { class: 'work' }, this.waves.root, this.advPanel.root, this.basicPanel.root, this.pbar.root, this.inspHold.root, this.expHold.root);
    this.basicPanel.root.hidden = true;

    const navDef: { id: ViewId; icon: string; label: string; enabled: boolean; why: string }[] = [
      { id: 'basic', icon: '⠿', label: 'Vista básica (sin curvas)', enabled: false, why: 'Vista no implementada en esta etapa (CFG-05). Composición no observada en las fotos (U-04).' },
      { id: 'basicWaves', icon: '⫶', label: 'Curvas básicas', enabled: true, why: '' },
      { id: 'advancedWaves', icon: '〰', label: 'Curvas avanzadas', enabled: true, why: '' },
      { id: 'split', icon: '◫', label: 'Pantalla dividida (bucles)', enabled: false, why: 'Bucles no implementados en esta etapa (hoja de ruta, etapa 4).' },
      { id: 'charting', icon: '▦', label: 'Datos tabulados', enabled: false, why: 'Vista tabulada no implementada en esta etapa (CFG-05).' },
    ];
    const navGroup = h('div', { class: 'group', role: 'tablist', 'aria-label': 'Vistas del presente' }, ...navDef.map((n) => {
      const b = h('button', { class: `nav-btn${n.enabled ? '' : ' not-available'}`, type: 'button', role: 'tab', 'aria-label': n.label, title: n.enabled ? n.label : `${n.label}: ${n.why}`, dataset: { available: n.enabled ? 'true' : 'false' }, onclick: () => (n.enabled ? this.setView(n.id) : this.showFeature(n.label, n.why)) }, n.icon);
      this.navBtns.set(n.id, b);
      return b;
    }));
    this.clockEl = h('span', { class: 'clock', text: '--:--' });
    this.lockInd = h('span', { class: 'lock-ind', text: '' });
    this.pauseBanner = h('div', { class: 'pause-banner', role: 'status' });
    const navbar = h('div', { class: 'navbar' },
      h('button', { class: 'nav-btn not-available', type: 'button', 'aria-label': 'Pasado: tendencias', title: 'Pasado: no implementado en esta etapa', dataset: { available: 'false' }, onclick: () => this.showFeature('Pasado · tendencias', 'Espacio de historial no implementado en esta etapa (hoja de ruta, etapa 4).') }, '◧'),
      navGroup,
      this.pauseBanner,
      h('button', { class: 'nav-btn not-available', type: 'button', 'aria-label': 'Futuro: soporte de decisiones', title: 'Futuro: no implementado en esta etapa', dataset: { available: 'false' }, onclick: () => this.showFeature('Futuro · soporte de decisiones', 'SBT, FRC, espirometría y cálculos no implementados (U-14, hoja de ruta 5–6).') }, '◨'),
      this.lockInd,
      this.clockEl,
    );

    this.standbyOverlay = h('div', { class: 'standby-overlay' }, h('div', { class: 'box' }, h('h2', { text: 'EN ESPERA' }), h('div', { text: 'Ventilación y monitorización simuladas detenidas.' }), h('div', { class: 'actions', style: { marginTop: '10px' } }, h('button', { type: 'button', class: 'dialog-btn', style: { padding: '8px 14px', cursor: 'pointer' }, onclick: () => void this.sendCommand({ type: 'startVentilation' }) }, 'Iniciar ventilación'))));
    this.featureOverlay = h('div', { class: 'feature-overlay' });
    this.editPreviewText = h('span', {});
    this.editPreviewReasons = h('span', { class: 'reasons' });
    this.editPreview = h('div', { class: 'edit-preview', role: 'status' }, this.editPreviewText, this.editPreviewReasons, h('button', { type: 'button', onclick: () => this.confirmEdit() }, 'Confirmar'), h('button', { type: 'button', onclick: () => this.cancelEdit() }, 'Cancelar'));
    this.srLive = h('div', { class: 'sr-only', 'aria-live': 'assertive' });

    this.screenEl = h('div', { class: 'screen', 'aria-label': 'Pantalla del ventilador simulado' },
      h('div', { class: 'sim-mark', text: PROFILE.banner }),
      topbar, this.workEl, navbar, this.quick.root, this.standbyOverlay, this.featureOverlay, this.editPreview, this.dialogs.root, this.srLive,
    );
    this.root = h('div', { class: 'device' }, this.screenEl, this.bezel.root);
    this.setView('advancedWaves');

    cb.edit.on((e) => {
      if (e.type === 'confirmed') void this.sendCommand({ type: 'confirmSettings', changes: e.changes }).then((r) => { if (!r.accepted) this.announce(`Rechazado: ${r.reason ?? ''}`); });
      if (e.type === 'rejected') this.announce(`No válido: ${e.reasons.join('; ')}`);
      if (e.type === 'cancelled' && e.reason === 'timeout') this.announce('Borrador cancelado por vencimiento del plazo (P)');
      this.renderEdit();
    });
  }

  private async sendCommand(cmd: Command): Promise<CommandResult> {
    const r = await this.cb.command(cmd);
    if (!r.accepted && r.reason) this.announce(r.reason);
    return r;
  }

  private announce(msg: string): void {
    setText(this.srLive, msg);
    this.editPreviewReasons.textContent = msg;
    this.editPreview.classList.add('show');
    window.setTimeout(() => { if (this.cb.edit.state.kind === 'idle') this.editPreview.classList.remove('show'); }, 4000);
  }

  setView(v: ViewId): void {
    this.view = v;
    for (const [id, b] of this.navBtns) { setClass(b, 'selected', id === v); b.setAttribute('aria-selected', id === v ? 'true' : 'false'); }
    const basic = v === 'basicWaves';
    setClass(this.workEl, 'basic', basic);
    this.advPanel.root.hidden = basic;
    this.basicPanel.root.hidden = !basic;
    this.waves.setScaleSet(basic ? 'basic' : 'advanced');
    this.featureOverlay.classList.remove('show');
    // El motor no se reinicia ni se duplica: sólo cambia la presentación (INT-05).
  }

  private showFeature(title: string, why: string): void {
    this.featureOverlay.replaceChildren(h('div', { class: 'box', role: 'alert' }, h('h3', { text: title }), h('div', { text: why }), h('button', { type: 'button', onclick: () => this.featureOverlay.classList.remove('show') }, 'Cerrar')));
    this.featureOverlay.classList.add('show');
  }

  private toggleHold(kind: 'inspHold' | 'expHold'): void {
    const w = kind === 'inspHold' ? this.inspHold : this.expHold;
    const other = kind === 'inspHold' ? this.expHold : this.inspHold;
    other.toggle(false);
    w.toggle();
    this.topKeys[kind].setAttribute('aria-expanded', w.visible ? 'true' : 'false');
    this.topKeys[kind === 'inspHold' ? 'expHold' : 'inspHold'].setAttribute('aria-expanded', 'false');
    setClass(this.topKeys[kind], 'active', w.visible);
    setClass(this.topKeys[kind === 'inspHold' ? 'expHold' : 'inspHold'], 'active', false);
  }

  private async onStandbyKey(): Promise<void> {
    if (this.locked) { this.announce('Pantalla bloqueada'); return; }
    const f = this.lastFrame;
    if (f && f.ventilation === 'standby') { await this.sendCommand({ type: 'startVentilation' }); return; }
    const ok = await this.dialogs.confirmStandby();
    if (ok) await this.sendCommand({ type: 'enterStandby' });
  }

  private async openModeMenu(): Promise<void> {
    if (this.locked || !this.lastFrame) return;
    this.cb.edit.cancel();
    const changes = await this.dialogs.modeMenu(this.lastFrame.settings);
    if (changes && Object.keys(changes).length) await this.sendCommand({ type: 'confirmSettings', changes });
  }

  private async openAlarmSetup(): Promise<void> {
    if (this.locked || !this.lastFrame) return;
    const ch = await this.dialogs.alarmSetup(this.lastFrame.alarmLimits, this.lastFrame.settings.pmax);
    if (ch && Object.keys(ch).length) await this.sendCommand({ type: 'setAlarmLimits', changes: ch });
  }

  private openAlarmList(): void {
    if (!this.lastFrame) return;
    void this.dialogs.alarmList(this.lastFrame.alarms, (id) => void this.sendCommand({ type: 'acknowledgeAlarms', ...(id ? { id } : {}) }), this.lastFrame.wallTimeMs, this.lastFrame.simTimeMs);
  }

  private openMainMenu(): Promise<void> {
    return this.dialogs.mainMenu({ inspHold: () => this.toggleHold('inspHold'), expHold: () => this.toggleHold('expHold'), manualBreath: () => void this.sendCommand({ type: 'manualBreath' }), increaseO2: () => this.toggleO2(), lock: () => this.toggleLock() });
  }

  private toggleO2(): void {
    const f = this.lastFrame;
    if (f?.procedure.o2?.active) void this.sendCommand({ type: 'increaseO2Stop' });
    else void this.sendCommand({ type: 'increaseO2Start' });
  }

  private audioPause(): void {
    void this.sendCommand({ type: 'audioPause' }); // el motor guarda «hasta cuándo»; el audio lo lee del cuadro
    this.announce('Pausa de audio 120 s (D); las señales visuales continúan');
  }

  toggleLock(): void {
    this.locked = !this.locked;
    this.cb.edit.setLocked(this.locked);
    this.bezel.setLocked(this.locked);
    setText(this.lockInd, this.locked ? 'PANTALLA BLOQUEADA' : '');
    this.renderEdit();
  }

  knobTurn(d: 1 | -1): void {
    if (this.locked) return;
    if (this.inspHold.isEditing) { this.inspHold.adjust(d); return; }
    if (this.expHold.isEditing) { this.expHold.adjust(d); return; }
    if (this.cb.edit.adjust(d, performance.now())) this.renderEdit();
  }
  knobPress(): void {
    if (this.locked) return;
    if (this.inspHold.isEditing) { this.inspHold.confirm(); return; }
    if (this.expHold.isEditing) { this.expHold.confirm(); return; }
    this.confirmEdit();
  }
  confirmEdit(): void { this.cb.edit.confirm(); this.renderEdit(); }
  cancelEdit(): void { this.inspHold.cancelEdit(); this.expHold.cancelEdit(); this.cb.edit.cancel(); this.renderEdit(); }
  get dialogOpen(): boolean { return this.dialogs.open; }
  closeDialog(): void { this.dialogs.close(null); }

  private renderEdit(): void {
    const st = this.cb.edit.state;
    this.bezel.setArmed(st.kind !== 'idle' || this.inspHold.isEditing || this.expHold.isEditing);
    this.quick.render(this.lastFrame);
    if (st.kind === 'idle') { this.editPreview.classList.remove('show'); return; }
    const p = this.cb.edit.preview();
    const key = st.key as SettingsKey;
    const d = p.derived;
    setText(this.editPreviewText, `Borrador ${key}: ${d ? `Tinsp ${d.tInspS.toFixed(2)} s · Texp ${d.tExpS.toFixed(2)} s · flujo ${(d.qTargetLps * 60).toFixed(1)} L/min` : ''} · plazo ${Math.round(this.cb.edit.timeoutMs / 1000)} s (P)`);
    setText(this.editPreviewReasons, p.reasons.join(' · '));
    this.editPreview.classList.add('show');
  }

  /** Actualiza etiquetas/valores desde un cuadro del motor (o de una fixture). Las curvas se encolan y se dibujan en rAF. */
  update(f: EngineFrame, meta: ScreenMeta): void {
    this.lastFrame = f; this.lastMeta = meta;
    this.waves.enqueue(f.samples);
    this.advPanel.update(f);
    this.basicPanel.update(f);
    this.pbar.update(f);
    this.inspHold.update(f); this.expHold.update(f);
    this.quick.render(f);
    setText(this.clockEl, fmtClock(f.wallTimeMs));
    const bar = f.alarmBar;
    this.alarmBand.className = `alarm-band ${bar.color}`;
    setText(this.alarmMsg, bar.message);
    setText(this.alarmCount, bar.activeCount > 1 ? `(${bar.activeCount})` : bar.pendingAckCount && !bar.activeCount ? `(${bar.pendingAckCount} previa)` : '');
    if (bar.message !== this.lastAlarmMsg) { this.lastAlarmMsg = bar.message; setText(this.srLive, `Alarmas: ${bar.message}`); }
    const top = f.alarms.filter((a) => a.conditionActive).sort((a, b) => (a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0))[0];
    this.cb.audio.pausedUntilMs = f.audioPauseUntilMs;
    this.cb.audio.drive(top ? top.priority : null, f.simTimeMs);
    setClass(this.standbyOverlay, 'show', f.ventilation === 'standby');
    setClass(this.o2Key, 'active', !!f.procedure.o2?.active);
    const paused = !meta.running;
    const disc = meta.discontinuities.length;
    setClass(this.pauseBanner, 'show', paused || disc > 0 || meta.fixtureId !== null);
    setText(this.pauseBanner, meta.fixtureId ? `FIXTURE VISUAL ${meta.fixtureId}: transcripción de fotografía, sin motor` : `${paused ? `Simulación pausada: ${meta.pauseReason ?? ''}` : ''}${disc ? ` · ${disc} discontinuidad(es) registradas (tiempo descartado, no recuperado)` : ''}`);
  }

  /** Sólo dibuja (requestAnimationFrame). */
  draw(): void { this.waves.draw(); }
  clearWaves(): void { this.waves.clear(); }
  get lastFrameRef(): EngineFrame | null { return this.lastFrame; }
  get meta(): ScreenMeta | null { return this.lastMeta; }
}
