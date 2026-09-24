/**
 * The Sounds Deck window. v0.1: one part, the bed cards.
 *
 * Built on Foundry's own application class (ApplicationV2 + HandlebarsApplicationMixin), so it pops out, themes
 * and closes like any core window. Every card shows the DOCUMENTS' state and re-renders when a playlist or a sound
 * changes - whoever changed it, from wherever.
 */
import { bankViews, nextDensity, nextLayout, oneShot } from '../core/banks.mjs';
import { bedCards, bedsToStop } from '../core/beds.mjs';
import { clock, transportChanges, transportCues } from '../core/cues.mjs';
import { matches } from '../core/filter.mjs';
import { snapshot } from './snapshot.mjs';

export const TEMPLATE_BEDS = 'modules/sounds-deck/templates/beds.hbs';
export const TEMPLATE_BOARD = 'modules/sounds-deck/templates/board.hbs';
const MODULE_ID = 'sounds-deck';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SoundsDeckApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'sounds-deck',
    classes: ['sounds-deck'],
    window: {
      title: 'SOUNDS_DECK.Title',
      icon: 'fa-solid fa-sliders',
      resizable: true,
      controls: [
        { icon: 'fa-solid fa-table-columns', label: 'SOUNDS_DECK.Layout', action: 'layout' },
        { icon: 'fa-solid fa-table-cells', label: 'SOUNDS_DECK.Density', action: 'density' },
        { icon: 'fa-solid fa-circle-question', label: 'SOUNDS_DECK.Help.Title', action: 'help' },
      ],
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
      duckToggle: SoundsDeckApp.#onDuckToggle,
      cuePause: SoundsDeckApp.#onCuePause,
      cueResume: SoundsDeckApp.#onCueResume,
      cueStop: SoundsDeckApp.#onCueStop,
      layout: SoundsDeckApp.#onLayout,
      density: SoundsDeckApp.#onDensity,
      help: SoundsDeckApp.#onHelp,
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
    const cues = transportCues(snaps);
    this.#announce(transportChanges(this.#lastCues ?? cues, cues));
    this.#lastCues = cues;
    context.cues = cues.map((c) => ({ ...c, at: clock(c.pausedTime) }));
    return context;
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    const rerender = () => this.render({ parts: ['beds', 'board'] });
    for (const hook of ['createPlaylist', 'updatePlaylist', 'deletePlaylist', 'updatePlaylistSound']) {
      this.#hooks.push([hook, Hooks.on(hook, rerender)]);
    }
  }

  /** The transport as last drawn, to tell a screen reader what changed since. */
  #lastCues = null;

  /**
   * A polite live region, created once on the window itself - outside the parts, which every render replaces, so a
   * screen reader keeps listening to the same element.
   */
  #announce(changes) {
    if (!changes.length || !this.element) return;
    let live = this.element.querySelector(':scope > .sd-live');
    if (!live) {
      live = Object.assign(document.createElement('p'), { className: 'sd-live' });
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('role', 'status');
      this.element.append(live);
    }
    const key = {
      started: 'SOUNDS_DECK.EventStarted',
      paused: 'SOUNDS_DECK.EventPaused',
      stopped: 'SOUNDS_DECK.EventStopped',
    };
    live.textContent = changes.map((c) => game.i18n.format(key[c.kind], { name: c.name })).join(' · ');
  }

  /** What the filter box holds - kept on the window, so a re-render (any playlist change) does not wipe it. */
  #filter = '';

  /** Hide the pads and banks the filter does not match. Pure matching in core/filter.mjs; this only shows and hides. */
  #applyFilter() {
    for (const bank of this.element?.querySelectorAll('.sd-bank') ?? []) {
      const bankName = bank.querySelector('legend')?.textContent ?? '';
      let shown = 0;
      for (const cell of bank.querySelectorAll('.sd-pad-cell')) {
        const hit = matches(this.#filter, cell.dataset.padName, bankName);
        cell.hidden = !hit;
        if (hit) shown++;
      }
      bank.hidden = shown === 0;
    }
  }

  /** Ticks the transport's position while the window is open; nothing is re-rendered for it. */
  #ticker = null;

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.classList.toggle('is-vertical', game.settings.get(MODULE_ID, 'layout') === 'vertical');
    this.element.classList.toggle('is-compact', game.settings.get(MODULE_ID, 'density') === 'compact');
    const box = this.element.querySelector('.sd-filter input');
    if (box) {
      box.value = this.#filter;
      box.addEventListener('input', () => {
        this.#filter = box.value;
        this.#applyFilter();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && box.value) {
          e.stopPropagation(); // clear the filter first; a second Escape reaches the window as usual
          box.value = '';
          this.#filter = '';
          this.#applyFilter();
        }
      });
    }
    this.#applyFilter();
    for (const input of this.element.querySelectorAll('.sd-cue input[type=range]')) {
      input.addEventListener('change', () => SoundsDeckApp.#seek(input));
    }
    this.#ticker ??= setInterval(() => this.#tick(), 500);
  }

  #tick() {
    for (const row of this.element?.querySelectorAll('.sd-cue') ?? []) {
      const sound = game.playlists.get(row.dataset.playlistId)?.sounds.get(row.dataset.soundId);
      const live = sound?.sound;
      if (!live) continue;
      const range = row.querySelector('input[type=range]');
      if (Number.isFinite(live.duration)) range.max = String(Math.floor(live.duration));
      const t = sound.playing ? live.currentTime : (sound.pausedTime ?? 0);
      if (document.activeElement !== range) range.value = String(Math.floor(t));
      row.querySelector('.sd-cue-time').textContent = `${clock(t)} / ${clock(live.duration)}`;
    }
  }

  _onClose(options) {
    clearInterval(this.#ticker);
    this.#ticker = null;
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

  /** An event's say in ducking, stored on its own sound as flags["sounds-deck"].duck - world data, the GM's to set. */
  static async #onDuckToggle(_event, target) {
    const playlist = SoundsDeckApp.#playlistOf(target);
    const sound = playlist?.sounds.get(target.dataset.soundId);
    if (!sound) return;
    const ducks = sound.flags?.['sounds-deck']?.duck !== false;
    await sound.update({ 'flags.sounds-deck.duck': !ducks });
  }

  static #cueOf(target) {
    const row = target.closest('.sd-cue');
    const playlist = game.playlists.get(row?.dataset.playlistId);
    return { playlist, sound: playlist?.sounds.get(row?.dataset.soundId) };
  }

  // Pause, resume and stop are exactly what Foundry's own playlist sidebar does, so the two never disagree.
  static async #onCuePause(_event, target) {
    const { sound } = SoundsDeckApp.#cueOf(target);
    if (sound?.playing) await sound.update({ playing: false, pausedTime: sound.sound?.currentTime ?? 0 });
  }

  static async #onCueResume(_event, target) {
    const { playlist, sound } = SoundsDeckApp.#cueOf(target);
    if (sound) await playlist.playSound(sound);
  }

  static async #onCueStop(_event, target) {
    const { playlist, sound } = SoundsDeckApp.#cueOf(target);
    if (sound) await playlist.stopSound(sound);
  }

  /** Seek = pause at the new position, then play from it: a playing Sound cannot be moved by its document. */
  static async #seek(input) {
    const { playlist, sound } = SoundsDeckApp.#cueOf(input);
    if (!sound) return;
    const wasPlaying = sound.playing;
    await sound.update({ playing: false, pausedTime: Number(input.value) });
    if (wasPlaying) await playlist.playSound(sound);
  }

  /**
   * The two rules, said where they are needed (Auditorium on v0.4, note 11): without them a numbered name and an emoji
   * are invisible conventions - to a new Handler, and to this one in a year.
   */
  static async #onHelp() {
    const t = (k) => game.i18n.localize(`SOUNDS_DECK.Help.${k}`);
    const content = `<p>${t('Intro')}</p>
      <ul>
        <li>${t('Bed')}</li>
        <li>${t('Bank')}
          <ul><li>${t('OneShot')}</li><li>${t('Toggle')}</li><li>${t('Cue')}</li><li>${t('Shuffle')}</li></ul>
        </li>
        <li>${t('Neither')}</li>
      </ul>
      <p>${t('Scenes')}</p>
      <p>${t('Source')}</p>`;
    return foundry.applications.api.DialogV2.prompt({
      window: { title: 'SOUNDS_DECK.Help.Title', icon: 'fa-solid fa-circle-question' },
      classes: ['sounds-deck-help'],
      content,
      ok: { label: 'SOUNDS_DECK.Help.Ok' },
      rejectClose: false,
    });
  }

  static async #onDensity() {
    await game.settings.set(MODULE_ID, 'density', nextDensity(game.settings.get(MODULE_ID, 'density')));
    // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 calls actions with `this` bound to the instance (see #onLayout).
    this.render();
  }

  static async #onLayout() {
    await game.settings.set(MODULE_ID, 'layout', nextLayout(game.settings.get(MODULE_ID, 'layout')));
    // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 calls every action with `this` bound to the INSTANCE, so this is the window, not the class. Biome's fix (this -> SoundsDeckApp) would call render() on the class and break the switch.
    this.render();
  }
}
