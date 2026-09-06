import { EngineClient } from './app/engineClient';
import { EditController } from './app/uiState';
import { defaultInit } from './engine/simulator';
import { frameFromFixture, PHOTO_FIXTURES } from './fixtures/photoFixtures';
import { PROFILE } from './profiles/r860-es-photo-reference/profile';
import { VC_ADULT_CROSS_LIMITS, VC_ADULT_RULES } from './profiles/r860-es-photo-reference/settings';
import { findScenario } from './scenarios';
import { AlarmAudio } from './ui/r860/audio';
import { h } from './ui/r860/dom';
import { Screen } from './ui/r860/screen';
import { InstructorPanel } from './ui/instructor/panel';
import type { EngineFrame } from './engine/simulator';

/**
 * Parámetros de URL (para pruebas reproducibles): fixture=P1|P3 · t0=ISO · seed=n · dt=ms · speed=x · paused=1 ·
 * autopause=ms · scenario=SC-01 · inline=1 (sin Worker) · view=basicWaves|advancedWaves · instructor=0 · editTimeout=ms (sólo pruebas).
 */
const params = new URLSearchParams(location.search);
const app = document.getElementById('app') as HTMLElement;

const audio = new AlarmAudio();
const client = new EngineClient({ forceInline: params.get('inline') === '1' });
let activeSettingsFrame: EngineFrame | null = null;
const editTimeoutMs = params.get('editTimeout') ? Number(params.get('editTimeout')) : PROFILE.editTimeoutMs; // plazo P (U-07); sobreescribible sólo para pruebas
// El borrador se valida contra los ajustes activos MÁS los pendientes, igual que hace el motor.
const edit = new EditController(VC_ADULT_RULES, VC_ADULT_CROSS_LIMITS, () => (activeSettingsFrame ? { ...activeSettingsFrame.settings, ...(activeSettingsFrame.pending ?? {}) } : defaultInit().settings), editTimeoutMs);
const screen = new Screen({ command: (cmd) => client.command(cmd, 'learner'), edit, audio });

let fixtureId: 'P1' | 'P3' | null = null;
const instructor = new InstructorPanel(client, audio, {
  loadFixture: (id) => { fixtureId = id; if (id) { screen.clearWaves(); screen.update(frameFromFixture(PHOTO_FIXTURES[id]), { running: false, speed: 1, pauseReason: 'fixture', discontinuities: [], fixtureId: id }); client.pause('fixture visual'); } else client.resume(); },
  restart: () => { fixtureId = null; screen.clearWaves(); startEngine(); },
});

const header = h('div', { class: 'app-header' },
  h('span', { class: 'banner', text: PROFILE.banner }),
  h('span', { class: 'meta', text: `Simulador educativo inspirado en CARESCAPE R860 · perfil ${PROFILE.profileId} · sin aval del fabricante · datos sintéticos` }),
  h('span', { class: 'spacer' }),
  h('button', { type: 'button', 'aria-pressed': params.get('instructor') === '0' ? 'false' : 'true', onclick: (e: Event) => { const b = e.currentTarget as HTMLButtonElement; const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); instructor.root.classList.toggle('hidden', !on); } }, 'Panel docente'),
  h('button', { type: 'button', onclick: () => fitScale(true) }, 'Ajustar tamaño'),
);
const scaleWrap = h('div', { class: 'device-scale' }, screen.root);
const deviceWrap = h('div', { class: 'device-wrap' }, scaleWrap);
if (params.get('instructor') === '0') instructor.root.classList.add('hidden');
app.append(h('div', { class: 'app' }, header, h('div', { class: 'app-main' }, deviceWrap, instructor.root)));

