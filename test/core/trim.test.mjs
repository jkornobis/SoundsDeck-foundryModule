import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { trimOf } from '../../src/core/trim.mjs';

describe('the trim a sound asks for', () => {
  it('a start and an end', () => assert.deepEqual(trimOf({ start: 3, end: 5 }), { start: 3, end: 5 }));
  it('only a start: to the end of the file', () =>
    assert.deepEqual(trimOf({ start: 12.5 }), { start: 12.5, end: null }));
  it('only an end: from the beginning', () => assert.deepEqual(trimOf({ end: 90 }), { start: 0, end: 90 }));
  it('empty fields, zeros, or nothing at all ask for nothing', () => {
    for (const flag of [
      undefined,
      null,
      {},
      { start: '', end: '' },
      { start: 0, end: 0 },
      { start: null, end: null },
    ]) {
      assert.equal(trimOf(flag), null);
    }
  });
  it('an end not after the start is ignored; a negative start counts as 0', () => {
    assert.deepEqual(trimOf({ start: 10, end: 4 }), { start: 10, end: null });
    assert.deepEqual(trimOf({ start: -3, end: 8 }), { start: 0, end: 8 });
  });
});
