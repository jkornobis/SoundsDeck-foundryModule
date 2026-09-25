/**
 * How a pad looks, and which banks are folded (0.6, theme 9; the Composer's design, 2026-09-25): 68 pads in three banks
 * are found faster by colour and icon than by reading, and a folded bank keeps 35 events from pushing everything else
 * out of view.
 *
 * PURE. A pad's look is set in its sound's own settings (flags["sounds-deck"].look = { colour, icon }); the folded banks
 * are one seat's preference (a client setting, a list of playlist ids).
 */

/** Six colours, drawn from Foundry's own theme by the stylesheet - never a free colour, so every pad stays readable. */
export const PAD_COLOURS = Object.freeze(['red', 'orange', 'yellow', 'green', 'blue', 'violet']);

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * @param {unknown} flag  { colour, icon } as the settings form saved them
 * @returns {{ colour: string | null, icon: string | null }}  a colour of the palette or none; an icon of at most two
 *   characters as the eye counts them (an emoji built from several code points is one)
 */
export function padLook(flag) {
  const colour = PAD_COLOURS.includes(flag?.colour) ? flag.colour : null;
  const text = typeof flag?.icon === 'string' ? flag.icon.trim() : '';
  const icon = text
    ? [...graphemes.segment(text)]
        .slice(0, 2)
        .map((g) => g.segment)
        .join('')
    : null;
  return { colour, icon };
}

/** @returns {string[]} the folded banks after one press on a bank's title */
export function toggleFold(folded, playlistId) {
  const set = new Set(Array.isArray(folded) ? folded : []);
  if (set.has(playlistId)) set.delete(playlistId);
  else set.add(playlistId);
  return [...set];
}
