/**
 * Keyboard shortcuts (0.6, theme 6; the Composer's design, 2026-09-25). Every one can be rebound in Foundry's
 * Configure Controls, and every one can be sent by a Stream Deck key or knob through Elgato's own Hotkey action.
 *
 *   Shift+D            open or close the deck
 *   Shift+X            stop everything
 *   Shift+1 … Shift+8  play the bed with that number (a bed already playing is left alone)
 *   Ctrl+Shift+1 … 9   recall the mood at that place in the deck's list
 *   F13 … F24          the Stream Deck + knobs, one layer each in the deck's order - Music, Loops, Events, Effects:
 *                      turn left (level down), turn right (level up), press (mute, and back)
 * F13-F24 exist on no keyboard, so nothing else in Foundry or the browser reacts to them; the Stream Deck lists them in
 * its Hotkey action's key menu. The digit keys alone stay Foundry's hotbar, and Alt+digits its macro pages.
 *
 * ⚠️ Foundry accepts a binding only DURING init ("You cannot register a Keybinding after the init hook"). The test
 * harness loads the working copy after that, so there it registers nothing and says so; the actions are the same
 * functions either way (actions.mjs), and the tests call them.
 */
import { LAYERS } from '../core/cues.mjs';
import { muteToggle, nudge, playBedNumber, playTrackNumber, recallMoodAt, stopEverything } from './actions.mjs';
import { toggleCombatMusic } from './combat.mjs';

const MODULE_ID = 'sounds-deck';
/** The knob keys, per layer, in the deck's order: [turn left, turn right, press]. */
export const KNOB_KEYS = Object.freeze({
  bed: ['F13', 'F14', 'F15'],
  toggle: ['F16', 'F17', 'F18'],
  cue: ['F19', 'F20', 'F21'],
  oneshot: ['F22', 'F23', 'F24'],
});

/**
 * @param {{ toggleDeck: () => void }} window  the one action that is about the window itself
 * @returns {{ registered: boolean, reason?: string }}
 */
export function registerKeys({ toggleDeck }) {
  if (game.keybindings.bindings)
    return { registered: false, reason: 'after init - bindings can only be registered in init' };
  const key = (code, modifiers = []) => [{ key: code, modifiers }];
  const register = (action, name, editable, onDown, repeat = false) =>
    game.keybindings.register(MODULE_ID, action, {
      name,
      editable,
      restricted: true, // the gamemaster's; a player's key presses reach none of this
      repeat,
      onDown: () => {
        onDown();
        return true;
      },
    });
  register('open', 'SOUNDS_DECK.Keys.Open', key('KeyD', ['Shift']), toggleDeck);
  register('stopAll', 'SOUNDS_DECK.Keys.StopAll', key('KeyX', ['Shift']), stopEverything);
  // Shift+F, "fight": Shift+C is Foundry's own focus-chat key (read from the live bindings, 2026-09-25).
  register('combat', 'SOUNDS_DECK.Keys.Combat', key('KeyF', ['Shift']), toggleCombatMusic);
  for (let n = 1; n <= 8; n++)
    register(`bed${n}`, `SOUNDS_DECK.Keys.Bed.${n}`, key(`Digit${n}`, ['Shift']), () => playBedNumber(n));
  for (let n = 1; n <= 9; n++) {
    // Track n of the bed that plays (2026-09-25): Ctrl+Alt, which nothing in Foundry uses; plain and Shift digits are
    // the hotbar's and the beds'.
    register(`track${n}`, `SOUNDS_DECK.Keys.Track.${n}`, key(`Digit${n}`, ['Control', 'Alt']), () =>
      playTrackNumber(n),
    );
    register(`mood${n}`, `SOUNDS_DECK.Keys.Mood.${n}`, key(`Digit${n}`, ['Control', 'Shift']), () => recallMoodAt(n));
  }
  for (const layer of LAYERS) {
    const [down, up, press] = KNOB_KEYS[layer];
    register(`${layer}Down`, `SOUNDS_DECK.Keys.Down.${layer}`, key(down), () => nudge(layer, -1), true);
    register(`${layer}Up`, `SOUNDS_DECK.Keys.Up.${layer}`, key(up), () => nudge(layer, 1), true);
    register(`${layer}Mute`, `SOUNDS_DECK.Keys.Mute.${layer}`, key(press), () => muteToggle(layer));
  }
  return { registered: true };
}
