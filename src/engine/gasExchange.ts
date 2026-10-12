import type { GasExchangeParams } from '../domain/types';

/**
 * Gasometría de modelo (P): CO₂ arterial y pH de un adulto virtual, para la docencia. No es un valor del monitor:
 * el equipo real no mide PaCO₂ y esta cifra nunca entra en la columna numérica.
 *
 * Balance de masa de un solo depósito de CO₂ equivalente:
 *   C · dPaCO₂/dt = 0,863 · VCO₂ − V̇A · PaCO₂
 * La producción entra de forma continua; cada respiración retira su volumen alveolar (VT pulmonar − VD) con la
 * concentración alveolar del momento. En equilibrio queda la ecuación de la ventilación alveolar,
 * PaCO₂ = 0,863 · VCO₂ / V̇A (D), con VCO₂ en mL/min STPD y V̇A en L/min BTPS. La constante de tiempo τ = C / V̇A
 * sale del modelo: más lenta cuanto menor es la ventilación, y en apnea la PaCO₂ sube 0,863 · VCO₂ / C mmHg/min.
 * pH por Henderson-Hasselbalch con el bicarbonato fijo del escenario; sin tamponamiento agudo (simplificación
 * declarada: con PaCO₂ 60 el pH sale ≈ 0,035 por debajo del que daría la regla de +1 mEq/L de HCO₃⁻ por cada 10 mmHg).
 */
export const DEFAULT_GAS: GasExchangeParams = {
  /** Producción de CO₂ de un adulto en reposo (mL/min STPD), P. */
  vco2MlMin: 200,
  /** Espacio muerto en serie: anatómico más el de la pieza en Y (L), P. */
  deadspaceL: 0.15,
  /** Bicarbonato plasmático (mEq/L): el componente metabólico, fijo durante la sesión. */
  hco3: 24,
  /**
   * Capacidad del depósito de CO₂ (L equivalentes). Elegida para que la apnea suba ≈ 4 mmHg/min y una variación de la
   * ventilación tarde ≈ 8 min en recorrer el 63 % (V̇A 5 L/min): la gasometría de control se pide a los 20–30 min. P.
   */
  storeL: 40,
};

/** Constante de la ecuación de la ventilación alveolar: (PB − PH₂O) · 273/310 / 1000 con PB 760 mmHg. D. */
export const ALVEOLAR_K = 0.863;
/** Solubilidad del CO₂ en plasma (mmol/L por mmHg) y pK del par bicarbonato/CO₂ a 37 °C. D. */
export const CO2_SOLUBILITY = 0.03;
export const PK_BICARBONATE = 6.1;

export const gasParams = (p: Partial<GasExchangeParams> | undefined): GasExchangeParams => ({ ...DEFAULT_GAS, ...p });

/** Volumen alveolar de una respiración: lo que el pulmón espiró menos el espacio muerto; nunca negativo. */
export const alveolarVolumeL = (lungExpiredL: number, deadspaceL: number): number => Math.max(0, lungExpiredL - deadspaceL);

/** PaCO₂ de equilibrio para una ventilación alveolar (mmHg), o null si no hay ventilación alveolar. */
export function steadyPaco2(vco2MlMin: number, vaLMin: number): number | null {
  return vaLMin > 0 ? (ALVEOLAR_K * vco2MlMin) / vaLMin : null;
}

/** pH arterial por Henderson-Hasselbalch. */
export function phFrom(hco3: number, paco2: number): number {
  return PK_BICARBONATE + Math.log10(hco3 / (CO2_SOLUBILITY * paco2));
}

interface AlveolarBreath {
  startS: number;
  endS: number;
  vaL: number;
}

/** Antigüedad máxima de las respiraciones que cuentan para la V̇A actual (s). */
const VA_WINDOW_S = 60;
/**
 * Con PaCO₂ inicial de equilibrio, éste se fija con la ventilación de los primeros segundos y no sólo con la primera
 * respiración: si hay atrapamiento, el volumen espirado tarda varios ciclos en estabilizarse y la primera respiración
 * daba un equilibrio que no era el de la ventilación programada (P).
 */
export const EQUILIBRIUM_WINDOW_S = 20;

