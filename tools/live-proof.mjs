#!/usr/bin/env node
/**
 * Prove the module inside a RUNNING world without installing it.
 *
 *   node tools/live-proof.mjs
 *
 * WHY THIS EXISTS: a module with code cannot be side-loaded through Foundry's File Picker (.js, .mjs and .css are
 * not uploadable - measured 2026-09-22), and installing from a manifest needs a release Foundry can reach. So the
 * proof goes the other way: this script loads src/ into the gamemaster's page as ES modules (blob URLs), calls the
 * same setup functions the entry point calls, drives the window through its real buttons, and MEASURES.
 *
 * WHERE IT RUNS: on the machine that drives the world's gamemaster session through Chrome's debugger on port 9222
 * (FoundryVTT-KnowledgeDB, Foundry-Server/knowledge/driving-foundry-headless.md). Nothing is written to disk on the
 * server; a page reload removes every trace.
 *
 * 🚨 IT PLAYS AND ACTIVATES SCENES, and both are persisted and broadcast: anyone connected would hear the beds and
 * be moved between scenes. So it REFUSES if anyone but the gamemaster is connected or anything is already playing,
 * and it leaves the world as it found it - quiet, on the scene that was active.
 */
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire('/usr/share/nodejs/');
const WebSocket = require('ws');

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const FILES = [
  'src/core/classify.mjs',
  'src/core/scene-bed.mjs',
  'src/core/beds.mjs',
  'src/foundry/scene-bed-fix.mjs',
  'src/foundry/deck-app.mjs',
  'src/foundry/setup.mjs',
];
// The scenes the Delta Green world binds to 8 · The Board, and its quiet doorway (knowledge repo, scene-beds.mjs).
const DOORWAY = 'Opening Dashboard';
const BOARD_SCENES = ['Investigation Desk', 'Shotgun Board'];

// Each relative import becomes a placeholder the page swaps for the blob URL of the file it names.
async function modules() {
  const out = [];
  for (const file of FILES) {
    let src = await readFile(path.join(ROOT, file), 'utf8');
    src = src.replace(/from '(\.{1,2}\/[^']+)'/g, (_m, spec) => {
      const target = path.posix.join(path.posix.dirname(file), spec);
      if (!FILES.includes(target)) throw new Error(`${file} imports ${target}, which is not in FILES`);
      return `from '__MOD__${target}__'`;
    });
    out.push([file, src]);
  }
  return out;
}

const get = (p) =>
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
const page = (await get('/json/list')).find((t) => t.type === 'page' && t.url.includes('foundryvtt'));
if (!page) {
  console.error('no Foundry page on the debugger');
  process.exit(2);
}
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 });
let seq = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const n = ++seq;
    pending.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
ws.on('message', (d) => {
  const m = JSON.parse(d);
  if (!pending.has(m.id)) return;
  const { res, rej } = pending.get(m.id);
  pending.delete(m.id);
  m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
});
await new Promise((r) => ws.on('open', r));
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description).slice(0, 600));
  return r.result?.value;
};

const payload = {
  mods: await modules(),
  template: await readFile(path.join(ROOT, 'templates/beds.hbs'), 'utf8'),
  lang: JSON.parse(await readFile(path.join(ROOT, 'lang/fr.json'), 'utf8')),
  css: await readFile(path.join(ROOT, 'styles/sounds-deck.css'), 'utf8'),
  DOORWAY,
  BOARD_SCENES,
};

