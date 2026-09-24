import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MODES } from '../../src/core/classify.mjs';
import {
  bedVolume,
  clock,
  DUCK_DB,
  dbToGain,
  LAYERS,
  LEVELS_DEFAULT,
  layerOf,
  mixVolume,
  nowPlaying,
  shouldDuck,
  transportChanges,
  transportCues,
} from '../../src/core/cues.mjs';

const pl = (id, name, mode, sounds) => ({ id, name, mode, sounds });
const s = (id, extra = {}) => ({ id, name: id, playing: false, ...extra });

describe('ducking arithmetic', () => {
  it('his 10 dB is a gain of about 0.316', () => assert.ok(Math.abs(dbToGain(DUCK_DB) - 0.3162) < 0.0001));
  it('0 dB changes nothing', () => assert.equal(dbToGain(0), 1));
  it('a ducked bed at 0.6 sits near 0.19; undocked it stays 0.6', () => {
    assert.ok(Math.abs(bedVolume(0.6, true) - 0.1897) < 0.001);
    assert.equal(bedVolume(0.6, false), 0.6);
  });
  it('a missing volume is silence, not NaN', () => assert.equal(bedVolume(undefined, true), 0));
});

describe('shouldDuck', () => {
  const events = (sounds) => pl('ev', '🎞️ Évènements longs', MODES.SEQUENTIAL, sounds);
  it('a playing cue ducks', () => assert.equal(shouldDuck([events([s('a', { playing: true })])]), true));
  it('no cue playing, no duck', () => assert.equal(shouldDuck([events([s('a')])]), false));
  it('a cue that opts out does not duck', () => {
    assert.equal(shouldDuck([events([s('a', { playing: true, duck: false })])]), false);
  });
  it('a playing room loop is not a cue and does not duck', () => {
    assert.equal(
      shouldDuck([pl('lp', '🔁 Fond (boucles)', MODES.SIMULTANEOUS, [s('rain', { playing: true })])]),
      false,
    );
  });
  it('a playing BED is not a cue and does not duck itself', () => {
    assert.equal(shouldDuck([pl('b5', '5 · Wrong', MODES.SHUFFLE, [s('x', { playing: true })])]), false);
  });
  it('a sequential playlist without the emoji is not a bank, so not a cue', () => {
    assert.equal(shouldDuck([pl('r', 'Référence · Millennium', MODES.SEQUENTIAL, [s('x', { playing: true })])]), false);
  });
});

describe('transportCues', () => {
  const ev = pl('ev', '🎞️ Évènements longs', MODES.SEQUENTIAL, [
    s('at-risk', { playing: true }),
    s('clue-one', { pausedTime: 42.5 }),
    s('never', {}),
  ]);
  it('shows the playing cue and the paused one, not the untouched one', () => {
    assert.deepEqual(
      transportCues([ev]).map((c) => [c.soundId, c.state, c.pausedTime]),
      [
        ['at-risk', 'playing', null],
        ['clue-one', 'paused', 42.5],
      ],
    );
  });
  it('a room loop never appears on the transport', () => {
    assert.deepEqual(transportCues([pl('lp', '🔁 Fond', MODES.SIMULTANEOUS, [s('rain', { playing: true })])]), []);
  });
});

describe('clock', () => {
  it('formats minutes and seconds', () => assert.equal(clock(125.9), '2:05'));
  it('guards nonsense', () => {
    for (const v of [-3, NaN, undefined, Infinity]) assert.equal(clock(v), '0:00');
  });
});

describe('transportChanges - what a screen reader hears (v0.4 note 10)', () => {
  const c = (soundId, state) => ({ playlistId: 'ev', soundId, name: soundId, state });
  it('a cue appearing and playing is announced as started', () => {
    assert.deepEqual(transportChanges([], [c('at-risk', 'playing')]), [{ kind: 'started', name: 'at-risk' }]);
  });
  it('playing -> paused is announced as paused; paused -> playing as started again', () => {
    assert.deepEqual(transportChanges([c('a', 'playing')], [c('a', 'paused')]), [{ kind: 'paused', name: 'a' }]);
    assert.deepEqual(transportChanges([c('a', 'paused')], [c('a', 'playing')]), [{ kind: 'started', name: 'a' }]);
  });
  it('a cue leaving the transport is announced as stopped', () => {
    assert.deepEqual(transportChanges([c('a', 'playing')], []), [{ kind: 'stopped', name: 'a' }]);
  });
  it('nothing changed, nothing said', () => {
    assert.deepEqual(transportChanges([c('a', 'playing')], [c('a', 'playing')]), []);
  });
});

