/**
 * A scene brings back a whole mood (0.6, note 5; the Composer's design, 2026-09-25):
 * - the mood is chosen in the scene's own settings, under its playlist, and stored on the scene
 *   (flags["sounds-deck"].mood);
 * - when a scene with a mood opens, the mood wins over the scene's playlist, and the recall is exactly the mood card's.
 *
 * It wraps Playlists#_onChangeScene, whichever is there: the deck's scene fix, or Foundry's own once that steps aside.
 * - Over the scene fix: the mood is recalled FIRST, so its bed crosses over from the one playing (note 4), and the fix is
 *   then told which bed this scene brought, without acting. Leaving the scene hands that bed over like any scene's.
 * - Over Foundry's own: its state cannot be told, so it is shown the mood's bed as the scene's playlist and does its own
 *   switch (no crossfade), then the mood's loops and random effects follow.
 * A scene with no mood, or with a mood since deleted, is left entirely to what was there.
 */
import { sceneMood } from '../core/moods.mjs';
import { recallMood } from './mood-recall.mjs';

const MODULE_ID = 'sounds-deck';
const moods = () => game.settings.get(MODULE_ID, 'moods');

/** @returns {import('../core/moods.mjs').Mood | null} the mood this scene brings back */
export function moodOf(scene) {
  return sceneMood(scene?.getFlag?.(MODULE_ID, 'mood'), moods());
}

/** The scene as the handover should see it: this playlist as its music, and no particular sound. */
const withMusic = (scene, playlist) =>
  new Proxy(scene, {
    get(target, key) {
      if (key === 'playlist') return playlist ?? null;
      if (key === 'playlistSound') return null;
      return Reflect.get(target, key, target);
    },
  });

async function recall(mood) {
  try {
    const missing = await recallMood(mood);
    if (missing) ui.notifications.warn(game.i18n.format('SOUNDS_DECK.MoodMissing', { count: missing }));
  } catch (error) {
    console.error(`${MODULE_ID} | the scene's mood could not be recalled:`, error);
  }
}

/** The Mood field in a scene's settings, right under its Playlist Sound. */
function addMoodField(app, element) {
  if (!game.user.isGM) return;
  const root = element instanceof HTMLElement ? element : element?.[0];
  const anchor = root?.querySelector('select[name="playlistSound"]')?.closest('.form-group');
  if (!anchor || root.querySelector(`[name="flags.${MODULE_ID}.mood"]`)) return;
  const current = app.document?.getFlag(MODULE_ID, 'mood') ?? '';
  const id = `${app.id}-${MODULE_ID}-mood`;
  const options = moods()
    .map(
      (m) =>
        `<option value="${m.id}"${m.id === current ? ' selected' : ''}>${foundry.utils.escapeHTML(m.name)}</option>`,
    )
    .join('');
  const group = document.createElement('div');
  group.className = 'form-group';
  group.innerHTML = `<label for="${id}">${game.i18n.localize('SOUNDS_DECK.SceneMood.Label')}</label>
    <div class="form-fields"><select name="flags.${MODULE_ID}.mood" id="${id}"><option value=""></option>${options}</select></div>
    <p class="hint">${game.i18n.localize('SOUNDS_DECK.SceneMood.Hint')}</p>`;
  anchor.after(group);
}

/**
 * @param {typeof foundry.documents.collections.Playlists} Playlists
 * @param {{ installed: boolean, remember?: (bed: object | null) => void } | null} sceneFix
 * @returns {{ installed: boolean, reason?: string, uninstall: () => void }}
 */
export function installSceneMood(Playlists, sceneFix) {
  const proto = Playlists.prototype;
  const underneath = proto._onChangeScene;
  if (typeof underneath !== 'function') return { installed: false, reason: 'no _onChangeScene', uninstall() {} };
  const wrapped = async function (scene, ...rest) {
    let mood = null;
    try {
      mood = moodOf(scene);
    } catch (error) {
      console.error(`${MODULE_ID} | could not read the scene's mood; the scene plays as usual:`, error);
    }
    if (!mood) return underneath.call(this, scene, ...rest);
    const bed = (mood.bed && game.playlists.get(mood.bed)) || null;
    if (sceneFix?.installed && sceneFix.remember) {
      await recall(mood);
      sceneFix.remember(bed ? { playlistId: bed.id, soundId: null } : null);
      return undefined;
    }
    await underneath.call(this, withMusic(scene, bed), ...rest);
    return recall(mood);
  };
  proto._onChangeScene = wrapped;
  const hook = Hooks.on('renderSceneConfig', addMoodField);
  return {
    installed: true,
    uninstall() {
      if (proto._onChangeScene === wrapped) proto._onChangeScene = underneath;
      Hooks.off('renderSceneConfig', hook);
    },
  };
}
