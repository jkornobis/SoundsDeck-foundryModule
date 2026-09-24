/**
 * Where a playlist goes on the deck, and what pressing one of its sounds does.
 *
 * THE RULE, as the Composer set it on 2026-09-24:
 *   - the NAME places a playlist: a leading number ("1 · Bureau") makes it a BED, a leading emoji makes it a
 *     BANK, and a playlist with neither is not on the deck at all. Opting in is an act, and it is visible in
 *     Foundry's own sidebar with no module installed.
 *   - the core MODE decides what a press does. Foundry already labels mode -1 "Soundboard Only".
 *
 * PURE: no Foundry global is reachable from this folder (biome.json forbids them). The mode numbers are passed
 * in by the caller, and the shell checks at start-up that Foundry's constant still matches MODES below.
 */

/** Foundry's CONST.PLAYLIST_MODES, measured on 14.368. The shell asserts they have not drifted. */
export const MODES = Object.freeze({ DISABLED: -1, SEQUENTIAL: 0, SHUFFLE: 1, SIMULTANEOUS: 2 });

/** What a press on a bank's sound does, by the playlist's core mode. */
const PRESS_BY_MODE = new Map([
  [MODES.DISABLED, 'oneshot'], // "Soundboard Only": fire it, overlapping allowed
  [MODES.SIMULTANEOUS, 'toggle'], // room loops: on or off, the others keep running
  [MODES.SEQUENTIAL, 'cue'], // an event: starts it, opens a transport, ducks the bed
]);

const BED_NAME = /^\d+\s*·\s/u;
// A keycap ("1️⃣") starts with a digit but reads as an emoji, so it is tested before the number rule can miss it.
const KEYCAP = /^[0-9#*]️?⃣/u;
const EMOJI = /^\p{Extended_Pictographic}/u;

/**
 * @param {string} name   the playlist's name, as the sidebar shows it
 * @param {number} mode   the playlist's core mode (one of MODES)
 * @returns {{ role: 'bed', press: 'play' }
 *         | { role: 'bank', press: 'oneshot' | 'toggle' | 'cue' | null }
 *         | null}       null = not on the deck. A bank whose mode has no press (SHUFFLE) returns press null,
 *                       so the deck can show it greyed rather than guess.
 */
export function classify(name, mode) {
  const n = String(name ?? '').trimStart();
  if (KEYCAP.test(n) || EMOJI.test(n)) return { role: 'bank', press: PRESS_BY_MODE.get(mode) ?? null };
  if (BED_NAME.test(n)) return { role: 'bed', press: 'play' };
  return null;
}
