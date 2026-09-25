/**
 * The bed cards: which playlists they show, in what order, and what they say.
 *
 * PURE: takes plain snapshots of playlists (the shell builds them from documents), returns what to draw.
 * The state shown is the DOCUMENTS' state - a card is "playing" because Foundry says the playlist is playing,
 * so a stop from the sidebar or a scene change shows on the deck with nothing extra.
 */
import { classify } from './classify.mjs';

/**
 * @typedef {{ id: string, name: string, playing: boolean }} SoundSnap
 * @typedef {{ id: string, name: string, mode: number, playing: boolean, sounds: SoundSnap[] }} PlaylistSnap
 * @typedef {{ id: string, name: string, playing: boolean, nowPlaying: string | null, nowPlayingFrom: string | null, tracks: number }} BedCard
 */

/**
 * @param {PlaylistSnap[]} playlists
 * @returns {BedCard[]}  beds only, ordered by their number (1 · … before 10 · …), then by name
 */
export function bedCards(playlists) {
  return playlists
    .filter((p) => classify(p.name, p.mode)?.role === 'bed')
    .map((p) => ({
      id: p.id,
      name: p.name,
      playing: Boolean(p.playing),
      nowPlaying: p.sounds.find((s) => s.playing)?.name ?? null,
      nowPlayingFrom: p.sounds.find((s) => s.playing)?.description ?? null,
      tracks: p.sounds.length,
    }))
    .sort((a, b) => leadingNumber(a.name) - leadingNumber(b.name) || a.name.localeCompare(b.name));
}

/**
 * A bed is exclusive: starting one stops whichever other bed is playing. Switching the key is ONE act.
 * @param {BedCard[]} cards
 * @param {string} startingId
 * @returns {string[]}  ids of the beds to stop
 */
export function bedsToStop(cards, startingId) {
  return cards.filter((c) => c.playing && c.id !== startingId).map((c) => c.id);
}

function leadingNumber(name) {
  return Number.parseInt(name, 10);
}

/**
 * The bed a number key reaches (0.6, theme 6): the card whose name starts with that number - "5 · Wrong" for 5.
 * @param {BedCard[]} cards
 * @param {number} n
 * @returns {BedCard | null}
 */
export function bedNumbered(cards, n) {
  return cards.find((c) => leadingNumber(c.name) === n) ?? null;
}

/**
 * The track a playing bed moves to next (0.6, theme 8): the one after it in the playlist's own playback order - which
 * Foundry keeps for a shuffle until the playlist is started or stopped again (playlists-and-audio.md) - and the first
 * again after the last.
 * @param {string[]} order  sound ids, in playback order
 * @param {string | null} currentId
 * @returns {string | null}
 */
/**
 * A bed's tracks as numbered for picking one (the Composer, 2026-09-25): the playlist's OWN order - by name, or as
 * arranged by hand - never the shuffle order, which Foundry redraws each time a bed starts, so "track 3" stays track 3.
 * @param {Array<{ id: string, name: string, sort?: number }>} sounds
 * @param {string} sorting  'a' by name, 'm' as arranged (CONST.PLAYLIST_SORT_MODES)
 * @returns {string[]} ids, track 1 first
 */
export function trackOrder(sounds, sorting) {
  const byName = (a, b) => a.name.localeCompare(b.name, 'en');
  const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || byName(a, b);
  return [...sounds].sort(sorting === 'm' ? bySort : byName).map((s) => s.id);
}

/** @returns {string | null} the id of track `n` (1 is the first), or null when there is no such track */
export function trackNumbered(order, n) {
  return Number.isInteger(n) && n >= 1 && n <= order.length ? order[n - 1] : null;
}

export function nextInOrder(order, currentId) {
  if (!currentId || order.length < 2) return null;
  const i = order.indexOf(currentId);
  return i < 0 ? null : order[(i + 1) % order.length];
}
