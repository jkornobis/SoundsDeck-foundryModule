#!/usr/bin/env node
/**
 * Run the module's Quench batches in the live world and print the results - without installing the module.
 *
 *   node tools/quench-run.mjs
 *
 * Quench must be installed and active in the world (it is on the Composer's, since 2026-09-24). The batches in
 * test/quench/ are loaded into the gamemaster's page as blob-URL modules, registered, run with
 * quench.runBatches('sounds-deck.**'), and read back through the Mocha runner's own events.
 *
 * 🚨 QUENCH'S WINDOW MUST BE OPEN BEFORE A RUN on Foundry 14 (Quench 0.10.0 is verified for 13). Measured 2026-09-24:
 * with it closed, the run begins, QuenchResults.handleRunBegin reads an element that does not exist, throws, and
 * Mocha stalls with one failure counted and no test run - a hang, not an error. Opened first: the batch runs.
 *
 * ⚠️ Until the module is installed, Quench shows ONE error toast on registration ("invalid package name"): it
 * checks that a batch key starts with an installed package id. The batch registers and runs anyway.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { connect, unlockAudio } from './cdp.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIR = 'test/quench';
const files = (await readdir(path.join(ROOT, DIR))).filter((f) => f.endsWith('.mjs'));
const mods = [];
for (const f of files.sort((a, b) => (a === 'index.mjs') - (b === 'index.mjs'))) {
  const src = (await readFile(path.join(ROOT, DIR, f), 'utf8')).replace(
    /from '\.\/([^']+)'/g,
    (_m, dep) => `from '__MOD__${dep}__'`,
  );
  mods.push([f, src]);
}

const cdp = await connect();
await cdp.ev(
  '(async () => { await quench?.app?.render(true); await new Promise((r) => setTimeout(r, 1000)); return 1; })()',
);
const unlocked = await unlockAudio(cdp);
if (!unlocked) console.log('⚠️ audio contexts not running - the sound tests will fail for that reason, not Foundry');
const out = await cdp.ev(`(async () => {
  if (!globalThis.quench) return JSON.stringify({ refused: 'Quench is not active in this world' });
  const urls = {};
  for (const [f, src] of ${JSON.stringify(mods)}) {
    urls[f] = URL.createObjectURL(new Blob([src.replace(/__MOD__(.+?)__/g, (_m, d) => urls[d])], { type: 'text/javascript' }));
  }
  // Installed, the module registered its own batches at quenchReady; registering again would duplicate them.
  const installed = !!game.modules.get('sounds-deck')?.active;
  if (!installed) {
    const { registerBatches } = await import(urls['index.mjs']);
    registerBatches(quench);
  }
  const results = [];
  const pageErrors = [];
  const onErr = (e) => pageErrors.push(String(e.error?.stack ?? e.reason?.stack ?? e.message ?? e.reason).slice(0, 400));
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', onErr);
  const runner = await quench.runBatches('sounds-deck.**');
  // A hung run must not hang this tool: the first attempt stalled with one failure counted and nothing run.
  const ended = await Promise.race([
    new Promise((resolve) => {
      runner.on('pass', (t) => results.push({ ok: true, test: t.fullTitle(), ms: t.duration }));
      runner.on('pending', (t) => results.push({ ok: true, skipped: true, test: t.fullTitle() }));
      runner.on('fail', (t, err) => results.push({ ok: false, test: t.fullTitle(), error: String(err?.message ?? err).slice(0, 300) }));
      runner.once('end', () => resolve(true));
    }),
    new Promise((resolve) => setTimeout(() => resolve(false), 150000)),
  ]);
  window.removeEventListener('error', onErr);
  window.removeEventListener('unhandledrejection', onErr);
  if (!ended) {
    try { runner.abort(); } catch {}
    return JSON.stringify({ hung: { stats: runner.stats, pageErrors, results } });
  }
  for (const u of Object.values(urls)) URL.revokeObjectURL(u);
  return JSON.stringify({
    results,
    passed: results.filter((r) => r.ok && !r.skipped).length + ' passed, ' + results.filter((r) => !r.ok).length + ' failed, ' + results.filter((r) => r.skipped).length + ' skipped',
    sandboxLeft: !!game.playlists.getName('__sounds-deck-quench'),
    playing: game.playlists.filter((p) => p.playing).map((p) => p.name),
  });
})()`);
const r = JSON.parse(out);
if (r.refused) {
  console.log('REFUSED', r.refused);
} else if (r.hung) {
  console.log('HUNG', JSON.stringify(r.hung, null, 1));
} else {
  for (const t of r.results)
    console.log(
      `${t.skipped ? 'SKIP' : t.ok ? 'PASS' : 'FAIL'} ${t.test.replace(/sounds-deck\.[a-z-]+_root /, '')}${t.ok ? '' : `  -> ${t.error}`}`,
    );
  console.log(r.passed, '| sandbox left behind:', r.sandboxLeft, '| playing:', r.playing);
}
cdp.close();
process.exit(r.results?.every((t) => t.ok) ? 0 : 1);
