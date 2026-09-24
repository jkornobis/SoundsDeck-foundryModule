/**
 * One crossfade between beds (0.6, note 4; the Composer's design, 2026-09-25). When the music changes from one bed to
 * another - a bed card, or a mood that brings another bed - the new bed starts first, the old one stops only once the
 * new one is heard, and both fade over ONE duration: a world setting, 4 s by default.
 *
 * PURE: the fade a bed's sound should use. Two beds playing at once only happens during such a switch, so that overlap
 * is the signal. Every browser can read it from the documents, and nothing has to be sent or stored.
 */
export const CROSSFADE_DEFAULT_S = 4;

/**
 * @param {{ isBed: boolean, otherBedPlaying: boolean, crossfadeS: number, nativeMs: number, durationS?: number }} a
 *   nativeMs: the fade Foundry would use (the sound's or its playlist's own); durationS: the sound's length, if known
 * @returns {number} milliseconds
 */
export function bedFadeMs({ isBed, otherBedPlaying, crossfadeS, nativeMs, durationS }) {
  if (!isBed || !otherBedPlaying || !Number.isFinite(crossfadeS)) return nativeMs;
  const ms = Math.max(0, crossfadeS) * 1000;
  // Foundry never fades longer than half a sound (PlaylistSound#fadeDuration); neither does the crossfade.
  return Number.isFinite(durationS) ? Math.min(ms, Math.ceil(durationS / 2) * 1000) : ms;
}
