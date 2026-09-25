#!/usr/bin/env node
/**
 * Run the module's Quench batches in the live world and print the results.
 *
 *   node tools/quench-run.mjs            every batch
 *   node tools/quench-run.mjs deck       only sounds-deck.deck (any batch key suffix)
 *   node tools/quench-run.mjs --src deck test the WORKING COPY even though a release is installed: the installed
 *                                        copy's scene fix, ducking and window are switched off, src/ is loaded in their
 *                                        place, and the page is reloaded at the end so the installed release is back
 *   node tools/quench-run.mjs --src --coverage
 *                                        also print how much of src/ the batches ran, line by line (tools/coverage.mjs)
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
import { lineCoverage, spans } from './coverage.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const FROM_SRC = process.argv.includes('--src');
const COVERAGE = process.argv.includes('--coverage');
if (COVERAGE && !FROM_SRC) throw new Error('--coverage measures the working copy: add --src');
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));

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
  fromSrc: FROM_SRC,
  coverage: COVERAGE,
};

const cdp = await connect();
await cdp.ev(
  '(async () => { await quench?.app?.render(true); await new Promise((r) => setTimeout(r, 1000)); return 1; })()',
);
const unlocked = await unlockAudio(cdp);
if (!unlocked) console.log('⚠️ audio contexts not running - the sound tests will fail for that reason, not Foundry');
if (COVERAGE) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
}

const out = await cdp.ev(`(async () => {
  if (!globalThis.quench) return JSON.stringify({ refused: 'Quench is not active in this world' });
  const P = ${JSON.stringify(payload)};
  const urls = {};
  const served = {};
  for (const [f, src] of P.mods) {
    served[f] = src.replace(/__MOD__(.+?)__/g, (_m, d) => urls[d]);
    urls[f] = URL.createObjectURL(new Blob([served[f]], { type: 'text/javascript' }));
  }
  const installed = !!game.modules.get('sounds-deck')?.active;
  let harness = null;
  if (installed && P.fromSrc) {
    // Silence the installed release so the working copy can stand in its place; the reload at the end restores it.
    const inst = game.modules.get('sounds-deck').api;
    inst?.sceneMood?.uninstall?.();
    inst?.sceneFix?.uninstall?.();
    inst?.ducking?.uninstall?.();
    inst?.silentFix?.uninstall?.();
    inst?.crossfade?.uninstall?.();
    inst?.hotbar?.uninstall?.();
    inst?.combat?.uninstall?.();
    inst?.events?.uninstall?.();
    inst?.hide?.uninstall?.();
    inst?.lateJoin?.uninstall?.(); // before the trim: it wraps the trim's play
    inst?.trim?.uninstall?.();
    inst?.look?.uninstall?.();
    for (const app of foundry.applications.instances.values()) if (app.id === 'sounds-deck') await app.close();
  }
  if (!installed || P.fromSrc) {
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
    harness.api.sceneMood?.uninstall?.();
    harness.api.sceneFix?.uninstall?.();
    harness.api.ducking?.uninstall?.();
    harness.api.silentFix?.uninstall?.();
    harness.api.crossfade?.uninstall?.();
    harness.api.hotbar?.uninstall?.();
    harness.api.combat?.uninstall?.();
    harness.api.events?.uninstall?.();
    harness.api.hide?.uninstall?.();
    harness.api.lateJoin?.uninstall?.(); // before the trim: it wraps the trim's play
    harness.api.trim?.uninstall?.();
    harness.api.look?.uninstall?.();
    Hooks.off('renderPlaylistDirectory', harness.hookId);
    harness.style.remove();
    delete globalThis.__soundsDeckHarness;
    await ui.playlists.render({ force: true });
    await new Promise((r) => setTimeout(r, 800));
    leftAsFound = {
      methodRestored: String(Playlists.prototype._onChangeScene).includes('playlistSound: priorPlaylistSoundId'),
      onStartRestored: String(foundry.documents.PlaylistSound.prototype._onStart).includes('return this.sound.stop()'),
      playRestored: String(foundry.audio.Sound.prototype.play).includes('#queuePlay'),
      soundStartRestored: String(foundry.documents.Playlist.prototype._onSoundStart).includes('autoPreloadSeconds'),
      fadeRestored: String(Object.getOwnPropertyDescriptor(foundry.documents.PlaylistSound.prototype, 'fadeDuration').get).includes('soundDuration'),
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
    // Errors the page raised in the background during the run - Mocha blames them on whichever test was running, so
    // a failure with no stack of its own (the Settings test, three times in ten runs, 2026-09-25) is read against these.
    pageErrors,
    ...(P.coverage && { served: Object.entries(served).map(([f, text]) => [urls[f], f, text]) }),
  });
})()`);
const r = JSON.parse(out);
const coverage = [];
if (COVERAGE && r.served) {
  // Taken before the reload below, which would throw the counts away.
  const { result } = await cdp.send('Profiler.takePreciseCoverage');
  await cdp.send('Profiler.stopPreciseCoverage');
  for (const [url, file, text] of r.served) {
    if (!file.startsWith('src/')) continue;
    const functions = result.filter((s) => s.url === url).flatMap((s) => s.functions);
    coverage.push({ file, ...lineCoverage(text, functions) });
  }
}
if (FROM_SRC && r.installed) {
  await cdp.send('Page.reload', {});
  // Leave the world ready for whatever runs next. Measured 2026-09-24: a second run started 1 s after this reload found
  // no Foundry page on the debugger, and a third found a page without Quench.
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    await new Promise((res) => setTimeout(res, 1000));
    ready = await cdp.ev('!!(globalThis.game?.ready && globalThis.quench)').catch(() => false);
  }
  console.log(
    `page reloaded: the installed release is back in charge${ready ? '' : ' - but the world was not ready 60 s later'}`,
  );
}
if (r.refused) console.log('REFUSED', r.refused);
else if (r.hung) console.log('HUNG', JSON.stringify(r.hung, null, 1));
else {
  for (const t of r.results) {
    const tag = t.skipped ? 'SKIP' : t.ok ? 'PASS' : 'FAIL';
    console.log(`${tag} ${t.test.replace(/sounds-deck\.[a-z-]+_root /, '')}${t.ok ? '' : `  -> ${t.error}`}`);
  }
  if (r.results.some((t) => !t.ok) && r.pageErrors?.length) {
    console.log(`page errors during the run (${r.pageErrors.length}):`);
    for (const e of r.pageErrors) console.log(`  ${e}`);
  }
  console.log(
    `${r.passed} | ${r.installed ? 'installed' : 'harness'}${r.leftAsFound ? ` | left as found: ${JSON.stringify(r.leftAsFound)}` : ''}`,
  );
}
if (coverage.length) {
  const pct = (c, l) => (l ? ((100 * c) / l).toFixed(1).padStart(5) : '  -  ');
  console.log(
    `\ncoverage of src/ by ${only ? `the ${only} batch` : 'every batch'} (lines with code; tools/coverage.mjs)`,
  );
  for (const c of coverage.sort((a, b) => a.file.localeCompare(b.file))) {
    console.log(`${pct(c.covered, c.lines)}%  ${c.file.padEnd(34)} ${spans(c.uncovered)}`);
  }
  const sum = (dir, k) => coverage.filter((c) => c.file.startsWith(dir)).reduce((n, c) => n + c[k], 0);
  for (const dir of ['src/core/', 'src/foundry/']) {
    console.log(
      `${pct(sum(dir, 'covered'), sum(dir, 'lines'))}%  ${dir} (${sum(dir, 'covered')}/${sum(dir, 'lines')} lines)`,
    );
  }
}
cdp.close();
process.exit(r.results?.every((t) => t.ok) ? 0 : 1);
