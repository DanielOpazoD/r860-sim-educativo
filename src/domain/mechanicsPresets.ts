/** Valores de referencia fisiológicos para la mecánica del paciente (U-37): presets del panel docente. */
export interface TissuePreset {
  id: string;
  label: string;
  eVisc: number;
  tauViscS: number;
  note: string;
}
export const TISSUE_PRESETS: TissuePreset[] = [
  { id: 'none', label: 'Sin viscoelasticidad', eVisc: 0, tauViscS: 1.2, note: 'Compartimento puramente elástico (por omisión).' },
  {
    id: 'healthy',
    label: 'Adulto sano',
    eVisc: 3,
    tauViscS: 1.1,
    note: 'Sistema respiratorio total anestesiado-paralizado: E₂ ≈ 3 cmH₂O/L, τ₂ ≈ 1,1 s (D’Angelo 1989/1991, oclusión rápida a flujo constante; valores aproximados, P).',
  },
  {
    id: 'ards',
    label: 'Restrictivo / SDRA',
    eVisc: 9,
    tauViscS: 1.0,
    note: 'Viscoelasticidad 2–3× la sana: P1→P2 más ancho (P, orden de magnitud de las series con oclusión en LPA).',
  },
];
export interface TubePreset {
  id: string;
  label: string;
  r2: number;
}
/** K₂ inspiratorio del TET adulto por diámetro interno, cmH₂O/(L/s)² (Anaesth Intensive Care 2011;39:410, método de oclusión; D). El término lineal K₁ del tubo se considera incluido en la R del paciente (P). */
export const TUBE_PRESETS: TubePreset[] = [
  { id: 'none', label: 'Sin tubo (lineal)', r2: 0 },
  { id: 'id90', label: 'TET 9,0 mm', r2: 2.4 },
  { id: 'id85', label: 'TET 8,5 mm', r2: 3.1 },
  { id: 'id80', label: 'TET 8,0 mm', r2: 4.7 },
  { id: 'id75', label: 'TET 7,5 mm', r2: 6.0 },
  { id: 'id70', label: 'TET 7,0 mm', r2: 9.2 },
  { id: 'id65', label: 'TET 6,5 mm', r2: 12.8 },
];
