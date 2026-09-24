/**
 * Ducking: while a cue plays, every playing bed sound sits about 10 dB lower, and comes back by itself.
 *
 * 🚨 LOCAL, ON PURPOSE. Each client fades its OWN audio; nothing is written to the world. The alternative - lowering
 * the beds' PlaylistSound.volume - would broadcast a write per duck, and if anything failed mid-cue the world would be
 * left quiet for everyone, persistently. A local fade leaves nothing behind: a reload is always full volume.
 *
 * It runs on every client that loads the module, and it must: each player's browser plays its own copy of the bed.
 *
 * Foundry re-applies a sound's document volume whenever that sound or its playlist updates (PlaylistSound#sync:
 * `sound.fade(this.volume, {duration: 500})`), which would un-duck a bed mid-cue. So the duck is re-applied on the
 * same hooks, which fire after Foundry's own handler.
 */
import { classify } from '../core/classify.mjs';
import { bedVolume, shouldDuck } from '../core/cues.mjs';
import { snapshot } from './snapshot.mjs';

const DOWN_MS = 800;
const UP_MS = 2000;

export function applyDuck() {
  const ducked = shouldDuck(snapshot(game.playlists.contents));
  for (const p of game.playlists) {
    if (classify(p.name, p.mode)?.role !== 'bed') continue;
    for (const s of p.sounds) {
      if (!s.playing || !s.sound) continue;
      const target = bedVolume(s.volume, ducked);
      const apply = () => s.sound?.fade(target, { duration: ducked ? DOWN_MS : UP_MS });
      // A bed track that has only just started is still loading: fade it once it is actually playing.
      if (s.sound.playing) apply();
      else s.sound.load?.().then(() => setTimeout(apply, 100));
    }
  }
  return ducked;
}

/** @returns {{ uninstall: () => void }} */
export function installDucking() {
  const ids = ['updatePlaylistSound', 'updatePlaylist'].map((h) => [h, Hooks.on(h, () => setTimeout(applyDuck, 0))]);
  applyDuck();
  return {
    uninstall() {
      for (const [h, id] of ids) Hooks.off(h, id);
    },
  };
}
