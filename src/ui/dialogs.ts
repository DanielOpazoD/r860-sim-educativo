/** Plantillas HTML de los diálogos (puras: reciben datos, devuelven texto). El estado y la apertura viven en app.ts. */
import type { SettingRule } from '../domain/settingRules';
import type { SettingsKey } from '../domain/types';
import type { EngineFrame } from '../engine/simulator';
import { DEFAULT_PROFILE } from '../profiles';
import type { Scenario } from '../scenarios';
import { CLINICAL_CASES } from '../scenarios/cases';
import type { CaseResult } from './caseEvaluation';
import { esc, icon } from './dom';
import { clock, unitText } from './format';
import { eventSentence } from './humanize';
import { displaySetting, modeLabel as etiquetaModo, QUICK_LABEL } from './labels';

export const MENU_ENTRIES: [string, string, string, string][] = [
  ['modes', 'wave', 'Modo y ajustes', 'Volumen, límites de presión y sincronización'],
  ['alarmSetup', 'bell', 'Alarmas', 'Límites y condiciones activas'],
  ['tools', 'lung', 'Mecánica y procedimientos', 'Bloqueos y mediciones'],
  ['patient', 'person', 'Adulto virtual', 'Perfil sintético'],
];
export const menuHTML = (): string =>
  `<div class="menu-grid">${MENU_ENTRIES.map(
    ([a, i, l, d]) =>
      `<button class="menu-entry" data-action="${a}">${icon(i)}<span><b>${l}</b><small>${d}</small></span>${icon('arrow')}</button>`,
  ).join('')}</div>`;

export const welcomeHTML = (): string =>
  `<p class="welcome-intro">Un ventilador virtual para aprender mecánica respiratoria sin riesgo.</p><div class="scenario-grid welcome-choices"><button class="scenario-card welcome-choice" id="welcome-free" data-action="welcome-free"><h3>Explorar libremente</h3><p>Banco pasivo con todos los mandos a tu alcance.</p></button><button class="scenario-card welcome-choice" id="welcome-guided" data-action="welcome-guided"><h3>Casos clínicos</h3><p>Ocho casos con viñeta, para resolver en el ventilador.</p></button></div><p class="welcome-footnote">Simulador educativo: no es un equipo clínico ni usa datos de pacientes.</p>`;

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
    ['exportDebrief', 'book', 'Resumen de práctica TXT', 'Caso, resultado, ajustes y últimos eventos.'],
  ];
  return `<p class="dialog-lead">Los archivos contienen exclusivamente el escenario virtual y sus acciones. Todo se procesa en este navegador; no hay servidor ni telemetría.</p><div class="session-actions">${entries
    .map(
      ([a, i, l, d]) =>
        `<button class="menu-entry" data-action="${a}">${icon(i as string)}<span><b>${l}</b><small>${d}</small></span></button>`,
    )
    .join(
      '',
    )}</div><div class="session-facts"><span>Escenario: <b>${esc(scenarioName)}</b></span><span>Tiempo: <b>${clock(simS)}</b></span><span>Motor ${engineVersion} · perfil ${profileVersion}</span></div><button class="prefs-reset" data-action="resetPrefs">Restablecer preferencias</button>`;
}

export const patientHTML = (): string =>
  `<p class="dialog-lead">Perfil sintético de referencia (ID SIM-0001). No introduzcas información de personas reales.</p><div class="info-box">Población adulta · A/C VC, A/C PC y CPAP/PS · sin talla ni peso.</div><p class="settings-annotation">No implementa perfiles pediátricos o neonatales ni humidificador.</p>`;

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

