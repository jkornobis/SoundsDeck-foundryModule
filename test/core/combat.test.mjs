import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bedPosition, combatStart } from '../../src/core/combat.mjs';

const fight = { id: 'm1', name: 'Firefight', bed: 'b7', loops: [], random: [] };
const base = { byHand: false, auto: true, active: false, combatMoodId: 'm1', moods: [fight] };

describe('combatStart - whether a fight brings its mood', () => {
  it('the tracker starts it when the switch is on', () => assert.deepEqual(combatStart(base), { mood: fight }));
  it('with the switch off, only a hand start works', () => {
    assert.deepEqual(combatStart({ ...base, auto: false }), { skip: 'off' });
    assert.deepEqual(combatStart({ ...base, auto: false, byHand: true }), { mood: fight });
  });
  it('a second start while combat music plays does nothing, so "what played before" is not overwritten', () =>
    assert.deepEqual(combatStart({ ...base, active: true, byHand: true }), { skip: 'active' }));
  it('no combat mood chosen, or one deleted since, is said, not guessed', () => {
    assert.deepEqual(combatStart({ ...base, combatMoodId: '' }), { skip: 'no-mood' });
    assert.deepEqual(combatStart({ ...base, combatMoodId: 'gone' }), { skip: 'no-mood' });
  });
});

describe('bedPosition - where the music was', () => {
  it('the playing track of the playing bed, and its position', () =>
    assert.deepEqual(
      bedPosition([
        { id: 'b1', playing: false, sounds: [{ id: 's0', playing: false }] },
        {
          id: 'b5',
          playing: true,
          sounds: [
            { id: 's1', playing: false },
            { id: 's2', playing: true, at: 42.5 },
          ],
        },
      ]),
      { playlistId: 'b5', soundId: 's2', at: 42.5 },
    ));
  it('silence is null; a position not known yet is 0', () => {
    assert.equal(bedPosition([]), null);
    assert.deepEqual(bedPosition([{ id: 'b', playing: true, sounds: [{ id: 's', playing: true }] }]).at, 0);
  });
});
