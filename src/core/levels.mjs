/**
 * The layer levels moved from outside the window (0.6, theme 6; the Composer's design, 2026-09-25): a Stream Deck +
 * knob turns a level up or down, and its press mutes the layer, then brings it back.
 *
 * PURE. The levels are the world setting `levels`: { bed, toggle, cue, oneshot } between 0 and 1, plus `muted` - the
 * level each muted layer had, so the second press restores it, for every browser and after a reload. A step is taken
 * on the SLIDER's scale, Foundry's perceptual one, so a notch moves the deck's slider by the same distance anywhere on
 * its travel; the shell passes Foundry's own converters (AudioHelper.volumeToInput / inputToVolume).
 */
import { LAYERS, LEVELS_DEFAULT } from './cues.mjs';

/** One notch of a knob, on the slider's 0..1 travel. */
export const KNOB_STEP = 0.05;

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** The stored levels, cleaned: every layer a number in 0..1, and `muted` only for layers that are muted. */
function tidy(levels) {
  const out = { ...LEVELS_DEFAULT };
  for (const layer of LAYERS) if (Number.isFinite(levels?.[layer])) out[layer] = clamp01(levels[layer]);
  const muted = {};
  for (const [layer, level] of Object.entries(levels?.muted ?? {})) {
    if (LAYERS.includes(layer) && Number.isFinite(level)) muted[layer] = clamp01(level);
  }
  if (Object.keys(muted).length) out.muted = muted;
  return out;
}

function unmute(out, layer) {
  if (!out.muted) return;
  delete out.muted[layer];
  if (!Object.keys(out.muted).length) delete out.muted;
}

/** @returns {boolean} is this layer muted, waiting for a press to come back? */
export const isMuted = (levels, layer) => Boolean(levels?.muted && layer in levels.muted);

/** One layer set by hand - a slider or a knob: it is no longer muted. */
export function setLevel(levels, layer, level) {
  const out = tidy(levels);
  out[layer] = clamp01(level);
  unmute(out, layer);
  return out;
}

/**
 * A knob notch: one step up (`direction` > 0) or down, on the slider's scale. A muted layer turned starts from silence.
 * @param {{ toInput: (v: number) => number, toVolume: (i: number) => number }} scale
 */
export function nudgeLevel(levels, layer, direction, { toInput, toVolume }, step = KNOB_STEP) {
  const now = tidy(levels)[layer];
  const input = clamp01(toInput(now) + Math.sign(direction) * step);
  return setLevel(levels, layer, toVolume(input));
}

/** A knob press: mute the layer and remember its level - or, when it is muted, bring that level back. */
export function toggleMute(levels, layer) {
  const out = tidy(levels);
  if (isMuted(out, layer)) {
    out[layer] = out.muted[layer];
    unmute(out, layer);
    return out;
  }
  out.muted = { ...(out.muted ?? {}), [layer]: out[layer] };
  out[layer] = 0;
  return out;
}
