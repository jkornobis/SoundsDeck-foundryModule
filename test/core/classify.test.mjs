import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classify, MODES } from '../../src/core/classify.mjs';

const { DISABLED, SEQUENTIAL, SHUFFLE, SIMULTANEOUS } = MODES;

describe('classify - the name places a playlist', () => {
  // The twelve playlists of the Delta Green world, read from it on 2026-09-24, with their real modes.
  const world = [
    ['1 · Bureau & Briefing', SHUFFLE, 'bed'],
    ['5 · Wrong', SHUFFLE, 'bed'],
    ['8 · The Board', SHUFFLE, 'bed'],
    ['Effets · Fond (boucles)', SIMULTANEOUS, null], // the names before 2026-09-24: no marker, not on the deck
    ['Effets · Évènements longs', SEQUENTIAL, null],
    ['🔁 Fond (boucles)', SIMULTANEOUS, 'bank'], // his names since: an emoji makes them banks
    ['🎞️ Évènements longs', SEQUENTIAL, 'bank'],
    ['Référence · Millennium — Mark Snow', SEQUENTIAL, null],
  ];
  for (const [name, mode, role] of world) {
    it(`${name} -> ${role ?? 'not on the deck'}`, () => assert.equal(classify(name, mode)?.role ?? null, role));
  }

  it('a number without the separator is not a bed ("2026 recordings")', () => {
    assert.equal(classify('2026 recordings', SHUFFLE), null);
  });
  it('a bed is a bed whatever its mode - the mode only sets the order', () => {
    for (const m of [SEQUENTIAL, SHUFFLE])
      assert.deepEqual(classify('3 · Out of Town', m), { role: 'bed', press: 'play' });
  });
  it('leading whitespace does not hide the marker', () => {
    assert.equal(classify('  🎬 Events', SEQUENTIAL)?.role, 'bank');
  });
  it('empty, null and undefined names are not on the deck', () => {
    for (const n of ['', null, undefined]) assert.equal(classify(n, SHUFFLE), null);
  });
});

describe('classify - the core mode decides what a press does', () => {
  const cases = [
    ['🔫 One-shots', DISABLED, 'oneshot'],
    ['🌧️ Room loops', SIMULTANEOUS, 'toggle'], // with the U+FE0F variation selector, as typed on most keyboards
    ['🌧 Room loops', SIMULTANEOUS, 'toggle'], // and without it
    ['🎬 Long events', SEQUENTIAL, 'cue'],
    ['🎲 Random stingers', SHUFFLE, null], // a bank with no press is shown greyed, never guessed
  ];
  for (const [name, mode, press] of cases) {
    it(`${name} -> ${press}`, () => assert.deepEqual(classify(name, mode), { role: 'bank', press }));
  }
  it('a keycap emoji ("1️⃣") is a bank, not a bed, though it starts with a digit', () => {
    assert.equal(classify('1️⃣ First cue', SEQUENTIAL)?.role, 'bank');
  });
  it('an unknown mode on a bank gives no press rather than a wrong one', () => {
    assert.equal(classify('🎬 X', 99).press, null);
  });
});
