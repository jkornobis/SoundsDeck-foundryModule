/**
 * Game-event sounds (the next program's note 2; the Composer's design, 2026-09-25): a pad can play on a Delta Green
 * roll - a critical success, a critical failure, a Sanity loss, a weapon's damage or Lethality roll. It is chosen in
 * the pad's own settings ("Plays on"); several pads on one event are a random pick among them; a weapon can have its
 * own pad by name, and falls back to the pads for any weapon. Everyone hears it, and a roll the players cannot see
 * plays nothing.
 *
 * Delta Green's rolls say it themselves (read from the system 2.0.1 in the live page): a d100 roll knows isCritical and
 * isSuccess (01, 100 and matching digits are critical; 100 always fails), SAN damage and weapon damage and Lethality
 * are their own roll classes, and a weapon roll keeps its item's name through the chat message.
 *
 * PURE: which events a message's rolls are, and which pad answers one.
 */

export const GAME_EVENTS = Object.freeze(['critSuccess', 'critFailure', 'sanityLoss', 'weapon']);

/**
 * @param {Array<{ kind: 'percentile', critical: boolean, success: boolean } | { kind: 'sanity' }
 *   | { kind: 'weapon', weapon: string | null } | { kind: 'other' }>} rolls
 * @returns {Array<{ event: string, weapon?: string | null }>} one per roll that is an event, in order, no repeats
 */
export function eventsOf(rolls) {
  const out = [];
  const add = (e) => {
    if (!out.some((x) => x.event === e.event && x.weapon === e.weapon)) out.push(e);
  };
  for (const r of rolls) {
    if (r.kind === 'percentile' && r.critical) add({ event: r.success ? 'critSuccess' : 'critFailure' });
    else if (r.kind === 'sanity') add({ event: 'sanityLoss' });
    else if (r.kind === 'weapon') add({ event: 'weapon', weapon: r.weapon ?? null });
  }
  return out;
}

/** "Glock 17, shotgun" -> ['glock 17', 'shotgun'] - how a pad names the weapons it answers. */
export function weaponNames(text) {
  return typeof text === 'string'
    ? text
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];
}

/**
 * @param {Array<{ playlistId: string, soundId: string, event: unknown, weapons?: string[] }>} pads
 * @param {{ event: string, weapon?: string | null }} happened
 * @param {() => number} [random]
 * @returns {{ playlistId: string, soundId: string } | null}
 */
export function padFor(pads, happened, random = Math.random) {
  let candidates = pads.filter((p) => p.event === happened.event);
  if (happened.event === 'weapon') {
    const name = (happened.weapon ?? '').trim().toLowerCase();
    const own = name ? candidates.filter((p) => (p.weapons ?? []).includes(name)) : [];
    candidates = own.length ? own : candidates.filter((p) => !(p.weapons ?? []).length);
  }
  if (!candidates.length) return null;
  const { playlistId, soundId } = candidates[Math.floor(random() * candidates.length) % candidates.length];
  return { playlistId, soundId };
}
