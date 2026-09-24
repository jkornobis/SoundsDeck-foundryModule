/**
 * What the module does at each stage of Foundry's start-up, as plain functions - so the entry point only wires
 * them to hooks, and the live proof (tools/live-proof.mjs) can call the same functions in a running world.
 */
import { MODES } from '../core/classify.mjs';
import { SoundsDeckApp } from './deck-app.mjs';
import { installSceneBedFix } from './scene-bed-fix.mjs';

export const MODULE_ID = 'sounds-deck';

/** init: before any document exists. */
export function onInit() {
  // Client scope: layout and window size are one seat's preferences, never the table's (spec: "content in world
  // data, layout in client data").
  game.settings.register(MODULE_ID, 'layout', { scope: 'client', config: false, type: String, default: 'horizontal' });
  game.settings.register(MODULE_ID, 'geometry', { scope: 'client', config: false, type: Object, default: {} });
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
  return { open: openDeck, sceneFix };
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
