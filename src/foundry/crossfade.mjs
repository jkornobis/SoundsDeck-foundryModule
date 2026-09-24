/**
 * One crossfade between beds (0.6, note 4), in the shell. The rule is core/crossfade.mjs.
 *
 * 1. EVERY client: PlaylistSound#fadeDuration answers the deck's crossfade for a bed's sound while another bed plays.
 *    Foundry reads fadeDuration when it starts a sound (its fade-in) and when it stops one (its fade-out) - read from
 *    the live page, 14.368 - so both halves of a switch take the deck's duration, in every browser, and no document is
 *    written. Outside a switch it is Foundry's own getter, untouched.
 * 2. The GAMEMASTER's deck: switchBed starts the new bed first and stops the others once it is heard in this browser,
 *    so the music never drops out while a large track loads. A player on a slower link can still hear a short gap.
 */
import { classify } from '../core/classify.mjs';
import { bedFadeMs, CROSSFADE_DEFAULT_S } from '../core/crossfade.mjs';

const isBed = (p) => classify(p?.name, p?.mode)?.role === 'bed';

function seconds() {
  try {
    return game.settings.get('sounds-deck', 'crossfade') ?? CROSSFADE_DEFAULT_S;
  } catch {
    return CROSSFADE_DEFAULT_S;
  }
}

/**
 * @param {typeof foundry.documents.PlaylistSound} PlaylistSound
 * @returns {{ installed: boolean, reason?: string, uninstall: () => void }}
 */
export function installCrossfade(PlaylistSound) {
  const proto = PlaylistSound.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'fadeDuration');
  if (typeof desc?.get !== 'function') return { installed: false, reason: 'no fadeDuration getter', uninstall() {} };
  const native = desc.get;
  Object.defineProperty(proto, 'fadeDuration', {
    ...desc,
    get() {
      const nativeMs = native.call(this);
      try {
        const playlist = this.parent;
        const bed = isBed(playlist);
        const otherBedPlaying = bed && game.playlists.some((p) => p !== playlist && p.playing && isBed(p));
        return bedFadeMs({
          isBed: bed,
          otherBedPlaying,
          crossfadeS: seconds(),
          nativeMs,
          durationS: this.sound?.duration,
        });
      } catch {
        return nativeMs; // a fault here must never change how Foundry fades
      }
    },
  });
  return {
    installed: true,
    uninstall() {
      Object.defineProperty(proto, 'fadeDuration', desc);
    },
  };
}

/** Is a sound of this playlist heard in this browser - started, with a position? */
export function heard(playlist) {
  return playlist.sounds.some((s) => s.playing && s.sound?.playing && Number.isFinite(s.sound.currentTime));
}

/**
 * Start `playlist`; stop the beds in `others` once it is heard here. If it is not heard within `waitMs`, they stop
 * anyway: the press asked for this bed.
 * @param {Playlist} playlist
 * @param {string[]} others  bed playlist ids to stop
 */
export async function switchBed(playlist, others, { waitMs = 15000 } = {}) {
  await playlist.playAll();
  for (let t = 0; others.length && t < waitMs && !heard(playlist); t += 200) {
    await new Promise((r) => setTimeout(r, 200));
  }
  for (const id of others) await game.playlists.get(id)?.stopAll();
}
