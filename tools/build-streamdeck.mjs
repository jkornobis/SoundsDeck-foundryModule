#!/usr/bin/env node
/**
 * Build the Stream Deck profiles the module ships, into streamdeck/.
 *
 *   node tools/build-streamdeck.mjs
 *
 * The layouts are the Composer's (2026-09-25). Stream Deck + (8 keys, 4 dials): page 1 the eight beds, page 2 six
 * moods, Stop all and Open deck, page 3 tracks 1-8 of the bed that plays; the four dials are the four layer knobs on
 * every page (turn = level, press = mute). Swiping the touch strip changes page. The keys are exactly the shortcuts in
 * src/foundry/keys.mjs - if one changes there, this must be rebuilt.
 *
 * The format comes from his own export (tools/streamdeck.mjs). The standard Stream Deck profile waits for a second
 * seed: its pages need a "next page" key, and that action's identifier is published nowhere.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { KNOB_KEYS } from '../src/foundry/keys.mjs';
import { hotkey, hotkeyAction, profileFiles } from './streamdeck.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'streamdeck');

const bed = (n) => hotkeyAction(`bed${n}`, `Bed ${n}`, [hotkey(`Digit${n}`, ['Shift'])]);
const mood = (n) => hotkeyAction(`mood${n}`, `Mood ${n}`, [hotkey(`Digit${n}`, ['Control', 'Shift'])]);
const track = (n) => hotkeyAction(`track${n}`, `Track ${n}`, [hotkey(`Digit${n}`, ['Control', 'Alt'])]);
const stopAll = hotkeyAction('stopAll', 'Stop all', [hotkey('KeyX', ['Shift'])]);
const deck = hotkeyAction('open', 'Deck', [hotkey('KeyD', ['Shift'])]);
const TITLES = { bed: 'Music', toggle: 'Loops', cue: 'Events', oneshot: 'Effects' };
const dials = Object.fromEntries(
  Object.entries(KNOB_KEYS).map(([layer, keys], i) => [
    `${i},0`,
    hotkeyAction(
      `dial-${layer}`,
      TITLES[layer],
      keys.map((k) => hotkey(k)),
      { dial: true },
    ),
  ]),
);
/** Eight keys, four by two, from a list in reading order. */
const grid = (actions) => Object.fromEntries(actions.map((a, i) => [`${i % 4},${Math.floor(i / 4)}`, a]));
const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

const PROFILES = [
  {
    file: 'Sounds Deck - Stream Deck +.streamDeckProfile',
    name: 'Sounds Deck',
    model: '20GBD9901', // his Stream Deck +, from the seed
    pages: [
      { id: 'beds', keys: grid(range(8).map(bed)), dials },
      { id: 'moods', keys: grid([...range(6).map(mood), stopAll, deck]), dials },
      { id: 'tracks', keys: grid(range(8).map(track)), dials },
    ],
  },
];

mkdirSync(OUT, { recursive: true });
for (const p of PROFILES) {
  const stage = mkdtempSync(path.join(os.tmpdir(), 'sd-profile-'));
  for (const [file, json] of Object.entries(profileFiles(p))) {
    mkdirSync(path.join(stage, path.dirname(file)), { recursive: true });
    writeFileSync(path.join(stage, file), JSON.stringify(json));
  }
  const target = path.join(OUT, p.file);
  rmSync(target, { force: true });
  // -X: no file times or owners in the archive, so a rebuild of the same layout is the same bytes.
  execFileSync('zip', ['-qrX', target, '.'], { cwd: stage, env: { ...process.env, TZ: 'UTC' } });
  rmSync(stage, { recursive: true, force: true });
  console.log(`built streamdeck/${p.file}`);
}
