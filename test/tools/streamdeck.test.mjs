import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hotkey, hotkeyAction, NO_KEY, profileFiles, uuidOf } from '../../tools/streamdeck.mjs';

// Copied from the seed profile the Composer exported from his Stream Deck app 7.6 on 2026-09-25.
const SEED = {
  shiftF5: {
    KeyCmd: false,
    KeyCtrl: false,
    KeyModifiers: 1,
    KeyOption: false,
    KeyShift: true,
    NativeCode: 116,
    QTKeyCode: 16777268,
    VKeyCode: 116,
  },
  f13: {
    KeyCmd: false,
    KeyCtrl: false,
    KeyModifiers: 32768,
    KeyOption: false,
    KeyShift: false,
    NativeCode: 124,
    QTKeyCode: 16777276,
    VKeyCode: -1,
  },
  f15: {
    KeyCmd: false,
    KeyCtrl: false,
    KeyModifiers: 32768,
    KeyOption: false,
    KeyShift: false,
    NativeCode: 126,
    QTKeyCode: 16777278,
    VKeyCode: -1,
  },
};

describe('hotkey - the codes his Stream Deck app writes', () => {
  it('Shift+F5 exactly as the seed recorded it', () => assert.deepEqual(hotkey('F5', ['Shift']), SEED.shiftF5));
  it('F13 and F15, the dial keys, exactly as the seed recorded them', () => {
    assert.deepEqual(hotkey('F13'), SEED.f13);
    assert.deepEqual(hotkey('F15'), SEED.f15);
  });
  it('Ctrl+Alt+3 is the digit row, not the numpad the seed was recorded from', () =>
    assert.deepEqual(hotkey('Digit3', ['Control', 'Alt']), {
      KeyCmd: false,
      KeyCtrl: true,
      KeyModifiers: 6,
      KeyOption: true,
      KeyShift: false,
      NativeCode: 51,
      QTKeyCode: 51,
      VKeyCode: 51,
    }));
  it('Shift+D, a letter', () => {
    const k = hotkey('KeyD', ['Shift']);
    assert.deepEqual([k.NativeCode, k.VKeyCode, k.KeyModifiers, k.KeyShift], [68, 68, 1, true]);
  });
  it('F24 is the last function key; anything else is refused', () => {
    assert.equal(hotkey('F24').NativeCode, 135);
    assert.throws(() => hotkey('F25'));
    assert.throws(() => hotkey('Numpad3'));
  });
});

describe('hotkeyAction and profileFiles - the seed layout', () => {
  it('a key holds its command and three empty slots; a dial also says it is a dial', () => {
    const key = hotkeyAction('k', 'Bed 5', [hotkey('Digit5', ['Shift'])]);
    assert.equal(key.Settings.Hotkeys.length, 4);
    assert.deepEqual(key.Settings.Hotkeys.slice(1), [NO_KEY, NO_KEY, NO_KEY]);
    assert.equal(key.UUID, 'com.elgato.streamdeck.system.hotkey');
    assert.ok(!('Encoder' in key));
    assert.ok('Encoder' in hotkeyAction('d', 'Music', [hotkey('F13'), hotkey('F14'), hotkey('F15')], { dial: true }));
  });
  it('the same name gives the same ids, so a rebuild changes nothing', () => assert.equal(uuidOf('x'), uuidOf('x')));
  it('a package, a profile manifest listing its pages, an empty default page, and one folder per page', () => {
    const files = profileFiles({ name: 'T', model: '20GBD9901', pages: [{ id: 'a', keys: {} }] });
    const paths = Object.keys(files);
    assert.equal(paths.length, 4);
    assert.equal(files['package.json'].DeviceModel, '20GBD9901');
    const root = paths.find((p) => /\.sdProfile\/manifest\.json$/.test(p));
    assert.equal(files[root].Version, '3.0');
    assert.equal(files[root].Pages.Pages.length, 1);
    assert.ok(paths.every((p) => p === 'package.json' || p.startsWith('Profiles/')));
  });
});
