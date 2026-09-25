/**
 * Game-event sounds, in the shell (the rules are core/events.mjs).
 *
 * Every chat message reaches every page; only the active gamemaster's acts, so an event plays once. The pad plays as a
 * press does (Playlist#playSound), so the whole table hears it. A message the players cannot see - whispered, or a
 * blind roll - plays nothing: a sound would give the roll away.
 *
 * "Plays on" sits in a bank sound's own settings, under its colour and icon, with the weapons it answers.
 */
import { classify } from '../core/classify.mjs';
import { eventsOf, GAME_EVENTS, padFor, weaponNames } from '../core/events.mjs';

const MODULE_ID = 'sounds-deck';

/** What each roll of a message is, read from Delta Green's own roll classes. */
function describe(roll) {
  const kind = roll?.constructor?.name;
  if (kind === 'DGPercentileRoll') return { kind: 'percentile', critical: roll.isCritical, success: roll.isSuccess };
  if (kind === 'DGSanityDamageRoll') return { kind: 'sanity' };
  if (kind === 'DGDamageRoll' || kind === 'DGLethalityRoll') {
    return { kind: 'weapon', weapon: roll.item?.name ?? roll.options?.item?.name ?? null };
  }
  return { kind: 'other' };
}

/** Every bank sound that plays on an event. */
function eventPads() {
  const pads = [];
  for (const playlist of game.playlists) {
    if (classify(playlist.name, playlist.mode)?.role !== 'bank') continue;
    for (const s of playlist.sounds) {
      const flag = s.getFlag(MODULE_ID, 'event');
      if (!GAME_EVENTS.includes(flag?.on)) continue;
      pads.push({ playlistId: playlist.id, soundId: s.id, event: flag.on, weapons: weaponNames(flag.weapons) });
    }
  }
  return pads;
}

/**
 * @param {ChatMessage | { rolls: Roll[], whisper?: string[], blind?: boolean }} message
 * @returns {Promise<string[]>} the ids of the sounds it played
 */
export async function playEvents(message) {
  if (message?.blind || message?.whisper?.length) return [];
  const played = [];
  const pads = eventPads();
  for (const happened of eventsOf((message?.rolls ?? []).map(describe))) {
    const pick = padFor(pads, happened);
    const playlist = pick && game.playlists.get(pick.playlistId);
    const sound = playlist?.sounds.get(pick.soundId);
    if (!sound) continue;
    if (!sound.playing) await playlist.playSound(sound);
    played.push(sound.id);
  }
  return played;
}

/** "Plays on" and the weapons, under the pad's colour and icon (or its trim, or its fade). */
function addEventFields(app, element) {
  const root = element instanceof HTMLElement ? element : element?.[0];
  const sound = app.document;
  const playlist = sound?.parent;
  if (!root || classify(playlist?.name, playlist?.mode)?.role !== 'bank') return;
  if (root.querySelector(`[name="flags.${MODULE_ID}.event.on"]`)) return;
  const anchor = (
    root.querySelector(`[name="flags.${MODULE_ID}.look.colour"]`) ??
    root.querySelector(`[name="flags.${MODULE_ID}.trim.start"]`) ??
    root.querySelector('[name="fade"]')
  )?.closest('.form-group');
  if (!anchor) return;
  const flag = sound.getFlag(MODULE_ID, 'event') ?? {};
  const L = (key) => game.i18n.localize(`SOUNDS_DECK.Events.${key}`);
  const options = GAME_EVENTS.map(
    (e) => `<option value="${e}"${e === flag.on ? ' selected' : ''}>${L(`On.${e}`)}</option>`,
  ).join('');
  const weapons = typeof flag.weapons === 'string' ? ` value="${foundry.utils.escapeHTML(flag.weapons)}"` : '';
  const group = document.createElement('div');
  group.className = 'form-group slim';
  group.innerHTML = `<label>${L('Label')}</label>
    <div class="form-fields">
      <select name="flags.${MODULE_ID}.event.on"><option value=""></option>${options}</select>
      <label>${L('Weapons')} <input type="text" name="flags.${MODULE_ID}.event.weapons"${weapons} placeholder="Glock 17, Shotgun"></label>
    </div>
    <p class="hint">${L('Hint')}</p>`;
  anchor.after(group);
}

/** @returns {{ installed: boolean, uninstall: () => void, handle: typeof playEvents }} */
export function installGameEvents() {
  const onMessage = (message) => {
    if (!game.users.activeGM?.isSelf) return;
    playEvents(message).catch((e) => console.error(`${MODULE_ID} | a game event's sound could not play:`, e));
  };
  const hooks = [
    ['createChatMessage', Hooks.on('createChatMessage', onMessage)],
    ['renderPlaylistSoundConfig', Hooks.on('renderPlaylistSoundConfig', addEventFields)],
  ];
  return {
    installed: true,
    handle: playEvents,
    uninstall() {
      for (const [name, id] of hooks) Hooks.off(name, id);
    },
  };
}