export interface DebriefInput {
  scenario: Scenario;
  simS: number;
  /** Resultado del caso clínico, si se entregó. */
  result: CaseResult | null;
}
function resultadoTexto(d: DebriefInput): string {
  const c = d.scenario.clinical;
  if (!c) return 'Exploración libre (sin caso clínico).';
  if (!d.result) return `Caso ${d.scenario.id} · ${c.theme}: sin entregar.`;
  const marca = (ok: boolean | undefined): string => (ok ? '[Cumplido]' : '[No cumplido]');
  const lineas = c.criteria.map((cr) => `${marca(d.result!.criteria.find((x) => x.id === cr.id)?.ok)} ${cr.text}`);
  const answer = d.result.answer;
  if (answer) {
    const texto = c.options?.find((o) => o.id === answer.id)?.text ?? answer.id;
    lineas.push(`${marca(answer.ok)} Respuesta elegida: ${texto}`);
  }
  return `Caso ${d.scenario.id} · ${c.theme}: ${d.result.passed ? 'resuelto' : 'entregado, por revisar'}.\n${lineas.join('\n')}`;
}
/** Ajustes vigentes en unidades clínicas, con el rótulo de su tecla y coma decimal (es texto, no el monitor). */
function ajustesTexto(fr: EngineFrame, rules: Record<SettingsKey, SettingRule>): string {
  return (Object.keys(QUICK_LABEL) as SettingsKey[])
    .filter((k) => k in fr.settings && rules[k])
    .map((k) => {
      const v = fr.settings[k];
      const texto = displaySetting(rules, k, v).replace('.', ',');
      const unidad = typeof v === 'number' && k !== 'ie' ? unitText(rules[k].displayUnit) : '';
      return `${QUICK_LABEL[k]}: ${unidad ? `${texto} ${unidad}` : texto}`;
    })
    .join('\n');
}
/** `rules`: reglas del perfil en uso (escala y unidad de cada ajuste). */
export function debriefText(d: DebriefInput, fr: EngineFrame, rules: Record<SettingsKey, SettingRule> = DEFAULT_PROFILE.rules): string {
  const eventos = fr.eventsTail.map((e) => `${clock(e.simTimeMs / 1000)} ${eventSentence(e, rules)}`).join('\n');
  return `VENTILA LAB · RESUMEN DE PRÁCTICA\nSIMULACIÓN EDUCATIVA · NO USO CLÍNICO\n\nEscenario: ${d.scenario.name}\nLímites: ${d.scenario.caution}\nTiempo simulado: ${clock(d.simS)}\nModo: ${etiquetaModo(fr.settings.mode)}\n\n${resultadoTexto(d)}\n\nAJUSTES\n${ajustesTexto(fr, rules)}\n\nMODELO SINTÉTICO\n${JSON.stringify(fr.truth.patient, null, 2)}\n\nÚLTIMOS EVENTOS (${fr.eventsTail.length})\n${eventos}\n\nNo evalúa competencia clínica ni seguridad de ventilación en pacientes.\n`;
}

