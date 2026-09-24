/**
 * Sounds Deck - the entry point Foundry loads (module.json "esmodules").
 *
 * THE SHELL: everything that touches Foundry lives here or under src/foundry/, and it stays thin. Every decision
 * is made by a pure function in src/core/, which is tested outside Foundry on every change. This file wires
 * hooks and nothing else.
 */
import { MODES } from './core/classify.mjs';

export const MODULE_ID = 'sounds-deck';

Hooks.once('init', () => {
  // The pure core carries its own copy of the playlist modes. If a Foundry release renumbers them, every press
  // would silently do the wrong thing - so the mismatch is loud, at start-up, before anything plays.
  const drift = Object.entries(MODES).filter(([k, v]) => CONST.PLAYLIST_MODES[k] !== v);
  if (drift.length) {
    console.error(`${MODULE_ID} | PLAYLIST_MODES drifted from the core's copy:`, drift, CONST.PLAYLIST_MODES);
  }
});
