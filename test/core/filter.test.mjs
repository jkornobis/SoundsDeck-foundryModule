import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fold, matches } from '../../src/core/filter.mjs';

describe('filter', () => {
  it('folds case and accents', () => assert.equal(fold('Évènements Longs'), 'evenements longs'));
  it('blank matches everything', () => {
    for (const q of ['', '   ', undefined]) assert.equal(matches(q, 'Gunshot'), true);
  });
  it('finds a pad by part of its name, whatever the case', () => assert.equal(matches('GLASS', 'Glass break 2'), true));
  it('finds across accents', () => assert.equal(matches('evenement', 'At Risk', '🎞️ Évènements longs'), true));
  it('every word must appear, in the pad or its bank', () => {
    assert.equal(matches('pistol indoors', 'Pistol shot, indoors'), true);
    assert.equal(matches('pistol outdoors', 'Pistol shot, indoors'), false);
    assert.equal(matches('ponctuels heart', 'Heartbeat', '💥 Ponctuels'), true);
  });
  it('a word nowhere hides the pad', () => assert.equal(matches('violin', 'Door creak 1', '💥 Ponctuels'), false));
});
