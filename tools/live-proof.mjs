#!/usr/bin/env node
/**
 * Prove the module inside a RUNNING world without installing it.
 *
 *   node tools/live-proof.mjs                 drive every button, walk the scenes, measure, clean up
 *   node tools/live-proof.mjs --show x.png    open the deck (with the sandbox banks) and photograph it
 *
 * WHY THIS EXISTS: a module with code cannot be side-loaded through Foundry's File Picker (.js, .mjs and .css are
 * not uploadable - measured 2026-09-22), and installing needs a release Foundry can reach. So the proof goes the
 * other way: src/ is loaded into the gamemaster's page as ES modules (blob URLs), the same setup functions the entry
 * point calls are called, the window is driven through its real buttons, and everything is MEASURED.
 *
 * WHERE IT RUNS: on the machine that drives the world's gamemaster session through Chrome's debugger (tools/cdp.mjs).
 * Nothing is written to disk on the server.
 *
 * 🚨 IT PLAYS, BROADCASTS AND ACTIVATES SCENES, all of which reach anyone connected. So it REFUSES if anyone but the
 * gamemaster is connected or anything is already playing, builds its banks as SANDBOX playlists in the GE-Foundry
 * folder, and leaves the world as it found it: sandbox deleted, nothing playing, the same scene active, the seat's
 * own layout and window size put back.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { connect, unlockAudio } from './cdp.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const FILES = [
  'src/core/classify.mjs',
  'src/core/scene-bed.mjs',
  'src/core/beds.mjs',
  'src/core/banks.mjs',
  'src/core/cues.mjs',
  'src/foundry/snapshot.mjs',
  'src/foundry/ducking.mjs',
  'src/core/guard.mjs',
  'src/foundry/scene-bed-fix.mjs',
  'src/foundry/deck-app.mjs',
  'src/foundry/setup.mjs',
];
const TEMPLATES = { TEMPLATE_BEDS: 'templates/beds.hbs', TEMPLATE_BOARD: 'templates/board.hbs' };
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

const payload = {
  mods: await modules(),
  templates: Object.fromEntries(
    await Promise.all(Object.entries(TEMPLATES).map(async ([k, f]) => [k, await readFile(path.join(ROOT, f), 'utf8')])),
  ),
  lang: JSON.parse(await readFile(path.join(ROOT, 'lang/fr.json'), 'utf8')),
  css: await readFile(path.join(ROOT, 'styles/sounds-deck.css'), 'utf8'),
  DOORWAY,
  BOARD_SCENES,
};

// Shared by both modes: load the module, supply templates, strings and styles, and build three sandbox banks -
// one per press, plus a Shuffle bank that must show disabled. Returns what the caller needs to clean up.
const LOAD = `
  const P = ${JSON.stringify(payload)};
  const urls = {};
  for (const [file, src] of P.mods) {
    urls[file] = URL.createObjectURL(new Blob([src.replace(/__MOD__(.+?)__/g, (_m, f) => urls[f])], { type: 'text/javascript' }));
  }
  const setup = await import(urls['src/foundry/setup.mjs']);
  const deckModule = await import(urls['src/foundry/deck-app.mjs']);
  for (const [k, src] of Object.entries(P.templates)) Handlebars.registerPartial(deckModule[k], Handlebars.compile(src, { preventIndent: true }));
  foundry.utils.mergeObject(game.i18n.translations, P.lang);
  const style = Object.assign(document.createElement('style'), { id: 'sounds-deck-proof', textContent: P.css });
  document.head.append(style);
  setup.onInit();
  const seat = { layout: game.settings.get('sounds-deck', 'layout'), geometry: game.settings.get('sounds-deck', 'geometry') };
  const folder = game.folders.find((f) => f.type === 'Playlist' && f.name === 'GE-Foundry');
  const fx = game.playlists.contents.flatMap((p) => p.sounds.contents).filter((s) => s.path.startsWith('ge-foundry/fx/')).slice(0, 3);
  const M = CONST.PLAYLIST_MODES;
  const mk = (name, mode) => Playlist.create({ name, mode, folder: folder?.id ?? null,
    sounds: fx.map((s, i) => ({ name: name.slice(3) + ' ' + (i + 1), path: s.path, volume: 0.4, repeat: mode === M.SIMULTANEOUS, fade: 500 })) });
  const sandbox = [await mk('🔫 __sd one-shots', M.DISABLED), await mk('🌧️ __sd loops', M.SIMULTANEOUS), await mk('🎲 __sd shuffle', M.SHUFFLE), await mk('🎞️ __sd cues', M.SEQUENTIAL)];
  const cleanup = async () => {
    for (const p of game.playlists.filter((x) => x.playing)) await p.stopAll();
    for (const p of sandbox) await p.delete();
    await game.settings.set('sounds-deck', 'layout', seat.layout);
    await game.settings.set('sounds-deck', 'geometry', seat.geometry);
    style.remove();
    for (const u of Object.values(urls)) URL.revokeObjectURL(u);
  };
`;

const cdp = await connect();

// --show FILE.png
const SHOW = process.argv.includes('--show') ? process.argv[process.argv.indexOf('--show') + 1] : null;
if (SHOW) {
  const opened = await cdp.ev(`(async () => {
    if (game.users.some((u) => u.active && u.id !== game.user.id)) return JSON.stringify({ refused: 'someone is connected' });
    ${LOAD}
    globalThis.__sdCleanup = cleanup;
    const app = setup.openDeck();
    for (let i = 0; i < 30 && !app.rendered; i++) await new Promise((r) => setTimeout(r, 200));
    await new Promise((r) => setTimeout(r, 800));
    globalThis.__sdApp = app;
    const b = app.element.getBoundingClientRect();
    return JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height });
  })()`);
  const clip = JSON.parse(opened);
  if (clip.refused) {
    console.log('REFUSED', clip.refused);
  } else {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
    await writeFile(SHOW, Buffer.from(shot.data, 'base64'));
    console.log('wrote', SHOW);
  }
  await cdp.ev(
    `(async () => { await globalThis.__sdApp?.close(); await globalThis.__sdCleanup?.(); delete globalThis.__sdApp; delete globalThis.__sdCleanup; return 1; })()`,
  );
  cdp.close();
  process.exit(0);
}

await unlockAudio(cdp);
const report = await cdp.ev(`(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 8000) => { for (let t = 0; t < ms; t += 200) { if (await fn()) return true; await wait(200); } return false; };
  const R = { checks: [] };
  const check = (name, ok, detail) => R.checks.push({ ok: !!ok, name, ...(detail === undefined ? {} : { detail }) });

  // ---- guards
  if (!game.user.isGM) return JSON.stringify({ refused: 'not a gamemaster session' });
  const others = game.users.filter((u) => u.active && u.id !== game.user.id).map((u) => u.name);
  const playingBefore = game.playlists.filter((p) => p.playing).map((p) => p.name);
  if (others.length || playingBefore.length) return JSON.stringify({ refused: { connected: others, playing: playingBefore } });
  const activeBefore = game.scenes.active;

  ${LOAD}
  const Playlists = foundry.documents.collections.Playlists;
  const originalMethod = Playlists.prototype._onChangeScene;
  const hookId = Hooks.on('renderPlaylistDirectory', setup.onRenderPlaylistDirectory);
  let app, api;
  const shots = [];
  try {
    api = setup.onReady();
    check('scene fix installs on 14.368 (the defect is present)', api.sceneFix?.installed, api.sceneFix?.reason);

    // ================= v0.1 - the beds
    app = api.open();
    await until(() => app.rendered && app.element.querySelectorAll('.sd-bed').length);
    const names = [...app.element.querySelectorAll('.sd-bed-name')].map((e) => e.textContent.trim());
    check('eight bed cards, in key order', names.length === 8 && names.every((n, i) => n.startsWith((i + 1) + ' ·')), names);
    check('french strings are used', app.element.querySelector('[data-action=play]')?.getAttribute('aria-label') === P.lang.SOUNDS_DECK.Play);

    const card = (name) => app.element.querySelector('.sd-bed[data-playlist-id="' + game.playlists.getName(name).id + '"]');
    const click = (name, action) => card(name).querySelector('[data-action=' + action + ']').click();
    const board = game.playlists.getName('8 · The Board'), wrong = game.playlists.getName('5 · Wrong');

    click('8 · The Board', 'play');
    await until(() => board.playing && card('8 · The Board')?.classList.contains('is-playing'));
    const now = card('8 · The Board').querySelector('.sd-bed-now').textContent.trim();
    check('play: the bed plays, its card lights and names the track', board.playing && now === board.sounds.find((s) => s.playing)?.name, now);
    click('5 · Wrong', 'play');
    await until(() => wrong.playing && !board.playing);
    check('a bed is exclusive: starting Wrong stopped The Board', wrong.playing && !board.playing);
    const firstTrack = wrong.sounds.find((s) => s.playing)?.name;
    click('5 · Wrong', 'skip');
    await until(() => wrong.sounds.find((s) => s.playing)?.name !== firstTrack);
    check('skip: a different track plays', wrong.sounds.find((s) => s.playing)?.name !== firstTrack);
    click('5 · Wrong', 'stop');
    await until(() => !wrong.playing);
    check('stop: the bed stops', !wrong.playing);

    // ================= v0.2 - the board
    const bank = (p) => app.element.querySelector('.sd-bank[data-playlist-id="' + p.id + '"]');
    const [shotsPl, loopsPl, shufflePl, cuesPl] = sandbox;
    await until(() => bank(shotsPl) && bank(loopsPl) && bank(shufflePl));
    const bankNames = [...app.element.querySelectorAll('.sd-bank legend')].map((e) => e.textContent.trim());
    // The module's own rule decides what a bank is - one definition, and no regex to escape through a template string.
    const { classify } = await import(urls['src/core/classify.mjs']);
    const isBank = (p) => classify(p.name, p.mode)?.role === 'bank';
    const expected = game.playlists.filter(isBank).map((p) => p.name).sort();
    check('the board shows every bank and nothing else', JSON.stringify([...bankNames].sort()) === JSON.stringify(expected) && sandbox.every((p) => bankNames.includes(p.name)), bankNames);
    check('a Shuffle bank is drawn disabled, with its hint', bank(shufflePl).disabled && !!bank(shufflePl).querySelector('.sd-hint'));

    // one-shots: the same pad twice must overlap - two Sounds for that file, both playing
    const src = shotsPl.sounds.contents[0].path;
    const playingOf = () => [...game.audio.playing.values()].filter((s) => s.src?.endsWith(src) || decodeURIComponent(s.src ?? '').endsWith(src));
    const pad0 = () => bank(shotsPl).querySelector('.sd-pad');
    pad0().click();
    await wait(700);
    pad0().click();
    await until(() => playingOf().filter((s) => s.playing).length >= 2, 6000);
    const overlapping = playingOf().filter((s) => s.playing);
    shots.push(...overlapping);
    check('one-shot pressed twice overlaps itself (two Sounds playing)', overlapping.length >= 2, overlapping.length);
    check('a one-shot leaves the playlist document untouched', !shotsPl.playing && !shotsPl.sounds.some((s) => s.playing));
    check('a one-shot pad announces no state', !pad0().hasAttribute('aria-pressed'));

    // toggles: two loops on, then one off - the other keeps playing
    const pad = (i) => bank(loopsPl).querySelectorAll('.sd-pad')[i];
    const [l0, l1] = loopsPl.sounds.contents;
    pad(0).click();
    await until(() => l0.playing && pad(0)?.getAttribute('aria-pressed') === 'true');
    pad(1).click();
    await until(() => l1.playing);
    check('toggle: two room loops on together', l0.playing && l1.playing && pad(0).getAttribute('aria-pressed') === 'true');
    pad(0).click();
    await until(() => !l0.playing);
    await wait(400);
    check('toggle: switching one off leaves the other playing', !l0.playing && l1.playing && pad(0).getAttribute('aria-pressed') === 'false', [l0.playing, l1.playing]);
    await loopsPl.stopAll();

    // layout: the flex direction changes, the markup order never does
    const content = () => app.element.querySelector('.window-content');
    const order = () => [...content().children].map((c) => c.className.split(' ')[0]).join(',');
    const before = { dir: getComputedStyle(content()).flexDirection, order: order() };
    await app.options.actions.layout.call(app);
    await until(() => app.element.classList.contains('is-vertical'));
    const after = { dir: getComputedStyle(content()).flexDirection, order: order() };
    check('layout switch: beside -> below, same markup order', before.dir === 'row' && after.dir === 'column' && before.order === after.order, { before, after });

    // window size remembered between sessions: close, rebuild from the saved setting
    app.setPosition({ width: 820, height: 560 });
    await wait(300);
    await app.close();
    const saved = game.settings.get('sounds-deck', 'geometry');
    const Deck = app.constructor;
    app = new Deck();
    await app.render({ force: true });
    await until(() => app.rendered);
    const box = app.element.getBoundingClientRect();
    check('the window reopens at the size it closed at', Math.round(box.width) === 820 && Math.round(box.height) === 560, { saved, reopened: [Math.round(box.width), Math.round(box.height)] });

    // ================= v0.3 - cues and ducking
    const bedSound = () => board.sounds.find((x) => x.playing);
    const gain = () => bedSound()?.sound?.volume ?? NaN;
    click('8 · The Board', 'play');
    await until(() => bedSound()?.sound?.playing, 10000);
    await wait(3500); // past the bed's own fade-in
    const full = gain();
    const docVol = bedSound()?.volume;
    const cuePad = (i) => bank(cuesPl).querySelectorAll('.sd-pad')[i];
    const row = () => app.element.querySelector('.sd-cue[data-sound-id="' + cuesPl.sounds.contents[0].id + '"]');
    cuePad(0).click();
    await until(() => row() && cuesPl.sounds.contents[0].sound?.playing, 10000);
    await wait(1500);
    const ducked = gain();
    check('a cue playing ducks the bed about 10 dB (x0.32)', ducked / full > 0.22 && ducked / full < 0.42, { docVol, full: +full.toFixed(3), ducked: +ducked.toFixed(3), ratio: +(ducked / full).toFixed(3) });
    check('the playing cue appears on the transport, with pause', !!row()?.querySelector('[data-action=cuePause]'));

    row().querySelector('[data-action=cuePause]').click();
    await until(() => !cuesPl.sounds.contents[0].playing && row()?.querySelector('[data-action=cueResume]'));
    await wait(2600);
    const released = gain();
    check('pause: the cue stays on the transport, and the bed comes back up', row()?.classList.contains('is-paused') && released / full > 0.9, { released: +released.toFixed(3), ratio: +(released / full).toFixed(3) });

    row().querySelector('[data-action=cueResume]').click();
    await until(() => cuesPl.sounds.contents[0].sound?.playing, 8000);
    await wait(1500);
    check('resume: the cue plays again and the bed ducks again', gain() / full < 0.42, +(gain() / full).toFixed(3));

    const range = row().querySelector('input[type=range]');
    range.value = '30';
    range.dispatchEvent(new Event('change'));
    await wait(2500);
    const at = cuesPl.sounds.contents[0].sound?.currentTime ?? 0;
    check('seek: the cue jumps to the chosen position', at >= 29 && at <= 36, +at.toFixed(1));

    row().querySelector('[data-action=cueStop]').click();
    await until(() => !row(), 6000);
    await wait(2600);
    check('stop: the cue leaves the transport and the bed returns to full', !row() && gain() / full > 0.9, +(gain() / full).toFixed(3));

    // per-cue override, set from the deck's own switch (v0.4): the pad's ducking button, clicked
    const duckBtn = () => bank(cuesPl).querySelectorAll('.sd-duck')[1];
    check('an event pad carries a ducking switch, on by default', duckBtn()?.getAttribute('aria-pressed') === 'true');
    duckBtn().click();
    await until(() => cuesPl.sounds.contents[1].flags?.['sounds-deck']?.duck === false && duckBtn()?.getAttribute('aria-pressed') === 'false');
    check('the switch stores duck:false on the sound and shows it off', cuesPl.sounds.contents[1].flags?.['sounds-deck']?.duck === false && duckBtn().getAttribute('aria-pressed') === 'false');
    cuePad(1).click();
    await until(() => cuesPl.sounds.contents[1].sound?.playing, 10000);
    await wait(1500);
    check('a cue marked duck:false leaves the bed at full', gain() / full > 0.9, +(gain() / full).toFixed(3));
    await cuesPl.stopAll();
    await board.stopAll();
    await wait(1000);

    // ================= the scene fix, walked for real
    const door = game.scenes.getName(P.DOORWAY);
    if (!door.active) await door.activate();
    await wait(1500);
    const walk = [];
    for (const name of [...P.BOARD_SCENES, P.DOORWAY]) {
      await game.scenes.getName(name).activate();
      await wait(2500);
      walk.push({ scene: name, bedPlaying: board.playing, track: board.sounds.find((s) => s.playing)?.name ?? null });
    }
    check('board -> board KEEPS the same track (Foundry alone restarts it)', walk[0].bedPlaying && walk[1].bedPlaying && walk[1].track === walk[0].track, walk.map((w) => w.track));
    check('board -> doorway stops it', !walk[2].bedPlaying);

    // manual music survives a scene change (v0.4): pick Wrong by hand in a board scene, then leave for the doorway
    await game.scenes.getName(P.BOARD_SCENES[0]).activate();
    await until(() => board.playing, 8000);
    click('5 · Wrong', 'play');
    await until(() => wrong.playing && !board.playing, 8000);
    await door.activate();
    await wait(2500);
    check('manual music survives: Wrong picked by hand plays on into a scene with no music', wrong.playing && !board.playing, { wrong: wrong.playing, board: board.playing });
    await game.scenes.getName(P.BOARD_SCENES[0]).activate();
    await wait(2500);
    check('a scene with its own music takes over: the board starts and Wrong stops', board.playing && !wrong.playing, { wrong: wrong.playing, board: board.playing });
    await door.activate();
    await wait(2500);
    check('and leaving it stops the music the scene brought', !board.playing && !wrong.playing);

    // fail safe (v0.4 note 3): a fault inside the scene fix must hand the change to Foundry, not silence it.
    // The fault is REAL, injected at the edge: a scene whose playlist throws the first time it is read.
    let thrown = false;
    const desk = game.scenes.getName(P.BOARD_SCENES[0]);
    const faulty = new Proxy(desk, {
      get(t, k) {
        if (k === 'playlist' && !thrown) {
          thrown = true;
          throw new Error('injected fault');
        }
        return Reflect.get(t, k, t);
      },
    });
    const errors = [];
    const origError = console.error;
    console.error = (...a) => {
      errors.push(String(a[0]));
      origError(...a);
    };
    try {
      await game.playlists._onChangeScene(faulty);
      await until(() => board.playing, 6000);
    } finally {
      console.error = origError;
    }
    check('a fault in the scene fix falls back to Foundry: the scene music still starts', thrown && board.playing, { thrown, boardPlaying: board.playing });
    check('and the fault is reported, once', errors.filter((e) => e.includes('scene fix failed')).length === 1, errors.length);
    await board.stopAll();
    await wait(800);

    await ui.playlists.render({ force: true });
    await wait(500);
    check('the playlists sidebar carries a Sounds Deck button', !!document.querySelector('#playlists [data-sounds-deck]'));
  } catch (e) {
    check('no exception', false, String(e?.stack ?? e).slice(0, 600));
  } finally {
    for (const s of shots) s.stop?.();
    api?.sceneFix?.uninstall?.();
    api?.ducking?.uninstall?.();
    Hooks.off('renderPlaylistDirectory', hookId);
    await app?.close();
    await cleanup();
    if (activeBefore && !activeBefore.active) await activeBefore.activate();
    await ui.playlists.render({ force: true });
    await wait(800);
    R.leftAsFound = {
      methodRestored: Playlists.prototype._onChangeScene === originalMethod,
      sandboxGone: !game.playlists.some((p) => p.name.includes('__sd')),
      playing: game.playlists.filter((p) => p.playing).map((p) => p.name),
      active: game.scenes.active?.name ?? null,
      sidebarButtonGone: !document.querySelector('#playlists [data-sounds-deck]'),
    };
  }
  R.passed = R.checks.filter((c) => c.ok).length + ' / ' + R.checks.length;
  return JSON.stringify(R);
})()`);
const r = JSON.parse(report);
if (r.refused) console.log('REFUSED', JSON.stringify(r.refused));
else {
  for (const c of r.checks)
    console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail === undefined ? '' : `  ${JSON.stringify(c.detail)}`}`);
  console.log(r.passed, '| left as found:', JSON.stringify(r.leftAsFound));
}
cdp.close();
process.exit(r.checks?.every((c) => c.ok) ? 0 : 1);
