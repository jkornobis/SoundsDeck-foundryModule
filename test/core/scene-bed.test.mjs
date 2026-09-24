import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideSceneBed, sceneAudioPlan } from '../../src/core/scene-bed.mjs';

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

describe('sceneAudioPlan - manual music survives a scene change (v0.4)', () => {
  const board = { playlistId: 'board', soundId: null };
  it('board scene -> doorway, nothing picked by hand: the board stops', () => {
    assert.deepEqual(sceneAudioPlan(board, null, ['board']), { verdict: 'stop', stop: [board], start: null });
  });
  it('board scene, Wrong picked by hand, -> doorway: Wrong plays on', () => {
    const plan = sceneAudioPlan(board, null, ['wrong']);
    assert.equal(plan.verdict, 'stop-scene-keep-picked');
    assert.ok(!plan.stop.some((s) => s.playlistId === 'wrong'));
  });
  it('doorway with Wrong picked by hand -> board scene: the board starts and Wrong stops (a bed is exclusive)', () => {
    const plan = sceneAudioPlan(null, board, ['wrong']);
    assert.equal(plan.verdict, 'start');
    assert.deepEqual(plan.stop, [{ playlistId: 'wrong', soundId: null }]);
    assert.deepEqual(plan.start, board);
  });
  it('board -> board keeps, even with another bed picked by hand', () => {
    assert.deepEqual(sceneAudioPlan(board, { ...board }, ['wrong']), { verdict: 'keep', stop: [], start: null });
  });
  it('board -> wrong scene: the board stops once, never twice', () => {
    const plan = sceneAudioPlan(board, { playlistId: 'wrong', soundId: null }, ['board']);
    assert.deepEqual(plan.stop, [board]);
  });
  it('the bed a scene is about to start is never in its own stop list', () => {
    const plan = sceneAudioPlan(null, board, ['board', 'wrong']);
    assert.ok(!plan.stop.some((s) => s.playlistId === 'board'));
  });
});
