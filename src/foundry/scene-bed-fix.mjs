/**
 * Replace Foundry's scene -> playlist handover with one that keeps a bed playing across two scenes that share it.
 *
 * THE DEFECT (Foundry 14.368, Playlists#_onChangeScene, read from the served client 2026-09-24):
 *
 *     const {playlistId: priorPlaylistId, playlistSound: priorPlaylistSoundId} = this.#sceneState;
 *
 * the state is written as `playlistSoundId` and read back as `playlistSound`, so the prior sound id is always
 * undefined, every scene activation counts as a change, and the method stops the playlist and starts it again -
 * on a new track, because a shuffle reseeds on every start.
 *
 * THE FIX STEPS ASIDE BY ITSELF: it installs only while the defect's own line is in Foundry's source. A Foundry
 * release that corrects it gets its own method back, with nothing to update here.
 *
 * The decision is the pure core's (decideSceneBed); this file only reads scenes and carries the verdict out,
 * with the same actions Foundry's method performs.
 */
import { classify } from '../core/classify.mjs';
import { sceneAudioPlan } from '../core/scene-bed.mjs';

const DEFECT = 'playlistSound: priorPlaylistSoundId';

/** @param {Scene|null} scene */
function bedOf(scene) {
  const playlistId = scene?.playlist?.id;
  return playlistId ? { playlistId, soundId: scene.playlistSound?.id ?? null } : null;
}

/**
 * @param {typeof foundry.documents.collections.Playlists} Playlists
 * @param {Scene|null} activeScene  the scene active when the fix installs - Foundry's own starting state
 * @returns {{ installed: boolean, reason?: string, uninstall: () => void }}
 */
export function installSceneBedFix(Playlists, activeScene) {
  const proto = Playlists.prototype;
  const original = proto._onChangeScene;
  if (typeof original !== 'function') return { installed: false, reason: 'no _onChangeScene', uninstall() {} };
  if (!String(original).includes(DEFECT)) return { installed: false, reason: 'defect not present', uninstall() {} };

  let prior = bedOf(activeScene);
  proto._onChangeScene = async function (scene) {
    const next = bedOf(scene);
    const playingBeds = this.contents
      .filter((p) => p.playing && classify(p.name, p.mode)?.role === 'bed')
      .map((p) => p.id);
    const plan = sceneAudioPlan(prior, next, playingBeds);
    prior = next;
    // Foundry's own four actions, applied to the plan: a named sound is stopped or started alone, otherwise the
    // whole playlist.
    for (const s of plan.stop) {
      const playlist = this.get(s.playlistId);
      const sound = s.soundId && playlist?.sounds.get(s.soundId);
      if (sound) await sound.update({ playing: false });
      else if (playlist?.playing) await playlist.stopAll();
    }
    if (plan.start) {
      const playlist = this.get(plan.start.playlistId);
      const sound = plan.start.soundId && playlist?.sounds.get(plan.start.soundId);
      if (sound) await sound.update({ playing: true });
      else if (playlist) await playlist.playAll();
    }
  };
  return {
    installed: true,
    uninstall() {
      proto._onChangeScene = original;
    },
  };
}
