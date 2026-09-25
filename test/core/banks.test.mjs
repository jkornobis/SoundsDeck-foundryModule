import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bankViews, nextDensity, nextLayout, pickVariant, variantBase, variantPads } from '../../src/core/banks.mjs';
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
  it('a one-shot pad announces its state too: it plays on a click and stops on the next', () => {
    assert.equal(banks.find((b) => b.id === 'shots').pads[0].pressed, 'false');
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

describe('bankViews - a pad knows where it comes from (v0.4 note 9)', () => {
  it('carries the sound description, or null', () => {
    const [b] = bankViews([
      pl('sh', '💥 Ponctuels', MODES.DISABLED, [{ ...s('gun'), description: 'Freesound: ShawnyBoy — CC0' }, s('door')]),
    ]);
    assert.deepEqual(
      b.pads.map((p) => p.description),
      ['Freesound: ShawnyBoy — CC0', null],
    );
  });
});

describe('variants - sounds named alike with a number are one pad (next program, note 4)', () => {
  it('the base of a variant name', () => {
    assert.equal(variantBase('Gunshot 1'), 'Gunshot');
    assert.equal(variantBase('Gunshot #2'), 'Gunshot');
    assert.equal(variantBase('Gunshot_03'), 'Gunshot');
    assert.equal(variantBase('Glass'), null);
    assert.equal(variantBase('42'), null);
  });
  it('two or more fold into one pad, at the first one place, playing while any plays; a lone number stays', () => {
    const pads = variantPads([
      { id: 'a', name: 'Gunshot 1', playing: false },
      { id: 'g', name: 'Glass', playing: false },
      { id: 'b', name: 'gunshot 2', playing: true },
      { id: 'd', name: 'Door 1', playing: false },
    ]);
    assert.deepEqual(
      pads.map((p) => [p.id, p.name, p.playing, p.variants]),
      [
        ['a', 'Gunshot', true, ['a', 'b']],
        ['g', 'Glass', false, null],
        ['d', 'Door 1', false, null],
      ],
    );
  });
  it('a press never plays the same variant twice in a row', () => {
    for (let i = 0; i < 20; i++)
      assert.notEqual(
        pickVariant(['a', 'b', 'c'], 'b', () => i / 20),
        'b',
      );
    assert.equal(pickVariant(['a'], 'a'), 'a');
  });
  it('only a one-shot bank folds its variants', () => {
    const [bank] = bankViews([
      pl('l', '🔁 Loops', MODES.SIMULTANEOUS, [
        { id: 'r1', name: 'Rain 1', playing: false },
        { id: 'r2', name: 'Rain 2', playing: false },
      ]),
    ]);
    assert.equal(bank.pads.length, 2);
  });
});
