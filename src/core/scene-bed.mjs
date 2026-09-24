/**
 * What should happen to the bed when the active scene changes.
 *
 * WHY THIS EXISTS: Foundry 14.368 means to do exactly this and does not. Playlists#_onChangeScene stores the
 * previous state as { playlistId, playlistSoundId } and reads it back as { playlistId, playlistSound } - a key
 * that does not exist - so the previous sound is always `undefined`, never equal to the next `null`, and EVERY
 * activation counts as a change. Measured 2026-09-24: moving between two scenes bound to the same playlist
 * restarts it on a new track. (FoundryVTT-KnowledgeDB, agent-manual/subsystems/playlists-and-audio.md.)
 *
 * PURE: takes two plain states, returns a verdict. The shell reads the scenes and acts on the verdict.
 *
 * @typedef {{ playlistId: string, soundId: string | null } | null} BedState   null = the scene has no bed
 * @param {BedState} prev   the bed of the scene being left
 * @param {BedState} next   the bed of the scene being entered
 * @returns {'none' | 'keep' | 'start' | 'stop' | 'switch'}
 */
export function decideSceneBed(prev, next) {
  const p = prev?.playlistId ? prev : null;
  const n = next?.playlistId ? next : null;
  if (!p && !n) return 'none';
  if (!p) return 'start';
  if (!n) return 'stop';
  if (p.playlistId !== n.playlistId) return 'switch';
  // Same playlist. A scene that names no particular sound means "this bed, whatever is playing": keep it.
  // A scene that names a sound wants THAT sound, so only an identical one keeps.
  return n.soundId == null || n.soundId === p.soundId ? 'keep' : 'switch';
}

/**
 * The full plan for a scene change, with the Composer's v0.4 rule (2026-09-24): "manual music survives a scene
 * change" - when you pick music by hand, a scene with no music of its own keeps it playing.
 *
 * STATELESS on purpose. A bed that is playing and is NOT the previous scene's own was picked by hand, wherever from
 * (the deck, the sidebar, a macro), so no "manual" flag has to be remembered or can go stale:
 *   - next scene has NO bed      -> stop only the previous scene's own bed; anything picked by hand plays on
 *   - next scene HAS a bed       -> it starts, and every other playing bed stops: a bed is exclusive
 *   - same bed on both scenes    -> nothing (the 14.368 defect this module exists to fix)
 *
 * @param {BedState} prev
 * @param {BedState} next
 * @param {string[]} playingBeds  playlist ids of the beds playing right now
 * @returns {{ verdict: string, stop: Array<{ playlistId: string, soundId: string | null }>, start: BedState }}
 */
export function sceneAudioPlan(prev, next, playingBeds = []) {
  const verdict = decideSceneBed(prev, next);
  if (verdict === 'none' || verdict === 'keep') return { verdict, stop: [], start: null };
  if (verdict === 'stop') {
    const picked = playingBeds.filter((id) => id !== prev.playlistId);
    return { verdict: picked.length ? 'stop-scene-keep-picked' : 'stop', stop: [prev], start: null };
  }
  const stop = [];
  // a sound switch inside the same playlist stops only that sound; a different bed stops the previous scene's
  if (prev?.playlistId) stop.push(prev);
  for (const id of playingBeds) {
    if (id !== next.playlistId && !stop.some((s) => s.playlistId === id)) stop.push({ playlistId: id, soundId: null });
  }
  return { verdict, stop, start: next };
}
