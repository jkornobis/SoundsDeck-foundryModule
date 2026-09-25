/**
 * A pad dragged onto Foundry's macro hotbar becomes a one-click button that presses it as the deck does (0.6, theme 6).
 *
 * Foundry's hotbar calls the hook "hotbarDrop" with the dropped data before it does anything itself, and stops if a
 * handler answers false (Hotbar#onDragDrop, read from the live page, 14.368). A pad's drop is answered here; anything
 * else is left to Foundry. A macro already made for that pad is reused, so dragging it twice does not duplicate it.
 */
import { padDrop, padMacro } from '../core/hotbar.mjs';
import { deckName } from '../core/names.mjs';

const MODULE_ID = 'sounds-deck';

async function placePad({ playlistId, soundId }, slot) {
  const sound = game.playlists.get(playlistId)?.sounds.get(soundId);
  if (!sound) return;
  const data = padMacro(playlistId, soundId, deckName(sound.name, game.settings.get(MODULE_ID, 'hideSources')));
  const macro =
    game.macros.find((m) => m.command === data.command && m.isOwner) ??
    (await foundry.documents.Macro.implementation.create(data));
  await game.user.assignHotbarMacro(macro, slot);
}

/** @returns {{ installed: boolean, uninstall: () => void }} */
export function installHotbar() {
  const id = Hooks.on('hotbarDrop', (_bar, data, slot) => {
    const pad = padDrop(data);
    if (!pad) return undefined;
    placePad(pad, slot).catch((error) =>
      console.error(`${MODULE_ID} | the pad could not be placed on the hotbar:`, error),
    );
    return false;
  });
  return {
    installed: true,
    uninstall() {
      Hooks.off('hotbarDrop', id);
    },
  };
}
