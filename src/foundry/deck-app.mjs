/**
 * The Sounds Deck window: on the left, what is playing now and the bed cards; on the right, the board of banks.
 *
 * Built on Foundry's own application class (ApplicationV2 + HandlebarsApplicationMixin), so it pops out, themes
 * and closes like any core window. Every card shows the DOCUMENTS' state and re-renders when a playlist or a sound
 * changes - whoever changed it, from wherever.
 */
import { bankViews, nextDensity, nextLayout } from '../core/banks.mjs';
import { bedCards, nextInOrder } from '../core/beds.mjs';
import {
  clock,
  LAYERS,
  LEVELS_DEFAULT,
  mixVolume,
  nowPlaying,
  shouldDuck,
  transportChanges,
  transportCues,
} from '../core/cues.mjs';
import { matches } from '../core/filter.mjs';
import { PAD_DRAG } from '../core/hotbar.mjs';
import { summarise } from '../core/journal.mjs';
import { isMuted, setLevel } from '../core/levels.mjs';
import { toggleFold } from '../core/look.mjs';
import { captureMood, isEmptyMood, moodIsOn } from '../core/moods.mjs';
import { deckName } from '../core/names.mjs';
import { logPress, playBed, pressPad, stopEverything } from './actions.mjs';
import { applyDuck } from './ducking.mjs';
import { recallMood } from './mood-recall.mjs';
import { previewing, stopPreview, togglePreview } from './preview.mjs';
import { lastRecipients, sendPrivately } from './private.mjs';
import { arm, armedList, disarm, isArmed } from './random.mjs';
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
        {
          icon: 'fa-solid fa-file-export',
          label: 'SOUNDS_DECK.Journal.Export',
          action: 'journalExport',
          visible: () => game.settings.get(MODULE_ID, 'journal'),
        },
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
      preview: SoundsDeckApp.#onPreview,
      fold: SoundsDeckApp.#onFold,
      private: SoundsDeckApp.#onPrivate,
      nowStop: SoundsDeckApp.#onNowStop,
      stopAll: SoundsDeckApp.#onStopAll,
      randomToggle: SoundsDeckApp.#onRandomToggle,
      disarm: SoundsDeckApp.#onDisarm,
      duckToggle: SoundsDeckApp.#onDuckToggle,
      cuePause: SoundsDeckApp.#onCuePause,
      cueResume: SoundsDeckApp.#onCueResume,
      cueStop: SoundsDeckApp.#onCueStop,
      layout: SoundsDeckApp.#onLayout,
      density: SoundsDeckApp.#onDensity,
      help: SoundsDeckApp.#onHelp,
      journalExport: SoundsDeckApp.#onJournalExport,
      moodSave: SoundsDeckApp.#onMoodSave,
      moodRecall: SoundsDeckApp.#onMoodRecall,
      moodDelete: SoundsDeckApp.#onMoodDelete,
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
    // What the deck shows: with "hide sources" on, no trailing "(…)" and no description - those stay in the sidebar.
    const hide = game.settings.get(MODULE_ID, 'hideSources');
    const shown = (n) => deckName(n, hide);
    context.beds = bedCards(snaps).map((b) => {
      // What comes after this track (theme 8): the playlist's own playback order, which a playNext follows.
      const playlist = game.playlists.get(b.id);
      const current = b.playing ? playlist?.sounds.find((s) => s.playing)?.id : null;
      const next = current && playlist.sounds.get(nextInOrder(playlist.playbackOrder ?? [], current));
      return {
        ...b,
        nowPlaying: b.nowPlaying && shown(b.nowPlaying),
        nowPlayingFrom: hide ? null : b.nowPlayingFrom,
        next: next ? shown(next.name) : null,
      };
    });
    const folded = game.settings.get(MODULE_ID, 'folded');
    context.banks = bankViews(snaps).map((b) => ({
      ...b,
      folded: folded.includes(b.id), // this seat folded it from its title (theme 9)
      pads: b.pads.map((p) => ({
        ...p,
        label: shown(p.name), // what the pad shows; the filter still searches the full name (data-pad-name)
        description: hide ? null : p.description,
        armed: p.randomizable && isArmed(b.id, p.id),
        // Every pad of a bank that plays can be heard in the GM's ear first (note 3); a disabled bank cannot.
        previewable: Boolean(b.press),
        previewing: previewing() === p.id,
      })),
    }));
    context.armed = armedList()
      .map(({ playlistId, soundId }) => {
        const pl = game.playlists.get(playlistId);
        const sound = pl?.sounds.get(soundId);
        return sound ? { playlistId, soundId, name: shown(sound.name), from: pl.name } : null;
      })
      .filter(Boolean);
    const levels = { ...LEVELS_DEFAULT, ...game.settings.get(MODULE_ID, 'levels') };
    context.levels = LAYERS.map((layer) => ({
      layer,
      label: game.i18n.localize(`SOUNDS_DECK.Layer.${layer}`),
      input: foundry.audio.AudioHelper.volumeToInput(levels[layer]),
      muted: isMuted(levels, layer), // a knob press (theme 6): shown, so the deck says why a layer is silent
    }));
    const armedNow = armedList();
    context.moods = game.settings.get(MODULE_ID, 'moods').map((m) => ({
      ...m,
      on: moodIsOn(m, snaps, armedNow),
      bedName: (m.bed && game.playlists.get(m.bed)?.name) || game.i18n.localize('SOUNDS_DECK.MoodNoBed'),
      summary: game.i18n.format('SOUNDS_DECK.MoodSummary', { loops: m.loops.length, random: m.random.length }),
    }));
    const cues = transportCues(snaps);
    this.#announce(transportChanges(this.#lastCues ?? cues, cues));
    this.#lastCues = cues;
    const { volumeToInput } = foundry.audio.AudioHelper;
    context.now = nowPlaying(snaps).map((n) => ({
      ...n,
      name: shown(n.name),
      isCue: n.kind === 'cue',
      isPlaying: n.state === 'playing',
      volumeInput: volumeToInput(n.volume),
      at: clock(snaps.find((p) => p.id === n.playlistId)?.sounds.find((x) => x.id === n.soundId)?.pausedTime),
    }));
    return context;
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    const rerender = () => this.render({ parts: ['beds', 'board'] });
    for (const hook of [
      'createPlaylist',
      'updatePlaylist',
      'deletePlaylist',
      'updatePlaylistSound',
      'soundsDeckRandom',
      'soundsDeckPreview',
    ]) {
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
      preview: 'SOUNDS_DECK.PreviewStarted',
      private: 'SOUNDS_DECK.Private.Sent',
    };
    live.textContent = changes.map((c) => game.i18n.format(key[c.kind], { name: c.name })).join(' · ');
  }

  /** What the filter box holds - kept on the window, so a re-render (any playlist change) does not wipe it. */
  #filter = '';

  /** Hide the pads and banks the filter does not match. Pure matching in core/filter.mjs; this only shows and hides. */
  #applyFilter() {
    for (const bank of this.element?.querySelectorAll('.sd-bank') ?? []) {
      // A search looks everywhere, folded banks included; clearing it folds them again (theme 9).
      const pads = bank.querySelector('.sd-pads');
      if (pads) pads.hidden = bank.dataset.folded === 'true' && !this.#filter;
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
    for (const input of this.element.querySelectorAll('.sd-cue .sd-seek')) {
      input.addEventListener('change', () => SoundsDeckApp.#seek(input));
    }
    for (const input of this.element.querySelectorAll('.sd-level')) {
      input.addEventListener('input', () => applyDuck(SoundsDeckApp.#levelsWith(input)));
      input.addEventListener('change', () => game.settings.set(MODULE_ID, 'levels', SoundsDeckApp.#levelsWith(input)));
    }
    for (const input of this.element.querySelectorAll('.sd-now-row .sd-volume')) {
      input.addEventListener('input', () => SoundsDeckApp.#volume(input));
    }
    // A pad of a bank that plays can be dragged onto Foundry's hotbar, where it becomes a button (theme 6, hotbar.mjs).
    for (const pad of this.element.querySelectorAll('.sd-bank:not([disabled]) .sd-pad')) {
      pad.draggable = true;
      pad.addEventListener('dragstart', (event) => {
        const playlistId = pad.closest('[data-playlist-id]')?.dataset.playlistId;
        const drag = { type: PAD_DRAG, playlistId, soundId: pad.dataset.soundId };
        event.dataTransfer.setData('text/plain', JSON.stringify(drag));
      });
    }
    this.#ticker ??= setInterval(() => this.#tick(), 500);
  }

  #tick() {
    // Pressed but not heard yet (theme 8): a bed card or a pad pulses from the press until its sound is actually
    // playing - the seconds a large file takes to load, when a press used to look ignored.
    const heard = (s) => s.sound?.playing && Number.isFinite(s.sound.currentTime);
    for (const card of this.element?.querySelectorAll('.sd-bed') ?? []) {
      const playlist = game.playlists.get(card.dataset.playlistId);
      const loading = Boolean(playlist?.playing) && !playlist.sounds.some((s) => s.playing && heard(s));
      card.classList.toggle('is-loading', loading);
      card.setAttribute('aria-busy', String(loading));
      const sound = playlist?.sounds.find((s) => s.playing && heard(s));
      const time = card.querySelector('.sd-bed-clock');
      if (!time) continue;
      const live = sound?.sound;
      const at = live ? live.currentTime : 0;
      const total = live?.duration;
      time.textContent = live ? `${clock(at)} / ${clock(total)}` : '';
      const share = live && Number.isFinite(total) && total > 0 ? Math.min(100, (100 * at) / total) : 0;
      card.querySelector('.sd-bed-progress-fill').style.width = `${share}%`;
      card.querySelector('.sd-bed-progress').setAttribute('aria-valuenow', String(Math.round(share)));
    }
    for (const pad of this.element?.querySelectorAll('.sd-pad[data-sound-id]') ?? []) {
      const playlist = game.playlists.get(pad.closest('[data-playlist-id]')?.dataset.playlistId);
      const sound = playlist?.sounds.get(pad.dataset.soundId);
      const loading = Boolean(sound?.playing) && !heard(sound);
      pad.classList.toggle('is-loading', loading);
      pad.setAttribute('aria-busy', String(loading));
    }
    for (const row of this.element?.querySelectorAll('.sd-cue') ?? []) {
      const sound = game.playlists.get(row.dataset.playlistId)?.sounds.get(row.dataset.soundId);
      const live = sound?.sound;
      if (!live) continue;
      const range = row.querySelector('.sd-seek');
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
    stopPreview(); // a preview belongs to the open deck; nothing keeps playing in the ear once it is closed
    super._onClose(options);
  }

  static async #onJournalExport() {
    const entries = game.settings.get(MODULE_ID, 'journalEntries');
    const data = JSON.stringify({ exported: new Date().toISOString(), summary: summarise(entries), entries }, null, 2);
    foundry.utils.saveDataToFile(
      data,
      'application/json',
      `sounds-deck-journal-${new Date().toISOString().slice(0, 10)}.json`,
    );
  }

  static #playlistOf(target) {
    return game.playlists.get(target.closest('[data-playlist-id]')?.dataset.playlistId);
  }

  static async #onPlay(_event, target) {
    const playlist = SoundsDeckApp.#playlistOf(target);
    if (playlist) await playBed(playlist);
  }

  static async #onSkip(_event, target) {
    const playlist = SoundsDeckApp.#playlistOf(target);
    await playlist?.playNext();
    if (playlist) await logPress('bed-skip', playlist.name);
  }

  static async #onStop(_event, target) {
    await SoundsDeckApp.#playlistOf(target)?.stopAll();
  }

  /** A pad: what a press does is actions.pressPad, the same for a hotbar button or a key. */
  static async #onPad(_event, target) {
    const playlist = SoundsDeckApp.#playlistOf(target);
    const sound = playlist?.sounds.get(target.dataset.soundId);
    if (sound) return pressPad(playlist, sound);
  }

  /**
   * The 👤 on a pad (0.7, note 1): tick who hears it, then Send - it plays once on their machines, quietly in this ear.
   * The players last sent to are ticked again if they are still connected: whispers tend to go to the same agent twice.
   */
  static async #onPrivate(_event, target) {
    const playlist = SoundsDeckApp.#playlistOf(target);
    const sound = playlist?.sounds.get(target.dataset.soundId);
    if (!sound) return;
    const players = game.users.filter((u) => u.active && u.id !== game.user.id);
    if (!players.length) return ui.notifications.warn('SOUNDS_DECK.Private.NoPlayers', { localize: true });
    const ticked = new Set(lastRecipients());
    const name = deckName(sound.name, game.settings.get(MODULE_ID, 'hideSources'));
    const esc = foundry.utils.escapeHTML;
    const rows = players.map(
      (u) =>
        `<label class="sd-private-player"><input type="checkbox" name="to" value="${u.id}"${ticked.has(u.id) ? ' checked' : ''}> ${esc(u.name)}</label>`,
    );
    const chosen = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'SOUNDS_DECK.Private.Title', icon: 'fa-solid fa-user' },
      classes: ['sounds-deck-private'],
      content: `<p>${game.i18n.format('SOUNDS_DECK.Private.Intro', { name: esc(name) })}</p>${rows.join('')}`,
      ok: {
        label: 'SOUNDS_DECK.Private.Send',
        callback: (_e, button) => [...button.form.querySelectorAll('input[name=to]:checked')].map((i) => i.value),
      },
      rejectClose: false,
    });
    if (!chosen?.length) return undefined;
    const sent = sendPrivately(sound, chosen);
    if (!sent.length) return ui.notifications.warn('SOUNDS_DECK.Private.NoPlayers', { localize: true });
    await logPress('private', sound.name, playlist.name);
    const names = sent.map((id) => game.users.get(id)?.name).join(', ');
    // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 calls actions with `this` bound to the instance (see #onLayout).
    this.#announce([{ kind: 'private', name: `${names} - ${name}` }]);
  }

  /** A bank's title folds or unfolds it, on this seat (theme 9). The setting's change redraws the deck. */
  static async #onFold(_event, target) {
    const id = target.closest('[data-playlist-id]')?.dataset.playlistId;
    if (id) await game.settings.set(MODULE_ID, 'folded', toggleFold(game.settings.get(MODULE_ID, 'folded'), id));
  }

  /** The 🎧 on a pad: hear it in this browser only, before the table does (note 3; the rules are core/preview.mjs). */
  static async #onPreview(_event, target) {
    const playlist = SoundsDeckApp.#playlistOf(target);
    const sound = playlist?.sounds.get(target.dataset.soundId);
    if (!sound) return;
    const started = await togglePreview(sound);
    if (!started) return;
    const name = deckName(sound.name, game.settings.get(MODULE_ID, 'hideSources'));
    // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 calls actions with `this` bound to the instance (see #onLayout).
    this.#announce([{ kind: 'preview', name }]);
  }

  static #rowOf(target) {
    const row = target.closest('[data-sound-id]');
    const playlist = game.playlists.get(row?.dataset.playlistId);
    return { playlist, sound: playlist?.sounds.get(row?.dataset.soundId) };
  }

  /** Stop one line of the "Now playing" list: a bed stops as a whole playlist, anything else as its one sound. */
  static async #onNowStop(_event, target) {
    const { playlist, sound } = SoundsDeckApp.#rowOf(target);
    if (!sound) return;
    if (target.closest('.sd-now-row')?.dataset.kind === 'bed') return playlist.stopAll();
    return playlist.stopSound(sound);
  }

  static async #onStopAll() {
    return stopEverything();
  }

  /** The 🎲 on a one-shot's strip: arm it to fire at random moments, or disarm it. */
  static async #onRandomToggle(_event, target) {
    const { playlist, sound } = SoundsDeckApp.#rowOf(target);
    const pid = playlist?.id ?? target.closest('[data-playlist-id]')?.dataset.playlistId;
    const sid = target.dataset.soundId;
    if (!pid || !sid) return;
    if (isArmed(pid, sid)) disarm(pid, sid);
    else {
      arm(pid, sid);
      await logPress('random', sound?.name ?? sid, playlist?.name);
    }
  }

  static #onDisarm(_event, target) {
    const row = target.closest('[data-playlist-id]');
    disarm(row?.dataset.playlistId, row?.dataset.soundId);
  }

  /**
   * A volume slider in the "Now playing" list does what Foundry's own playlist sidebar does, read from its source:
   * the new volume applies at once on this client, and reaches the world after the sound's own debounce. A ducked bed
   * is faded to its ducked level, so moving its slider during an event does not un-duck it.
   */
  static #volume(input) {
    const { playlist, sound } = SoundsDeckApp.#rowOf(input);
    if (!sound) return;
    const volume = foundry.audio.AudioHelper.inputToVolume(input.value);
    if (volume === sound.volume) return;
    sound.updateSource({ volume });
    const layer = input.closest('.sd-now-row')?.dataset.kind;
    const ducked = shouldDuck(snapshot(game.playlists.contents));
    const target = mixVolume(volume, layer, game.settings.get(MODULE_ID, 'levels'), ducked);
    sound.sound?.fade(target, { duration: 250 });
    if (sound.isOwner) sound.debounceVolume(volume);
    return playlist;
  }

  /** The table's levels with one layer moved to where its slider now stands - which also ends a mute on it. */
  static #levelsWith(input) {
    const level = foundry.audio.AudioHelper.inputToVolume(input.value);
    return setLevel(game.settings.get(MODULE_ID, 'levels'), input.dataset.layer, level);
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
      <p>${t('Moods')}</p>
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

  /** Save what plays now - bed, room loops and their levels, armed random effects - as a mood of the table's. */
  static async #onMoodSave() {
    const moods = game.settings.get(MODULE_ID, 'moods');
    const mood = captureMood(snapshot(game.playlists.contents), armedList(), {
      id: foundry.utils.randomID(),
      name: '',
    });
    if (isEmptyMood(mood)) return ui.notifications.warn('SOUNDS_DECK.MoodEmpty', { localize: true });
    const fallback = game.i18n.format('SOUNDS_DECK.MoodDefault', { n: moods.length + 1 });
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'SOUNDS_DECK.MoodSave', icon: 'fa-solid fa-floppy-disk' },
      content: `<label>${game.i18n.localize('SOUNDS_DECK.MoodName')} <input type="text" name="name" value="${foundry.utils.escapeHTML(fallback)}" autofocus></label>`,
      ok: { label: 'SOUNDS_DECK.MoodSaveShort', callback: (_e, button) => button.form.elements.name.value },
      rejectClose: false,
    });
    if (name === null || name === undefined) return undefined;
    await game.settings.set(MODULE_ID, 'moods', [...moods, { ...mood, name: name.trim() || fallback }]);
    await logPress('mood-save', name.trim() || fallback);
  }

  /**
   * Recall a mood: the plan (core/moods.mjs) names every change; this carries it out with the same calls the deck's
   * own buttons make. A bed that already plays is kept, never restarted; events are never touched.
   */
  static async #onMoodRecall(_event, target) {
    const mood = game.settings
      .get(MODULE_ID, 'moods')
      .find((m) => m.id === target.closest('[data-mood-id]')?.dataset.moodId);
    if (!mood) return;
    await logPress('mood', mood.name);
    // The same recall a scene with this mood runs (note 5): loops and random first, the music as one crossfade.
    const missing = await recallMood(mood);
    if (missing) ui.notifications.warn(game.i18n.format('SOUNDS_DECK.MoodMissing', { count: missing }));
  }

  static async #onMoodDelete(_event, target) {
    const id = target.closest('[data-mood-id]')?.dataset.moodId;
    const moods = game.settings.get(MODULE_ID, 'moods');
    const mood = moods.find((m) => m.id === id);
    if (!mood) return;
    const yes = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'SOUNDS_DECK.MoodDelete', icon: 'fa-solid fa-trash' },
      content: `<p>${game.i18n.format('SOUNDS_DECK.MoodDeleteConfirm', { name: foundry.utils.escapeHTML(mood.name) })}</p>`,
      rejectClose: false,
    });
    if (yes)
      await game.settings.set(
        MODULE_ID,
        'moods',
        moods.filter((m) => m.id !== id),
      );
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
