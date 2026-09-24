#!/usr/bin/env node
/**
 * Run the module's Quench batches in the live world and print the results.
 *
 *   node tools/quench-run.mjs            every batch
 *   node tools/quench-run.mjs deck       only sounds-deck.deck (any batch key suffix)
 *
 * INSTALLED: the module registered its batches at quenchReady; this only runs them.
 * NOT INSTALLED: this loads src/ and test/quench/ into the gamemaster's page as blob modules, supplies the templates,
 * the table's language and the stylesheet, runs the module's own init and ready, and leaves its api on
 * globalThis.__soundsDeckHarness for the batches. Everything it installed is removed afterwards.
 *
 * 🚨 QUENCH'S WINDOW MUST BE OPEN BEFORE A RUN on Foundry 14 (Quench 0.10.0 is verified for 13). Measured 2026-09-24:
 * with it closed, QuenchResults.handleRunBegin reads an element that does not exist and Mocha stalls - a hang, not an
 * error. This opens it first, and guards the run with a timeout.
 *
 * ⚠️ Until the module is installed, Quench shows one error toast per batch on registration ("invalid package name"): it
 * checks that a batch key starts with an installed package id. The batches register and run anyway.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { connect, unlockAudio } from './cdp.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const only = process.argv[2];

async function list(dir) {
  const out = [];
  for (const e of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await list(rel)));
    else if (e.name.endsWith('.mjs')) out.push(rel);
  }
  return out;
}

// Every module file except the entry point (it would register hooks a second time), in dependency order.
const files = [...(await list('src')), ...(await list('test/quench'))].filter((f) => f !== 'src/sounds-deck.mjs');
const sources = {};
const deps = {};
for (const f of files) {
  deps[f] = [];
  sources[f] = (await readFile(path.join(ROOT, f), 'utf8')).replace(/from '(\.{1,2}\/[^']+)'/g, (_m, spec) => {
    const target = path.posix.join(path.posix.dirname(f), spec);
    if (!files.includes(target)) throw new Error(`${f} imports ${target}, which is not loaded`);
    deps[f].push(target);
    return `from '__MOD__${target}__'`;
  });
}
const ordered = [];
const visit = (f) => {
  if (ordered.includes(f)) return;
  for (const d of deps[f]) visit(d);
  ordered.push(f);
};
for (const f of files) visit(f);
const payload = {
  mods: ordered.map((f) => [f, sources[f]]),
  templates: {
    TEMPLATE_BEDS: await readFile(path.join(ROOT, 'templates/beds.hbs'), 'utf8'),
    TEMPLATE_BOARD: await readFile(path.join(ROOT, 'templates/board.hbs'), 'utf8'),
  },
  langs: {
    en: JSON.parse(await readFile(path.join(ROOT, 'lang/en.json'), 'utf8')),
    fr: JSON.parse(await readFile(path.join(ROOT, 'lang/fr.json'), 'utf8')),
  },
  css: await readFile(path.join(ROOT, 'styles/sounds-deck.css'), 'utf8'),
  only: only ? `sounds-deck.${only}` : 'sounds-deck.**',
};

const cdp = await connect();
await cdp.ev(
  '(async () => { await quench?.app?.render(true); await new Promise((r) => setTimeout(r, 1000)); return 1; })()',
);
const unlocked = await unlockAudio(cdp);
if (!unlocked) console.log('⚠️ audio contexts not running - the sound tests will fail for that reason, not Foundry');

const out = await cdp.ev(`(async () => {
  if (!globalThis.quench) return JSON.stringify({ refused: 'Quench is not active in this world' });
  const P = ${JSON.stringify(payload)};
  const urls = {};
  for (const [f, src] of P.mods) {
    urls[f] = URL.createObjectURL(new Blob([src.replace(/__MOD__(.+?)__/g, (_m, d) => urls[d])], { type: 'text/javascript' }));
  }
  const installed = !!game.modules.get('sounds-deck')?.active;
  let harness = null;
  if (!installed) {
    // What an install would provide, supplied by hand: templates, strings, styles, init and ready.
    const deck = await import(urls['src/foundry/deck-app.mjs']);
    for (const [k, src] of Object.entries(P.templates)) Handlebars.registerPartial(deck[k], Handlebars.compile(src, { preventIndent: true }));
    foundry.utils.mergeObject(game.i18n.translations, P.langs[game.i18n.lang] ?? P.langs.en);
    const style = Object.assign(document.createElement('style'), { id: 'sounds-deck-harness', textContent: P.css });
    document.head.append(style);
    const setup = await import(urls['src/foundry/setup.mjs']);
    setup.onInit();
    const api = setup.onReady();
    const hookId = Hooks.on('renderPlaylistDirectory', setup.onRenderPlaylistDirectory);
    harness = { api, style, hookId };
    globalThis.__soundsDeckHarness = { api };
    const { registerBatches } = await import(urls['test/quench/index.mjs']);
    registerBatches(quench);
  }

  const results = [];
  const pageErrors = [];
  const onErr = (e) => pageErrors.push(String(e.error?.stack ?? e.reason?.stack ?? e.message ?? e.reason).slice(0, 400));
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', onErr);
  const runner = await quench.runBatches(P.only);
  const ended = await Promise.race([
    new Promise((resolve) => {
      runner.on('pass', (t) => results.push({ ok: true, test: t.fullTitle(), ms: t.duration }));
      runner.on('pending', (t) => results.push({ ok: true, skipped: true, test: t.fullTitle() }));
      runner.on('fail', (t, err) => results.push({ ok: false, test: t.fullTitle(), error: String(err?.message ?? err).slice(0, 300) }));
      runner.once('end', () => resolve(true));
    }),
    new Promise((resolve) => setTimeout(() => resolve(false), 600000)),
  ]);
  window.removeEventListener('error', onErr);
  window.removeEventListener('unhandledrejection', onErr);

  let leftAsFound = null;
  if (harness) {
    const Playlists = foundry.documents.collections.Playlists;
    harness.api.sceneFix?.uninstall?.();
    harness.api.ducking?.uninstall?.();
    Hooks.off('renderPlaylistDirectory', harness.hookId);
    harness.style.remove();
    delete globalThis.__soundsDeckHarness;
    await ui.playlists.render({ force: true });
    await new Promise((r) => setTimeout(r, 800));
    leftAsFound = {
      methodRestored: String(Playlists.prototype._onChangeScene).includes('playlistSound: priorPlaylistSoundId'),
      sandboxGone: !game.playlists.some((p) => p.name.includes('__sd')),
      playing: game.playlists.filter((p) => p.playing).map((p) => p.name),
      active: game.scenes.active?.name ?? null,
      sidebarButtonGone: !document.querySelector('#playlists [data-sounds-deck]'),
    };
  }
  for (const u of Object.values(urls)) URL.revokeObjectURL(u);
  if (!ended) {
    try { runner.abort(); } catch {}
    return JSON.stringify({ hung: { stats: runner.stats, pageErrors, results } });
  }
  return JSON.stringify({
    installed,
    results,
    passed: results.filter((r) => r.ok && !r.skipped).length + ' passed, ' + results.filter((r) => !r.ok).length + ' failed, ' + results.filter((r) => r.skipped).length + ' skipped',
    leftAsFound,
  });
})()`);
const r = JSON.parse(out);
if (r.refused) console.log('REFUSED', r.refused);
else if (r.hung) console.log('HUNG', JSON.stringify(r.hung, null, 1));
else {
  for (const t of r.results) {
    const tag = t.skipped ? 'SKIP' : t.ok ? 'PASS' : 'FAIL';
    console.log(`${tag} ${t.test.replace(/sounds-deck\.[a-z-]+_root /, '')}${t.ok ? '' : `  -> ${t.error}`}`);
  }
  console.log(
    `${r.passed} | ${r.installed ? 'installed' : 'harness'}${r.leftAsFound ? ` | left as found: ${JSON.stringify(r.leftAsFound)}` : ''}`,
  );
}
cdp.close();
process.exit(r.results?.every((t) => t.ok) ? 0 : 1);
