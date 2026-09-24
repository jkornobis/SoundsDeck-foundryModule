/**
 * The Sounds Deck window. v0.1: one part, the bed cards.
 *
 * Built on Foundry's own application class (ApplicationV2 + HandlebarsApplicationMixin), so it pops out, themes
 * and closes like any core window. Every card shows the DOCUMENTS' state and re-renders when a playlist or a sound
 * changes - whoever changed it, from wherever.
 */
import { bedCards, bedsToStop } from '../core/beds.mjs';

export const TEMPLATE_BEDS = 'modules/sounds-deck/templates/beds.hbs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Plain snapshots for the pure core: it never sees a document. */
function snapshot(playlists) {
  return playlists.map((p) => ({
    id: p.id,
    name: p.name,
    mode: p.mode,
    playing: p.playing,
    sounds: p.sounds.map((s) => ({ id: s.id, name: s.name, playing: s.playing })),
  }));
}

export class SoundsDeckApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'sounds-deck',
    classes: ['sounds-deck'],
    window: { title: 'SOUNDS_DECK.Title', icon: 'fa-solid fa-sliders', resizable: true },
    // 🚨 A NUMBER, NEVER 'auto'. Measured on 14.368: with height 'auto', every re-render resets the window to fit its
    // content and throws away a resize - the snap the Composer hit on the soundboard. A numeric default survives
    // re-renders (a probe window resized to 500 px stayed at 500 through a part render and a full render).
    position: { width: 420, height: 480 },
    actions: {
      play: SoundsDeckApp.#onPlay,
      skip: SoundsDeckApp.#onSkip,
      stop: SoundsDeckApp.#onStop,
    },
  };

  static PARTS = {
    beds: { template: TEMPLATE_BEDS },
  };

  /** Hook ids registered while the window is open, removed when it closes. */
  #hooks = [];

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.beds = bedCards(snapshot(game.playlists.contents));
    return context;
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    const rerender = () => this.render({ parts: ['beds'] });
    for (const hook of ['createPlaylist', 'updatePlaylist', 'deletePlaylist', 'updatePlaylistSound']) {
      this.#hooks.push([hook, Hooks.on(hook, rerender)]);
    }
  }

  _onClose(options) {
    for (const [hook, id] of this.#hooks) Hooks.off(hook, id);
    this.#hooks = [];
    super._onClose(options);
  }

  static #playlistOf(target) {
    return game.playlists.get(target.closest('[data-playlist-id]')?.dataset.playlistId);
  }

  static async #onPlay(_event, target) {
    const playlist = SoundsDeckApp.#playlistOf(target);
    if (!playlist) return;
    const others = bedsToStop(bedCards(snapshot(game.playlists.contents)), playlist.id);
    for (const id of others) await game.playlists.get(id)?.stopAll();
    await playlist.playAll();
  }

  static async #onSkip(_event, target) {
    await SoundsDeckApp.#playlistOf(target)?.playNext();
  }

  static async #onStop(_event, target) {
    await SoundsDeckApp.#playlistOf(target)?.stopAll();
  }
}
