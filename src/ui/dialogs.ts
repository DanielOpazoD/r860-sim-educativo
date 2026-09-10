/** Plantillas HTML de los diálogos (puras: reciben datos, devuelven texto). El estado y la apertura viven en app.ts. */
import type { EngineFrame } from '../engine/simulator';
import type { LessonTask, Scenario } from '../scenarios';
import { esc, icon } from './dom';
import { clock } from './format';
import { modeLabel as etiquetaModo } from './labels';

export const MENU_ENTRIES: [string, string, string, string][] = [
  ['modes', 'wave', 'Modo y ajustes', 'Volumen, límites de presión y sincronización'],
  ['alarmSetup', 'bell', 'Alarmas', 'Límites y condiciones activas'],
  ['tools', 'lung', 'Mecánica y procedimientos', 'Bloqueos y mediciones'],
  ['patient', 'person', 'Adulto virtual', 'Perfil sintético'],
  ['session', 'download', 'Sesión y archivos', 'Guardar, continuar y exportar'],
  ['scenarios', 'grid', 'Escenarios', 'Prácticas guiadas'],
  ['help', 'book', 'Guía y alcance', 'Uso, modelo y fuentes'],
];
export const menuHTML = (): string =>
  `<div class="menu-grid">${MENU_ENTRIES.map(
    ([a, i, l, d]) =>
      `<button class="menu-entry" data-action="${a}">${icon(i)}<span><b>${l}</b><small>${d}</small></span>${icon('arrow')}</button>`,
  ).join('')}</div>`;

export const toolsHTML = (): string =>
  `<div class="tools-grid">${[
    ['inspiratory', 'Bloqueo inspiratorio', 'Mide Pplat y estima Cstat cuando la meseta es válida.'],
    ['expiratory', 'Bloqueo espiratorio', 'Mide la presión total al final de la espiración y la PEEPi.'],
    ['manual', 'Respiración manual', 'Solicita una respiración obligatoria adicional durante la espiración.'],
    ['mechanics', 'Mecánica respiratoria', 'Consulta la última maniobra, su calidad y su hora.'],
  ]
    .map(([a, l, t]) => `<button class="tool-card" data-action="${a}"><h3>${l}</h3><p>${t}</p>${icon('arrow')}</button>`)
    .join('')}</div>`;

export function sessionHTML(scenarioName: string, simS: number, engineVersion: string, profileVersion: string): string {
  const entries = [
    ['exportSession', 'download', 'Guardar sesión JSON', 'Inicialización y comandos para reproducir exactamente la sesión.'],
    ['importSession', 'upload', 'Abrir sesión JSON', 'Se valida y se reproduce en pausa; no ejecuta código.'],
    ['csv', 'table', 'Exportar tendencias CSV', 'Un registro por ciclo completo.'],
    [
      'signalCSV',
      'wave',
      'Exportar señal CSV',
      'Hasta 120 s de presión, flujo, volumen y esfuerzo, con cada muestra del motor (una cada 4 ms).',
    ],
    ['snapshot', 'camera', 'Captura PNG', 'Monitor renderizado con marca de simulación.'],
    ['debrief', 'book', 'Resumen de práctica', 'Objetivos, ajustes y cronología de la sesión.'],
  ];
  return `<p class="dialog-lead">Los archivos contienen exclusivamente el escenario virtual y sus acciones. Todo se procesa en este navegador; no hay servidor ni telemetría.</p><div class="session-actions">${entries
    .map(
      ([a, i, l, d]) =>
        `<button class="menu-entry" data-action="${a}">${icon(i as string)}<span><b>${l}</b><small>${d}</small></span></button>`,
    )
    .join(
      '',
    )}</div><div class="session-facts"><span>Escenario: <b>${esc(scenarioName)}</b></span><span>Tiempo: <b>${clock(simS)}</b></span><span>Motor ${engineVersion} · perfil ${profileVersion}</span></div>`;
}

