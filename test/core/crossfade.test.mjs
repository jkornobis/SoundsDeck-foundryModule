import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bedFadeMs, CROSSFADE_DEFAULT_S } from '../../src/core/crossfade.mjs';

const base = { isBed: true, otherBedPlaying: true, crossfadeS: 4, nativeMs: 3000 };

describe('the fade a bed uses', () => {
  it('while another bed plays - a switch - the deck crossfade, in ms', () => assert.equal(bedFadeMs(base), 4000));
  it('with no other bed playing, the track keeps its own fade', () =>
    assert.equal(bedFadeMs({ ...base, otherBedPlaying: false }), 3000));
  it('a sound that is not a bed keeps its own fade', () => assert.equal(bedFadeMs({ ...base, isBed: false }), 3000));
  it('never longer than half the sound, as Foundry', () => assert.equal(bedFadeMs({ ...base, durationS: 5 }), 3000));
  it('0 s cuts straight across', () => assert.equal(bedFadeMs({ ...base, crossfadeS: 0 }), 0));
  it('an unreadable setting falls back to the track', () =>
    assert.equal(bedFadeMs({ ...base, crossfadeS: Number.NaN }), 3000));
  it('the default is 4 s', () => assert.equal(CROSSFADE_DEFAULT_S, 4));
});
