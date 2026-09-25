/**
 * Trim a track (0.6, theme 7), in the shell. The rule is core/trim.mjs.
 *
 * Foundry's Sound already knows how to play part of a file once: given loopStart and loopEnd and no loop, it starts at
 * loopStart and plays loopEnd - loopStart seconds; with loop on, it repeats that part (Sound#configurePlayback, read
 * from the live page, 14.368). PlaylistSound never passes them, so Sound#play is wrapped - on EVERY client, each
 * playing its own copy - to add a sound's trim when the sound belongs to a playlist and has one.
 *
 * Its natural end then does what any end does: the playlist's owner moves a shuffle on, or stops a one-shot
 * (PlaylistSound#_onEnd). Two gaps are closed here:
 * - a STREAMED file (longer than Sound.MAX_BUFFER_DURATION, 600 s) ignores the length, so on the gamemaster's client
 *   its end is scheduled by hand, at the trimmed end;
 * - a track that does not repeat fades out before its trimmed end, over its own fade, instead of stopping dead - the
 *   fade Foundry schedules is at the file's own end, which a trimmed track never reaches.
 */
import { trimOf } from '../core/trim.mjs';

const MODULE_ID = 'sounds-deck';

/** The PlaylistSound a Sound plays for, if any. */
function ownerOf(sound) {
  for (const playlist of game.playlists) for (const s of playlist.sounds) if (s.sound === sound) return s;
  return null;
}

// Sound#play calls itself again when another operation was running, so a start can report twice: schedule once per
// start (a start is known by its startTime).
const scheduled = new WeakMap();

function afterStart(sound, ps, trim) {
  if (!trim.end || !sound.playing || scheduled.get(sound) === sound.startTime) return;
  scheduled.set(sound, sound.startTime);
  const fade = ps.fadeDuration;
  if (!ps.repeat && fade > 0)
    sound.schedule((s) => s.fade(0, { duration: fade }), Math.max(trim.start, trim.end - fade / 1000));
  if (!sound.isBuffer && !ps.repeat && ps.parent?.isOwner) {
    sound.schedule(() => {
      if (ps.playing && ps.sound === sound) ps.parent._onSoundEnd(ps);
    }, trim.end);
  }
}

/** The Trim fields in a sound's settings, right under its Fade. */
function addTrimFields(app, element) {
  const root = element instanceof HTMLElement ? element : element?.[0];
  const anchor = root?.querySelector('[name="fade"]')?.closest('.form-group');
  if (!anchor || root.querySelector(`[name="flags.${MODULE_ID}.trim.start"]`)) return;
  const trim = app.document?.getFlag(MODULE_ID, 'trim') ?? {};
  const value = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? ` value="${Number(v)}"` : '');
  const L = (key) => game.i18n.localize(`SOUNDS_DECK.Trim.${key}`);
  const group = document.createElement('div');
  group.className = 'form-group slim';
  group.innerHTML = `<label>${L('Label')} <span class="units">(s)</span></label>
    <div class="form-fields">
      <label>${L('Start')} <input type="number" min="0" step="0.1" name="flags.${MODULE_ID}.trim.start"${value(trim.start)} placeholder="0"></label>
      <label>${L('End')} <input type="number" min="0" step="0.1" name="flags.${MODULE_ID}.trim.end"${value(trim.end)}></label>
    </div>
    <p class="hint">${L('Hint')}</p>`;
  anchor.after(group);
}

/**
 * @param {typeof foundry.audio.Sound} Sound
 * @returns {{ installed: boolean, reason?: string, uninstall: () => void }}
 */
export function installTrim(Sound) {
  const proto = Sound.prototype;
  const original = proto.play;
  if (typeof original !== 'function') return { installed: false, reason: 'no Sound#play', uninstall() {} };
  const wrapped = function (options = {}, ...rest) {
    let ps = null;
    let trim = null;
    try {
      ps = ownerOf(this);
      trim = ps && trimOf(ps.getFlag(MODULE_ID, 'trim'));
    } catch (error) {
      console.error(`${MODULE_ID} | could not read a trim; the sound plays whole:`, error);
    }
    if (!trim) return original.call(this, options, ...rest);
    const started = original.call(this, { ...options, loopStart: trim.start, loopEnd: trim.end ?? undefined }, ...rest);
    Promise.resolve(started)
      .then(() => afterStart(this, ps, trim))
      .catch(() => {});
    return started;
  };
  proto.play = wrapped;
  const hook = Hooks.on('renderPlaylistSoundConfig', addTrimFields);
  return {
    installed: true,
    uninstall() {
      if (proto.play === wrapped) proto.play = original;
      Hooks.off('renderPlaylistSoundConfig', hook);
    },
  };
}
