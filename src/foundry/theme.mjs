/**
 * The deck's look, in the page (the Composer's design, 2026-09-25; the rules are in core/theme.mjs):
 * - the accent: a data-accent attribute for the six pad colours (the stylesheet maps them to Foundry's theme colours),
 *   or two custom properties for a picked colour and the text drawn on it;
 * - the ripple: drawn on a layer of the WINDOW, not inside the card, because a press re-renders the card it pressed
 *   a moment later and would cut its own ripple short. Nothing is drawn when the system asks for less motion.
 */
import { accentOf, rippleGeometry } from '../core/theme.mjs';

const MODULE_ID = 'sounds-deck';

/** @param {HTMLElement} element  the deck's window */
export function applyAccent(element) {
  let accent = null;
  try {
    // A colour setting comes back as Foundry's Color, whose text form is '#rrggbb'.
    const custom = game.settings.get(MODULE_ID, 'accentCustom');
    accent = accentOf(game.settings.get(MODULE_ID, 'accent'), custom == null ? null : String(custom));
  } catch {
    accent = null; // a setting that cannot be read leaves Foundry's own accent
  }
  // Foundry paints its own hover, focus and pressed states from its theme's accent variables; with an accent chosen,
  // the stylesheet points those at the deck's accent too (the Composer, 2026-09-25: "I still see some green").
  element.classList.toggle('sd-accented', Boolean(accent));
  if (accent?.preset) element.dataset.accent = accent.preset;
  else delete element.dataset.accent;
  if (accent?.custom) {
    element.style.setProperty('--sd-accent', accent.custom);
    element.style.setProperty('--sd-accent-ink', accent.ink);
  } else {
    element.style.removeProperty('--sd-accent');
    element.style.removeProperty('--sd-accent-ink');
  }
}

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * @param {HTMLElement} host   the deck's window
 * @param {HTMLElement} card   the card pressed
 * @param {{ x: number, y: number } | null} at  where, in page coordinates; null for a press with no position
 * @returns {HTMLElement | null}  the ripple, or null when none is drawn
 */
export function ripple(host, card, at) {
  if (!host || !card?.isConnected || reducedMotion()) return null;
  const h = host.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  const g = rippleGeometry(c, at ? { x: at.x - c.left, y: at.y - c.top } : null);
  const clip = document.createElement('span');
  clip.className = 'sd-ripple-clip';
  Object.assign(clip.style, {
    left: `${c.left - h.left}px`,
    top: `${c.top - h.top}px`,
    width: `${c.width}px`,
    height: `${c.height}px`,
    borderRadius: getComputedStyle(card).borderRadius,
  });
  const dot = document.createElement('span');
  dot.className = 'sd-ripple';
  Object.assign(dot.style, {
    left: `${g.x - g.size / 2}px`,
    top: `${g.y - g.size / 2}px`,
    width: `${g.size}px`,
    height: `${g.size}px`,
  });
  clip.append(dot);
  host.append(clip);
  const done = () => clip.remove();
  dot.addEventListener('animationend', done, { once: true });
  setTimeout(done, 1500); // never left behind, even if the animation never ran
  return clip;
}

/** The card a press reached, found by what was pressed. @returns {HTMLElement | null} */
export function cardFor(host, { kind, id }) {
  const esc = CSS.escape(id);
  const hit = {
    pad: `.sd-pad[data-sound-id="${esc}"]`,
    bed: `.sd-bed[data-playlist-id="${esc}"]`,
    mood: `.sd-mood[data-mood-id="${esc}"]`,
  }[kind];
  return hit ? (host?.querySelector(hit)?.closest('.sd-card') ?? null) : null;
}

/** What identifies a card, whichever kind it is. */
export function cardKey(card) {
  return card?.dataset.moodId ?? card?.dataset.playlistId ?? card?.querySelector('.sd-pad')?.dataset.soundId ?? null;
}
