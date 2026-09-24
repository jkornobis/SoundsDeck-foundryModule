import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { checkManifest, compareVersions } from '../../tools/check-manifest.mjs';

/** A throwaway module folder: a valid one by default, with any file overridden. */
function fixture(overrides = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'sd-manifest-'));
  const files = {
    'module.json': JSON.stringify({
      id: 'sounds-deck',
      version: '0.2.0',
      compatibility: { minimum: '14' },
      esmodules: ['src/sounds-deck.mjs'],
      styles: ['styles/sounds-deck.css'],
      languages: [
        { lang: 'en', path: 'lang/en.json' },
        { lang: 'fr', path: 'lang/fr.json' },
      ],
    }),
    'CHANGELOG.md': '# Changelog\n\n## 0.2.0 - unreleased\n',
    'src/sounds-deck.mjs': '',
    'styles/sounds-deck.css': '',
    'lang/en.json': '{"SD":{"A":"a","B":"b"}}',
    'lang/fr.json': '{"SD":{"A":"a","B":"b"}}',
    ...overrides,
  };
  for (const [f, body] of Object.entries(files)) {
    if (body === null) continue;
    mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    writeFileSync(path.join(root, f), body);
  }
  return root;
}
const withManifest = (patch) => {
  const base = {
    id: 'sounds-deck',
    version: '0.2.0',
    compatibility: { minimum: '14' },
    esmodules: ['src/sounds-deck.mjs'],
    styles: ['styles/sounds-deck.css'],
    languages: [
      { lang: 'en', path: 'lang/en.json' },
      { lang: 'fr', path: 'lang/fr.json' },
    ],
  };
  return { 'module.json': JSON.stringify({ ...base, ...patch }) };
};

describe('checkManifest', () => {
  it('a valid module passes, with no tag yet', () =>
    assert.deepEqual(checkManifest(fixture(), { latestTag: null }), []));
  it('a valid module newer than the last tag passes', () => {
    assert.deepEqual(checkManifest(fixture(), { latestTag: 'v0.1.0' }), []);
  });
  it('a version equal to the last tag fails - every release must move the number', () => {
    assert.match(checkManifest(fixture(), { latestTag: 'v0.2.0' }).join(), /not newer than the latest tag/);
  });
  it('a pre-release label fails - Foundry cannot compare it', () => {
    const p = checkManifest(fixture({ ...withManifest({ version: '0.2.0-beta.1' }) }), { latestTag: null });
    assert.match(p.join(), /without a label/);
  });
  it('a version with no changelog heading fails', () => {
    assert.match(
      checkManifest(fixture({ 'CHANGELOG.md': '# Changelog\n' }), { latestTag: null }).join(),
      /no "## 0.2.0"/,
    );
  });
  it('"## 0.2.0" does not satisfy version 0.2.00 by prefix, nor 0.2.0 by "## 0.2.01"', () => {
    assert.match(
      checkManifest(fixture({ 'CHANGELOG.md': '## 0.2.01\n' }), { latestTag: null }).join(),
      /no "## 0.2.0"/,
    );
  });
  it('a missing file named in the manifest fails', () => {
    assert.match(
      checkManifest(fixture({ 'styles/sounds-deck.css': null }), { latestTag: null }).join(),
      /styles\/sounds-deck.css .* missing/,
    );
  });
  it('a key missing in one language fails, naming the key', () => {
    const p = checkManifest(fixture({ 'lang/fr.json': '{"SD":{"A":"a"}}' }), { latestTag: null });
    assert.match(p.join(), /lang\/fr.json lacks SD.B/);
  });
  it('a key only in the second language fails too', () => {
    const p = checkManifest(fixture({ 'lang/fr.json': '{"SD":{"A":"a","B":"b","C":"c"}}' }), { latestTag: null });
    assert.match(p.join(), /has keys lang\/en.json lacks: SD.C/);
  });
  it('no compatibility.minimum fails', () => {
    assert.match(
      checkManifest(fixture(withManifest({ compatibility: {} })), { latestTag: null }).join(),
      /minimum is not set/,
    );
  });
  it('a wrong id fails', () => {
    assert.match(
      checkManifest(fixture(withManifest({ id: 'soundsdeck' })), { latestTag: null }).join(),
      /expected "sounds-deck"/,
    );
  });
});

describe('compareVersions', () => {
  it('compares numerically, not as text', () => assert.ok(compareVersions('0.10.0', '0.9.9') > 0));
  it('equal is zero', () => assert.equal(compareVersions('1.2.3', '1.2.3'), 0));
});
