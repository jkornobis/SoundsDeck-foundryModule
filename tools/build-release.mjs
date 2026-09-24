#!/usr/bin/env node
/**
 * Build what a release publishes: dist/module.json and dist/module.zip, for one version, at one fixed address.
 *
 *   node tools/build-release.mjs <owner/repo> <tag>        e.g. jkornobis/SoundsDeck-foundryModule v0.1.0
 *
 * Run by .github/workflows/release.yml on the public GitHub mirror when a v* tag arrives; runnable here to see
 * exactly what would ship.
 *
 * 🚨 THE ADDRESSES ARE PINNED TO THE VERSION, "latest" NOWHERE. manifest and download both point at this tag's own
 * release. Foundry therefore never offers an update by itself: moving to a new version is installing that version's
 * manifest, and going back is installing the previous one. (Auditorium note 6; the trap it avoids is measured in
 * FoundryVTT-KnowledgeDB, agent-manual/subsystems/modules.md: a "latest" manifest moves a working world on reinstall.)
 *
 * WHAT SHIPS is a list, not "everything but": the manifest, the code, the templates, the languages, the styles, the
 * Quench batches (imported only when Quench is active), README and CHANGELOG. Never tools/, docs/, node_modules/.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [repo, tag] = process.argv.slice(2);
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || !/^v\d+\.\d+\.\d+$/.test(tag ?? '')) {
  console.error('usage: build-release.mjs <owner/repo> <vMAJOR.MINOR.PATCH>');
  process.exit(2);
}
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const STAGE = path.join(DIST, 'stage');
const SHIP = ['src', 'templates', 'lang', 'styles', 'test/quench', 'README.md', 'CHANGELOG.md'];

const manifest = JSON.parse(readFileSync(path.join(ROOT, 'module.json'), 'utf8'));
if (`v${manifest.version}` !== tag) {
  console.error(`tag ${tag} does not match module.json version ${manifest.version}`);
  process.exit(1);
}
const base = `https://github.com/${repo}`;
Object.assign(manifest, {
  url: base,
  manifest: `${base}/releases/download/${tag}/module.json`,
  download: `${base}/releases/download/${tag}/module.zip`,
  readme: `${base}/blob/${tag}/README.md`,
  changelog: `${base}/blob/${tag}/CHANGELOG.md`,
  bugs: `${base}/issues`,
});

rmSync(DIST, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
for (const p of SHIP) cpSync(path.join(ROOT, p), path.join(STAGE, p), { recursive: true });
const json = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(path.join(STAGE, 'module.json'), json);
writeFileSync(path.join(DIST, 'module.json'), json);
// module.json at the ROOT of the zip: Foundry extracts the archive into modules/<id>/ as it is.
execFileSync('zip', ['-qr', path.join(DIST, 'module.zip'), '.'], { cwd: STAGE });

// Release notes: this version's section of the changelog, and nothing else.
const log = readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
const section = log
  .split(/^## /m)
  .find((s) => s.startsWith(`${manifest.version} `) || s.startsWith(`${manifest.version}\n`));
writeFileSync(
  path.join(DIST, 'notes.md'),
  `${section ? section.split('\n').slice(1).join('\n').trim() : ''}\n\n**Install this version:** ${manifest.manifest}\n`,
);
rmSync(STAGE, { recursive: true, force: true });
console.log(`built ${tag}: dist/module.json, dist/module.zip, dist/notes.md`);
console.log(`install from: ${manifest.manifest}`);
