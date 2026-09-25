/**
 * The deck's look (the Composer's design, 2026-09-25): one accent colour for everything lit - a playing card, a pressed
 * pad, a progress line, a focus ring - chosen from the pads' six colours or picked freely; frosted glass behind the
 * cards; and a ripple from where a card was pressed.
 *
 * PURE: which accent a seat's choice means, which text colour stays readable on it, and where a ripple starts.
 */
import { PAD_COLOURS } from './look.mjs';

export const ACCENT_CHOICES = Object.freeze(['', ...PAD_COLOURS, 'custom']);

const HEX = /^#([0-9a-f]{6})$/i;

/**
 * @param {unknown} choice  '' (Foundry's own), one of the six pad colours, or 'custom'
 * @param {unknown} custom  '#rrggbb' when the choice is 'custom'
 * @returns {{ preset: string } | { custom: string, ink: string } | null}  null: Foundry's own accent
 */
export function accentOf(choice, custom) {
  if (PAD_COLOURS.includes(choice)) return { preset: choice };
  if (choice === 'custom' && typeof custom === 'string' && HEX.test(custom)) {
    const hex = custom.toLowerCase();
    return { custom: hex, ink: inkOn(hex) };
  }
  return null;
}

/** WCAG relative luminance of '#rrggbb'. */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The text colour for a label drawn ON the accent (an armed dice, a preview playing): near-black or white, whichever
 * contrasts more - so a dark custom accent never gets dark text.
 * @param {string} hex  '#rrggbb'
 * @returns {'#111111' | '#ffffff'}
 */
export function inkOn(hex) {
  const l = luminance(hex);
  const onDark = 1.05 / (l + 0.05);
  const onLight = (l + 0.05) / (luminance('#111111') + 0.05);
  return onLight >= onDark ? '#111111' : '#ffffff';
}

/**
 * A ripple is a circle that grows from the press until it covers the whole card.
 * @param {{ width: number, height: number }} rect  the card
 * @param {{ x: number, y: number } | null} point   where it was pressed, relative to the card; null for a press that
 *                                                  has no position (a key, a knob, the hotbar): from the centre
 * @returns {{ x: number, y: number, size: number }}  the circle's centre, relative to the card, and its diameter
 */
export function rippleGeometry(rect, point) {
  const inside = point && point.x >= 0 && point.y >= 0 && point.x <= rect.width && point.y <= rect.height;
  const x = inside ? point.x : rect.width / 2;
  const y = inside ? point.y : rect.height / 2;
  const far = Math.max(
    Math.hypot(x, y),
    Math.hypot(rect.width - x, y),
    Math.hypot(x, rect.height - y),
    Math.hypot(rect.width - x, rect.height - y),
  );
  return { x, y, size: 2 * far };
}
