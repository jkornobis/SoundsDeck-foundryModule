/**
 * What a press does, in one place (0.6, theme 6): the deck's own buttons, the keyboard shortcuts, the Stream Deck +
 * knobs and a pad on the hotbar all call these, so a bed, a pad, a mood or a level behaves the same whichever way it
 * is reached. The window keeps only what is about the window.
 */
import { bankViews } from '../core/banks.mjs';
import { bedCards, bedNumbered, bedsToStop, trackNumbered, trackOrder } from '../core/beds.mjs';
import { appendEntry } from '../core/journal.mjs';
import { nudgeLevel, toggleMute } from '../core/levels.mjs';
import { switchBed } from './crossfade.mjs';
import { recallMood } from './mood-recall.mjs';
import { disarmAll } from './random.mjs';
import { snapshot } from './snapshot.mjs';

const MODULE_ID = 'sounds-deck';

/** Tell an open deck which card was pressed, so a key, a knob or the hotbar ripples it like a click (theming). */
const pressed = (kind, id) => Hooks.callAll('soundsDeckPress', { kind, id });

/** One press into this seat's log - only when the seat switched the log on. */
export async function logPress(kind, name, bank) {
  if (!game.settings.get(MODULE_ID, 'journal')) return;
  const entry = { at: new Date().toISOString(), kind, name, ...(bank ? { bank } : {}) };
  await game.settings.set(
    MODULE_ID,
    'journalEntries',
    appendEntry(game.settings.get(MODULE_ID, 'journalEntries'), entry),
  );
}

/** A bed: the new one first, the others once it is heard - one crossfade, never a hole while it loads (note 4). */
export async function playBed(playlist) {
  pressed('bed', playlist.id);
  const others = bedsToStop(bedCards(snapshot(game.playlists.contents)), playlist.id);
  await logPress('bed', playlist.name);
  await switchBed(playlist, others);
}

/** The bed numbered `n` (its card's own number). A bed already playing is left alone. @returns {boolean} started */
export async function playBedNumber(n) {
  const card = bedNumbered(bedCards(snapshot(game.playlists.contents)), n);
  const playlist = card && game.playlists.get(card.id);
  if (!playlist || playlist.playing) return false;
  await playBed(playlist);
  return true;
}

/** A bed's tracks in their picking order (core/beds.mjs trackOrder). */
export function tracksOf(playlist) {
  return trackOrder(
    playlist.sounds.contents.map((s) => ({ id: s.id, name: s.name, sort: s.sort })),
    playlist.sorting,
  );
}

/**
 * One track of a bed (the Composer, 2026-09-25): in a bed that plays, that track now; otherwise the bed starts on it,
 * crossing over from the bed that plays, as a bed card does. @returns {boolean} started
 */
export async function playTrack(playlist, sound) {
  if (!playlist || !sound || sound.playing) return false;
  pressed('bed', playlist.id);
  await logPress('bed', `${playlist.name} - ${sound.name}`);
  if (playlist.playing) await playlist.playSound(sound);
  else await switchBed(playlist, bedsToStop(bedCards(snapshot(game.playlists.contents)), playlist.id), { sound });
  return true;
}

/** Ctrl+Alt+n: track `n` of the bed that plays now. @returns {boolean} started */
export async function playTrackNumber(n) {
  const card = bedCards(snapshot(game.playlists.contents)).find((b) => b.playing);
  const playlist = card && game.playlists.get(card.id);
  const id = playlist && trackNumbered(tracksOf(playlist), n);
  return id ? playTrack(playlist, playlist.sounds.get(id)) : false;
}

/** One pad, three behaviours - chosen by the bank's core mode (classify.mjs), never stored anywhere else. */
export async function pressPad(playlist, sound) {
  const bank = bankViews(snapshot([playlist]))[0];
  // A bank whose mode gives no press is drawn disabled, and does nothing if reached anyway.
  if (!bank?.press) return undefined;
  pressed('pad', sound.id);
  await logPress(bank.press, sound.name, playlist.name);
  // Every pad: a press plays, the next press stops (the Composer, after first use - decision 0005). A one-shot is a
  // PlaylistSound in a Soundboard Only playlist like the others, so its stop reaches every player, not only this one.
  return sound.playing ? playlist.stopSound(sound) : playlist.playSound(sound);
}

/** A pad by its ids - what a hotbar macro calls. A pad deleted since says so instead of failing silently. */
export async function press(playlistId, soundId) {
  const playlist = game.playlists.get(playlistId);
  const sound = playlist?.sounds.get(soundId);
  if (!sound) return ui.notifications.warn('SOUNDS_DECK.PadGone', { localize: true });
  return pressPad(playlist, sound);
}

/** Everything off: every playing playlist stopped, every random one-shot disarmed. */
export async function stopEverything() {
  disarmAll();
  for (const p of game.playlists.filter((x) => x.playing)) await p.stopAll();
}

/** The mood at position `n` in the deck's list (1 is the first). @returns {boolean} recalled */
export async function recallMoodAt(n) {
  const mood = game.settings.get(MODULE_ID, 'moods')[n - 1];
  if (!mood) return false;
  pressed('mood', mood.id);
  await logPress('mood', mood.name);
  const missing = await recallMood(mood);
  if (missing) ui.notifications.warn(game.i18n.format('SOUNDS_DECK.MoodMissing', { count: missing }));
  return true;
}

// Knob notches arrive faster than the world confirms a setting. Each change waits for the one before it, so it reads
// the level that one left - a quick turn of five notches moves five steps, not one.
let levelsChain = Promise.resolve();
function changeLevels(change) {
  levelsChain = levelsChain
    .then(() => game.settings.set(MODULE_ID, 'levels', change(game.settings.get(MODULE_ID, 'levels'))))
    .catch((error) => console.error(`${MODULE_ID} | a level change failed:`, error));
  return levelsChain;
}

/** A knob turned one notch: `direction` +1 (right) or -1 (left), on the slider's scale. */
export function nudge(layer, direction) {
  const { volumeToInput, inputToVolume } = foundry.audio.AudioHelper;
  return changeLevels((levels) =>
    nudgeLevel(levels, layer, direction, { toInput: volumeToInput, toVolume: inputToVolume }),
  );
}

/** A knob pressed: that layer muted for everyone, or brought back to where it was. */
export function muteToggle(layer) {
  return changeLevels((levels) => toggleMute(levels, layer));
}
