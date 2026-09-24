/**
 * The board: which playlists become banks of pads, and what each pad shows.
 *
 * PURE, like beds.mjs: plain playlist snapshots in, what to draw out. A bank is a playlist whose name starts with
 * an emoji; what its pads DO comes from its core mode (classify.mjs). A bank whose mode gives no press (Shuffle) is
 * drawn disabled rather than guessed at.
 */
import { classify } from './classify.mjs';

/**
 * @typedef {import('./beds.mjs').PlaylistSnap} PlaylistSnap
 * @typedef {{ id: string, name: string, playing: boolean, description: string | null, pressed: 'true' | 'false' | null, ducks: boolean | null }} Pad
 * @typedef {{ id: string, name: string, press: 'oneshot' | 'toggle' | 'cue' | null, pads: Pad[] }} Bank
 */

/**
 * @param {PlaylistSnap[]} playlists
 * @returns {Bank[]}  banks only, by name as the sidebar sorts them
 */
export function bankViews(playlists) {
  return playlists
    .map((p) => ({ p, c: classify(p.name, p.mode) }))
    .filter(({ c }) => c?.role === 'bank')
    .map(({ p, c }) => ({
      id: p.id,
      name: p.name,
      press: c.press,
      pads: p.sounds.map((s) => ({
        id: s.id,
        name: s.name,
        playing: Boolean(s.playing),
        description: s.description ?? null,
        // A toggle or a cue has a state worth announcing; a one-shot has none - it fires and is gone.
        pressed: c.press === 'toggle' || c.press === 'cue' ? String(Boolean(s.playing)) : null,
        // Only an event has a say in ducking; it ducks unless it was explicitly told not to.
        ducks: c.press === 'cue' ? s.duck !== false : null,
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * What a one-shot pad plays: the PlaylistSound read as data - the playlist stays the only store (decision 0003).
 * @param {{ path: string, volume: number }} sound
 * @returns {{ src: string, volume: number, loop: false, channel: 'environment' }}
 */
export function oneShot(sound) {
  return {
    src: sound.path,
    volume: Number.isFinite(sound.volume) ? sound.volume : 0.5,
    loop: false,
    channel: 'environment',
  };
}

/** The two layouts his design names: the board beside the beds, or below them. */
export const LAYOUTS = Object.freeze(['horizontal', 'vertical']);

/** @returns {'horizontal' | 'vertical'} the other layout; anything unknown falls back to horizontal */
export function nextLayout(current) {
  return current === 'horizontal' ? 'vertical' : 'horizontal';
}

/** Pad size, per seat (Auditorium on v0.4, note 8): comfortable by default, compact to fit both banks without scrolling. */
export const DENSITIES = Object.freeze(['comfortable', 'compact']);

/** @returns {'comfortable' | 'compact'} the other size; anything unknown starts over at comfortable */
export function nextDensity(current) {
  return current === 'comfortable' ? 'compact' : 'comfortable';
}
