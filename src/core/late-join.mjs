/**
 * Late joiners catch up (0.7, note 2; the Composer's design, 2026-09-25): a player who joins, or reloads, while a bed,
 * a room loop or an event plays hears it where the table is - not from the start of the track, which is what Foundry
 * does (PlaylistSound#sync starts at pausedTime, read from the live page 14.368). One-shots are over in seconds and do
 * not catch up.
 *
 * Foundry does not record when a sound started, so the deck does: the start moment rides in the same update that sets
 * `playing`, on the client that makes it. A joining browser compares it with the moment it joined.
 *
 * PURE: when a change is a start and what moment it records, and where a joining browser should come in.
 */

/** The layers that catch up. */
export const CATCH_UP_LAYERS = Object.freeze(['bed', 'toggle', 'cue']);

/** Less than this behind is not worth a jump: a start is heard as a start, with its fade-in. */
export const CATCH_UP_MIN_S = 2;

/**
 * @param {{ playing?: boolean, pausedTime?: number | null }} change   what the update sets on the sound
 * @param {{ playing: boolean, pausedTime?: number | null }} current   the sound before the update
 * @param {number} now   the server's time, ms
 * @param {{ restart?: boolean }} [options]  restart: Foundry replays the same sound (a one-track playlist moving on)
 * @returns {number | null}  the moment the sound's position was 0, in the server's ms - or null: not a start
 */
export function startMark(change, current, now, { restart = false } = {}) {
  if (change?.playing !== true) return null;
  if (current?.playing && !restart) return null; // already playing: a re-sent "playing", not a start
  const paused = change && 'pausedTime' in change ? change.pausedTime : current?.pausedTime;
  const from = Number.isFinite(paused) && paused > 0 ? paused : 0;
  return now - from * 1000;
}

/**
 * Whether an update only moves a sound's start mark - nothing any window shows, so nothing to redraw.
 * @param {unknown} change  the update, as Foundry's hooks pass it
 */
export function onlyStartMark(change) {
  if (!change || typeof change !== 'object') return false;
  const keys = Object.keys(change).filter((k) => k !== '_id');
  if (keys.length !== 1 || keys[0] !== 'flags') return false;
  const flags = change.flags;
  const modules = flags && typeof flags === 'object' ? Object.keys(flags) : [];
  const ours = flags?.['sounds-deck'];
  return (
    modules.length === 1 &&
    modules[0] === 'sounds-deck' &&
    ours !== null &&
    typeof ours === 'object' &&
    Object.keys(ours).length === 1 &&
    'startedAt' in ours
  );
}

/** A mark more than this far from what the gamemaster heard is corrected. */
export const MARK_TOLERANCE_MS = 500;

/**
 * The mark as the gamemaster HEARD it. A start is marked when it is asked for, but a large track then loads for
 * seconds before it plays - measured 2026-09-25 with a real second browser: a late joiner placed by the request came in
 * 7.3 s ahead of the gamemaster. So when the gamemaster's own copy starts, the mark moves to that moment.
 * @param {number} now          the server's time, ms
 * @param {number} currentTime  where the gamemaster's copy is, s
 * @param {unknown} marked      the mark the sound carries
 * @returns {number | null}  the corrected mark, or null: it already says what was heard
 */
export function heardMark(now, currentTime, marked) {
  if (!Number.isFinite(currentTime)) return null;
  const heard = now - currentTime * 1000;
  return Number.isFinite(marked) && Math.abs(heard - marked) <= MARK_TOLERANCE_MS ? null : heard;
}

/**
 * Where a browser that joined after a sound started should start playing it.
 * @param {{ startedAt: unknown, joinedAt: number, now: number, duration?: number, loop?: boolean,
 *   trim?: { start: number, end: number | null } | null }} p
 * @returns {number | null}  seconds into the file, or null: play it the way Foundry would
 */
export function catchUpOffset({ startedAt, joinedAt, now, duration, loop = false, trim = null }) {
  if (!Number.isFinite(startedAt) || !(startedAt < joinedAt)) return null; // started after this browser joined
  const elapsed = (now - startedAt) / 1000;
  if (!(elapsed >= CATCH_UP_MIN_S)) return null;
  const start = trim?.start ?? 0;
  const end = Math.min(
    trim?.end ?? Number.POSITIVE_INFINITY,
    Number.isFinite(duration) ? duration : Number.POSITIVE_INFINITY,
  );
  const length = end - start;
  if (!Number.isFinite(length)) return loop ? null : start + elapsed; // a loop of unknown length cannot be placed
  if (!(length > 0)) return null;
  return start + (loop ? elapsed % length : Math.min(elapsed, length));
}
