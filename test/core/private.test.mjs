import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MONITOR_SHARE, privateAudio, recipientsOf } from '../../src/core/private.mjs';

const full = { bed: 1, toggle: 1, cue: 1, oneshot: 1 };

describe('a private sound', () => {
  it('goes at the level the table would hear from that pad, once, on its own channel', () => {
    const data = privateAudio({
      path: 'a.ogg',
      volume: 0.8,
      layer: 'oneshot',
      levels: { ...full, oneshot: 0.5 },
      channel: 'environment',
    });
    assert.deepEqual(data, { src: 'a.ogg', volume: 0.4, loop: false, channel: 'environment' });
  });
  it('a sound with no channel of its own goes on the music channel, as Foundry plays a playlist', () => {
    assert.equal(privateAudio({ path: 'a', volume: 1, layer: 'cue', levels: full }).channel, 'music');
  });
  it("the GM's own copy is quieter than the players'", () => assert.ok(MONITOR_SHARE > 0 && MONITOR_SHARE < 1));
});

describe('who receives it', () => {
  const users = [
    { id: 'gm', active: true },
    { id: 'p1', active: true },
    { id: 'p2', active: false },
    { id: 'p3', active: true },
  ];
  it('the chosen players that are connected', () => assert.deepEqual(recipientsOf(users, ['p1', 'p2'], 'gm'), ['p1']));
  it('never the sender, even when ticked', () => assert.deepEqual(recipientsOf(users, ['gm', 'p3'], 'gm'), ['p3']));
  it('nobody chosen, nobody receives it', () => assert.deepEqual(recipientsOf(users, [], 'gm'), []));
});
