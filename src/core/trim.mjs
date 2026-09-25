/**
 * Trim a track (0.6, theme 7; the Composer's design, 2026-09-25): a start and an end, in seconds, set in the sound's
 * own settings and stored on it (flags["sounds-deck"].trim). The track plays from its start and ends at its end, so a
 * shuffle bed moves on as if it had finished. A looping sound repeats the trimmed part.
 *
 * PURE: the trim a sound's flag asks for, or none. Empty fields, zero, and an end not after the start ask for nothing.
 */

/**
 * @param {unknown} flag  { start, end } as the form saved them - numbers, empty, or missing
 * @returns {{ start: number, end: number | null } | null}
 */
export function trimOf(flag) {
  const start = Number(flag?.start);
  const end = Number(flag?.end);
  const s = Number.isFinite(start) && start > 0 ? start : 0;
  const e = Number.isFinite(end) && end > s ? end : null;
  if (!s && e === null) return null;
  return { start: s, end: e };
}
