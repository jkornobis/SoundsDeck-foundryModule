/**
 * Keep a sound that is stopped before it has started from staying "playing", and silent, until the page reloads.
 *
 * THE DEFECT (Foundry 14.368, PlaylistSound#_onStart, read from the live page 2026-09-24 - issue #37):
 *
 *     if ( !this.playing ) return this.sound.stop();
 *
 * `_onStart` answers the Sound's "play" event, which Sound#play fires from INSIDE its own start. When the document
 * was set back to not playing before the Sound started (stopped while its file loaded, or while its last fade-out
 * ran), that stop completes within the start: it disconnects the sound and clears its start time. Sound#play then
 * resumes and marks it PLAYING anyway. The table hears nothing from that sound again, and every later press only
 * fades a node nobody is listening to. Measured with no deck code at all: state 4, position NaN, gain 0.
 *
 * THE FIX: the same stop, a moment later - once Sound#play has finished - so it meets a sound that really plays and
 * stops it cleanly. When the document still wants the sound, _onStart is Foundry's own method, untouched.
 *
 * It runs on EVERY client: each browser starts its own copy of a sound and meets the race on its own timing, and a
 * player's slower download makes it likelier there.
 *
 * THE FIX STEPS ASIDE BY ITSELF: it installs only while the defect's line is in Foundry's source.
 */
const DEFECT = 'return this.sound.stop()';

/**
 * @param {typeof foundry.documents.PlaylistSound} PlaylistSound
 * @returns {{ installed: boolean, reason?: string, uninstall: () => void }}
 */
export function installSilentStartFix(PlaylistSound) {
  const proto = PlaylistSound.prototype;
  const original = proto._onStart;
  if (typeof original !== 'function') return { installed: false, reason: 'no _onStart', uninstall() {} };
  if (!String(original).includes(DEFECT)) return { installed: false, reason: 'defect not present', uninstall() {} };

  proto._onStart = function (...args) {
    if (this.playing) return original.apply(this, args);
    const sound = this.sound;
    // Sound#play marks itself PLAYING a few microtasks from now; a timeout runs after them. If the document wants the
    // sound again by then, it is left to play.
    setTimeout(() => {
      if (!this.playing && sound?.playing) sound.stop();
    }, 0);
  };
  return {
    installed: true,
    uninstall() {
      proto._onStart = original;
    },
  };
}