export interface GasState {
  paco2: number;
  ph: number;
  hco3: number;
  /** Ventilación alveolar actual (L/min; últimas respiraciones), o null antes de completar una respiración. */
  vaLMin: number | null;
  /** Fracción de espacio muerto de la última respiración (VD/VT pulmonar), o null sin respiración. */
  vdVt: number | null;
  /** PaCO₂ hacia la que tiende con la ventilación actual, o null sin ventilación alveolar. */
  paco2Target: number | null;
  /** Constante de tiempo de esa aproximación (min), o null sin ventilación alveolar. */
  tauMin: number | null;
}

/**
 * Estado del CO₂. Determinista: sólo depende del volumen pulmonar que el simulador le entrega, así que una sesión
 * reproducida da la misma gasometría. No realimenta la mecánica.
 */
export class GasExchange {
  paco2: number;
  private breaths: AlveolarBreath[] = [];
  private lastVdVt: number | null = null;
  /** Con PaCO₂ inicial 'equilibrium', las respiraciones de los primeros EQUILIBRIUM_WINDOW_S fijan el equilibrio. */
  private pendingEquilibrium: boolean;

  constructor(initialPaco2: number | 'equilibrium' = 'equilibrium') {
    this.pendingEquilibrium = initialPaco2 === 'equilibrium';
    this.paco2 = initialPaco2 === 'equilibrium' ? 40 : initialPaco2;
  }

  /** Producción continua de CO₂ durante `dtS`. */
  step(dtS: number, p: GasExchangeParams): void {
    this.paco2 += (ALVEOLAR_K * p.vco2MlMin * (dtS / 60)) / p.storeL;
  }

  /** Fin de una respiración: retira el CO₂ de su volumen alveolar. */
  onBreath(endS: number, durationS: number, lungExpiredL: number, p: GasExchangeParams): void {
    const vaL = alveolarVolumeL(lungExpiredL, p.deadspaceL);
    this.lastVdVt = lungExpiredL > 0 ? Math.min(1, p.deadspaceL / lungExpiredL) : null;
    this.breaths.push({ startS: endS - durationS, endS, vaL });
    while (this.breaths.length && this.breaths[0]!.endS < endS - VA_WINDOW_S) this.breaths.shift();
    if (this.pendingEquilibrium) {
      if (endS >= EQUILIBRIUM_WINDOW_S) this.pendingEquilibrium = false;
      // La V̇A de las últimas respiraciones (el atrapamiento ya asentado), o de la primera si es la única.
      const va = this.vaLMin(endS);
      const target = va === null ? null : steadyPaco2(p.vco2MlMin, va);
      if (target !== null) {
        this.paco2 = target;
        return;
      }
    }
    // Exacto para el lavado de una fracción vaL/C del depósito: nunca deja la PaCO₂ negativa.
    this.paco2 *= Math.exp(-vaL / p.storeL);
  }

  /**
   * V̇A actual: el volumen alveolar de las últimas respiraciones (hasta tres, terminadas en el último minuto) sobre el
   * tiempo que cubren. Responde en pocas respiraciones a un cambio de programación —el equilibrio que se muestra y se
   * evalúa es el de la ventilación de ahora, no un promedio con la anterior— y una ventilación regular da exactamente
   * (VT − VD)·FR sin depender de la fase. Una respiración en curso no cuenta como pausa; si pasa más de un ciclo medio
   * sin respiraciones (apnea), ese tiempo sí cuenta y la V̇A cae hasta 0 cuando la última sale del minuto.
   */
  vaLMin(nowS: number): number | null {
    if (!this.breaths.length) return null;
    const recientes = this.breaths.filter((b) => b.endS >= nowS - VA_WINDOW_S).slice(-3);
    if (!recientes.length) return 0;
    const desde = recientes[0]!.startS,
      cubierto = recientes.at(-1)!.endS - desde,
      cicloMedio = cubierto / recientes.length;
    const span = Math.max(cubierto, nowS - desde - cicloMedio);
    return span > 0 ? (recientes.reduce((s, b) => s + b.vaL, 0) * 60) / span : null;
  }

  state(nowS: number, p: GasExchangeParams): GasState {
    const va = this.vaLMin(nowS);
    return {
      paco2: this.paco2,
      ph: phFrom(p.hco3, this.paco2),
      hco3: p.hco3,
      vaLMin: va,
      vdVt: this.lastVdVt,
      paco2Target: va === null ? null : steadyPaco2(p.vco2MlMin, va),
      tauMin: va !== null && va > 0 ? p.storeL / va : null,
    };
  }
}
