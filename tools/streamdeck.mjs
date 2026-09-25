/**
 * Stream Deck profiles for the deck's shortcuts (the Composer, 2026-09-25: "build a streamdeck profiles ... and offer
 * the profiles as part of the module").
 *
 * THE FORMAT IS HIS OWN APP'S, NOT A GUESS. Elgato publishes no profile format, and it changed between app versions: an
 * open-source generator from 2024 knew version 2.0, while his Stream Deck app 7.6 exported version 3.0 with a
 * package.json and a different folder layout. So he exported a seed profile from his Stream Deck + (two keys and a
 * dial); every structure and every code here is copied from it, and the tests check this file reproduces its codes.
 *
 * What the seed taught, beyond the layout:
 * - modifiers are bits: Shift 1, Ctrl 2, Alt 4; F13 and above also carry 32768 and no VKeyCode;
 * - a key recorded from the NUMPAD carries 16384 and the numpad's code (his Ctrl+Alt+3 was VK 99, Numpad3) - which
 *   Foundry sees as a different key from Digit3 (KeyboardEvent.code), so recording by hand can silently miss;
 * - a dial is a hotkey action holding four key commands: turn left, turn right, press, and one left empty.
 *
 * PURE: the codes and the manifests. Writing the zip is tools/build-streamdeck.mjs.
 */
import { createHash } from 'node:crypto';

/** An unused slot, exactly as the app writes it. */
export const NO_KEY = Object.freeze({
  KeyCmd: false,
  KeyCtrl: false,
  KeyModifiers: 0,
  KeyOption: false,
  KeyShift: false,
  NativeCode: 146,
  QTKeyCode: 33554431,
  VKeyCode: -1,
});

const MOD = { Shift: 1, Control: 2, Alt: 4 };

/**
 * @param {string} code  a KeyboardEvent.code, as Foundry binds it: 'Digit5', 'KeyD', 'F13'
 * @param {Array<'Shift' | 'Control' | 'Alt'>} [modifiers]
 */
export function hotkey(code, modifiers = []) {
  let native;
  let qt;
  let vk;
  let extra = 0;
  const digit = /^Digit(\d)$/.exec(code);
  const letter = /^Key([A-Z])$/.exec(code);
  const fn = /^F(\d{1,2})$/.exec(code);
  if (digit) native = qt = vk = 48 + Number(digit[1]);
  else if (letter) native = qt = vk = letter[1].charCodeAt(0);
  else if (fn && Number(fn[1]) >= 1 && Number(fn[1]) <= 24) {
    const n = Number(fn[1]);
    native = 111 + n; // Windows VK_F1 = 112
    qt = 16777263 + n; // Qt::Key_F1 = 0x01000030
    vk = n >= 13 ? -1 : native;
    extra = n >= 13 ? 32768 : 0;
  } else throw new Error(`no Stream Deck code for ${code}`);
  return {
    KeyCmd: false,
    KeyCtrl: modifiers.includes('Control'),
    KeyModifiers: modifiers.reduce((m, k) => m | MOD[k], 0) | extra,
    KeyOption: modifiers.includes('Alt'),
    KeyShift: modifiers.includes('Shift'),
    NativeCode: native,
    QTKeyCode: qt,
    VKeyCode: vk,
  };
}

/** A stable UUID from a name, so a rebuild gives the same files. */
export function uuidOf(name) {
  const h = createHash('sha1').update(`sounds-deck/${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * One key or one dial, as a hotkey action.
 * @param {string} id      a stable name for its ActionID
 * @param {string} title
 * @param {object[]} keys  one command for a key; turn left, turn right, press for a dial
 * @param {{ dial?: boolean }} [options]
 */
export function hotkeyAction(id, title, keys, { dial = false } = {}) {
  const slots = [...keys, NO_KEY, NO_KEY, NO_KEY, NO_KEY].slice(0, 4);
  return {
    ActionID: uuidOf(`action/${id}`),
    ...(dial ? { Encoder: {} } : {}),
    LinkedTitle: true,
    Name: 'Hotkey',
    Plugin: { Name: 'Activate a Key Command', UUID: 'com.elgato.streamdeck.system.hotkey', Version: '1.0' },
    Resources: null,
    Settings: { Coalesce: true, Hotkeys: slots },
    State: 0,
    States: [{ Title: title }],
    UUID: 'com.elgato.streamdeck.system.hotkey',
  };
}

/**
 * A profile's files, as { path: json }.
 * @param {{ name: string, model: string, pages: Array<{ id: string, keys: Record<string, object>,
 *   dials?: Record<string, object> }> }} p   keys and dials keyed "column,row"
 */
export function profileFiles({ name, model, pages }) {
  const profile = uuidOf(`profile/${name}`);
  const blank = uuidOf(`page/${name}/default`);
  const root = `Profiles/${profile.toUpperCase()}.sdProfile`;
  const files = {
    'package.json': {
      AppVersion: '7.6.0.23012',
      DeviceModel: model,
      DeviceSettings: null,
      FormatVersion: 1,
      OSType: 'Windows',
      OSVersion: '10.0.26200',
      RequiredPlugins: ['com.elgato.streamdeck.system.hotkey'],
    },
    [`${root}/manifest.json`]: {
      Device: { Model: model, UUID: '' },
      Name: name,
      Pages: {
        Current: '00000000-0000-0000-0000-000000000000',
        Default: blank,
        Pages: pages.map((p) => uuidOf(`page/${name}/${p.id}`)),
      },
      Version: '3.0',
    },
    [`${root}/Profiles/${blank.toUpperCase()}/manifest.json`]: {
      Controllers: [
        { Actions: null, Type: 'Keypad' },
        { Actions: null, Type: 'Encoder' },
      ],
      Icon: '',
      Name: '',
    },
  };
  for (const p of pages) {
    const controllers = [{ Actions: p.keys, Type: 'Keypad' }];
    if (p.dials) controllers.push({ Actions: p.dials, Type: 'Encoder' });
    files[`${root}/Profiles/${uuidOf(`page/${name}/${p.id}`).toUpperCase()}/manifest.json`] = {
      Controllers: controllers,
      Icon: '',
      Name: '',
    };
  }
  return files;
}
