import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bankViews, nextDensity, nextLayout, oneShot } from '../../src/core/banks.mjs';
import { MODES } from '../../src/core/classify.mjs';

const pl = (id, name, mode, sounds = []) => ({ id, name, mode, playing: sounds.some((s) => s.playing), sounds });
const s = (id, playing = false) => ({ id, name: id, playing });

describe('bankViews', () => {
  const world = [
    pl('b5', '5 · Wrong', MODES.SHUFFLE, [s('x')]),
    pl('loops', '🌧️ Room loops', MODES.SIMULTANEOUS, [s('rain', true), s('hum')]),
    pl('shots', '🔫 One-shots', MODES.DISABLED, [s('gunshot')]),
    pl('rnd', '🎲 Random', MODES.SHUFFLE, [s('a')]),
    pl('fx', 'Effets · Fond (boucles)', MODES.SIMULTANEOUS, [s('wind')]),
  ];
  const banks = bankViews(world);

  it('emoji playlists only - never a bed, never an unmarked one', () => {
    assert.deepEqual(banks.map((b) => b.id).sort(), ['loops', 'rnd', 'shots']);
  });
  it('the mode decides the press', () => {
    const press = Object.fromEntries(banks.map((b) => [b.id, b.press]));
    assert.deepEqual(press, { loops: 'toggle', shots: 'oneshot', rnd: null });
  });
  it('a toggle pad announces whether it is on', () => {
    const loops = banks.find((b) => b.id === 'loops');
    assert.deepEqual(
      loops.pads.map((p) => [p.id, p.pressed]),
      [
        ['rain', 'true'],
        ['hum', 'false'],
      ],
    );
  });
  it('a one-shot pad announces nothing - it has no state', () => {
    assert.equal(banks.find((b) => b.id === 'shots').pads[0].pressed, null);
  });
});

describe('oneShot', () => {
  it('reads the sound as data', () => {
    assert.deepEqual(oneShot({ path: 'ge-foundry/fx/x.mp3', volume: 0.3 }), {
      src: 'ge-foundry/fx/x.mp3',
      volume: 0.3,
      loop: false,
      channel: 'environment',
    });
  });
  it('a missing volume falls back to 0.5 rather than to silence or full blast', () => {
    assert.equal(oneShot({ path: 'p', volume: undefined }).volume, 0.5);
  });
});

describe('nextLayout', () => {
  it('flips between the two', () => {
    assert.equal(nextLayout('horizontal'), 'vertical');
    assert.equal(nextLayout('vertical'), 'horizontal');
  });
  it('an unknown value starts over at horizontal', () => assert.equal(nextLayout('diagonal'), 'horizontal'));
});

describe('bankViews - the duck toggle (v0.4)', () => {
  const ev = (sounds) => bankViews([pl('ev', '🎞️ Évènements longs', MODES.SEQUENTIAL, sounds)])[0];
  it('an event ducks by default', () => assert.equal(ev([s('a')]).pads[0].ducks, true));
  it('an event told duck:false does not', () => assert.equal(ev([{ ...s('a'), duck: false }]).pads[0].ducks, false));
  it('a loop or a one-shot has no say in ducking', () => {
    const loops = bankViews([pl('lp', '🔁 Fond', MODES.SIMULTANEOUS, [s('rain')])])[0];
    assert.equal(loops.pads[0].ducks, null);
  });
});

describe('nextDensity', () => {
  it('flips between comfortable and compact', () => {
    assert.equal(nextDensity('comfortable'), 'compact');
    assert.equal(nextDensity('compact'), 'comfortable');
  });
  it('an unknown value starts over at comfortable', () => assert.equal(nextDensity('huge'), 'comfortable'));
});
