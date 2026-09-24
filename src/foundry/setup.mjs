/**
 * What the module does at each stage of Foundry's start-up, as plain functions - so the entry point only wires
 * them to hooks, and the live proof (tools/live-proof.mjs) can call the same functions in a running world.
 */
import { MODES } from '../core/classify.mjs';
import { SoundsDeckApp } from './deck-app.mjs';
import { installDucking } from './ducking.mjs';
import { installSceneBedFix } from './scene-bed-fix.mjs';

export const MODULE_ID = 'sounds-deck';

/** init: before any document exists. */
export function onInit() {
  // Client scope: layout and window size are one seat's preferences, never the table's (spec: "content in world
  // data, layout in client data").
  game.settings.register(MODULE_ID, 'layout', { scope: 'client', config: false, type: String, default: 'horizontal' });
  game.settings.register(MODULE_ID, 'geometry', { scope: 'client', config: false, type: Object, default: {} });
  game.settings.register(MODULE_ID, 'density', {
    scope: 'client',
    config: false,
    type: String,
    default: 'comfortable',
  });
  // Sources stay in Foundry's own playlist panel: a trailing "(…)" in a sound's name, and its description, are not
  // shown on the deck. A table decision, so world scope; on by default (the Composer, 2026-09-24).
  game.settings.register(MODULE_ID, 'hideSources', {
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    name: 'SOUNDS_DECK.HideSources.Name',
    hint: 'SOUNDS_DECK.HideSources.Hint',
    onChange: () => {
      for (const app of foundry.applications.instances.values()) if (app.id === MODULE_ID) app.render();
    },
  });
  // The press log: OFF by default, this seat only, switched on in the module settings (v0.4 note 12).
  game.settings.register(MODULE_ID, 'journal', {
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,
    name: 'SOUNDS_DECK.Journal.Name',
    hint: 'SOUNDS_DECK.Journal.Hint',
  });
  game.settings.register(MODULE_ID, 'journalEntries', { scope: 'client', config: false, type: Array, default: [] });
  // The pure core carries its own copy of the playlist modes. If a Foundry release renumbers them, every press
  // would silently do the wrong thing - so the mismatch is loud, at start-up, before anything plays.
  const drift = Object.entries(MODES).filter(([k, v]) => CONST.PLAYLIST_MODES[k] !== v);
  if (drift.length) console.error(`${MODULE_ID} | PLAYLIST_MODES drifted from the core's copy:`, drift);
}

/**
 * ready: documents exist. Only the gamemaster's client installs the scene fix - Foundry's own method runs only
 * for the user who activated the scene, and only a gamemaster activates scenes.
 * @returns {{ open: () => SoundsDeckApp, sceneFix: ReturnType<typeof installSceneBedFix> | null }}
 */
export function onReady() {
  const sceneFix = game.user.isGM
    ? installSceneBedFix(foundry.documents.collections.Playlists, game.scenes.active ?? null)
    : null;
  if (sceneFix && !sceneFix.installed) console.info(`${MODULE_ID} | scene fix not installed: ${sceneFix.reason}`);
  // Every client ducks its own copy of the bed - players included, since each browser plays its own audio.
  const ducking = installDucking();
  return { open: openDeck, sceneFix, ducking };
}

let deck = null;
export function openDeck() {
  deck ??= new SoundsDeckApp();
  deck.render({ force: true });
  return deck;
}

/** A button in the playlists sidebar header - the deck is reached from where the playlists already are. */
export function onRenderPlaylistDirectory(_app, html) {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const actions = root?.querySelector('.header-actions');
  if (!actions || actions.querySelector('[data-sounds-deck]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.soundsDeck = 'open';
  button.innerHTML = `<i class="fa-solid fa-sliders" inert></i> ${game.i18n.localize('SOUNDS_DECK.Open')}`;
  button.addEventListener('click', () => openDeck());
  actions.append(button);
}
