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

/*
 * The board's tabs (the Composer, 2026-09-25, replacing the folding of theme 9): one tab per bank. A click on its name
 * shows that bank alone; its tick adds or removes it, so two or more show at once. The seat stores the banks it HID,
 * so a bank created later shows by itself. The board is never left empty.
 */

/** @returns {Array<{ id: string, name: string, shown: boolean }>} */
export function bankTabs(banks, hidden) {
  const off = new Set(Array.isArray(hidden) ? hidden : []);
  const none = banks.every((b) => off.has(b.id)); // everything hidden (a stale list): show everything
  return banks.map((b) => ({ id: b.id, name: b.name, shown: none || !off.has(b.id) }));
}

/**
 * A click on a tab's name: that bank alone - or, when it already shows alone, every bank again.
 * @returns {string[]} the banks hidden after the click
 */
export function soloBank(allIds, hidden, id) {
  const shown = bankTabs(
    allIds.map((x) => ({ id: x })),
    hidden,
  ).filter((t) => t.shown);
  if (shown.length === 1 && shown[0].id === id) return [];
  return allIds.filter((x) => x !== id);
}

/** A tab's tick: that bank shown or hidden, the others untouched; the last bank showing stays. @returns {string[]} */
export function tickBank(allIds, hidden, id) {
  const off = new Set((Array.isArray(hidden) ? hidden : []).filter((x) => allIds.includes(x)));
  if (off.has(id)) off.delete(id);
  else off.add(id);
  if (allIds.every((x) => off.has(x))) return [...(Array.isArray(hidden) ? hidden : [])];
  return allIds.filter((x) => off.has(x));
}
