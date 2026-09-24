import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { guarded } from '../../src/core/guard.mjs';

describe('guarded', () => {
  it('runs the replacement and not the original when all is well', async () => {
    const calls = [];
    const f = guarded(
      async (x) => calls.push(['replacement', x]),
      async (x) => calls.push(['original', x]),
    );
    await f('scene');
    assert.deepEqual(calls, [['replacement', 'scene']]);
  });

  it('falls back to the original, with the same this and arguments, when the replacement throws', async () => {
    const seen = [];
    const self = { name: 'playlists' };
    const f = guarded(
      async () => {
        throw new Error('boom');
      },
      async function (x, y) {
        seen.push([this.name, x, y]);
        return 'original result';
      },
    );
    assert.equal(await f.call(self, 'scene', 42), 'original result');
    assert.deepEqual(seen, [['playlists', 'scene', 42]]);
  });

  it('reports the error exactly once', async () => {
    const reported = [];
    const f = guarded(
      async () => {
        throw new Error('boom');
      },
      async () => {},
      (e) => reported.push(e.message),
    );
    await f();
    assert.deepEqual(reported, ['boom']);
  });

  it('a synchronous throw is caught too', async () => {
    const f = guarded(
      () => {
        throw new Error('sync');
      },
      () => 'fell back',
    );
    assert.equal(await f(), 'fell back');
  });
});
