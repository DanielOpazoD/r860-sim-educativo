import { EngineHost } from '../app/engineHost';
import type { EngineToMain, MainToEngine } from '../app/protocol';

const ctx = self as unknown as { postMessage(m: EngineToMain): void; onmessage: ((e: MessageEvent<MainToEngine>) => void) | null };
const host = new EngineHost((m) => ctx.postMessage(m));
ctx.onmessage = (e: MessageEvent<MainToEngine>) => host.handle(e.data);
ctx.postMessage({ type: 'ready' });
