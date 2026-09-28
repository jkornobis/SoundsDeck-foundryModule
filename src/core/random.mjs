/**
 * Random triggering of a one-shot (the Composer, after first use, 2026-09-24: "some sound effect should have a random
 * triggering, like gunshot"). Armed, a pad fires its sound again and again at random moments - distant gunfire, a door
 * somewhere in the building - until it is disarmed.
 *
 * PURE. The interval lives on the sound itself, flags["sounds-deck"].random = { min, max } in seconds, so it is world
 * data the GM can tune; without it, the default below.
 */

/**
 * Seconds between two random shots when a sound says nothing. The Composer's value, 2026-09-28: "reduce random time
 * between to effect trigger to 1,5-5seconds" - it was 10-45 s. A sound still playing when its turn comes is skipped
 * (foundry/random.mjs), so a long sound never overlaps itself.
 */
export const RANDOM_DEFAULT = Object.freeze({ min: 1.5, max: 5 });

/** A usable { min, max } in seconds from whatever a flag holds: at least 1 s, and max never below min. */
export function randomInterval(flag) {
  const min = Number.isFinite(flag?.min) ? Math.max(1, flag.min) : RANDOM_DEFAULT.min;
  const max = Number.isFinite(flag?.max) ? Math.max(min, flag.max) : Math.max(min, RANDOM_DEFAULT.max);
  return { min, max };
}

/**
 * Milliseconds until the next shot.
 * @param {{ min: number, max: number }} interval  seconds
 * @param {() => number} [rand]  0..1, injectable for tests
 */
export function randomDelay(interval, rand = Math.random) {
  const { min, max } = randomInterval(interval);
  return Math.round((min + (max - min) * rand()) * 1000);
}
