import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideSceneBed } from '../../src/core/scene-bed.mjs';

const board = { playlistId: 'board', soundId: null };

describe('decideSceneBed', () => {
  it('doorway -> board scene starts the bed', () => assert.equal(decideSceneBed(null, board), 'start'));
  it('board scene -> doorway stops it', () => assert.equal(decideSceneBed(board, null), 'stop'));
  it('doorway -> doorway does nothing', () => assert.equal(decideSceneBed(null, null), 'none'));

  // 🚨 The case Foundry 14.368 gets wrong: two scenes on the same bed. Measured there as a restart on a new track.
  it('board -> board KEEPS the bed playing', () => assert.equal(decideSceneBed(board, { ...board }), 'keep'));

  it('a different bed switches', () =>
    assert.equal(decideSceneBed(board, { playlistId: 'wrong', soundId: null }), 'switch'));
  it('same bed, next scene names no sound: keep whatever is playing', () => {
    assert.equal(decideSceneBed({ playlistId: 'board', soundId: 's1' }, board), 'keep');
  });
  it('same bed, next scene names the same sound: keep', () => {
    assert.equal(
      decideSceneBed({ playlistId: 'board', soundId: 's1' }, { playlistId: 'board', soundId: 's1' }),
      'keep',
    );
  });
  it('same bed, next scene names another sound: switch to it', () => {
    assert.equal(
      decideSceneBed({ playlistId: 'board', soundId: 's1' }, { playlistId: 'board', soundId: 's2' }),
      'switch',
    );
  });
  it("Foundry's own bug shape - soundId undefined on one side - still keeps", () => {
    assert.equal(decideSceneBed({ playlistId: 'board', soundId: undefined }, board), 'keep');
  });
  it('a state with no playlist id counts as no bed', () => {
    assert.equal(decideSceneBed({ playlistId: '', soundId: null }, board), 'start');
  });
});
