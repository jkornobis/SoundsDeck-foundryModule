/**
 * Carry a mood's plan out (core/moods.mjs decides it): the loops and the random one-shots first, then the music as one
 * crossfade (note 4). A mood card and a scene that brings a mood (note 5) both call this, so they do exactly the same.
 */
import { moodPlan } from '../core/moods.mjs';
import { switchBed } from './crossfade.mjs';
import { arm, armedList, disarm } from './random.mjs';
import { snapshot } from './snapshot.mjs';

/**
 * @param {import('../core/moods.mjs').Mood} mood
 * @returns {Promise<number>} how many parts of the mood no longer exist and were skipped
 */
export async function recallMood(mood) {
  const plan = moodPlan(mood, snapshot(game.playlists.contents), armedList());
  const soundOf = ({ playlistId, soundId }) => game.playlists.get(playlistId)?.sounds.get(soundId);
  for (const r of plan.disarm) disarm(r.playlistId, r.soundId);
  for (const r of plan.stopLoops) {
    const s = soundOf(r);
    if (s) await s.parent.stopSound(s);
  }
  for (const r of plan.setVolumes) await soundOf(r)?.update({ volume: r.volume });
  for (const r of plan.startLoops) {
    const s = soundOf(r);
    if (s) await s.update({ volume: r.volume, playing: true });
  }
  for (const r of plan.arm) arm(r.playlistId, r.soundId);
  const bed = plan.startBed && game.playlists.get(plan.startBed);
  if (bed) await switchBed(bed, plan.stopBeds);
  else for (const id of plan.stopBeds) await game.playlists.get(id)?.stopAll();
  return plan.missing;
}