// --show FILE.png: load the module, open the deck, photograph it, close it. Plays nothing and activates nothing,
// so it needs no guard beyond a gamemaster session - it is how the Composer sees the deck without installing it.
const SHOW = process.argv.includes('--show') ? process.argv[process.argv.indexOf('--show') + 1] : null;
if (SHOW) {
  const opened = await ev(`(async () => {
    const P = ${JSON.stringify(payload)};
    const urls = {};
    for (const [file, src] of P.mods) urls[file] = URL.createObjectURL(new Blob([src.replace(/__MOD__(.+?)__/g, (_m, f) => urls[f])], { type: 'text/javascript' }));
    const setup = await import(urls['src/foundry/setup.mjs']);
    const { TEMPLATE_BEDS } = await import(urls['src/foundry/deck-app.mjs']);
    Handlebars.registerPartial(TEMPLATE_BEDS, Handlebars.compile(P.template, { preventIndent: true }));
    foundry.utils.mergeObject(game.i18n.translations, P.lang);
    document.head.append(Object.assign(document.createElement('style'), { id: 'sounds-deck-proof', textContent: P.css }));
    const app = setup.openDeck();
    for (let i = 0; i < 30 && !app.rendered; i++) await new Promise((r) => setTimeout(r, 200));
    await new Promise((r) => setTimeout(r, 600));
    globalThis.__soundsDeckShow = app;
    const b = app.element.getBoundingClientRect();
    return JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height });
  })()`);
  const clip = { ...JSON.parse(opened), scale: 1 };
  const shot = await send('Page.captureScreenshot', { format: 'png', clip });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(SHOW, Buffer.from(shot.data, 'base64'));
  await ev(
    `(async () => { await globalThis.__soundsDeckShow?.close(); delete globalThis.__soundsDeckShow; document.getElementById('sounds-deck-proof')?.remove(); return 'closed'; })()`,
  );
  console.log('wrote', SHOW);
  ws.close();
  process.exit(0);
}

