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

/**
 * @param {string} [wsUrl]  a specific page's debugger address; by default, the gamemaster's Foundry page
 * @returns {Promise<{ send: Function, ev: (expr: string) => Promise<any>, close: () => void }>}
 */
export async function connect(wsUrl) {
  let url = wsUrl;
  if (!url) {
    const page = (await getJson('/json/list')).find((t) => t.type === 'page' && t.url.includes('foundryvtt'));
    if (!page) throw new Error('no Foundry page on the debugger');
    url = page.webSocketDebuggerUrl;
  }
  const ws = new WebSocket(url, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 });
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
 * Browsers hold audio until a user gesture. Two layers, both measured 2026-09-24 on 14.368 in headless Chrome:
 *
 * 1. Foundry's own lock: a trusted Shift press through the debugger sets game.audio.locked false.
 * 2. 🚨 THE AUDIO CONTEXTS: on a freshly loaded page they stay "suspended" after that - a modifier key is not a
 *    user activation to Chrome, and Foundry, now believing itself unlocked, never tries again. The first probe
 *    run looked fine only because an earlier trusted click had already activated the page. Measured: Shift ->
 *    still suspended; a plain click on a window title -> still suspended; a click whose pointerdown handler calls
 *    context.resume() -> "running" on all three channels.
 *
 * So: press Shift, then - if any context is not running - arm a one-shot pointerdown listener that resumes them,
 * and click somewhere that does nothing (a window's title text, else the middle of the canvas).
 */
export async function unlockAudio({ send, ev }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const running = async () =>
    ev(`['music', 'environment', 'interface'].every((k) => game.audio[k]?.state === 'running') && !game.audio.locked`);
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
  }
  await wait(500);
  if (await running()) return true;
  const pt = JSON.parse(
    await ev(`(() => {
      document.addEventListener('pointerdown', () => {
        for (const k of ['music', 'environment', 'interface']) game.audio[k]?.resume();
      }, { once: true, capture: true });
      const title = document.querySelector('.window-title');
      if (title) { const r = title.getBoundingClientRect(); return JSON.stringify({ x: r.x + 10, y: r.y + r.height / 2 }); }
      return JSON.stringify({ x: innerWidth / 2, y: innerHeight / 2 });
    })()`),
  );
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', {
      type,
      x: Math.round(pt.x),
      y: Math.round(pt.y),
      button: 'left',
      clickCount: 1,
    });
  }
  for (let i = 0; i < 10 && !(await running()); i++) await wait(200);
  return running();
}
