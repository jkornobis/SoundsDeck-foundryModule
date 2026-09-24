/**
 * Preview in the GM's ear (0.6, note 3): the 🎧 on a pad plays that sound in THIS browser only. No document changes,
 * nothing is sent to the other clients, and the beds do not duck - ducking follows playing documents, and a preview
 * is not one.
 *
 * game.audio.play(src, { context, volume }) is Foundry's local playback: a new Sound, loaded and played in this page
 * (AudioHelper#play, read from the live page 2026-09-25). The document route, PlaylistSound#update, would play the pad
 * for everyone.
 *
 * It plays at what the table would hear from that pad - its own volume times its layer's level - on its own channel,
 * so this seat's channel slider applies as well. A loop plays once. One at a time, 20 s at most (core/preview.mjs).
 */
import { LEVELS_DEFAULT, layerOf, mixVolume } from '../core/cues.mjs';
import { PREVIEW_MAX_MS, previewPress } from '../core/preview.mjs';

/** @type {{ soundId: string, sound: foundry.audio.Sound | null, timer: number | null } | null} */
let current = null;

/** Tell an open deck the headphones changed, the same way random arming does. */
const changed = () => Hooks.callAll('soundsDeckPreview');

function levels() {
  try {
    return game.settings.get('sounds-deck', 'levels') ?? LEVELS_DEFAULT;
  } catch {
    return LEVELS_DEFAULT;
  }
}

/** @returns {string | null} the pad in the ear now */
export function previewing() {
  return current?.soundId ?? null;
}

/** @returns {foundry.audio.Sound | null} the Sound playing in the ear now, once it has loaded */
export function previewSound() {
  return current?.sound ?? null;
}

/** Stop whatever is in the ear, with a short fade so it does not click. */
export function stopPreview() {
  const was = current;
  current = null;
  if (!was) return;
  clearTimeout(was.timer);
  was.sound?.stop({ fade: 150 });
  changed();
}

/**
 * @param {PlaylistSound} sound  the pad's document
 * @param {{ maxMs?: number }} [options]  maxMs: only the tests shorten it
 * @returns {Promise<foundry.audio.Sound | null>}
 */
export async function togglePreview(sound, { maxMs = PREVIEW_MAX_MS } = {}) {
  const plan = previewPress(previewing(), sound.id);
  if (plan.stop) stopPreview();
  if (!plan.start) return null;
  const playlist = sound.parent;
  const volume = mixVolume(sound.volume, layerOf(playlist.name, playlist.mode) ?? 'oneshot', levels(), false);
  const entry = { soundId: sound.id, sound: null, timer: null };
  current = entry;
  changed();
  const played = await game.audio.play(sound.path, { context: sound.context, volume, loop: false });
  // Stopped or replaced while the file loaded: this one is no longer wanted.
  if (current !== entry) {
    played.stop();
    return null;
  }
  entry.sound = played;
  entry.timer = setTimeout(() => current === entry && stopPreview(), maxMs);
  played.addEventListener(
    'end',
    () => {
      if (current !== entry) return;
      clearTimeout(entry.timer);
      current = null;
      changed();
    },
    { once: true },
  );
  return played;
}
