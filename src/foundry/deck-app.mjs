/**
 * The Sounds Deck window. v0.1: one part, the bed cards.
 *
 * Built on Foundry's own application class (ApplicationV2 + HandlebarsApplicationMixin), so it pops out, themes
 * and closes like any core window. Every card shows the DOCUMENTS' state and re-renders when a playlist or a sound
 * changes - whoever changed it, from wherever.
 */
import { bankViews, nextLayout, oneShot } from '../core/banks.mjs';
import { bedCards, bedsToStop } from '../core/beds.mjs';

export const TEMPLATE_BEDS = 'modules/sounds-deck/templates/beds.hbs';
export const TEMPLATE_BOARD = 'modules/sounds-deck/templates/board.hbs';
const MODULE_ID = 'sounds-deck';

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
    window: {
      title: 'SOUNDS_DECK.Title',
      icon: 'fa-solid fa-sliders',
      resizable: true,
      controls: [{ icon: 'fa-solid fa-table-columns', label: 'SOUNDS_DECK.Layout', action: 'layout' }],
    },
    // 🚨 A NUMBER, NEVER 'auto'. Measured on 14.368: with height 'auto', every re-render resets the window to fit its
    // content and throws away a resize - the snap the Composer hit on the soundboard. A numeric default survives
    // re-renders (a probe window resized to 500 px stayed at 500 through a part render and a full render).
    position: { width: 760, height: 520 },
    actions: {
      play: SoundsDeckApp.#onPlay,
      skip: SoundsDeckApp.#onSkip,
      stop: SoundsDeckApp.#onStop,
      pad: SoundsDeckApp.#onPad,
      layout: SoundsDeckApp.#onLayout,
    },
  };

  // Beds first, board second, in the MARKUP as well as on screen: the layout switch changes the flex direction,
  // never the order, so the keyboard and a screen reader meet the parts in the order the eye does (Accessibility
  // Specialist, Auditorium 2026-09-24).
  static PARTS = {
    beds: { template: TEMPLATE_BEDS },
    board: { template: TEMPLATE_BOARD },
  };

  /** Built at the size it last closed at - measured: a window constructed with a saved position reopens at it. */
  constructor(options = {}) {
    const saved = game.settings.get(MODULE_ID, 'geometry');
    super(foundry.utils.mergeObject(saved?.width ? { position: saved } : {}, options, { inplace: false }));
  }

  /** Hook ids registered while the window is open, removed when it closes. */
  #hooks = [];

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const snaps = snapshot(game.playlists.contents);
    context.beds = bedCards(snaps);
    context.banks = bankViews(snaps);
    return context;
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    const rerender = () => this.render({ parts: ['beds', 'board'] });
    for (const hook of ['createPlaylist', 'updatePlaylist', 'deletePlaylist', 'updatePlaylistSound']) {
      this.#hooks.push([hook, Hooks.on(hook, rerender)]);
    }
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.classList.toggle('is-vertical', game.settings.get(MODULE_ID, 'layout') === 'vertical');
  }

  _onClose(options) {
    const { left, top, width, height } = this.position;
    game.settings.set(MODULE_ID, 'geometry', { left, top, width, height });
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

  /** One pad, three behaviours - chosen by the bank's core mode (classify.mjs), never stored anywhere else. */
  static async #onPad(_event, target) {
    const playlist = SoundsDeckApp.#playlistOf(target);
    const sound = playlist?.sounds.get(target.dataset.soundId);
    if (!sound) return;
    const bank = bankViews(snapshot([playlist]))[0];
    switch (bank?.press) {
      case 'oneshot': {
        // Broadcast to every client (true), and let it overlap itself: a PlaylistSound cannot (measured, 0003).
        const sound_ = await foundry.audio.AudioHelper.play(oneShot(sound), true);
        target.classList.add('is-fired');
        setTimeout(() => target.classList.remove('is-fired'), 400);
        return sound_;
      }
      case 'toggle':
      case 'cue':
        return sound.playing ? playlist.stopSound(sound) : playlist.playSound(sound);
      default:
        return undefined; // a bank whose mode gives no press: drawn disabled, and does nothing if reached anyway
    }
  }

  static async #onLayout() {
    await game.settings.set(MODULE_ID, 'layout', nextLayout(game.settings.get(MODULE_ID, 'layout')));
    // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 calls every action with `this` bound to the INSTANCE, so this is the window, not the class. Biome's fix (this -> SoundsDeckApp) would call render() on the class and break the switch.
    this.render();
  }
}
