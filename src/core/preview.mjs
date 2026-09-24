/**
 * Preview in the GM's ear (0.6, note 3): a pad heard in this browser only, before the table hears it.
 *
 * PURE: what a press on a pad's headphones does, given what is in the ear now. The Composer's design, 2026-09-25:
 * one preview at a time - a new one replaces the last, the same one pressed again stops it - and none lasts longer
 * than PREVIEW_MAX_MS, so a loop does not run on in the ear.
 */
export const PREVIEW_MAX_MS = 20000;

/**
 * @param {string | null} current  the sound previewing now, or null
 * @param {string} soundId         the pad whose headphones were pressed
 * @returns {{ stop: boolean, start: string | null }}  stop what is in the ear, then start this one (or nothing)
 */
export function previewPress(current, soundId) {
  if (current && current === soundId) return { stop: true, start: null };
  return { stop: Boolean(current), start: soundId };
}
