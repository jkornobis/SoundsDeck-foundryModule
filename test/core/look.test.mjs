import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bankTabs, PAD_COLOURS, padLook, soloBank, tickBank } from '../../src/core/look.mjs';

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

describe('the board as tabs', () => {
  const banks = [
    { id: 'a', name: 'Loops' },
    { id: 'b', name: 'Events' },
    { id: 'c', name: 'Hits' },
  ];
  const ids = banks.map((b) => b.id);
  const shown = (hidden) =>
    bankTabs(banks, hidden)
      .filter((t) => t.shown)
      .map((t) => t.id);

  it('every bank shows until the seat hides one; a bank made later shows by itself', () => {
    assert.deepEqual(shown(undefined), ['a', 'b', 'c']);
    assert.deepEqual(shown(['b']), ['a', 'c']);
  });
  it('a list that hides everything shows everything, so the board is never empty', () =>
    assert.deepEqual(shown(['a', 'b', 'c']), ['a', 'b', 'c']));
  it("a click on a tab's name shows that bank alone; a second click shows every bank again", () => {
    const solo = soloBank(ids, [], 'b');
    assert.deepEqual(shown(solo), ['b']);
    assert.deepEqual(soloBank(ids, solo, 'b'), []);
  });
  it('a click on another tab while one shows alone moves to it', () =>
    assert.deepEqual(shown(soloBank(ids, ['a', 'c'], 'a')), ['a']));
  it('a tick adds a bank to what shows, and removes it', () => {
    const one = soloBank(ids, [], 'a');
    const two = tickBank(ids, one, 'c');
    assert.deepEqual(shown(two), ['a', 'c']);
    assert.deepEqual(shown(tickBank(ids, two, 'a')), ['c']);
  });
  it('the last bank showing cannot be unticked', () => assert.deepEqual(shown(tickBank(ids, ['a', 'b'], 'c')), ['c']));
  it('ids of banks deleted since are dropped', () => assert.deepEqual(tickBank(ids, ['gone'], 'a'), ['a']));
});