export const patientHTML = (): string =>
  `<p class="dialog-lead">Perfil sintético de referencia (ID SIM-0001). No introduzcas información de personas reales.</p><div class="info-box">Población adulta · A/C VC · sin talla, peso ni tipo de tubo en esta etapa.</div><p class="settings-annotation">Esta versión no implementa perfiles pediátricos o neonatales, humidificador, tubo endotraqueal ni caja torácica separada.</p>`;

export const standbyHTML = (): string =>
  `<div class="notice-box">Se detendrá la entrega de respiraciones y la monitorización. El pulmón se vacía hacia presión ambiente; no se simulan consecuencias clínicas.</div><p><b>Pausar simulación</b> detiene el reloj completo. <b>Congelar curvas</b> detiene sólo el dibujo. <b>En espera</b> detiene la ventilación virtual, no el reloj.</p>`;

export function oxygenHTML(o2: EngineFrame['procedure']['o2'] | undefined, simTimeMs: number): string {
  const head = o2?.active
    ? `Activo: ${Math.round(o2.targetFio2 * 100)} % · quedan ${clock(Math.ceil((o2.endsAtMs - simTimeMs) / 1000))}.`
    : 'Elevar temporalmente FiO₂ al 100 % durante 120 segundos de simulación.';
  return `<div class="info-box">${head}</div><p>Al terminar regresa al ajuste vigente. Si confirmas otra FiO₂ durante el procedimiento, esa edición prevalece. El sensor de O₂ responde con retardo; no se calcula saturación.</p>`;
}

export const powerHTML = (): string =>
  `<div class="info-box">Ejecución local en tu navegador. Sin conexión a un ventilador, red hospitalaria, USB ni puertos físicos.</div><p>Este icono conserva la referencia visual de alimentación. No simula baterías, consumo eléctrico ni autonomía.</p>`;

export function scenariosHTML(scenarios: Scenario[], currentId: string, modeLabel: (mode: string) => string): string {
  return `<div class="scenario-grid">${scenarios
    .map(
      (s) =>
        `<button class="scenario-card ${currentId === s.id ? 'selected' : ''}" data-scenario="${s.id}" title="${esc(s.description)}"><div><span>${esc(s.category ?? 'Escenario')}</span><small>Nivel ${s.level ?? 1}</small></div><h3>${esc(s.name)}</h3><footer>${modeLabel(String(s.settings?.mode ?? 'AC_VC'))} · C ${Math.round(s.patient.crs * 1000)} · R ${s.patient.rInsp}/${s.patient.rExp}</footer></button>`,
    )
    .join('')}</div>`;
}

export interface DebriefInput {
  scenario: Scenario;
  tasks: LessonTask[];
  done: Set<string>;
  simS: number;
  breathCount: number;
}
export function debriefHTML(d: DebriefInput): string {
  return `<div class="debrief-stat-grid"><div><b>${d.done.size}/${d.tasks.length}</b><span>Objetivos de interfaz</span></div><div><b>${clock(d.simS)}</b><span>Tiempo simulado</span></div><div><b>${d.breathCount}</b><span>Ciclos completos</span></div></div><h3>${esc(d.scenario.lesson?.title ?? d.scenario.name)}</h3><div class="lesson-tasks">${d.tasks
    .map(
      (x) =>
        `<div class="task ${d.done.has(x.id) ? 'complete' : ''}"><span class="task-check">${icon(d.done.has(x.id) ? 'check' : 'minus')}</span><span>${esc(x.text)}</span></div>`,
    )
    .join(
      '',
    )}</div><div class="info-box"><b>${esc(d.scenario.question ?? '')}</b><p>${esc(d.scenario.answer ?? '')}</p></div><div class="notice-box">Este resumen registra acciones del simulador; no puntúa seguridad clínica ni acredita competencia.</div>`;
}
export function debriefText(d: DebriefInput, fr: EngineFrame): string {
  return `R860 LAB · RESUMEN DE PRÁCTICA\nSIMULACIÓN EDUCATIVA · NO USO CLÍNICO\n\nEscenario: ${d.scenario.name}\nTiempo simulado: ${clock(d.simS)}\nModo: ${etiquetaModo(fr.settings.mode)}\nObjetivos de interfaz: ${d.done.size}/${d.tasks.length}\n\n${d.tasks.map((x) => `${d.done.has(x.id) ? '[Realizado]' : '[Pendiente]'} ${x.text}`).join('\n')}\n\nAJUSTES\n${JSON.stringify(fr.settings, null, 2)}\n\nMODELO SINTÉTICO\n${JSON.stringify(fr.truth.patient, null, 2)}\n\nÚLTIMOS EVENTOS\n${fr.eventsTail.map((e) => `${clock(e.simTimeMs / 1000)} ${e.kind}: ${JSON.stringify(e.payload)}`).join('\n')}\n\nNo evalúa competencia clínica ni seguridad de ventilación en pacientes.\n`;
}

