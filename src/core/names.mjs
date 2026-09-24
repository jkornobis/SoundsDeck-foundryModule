/**
 * What the deck shows of a sound's name (the Composer, 2026-09-24: "keep reference on OST ... but hide it on deck,
 * I was thinking about '()' hidden in Sounds Deck ... so every OST source can be seen only in native audio panel ...
 * as general rule/options for next module user").
 *
 * THE RULE: a sound's source goes in parentheses at the END of its name - "At Risk (Gone Girl)". Foundry's own
 * playlist panel shows the whole name; the deck, when its option is on, shows "At Risk".
 *
 * PURE.
 */

const TRAILING = /\s*\([^()]*\)\s*$/;

/**
 * @param {string} name
 * @param {boolean} hideSources  the module setting
 * @returns {string} the name without every trailing "(…)" group - never empty: a name that is only parentheses is kept
 */
export function deckName(name, hideSources) {
  const full = String(name ?? '');
  if (!hideSources) return full;
  let short = full;
  while (TRAILING.test(short)) short = short.replace(TRAILING, '');
  return short.trim() || full;
}
