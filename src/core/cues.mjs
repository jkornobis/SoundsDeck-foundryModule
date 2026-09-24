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
