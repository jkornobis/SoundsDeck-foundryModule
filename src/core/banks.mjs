/**
 * The board: which playlists become banks of pads, and what each pad shows.
 *
 * PURE, like beds.mjs: plain playlist snapshots in, what to draw out. A bank is a playlist whose name starts with
 * an emoji; what its pads DO comes from its core mode (classify.mjs). A bank whose mode gives no press (Shuffle) is
 * drawn disabled rather than guessed at.
 */
import { classify } from './classify.mjs';
import { padLook } from './look.mjs';

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
      pads: (c.press === 'oneshot' ? variantPads(p.sounds) : p.sounds.map((s) => ({ ...s, variants: null }))).map(
        (s) => ({
          id: s.id,
          name: s.name,
          playing: Boolean(s.playing),
          description: s.description ?? null,
          // Every pad plays on a click and stops on the next (the Composer, after first use), so every pad has a state.
          pressed: c.press ? String(Boolean(s.playing)) : null,
          // Only an event has a say in ducking; it ducks unless it was explicitly told not to.
          ducks: c.press === 'cue' ? s.duck !== false : null,
          // Only a one-shot can be armed to fire at random moments.
          randomizable: c.press === 'oneshot',
          // Its colour and icon, if the sound's settings give it any (theme 9).
          ...padLook(s.look),
          // A pad that stands for several sounds (note 4): their ids, and how many; null for a pad of one sound.
          variants: s.variants,
          count: s.variants?.length ?? null,
        }),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The base of a variant's name: "Gunshot 1", "Gunshot #2", "Gunshot_03" -> "Gunshot"; a name without a trailing number
 * has none. (Next program, note 4: sounds named alike with a number are variants of one pad.)
 * @returns {string | null}
 */
export function variantBase(name) {
  const m = /^(.*?\S)[\s_-]*#?\s*\d{1,3}$/.exec(typeof name === 'string' ? name.trim() : '');
  // The base needs a letter: "42" is a name, not variant 2 of "4".
  return m && /\p{L}/u.test(m[1]) ? m[1] : null;
}

/**
 * A one-shot bank's sounds, with each group of two or more variants folded into one pad: named by the base, standing
 * at the first variant's place, playing while any of them plays.
 * @param {Array<{ id: string, name: string, playing?: boolean }>} sounds
 */
export function variantPads(sounds) {
  const groups = new Map();
  for (const s of sounds) {
    const base = variantBase(s.name);
    if (!base) continue;
    const key = base.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const out = [];
  const done = new Set();
  for (const s of sounds) {
    const base = variantBase(s.name);
    const group = base && groups.get(base.toLowerCase());
    if (!group || group.length < 2) {
      out.push({ ...s, variants: null });
      continue;
    }
    if (done.has(group)) continue;
    done.add(group);
    out.push({ ...s, name: base, playing: group.some((x) => x.playing), variants: group.map((x) => x.id) });
  }
  return out;
}

/**
 * The variant a press plays: any of them but the one played last, so the same sound never comes twice in a row.
 * @param {string[]} variants  ids
 * @param {string | null} last
 * @param {() => number} [random]
 */
export function pickVariant(variants, last, random = Math.random) {
  const pool = variants.length > 1 ? variants.filter((v) => v !== last) : variants;
  return pool[Math.floor(random() * pool.length) % pool.length] ?? null;
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
