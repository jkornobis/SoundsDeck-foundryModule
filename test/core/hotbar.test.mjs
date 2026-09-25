import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PAD_DRAG, padDrop, padMacro } from '../../src/core/hotbar.mjs';

describe('a pad on the hotbar', () => {
  it('becomes a script macro that presses it through the module api', () => {
    const m = padMacro('pl1', 'snd1', 'Gunfire');
    assert.equal(m.type, 'script');
    assert.equal(m.name, 'Gunfire');
    assert.equal(m.command, `game.modules.get('sounds-deck')?.api?.press("pl1", "snd1");`);
  });
  it('quotes the ids, so no id can break out of the call', () => {
    assert.ok(padMacro('a"b', 'c', 'x').command.includes('press("a\\"b", "c")'));
  });
  it('only a pad dragged out of the deck is taken', () => {
    assert.deepEqual(padDrop({ type: PAD_DRAG, playlistId: 'p', soundId: 's' }), { playlistId: 'p', soundId: 's' });
    for (const d of [null, { type: 'Macro', uuid: 'x' }, { type: PAD_DRAG, playlistId: 1, soundId: 's' }]) {
      assert.equal(padDrop(d), null);
    }
  });
});
