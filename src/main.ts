import { startApp } from './ui/app';
/**
 * Parámetros de URL (reproducibilidad): fixture=P1|P3 · t0=ISO · seed=n · dt=ms · speed=x · paused=1 · autopause=ms ·
 * scenario=SC-01 · view=waves|basic|loops|data|trends|log · instructor=0 · inline=1 · editTimeout=ms (sólo pruebas).
 */
startApp({ params: new URLSearchParams(location.search) });
