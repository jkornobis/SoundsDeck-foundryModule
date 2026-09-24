/**
 * Moods: a saved mix, recalled in one click (Auditorium on 0.5.2, note 1 - the one thing every tabletop audio tool
 * the field study read has: Syrinscape's Moods, Tabletop Audio's saved SoundPads, Audio Forge's State Links).
 *
 * WHAT A MOOD HOLDS - the parts of the sound that describe a PLACE, not a moment:
 *   - the bed playing (a playlist; the track is left to the playlist, so a recall does not always open on the same one)
 *   - the room loops switched on, each with its volume
 *   - the one-shots armed to fire at random
 * Events (cues) and one-shots fired by hand are moments: a recall neither saves nor stops them.
 *
 * PURE. The shell passes playlist snapshots and the list of armed one-shots, and carries the plan out.
 */
import { classify } from './classify.mjs';

/**
 * @typedef {{ playlistId: string, soundId: string }} SoundRef
 * @typedef {{ id: string, name: string, bed: string | null, loops: Array<SoundRef & { volume: number }>, random: SoundRef[] }} Mood
 */

const key = (r) => `${r.playlistId}/${r.soundId}`;

function roles(playlists) {
  const beds = [];
  const loops = []; // every sound of a room-loop bank: { playlistId, soundId, playing, volume }
  const oneshots = new Set();
  for (const p of playlists) {
    const c = classify(p.name, p.mode);
    if (c?.role === 'bed') beds.push(p);
    else if (c?.press === 'toggle')
      for (const s of p.sounds) loops.push({ playlistId: p.id, soundId: s.id, playing: s.playing, volume: s.volume });
    else if (c?.press === 'oneshot') for (const s of p.sounds) oneshots.add(key({ playlistId: p.id, soundId: s.id }));
  }
  return { beds, loops, oneshots };
}

/**
 * The mix sounding right now, as a mood.
 * @param {import('./beds.mjs').PlaylistSnap[]} playlists
 * @param {SoundRef[]} armed   the one-shots armed to fire at random, in this client
 * @param {{ id: string, name: string }} label
 * @returns {Mood}
 */
export function captureMood(playlists, armed, { id, name }) {
  const { beds, loops, oneshots } = roles(playlists);
  return {
    id,
    name,
    bed: beds.find((b) => b.playing)?.id ?? null,
    loops: loops
      .filter((l) => l.playing)
      .map(({ playlistId, soundId, volume }) => ({
        playlistId,
        soundId,
        volume: Number.isFinite(volume) ? volume : 0.5,
      })),
    random: armed.filter((r) => oneshots.has(key(r))).map(({ playlistId, soundId }) => ({ playlistId, soundId })),
  };
}

/** A mood with nothing in it would be a silence button; the deck refuses to save one. */
export function isEmptyMood(mood) {
  return !mood.bed && !mood.loops.length && !mood.random.length;
}

/**
 * What to change to go from the mix sounding now to a mood. Anything the mood names that no longer exists is skipped
 * and counted in `missing`, so a deleted sound never breaks a recall.
 * @param {Mood} mood
 * @param {import('./beds.mjs').PlaylistSnap[]} playlists
 * @param {SoundRef[]} armed
 */
export function moodPlan(mood, playlists, armed) {
  const { beds, loops, oneshots } = roles(playlists);
  const bedIds = new Set(beds.map((b) => b.id));
  const loopByKey = new Map(loops.map((l) => [key(l), l]));
  const wantedLoops = mood.loops.filter((l) => loopByKey.has(key(l)));
  const wantedLoopKeys = new Set(wantedLoops.map(key));
  const wantedRandom = mood.random.filter((r) => oneshots.has(key(r)));
  const wantedRandomKeys = new Set(wantedRandom.map(key));
  const armedKeys = new Set(armed.map(key));
  const bed = mood.bed && bedIds.has(mood.bed) ? mood.bed : null;
  const ref = ({ playlistId, soundId }) => ({ playlistId, soundId });
  return {
    stopBeds: beds.filter((b) => b.playing && b.id !== bed).map((b) => b.id),
    startBed: bed && !beds.find((b) => b.id === bed).playing ? bed : null,
    stopLoops: loops.filter((l) => l.playing && !wantedLoopKeys.has(key(l))).map(ref),
    startLoops: wantedLoops.filter((l) => !loopByKey.get(key(l)).playing),
    setVolumes: wantedLoops.filter((l) => {
      const now = loopByKey.get(key(l));
      return now.playing && Math.abs((now.volume ?? 0) - l.volume) > 0.001;
    }),
    disarm: armed.filter((r) => !wantedRandomKeys.has(key(r))).map(ref),
    arm: wantedRandom.filter((r) => !armedKeys.has(key(r))),
    missing:
      (mood.bed && !bed ? 1 : 0) +
      (mood.loops.length - wantedLoops.length) +
      (mood.random.length - wantedRandom.length),
  };
}

/** A mood is ON when recalling it would change nothing. */
export function moodIsOn(mood, playlists, armed) {
  const p = moodPlan(mood, playlists, armed);
  return (
    !p.stopBeds.length &&
    !p.startBed &&
    !p.stopLoops.length &&
    !p.startLoops.length &&
    !p.setVolumes.length &&
    !p.disarm.length &&
    !p.arm.length &&
    (mood.bed === null || beds(playlists).has(mood.bed))
  );
}

function beds(playlists) {
  return new Set(roles(playlists).beds.map((b) => b.id));
}
