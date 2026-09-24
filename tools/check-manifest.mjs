#!/usr/bin/env node
/**
 * The manifest half of "done": what `npm run check` verifies about module.json before anything is merged or released.
 *
 *   node tools/check-manifest.mjs            exit 0 if every rule holds, 1 otherwise
 *
 * THE RULES, and where each comes from:
 *   id          equals "sounds-deck" - the folder name Foundry installs into, and every template path's prefix
 *   version     MAJOR.MINOR.PATCH, no pre-release label: Foundry's isNewerVersion does not understand them
 *               (Package Best Practices Checklist, foundryvtt.wiki)
 *   version     strictly newer than the latest git tag, if there is one: "every change, even one that only changes
 *               the manifest, should increment something" (same checklist) - a release that re-uses a number is
 *               one Foundry will refuse to offer as an update
 *   changelog   CHANGELOG.md has a heading for this version
 *   compat      compatibility.minimum is set; verified, if set, is not below minimum
 *   files       every esmodules, styles and languages path exists - Foundry reports a missing one nowhere visible
 *   languages   every language file has exactly the same keys as the first: a string missing in one language shows
 *               its raw key to that table
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** @returns {number} <0, 0, >0 like a comparator; both arguments must match SEMVER */
export function compareVersions(a, b) {
  const pa = a.match(SEMVER).slice(1).map(Number);
  const pb = b.match(SEMVER).slice(1).map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

function flatKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

/**
 * @param {string} root             the repository root
 * @param {{ latestTag?: string | null }} [opts]  injected in tests; read from git otherwise
 * @returns {string[]}              one line per broken rule; empty = all hold
 */
export function checkManifest(root, opts = {}) {
  const problems = [];
  const read = (f) => readFileSync(path.join(root, f), 'utf8');
  let m;
  try {
    m = JSON.parse(read('module.json'));
  } catch (e) {
    return [`module.json unreadable: ${e.message}`];
  }

  if (m.id !== 'sounds-deck') problems.push(`id is "${m.id}", expected "sounds-deck"`);

  const v = String(m.version ?? '').replace(/^v/, '');
  if (!SEMVER.test(v)) problems.push(`version "${m.version}" is not MAJOR.MINOR.PATCH without a label`);
  else {
    const latestTag = 'latestTag' in opts ? opts.latestTag : gitLatestTag(root);
    const tag = latestTag?.replace(/^v/, '');
    if (tag && SEMVER.test(tag) && compareVersions(v, tag) <= 0) {
      problems.push(`version ${v} is not newer than the latest tag ${latestTag}`);
    }
    if (
      !existsSync(path.join(root, 'CHANGELOG.md')) ||
      !new RegExp(`^## ${v.replaceAll('.', '\\.')}\\b`, 'm').test(read('CHANGELOG.md'))
    ) {
      problems.push(`CHANGELOG.md has no "## ${v}" heading`);
    }
  }

  const min = m.compatibility?.minimum;
  if (!min) problems.push('compatibility.minimum is not set');
  const ver = m.compatibility?.verified;
  if (min && ver && Number.parseFloat(ver) < Number.parseFloat(min)) {
    problems.push(`compatibility.verified ${ver} is below minimum ${min}`);
  }

  const paths = [...(m.esmodules ?? []), ...(m.styles ?? []), ...(m.languages ?? []).map((l) => l.path)];
  for (const p of paths) if (!existsSync(path.join(root, p))) problems.push(`${p} is named in module.json and missing`);

  const langs = (m.languages ?? []).filter((l) => existsSync(path.join(root, l.path)));
  if (langs.length > 1) {
    const keys = langs.map((l) => new Set(flatKeys(JSON.parse(read(l.path)))));
    const [first, ...rest] = keys;
    rest.forEach((k, i) => {
      const missing = [...first].filter((x) => !k.has(x));
      const extra = [...k].filter((x) => !first.has(x));
      if (missing.length) problems.push(`${langs[i + 1].path} lacks ${missing.join(', ')}`);
      if (extra.length) problems.push(`${langs[i + 1].path} has keys ${langs[0].path} lacks: ${extra.join(', ')}`);
    });
  }
  return problems;
}

function gitLatestTag(root) {
  try {
    return execFileSync('git', ['describe', '--tags', '--abbrev=0'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null; // no tag yet: nothing to compare against
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(new URL('..', import.meta.url).pathname);
  const problems = checkManifest(root);
  for (const p of problems) console.error(`✗ ${p}`);
  if (problems.length) process.exit(1);
  console.log('✓ module.json: id, version, changelog, compatibility, files and languages all hold');
}