const report = await ev(`(async () => {
  const P = ${JSON.stringify(payload)};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 6000) => { for (let t = 0; t < ms; t += 200) { if (await fn()) return true; await wait(200); } return false; };
  const R = { checks: [] };
  const check = (name, ok, detail) => R.checks.push({ ok: !!ok, name, ...(detail === undefined ? {} : { detail }) });

  // ---- guards
  if (!game.user.isGM) return JSON.stringify({ refused: 'not a gamemaster session' });
  const others = game.users.filter((u) => u.active && u.id !== game.user.id).map((u) => u.name);
  const playingBefore = game.playlists.filter((p) => p.playing).map((p) => p.name);
  if (others.length || playingBefore.length) return JSON.stringify({ refused: { connected: others, playing: playingBefore } });
  const activeBefore = game.scenes.active;

  // ---- load src/ as modules
  const urls = {};
  let api;
  for (const [file, src] of P.mods) {
    const code = src.replace(/__MOD__(.+?)__/g, (_m, f) => urls[f]);
    urls[file] = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }
  const setup = await import(urls['src/foundry/setup.mjs']);
  const { TEMPLATE_BEDS } = await import(urls['src/foundry/deck-app.mjs']);
  Handlebars.registerPartial(TEMPLATE_BEDS, Handlebars.compile(P.template, { preventIndent: true }));
  foundry.utils.mergeObject(game.i18n.translations, P.lang);
  const style = Object.assign(document.createElement('style'), { id: 'sounds-deck-proof', textContent: P.css });
  document.head.append(style);

  const Playlists = foundry.documents.collections.Playlists;
  const originalMethod = Playlists.prototype._onChangeScene;
  let app;
  const hookId = Hooks.on('renderPlaylistDirectory', setup.onRenderPlaylistDirectory);
  try {
    setup.onInit();
    api = setup.onReady();
    check('scene fix installs on 14.368 (the defect is present)', api.sceneFix?.installed, api.sceneFix?.reason);

    // ---- the window
    app = api.open();
    await until(() => app.rendered && app.element.querySelectorAll('.sd-bed').length);
    const names = [...app.element.querySelectorAll('.sd-bed-name')].map((e) => e.textContent.trim());
    check('eight bed cards, in key order', names.length === 8 && names.every((n, i) => n.startsWith((i + 1) + ' ·')), names);
    check('no effects or reference playlist on the deck', !names.some((n) => /^(Effets|Référence)/.test(n)));
    check('french strings are used', app.element.querySelector('[data-action=play]')?.getAttribute('aria-label') === P.lang.SOUNDS_DECK.Play);

    const card = (name) => app.element.querySelector('[data-playlist-id="' + game.playlists.getName(name).id + '"]');
    const click = (name, action) => card(name).querySelector('[data-action=' + action + ']').click();
    const board = game.playlists.getName('8 · The Board'), wrong = game.playlists.getName('5 · Wrong');

    click('8 · The Board', 'play');
    await until(() => board.playing && card('8 · The Board')?.classList.contains('is-playing'));
    const now = card('8 · The Board').querySelector('.sd-bed-now').textContent.trim();
    check('play: the bed plays and its card lights', board.playing && card('8 · The Board').classList.contains('is-playing'));
    check('play: the card names the track Foundry is playing', now && now === board.sounds.find((s) => s.playing)?.name, now);

    click('5 · Wrong', 'play');
    await until(() => wrong.playing && !board.playing);
    check('a bed is exclusive: starting Wrong stopped The Board', wrong.playing && !board.playing);

    app.setPosition({ width: 700, height: 500 });
    await wait(300);
    const firstTrack = wrong.sounds.find((s) => s.playing)?.name;
    click('5 · Wrong', 'skip');
    await until(() => wrong.sounds.find((s) => s.playing)?.name !== firstTrack);
    await wait(500);
    check('skip: a different track plays', wrong.sounds.find((s) => s.playing)?.name !== firstTrack, [firstTrack, wrong.sounds.find((s) => s.playing)?.name]);
    const box = app.element.getBoundingClientRect();
    check('the window keeps its size across a re-render (the resize bug)', Math.round(box.width) === 700 && Math.round(box.height) === 500, [Math.round(box.width), Math.round(box.height)]);

    click('5 · Wrong', 'stop');
    await until(() => !wrong.playing && !card('5 · Wrong').classList.contains('is-playing'));
    check('stop: the bed stops and its card goes dark', !wrong.playing && !card('5 · Wrong').classList.contains('is-playing'));

    await board.stopAll();
    await until(() => !card('8 · The Board').classList.contains('is-playing'));
    check('a stop made OUTSIDE the deck shows on it', !card('8 · The Board').classList.contains('is-playing'));

    // ---- the sidebar button
    await ui.playlists.render({ force: true });
    await wait(500);
    check('the playlists sidebar carries a Sounds Deck button', !!document.querySelector('#playlists [data-sounds-deck]'));

    // ---- the scene fix, walked for real
    const door = game.scenes.getName(P.DOORWAY);
    if (!door.active) await door.activate();
    await wait(1500);
    const walk = [];
    for (const name of [...P.BOARD_SCENES, P.DOORWAY]) {
      await game.scenes.getName(name).activate();
      await wait(2500);
      walk.push({ scene: name, bedPlaying: board.playing, track: board.sounds.find((s) => s.playing)?.name ?? null });
    }
    R.walk = walk;
    check('doorway -> board scene starts the bed', walk[0].bedPlaying);
    check('board -> board KEEPS the same track (Foundry alone restarts it)', walk[1].bedPlaying && walk[1].track === walk[0].track, [walk[0].track, walk[1].track]);
    check('board -> doorway stops it', !walk[2].bedPlaying);
  } catch (e) {
    check('no exception', false, String(e?.stack ?? e).slice(0, 500));
  } finally {
    // ---- leave the world as found
    for (const p of game.playlists.filter((x) => x.playing)) await p.stopAll();
    api?.sceneFix?.uninstall?.();
    Hooks.off('renderPlaylistDirectory', hookId);
    await app?.close();
    style.remove();
    if (activeBefore && !activeBefore.active) await activeBefore.activate();
    await ui.playlists.render({ force: true });
    await wait(800);
    for (const u of Object.values(urls)) URL.revokeObjectURL(u);
    R.leftAsFound = {
      methodRestored: Playlists.prototype._onChangeScene === originalMethod,
      playing: game.playlists.filter((p) => p.playing).map((p) => p.name),
      active: game.scenes.active?.name ?? null,
      sidebarButtonGone: !document.querySelector('#playlists [data-sounds-deck]'),
    };
  }
  R.passed = R.checks.filter((c) => c.ok).length + ' / ' + R.checks.length;
  return JSON.stringify(R, null, 1);
})()`);
console.log(report);
ws.close();
