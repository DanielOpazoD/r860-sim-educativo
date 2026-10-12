/**
 * Registro de comandos de la interfaz: el único lugar donde se declara qué `data-action` existen.
 * `actions.ts` debe implementar exactamente uno por identificador (`Record<CommandId, …>`, comprobado por el compilador)
 * y la paleta ⌘K toma de aquí sus entradas, así que un botón, un atajo y la paleta nunca apuntan a acciones distintas.
 */
export const COMMAND_IDS = [
  // casos y espacio educativo
  'classroom',
  'caseDevelopment',
  'submitCase',
  'restartCase',
  'freeExplore',
  'palette',
  // monitor y diálogos del equipo
  'home',
  'menu',
  'modes',
  'confirmModes',
  'scenarios',
  'welcome-free',
  'welcome-guided',
  'teacher',
  'pause',
  'freeze',
  'sound',
  'fullscreen',
  // alarmas
  'alarms',
  'alarmSetup',
  'confirmLimits',
  'mute',
  'acknowledge',
  // procedimientos
  'inspiratory',
  'expiratory',
  'closeHold',
  'runHold',
  'cancelHold',
  'manual',
  'oxygen',
  'startOxygen',
  'stopOxygen',
  // edición rápida y mando
  'cancelEdit',
  'confirmEdit',
  'editMinus',
  'editPlus',
  'knob',
  'lock',
  'unlock',
  // estado del equipo
  'standby',
  'confirmStandby',
  'startVentilation',
  'powerInfo',
  // paciente y curvas
  'patient',
  'resetPatient',
  'undoEvent',
  'loopReference',
  'clearLoop',
  'waveReference',
  // evaluación y herramientas
  'exam',
  'examSubmit',
  'tools',
  'mechanics',
  // sesión, exportaciones y ayuda
  'session',
  'resetPrefs',
  'exportSession',
  'importSession',
  'csv',
  'signalCSV',
  'snapshot',
  'exportDebrief',
  'help',
  'model',
  'closeDialog',
] as const;

export type CommandId = (typeof COMMAND_IDS)[number];

const COMMAND_SET: ReadonlySet<string> = new Set(COMMAND_IDS);

export function isCommandId(value: string): value is CommandId {
  return COMMAND_SET.has(value);
}

export interface PaletteEntry {
  id: CommandId;
  label: string;
  keywords: string;
}

/** Comandos que ofrece la paleta, en el orden en que se listan sin consulta. */
export const PALETTE_COMMANDS: readonly PaletteEntry[] = [
  { id: 'pause', label: 'Pausar o reanudar', keywords: 'detener parar play pausa continuar' },
  { id: 'freeze', label: 'Congelar curvas', keywords: 'congelar inmovilizar ondas' },
  { id: 'snapshot', label: 'Captura del monitor', keywords: 'foto png imagen captura pantalla' },
  { id: 'alarms', label: 'Alarmas activas', keywords: 'alarmas alertas límites' },
  { id: 'home', label: 'Volver al inicio del monitor', keywords: 'inicio casa principal' },
  { id: 'help', label: 'Guía y alcance', keywords: 'ayuda información instrucciones' },
  { id: 'fullscreen', label: 'Pantalla completa', keywords: 'completa maximizar' },
  { id: 'modes', label: 'Modo y ajustes del ventilador', keywords: 'modo ventilación parámetros configuración' },
  { id: 'scenarios', label: 'Elegir caso clínico', keywords: 'casos clínicos práctica simulación escenario catálogo' },
  { id: 'inspiratory', label: 'Bloqueo inspiratorio', keywords: 'pausa pplat meseta' },
  { id: 'expiratory', label: 'Bloqueo espiratorio', keywords: 'autopeep peep intrinseca' },
  { id: 'exam', label: 'Modo examen', keywords: 'evaluación estimaciones' },
  { id: 'session', label: 'Sesión y archivos', keywords: 'guardar importar exportar' },
  { id: 'exportSession', label: 'Exportar sesión', keywords: 'json archivo descargar' },
  { id: 'exportDebrief', label: 'Resumen de práctica TXT', keywords: 'resumen práctica informe debriefing' },
  { id: 'classroom', label: 'Aula: fundamentos y reflexión', keywords: 'teoría fundamentos reflexión educación' },
  { id: 'teacher', label: 'Mostrar u ocultar el panel lateral', keywords: 'explorar casos paciente eventos instructor' },
  { id: 'freeExplore', label: 'Explorar libremente (sin caso)', keywords: 'banco pasivo salir caso libre' },
  { id: 'undoEvent', label: 'Deshacer último evento', keywords: 'revertir evento perfil mecánica' },
  { id: 'sound', label: 'Audio de alarmas', keywords: 'sonido silenciar mute' },
  { id: 'resetPatient', label: 'Restablecer mecánica', keywords: 'reiniciar paciente valores' },
  { id: 'resetPrefs', label: 'Restablecer preferencias', keywords: 'borrar ajustes configuración' },
];

/** Atajos de teclado globales; la paleta los muestra junto al comando. */
export const SHORTCUTS: Readonly<Record<string, CommandId>> = {
  ' ': 'pause',
  c: 'freeze',
  f: 'snapshot',
  a: 'alarms',
  h: 'home',
  '?': 'help',
};

export function shortcutLabel(id: CommandId): string | undefined {
  const key = Object.keys(SHORTCUTS).find((candidate) => SHORTCUTS[candidate] === id);
  if (key === undefined) return undefined;
  return key === ' ' ? 'Espacio' : key.toUpperCase();
}
