import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { eventsOf, GAME_EVENTS, padFor, weaponNames } from '../../src/core/events.mjs';

describe('eventsOf - what a chat message rolled', () => {
  it('a critical success, a critical failure, a plain roll', () => {
    assert.deepEqual(eventsOf([{ kind: 'percentile', critical: true, success: true }]), [{ event: 'critSuccess' }]);
    assert.deepEqual(eventsOf([{ kind: 'percentile', critical: true, success: false }]), [{ event: 'critFailure' }]);
    assert.deepEqual(eventsOf([{ kind: 'percentile', critical: false, success: true }]), []);
  });
  it('a SAN damage roll is a Sanity loss; a weapon roll keeps its weapon', () => {
    assert.deepEqual(eventsOf([{ kind: 'sanity' }]), [{ event: 'sanityLoss' }]);
    assert.deepEqual(eventsOf([{ kind: 'weapon', weapon: 'Glock 17' }]), [{ event: 'weapon', weapon: 'Glock 17' }]);
  });
  it('anything else is nothing, and one message plays an event once', () => {
    assert.deepEqual(eventsOf([{ kind: 'other' }]), []);
    assert.deepEqual(eventsOf([{ kind: 'sanity' }, { kind: 'sanity' }]), [{ event: 'sanityLoss' }]);
  });
  it('the four events of his design', () =>
    assert.deepEqual(GAME_EVENTS, ['critSuccess', 'critFailure', 'sanityLoss', 'weapon']));
});

describe('weaponNames', () => {
  it('a comma list, trimmed, case folded, blanks dropped', () =>
    assert.deepEqual(weaponNames(' Glock 17, SHOTGUN,, '), ['glock 17', 'shotgun']));
  it('nothing is no names', () => assert.deepEqual(weaponNames(undefined), []));
});

describe('padFor - which pad answers an event', () => {
  const pads = [
    { playlistId: 'fx', soundId: 'choir', event: 'critSuccess' },
    { playlistId: 'fx', soundId: 'bells', event: 'critSuccess' },
    { playlistId: 'fx', soundId: 'bang', event: 'weapon', weapons: [] },
    { playlistId: 'fx', soundId: 'glock', event: 'weapon', weapons: ['glock 17'] },
    { playlistId: 'fx', soundId: 'plain', event: '' },
  ];
  it('several pads on one event: a random pick among them', () => {
    assert.equal(padFor(pads, { event: 'critSuccess' }, () => 0).soundId, 'choir');
    assert.equal(padFor(pads, { event: 'critSuccess' }, () => 0.99).soundId, 'bells');
  });
  it('a weapon with its own pad plays it; any other weapon plays the pad for any weapon', () => {
    assert.equal(padFor(pads, { event: 'weapon', weapon: 'Glock 17' }).soundId, 'glock');
    assert.equal(padFor(pads, { event: 'weapon', weapon: 'Shotgun' }).soundId, 'bang');
    assert.equal(padFor(pads, { event: 'weapon', weapon: null }).soundId, 'bang');
  });
  it('an event no pad answers plays nothing', () => assert.equal(padFor(pads, { event: 'sanityLoss' }), null));
});
