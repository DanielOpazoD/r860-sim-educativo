/**
 * Esquema docente de la auto-PEEP (CC-02): dos respiraciones en volumen control cuya espiración no termina, y un
 * bloqueo espiratorio que deja ver la PEEP total. Es un dibujo con números redondos, no una traza del motor: explica
 * qué buscar en la curva real y cómo leer la medición.
 */
import { DOCENTE as D } from '../render/monitorPalette';

const W = 880;
// Presión: 0–35 cmH₂O entre y 178 y 28. Flujo: −60…+60 L/min centrado en y 262.
const yP = (p: number): number => 178 - (p / 35) * 150;
const yF = (q: number): number => 262 - (q / 60) * 50;
const PEEPE = 5,
  PEEPTOT = 13,
  PPICO = 33;

/** Tramo espiratorio de flujo: cae desde `q0` hacia cero con constante `tauPx` y se corta en `x1`, sin llegar. */
function espiracion(x0: number, x1: number, q0: number, tauPx: number): string {
  let d = '';
  for (let x = x0; x <= x1; x += 4) d += ` L ${x} ${yF(q0 * Math.exp(-(x - x0) / tauPx)).toFixed(1)}`;
  return d;
}

export function autoPeepFigure(): string {
  // Respiración 1: inspiración 60–120, espiración 120–330. Respiración 2: 330–390, espiración 390–560.
  // Bloqueo espiratorio 560–740; al abrir las válvulas la presión vuelve a la PEEPe.
  const i1 = 60,
    e1 = 120,
    i2 = 330,
    e2 = 390,
    h0 = 560,
    h1 = 740,
    fin = 760;
  const tau = 120;
  const qIns = 45,
    qExp = -55;
  const flujo =
    `M ${i1 - 20} ${yF(0)} L ${i1} ${yF(0)} L ${i1} ${yF(qIns)} L ${e1} ${yF(qIns)} L ${e1} ${yF(qExp)}` +
    espiracion(e1, i2, qExp, tau) +
    ` L ${i2} ${yF(qIns)} L ${e2} ${yF(qIns)} L ${e2} ${yF(qExp)}` +
    espiracion(e2, h0, qExp, tau) +
    ` L ${h0} ${yF(0)} L ${fin} ${yF(0)}`;
  // Presión de la vía aérea: rampa en la inspiración y, con la válvula abierta, la PEEP programada al espirar.
  // En el bloqueo la presión sube hasta igualar la alveolar: la meseta es la PEEP total.
  let meseta = '';
  for (let x = h0; x <= h1; x += 4) meseta += ` L ${x} ${yP(PEEPTOT - (PEEPTOT - PEEPE) * Math.exp(-(x - h0) / 22)).toFixed(1)}`;
  const presion =
    `M ${i1 - 20} ${yP(PEEPE)} L ${i1} ${yP(PEEPE)} L ${i1} ${yP(PEEPE + 9)} L ${e1} ${yP(PPICO)} L ${e1 + 8} ${yP(PEEPE)}` +
    ` L ${i2} ${yP(PEEPE)} L ${i2} ${yP(PEEPE + 9)} L ${e2} ${yP(PPICO)} L ${e2 + 8} ${yP(PEEPE)} L ${h0} ${yP(PEEPE)}` +
    meseta +
    ` L ${h1 + 6} ${yP(PEEPE)} L ${fin} ${yP(PEEPE)}`;
  const texto = (x: number, y: number, t: string, color: string = D.texto, extra = ''): string =>
    `<text x="${x}" y="${y}" font-size="12" fill="${color}" ${extra}>${t}</text>`;
  const discontinua = (y: number, x0: number, x1: number, color: string): string =>
    `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${color}" stroke-width="1" stroke-dasharray="4 4" opacity=".8"/>`;
  const xLlave = h1 + 18;
  return (
    `<svg viewBox="0 0 ${W} 330" class="edu-svg" role="img" aria-label="Auto-PEEP: el flujo espiratorio no vuelve a cero antes de la siguiente inspiración; un bloqueo espiratorio al final de la espiración hace subir la presión de la vía aérea desde la PEEP programada hasta una meseta, la PEEP total. La diferencia es la PEEP intrínseca.">` +
    // Ventana del bloqueo, sobre las dos curvas.
    `<rect x="${h0}" y="18" width="${h1 - h0}" height="302" fill="${D.peepi}" opacity=".10"/>` +
    texto(h0 + 6, 14, 'Bloqueo espiratorio: válvulas cerradas', D.peepi, 'font-weight="600"') +
    // Ejes y rótulos de cada curva.
    texto(8, yP(30), 'Paw', D.formula) +
    texto(8, yF(40), 'Flujo', D.formula) +
    `<line x1="${i1 - 20}" y1="${yP(0)}" x2="${W - 10}" y2="${yP(0)}" stroke="${D.eje}" stroke-width="1"/>` +
    `<line x1="${i1 - 20}" y1="${yF(0)}" x2="${W - 10}" y2="${yF(0)}" stroke="${D.eje}" stroke-width="1"/>` +
    texto(W - 26, yF(0) - 4, '0', D.texto) +
    // Niveles de presión.
    discontinua(yP(PEEPE), i1 - 20, xLlave, D.peep) +
    discontinua(yP(PEEPTOT), h0, xLlave, D.peepi) +
    texto(150, yP(PEEPE) - 6, 'Válvula abierta: el manómetro marca la PEEP programada (PEEPe)', D.peep) +
    // Trazos.
    `<path d="${presion}" fill="none" stroke="${D.traza}" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<path d="${flujo}" fill="none" stroke="${D.elastica}" stroke-width="2.2" stroke-linejoin="round"/>` +
    // El flujo que no llega a cero: la señal en la curva.
    `<circle cx="${i2}" cy="${yF(qExp * Math.exp(-(i2 - e1) / tau))}" r="5" fill="none" stroke="${D.resistiva}" stroke-width="2"/>` +
    texto(i2 - 205, yF(0) - 8, 'No vuelve a 0: queda aire atrapado', D.resistiva, 'font-weight="600"') +
    `<line x1="${i2 - 12}" y1="${yF(0) - 4}" x2="${i2 - 3}" y2="${yF(qExp * Math.exp(-(i2 - e1) / tau)) - 5}" stroke="${D.resistiva}" stroke-width="1.2"/>` +
    texto(h0 + 6, yF(0) + 16, 'Sin flujo', D.texto) +
    // Llave de la PEEP intrínseca y lectura de la medición.
    `<path d="M ${xLlave} ${yP(PEEPTOT)} h 8 V ${yP(PEEPE)} h -8" fill="none" stroke="${D.peepi}" stroke-width="1.5"/>` +
    texto(xLlave + 12, yP(PEEPTOT) + 4, `PEEP total ${PEEPTOT}`, D.peepi, 'font-weight="600"') +
    texto(xLlave + 12, yP((PEEPTOT + PEEPE) / 2) + 4, `PEEPi ${PEEPTOT - PEEPE}`, D.peepi, 'font-weight="600"') +
    texto(xLlave + 12, yP(PEEPE) + 4, `PEEPe ${PEEPE}`, D.peep, 'font-weight="600"') +
    texto(h0 + 6, yP(PEEPTOT) - 8, 'la presión sube y se asienta: meseta', D.texto) +
    `</svg>`
  );
}
