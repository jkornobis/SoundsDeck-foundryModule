/**
 * Combat music (the next program's note 1; the Composer's design, 2026-09-25):
 * - a fight brings the COMBAT MOOD - one of the saved moods, chosen on its card - bed, loops and random effects;
 * - when the fight ends, what played before comes back, the bed resuming where it left off;
 * - it follows Foundry's combat tracker, with a switch to turn that off, and a button and a key work by hand.
 *
 * PURE: whether a start goes ahead and with which mood.
 */

/**
 * @param {{ byHand: boolean, auto: boolean, active: boolean, combatMoodId: unknown,
 *   moods: import('./moods.mjs').Mood[] }} state
 *   byHand: the button or the key, not the tracker; auto: the switch that lets the tracker start it;
 *   active: combat music already plays (what to bring back is already saved)
 * @returns {{ mood: import('./moods.mjs').Mood } | { skip: 'active' | 'off' | 'no-mood' }}
 */
export function combatStart({ byHand, auto, active, combatMoodId, moods }) {
  if (active) return { skip: 'active' }; // a second start must not save the combat music as "what played before"
  if (!byHand && !auto) return { skip: 'off' };
  const mood = typeof combatMoodId === 'string' && combatMoodId ? moods.find((m) => m.id === combatMoodId) : null;
  return mood ? { mood } : { skip: 'no-mood' };
}

/**
 * The bed that plays before a fight, and where it is, so it can resume there.
 * @param {Array<{ id: string, playing: boolean, sounds: Array<{ id: string, playing: boolean, at?: number }> }>} beds
 * @returns {{ playlistId: string, soundId: string, at: number } | null}
 */
export function bedPosition(beds) {
  for (const bed of beds) {
    const s = bed.playing && bed.sounds.find((x) => x.playing);
    if (s) return { playlistId: bed.id, soundId: s.id, at: Number.isFinite(s.at) && s.at > 0 ? s.at : 0 };
  }
  return null;
}
