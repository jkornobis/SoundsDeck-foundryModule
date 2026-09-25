/**
 * A sound for chosen players only (0.7, note 1), in the shell. The rules are core/private.mjs.
 *
 * FOUNDRY'S OWN ROUTE: AudioHelper.play(data, { recipients }) emits the socket event "playAudio" to those users, whose
 * clients play it locally (AudioHelper#_activateSocketListeners: playAudio -> play(data, false); read from the live
 * page, 14.368). It would also play the sound at full level on the sender's machine, and the GM wants it quietly - so
 * the same event is emitted here directly, and the GM's copy is played at MONITOR_SHARE of it.
 * Once sent it cannot be stopped or looped: that is the route's limit, chosen by him over a release-dependent channel.
 */
import { LEVELS_DEFAULT, layerOf } from '../core/cues.mjs';
import { MONITOR_SHARE, privateAudio, recipientsOf } from '../core/private.mjs';

const MODULE_ID = 'sounds-deck';

function levels() {
  try {
    return game.settings.get(MODULE_ID, 'levels') ?? LEVELS_DEFAULT;
  } catch {
    return LEVELS_DEFAULT;
  }
}

/** The players last sent to, ticked again next time if they are still connected. */
let lastChosen = [];
export const lastRecipients = () => [...lastChosen];

/**
 * @param {PlaylistSound} sound  a pad
 * @param {string[]} userIds     the players ticked
 * @returns {string[]} the users it was actually sent to (the connected ones), empty if none
 */
export function sendPrivately(sound, userIds) {
  const recipients = recipientsOf(game.users.contents, userIds, game.user.id);
  if (!recipients.length) return [];
  lastChosen = recipients;
  const playlist = sound.parent;
  const data = privateAudio({
    path: sound.path,
    volume: sound.volume,
    layer: layerOf(playlist.name, playlist.mode) ?? 'oneshot',
    levels: levels(),
    channel: sound.channel || playlist.channel,
  });
  game.socket.emit('playAudio', data, { recipients });
  game.audio.play(data.src, { context: game.audio[data.channel], volume: data.volume * MONITOR_SHARE, loop: false });
  return recipients;
}