const pubmed = (pmid: string): string => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
const busqueda = (termino: string): string => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(termino)}`;
/** Las que cita la ayuda del modelo (help.ts), con lo que sostiene cada una. */
const FUENTES_DEL_MODELO: [string, string, string][] = [
  ["D'Angelo, J Appl Physiol 1989", 'Viscoelasticidad del sistema respiratorio.', pubmed('2606863')],
  [
    "D'Angelo, J Appl Physiol 1991",
    'Mecánica de pulmón y pared torácica.',
    busqueda("D'Angelo 1991 pulmonary and chest wall mechanics anesthetized paralyzed humans"),
  ],
  ['Anaesth Intensive Care 2011;39:410', 'K₂ del tubo endotraqueal por diámetro.', busqueda('Anaesth Intensive Care 2011 39 410')],
  ['Akoumianaki, Chest 2013', 'Disparo reverso.', pubmed('23187649')],
  ['Baedorf Kassis, Am J Respir Crit Care Med 2021', 'Fenotipos y latencia del disparo reverso.', pubmed('32809842')],
  ['Pinède, Respir Care 2021', 'Rama y válvula espiratorias de ventiladores de UCI (banco).', pubmed('33144385')],
  [
    'Gattinoni, Intensive Care Med 2016',
    'Potencia mecánica.',
    busqueda('Gattinoni 2016 ventilator-related causes of lung injury mechanical power'),
  ],
];
/** Las de los casos clínicos, sin repetir, con los casos que las citan. */
function fuentesDeLosCasos(): [string, string, string][] {
  const porUrl = new Map<string, { short: string; casos: string[] }>();
  for (const c of CLINICAL_CASES)
    for (const r of c.clinical?.references ?? []) {
      const f = porUrl.get(r.url) ?? { short: r.short, casos: [] };
      f.casos.push(c.id);
      porUrl.set(r.url, f);
    }
  return [...porUrl].map(([url, f]) => [f.short, `${f.casos.length === 1 ? 'Caso' : 'Casos'} ${f.casos.join(', ')}.`, url]);
}
/** Referencias de fisiología y mecánica que sostienen el modelo, la ayuda y los casos. */
export const SOURCES: [string, string, string][] = [...FUENTES_DEL_MODELO, ...fuentesDeLosCasos()];
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
  ['H', 'Volver a Curvas y datos'],
  ['?', 'Abrir esta guía'],
  ['↑ / ↓', 'Cambiar el parámetro seleccionado'],
  ['Enter', 'Confirmar un ajuste rápido'],
  ['Esc', 'Cancelar ajuste o cerrar ventana'],
  ['Rueda sobre perilla', 'Modificar el parámetro seleccionado'],
];
const HELP_TEXTS: Record<string, string> = {
  start: `<p class="dialog-lead">Un ventilador virtual para explorar la relación entre lo que ajustas, lo que hace el pulmón sintético y lo que muestra el monitor.</p><div class="help-list"><div><b>01 · Ventila</b><p>La sesión ya está ventilando. Selecciona un parámetro de la barra inferior. Ajusta con el deslizador, el número, las flechas o la perilla y <b>confirma</b>. Cancelar conserva el valor previo. El cambio se aplica en la próxima respiración.</p></div><div><b>02 · Cambia el pulmón</b><p>En el panel lateral, «Paciente» ofrece perfiles rápidos, controla C, R y esfuerzo, y provoca eventos (apnea, oclusión, fuga, desconexión) que «Deshacer» revierte, también durante un caso. «Mecánica avanzada» y «Datos del modelo» se abren al costado de la barra. Estos cambios actúan sobre el modelo, no sobre los ajustes del equipo. Arriba, la gasometría del modelo muestra la PaCO₂ y el pH de ahora y del inicio.</p></div><div><b>03 · Mide y compara</b><p>Bloqueo insp/esp abre la maniobra; pulsa ▶ para solicitarla. El motor espera una fase elegible. Revisa el resultado, su validez y su hora. En Bucles, guarda un ciclo de referencia.</p></div><div><b>04 · Resuelve casos</b><p>En «Casos», elige un caso clínico: el panel dice qué lograr y cómo se evalúa. Resuélvelo en el ventilador y pulsa Entregar. Bajo el equipo, con scroll, están el desarrollo del caso y el Aula (Fundamentos y Reflexión). El modo examen está en el menú «…». Guarda JSON para reproducir y CSV/PNG para analizar. No hay subida de archivos a internet.</p></div></div><div class="info-box"><b>Tres acciones distintas:</b> Pausar detiene el reloj; Congelar curvas conserva una imagen mientras el motor sigue; En espera suspende la ventilación virtual. Al ocultar la pestaña se pausa la simulación y se reanuda manualmente.</div>`,
  model: `<p class="dialog-lead">Mecánica consistente, alcance explícitamente limitado.</p><div class="equation">Pva + Pmus = V / C + R × Q<br>τesp = (Rexp + Rrama) × C</div><p>Pulmón de una o dos unidades con resistencias inspiratoria y espiratoria (más Rohrer, viscoelasticidad, curva P-V sigmoidea, reclutamiento y colapso espiratorio opcionales); esfuerzo muscular; sensor de O₂ con retardo. Paso fijo de 4 ms.</p><p><b>Modos:</b> A/C VC, A/C PC y CPAP/PS adulto. En VC, Plimit sostiene la presión el resto de la inspiración y Pmáx la termina; en PC y en soporte la presión es la consigna; en CPAP/PS el paciente dispara y el flujo cicla, con frecuencia mínima, apnea y respaldo. Otros modos se incorporarán sólo tras sus pruebas de banco.</p><p><b>Mediciones estáticas:</b> una meseta perturbada, Pmáx, duración insuficiente o cancelación invalidan una maniobra; el resultado conserva su hora y su motivo. FR y VMesp se promedian sobre el último minuto más una respiración, como en el equipo.</p><p><b>Gasometría de modelo:</b> PaCO₂ y pH salen de la ventilación alveolar del pulmón (panel lateral y Aula · Fundamentos · Ventilación); el equipo no los muestra. El equilibrio es el de un paciente, pero se alcanza ≈ 10 veces más rápido para no esperar 20–30 minutos.</p><div class="notice-box"><b>No modela:</b> oxigenación, SpO₂ ni hemodinámica; la fuga se modela en la pieza en Y, sin compensación. FiO₂ cambia su sensor virtual, no una saturación inventada. No predice respuestas de pacientes ni controla equipos.</div><p>Cada regla lleva su marca de evidencia (documentado / observado / propuesto / no resuelto) en los archivos evidence.json y gaps.json del proyecto.</p>`,
  keys: `<table class="info-table"><tbody>${KEYS.map(
    ([k, d]) => `<tr><td><kbd class="keyboard-key">${k}</kbd></td><td>${d}</td></tr>`,
  ).join(
    '',
  )}</tbody></table><div class="info-box">El audio está apagado inicialmente. Actívalo en el menú «…» › Audio de alarmas. Los tonos son sintéticos. La pausa de audio dura 120 segundos del reloj simulado.</div>`,
  sources: `<p class="dialog-lead">Fuentes primarias consultadas; se abren en internet sólo al seleccionarlas. El funcionamiento del simulador es completamente local.</p>${SOURCES.map(
    ([title, desc, url]) =>
      `<div class="source-entry"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)} ${icon('arrow')}</a><p>${esc(desc)}</p></div>`,
  ).join(
    '',
  )}<p>Las reglas del equipo virtual se basan en documentación técnica pública de un ventilador de UCI adulto; cada una lleva su marca de evidencia en evidence.json del repositorio. Partes del sistema visual derivan de un proyecto previo con licencia MIT (aviso completo en LICENSES/).</p>`,
};
export function helpHTML(tab: string): string {
  return `<div class="help-tabs">${HELP_TABS.map(([k, l]) => `<button data-help-tab="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}</div>${HELP_TEXTS[tab] ?? HELP_TEXTS.start}`;
}
