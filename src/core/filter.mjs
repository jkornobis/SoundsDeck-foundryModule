/**
 * The board's filter box (Auditorium on v0.4, note 6, UX Designer): 51 pads in two banks, and typing "glass" beats
 * scrolling mid-scene.
 *
 * PURE. Case and accents never matter ("evenement" finds "Évènement"), and every word typed must appear somewhere in
 * the pad's name or its bank's ("gun ind" finds "Pistol shot, indoors" only if both words are there).
 */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * @param {string} query      what was typed; empty or blank matches everything
 * @param {...string} fields  the pad's name, its bank's name - anything the table might type for it
 */
export function matches(query, ...fields) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields.map(fold).join(' ');
  return words.every((w) => hay.includes(w));
}
