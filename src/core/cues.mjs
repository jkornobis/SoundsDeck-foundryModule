/**
 * Events (cues) and ducking - the Composer's rulings of 2026-09-24:
 *   "Ducking: yes, on every event" - the bed drops about 10 dB while a cue plays and comes back by itself,
 *   overridable per cue.
 *
 * PURE. The shell turns documents into snapshots, asks these functions, and acts.
 */
import { classify } from './classify.mjs';

/** His ruling: about 10 dB. */
export const DUCK_DB = 10;

/** A level in decibels below full, as a gain multiplier: 10 dB -> 0.316. */
export function dbToGain(db) {
  return 10 ** (-db / 20);
}

/**
 * The volume a playing bed sound should sit at, given its own document volume.
 * @param {number} docVolume   PlaylistSound.volume, 0..1
 * @param {boolean} ducked
 * @param {number} [db]
 */
export function bedVolume(docVolume, ducked, db = DUCK_DB) {
  const v = Number.isFinite(docVolume) ? docVolume : 0;
  return ducked ? v * dbToGain(db) : v;
}

/**
 * The deck's four kinds of sound, each with its own level (Auditorium on 0.5.2, note 2 - Syrinscape sets each Element
 * and the master independently; Audio Forge each category). A level scales every sound of its kind, on every client,
 * without rewriting a single sound's own volume.
 */
export const LAYERS = Object.freeze(['bed', 'toggle', 'cue', 'oneshot']);
export const LEVELS_DEFAULT = Object.freeze({ bed: 1, toggle: 1, cue: 1, oneshot: 1 });

/** The layer a playlist's sounds belong to, or null when the playlist is not on the deck. */
export function layerOf(name, mode) {
  const c = classify(name, mode);
  if (!c?.press) return null;
  return c.role === 'bed' ? 'bed' : c.press;
}

/**
 * The volume a playing sound should sit at: its own volume, times its layer's level, times the duck for a bed.
 * @param {number} docVolume   PlaylistSound.volume, 0..1
 * @param {'bed' | 'toggle' | 'cue' | 'oneshot'} layer
 * @param {Partial<Record<string, number>> | null | undefined} levels   anything missing or invalid counts as 1
 * @param {boolean} ducked
 */
export function mixVolume(docVolume, layer, levels, ducked) {
  const raw = levels?.[layer];
  const level = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 1;
  const v = (Number.isFinite(docVolume) ? docVolume : 0) * level;
  return layer === 'bed' ? bedVolume(v, ducked) : v;
}

/**
 * Is any cue playing that asks for ducking? A cue opts out with flags["sounds-deck"].duck === false on its sound.
 * @param {Array<{ name: string, mode: number, sounds: Array<{ playing: boolean, duck?: boolean }> }>} playlists
 */
export function shouldDuck(playlists) {
  return playlists.some(
    (p) => classify(p.name, p.mode)?.press === 'cue' && p.sounds.some((s) => s.playing && s.duck !== false),
  );
}

/**
 * The cues the transport strip shows: every cue sound that is playing, or paused part-way.
 * @param {Array<{ id: string, name: string, mode: number, sounds: Array<{ id: string, name: string, playing: boolean, pausedTime?: number | null }> }>} playlists
 * @returns {Array<{ playlistId: string, soundId: string, name: string, bank: string, state: 'playing' | 'paused', pausedTime: number | null }>}
 */
export function transportCues(playlists) {
  return playlists
    .filter((p) => classify(p.name, p.mode)?.press === 'cue')
    .flatMap((p) =>
      p.sounds
        .filter((s) => s.playing || (s.pausedTime ?? 0) > 0)
        .map((s) => ({
          playlistId: p.id,
          soundId: s.id,
          name: s.name,
          bank: p.name,
          state: s.playing ? 'playing' : 'paused',
          pausedTime: s.playing ? null : s.pausedTime,
        })),
    );
}

/** "m:ss" for a transport readout; anything not a finite non-negative number reads "0:00". */
export function clock(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * What a screen reader should hear when the transport changes (Auditorium on v0.4, note 10, Accessibility Specialist):
 * an event that started, paused or stopped. Compares the transport before and after one change.
 * @param {ReturnType<typeof transportCues>} before
 * @param {ReturnType<typeof transportCues>} after
 * @returns {Array<{ kind: 'started' | 'paused' | 'stopped', name: string }>}
 */
export function transportChanges(before, after) {
  const key = (c) => `${c.playlistId}/${c.soundId}`;
  const was = new Map(before.map((c) => [key(c), c]));
  const now = new Map(after.map((c) => [key(c), c]));
  const out = [];
  for (const [k, c] of now) {
    const prev = was.get(k);
    if (c.state === 'playing' && prev?.state !== 'playing') out.push({ kind: 'started', name: c.name });
    else if (c.state === 'paused' && prev?.state === 'playing') out.push({ kind: 'paused', name: c.name });
  }
  for (const [k, c] of was) if (!now.has(k)) out.push({ kind: 'stopped', name: c.name });
  return out;
}

/**
 * Everything sounding right now, for the "Now playing" list above the beds (the Composer's note after first use,
 * 2026-09-24: "all sound played viewer/stopper and volume slider"). Beds first, then events, loops and one-shots.
 * A paused event stays listed, so it can be resumed.
 * @param {Array<{ id: string, name: string, mode: number, sounds: Array<{ id: string, name: string, playing: boolean, pausedTime?: number | null, volume?: number }> }>} playlists
 * @returns {Array<{ playlistId: string, soundId: string, name: string, from: string, kind: 'bed' | 'cue' | 'toggle' | 'oneshot', state: 'playing' | 'paused', volume: number }>}
 */
export function nowPlaying(playlists) {
  const order = { bed: 0, cue: 1, toggle: 2, oneshot: 3 };
  const out = [];
  for (const p of playlists) {
    const c = classify(p.name, p.mode);
    if (!c?.press) continue;
    const kind = c.role === 'bed' ? 'bed' : c.press;
    for (const s of p.sounds) {
      const paused = kind === 'cue' && !s.playing && (s.pausedTime ?? 0) > 0;
      if (!s.playing && !paused) continue;
      out.push({
        playlistId: p.id,
        soundId: s.id,
        name: s.name,
        from: p.name,
        kind,
        state: s.playing ? 'playing' : 'paused',
        volume: Number.isFinite(s.volume) ? s.volume : 0.5,
      });
    }
  }
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));
}
