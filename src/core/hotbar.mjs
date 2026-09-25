/**
 * A pad on Foundry's macro hotbar (0.6, theme 6; asked for on Foundry's own tracker, C10579 and C14671): dragged there,
 * it becomes a macro that presses it exactly as the deck does. The hotbar's number keys then fire it too, and so can a
 * Stream Deck key.
 *
 * PURE: what a pad dragged out of the deck carries, and the macro it becomes.
 */
export const PAD_DRAG = 'SoundsDeckPad';

/**
 * @param {string} playlistId
 * @param {string} soundId
 * @param {string} name  what the pad shows
 * @returns {{ name: string, type: 'script', img: string, command: string }}
 */
export function padMacro(playlistId, soundId, name) {
  return {
    name,
    type: 'script',
    img: 'icons/svg/sound.svg',
    command: `game.modules.get('sounds-deck')?.api?.press(${JSON.stringify(playlistId)}, ${JSON.stringify(soundId)});`,
  };
}

/** @returns {{ playlistId: string, soundId: string } | null} a pad's drop data, or null for anything else */
export function padDrop(data) {
  if (data?.type !== PAD_DRAG || typeof data.playlistId !== 'string' || typeof data.soundId !== 'string') return null;
  return { playlistId: data.playlistId, soundId: data.soundId };
}
