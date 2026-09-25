import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PAD_COLOURS, padLook, toggleFold } from '../../src/core/look.mjs';

describe("a pad's look", () => {
  it('a colour of the palette and an icon', () =>
    assert.deepEqual(padLook({ colour: 'red', icon: '🔫' }), { colour: 'red', icon: '🔫' }));
  it('six colours, and nothing outside them', () => {
    assert.equal(PAD_COLOURS.length, 6);
    assert.equal(padLook({ colour: '#ff0000' }).colour, null);
    assert.equal(padLook({ colour: 'pink' }).colour, null);
  });
  it('an emoji built from several code points counts as one; at most two are kept', () => {
    assert.equal(padLook({ icon: '👨‍👩‍👧' }).icon, '👨‍👩‍👧');
    assert.equal(padLook({ icon: ' 🔥💥🌧️ ' }).icon, '🔥💥');
  });
  it('nothing set is no colour and no icon', () => {
    for (const flag of [undefined, null, {}, { colour: '', icon: '  ' }])
      assert.deepEqual(padLook(flag), { colour: null, icon: null });
  });
});

describe('folding a bank', () => {
  it('a press folds it, the next unfolds it', () => {
    const once = toggleFold([], 'b1');
    assert.deepEqual(once, ['b1']);
    assert.deepEqual(toggleFold(once, 'b1'), []);
  });
  it('other folded banks stay folded; a missing list starts empty', () => {
    assert.deepEqual(toggleFold(['b1'], 'b2'), ['b1', 'b2']);
    assert.deepEqual(toggleFold(undefined, 'b1'), ['b1']);
  });
});
