/**
 * The Sounds Deck window: on the left, what is playing now and the bed cards; on the right, the board of banks.
 *
 * Built on Foundry's own application class (ApplicationV2 + HandlebarsApplicationMixin), so it pops out, themes
 * and closes like any core window. Every card shows the DOCUMENTS' state and re-renders when a playlist or a sound
 * changes - whoever changed it, from wherever.
 */
import { bankViews, nextDensity, nextLayout } from '../core/banks.mjs';
import { bedCards, bedsToStop } from '../core/beds.mjs';
import { bedVolume, clock, nowPlaying, shouldDuck, transportChanges, transportCues } from '../core/cues.mjs';
import { matches } from '../core/filter.mjs';
import { appendEntry, summarise } from '../core/journal.mjs';
import { captureMood, isEmptyMood, moodIsOn, moodPlan } from '../core/moods.mjs';
import { deckName } from '../core/names.mjs';
import { arm, armedList, disarm, disarmAll, isArmed } from './random.mjs';
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
    context.beds = bedCards(snaps).map((b) => ({
      ...b,
      nowPlaying: b.nowPlaying && shown(b.nowPlaying),
      nowPlayingFrom: hide ? null : b.nowPlayingFrom,
    }));
    context.banks = bankViews(snaps).map((b) => ({
      ...b,
      pads: b.pads.map((p) => ({
        ...p,
        label: shown(p.name), // what the pad shows; the filter still searches the full name (data-pad-name)
        description: hide ? null : p.description,
        armed: p.randomizable && isArmed(b.id, p.id),
      })),
    }));
    context.armed = armedList()
      .map(({ playlistId, soundId }) => {
        const pl = game.playlists.get(playlistId);
        const sound = pl?.sounds.get(soundId);
        return sound ? { playlistId, soundId, name: shown(sound.name), from: pl.name } : null;
      })
      .filter(Boolean);
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
    for (const input of this.element.querySelectorAll('.sd-cue .sd-seek')) {
      input.addEventListener('change', () => SoundsDeckApp.#seek(input));
    }
    for (const input of this.element.querySelectorAll('.sd-now-row .sd-volume')) {
      input.addEventListener('input', () => SoundsDeckApp.#volume(input));
    }
    this.#ticker ??= setInterval(() => this.#tick(), 500);
  }

  #tick() {
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
    super._onClose(options);
  }

  /** One press into this seat's log - only when the seat switched the log on. */
  static async #log(kind, name, bank) {
    if (!game.settings.get(MODULE_ID, 'journal')) return;
    const entry = { at: new Date().toISOString(), kind, name, ...(bank ? { bank } : {}) };
    await game.settings.set(
      MODULE_ID,
      'journalEntries',
      appendEntry(game.settings.get(MODULE_ID, 'journalEntries'), entry),
    );
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
    if (!playlist) return;
    const others = bedsToStop(bedCards(snapshot(game.playlists.contents)), playlist.id);
    for (const id of others) await game.playlists.get(id)?.stopAll();
    await playlist.playAll();
    await SoundsDeckApp.#log('bed', playlist.name);
  }

  static async #onSkip(_event, target) {
    const playlist = SoundsDeckApp.#playlistOf(target);
    await playlist?.playNext();
    if (playlist) await SoundsDeckApp.#log('bed-skip', playlist.name);
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
    // A bank whose mode gives no press is drawn disabled, and does nothing if reached anyway.
    if (!bank?.press) return undefined;
    await SoundsDeckApp.#log(bank.press, sound.name, playlist.name);
    // Every pad: a click plays, the next click stops (the Composer, after first use - decision 0005). A one-shot is a
    // PlaylistSound in a Soundboard Only playlist like the others, so its stop reaches every player, not only this one.
    return sound.playing ? playlist.stopSound(sound) : playlist.playSound(sound);
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
    disarmAll();
    for (const p of game.playlists.filter((x) => x.playing)) await p.stopAll();
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
      await SoundsDeckApp.#log('random', sound?.name ?? sid, playlist?.name);
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
    const isBed = input.closest('.sd-now-row')?.dataset.kind === 'bed';
    const target = isBed ? bedVolume(volume, shouldDuck(snapshot(game.playlists.contents))) : volume;
    sound.sound?.fade(target, { duration: 250 });
    if (sound.isOwner) sound.debounceVolume(volume);
    return playlist;
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
    await SoundsDeckApp.#log('mood-save', name.trim() || fallback);
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
    const plan = moodPlan(mood, snapshot(game.playlists.contents), armedList());
    const soundOf = ({ playlistId, soundId }) => game.playlists.get(playlistId)?.sounds.get(soundId);
    for (const r of plan.disarm) disarm(r.playlistId, r.soundId);
    for (const id of plan.stopBeds) await game.playlists.get(id)?.stopAll();
    for (const r of plan.stopLoops) {
      const s = soundOf(r);
      if (s) await s.parent.stopSound(s);
    }
    for (const r of plan.setVolumes) await soundOf(r)?.update({ volume: r.volume });
    for (const r of plan.startLoops) {
      const s = soundOf(r);
      if (s) await s.update({ volume: r.volume, playing: true });
    }
    if (plan.startBed) await game.playlists.get(plan.startBed)?.playAll();
    for (const r of plan.arm) arm(r.playlistId, r.soundId);
    if (plan.missing) ui.notifications.warn(game.i18n.format('SOUNDS_DECK.MoodMissing', { count: plan.missing }));
    await SoundsDeckApp.#log('mood', mood.name);
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
