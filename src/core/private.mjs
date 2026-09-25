/**
 * A sound for chosen players only (0.7, note 1; the Composer's design, 2026-09-25): any pad, played once, on the
 * machines of the players the GM ticks - a whisper only the agent who lost Sanity hears - and quietly in the GM's own
 * ear, so the GM knows when it lands.
 *
 * PURE: what is sent and to whom. The sound goes at the level the table would hear from that pad (its volume times its
 * layer's level), on its own channel, so each player's own channel slider still applies. It plays once: Foundry's
 * private route cannot stop or loop a sound once it is sent.
 */
import { mixVolume } from './cues.mjs';

/** The GM's own copy plays at this share of the sent level - heard, but under the table's sound. */
export const MONITOR_SHARE = 0.4;

/**
 * @param {{ path: string, volume: number, layer: string, levels: object, channel?: string }} a
 * @returns {{ src: string, volume: number, loop: false, channel: string }}  the data Foundry's playAudio carries
 */
export function privateAudio({ path, volume, layer, levels, channel }) {
  return { src: path, volume: mixVolume(volume, layer, levels, false), loop: false, channel: channel || 'music' };
}

/**
 * Who can receive it: the chosen users that are connected, never the sender.
 * @param {Array<{ id: string, active: boolean }>} users
 * @param {string[]} chosen
 * @param {string} selfId
 * @returns {string[]}
 */
export function recipientsOf(users, chosen, selfId) {
  const wanted = new Set(chosen);
  return users.filter((u) => u.active && u.id !== selfId && wanted.has(u.id)).map((u) => u.id);
}
