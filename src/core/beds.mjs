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
 * @typedef {{ id: string, name: string, playing: boolean, nowPlaying: string | null, tracks: number }} BedCard
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
