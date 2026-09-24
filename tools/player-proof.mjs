#!/usr/bin/env node
/**
 * Prove ducking where the table hears it: in a PLAYER's browser, not the gamemaster's.
 *
 *   node tools/player-proof.mjs
 *
 * Auditorium on v0.4, note 2 (Software Architect): every browser plays its own copy of the bed, so every browser must
 * duck its own - and until now only the gamemaster's had been measured.
 *
 * HOW: a second, ISOLATED browser session (its own cookies - Target.createBrowserContext) joins the world as the
 * test seat, a role-1 account this instance created for exactly this (FoundryVTT-KnowledgeDB, SESSION_LOG
 * 2026-09-21). Its audio is unlocked with a gesture, the module's ducking is loaded into it as blob modules, and then
 * the GAMEMASTER session starts a bed and an event. The bed's gain is read IN THE PLAYER'S PAGE.
 *
 * The seat's password is read from ~/.config/foundry-test-player.txt (user=... / password=... lines) and typed into the
 * join form; it is never printed. REFUSES if any real player is connected. Everything it starts is stopped, the sandbox
 * bank is deleted, and the player session is closed with its browser context.
 */
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { connect, unlockAudio } from './cdp.mjs';

const require = createRequire('/usr/share/nodejs/');
const WebSocket = require('ws');
const HOST = '<the world address>';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const FILES = ['src/core/classify.mjs', 'src/core/cues.mjs', 'src/foundry/snapshot.mjs', 'src/foundry/ducking.mjs'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const cred = Object.fromEntries(
  (await readFile(path.join(os.homedir(), '.config/foundry-test-player.txt'), 'utf8'))
    .split('\n')
    .map((l) => l.match(/^\s*(\w+)\s*=\s*(.+?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
if (!cred.user || !cred.password) throw new Error('foundry-test-player.txt has no user= / password= line');

const mods = [];
for (const file of FILES) {
  const src = (await readFile(path.join(ROOT, file), 'utf8')).replace(/from '(\.{1,2}\/[^']+)'/g, (_m, spec) => {
    const target = path.posix.join(path.posix.dirname(file), spec);
    if (!FILES.includes(target)) throw new Error(`${file} imports ${target}, which is not loaded`);
    return `from '__MOD__${target}__'`;
  });
  mods.push([file, src]);
}

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

// ---- the browser, for creating and removing the isolated context
const browserWs = new WebSocket((await getJson('/json/version')).webSocketDebuggerUrl, { perMessageDeflate: false });
let bseq = 0;
const bpend = new Map();
browserWs.on('message', (d) => {
  const m = JSON.parse(d);
  if (bpend.has(m.id)) {
    bpend.get(m.id)(m);
    bpend.delete(m.id);
  }
});
await new Promise((r) => browserWs.on('open', r));
const bsend = (method, params = {}) =>
  new Promise((res) => {
    const n = ++bseq;
    bpend.set(n, res);
    browserWs.send(JSON.stringify({ id: n, method, params }));
  });

const gm = await connect();
const R = { checks: [] };
const check = (name, ok, detail) => R.checks.push({ ok: !!ok, name, detail });

const guard = JSON.parse(
  await gm.ev(
    `JSON.stringify({ gm: game.user.isGM, others: game.users.filter((u) => u.active && u.id !== game.user.id).map((u) => u.name), playing: game.playlists.filter((p) => p.playing).map((p) => p.name) })`,
  ),
);
if (!guard.gm || guard.others.length || guard.playing.length) {
  console.log('REFUSED', JSON.stringify(guard));
  process.exit(2);
}

let contextId, player;
try {
  // ---- a second, isolated session joins as the test seat
  contextId = (await bsend('Target.createBrowserContext', { disposeOnDetach: false })).result.browserContextId;
  const { targetId } = (await bsend('Target.createTarget', { url: `${HOST}/join`, browserContextId: contextId }))
    .result;
  let ws;
  for (let i = 0; i < 20 && !ws; i++) {
    await wait(500);
    ws = (await getJson('/json/list')).find((t) => t.id === targetId)?.webSocketDebuggerUrl;
  }
  player = await connect(ws);
  for (
    let i = 0;
    i < 30 && !(await player.ev('!!document.querySelector("select[name=userid], input[name=username]")'));
    i++
  )
    await wait(1000);
  await player.ev(`(() => {
    const byName = ${JSON.stringify(cred.user)};
    const sel = document.querySelector('select[name=userid]');
    if (sel) { const o = [...sel.options].find((x) => x.textContent.trim() === byName); sel.value = o?.value ?? ''; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    const u = document.querySelector('input[name=username]');
    const setv = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    if (u) setv(u, byName);
    setv(document.querySelector('input[name=password]'), ${JSON.stringify(cred.password)});
    document.querySelector('button[name=join]').click();
    return 1;
  })()`);
  let joined = false;
  for (let i = 0; i < 60 && !joined; i++) {
    await wait(1500);
    joined = await player.ev('!!globalThis.game?.ready').catch(() => false);
  }
  check(
    'a second, isolated session joins as the test seat',
    joined && (await player.ev('game.user.name')) === cred.user && !(await player.ev('game.user.isGM')),
  );
  if (!joined) throw new Error('the player session never reached the world');
  check('the player session has its audio running', await unlockAudio(player));

  // ---- the module's ducking, loaded into the PLAYER's page
  await player.ev(`(async () => {
    const urls = {};
    for (const [file, src] of ${JSON.stringify(mods)}) urls[file] = URL.createObjectURL(new Blob([src.replace(/__MOD__(.+?)__/g, (_m, f) => urls[f])], { type: 'text/javascript' }));
    const { installDucking } = await import(urls['src/foundry/ducking.mjs']);
    globalThis.__sdPlayerDucking = installDucking();
    return 1;
  })()`);

  // ---- the gamemaster starts a bed, then an event from a sandbox bank
  await gm.ev(`(async () => {
    const folder = game.folders.find((f) => f.type === 'Playlist' && f.name === 'GE-Foundry');
    const fx = game.playlists.contents.flatMap((p) => p.sounds.contents).filter((s) => s.path.startsWith('ge-foundry/fx/'))[0];
    globalThis.__sdCues = await Playlist.create({ name: '🎞️ __sd player cues', mode: CONST.PLAYLIST_MODES.SEQUENTIAL, folder: folder?.id ?? null,
      sounds: [{ name: 'cue', path: fx.path, volume: 0.4, repeat: false, fade: 500 }] });
    await game.playlists.getName('8 · The Board').playAll();
    return 1;
  })()`);
  const bedGain = `(() => { const s = game.playlists.getName('8 · The Board').sounds.find((x) => x.playing); return s?.sound?.playing ? +s.sound.volume.toFixed(3) : null; })()`;
  let full = null;
  for (let i = 0; i < 30 && !full; i++) {
    await wait(500);
    full = await player.ev(bedGain);
  }
  await wait(3500); // past the bed's own fade-in, in the player's browser
  full = await player.ev(bedGain);
  check('the bed plays in the player browser', full > 0, full);

  await gm.ev(`(async () => { const p = globalThis.__sdCues; await p.playSound(p.sounds.contents[0]); return 1; })()`);
  await wait(2500);
  const ducked = await player.ev(bedGain);
  check(
    'an event started by the GM ducks the bed IN THE PLAYER browser (x0.32)',
    ducked / full > 0.22 && ducked / full < 0.42,
    { full, ducked, ratio: +(ducked / full).toFixed(3) },
  );

  await gm.ev(`(async () => { await globalThis.__sdCues.stopAll(); return 1; })()`);
  await wait(3000);
  const back = await player.ev(bedGain);
  check('when the event stops, the player hears the bed come back to full', back / full > 0.9, {
    back,
    ratio: +(back / full).toFixed(3),
  });
} catch (e) {
  check('no exception', false, String(e?.stack ?? e).slice(0, 400));
} finally {
  await gm
    .ev(`(async () => {
      for (const p of game.playlists.filter((x) => x.playing)) await p.stopAll();
      await globalThis.__sdCues?.delete(); delete globalThis.__sdCues;
      return 1;
    })()`)
    .catch(() => {});
  player?.close();
  if (contextId) await bsend('Target.disposeBrowserContext', { browserContextId: contextId });
  await wait(2000);
  R.leftAsFound = JSON.parse(
    await gm.ev(
      `JSON.stringify({ playing: game.playlists.filter((p) => p.playing).map((p) => p.name), sandboxGone: !game.playlists.some((p) => p.name.includes('__sd')), testSeatGone: !game.users.find((u) => u.name === ${JSON.stringify(cred.user)})?.active })`,
    ),
  );
  gm.close();
  browserWs.close();
}
for (const c of R.checks)
  console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail === undefined ? '' : `  ${JSON.stringify(c.detail)}`}`);
console.log(
  `${R.checks.filter((c) => c.ok).length} / ${R.checks.length} | left as found: ${JSON.stringify(R.leftAsFound)}`,
);
process.exit(R.checks.every((c) => c.ok) ? 0 : 1);
