/**
 * Combat music, in the shell (the rules are core/combat.mjs).
 *
 * START: what plays is captured as a mood (the same capture as a saved mood), with the bed's track and position; the
 * combat mood is recalled (one crossfade, note 4); then the bed that played is marked paused at its position.
 * END: the captured mood is recalled; Foundry's own Playlist#playAll resumes a paused track from its pausedTime (read
 * from the live page, 14.368), so the bed comes back where it left off, crossfading in.
 *
 * What to bring back is a world setting, so a reload in the middle of a fight does not lose it. Only the active
 * gamemaster's page acts on the combat tracker, so one fight is answered once.
 */
import { bedCards } from '../core/beds.mjs';
import { bedPosition, combatStart } from '../core/combat.mjs';
import { captureMood } from '../core/moods.mjs';
import { recallMood } from './mood-recall.mjs';
import { armedList } from './random.mjs';
import { snapshot } from './snapshot.mjs';

const MODULE_ID = 'sounds-deck';
const get = (key) => game.settings.get(MODULE_ID, key);

/** @returns {boolean} whether combat music plays now */
export function inCombatMusic() {
  return Boolean(get('combatReturn'));
}

/**
 * @param {{ byHand?: boolean }} [options]  byHand: the deck's button or the key, which work with the switch off
 * @returns {Promise<boolean>} started
 */
export async function startCombatMusic({ byHand = false } = {}) {
  const plan = combatStart({
    byHand,
    auto: get('combatAuto'),
    active: inCombatMusic(),
    combatMoodId: get('combatMood'),
    moods: get('moods'),
  });
  if (plan.skip === 'no-mood') ui.notifications.warn('SOUNDS_DECK.Combat.NoMood', { localize: true });
  if (plan.skip) return false;
  const snaps = snapshot(game.playlists.contents);
  const beds = bedCards(snaps).map((b) => {
    const p = game.playlists.get(b.id);
    return {
      id: b.id,
      playing: b.playing,
      sounds: p.sounds.contents.map((s) => ({ id: s.id, playing: s.playing, at: s.sound?.currentTime })),
    };
  });
  const bed = bedPosition(beds);
  const before = captureMood(snaps, armedList(), { id: 'before-combat', name: '' });
  await game.settings.set(MODULE_ID, 'combatReturn', { mood: before, bed });
  await recallMood(plan.mood);
  // The bed that played, if the fight's music is another one: marked paused where it was, so its return resumes there.
  if (bed && bed.playlistId !== plan.mood.bed) {
    const sound = game.playlists.get(bed.playlistId)?.sounds.get(bed.soundId);
    if (sound && !sound.playing) await sound.update({ pausedTime: bed.at });
  }
  return true;
}

/** @returns {Promise<boolean>} ended */
export async function endCombatMusic() {
  const saved = get('combatReturn');
  if (!saved) return false;
  await game.settings.set(MODULE_ID, 'combatReturn', null);
  await recallMood(saved.mood);
  return true;
}

/** The button and the key: start by hand, or end. */
export function toggleCombatMusic() {
  return inCombatMusic() ? endCombatMusic() : startCombatMusic({ byHand: true });
}

/**
 * Follow Foundry's combat tracker: a fight's first round brings the combat mood; deleting a fight that had started
 * (Foundry's "End Combat") brings the rest back. The round, not Foundry's combatStart hook: that hook runs only in the
 * page of whoever pressed Start, and the page that acts here is the active gamemaster's, who may not be the one.
 * @returns {{ installed: boolean, uninstall: () => void }}
 */
export function installCombatMusic() {
  const acting = () => game.users.activeGM?.isSelf;
  const onUpdate = (_combat, changed) => {
    if (acting() && changed?.round === 1)
      startCombatMusic().catch((e) => console.error(`${MODULE_ID} | combat music could not start:`, e));
  };
  const onEnd = (combat) => {
    if (acting() && combat?.started)
      endCombatMusic().catch((e) => console.error(`${MODULE_ID} | the music before the fight could not return:`, e));
  };
  const hooks = [
    ['updateCombat', Hooks.on('updateCombat', onUpdate)],
    ['deleteCombat', Hooks.on('deleteCombat', onEnd)],
  ];
  return {
    installed: true,
    uninstall() {
      for (const [name, id] of hooks) Hooks.off(name, id);
    },
  };
}
