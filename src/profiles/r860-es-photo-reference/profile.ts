import labels from './labels.es.json';

export const PROFILE = {
  profileId: 'r860-es-photo-reference-v1',
  profileVersion: '1.0.0',
  deviceReference: 'GE Healthcare CARESCAPE R860 (referencia de inspiración; sin aval del fabricante)',
  firmwareOfPhotographedUnit: null as string | null,
  locale: 'es-CL',
  visualEvidence: ['P1', 'P2', 'P3'],
  manualBaselines: ['JB77395XX QRG 2020 (leída)', 'JB23840CO ficha 2014 (leída)', 'JB79437XX troubleshooting 2020 (leída)', 'JB72469XX modos invasivos ES 2020 (leída)', '2065492-001 QRG SW10 (sólo vía dossier)', '2065490-001 URM SW10 (sólo vía dossier)'],
  mergeVersionsSilently: false,
  clinicalUse: false,
  unknownFeaturePolicy: 'disabled_with_reason',
  patientType: 'adult' as const,
  enabledModes: ['AC_VC'] as const,
  /** Marca permanente exigida por el mandato. */
  banner: 'SIMULACIÓN EDUCATIVA · NO USO CLÍNICO',
  /** Plazo de cancelación de borrador (ms). U-07: valor PROPUESTO, no GE. */
  editTimeoutMs: 20_000,
  /** Pausa de audio (ms). D: tecla «2-minute audio pause» (QRG 2020 p.4). */
  audioPauseMs: 120_000,
  /** Duración de ↑O2 (ms). D: «2-minute countdown timer» (QRG 2020 p.12). */
  increaseO2Ms: 120_000,
  /** Incremento por defecto de ↑O2 adulto. D: «+100% for adults» (QRG 2020 p.12). */
  increaseO2DeltaFraction: 1.0,
  labels,
} as const;

export type Profile = typeof PROFILE;
