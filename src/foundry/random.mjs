/**
 * The scheduler behind a pad's 🎲 button: fire a one-shot at random moments until disarmed.
 *
 * It runs in the gamemaster's client, and every shot is an ordinary playSound on the sound's own playlist - so every
 * player hears it, and a shot can be stopped from the deck like any other. Arming lives only in this client and ends
 * with it (a reload disarms everything): a random effect that outlived the GM's session would be one nobody could see.
 */
import { randomDelay } from '../core/random.mjs';

const armed = new Map(); // "playlistId/soundId" -> timeout id

const key = (playlistId, soundId) => `${playlistId}/${soundId}`;
const changed = () => Hooks.callAll('soundsDeckRandom');

export function isArmed(playlistId, soundId) {
  return armed.has(key(playlistId, soundId));
}

/** @returns {Array<{ playlistId: string, soundId: string }>} */
export function armedList() {
  return [...armed.keys()].map((k) => {
    const [playlistId, soundId] = k.split('/');
    return { playlistId, soundId };
  });
}

function schedule(playlistId, soundId) {
  const sound = game.playlists.get(playlistId)?.sounds.get(soundId);
  if (!sound) return disarm(playlistId, soundId);
  const delay = randomDelay(sound.flags?.['sounds-deck']?.random);
  armed.set(
    key(playlistId, soundId),
    setTimeout(async () => {
      const s = game.playlists.get(playlistId)?.sounds.get(soundId);
      if (!s) return disarm(playlistId, soundId);
      if (!s.playing) await s.parent.playSound(s);
      if (armed.has(key(playlistId, soundId))) schedule(playlistId, soundId);
    }, delay),
  );
}

export function arm(playlistId, soundId) {
  if (isArmed(playlistId, soundId)) return;
  armed.set(key(playlistId, soundId), null);
  schedule(playlistId, soundId);
  changed();
}

export function disarm(playlistId, soundId) {
  const k = key(playlistId, soundId);
  if (!armed.has(k)) return;
  clearTimeout(armed.get(k));
  armed.delete(k);
  changed();
}

export function disarmAll() {
  for (const { playlistId, soundId } of armedList()) disarm(playlistId, soundId);
}
