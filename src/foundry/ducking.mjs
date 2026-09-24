/**
 * The mix: every playing sound on the deck sits at its own volume times its layer's level (0.6, note 2), and a bed
 * sits about 10 dB lower while an event plays (ducking, 0.3), coming back by itself.
 *
 * 🚨 LOCAL, ON PURPOSE. Each client fades its OWN audio; no sound's volume is written to the world. The alternative -
 * lowering the beds' PlaylistSound.volume - would broadcast a write per duck, and if anything failed mid-cue the world
 * would be left quiet for everyone, persistently. A local fade leaves nothing behind. The layer levels are the one
 * shared input: a world setting, so every browser applies the same mix.
 *
 * It runs on every client that loads the module, and it must: each player's browser plays its own copy of every sound.
 *
 * Foundry re-applies a sound's document volume whenever that sound or its playlist updates (PlaylistSound#sync:
 * `sound.fade(this.volume, {duration: 500})`), which would undo the mix. So the mix is re-applied on the same hooks,
 * which fire after Foundry's own handler.
 */
import { LEVELS_DEFAULT, layerOf, mixVolume, shouldDuck } from '../core/cues.mjs';
import { snapshot } from './snapshot.mjs';

const DOWN_MS = 800;
const UP_MS = 2000;
const LEVEL_MS = 250;

/** The table's layer levels. A page that has not registered the setting (the player proof's) mixes at full. */
function levels() {
  try {
    return game.settings.get('sounds-deck', 'levels') ?? LEVELS_DEFAULT;
  } catch {
    return LEVELS_DEFAULT;
  }
}

let wasDucked = false;
let lastMix = JSON.stringify(LEVELS_DEFAULT);

/** @param {Record<string, number>} [preview]  levels to hear now, while a slider moves, before the table's are saved */
export function applyDuck(preview) {
  const ducked = shouldDuck(snapshot(game.playlists.contents));
  const mix = preview ?? levels();
  const duckMoved = ducked !== wasDucked;
  const mixMoved = JSON.stringify(mix) !== lastMix;
  wasDucked = ducked;
  lastMix = JSON.stringify(mix);
  // A duck moving in or out takes its own time; anything else (a level, a volume) follows quickly.
  const bedMs = duckMoved ? (ducked ? DOWN_MS : UP_MS) : LEVEL_MS;
  for (const p of game.playlists) {
    const layer = layerOf(p.name, p.mode);
    if (!layer) continue;
    for (const s of p.sounds) {
      if (!s.playing || !s.sound) continue;
      const target = mixVolume(s.volume, layer, mix, ducked);
      const duration = layer === 'bed' ? bedMs : LEVEL_MS;
      // Nothing to change from what Foundry itself plays: leave the sound alone, so its own fade-in is not cut short.
      const moved = mixMoved || (layer === 'bed' && duckMoved);
      if (!moved && Math.abs(target - s.volume) < 0.001) continue;
      const apply = () => s.sound?.fade(target, { duration });
      // A sound that has only just started is still loading: fade it once it is actually playing.
      if (s.sound.playing) apply();
      else s.sound.load?.().then(() => setTimeout(apply, 100));
    }
  }
  return ducked;
}

/** @returns {{ uninstall: () => void }} */
export function installDucking() {
  const ids = ['updatePlaylistSound', 'updatePlaylist'].map((h) => [
    h,
    Hooks.on(h, () => setTimeout(() => applyDuck(), 0)),
  ]);
  applyDuck();
  return {
    uninstall() {
      for (const [h, id] of ids) Hooks.off(h, id);
    },
  };
}
