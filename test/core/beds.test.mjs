import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bedCards, bedNumbered, bedsToStop, nextInOrder } from '../../src/core/beds.mjs';
import { MODES } from '../../src/core/classify.mjs';

const pl = (id, name, mode, playing = false, sounds = []) => ({ id, name, mode, playing, sounds });
const s = (name, playing = false) => ({ id: name, name, playing });

describe('bedCards', () => {
  const world = [
    pl('b8', '8 · The Board', MODES.SHUFFLE, true, [s('Clue Two', true), s('Procedural')]),
    pl('fx', 'Effets · Fond (boucles)', MODES.SIMULTANEOUS),
    pl('b10', '10 · A tenth key', MODES.SHUFFLE),
    pl('b1', '1 · Bureau & Briefing', MODES.SHUFFLE, false, [s('A'), s('B'), s('C')]),
    pl('ev', '🎬 Long events', MODES.SEQUENTIAL),
    pl('ref', 'Référence · Millennium — Mark Snow', MODES.SEQUENTIAL),
  ];
  const cards = bedCards(world);

  it('shows beds only', () =>
    assert.deepEqual(
      cards.map((c) => c.id),
      ['b1', 'b8', 'b10'],
    ));
  it('orders by the NUMBER, so 10 comes after 8 (a text sort would put it after 1)', () => {
    assert.equal(cards.at(-1).name, '10 · A tenth key');
  });
  it('a playing bed names the track that is playing', () => {
    assert.deepEqual(cards[1], {
      id: 'b8',
      name: '8 · The Board',
      playing: true,
      nowPlaying: 'Clue Two',
      nowPlayingFrom: null,
      tracks: 2,
    });
  });
  it('a stopped bed names nothing and counts its tracks', () => {
    assert.deepEqual(cards[0], {
      id: 'b1',
      name: '1 · Bureau & Briefing',
      playing: false,
      nowPlaying: null,
      nowPlayingFrom: null,
      tracks: 3,
    });
  });
  it('an empty world draws no card', () => assert.deepEqual(bedCards([]), []));
});

describe('bedsToStop', () => {
  const cards = [
    { id: 'b1', playing: false },
    { id: 'b5', playing: true },
    { id: 'b8', playing: true },
  ];
  it('starting one bed stops every other playing bed', () => assert.deepEqual(bedsToStop(cards, 'b1'), ['b5', 'b8']));
  it('starting a bed that is already playing does not stop it', () =>
    assert.deepEqual(bedsToStop(cards, 'b8'), ['b5']));
  it('nothing playing, nothing to stop', () => assert.deepEqual(bedsToStop([{ id: 'x', playing: false }], 'y'), []));
});

describe('bedCards - where the playing track comes from (v0.4 note 9)', () => {
  it('the card carries the playing sound description', () => {
    const [card] = bedCards([
      pl('b5', '5 · Wrong', MODES.SHUFFLE, true, [
        { ...s('Apéritif', true), description: 'Hannibal — Brian Reitzell' },
      ]),
    ]);
    assert.equal(card.nowPlayingFrom, 'Hannibal — Brian Reitzell');
  });
});

describe('bedNumbered - the bed a number key reaches', () => {
  const cards = [
    { id: 'a', name: '1 · Bureau & Briefing' },
    { id: 'b', name: '5 · Wrong' },
    { id: 'c', name: '10 · Far' },
  ];
  it('the card whose name starts with the number', () => assert.equal(bedNumbered(cards, 5)?.id, 'b'));
  it('1 is not 10', () => assert.equal(bedNumbered(cards, 1)?.id, 'a'));
  it('no bed with that number is nothing', () => assert.equal(bedNumbered(cards, 7), null));
});

describe('nextInOrder - the track a bed plays next', () => {
  const order = ['c', 'a', 'd', 'b'];
  it('the one after it in the playback order', () => assert.equal(nextInOrder(order, 'a'), 'd'));
  it('the first again after the last', () => assert.equal(nextInOrder(order, 'b'), 'c'));
  it('nothing playing, one track, or a track not in the order: nothing to show', () => {
    assert.equal(nextInOrder(order, null), null);
    assert.equal(nextInOrder(['a'], 'a'), null);
    assert.equal(nextInOrder(order, 'z'), null);
  });
});
