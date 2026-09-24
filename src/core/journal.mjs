/**
 * The press log (Auditorium on v0.4, note 12, User Researcher): off by default, one seat's own. When on, each press is
 * recorded, so after a session the next version can be chosen from what was actually used, not from what was imagined.
 *
 * PURE. The shell stores the list in a client setting and exports it.
 */

/** How many presses are kept: about ten long sessions, and a bounded setting. */
export const JOURNAL_CAP = 2000;

/**
 * @typedef {{ at: string, kind: string, name: string, bank?: string }} Entry
 * @param {Entry[]} entries
 * @param {Entry} entry
 * @param {number} [cap]
 * @returns {Entry[]} a NEW list, the entry appended, the oldest dropped beyond the cap
 */
export function appendEntry(entries, entry, cap = JOURNAL_CAP) {
  const list = Array.isArray(entries) ? [...entries, entry] : [entry];
  return list.length > cap ? list.slice(list.length - cap) : list;
}

/**
 * For the debrief: presses per sound, most used first, and what kinds of press there were.
 * @param {Entry[]} entries
 */
export function summarise(entries) {
  const bySound = new Map();
  const byKind = {};
  for (const e of entries ?? []) {
    const key = e.bank ? `${e.bank} / ${e.name}` : e.name;
    bySound.set(key, (bySound.get(key) ?? 0) + 1);
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  }
  return {
    total: entries?.length ?? 0,
    byKind,
    mostUsed: [...bySound]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, presses]) => ({ name, presses })),
  };
}
