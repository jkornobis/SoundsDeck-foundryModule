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
