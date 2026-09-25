/**
 * What the module does at each stage of Foundry's start-up, as plain functions - so the entry point only wires
 * them to hooks, and the live proof (tools/live-proof.mjs) can call the same functions in a running world.
 */
import { MODES } from '../core/classify.mjs';
import { CROSSFADE_DEFAULT_S } from '../core/crossfade.mjs';
import { LEVELS_DEFAULT } from '../core/cues.mjs';
import { muteToggle, nudge, playBedNumber, press, recallMoodAt, stopEverything } from './actions.mjs';
import { installCrossfade } from './crossfade.mjs';
import { SoundsDeckApp } from './deck-app.mjs';
import { applyDuck, installDucking } from './ducking.mjs';
import { installHotbar } from './hotbar.mjs';
import { registerKeys } from './keys.mjs';
import { previewing, previewSound, stopPreview, togglePreview } from './preview.mjs';
import { installSceneBedFix } from './scene-bed-fix.mjs';
import { installSceneMood } from './scene-mood.mjs';
import { installSilentStartFix } from './silent-start-fix.mjs';

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
  // One crossfade between beds (0.6, note 4): the table's, so world scope; read by every browser when two beds overlap.
  game.settings.register(MODULE_ID, 'crossfade', {
    scope: 'world',
    config: true,
    type: Number,
    range: { min: 0, max: 10, step: 0.5 },
    default: CROSSFADE_DEFAULT_S,
    name: 'SOUNDS_DECK.Crossfade.Name',
    hint: 'SOUNDS_DECK.Crossfade.Hint',
  });
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
  // One level per layer (0.6, note 2): the table's mix, so world scope - every browser applies it to its own audio.
  game.settings.register(MODULE_ID, 'levels', {
    scope: 'world',
    config: false,
    type: Object,
    default: { ...LEVELS_DEFAULT },
    onChange: () => {
      applyDuck();
      for (const app of foundry.applications.instances.values()) if (app.id === MODULE_ID) app.render();
    },
  });
  // Moods are the table's (Auditorium on 0.5.2, note 1): world scope, so a mood saved on one seat is there on the next.
  game.settings.register(MODULE_ID, 'moods', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: () => {
      for (const app of foundry.applications.instances.values()) if (app.id === MODULE_ID) app.render();
    },
  });
  // The pure core carries its own copy of the playlist modes. If a Foundry release renumbers them, every press
  // would silently do the wrong thing - so the mismatch is loud, at start-up, before anything plays.
  const drift = Object.entries(MODES).filter(([k, v]) => CONST.PLAYLIST_MODES[k] !== v);
  if (drift.length) console.error(`${MODULE_ID} | PLAYLIST_MODES drifted from the core's copy:`, drift);
  // Keyboard shortcuts and the Stream Deck + knobs (theme 6) - Foundry takes bindings in init only.
  keys = registerKeys({ toggleDeck });
  if (!keys.registered) console.info(`${MODULE_ID} | shortcuts not registered: ${keys.reason}`);
}

/** Whether this page registered the shortcuts, and why not if it did not. */
let keys = { registered: false, reason: 'init has not run' };

/**
 * ready: documents exist. Only the gamemaster's client installs the scene fix - Foundry's own method runs only
 * for the user who activated the scene, and only a gamemaster activates scenes.
 * @returns {{ open: () => SoundsDeckApp, sceneFix: ReturnType<typeof installSceneBedFix> | null,
 *   ducking: ReturnType<typeof installDucking>, silentFix: ReturnType<typeof installSilentStartFix>,
 *   preview: { previewing: () => string | null, sound: () => object | null, stop: () => void, toggle: Function } }}
 */
export function onReady() {
  const sceneFix = game.user.isGM
    ? installSceneBedFix(foundry.documents.collections.Playlists, game.scenes.active ?? null)
    : null;
  if (sceneFix && !sceneFix.installed) console.info(`${MODULE_ID} | scene fix not installed: ${sceneFix.reason}`);
  // A scene that brings a mood (note 5) - on the same client, and wrapped around whichever handover is there.
  const sceneMood = game.user.isGM ? installSceneMood(foundry.documents.collections.Playlists, sceneFix) : null;
  // Every client ducks its own copy of the bed - players included, since each browser plays its own audio.
  const ducking = installDucking();
  // Every client again: each browser starts its own copy of a sound, and can leave it silent on its own timing (#37).
  const silentFix = installSilentStartFix(foundry.documents.PlaylistSound);
  if (!silentFix.installed) console.info(`${MODULE_ID} | silent-start fix not installed: ${silentFix.reason}`);
  // Every client: each browser fades its own copy, so each must know a switch's fade is the deck's (note 4).
  const crossfade = installCrossfade(foundry.documents.PlaylistSound);
  if (!crossfade.installed) console.info(`${MODULE_ID} | crossfade not installed: ${crossfade.reason}`);
  // The GM's-ear preview (note 3), reachable from a macro as well as from the pads' headphones.
  const preview = { previewing, sound: previewSound, stop: stopPreview, toggle: togglePreview };
  // A pad dragged onto the hotbar becomes a button (theme 6) - the gamemaster's, as the deck is.
  const hotbar = game.user.isGM ? installHotbar() : null;
  // What a key, a knob or a hotbar macro reaches: the same actions the deck's own buttons call.
  const actions = { playBedNumber, recallMoodAt, stopEverything, nudge, muteToggle, toggleDeck };
  return { open: openDeck, press, keys, actions, hotbar, sceneFix, sceneMood, ducking, silentFix, preview, crossfade };
}

let deck = null;
export function openDeck() {
  deck ??= new SoundsDeckApp();
  deck.render({ force: true });
  return deck;
}

/** Shift+D: open the deck, or close it when it is open. */
export function toggleDeck() {
  if (deck?.rendered) return deck.close();
  return openDeck();
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
