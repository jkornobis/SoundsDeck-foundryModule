import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isMuted, KNOB_STEP, nudgeLevel, setLevel, toggleMute } from '../../src/core/levels.mjs';

// Foundry 14's own curve (AudioHelper, order 1.5), as the shell passes it
const scale = { toInput: (v) => v ** (1 / 1.5), toVolume: (i) => i ** 1.5 };
const full = { bed: 1, toggle: 1, cue: 1, oneshot: 1 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

describe('a knob notch', () => {
  it('moves the slider by one step: down from full is 0.95 on the slider', () => {
    const next = nudgeLevel(full, 'bed', -1, scale);
    close(scale.toInput(next.bed), 1 - KNOB_STEP);
    assert.equal(next.toggle, 1);
  });
  it('up from full stays full, down from silence stays silent', () => {
    assert.equal(nudgeLevel(full, 'cue', 1, scale).cue, 1);
    assert.equal(nudgeLevel({ ...full, cue: 0 }, 'cue', -1, scale).cue, 0);
  });
  it('turning a muted layer starts from silence and unmutes it', () => {
    const muted = toggleMute({ ...full, bed: 0.6 }, 'bed');
    const next = nudgeLevel(muted, 'bed', 1, scale);
    close(scale.toInput(next.bed), KNOB_STEP);
    assert.equal(isMuted(next, 'bed'), false);
  });
});

describe('a knob press', () => {
  it('mutes the layer and remembers its level', () => {
    const muted = toggleMute({ ...full, toggle: 0.4 }, 'toggle');
    assert.equal(muted.toggle, 0);
    assert.equal(isMuted(muted, 'toggle'), true);
    assert.equal(muted.bed, 1);
  });
  it('pressed again, brings that level back and forgets it', () => {
    const back = toggleMute(toggleMute({ ...full, toggle: 0.4 }, 'toggle'), 'toggle');
    assert.equal(back.toggle, 0.4);
    assert.equal(back.muted, undefined);
  });
  it('two layers muted at once come back independently', () => {
    const both = toggleMute(toggleMute({ ...full, bed: 0.5, cue: 0.7 }, 'bed'), 'cue');
    const bedBack = toggleMute(both, 'bed');
    assert.equal(bedBack.bed, 0.5);
    assert.equal(isMuted(bedBack, 'cue'), true);
  });
});

describe('a slider', () => {
  it('sets a level and ends a mute on that layer only', () => {
    const muted = toggleMute(toggleMute(full, 'bed'), 'cue');
    const next = setLevel(muted, 'bed', 0.3);
    assert.equal(next.bed, 0.3);
    assert.equal(isMuted(next, 'bed'), false);
    assert.equal(isMuted(next, 'cue'), true);
  });
  it('anything out of range or unreadable is cleaned', () => {
    const next = setLevel({ bed: 7, toggle: 'x', muted: { nope: 1, cue: Number.NaN } }, 'oneshot', -1);
    assert.deepEqual(next, { bed: 1, toggle: 1, cue: 1, oneshot: 0 });
  });
});
