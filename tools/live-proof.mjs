#!/usr/bin/env node
/**
 * Photograph the deck inside a RUNNING world without installing it.
 *
 *   node tools/live-proof.mjs --show x.png    open the deck (with sandbox banks) and photograph it
 *     --accent red|#e0a040                    with that accent (theming: the Composer judges the look from these)
 *     --lit                                   with a pad and a loop playing, so the accent shows on lit cards
 *
 * ⚠️ ITS 36 CHECKS MOVED TO QUENCH (Auditorium on v0.4, note 7): test/quench/deck.mjs, run with tools/quench-run.mjs.
 * They were page code inside a template string that Biome could not read; three runs broke on it in one day. What is
 * left here is the one thing Quench cannot do - a screenshot of the window.
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
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { connect } from './cdp.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
// Every src/ file except the entry point, found rather than listed: a hand-kept list went stale twice.
async function list(dir) {
  const out = [];
  for (const e of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await list(rel)));
    else if (e.name.endsWith('.mjs')) out.push(rel);
  }
  return out;
}
const FILES = (await list('src')).filter((f) => f !== 'src/sounds-deck.mjs');
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
  // dependencies first, so each blob's imports already have URLs
  const deps = Object.fromEntries(out.map(([f, src]) => [f, [...src.matchAll(/__MOD__(.+?)__/g)].map((m) => m[1])]));
  const ordered = [];
  const visit = (f) => {
    if (ordered.includes(f)) return;
    for (const d of deps[f]) visit(d);
    ordered.push(f);
  };
  for (const [f] of out) visit(f);
  return ordered.map((f) => out.find(([g]) => g === f));
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
    sounds: fx.map((s, i) => ({ name: name.slice(3) + ' ' + 'ABCDEFGH'[i], path: s.path, volume: 0.4, repeat: mode === M.SIMULTANEOUS, fade: 500 })) });
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
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const ACCENT = arg('--accent');
const LIT = process.argv.includes('--lit');
if (SHOW) {
  const opened = await cdp.ev(`(async () => {
    if (game.users.some((u) => u.active && u.id !== game.user.id)) return JSON.stringify({ refused: 'someone is connected' });
    ${LOAD}
    const accentSeat = { accent: game.settings.get('sounds-deck', 'accent'), custom: game.settings.get('sounds-deck', 'accentCustom') };
    const accent = ${JSON.stringify(ACCENT)};
    if (accent?.startsWith('#')) {
      await game.settings.set('sounds-deck', 'accentCustom', accent);
      await game.settings.set('sounds-deck', 'accent', 'custom');
    } else if (accent) await game.settings.set('sounds-deck', 'accent', accent);
    globalThis.__sdCleanup = async () => {
      await game.settings.set('sounds-deck', 'accent', accentSeat.accent);
      await game.settings.set('sounds-deck', 'accentCustom', accentSeat.custom);
      await cleanup();
    };
    if (${LIT}) {
      await sandbox[0].playSound(sandbox[0].sounds.contents[0]);
      await sandbox[1].playSound(sandbox[1].sounds.contents[0]);
    }
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

console.log(
  'usage: node tools/live-proof.mjs --show FILE.png   (the checks moved to Quench: node tools/quench-run.mjs)',
);
cdp.close();
