/**
 * Late joiners catch up, and each bed's next track is ready (0.7, note 2), in the shell. The rules are
 * core/late-join.mjs.
 *
 * 1. THE MARK: a start's moment is added to the update that starts it - preUpdatePlaylist for Foundry's own
 *    playAll / playSound / playNext, which all update through the playlist's `sounds` array, and preUpdatePlaylistSound
 *    for a sound updated on its own. Only the client making the update runs these, so one mark per start. Then, when
 *    the gamemaster's own copy actually starts - a large track loads for seconds first - the mark moves to that moment.
 * 2. THE CATCH-UP: Sound#play is wrapped on every client, like the trim. When Foundry starts a sound that was already
 *    playing before this browser joined, the wrapper moves the start to where the table is. A joining browser plays
 *    only once its audio is unlocked by a gesture, so the position is taken at that moment, not at the join.
 * 3. THE NEXT TRACK: Foundry loads a bed's next track itself, but only 20 s before the current one ends
 *    (Playlist#_onSoundStart, CONFIG.Playlist.autoPreloadSeconds - read from the live page 14.368). On a slow
 *    connection a 20 MB track may not arrive in time, and a skip gets nothing. Every browser now loads it as soon as
 *    the current track starts, the same way Foundry does (PlaylistSound#load), for beds only.
 */
import { layerOf } from '../core/cues.mjs';
import { CATCH_UP_LAYERS, catchUpOffset, heardMark, startMark } from '../core/late-join.mjs';
import { trimOf } from '../core/trim.mjs';
import { ownerOf } from './trim.mjs';

const MODULE_ID = 'sounds-deck';

const catchesUp = (playlist) => CATCH_UP_LAYERS.includes(layerOf(playlist?.name, playlist?.mode));

/** Add the start's moment to one sound's change, when the change is a start. */
function mark(change, current, playlist, options) {
  if (!change || !current || !catchesUp(playlist)) return;
  const at = startMark(change, current, game.time.serverTime, { restart: options?.forceSync === true });
  if (at === null) return;
  change.flags ??= {};
  change.flags[MODULE_ID] = { ...change.flags[MODULE_ID], startedAt: at };
}

/**
 * @param {{ Sound: typeof foundry.audio.Sound, Playlist: typeof foundry.documents.Playlist }} classes
 * @returns {{ installed: boolean, reason?: string, joinedAt: number, uninstall: () => void }}
 *   joinedAt: the moment this browser joined - a sound started before it catches up. Only the tests move it.
 */
export function installLateJoin({ Sound, Playlist }) {
  const play = Sound.prototype.play;
  const onSoundStart = Playlist.prototype._onSoundStart;
  if (typeof play !== 'function' || typeof onSoundStart !== 'function') {
    return { installed: false, reason: 'no Sound#play or Playlist#_onSoundStart', joinedAt: 0, uninstall() {} };
  }
  const handle = { installed: true, joinedAt: game.time.serverTime, uninstall: null };

  const hooks = [
    [
      'preUpdatePlaylist',
      Hooks.on('preUpdatePlaylist', (playlist, changed, options) => {
        for (const change of changed.sounds ?? []) mark(change, playlist.sounds.get(change._id), playlist, options);
      }),
    ],
    [
      'preUpdatePlaylistSound',
      Hooks.on('preUpdatePlaylistSound', (sound, changed, options) => mark(changed, sound, sound.parent, options)),
    ],
  ];

  const wrappedPlay = function (options = {}, ...rest) {
    let chosen = options;
    try {
      const ps = ownerOf(this);
      // Foundry's own start passes no offset, or the paused point; anything else was asked for, and is kept.
      if (ps?.playing && catchesUp(ps.parent) && (options.offset === undefined || options.offset === ps.pausedTime)) {
        const offset = catchUpOffset({
          startedAt: ps.getFlag(MODULE_ID, 'startedAt'),
          joinedAt: handle.joinedAt,
          now: game.time.serverTime,
          duration: this.duration,
          loop: options.loop ?? ps.repeat,
          trim: trimOf(ps.getFlag(MODULE_ID, 'trim')),
        });
        if (offset !== null) chosen = { ...options, offset };
      }
    } catch (error) {
      console.error(
        `${MODULE_ID} | could not place a late start; the sound plays from where Foundry starts it:`,
        error,
      );
    }
    return play.call(this, chosen, ...rest);
  };

  const wrappedStart = async function (sound, ...rest) {
    const result = await onSoundStart.call(this, sound, ...rest);
    try {
      // The gamemaster's copy is the table's clock: once it actually plays, the mark says when it was heard.
      if (catchesUp(this) && sound?.playing && game.users.activeGM?.isSelf) {
        const mark = heardMark(game.time.serverTime, sound.sound?.currentTime, sound.getFlag(MODULE_ID, 'startedAt'));
        if (mark !== null) await sound.setFlag(MODULE_ID, 'startedAt', mark);
      }
    } catch (error) {
      console.warn(
        `${MODULE_ID} | a start could not be marked as heard; late joiners use the request's moment:`,
        error,
      );
    }
    try {
      if (layerOf(this.name, this.mode) === 'bed' && sound?.playing) {
        const next = this._getNextSound(sound.id);
        if (next && next !== sound) await next.load();
      }
    } catch (error) {
      console.warn(`${MODULE_ID} | the next track could not be loaded ahead; it loads when it plays:`, error);
    }
    return result;
  };

  Sound.prototype.play = wrappedPlay;
  Playlist.prototype._onSoundStart = wrappedStart;
  handle.uninstall = () => {
    if (Sound.prototype.play === wrappedPlay) Sound.prototype.play = play;
    if (Playlist.prototype._onSoundStart === wrappedStart) Playlist.prototype._onSoundStart = onSoundStart;
    for (const [name, id] of hooks) Hooks.off(name, id);
  };
  return handle;
}
