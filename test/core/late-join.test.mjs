import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CATCH_UP_LAYERS,
  CATCH_UP_MIN_S,
  catchUpOffset,
  heardMark,
  onlyStartMark,
  startMark,
} from '../../src/core/late-join.mjs';

const NOW = 1_000_000;

describe('startMark - the moment a start records', () => {
  it('a stopped sound set playing starts now', () =>
    assert.equal(startMark({ playing: true }, { playing: false }, NOW), NOW));
  it('resumed from a pause, it started that far back', () =>
    assert.equal(startMark({ playing: true }, { playing: false, pausedTime: 12 }, NOW), NOW - 12000));
  it("the update's own pausedTime wins over the sound's (playNext clears it)", () =>
    assert.equal(startMark({ playing: true, pausedTime: null }, { playing: false, pausedTime: 12 }, NOW), NOW));
  it('a sound already playing, sent "playing" again, is not a start', () =>
    assert.equal(startMark({ playing: true }, { playing: true }, NOW), null));
  it('unless Foundry replays the same sound', () =>
    assert.equal(startMark({ playing: true }, { playing: true }, NOW, { restart: true }), NOW));
  it('a stop, or a change that does not touch playing, is not a start', () => {
    assert.equal(startMark({ playing: false }, { playing: true }, NOW), null);
    assert.equal(startMark({ volume: 0.4 }, { playing: false }, NOW), null);
    assert.equal(startMark(undefined, { playing: false }, NOW), null);
  });
});

describe('catchUpOffset - where a late joiner comes in', () => {
  const base = { joinedAt: NOW, now: NOW + 5000 };
  it('a track started 60 s before the join, 5 s ago, comes in at 65 s', () =>
    assert.equal(catchUpOffset({ ...base, startedAt: NOW - 60000, duration: 300 }), 65));
  it('a loop comes in where its turn has reached', () =>
    assert.equal(catchUpOffset({ ...base, startedAt: NOW - 60000, duration: 30, loop: true }), 5));
  it('a track past its end comes in at its end, so it ends', () =>
    assert.equal(catchUpOffset({ ...base, startedAt: NOW - 600000, duration: 300 }), 300));
  it('a trimmed track counts from its Start, within its section', () => {
    const trim = { start: 10, end: 40 };
    assert.equal(catchUpOffset({ ...base, startedAt: NOW - 15000, duration: 300, trim }), 30);
    assert.equal(catchUpOffset({ ...base, startedAt: NOW - 35000, duration: 300, loop: true, trim }), 20);
  });
  it('a sound started after the join plays the way Foundry would', () =>
    assert.equal(catchUpOffset({ ...base, startedAt: NOW + 1000, duration: 300 }), null));
  it(`less than ${CATCH_UP_MIN_S} s behind is not worth a jump`, () =>
    assert.equal(catchUpOffset({ joinedAt: NOW, now: NOW + 500, startedAt: NOW - 1000, duration: 300 }), null));
  it('no mark, no catch-up', () => assert.equal(catchUpOffset({ ...base, startedAt: undefined, duration: 300 }), null));
  it('a length not known yet: a track still comes in by elapsed time, a loop cannot be placed', () => {
    assert.equal(catchUpOffset({ ...base, startedAt: NOW - 60000 }), 65);
    assert.equal(catchUpOffset({ ...base, startedAt: NOW - 60000, loop: true }), null);
  });
  it('a nonsense trim is left to Foundry', () =>
    assert.equal(
      catchUpOffset({ ...base, startedAt: NOW - 60000, duration: 300, trim: { start: 50, end: 20 } }),
      null,
    ));
  it('beds, loops and events catch up; one-shots do not', () =>
    assert.deepEqual(CATCH_UP_LAYERS, ['bed', 'toggle', 'cue']));
});

describe('heardMark - the mark as the gamemaster heard it', () => {
  it('a track that loaded for 7 s before playing is marked when it played', () =>
    assert.equal(heardMark(NOW + 7000, 0, NOW), NOW + 7000));
  it('resumed at 12 s, it counts from its position', () => assert.equal(heardMark(NOW, 12, null), NOW - 12000));
  it('a mark within half a second of what was heard is left alone', () =>
    assert.equal(heardMark(NOW + 300, 0, NOW), null));
  it('no position, no correction', () => assert.equal(heardMark(NOW, Number.NaN, NOW - 9000), null));
});

describe('onlyStartMark - an update with nothing to redraw', () => {
  it('the start mark alone', () =>
    assert.equal(onlyStartMark({ _id: 'x', flags: { 'sounds-deck': { startedAt: 5 } } }), true));
  it('anything else with it, or anything else at all, is drawn', () => {
    assert.equal(onlyStartMark({ _id: 'x', playing: true, flags: { 'sounds-deck': { startedAt: 5 } } }), false);
    assert.equal(onlyStartMark({ flags: { 'sounds-deck': { startedAt: 5, look: {} } } }), false);
    assert.equal(onlyStartMark({ flags: { other: { startedAt: 5 } } }), false);
    assert.equal(onlyStartMark({ volume: 0.4 }), false);
    assert.equal(onlyStartMark(undefined), false);
  });
});
