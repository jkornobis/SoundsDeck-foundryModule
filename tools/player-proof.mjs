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
 * test seat, a role-1 account created for exactly this; its name, like its password, lives only in the local
 * credential file. Its audio is unlocked with a gesture, the module's ducking is loaded into it as blob modules, and then
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
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const FILES = [
  'src/core/classify.mjs',
  'src/core/cues.mjs',
  'src/foundry/snapshot.mjs',
  'src/foundry/ducking.mjs',
  'src/foundry/hide.mjs',
];
// The private sender (0.7, note 1) runs in the GAMEMASTER's page: its working copy, whatever release is installed.
const GM_FILES = ['src/core/classify.mjs', 'src/core/cues.mjs', 'src/core/private.mjs', 'src/foundry/private.mjs'];
// Late joiners (0.7, note 2): the gamemaster marks a start, the player's page catches up - both the working copy.
const LATE_FILES = [
  'src/core/classify.mjs',
  'src/core/cues.mjs',
  'src/core/late-join.mjs',
  'src/core/trim.mjs',
  'src/foundry/trim.mjs',
  'src/foundry/late-join.mjs',
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const cred = Object.fromEntries(
  (await readFile(path.join(os.homedir(), '.config/foundry-test-player.txt'), 'utf8'))
    .split('\n')
    .map((l) => l.match(/^\s*(\w+)\s*=\s*(.+?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
if (!cred.user || !cred.password) throw new Error('foundry-test-player.txt has no user= / password= line');

async function blobbable(files) {
  const out = [];
  for (const file of files) {
    const src = (await readFile(path.join(ROOT, file), 'utf8')).replace(/from '(\.{1,2}\/[^']+)'/g, (_m, spec) => {
      const target = path.posix.join(path.posix.dirname(file), spec);
      if (!files.includes(target)) throw new Error(`${file} imports ${target}, which is not loaded`);
      return `from '__MOD__${target}__'`;
    });
    out.push([file, src]);
  }
  return out;
}
const mods = await blobbable(FILES);
const gmMods = await blobbable(GM_FILES);
const lateMods = await blobbable(LATE_FILES);
const loadLateJoin = (global) => `(async () => {
  const urls = {};
  for (const [file, src] of ${JSON.stringify(lateMods)}) urls[file] = URL.createObjectURL(new Blob([src.replace(/__MOD__(.+?)__/g, (_m, f) => urls[f])], { type: 'text/javascript' }));
  const { installLateJoin } = await import(urls['src/foundry/late-join.mjs']);
  globalThis.${global} = installLateJoin({ Sound: foundry.audio.Sound, Playlist: foundry.documents.Playlist });
  return globalThis.${global}.installed;
})()`;

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
// The gamemaster's own ear matters too since 0.7 (a private sound plays there quietly): a page reloaded by a test run
// keeps its audio locked until a gesture, so it is unlocked like the player's.
await unlockAudio(gm);
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
  // The world's address is read from the gamemaster's own page - it is written nowhere in this repository, which is
  // public (the Composer, 2026-09-24: "scrub it from now on").
  const HOST = await gm.ev('location.origin');
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
    const { installHideFromPlayers } = await import(urls['src/foundry/hide.mjs']);
    globalThis.__sdPlayerHide = installHideFromPlayers(foundry.documents.Playlist, { enabled: () => true });
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
  // Hidden from players (note 5): the working copy's rule is on in this page since the ducking was loaded.
  const listed = JSON.parse(
    await player.ev(`(async () => {
      await ui.playlists.render({ force: true });
      await new Promise((r) => setTimeout(r, 800));
      const board = game.playlists.getName('8 · The Board');
      return JSON.stringify({ visible: board.visible, inSidebar: (document.querySelector('#playlists')?.textContent ?? '').includes(board.name) });
    })()`),
  );
  const stillHeard = await player.ev(bedGain);
  check(
    "the deck's playlists are hidden from the player's sidebar, and the bed is still heard",
    listed.visible === false && !listed.inSidebar && stillHeard > 0,
    { ...listed, stillHeard },
  );

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

  // ---- a sound for chosen players only (0.7, note 1): the seat hears what is sent to it, and nothing sent elsewhere
  const seatId = await player.ev('game.user.id');
  const heard = (src) => `[...game.audio.playing.values()].some((s) => s.src === ${JSON.stringify(src)} && s.playing)`;
  const sentSrc = await gm.ev(`(async () => {
    const urls = {};
    for (const [file, src] of ${JSON.stringify(gmMods)}) urls[file] = URL.createObjectURL(new Blob([src.replace(/__MOD__(.+?)__/g, (_m, f) => urls[f])], { type: 'text/javascript' }));
    const { sendPrivately } = await import(urls['src/foundry/private.mjs']);
    const cue = globalThis.__sdCues.sounds.contents[0];
    const sent = sendPrivately(cue, [${JSON.stringify(seatId)}]);
    return sent.length === 1 ? cue.path : null;
  })()`);
  let privateHeard = false;
  for (let i = 0; i < 20 && sentSrc && !privateHeard; i++) {
    await wait(300);
    privateHeard = await player.ev(heard(sentSrc));
  }
  check('a sound sent to the seat alone plays in the seat', privateHeard);
  const monitor = JSON.parse(
    await gm.ev(
      `JSON.stringify([...game.audio.playing.values()].filter((s) => s.src === ${JSON.stringify(sentSrc)}).map((s) => +s.volume.toFixed(3)))`,
    ),
  );
  check(
    "the GM hears it quietly: its copy at 0.4 of the players' level (0.4 x 0.4)",
    monitor.some((v) => Math.abs(v - 0.16) < 0.02),
    monitor,
  );
  const elsewhere = await gm.ev(`(async () => {
    const other = game.playlists.contents.flatMap((p) => p.sounds.contents).filter((s) => s.path.startsWith('ge-foundry/fx/'))[1];
    game.socket.emit('playAudio', { src: other.path, volume: 0.4, loop: false, channel: 'music' }, { recipients: [game.user.id] });
    return other.path;
  })()`);
  let leaked = false;
  for (let i = 0; i < 10 && !leaked; i++) {
    await wait(300);
    leaked = await player.ev(heard(elsewhere));
  }
  check('a sound sent to someone else does not reach the seat', !leaked);

  // ---- the 👤 dialog itself, as the gamemaster uses it: the installed deck, its button, the tick, Send
  // The pad sent above may still play in the seat: stopped there first, so what is heard next can only be the dialog's.
  await player.ev(
    `(() => { for (const s of game.audio.playing.values()) if (s.src === ${JSON.stringify(sentSrc)}) s.stop(); return 1; })()`,
  );
  await wait(1000);
  const quietBefore = !(await player.ev(heard(sentSrc)));
  const viaDialog = JSON.parse(
    await gm.ev(`(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const app = game.modules.get('sounds-deck').api.open();
      for (let i = 0; i < 25 && !app.rendered; i++) await wait(200);
      const cue = globalThis.__sdCues.sounds.contents[0];
      const button = app.element.querySelector('.sd-bank[data-playlist-id="' + globalThis.__sdCues.id + '"] .sd-private');
      if (!button) { await app.close(); return JSON.stringify({ step: 'no 👤 on the pad' }); }
      button.click();
      let dialog = null;
      for (let i = 0; i < 25 && !dialog; i++) {
        await wait(200);
        dialog = [...foundry.applications.instances.values()].find((a) => a.options.classes?.includes('sounds-deck-private') && a.rendered);
      }
      if (!dialog) { await app.close(); return JSON.stringify({ step: 'no dialog' }); }
      const listed = [...dialog.element.querySelectorAll('input[name=to]')].map((i) => i.value);
      const seat = dialog.element.querySelector('input[name=to][value="${seatId}"]');
      if (seat) seat.checked = true;
      dialog.element.querySelector('[data-action=ok]').click();
      await wait(800);
      await app.close();
      return JSON.stringify({ listed, src: cue.path });
    })()`),
  );
  let dialogHeard = false;
  for (let i = 0; i < 20 && viaDialog.src && !dialogHeard; i++) {
    await wait(300);
    dialogHeard = await player.ev(heard(viaDialog.src));
  }
  check(
    "the 👤 dialog lists the seat, and a tick and Send play the pad in the seat's browser",
    quietBefore && viaDialog.listed?.includes(seatId) && dialogHeard,
    { quietBefore, listed: viaDialog.listed?.length, step: viaDialog.step, heard: dialogHeard },
  );

  // ---- a late joiner (0.7, note 2): the bed starts, the seat reloads 10 s later, and comes in where the table is
  await gm.ev(
    `(async () => { for (const p of game.playlists.filter((x) => x.playing)) await p.stopAll(); return 1; })()`,
  );
  await wait(1500);
  await gm.ev(loadLateJoin('__sdGmLateJoin'));
  await gm.ev(`(async () => { await game.playlists.getName('8 · The Board').playAll(); return 1; })()`);
  const bedAt = `(() => { const s = game.playlists.getName('8 · The Board').sounds.find((x) => x.playing); return s?.sound?.playing && Number.isFinite(s.sound.currentTime) ? +s.sound.currentTime.toFixed(2) : null; })()`;
  let gmAt = null;
  for (let i = 0; i < 40 && gmAt === null; i++) {
    await wait(500);
    gmAt = await gm.ev(bedAt);
  }
  await wait(10000); // the table is 10 s into the track
  await player.send('Page.reload', {});
  let rejoined = false;
  for (let i = 0; i < 60 && !rejoined; i++) {
    await wait(1000);
    rejoined = await player.ev('!!globalThis.game?.ready').catch(() => false);
  }
  const silentBefore = (await player.ev(bedAt)) === null; // locked until a gesture: nothing plays yet
  const installed = rejoined && (await player.ev(loadLateJoin('__sdLateJoin')));
  await unlockAudio(player);
  let seatAt = null;
  for (let i = 0; i < 40 && seatAt === null; i++) {
    await wait(500);
    seatAt = await player.ev(bedAt);
  }
  const tableAt = await gm.ev(bedAt);
  check(
    'a player who joins late hears the bed where the table is, not from its start',
    installed && silentBefore && seatAt !== null && tableAt !== null && seatAt > 8 && Math.abs(seatAt - tableAt) < 1.5,
    { tableAt, seatAt, silentBefore, installed },
  );
} catch (e) {
  check('no exception', false, String(e?.stack ?? e).slice(0, 400));
} finally {
  await gm
    .ev(`(async () => {
      for (const p of game.playlists.filter((x) => x.playing)) await p.stopAll();
      for (const s of game.audio.playing.values()) if (s.src.startsWith('ge-foundry/fx/')) s.stop();
      globalThis.__sdGmLateJoin?.uninstall(); delete globalThis.__sdGmLateJoin;
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
