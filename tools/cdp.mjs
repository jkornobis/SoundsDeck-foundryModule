/**
 * The one connection every live tool here uses: Chrome's debugger on port 9222, driving the world's gamemaster
 * session. (FoundryVTT-KnowledgeDB, Foundry-Server/knowledge/driving-foundry-headless.md.)
 */
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire('/usr/share/nodejs/');
const WebSocket = require('ws');

const getJson = (p) =>
  new Promise((res, rej) =>
    http
      .get({ host: '127.0.0.1', port: 9222, path: p }, (r) => {
        let b = '';
        r.on('data', (d) => {
          b += d;
        });
        r.on('end', () => res(JSON.parse(b)));
      })
      .on('error', rej),
  );

/** @returns {Promise<{ send: Function, ev: (expr: string) => Promise<any>, close: () => void }>} */
export async function connect() {
  const page = (await getJson('/json/list')).find((t) => t.type === 'page' && t.url.includes('foundryvtt'));
  if (!page) throw new Error('no Foundry page on the debugger');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 });
  let seq = 0;
  const pending = new Map();
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (!pending.has(m.id)) return;
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  });
  await new Promise((r) => ws.on('open', r));
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const n = ++seq;
      pending.set(n, { res, rej });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description).slice(0, 600));
    return r.result?.value;
  };
  return { send, ev, close: () => ws.close() };
}

/**
 * Browsers hold audio until a user gesture. A trusted Shift press through the debugger is that gesture, and it does
 * nothing else. Measured 2026-09-24: game.audio.locked true -> false, the three channels "running" at 44.1 kHz.
 */
export async function unlockAudio({ send, ev }) {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', {
      type,
      key: 'Shift',
      code: 'ShiftLeft',
      windowsVirtualKeyCode: 16,
      modifiers: type === 'keyDown' ? 8 : 0,
    });
  }
  for (let i = 0; i < 20 && (await ev('game.audio.locked')); i++) await new Promise((r) => setTimeout(r, 200));
  return !(await ev('game.audio.locked'));
}
