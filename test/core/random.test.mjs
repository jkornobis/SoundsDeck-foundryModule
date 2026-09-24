import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RANDOM_DEFAULT, randomDelay, randomInterval } from '../../src/core/random.mjs';

describe('random triggering', () => {
  it('no flag: the default interval', () => assert.deepEqual(randomInterval(undefined), { ...RANDOM_DEFAULT }));
  it('a flag is honoured', () => assert.deepEqual(randomInterval({ min: 3, max: 8 }), { min: 3, max: 8 }));
  it('never below one second, and max never below min', () => {
    assert.deepEqual(randomInterval({ min: 0, max: -5 }), { min: 1, max: 1 });
    assert.deepEqual(randomInterval({ min: 20, max: 5 }), { min: 20, max: 20 });
  });
  it('the delay spans the interval, in milliseconds', () => {
    assert.equal(
      randomDelay({ min: 10, max: 20 }, () => 0),
      10000,
    );
    assert.equal(
      randomDelay({ min: 10, max: 20 }, () => 1),
      20000,
    );
    assert.equal(
      randomDelay({ min: 10, max: 20 }, () => 0.5),
      15000,
    );
  });
});
