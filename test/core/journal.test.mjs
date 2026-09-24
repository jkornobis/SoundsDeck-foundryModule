import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appendEntry, JOURNAL_CAP, summarise } from '../../src/core/journal.mjs';

const e = (kind, name, bank) => ({ at: '2026-09-24T20:00:00Z', kind, name, ...(bank ? { bank } : {}) });

describe('appendEntry', () => {
  it('appends to a new list, leaving the old one untouched', () => {
    const old = [e('bed', '5 · Wrong')];
    const next = appendEntry(old, e('oneshot', 'Gunshot', '💥 Ponctuels'));
    assert.equal(old.length, 1);
    assert.equal(next.length, 2);
  });
  it('drops the oldest beyond the cap', () => {
    let list = [];
    for (let i = 0; i < 5; i++) list = appendEntry(list, e('bed', String(i)), 3);
    assert.deepEqual(
      list.map((x) => x.name),
      ['2', '3', '4'],
    );
  });
  it('a stored value that is not a list starts a fresh one', () =>
    assert.equal(appendEntry(null, e('bed', 'x')).length, 1));
  it('the default cap is about ten long sessions', () => assert.equal(JOURNAL_CAP, 2000));
});

describe('summarise', () => {
  const s = summarise([
    e('oneshot', 'Gunshot', '💥 Ponctuels'),
    e('oneshot', 'Gunshot', '💥 Ponctuels'),
    e('bed', '5 · Wrong'),
    e('cue', 'At Risk', '🎞️ Évènements longs'),
  ]);
  it('counts every press', () => assert.equal(s.total, 4));
  it('counts by kind', () => assert.deepEqual(s.byKind, { oneshot: 2, bed: 1, cue: 1 }));
  it('ranks sounds by use, bank included in the name', () => {
    assert.deepEqual(s.mostUsed[0], { name: '💥 Ponctuels / Gunshot', presses: 2 });
  });
  it('an empty or missing log summarises to nothing', () =>
    assert.deepEqual(summarise(undefined), { total: 0, byKind: {}, mostUsed: [] }));
});