function fitScale(force = false): void {
  const availW = Math.max(320, (app.clientWidth || window.innerWidth) - (instructor.root.classList.contains('hidden') ? 24 : 396));
  const availH = Math.max(240, window.innerHeight - 70);
  // Escritorio: conservar proporciones; teléfono/visor pequeño: vista escalada de exploración (los controles siguen siendo HTML real).
  const s = Math.min(1, availW / 1320, availH / 820);
  scaleWrap.style.transform = `scale(${s})`;
  deviceWrap.style.width = `${1320 * s}px`;
  deviceWrap.style.height = `${820 * s}px`;
  void force;
}
window.addEventListener('resize', () => fitScale());
fitScale();

function startEngine(): void {
  const t0 = params.get('t0');
  const sc = params.get('scenario') ? findScenario(params.get('scenario') as string) : undefined;
  const init = defaultInit({
    ...(t0 ? { startWallTimeMs: new Date(t0).getTime() } : { startWallTimeMs: Date.now() }),
    ...(params.get('seed') ? { seed: Number(params.get('seed')) } : {}),
    ...(params.get('dt') ? { dtMs: Number(params.get('dt')) } : {}),
    ...(sc ? { patient: { ...sc.patient }, effort: { ...sc.effort }, sensors: { ...sc.sensors }, settings: { ...defaultInit().settings, ...(sc.settings ?? {}) }, initialV: sc.initialV ?? 'equilibrium' } : {}),
  });
  const speed = params.get('speed') ? Number(params.get('speed')) : 1;
  const autopause = params.get('autopause') ? Number(params.get('autopause')) : undefined;
  client.init(init, speed, params.get('paused') !== '1', autopause);
  if (sc) client.loadScenario(sc, false);
}

client.onFrame((m) => {
  if (fixtureId) return;
  activeSettingsFrame = m.frame;
  screen.update(m.frame, { running: m.running, speed: m.speed, pauseReason: m.pauseReason, discontinuities: m.discontinuities, fixtureId: null });
  instructor.update(m.frame, m);
});

// requestAnimationFrame SÓLO dibuja (dossier §23).
function raf(): void { screen.draw(); requestAnimationFrame(raf); }
requestAnimationFrame(raf);

// Vencimiento del borrador en tiempo real (P, plazo configurable).
setInterval(() => edit.tick(performance.now()), 500);

// Política de pestaña oculta (TIM-03): pausa explícita y registro; sin recuperación del tiempo perdido.
document.addEventListener('visibilitychange', () => { if (!fixtureId) client.visibility(document.hidden); });

// Teclado global (ACC-01): Enter confirma, Escape cancela, flechas ajustan sólo con selección.
document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null;
  const inField = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
  if (e.key === 'Escape') { if (screen.dialogOpen) screen.closeDialog(); else screen.cancelEdit(); return; }
  if (inField || screen.dialogOpen) return;
  if (e.key === 'Enter' && edit.state.kind !== 'idle') { e.preventDefault(); screen.confirmEdit(); }
  else if ((e.key === 'ArrowUp' || e.key === 'ArrowRight') && edit.state.kind !== 'idle') { e.preventDefault(); screen.knobTurn(1); }
  else if ((e.key === 'ArrowDown' || e.key === 'ArrowLeft') && edit.state.kind !== 'idle') { e.preventDefault(); screen.knobTurn(-1); }
});

const initialView = params.get('view');
if (initialView === 'basicWaves' || initialView === 'advancedWaves') screen.setView(initialView);

void client.ready.then(() => {
  startEngine();
  const fx = params.get('fixture');
  if (fx === 'P1' || fx === 'P3') { screen.setView(fx === 'P1' ? 'advancedWaves' : 'basicWaves'); setTimeout(() => { fixtureId = fx; screen.update(frameFromFixture(PHOTO_FIXTURES[fx]), { running: false, speed: 1, pauseReason: 'fixture', discontinuities: [], fixtureId: fx }); client.pause('fixture visual'); }, 50); }
});

// Exposición mínima para pruebas E2E (sólo lectura): último cuadro y estado de edición.
(window as unknown as { __r860: unknown }).__r860 = { get frame() { return screen.lastFrameRef; }, get edit() { return edit.state; }, get view() { return screen.view; }, get mode() { return client.mode; } };
