/**
 * Versión de la física. Sube cada vez que cambia la huella del motor (HUE-01, tests/unit/huella.test.ts lo exige): así
 * una sesión guardada con la física anterior se reproduce con aviso y no en silencio con otra física (U-46).
 */
export const ENGINE_VERSION = '0.7.0';
/**
 * Versiones cuyas sesiones se aceptan con aviso: se reproducen con la física de hoy, que puede diferir de la que las
 * grabó; los ajustes que faltan toman el valor por omisión.
 */
export const ACCEPTED_ENGINE_VERSIONS = ['0.2.0', '0.3.0', '0.4.0', '0.7.0'];
export const SESSION_SCHEMA_VERSION = '1.0.0';