export const SOURCES: [string, string, string][] = [
  [
    'GE HealthCare · Quick Reference Guide JB77395XX (2020)',
    'Interfaz, perilla, vistas, alarmas, ↑O2 y espera. Leída íntegra; hash en evidence.json.',
    'https://s7d9.scene7.com/is/content/gehealthcare/1-1_quick-reference-guidepdf-3',
  ],
  [
    'GE HealthCare · Troubleshooting Guide JB79437XX (2020)',
    'VT no alcanzado por Plimit; alarma de Ppico evaluada antes de refrescar pantalla.',
    'https://s7d9.scene7.com/is/content/gehealthcare/2-5_trouble-shooting-guidepdf-1',
  ],
  [
    'GE Healthcare · Especificaciones técnicas JB23840CO (2014)',
    'Rangos, escalones, bloqueos, familias de temporización y límites de alarma.',
    'https://www.pvequip.cl/wp-content/uploads/2019/08/EETT-Ventilador-Carescape-R860.pdf',
  ],
  [
    'GE HealthCare · Modos de ventilación invasiva JB72469XX (ES, 2020)',
    'Comportamiento de Plimit en VC; cotas de PRVC.',
    'https://landing1.gehealthcare.com/rs/005-SHS-767/images/CARESCAPE%20R860%20Modes%20Invasivos_Spanish.pdf',
  ],
  [
    'MDN · Web Workers',
    'Motor temporal separado de la interfaz.',
    'https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers',
  ],
];
export const HELP_TABS: [string, string][] = [
  ['start', 'Primeros pasos'],
  ['model', 'Modelo y límites'],
  ['keys', 'Atajos y controles'],
  ['sources', 'Fuentes'],
];
const KEYS: [string, string][] = [
  ['Espacio', 'Pausar o reanudar el reloj de simulación'],
  ['C', 'Congelar o reanudar curvas'],
  ['F', 'Guardar captura PNG'],
  ['A', 'Abrir alarmas'],
  ['H', 'Vista principal de curvas'],
  ['?', 'Abrir esta guía'],
  ['↑ / ↓', 'Cambiar el parámetro seleccionado'],
  ['Enter', 'Confirmar un ajuste rápido'],
  ['Esc', 'Cancelar ajuste o cerrar ventana'],
  ['Rueda sobre perilla', 'Modificar el parámetro seleccionado'],
];
const HELP_TEXTS: Record<string, string> = {
  start: `<p class="dialog-lead">Un ventilador virtual para explorar la relación entre lo que ajustas, lo que hace el pulmón sintético y lo que muestra el monitor.</p><div class="help-list"><div><b>01 · Ventila</b><p>La sesión ya está ventilando. Selecciona un parámetro de la barra inferior. Ajusta con el deslizador, el número, las flechas o la perilla y <b>confirma</b>. Cancelar conserva el valor previo. El cambio se aplica en la próxima respiración.</p></div><div><b>02 · Cambia el pulmón</b><p>En la pestaña «Paciente» del panel derecho se controlan C, R, esfuerzo y sensor de O₂. Estos cambios actúan sobre el modelo, no sobre los ajustes del equipo. En «Eventos» puedes provocar y deshacer alteraciones.</p></div><div><b>03 · Mide y compara</b><p>Bloqueo insp/esp abre la maniobra; pulsa ▶ para solicitarla. El motor espera una fase elegible. Revisa el resultado, su validez y su hora. En Bucles, guarda un ciclo de referencia.</p></div><div><b>04 · Entrena y guarda</b><p>«Entrenar», la pestaña que se abre primero, contiene tres objetivos por escenario y avisa al cumplir cada uno. Guarda JSON para reproducir y CSV/PNG para analizar. No hay subida de archivos a internet.</p></div></div><div class="info-box"><b>Tres acciones distintas:</b> Pausar detiene el reloj; Congelar curvas conserva una imagen mientras el motor sigue; En espera suspende la ventilación virtual. Al ocultar la pestaña se pausa la simulación y se reanuda manualmente.</div>`,
  model: `<p class="dialog-lead">Mecánica consistente, alcance explícitamente limitado.</p><div class="equation">Paw + Pmus = V / C + R × Q<br>τesp = Rexp × C</div><p>Un compartimento lineal con resistencia inspiratoria y espiratoria independientes; volumen pulmonar continuo (no se reinicia al cambiar PEEP); esfuerzo muscular periódico; sensor de O₂ con retardo. Integración a paso fijo de 4 ms con sub-pasos exactos en los eventos y localización de los cruces de Plimit/Pmáx dentro del paso; las curvas dibujan cada muestra, así que un evento de un solo paso también se ve.</p><p><b>Modos:</b> A/C VC, A/C PC y CPAP/PS adulto. En VC, Plimit sostiene la presión el resto de la inspiración y Pmáx la termina; en PC y en soporte la presión es la consigna; en CPAP/PS el paciente dispara y el flujo cicla, con frecuencia mínima, apnea y respaldo. Otros modos se incorporarán sólo tras sus pruebas de banco.</p><p><b>Mediciones estáticas:</b> esfuerzo, Pmáx, duración insuficiente o cancelación invalidan una maniobra; el resultado conserva su hora y su motivo. FR y VMesp usan las últimas ocho respiraciones.</p><div class="notice-box"><b>No modela:</b> intercambio gaseoso, SpO₂, PaCO₂, hemodinámica, reclutamiento, fuga, circuito ni tubo. FiO₂ cambia su sensor virtual, no una saturación inventada. No predice respuestas de pacientes ni controla equipos.</div><p>El firmware del equipo fotografiado no está identificado. Cada regla lleva su marca de evidencia (documentado / observado / propuesto / no resuelto) en los archivos evidence.json y gaps.json del proyecto.</p>`,
  keys: `<table class="info-table"><tbody>${KEYS.map(
    ([k, d]) => `<tr><td><kbd class="keyboard-key">${k}</kbd></td><td>${d}</td></tr>`,
  ).join(
    '',
  )}</tbody></table><div class="info-box">El audio está apagado inicialmente. Actívalo desde el icono superior. Los tonos son sintéticos. La pausa de audio dura 120 segundos del reloj simulado.</div>`,
  sources: `<p class="dialog-lead">Fuentes primarias consultadas; se abren en internet sólo al seleccionarlas. El funcionamiento del simulador es completamente local.</p>${SOURCES.map(
    ([title, desc, url]) =>
      `<div class="source-entry"><a href="${url}" target="_blank" rel="noopener noreferrer">${title} ${icon('arrow')}</a><p>${desc}</p></div>`,
  ).join(
    '',
  )}<p>Referencia visual: las tres fotografías aportadas por el usuario (P1, P2, P3). Sistema visual e interacción derivados de «R860 Lab» (MIT).</p>`,
};
export function helpHTML(tab: string): string {
  return `<div class="help-tabs">${HELP_TABS.map(([k, l]) => `<button data-help-tab="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}</div>${HELP_TEXTS[tab] ?? HELP_TEXTS.start}`;
}