describe('nowPlaying - the list above the beds (after first use)', () => {
  const lists = [
    pl('b5', '5 · Wrong', MODES.SHUFFLE, [s('Apéritif', { playing: true, volume: 0.6 }), s('Sorbet')]),
    pl('ev', '🎞️ Évènements longs', MODES.SEQUENTIAL, [
      s('At Risk', { playing: true, volume: 0.7 }),
      s('Clue One', { pausedTime: 12 }),
    ]),
    pl('lp', '🔁 Fond (boucles)', MODES.SIMULTANEOUS, [s('Rain', { playing: true, volume: 0.3 })]),
    pl('sh', '💥 Ponctuels', MODES.DISABLED, [s('Gunshot', { playing: true, volume: 0.4 })]),
    pl('ref', 'Référence · X', MODES.SEQUENTIAL, [s('Not on the deck', { playing: true })]),
  ];
  const now = nowPlaying(lists);
  it('lists everything sounding on the deck, beds first, then events, loops, one-shots', () => {
    assert.deepEqual(
      now.map((x) => [x.kind, x.name, x.state]),
      [
        ['bed', 'Apéritif', 'playing'],
        ['cue', 'At Risk', 'playing'],
        ['cue', 'Clue One', 'paused'],
        ['toggle', 'Rain', 'playing'],
        ['oneshot', 'Gunshot', 'playing'],
      ],
    );
  });
  it('says where each comes from and carries its volume', () => {
    assert.deepEqual({ from: now[0].from, volume: now[0].volume }, { from: '5 · Wrong', volume: 0.6 });
  });
  it('a playlist that is not on the deck is not listed', () =>
    assert.ok(!now.some((x) => x.from.startsWith('Référence'))));
  it('silence is an empty list', () => assert.deepEqual(nowPlaying([]), []));
});

describe('layer levels (0.6, note 2)', () => {
  it('a level scales the sound; the duck applies to a bed on top of it', () => {
    assert.equal(mixVolume(0.8, 'toggle', { toggle: 0.5 }, true), 0.4);
    assert.ok(Math.abs(mixVolume(0.8, 'bed', { bed: 0.5 }, true) - 0.4 * dbToGain(DUCK_DB)) < 1e-9);
  });
  it('no levels, a missing layer or a nonsense value count as full', () => {
    assert.equal(mixVolume(0.6, 'cue', undefined, false), 0.6);
    assert.equal(mixVolume(0.6, 'cue', { bed: 0.1 }, false), 0.6);
    assert.equal(mixVolume(0.6, 'cue', { cue: 'loud' }, false), 0.6);
  });
  it('a level is held between 0 and 1', () => {
    assert.equal(mixVolume(0.5, 'oneshot', { oneshot: 3 }, false), 0.5);
    assert.equal(mixVolume(0.5, 'oneshot', { oneshot: -1 }, false), 0);
  });
  it('the layer of a playlist follows the deck rule', () => {
    assert.equal(layerOf('3 · Out of Town', MODES.SHUFFLE), 'bed');
    assert.equal(layerOf('🔁 Loops', MODES.SIMULTANEOUS), 'toggle');
    assert.equal(layerOf('🎞️ Events', MODES.SEQUENTIAL), 'cue');
    assert.equal(layerOf('💥 Hits', MODES.DISABLED), 'oneshot');
    assert.equal(layerOf('🎲 Shuffled', MODES.SHUFFLE), null);
    assert.equal(layerOf('Not on the deck', MODES.SEQUENTIAL), null);
  });
  it('the four layers and their defaults agree', () => assert.deepEqual(Object.keys(LEVELS_DEFAULT), [...LAYERS]));
});
