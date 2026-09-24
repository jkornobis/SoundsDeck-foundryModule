import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PREVIEW_MAX_MS, previewPress } from '../../src/core/preview.mjs';

describe('a press on the headphones', () => {
  it('with nothing in the ear, starts that pad', () =>
    assert.deepEqual(previewPress(null, 'a'), { stop: false, start: 'a' }));
  it('on the pad already in the ear, stops it and starts nothing', () =>
    assert.deepEqual(previewPress('a', 'a'), { stop: true, start: null }));
  it('on another pad, replaces the one in the ear', () =>
    assert.deepEqual(previewPress('a', 'b'), { stop: true, start: 'b' }));
  it('a preview never outlasts 20 s', () => assert.equal(PREVIEW_MAX_MS, 20000));
});
