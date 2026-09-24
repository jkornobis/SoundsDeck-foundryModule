/**
 * Quench batch: the deck itself, driven through its real buttons in a running world.
 *
 * Auditorium on v0.4, note 7 (Software Engineer): this was tools/live-proof.mjs - 36 checks written as page code inside
 * a template string, which Biome could not read and where an escape or a name clash broke three runs in one day. Here
 * it is ordinary code: linted, and runnable from Quench's own window once the module is installed.
 *
 * WHERE THE MODULE COMES FROM: installed, game.modules.get('sounds-deck').api. Not installed, tools/quench-run.mjs loads
 * src/ into the page first and leaves the same api on globalThis.__soundsDeckHarness. Neither: the batch skips.
 *
 * 🚨 IT PLAYS, BROADCASTS AND ACTIVATES SCENES. It refuses unless the gamemaster is alone and nothing is playing,
 * builds its banks as sandbox playlists in the GE-Foundry folder, and leaves the world as it found it.
 *
 * The Delta Green world's own names are used where the proof needs a real place: the eight key playlists, the doorway
 * scene and the two board scenes bound to 8 · The Board.
 */
import { classify } from '../../src/core/classify.mjs';
import { deckName } from '../../src/core/names.mjs';

const ID = 'sounds-deck';
const DOORWAY = 'Opening Dashboard';
const BOARD_SCENES = ['Investigation Desk', 'Shotgun Board'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => {
  for (let t = 0; t < ms; t += 200) {
    if (await fn()) return true;
    await wait(200);
  }
  return false;
};

// What a sound's audio is doing, as opposed to what its document says (#37): sounding once it really plays - PLAYING,
// with a position - and quiet once it has fully stopped, or never started.
const sounding = (s) => s.sound?._state === foundry.audio.Sound.STATES.PLAYING && Number.isFinite(s.sound.currentTime);
const quiet = (s) => {
  const { NONE, LOADED, STOPPED } = foundry.audio.Sound.STATES;
  return !s.sound || [NONE, LOADED, STOPPED].includes(s.sound._state);
};

export function registerDeck(quench) {
  quench.registerBatch(
    'sounds-deck.deck',
    (context) => {
      const { describe, it, assert, before, after } = context;
      const S = {}; // state shared along the run, in order

      before(async function () {
        this.timeout(30000);
        // The harness, when present, is the code under test (tools/quench-run.mjs --src) - even over an installed release.
        S.api = globalThis.__soundsDeckHarness?.api ?? game.modules.get(ID)?.api;
        if (!S.api || !game.user.isGM) this.skip();
        // This batch walks the world it was written in. Anywhere else it skips - and says what it looked for.
        const missing = [
          ...['8 · The Board', '5 · Wrong'].filter((n) => !game.playlists.getName(n)),
          ...[DOORWAY, ...BOARD_SCENES].filter((n) => !game.scenes.getName(n)),
        ];
        if (missing.length) {
          console.info(`sounds-deck | deck batch skipped: this world has no ${missing.join(', ')}`);
          this.skip();
        }
        const others = game.users.filter((u) => u.active && u.id !== game.user.id).map((u) => u.name);
        const playing = game.playlists.filter((p) => p.playing).map((p) => p.name);
        if (others.length || playing.length) throw new Error(`refusing: connected ${others}, playing ${playing}`);
        if (game.audio.locked) throw new Error('audio is locked: interact with the page once, then run again');

        S.activeBefore = game.scenes.active;
        S.seat = {
          layout: game.settings.get(ID, 'layout'),
          geometry: game.settings.get(ID, 'geometry'),
          density: game.settings.get(ID, 'density'),
          journal: game.settings.get(ID, 'journal'),
          hideSources: game.settings.get(ID, 'hideSources'),
          journalEntries: game.settings.get(ID, 'journalEntries'),
          moods: game.settings.get(ID, 'moods'),
        };
        const folder = game.folders.find((f) => f.type === 'Playlist' && f.name === 'GE-Foundry');
        const fx = game.playlists.contents
          .flatMap((p) => p.sounds.contents)
          .filter((s) => s.path.startsWith('ge-foundry/fx/'))
          .slice(0, 3);
        const M = CONST.PLAYLIST_MODES;
        const make = (name, mode) =>
          Playlist.create({
            name,
            mode,
            folder: folder?.id ?? null,
            sounds: fx.map((s, i) => ({
              name: `${name.split(' ').pop()} ${i + 1}`,
              path: s.path,
              volume: 0.4,
              repeat: mode === M.SIMULTANEOUS,
              fade: 500,
            })),
          });
        S.sandbox = {
          shots: await make('🔫 __sd one-shots', M.DISABLED),
          loops: await make('🌧️ __sd loops', M.SIMULTANEOUS),
          shuffle: await make('🎲 __sd shuffle', M.SHUFFLE),
          cues: await make('🎞️ __sd cues', M.SEQUENTIAL),
        };
        S.board = game.playlists.getName('8 · The Board');
        S.wrong = game.playlists.getName('5 · Wrong');
        S.shots = [];
      });

      after(async function () {
        this.timeout(30000);
        if (!S.sandbox) return;
        for (const s of S.shots) s.stop?.();
        await S.app?.close();
        for (const p of game.playlists.filter((x) => x.playing)) await p.stopAll();
        for (const p of Object.values(S.sandbox)) await p.delete();
        await game.settings.set(ID, 'layout', S.seat.layout);
        await game.settings.set(ID, 'geometry', S.seat.geometry);
        await game.settings.set(ID, 'density', S.seat.density);
        await game.settings.set(ID, 'journal', S.seat.journal);
        await game.settings.set(ID, 'hideSources', S.seat.hideSources);
        await game.settings.set(ID, 'journalEntries', S.seat.journalEntries);
        await game.settings.set(ID, 'moods', S.seat.moods);
        if (S.activeBefore && !S.activeBefore.active) await S.activeBefore.activate();
      });

      const card = (name) =>
        S.app.element.querySelector(`.sd-bed[data-playlist-id="${game.playlists.getName(name).id}"]`);
      const click = (name, action) => card(name).querySelector(`[data-action=${action}]`).click();
      const bank = (p) => S.app.element.querySelector(`.sd-bank[data-playlist-id="${p.id}"]`);

      describe('the beds', function () {
        this.timeout(20000);

        it('the scene fix is installed on this Foundry (its defect is present)', () => {
          assert.isTrue(S.api.sceneFix?.installed, S.api.sceneFix?.reason);
        });

        it('eight bed cards, in key order, in the table language', async () => {
          S.app = S.api.open();
          await until(() => S.app.rendered && S.app.element.querySelectorAll('.sd-bed').length);
          const names = [...S.app.element.querySelectorAll('.sd-bed-name')].map((e) => e.textContent.trim());
          assert.lengthOf(names, 8);
          names.forEach((n, i) => {
            assert.isTrue(n.startsWith(`${i + 1} ·`), n);
          });
          const label = S.app.element.querySelector('[data-action=play]')?.getAttribute('aria-label');
          assert.strictEqual(label, game.i18n.localize('SOUNDS_DECK.Play'));
        });

        it('play: the bed plays, its card lights and names the track', async () => {
          click('8 · The Board', 'play');
          await until(() => S.board.playing && card('8 · The Board')?.classList.contains('is-playing'));
          const now = card('8 · The Board').querySelector('.sd-bed-now').textContent.trim();
          assert.isTrue(S.board.playing);
          // what the deck shows: with "hide sources" on, the name without its last "(…)"
          const expected = deckName(S.board.sounds.find((s) => s.playing)?.name, game.settings.get(ID, 'hideSources'));
          assert.strictEqual(now, expected);
        });

        it('a bed is exclusive: starting Wrong stops The Board', async () => {
          click('5 · Wrong', 'play');
          await until(() => S.wrong.playing && !S.board.playing);
          assert.isTrue(S.wrong.playing && !S.board.playing);
        });

        it('skip plays a different track, stop stops', async () => {
          const first = S.wrong.sounds.find((s) => s.playing)?.name;
          click('5 · Wrong', 'skip');
          await until(() => S.wrong.sounds.find((s) => s.playing)?.name !== first);
          assert.notStrictEqual(S.wrong.sounds.find((s) => s.playing)?.name, first);
          click('5 · Wrong', 'stop');
          await until(() => !S.wrong.playing);
          assert.isFalse(S.wrong.playing);
        });
      });

      describe('the board', function () {
        this.timeout(20000);

        it('shows every bank and nothing else; a Shuffle bank is disabled, with its hint', async () => {
          const { shots, loops, shuffle, cues } = S.sandbox;
          await until(() => bank(shots) && bank(loops) && bank(shuffle) && bank(cues));
          const shown = [...S.app.element.querySelectorAll('.sd-bank legend')].map((e) => e.textContent.trim()).sort();
          const expected = game.playlists
            .filter((p) => classify(p.name, p.mode)?.role === 'bank')
            .map((p) => p.name)
            .sort();
          assert.deepEqual(shown, expected);
          assert.isTrue(bank(shuffle).disabled);
          assert.exists(bank(shuffle).querySelector('.sd-hint'));
        });

        it('filter: "glass" leaves only glass pads, survives a re-render, and Escape brings every pad back', async () => {
          const box = () => S.app.element.querySelector('.sd-filter input');
          const visible = () =>
            [...S.app.element.querySelectorAll('.sd-pad-cell')]
              .filter((c) => !c.hidden && !c.closest('.sd-bank').hidden)
              .map((c) => c.dataset.padName);
          const all = visible().length;
          box().value = 'glass';
          box().dispatchEvent(new Event('input'));
          const glass = visible();
          assert.isAbove(glass.length, 0);
          for (const n of glass) assert.match(n, /glass/i);
          await S.sandbox.loops.update({ fade: 501 }); // any playlist change re-renders the board
          await wait(600);
          assert.strictEqual(box().value, 'glass');
          assert.lengthOf(visible(), glass.length);
          box().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await wait(200);
          assert.strictEqual(box().value, '');
          assert.lengthOf(visible(), all);
        });

        it('a pad plays on a click and stops on the next, lit while it plays (decision 0005)', async () => {
          const { shots } = S.sandbox;
          const snd = shots.sounds.contents[0];
          const pad = () => bank(shots).querySelector('.sd-pad');
          pad().click();
          await until(() => snd.playing && pad()?.getAttribute('aria-pressed') === 'true');
          assert.isTrue(snd.playing, 'the one-shot did not start');
          assert.isTrue(pad().closest('.sd-pad-cell').classList.contains('is-playing'));
          pad().click();
          await until(() => !snd.playing);
          assert.isFalse(snd.playing, 'a second click did not stop it');
        });

        it('no pad or bed name spills out of its card', () => {
          const spills = [];
          for (const el of S.app.element.querySelectorAll('.sd-clamp')) {
            const card = el.closest('.sd-card, .sd-now-row') ?? el.parentElement;
            const a = el.getBoundingClientRect();
            const c = card.getBoundingClientRect();
            if (a.bottom > c.bottom + 1 || a.right > c.right + 1) spills.push(el.textContent.trim());
          }
          assert.deepEqual(spills, []);
        });

        it('the beds are one column', () => {
          const beds = S.app.element.querySelector('.sounds-deck-beds');
          assert.lengthOf(getComputedStyle(beds).gridTemplateColumns.split(' '), 1);
        });

        it('sources stay in the native panel: "(…)" and the description hidden on the deck, shown when the option is off', async () => {
          const { shots } = S.sandbox;
          const snd = shots.sounds.contents[0];
          await snd.update({ name: 'Gunfire (Se7en)', description: 'Se7en (1995) — Howard Shore' });
          const pad = () => bank(shots).querySelector('.sd-pad');
          await game.settings.set(ID, 'hideSources', true);
          await until(() => pad()?.textContent.trim() === 'Gunfire');
          assert.strictEqual(pad().textContent.trim(), 'Gunfire');
          assert.notInclude(pad().dataset.tooltip, 'Howard Shore');
          assert.strictEqual(pad().closest('.sd-pad-cell').dataset.padName, 'Gunfire (Se7en)'); // the filter's full name
          await game.settings.set(ID, 'hideSources', false);
          await until(() => pad()?.textContent.trim() === 'Gunfire (Se7en)');
          assert.include(pad().dataset.tooltip, 'Se7en (1995) — Howard Shore');
          assert.strictEqual(pad().getAttribute('aria-description'), 'Se7en (1995) — Howard Shore');
          await game.settings.set(ID, 'hideSources', true);
        });

        it('room loops toggle one by one: two on, one off, the other keeps playing', async () => {
          const { loops } = S.sandbox;
          const pad = (i) => bank(loops).querySelectorAll('.sd-pad')[i];
          const [l0, l1] = loops.sounds.contents;
          pad(0).click();
          await until(() => l0.playing && pad(0)?.getAttribute('aria-pressed') === 'true');
          pad(1).click();
          await until(() => l1.playing);
          assert.isTrue(l0.playing && l1.playing);
          pad(0).click();
          await until(() => !l0.playing);
          await wait(400);
          assert.isFalse(l0.playing);
          assert.isTrue(l1.playing);
          assert.strictEqual(pad(0).getAttribute('aria-pressed'), 'false');
          await loops.stopAll();
        });

        it('Now playing lists what sounds, with a volume slider that sets the sound volume, and stop all', async () => {
          const { loops } = S.sandbox;
          const l0 = loops.sounds.contents[0];
          bank(loops).querySelectorAll('.sd-pad')[0].click();
          await until(() => l0.playing);
          const row = () => S.app.element.querySelector(`.sd-now-row[data-sound-id="${l0.id}"]`);
          await until(() => row());
          assert.exists(row(), 'the playing loop is not listed');
          const slider = row().querySelector('.sd-volume');
          slider.value = String(foundry.audio.AudioHelper.volumeToInput(0.2));
          slider.dispatchEvent(new Event('input'));
          await until(() => Math.abs(l0.volume - 0.2) < 0.02, 4000);
          assert.closeTo(l0.volume, 0.2, 0.02);
          S.app.element.querySelector('[data-action=stopAll]').click();
          await until(() => !loops.playing);
          assert.isFalse(loops.playing, 'stop all left a loop playing');
        });

        it('the dice arms a one-shot to fire at random moments, listed in Now playing, and disarms', async () => {
          const { shots } = S.sandbox;
          const snd = shots.sounds.contents[1];
          await snd.update({ 'flags.sounds-deck.random': { min: 1, max: 1 } });
          const dice = () => bank(shots).querySelectorAll('.sd-random')[1];
          dice().click();
          await until(() => dice()?.getAttribute('aria-pressed') === 'true');
          assert.exists(S.app.element.querySelector(`.sd-now-row.sd-kind-random[data-sound-id="${snd.id}"]`));
          await until(() => snd.playing, 5000);
          assert.isTrue(snd.playing, 'armed, it never fired');
          S.app.element
            .querySelector(`.sd-now-row.sd-kind-random[data-sound-id="${snd.id}"] [data-action=disarm]`)
            .click();
          await until(() => !S.app.element.querySelector('.sd-now-row.sd-kind-random'));
          assert.strictEqual(dice().getAttribute('aria-pressed'), 'false');
          await shots.stopAll();
        });

        it('the layout switch changes the direction, never the markup order', async () => {
          const content = () => S.app.element.querySelector('.window-content');
          const order = () => [...content().children].map((c) => c.className.split(' ')[0]).join(',');
          const before = { dir: getComputedStyle(content()).flexDirection, order: order() };
          await S.app.options.actions.layout.call(S.app);
          await until(() => S.app.element.classList.contains('is-vertical'));
          assert.strictEqual(before.dir, 'row');
          assert.strictEqual(getComputedStyle(content()).flexDirection, 'column');
          assert.strictEqual(order(), before.order);
        });

        it('compact makes the pads smaller, and the seat keeps its choice', async () => {
          const pad = () => bank(S.sandbox.shots).querySelector('.sd-pad');
          const tall = pad().getBoundingClientRect().height;
          await S.app.options.actions.density.call(S.app);
          await until(() => S.app.element.classList.contains('is-compact'));
          assert.strictEqual(game.settings.get(ID, 'density'), 'compact');
          assert.isBelow(pad().getBoundingClientRect().height, tall);
        });

        it('the window reopens at the size it closed at', async () => {
          S.app.setPosition({ width: 820, height: 560 });
          await wait(300);
          await S.app.close();
          const Deck = S.app.constructor;
          S.app = new Deck();
          await S.app.render({ force: true });
          await until(() => S.app.rendered);
          const b = S.app.element.getBoundingClientRect();
          assert.deepEqual([Math.round(b.width), Math.round(b.height)], [820, 560]);
        });
      });

      describe('events and ducking', function () {
        this.timeout(30000);
        const bedSound = () => S.board.sounds.find((x) => x.playing);
        const gain = () => bedSound()?.sound?.volume ?? Number.NaN;
        const cue = (i) => S.sandbox.cues.sounds.contents[i];
        const cuePad = (i) => bank(S.sandbox.cues).querySelectorAll('.sd-pad')[i];
        const row = () => S.app.element.querySelector(`.sd-cue[data-sound-id="${cue(0).id}"]`);

        it('a cue playing ducks the bed 10 dB (x0.32) and shows on the transport', async () => {
          click('8 · The Board', 'play');
          // A cold page loads a 20 MB track before it plays: two runs out of four needed more than 10 s here.
          await until(() => bedSound()?.sound?.playing, 20000);
          assert.isTrue(!!bedSound()?.sound?.playing, `the board never became audible (playing ${S.board.playing})`);
          // Past the bed's own fade-in - and on the first playback after a world restart the fade starts late: one run
          // read the gain at 0 after 3.5 s. Wait for the level itself, not a fixed time.
          await until(() => gain() > 0.9 * (bedSound()?.volume ?? 1), 12000);
          await wait(500);
          S.full = gain();
          cuePad(0).click();
          await until(() => row() && cue(0).sound?.playing, 10000);
          await wait(1500);
          const ratio = gain() / S.full;
          const why = `ratio ${ratio} full ${S.full} boardPlaying ${S.board.playing} track ${bedSound()?.name} sound ${!!bedSound()?.sound} playBtn ${!!card('8 · The Board')?.querySelector('[data-action=play]')}`;
          assert.isAbove(ratio, 0.22, why);
          assert.isBelow(ratio, 0.42, `ratio ${ratio}`);
          assert.exists(row()?.querySelector('[data-action=cuePause]'));
        });

        it('a screen reader hears the event start, and a keyboard focus ring shows on a pad', async () => {
          const live = S.app.element.querySelector(':scope > .sd-live');
          assert.exists(live);
          assert.strictEqual(live.getAttribute('aria-live'), 'polite');
          assert.include(live.textContent, cue(0).name);
          const pad = cuePad(1);
          pad.focus({ focusVisible: true });
          assert.strictEqual(getComputedStyle(pad).outlineStyle, 'solid');
          pad.blur();
        });

        it('pause keeps the cue on the transport and brings the bed back up', async () => {
          row().querySelector('[data-action=cuePause]').click();
          await until(() => !cue(0).playing && row()?.querySelector('[data-action=cueResume]'));
          await wait(2600);
          assert.isTrue(row()?.classList.contains('is-paused'));
          assert.isAbove(gain() / S.full, 0.9);
          assert.include(
            S.app.element.querySelector(':scope > .sd-live').textContent,
            game.i18n.format('SOUNDS_DECK.EventPaused', { name: cue(0).name }),
          );
        });

        it('resume ducks again; seek jumps to the chosen position', async () => {
          row().querySelector('[data-action=cueResume]').click();
          await until(() => cue(0).sound?.playing, 8000);
          await wait(1500);
          assert.isBelow(gain() / S.full, 0.42);
          const range = row().querySelector('.sd-seek');
          range.value = '30';
          range.dispatchEvent(new Event('change'));
          await wait(2500);
          const at = cue(0).sound?.currentTime ?? 0;
          assert.isAtLeast(at, 29);
          assert.isAtMost(at, 36);
        });

        it('stop removes the cue from the transport and the bed returns to full', async () => {
          row().querySelector('[data-action=nowStop]').click();
          await until(() => !row(), 6000);
          await wait(2600);
          assert.notExists(row());
          assert.isAbove(gain() / S.full, 0.9);
        });

        it("an event pad's ducking switch stores duck:false, and that cue leaves the bed at full", async () => {
          const sw = () => bank(S.sandbox.cues).querySelectorAll('.sd-duck')[1];
          assert.strictEqual(sw()?.getAttribute('aria-pressed'), 'true');
          sw().click();
          await until(() => cue(1).flags?.[ID]?.duck === false && sw()?.getAttribute('aria-pressed') === 'false');
          assert.strictEqual(cue(1).flags?.[ID]?.duck, false);
          cuePad(1).click();
          await until(() => cue(1).sound?.playing, 10000);
          await wait(1500);
          assert.isAbove(gain() / S.full, 0.9);
          await S.sandbox.cues.stopAll();
          await S.board.stopAll();
          await wait(1000);
        });
      });

      describe('scene changes', function () {
        this.timeout(40000);
        const activate = async (name) => {
          await game.scenes.getName(name).activate();
          await wait(2500);
        };
        const track = () => S.board.sounds.find((s) => s.playing)?.name ?? null;

        it('board -> board keeps the same track, board -> doorway stops it', async () => {
          await activate(DOORWAY);
          await activate(BOARD_SCENES[0]);
          const first = track();
          await activate(BOARD_SCENES[1]);
          assert.isTrue(S.board.playing);
          assert.strictEqual(track(), first);
          await activate(DOORWAY);
          assert.isFalse(S.board.playing);
        });

        it('music picked by hand survives into a scene with none; a scene with its own takes over', async () => {
          await activate(BOARD_SCENES[0]);
          await until(() => S.board.playing, 8000);
          click('5 · Wrong', 'play');
          await until(() => S.wrong.playing && !S.board.playing, 8000);
          await activate(DOORWAY);
          assert.isTrue(S.wrong.playing, 'Wrong stopped at the doorway');
          await activate(BOARD_SCENES[0]);
          assert.isTrue(S.board.playing && !S.wrong.playing);
          await activate(DOORWAY);
          assert.isFalse(S.board.playing || S.wrong.playing);
        });

        it('a fault inside the scene fix hands the change to Foundry, reported once', async () => {
          let thrown = false;
          const faulty = new Proxy(game.scenes.getName(BOARD_SCENES[0]), {
            get(t, k) {
              if (k === 'playlist' && !thrown) {
                thrown = true;
                throw new Error('injected fault');
              }
              return Reflect.get(t, k, t);
            },
          });
          const errors = [];
          const original = console.error;
          console.error = (...a) => {
            errors.push(String(a[0]));
            original(...a);
          };
          try {
            await game.playlists._onChangeScene(faulty);
            await until(() => S.board.playing, 6000);
          } finally {
            console.error = original;
          }
          assert.isTrue(thrown);
          assert.isTrue(S.board.playing);
          assert.lengthOf(
            errors.filter((e) => e.includes('scene fix failed')),
            1,
          );
          await S.board.stopAll();
          await wait(800);
        });
      });

      describe('a sound stopped before it starts (#37)', function () {
        this.timeout(20000);
        const loop = () => S.sandbox.loops.sounds.contents[2];
        const heard = () =>
          `state ${loop().sound?._state}, at ${loop().sound?.currentTime}, gain ${loop().sound?.volume}`;

        it('the silent-start fix is installed on this Foundry (its defect is present)', () => {
          assert.isTrue(S.api.silentFix?.installed, S.api.silentFix?.reason);
        });

        it('started again during its fade-out and stopped at once, a loop ends stopped - and sounds on the next press', async () => {
          await loop().update({ playing: true });
          await until(() => sounding(loop()));
          // The race, on purpose: stopped (its 500 ms fade-out starts), started again inside that fade, stopped again
          // before it sounds. Without the fix, Foundry leaves it PLAYING with no position and a gain of 0.
          await loop().update({ playing: false });
          await loop().update({ playing: true });
          await loop().update({ playing: false });
          await wait(1500);
          assert.isTrue(quiet(loop()), `left "playing" after the race: ${heard()}`);
          await loop().update({ playing: true });
          await until(() => sounding(loop()) && loop().sound.volume > 0.3, 5000);
          assert.isTrue(sounding(loop()), `silent on the next press: ${heard()}`);
          await loop().update({ playing: false });
          await until(() => quiet(loop()));
        });
      });

      describe('moods', function () {
        this.timeout(30000);
        const dialog = async (cls) => {
          let d = null;
          await until(() => {
            d = [...foundry.applications.instances.values()].find(
              (a) =>
                a instanceof foundry.applications.api.DialogV2 &&
                a.rendered &&
                a !== S.app &&
                (!cls || a.element.querySelector(cls)),
            );
            return d;
          });
          return d;
        };
        const moodCard = () => S.app.element.querySelector('.sd-mood');
        const shot = () => S.sandbox.shots.sounds.contents[2];
        const [l0, l1] = [0, 1].map((i) => () => S.sandbox.loops.sounds.contents[i]);

        it('save: a bed, a loop at its level and an armed one-shot become a mood of the table, lit', async () => {
          await game.settings.set(ID, 'moods', []);
          await shot().update({ 'flags.sounds-deck.random': { min: 600, max: 600 } }); // armed, but never fires here
          click('8 · The Board', 'play');
          await until(() => S.board.playing);
          await l0().update({ volume: 0.3, playing: true });
          bank(S.sandbox.shots).querySelectorAll('.sd-random')[2].click();
          await until(() => S.app.element.querySelector('.sd-now-row.sd-kind-random'));
          S.app.element.querySelector('[data-action=moodSave]').click();
          const d = await dialog('input[name=name]');
          d.element.querySelector('input[name=name]').value = '__sd mood';
          d.element.querySelector('[data-action=ok]').click();
          await until(() => moodCard()?.classList.contains('is-playing'));
          const [m] = game.settings.get(ID, 'moods');
          assert.strictEqual(m.name, '__sd mood');
          assert.strictEqual(m.bed, S.board.id);
          assert.deepEqual(
            m.loops.map((l) => [l.soundId, l.volume]),
            [[l0().id, 0.3]],
          );
          assert.deepEqual(
            m.random.map((r) => r.soundId),
            [shot().id],
          );
          assert.isTrue(moodCard().classList.contains('is-playing'), 'the mood just saved is not lit');
        });

        it('recall: from another bed, another loop and nothing armed, one click brings the mood back', async () => {
          click('5 · Wrong', 'play');
          await until(() => S.wrong.playing && !S.board.playing);
          await l0().update({ playing: false, volume: 0.9 });
          await l1().update({ playing: true });
          S.app.element.querySelector('.sd-now-row.sd-kind-random [data-action=disarm]').click();
          await until(() => !moodCard()?.classList.contains('is-playing'));
          assert.isFalse(moodCard().classList.contains('is-playing'), 'lit while the mix is different');
          moodCard().querySelector('[data-action=moodRecall]').click();
          await until(() => S.board.playing && !S.wrong.playing && l0().playing && !l1().playing);
          assert.isTrue(S.board.playing, 'the mood bed did not start');
          assert.isFalse(S.wrong.playing, 'the other bed kept playing');
          assert.isTrue(l0().playing && !l1().playing, 'the loops are not the mood');
          assert.closeTo(l0().volume, 0.3, 0.001);
          await until(() => S.app.element.querySelector(`.sd-now-row.sd-kind-random[data-sound-id="${shot().id}"]`));
          await until(() => moodCard()?.classList.contains('is-playing'));
          assert.isTrue(moodCard().classList.contains('is-playing'), 'recalled, but not lit');
        });

        it('recall keeps the bed that already plays: same track, not restarted', async () => {
          const track = S.board.sounds.find((s) => s.playing)?.id;
          moodCard().querySelector('[data-action=moodRecall]').click();
          await wait(1000);
          assert.strictEqual(S.board.sounds.find((s) => s.playing)?.id, track);
        });

        it('delete asks first, then removes the mood and stops nothing', async () => {
          moodCard().querySelector('[data-action=moodDelete]').click();
          const d = await dialog('[data-action=yes]');
          d.element.querySelector('[data-action=yes]').click();
          await until(() => !moodCard());
          assert.lengthOf(game.settings.get(ID, 'moods'), 0);
          assert.isTrue(S.board.playing, 'deleting a mood stopped the music');
          S.app.element.querySelector('[data-action=stopAll]').click();
          await until(() => !game.playlists.some((p) => p.playing));
        });
      });

      describe('the press log', function () {
        this.timeout(20000);
        it('off by default: pressing records nothing, and the export entry is hidden', async () => {
          await game.settings.set(ID, 'journal', false);
          await game.settings.set(ID, 'journalEntries', []);
          bank(S.sandbox.shots).querySelector('.sd-pad').click();
          await wait(500);
          assert.lengthOf(game.settings.get(ID, 'journalEntries'), 0);
          const exportControl = S.app._getHeaderControls().find((c) => c.action === 'journalExport');
          assert.isFalse(exportControl.visible());
        });
        it('switched on: a pad press and a bed press are recorded, with kind, name and bank', async () => {
          await game.settings.set(ID, 'journal', true);
          bank(S.sandbox.shots).querySelector('.sd-pad').click();
          click('5 · Wrong', 'play');
          await until(() => game.settings.get(ID, 'journalEntries').length >= 2);
          const log = game.settings.get(ID, 'journalEntries');
          assert.isTrue(
            log.some(
              (x) =>
                x.kind === 'oneshot' &&
                x.name === S.sandbox.shots.sounds.contents[0].name &&
                x.bank === S.sandbox.shots.name,
            ),
          );
          assert.isTrue(log.some((x) => x.kind === 'bed' && x.name === '5 · Wrong'));
          await S.wrong.stopAll();
        });
      });

      describe('the help', () => {
        it('the "?" in the window menu explains both rules, in the table language', async () => {
          S.app.options.actions.help.call(S.app);
          let dialog = null;
          await until(() => {
            dialog = [...foundry.applications.instances.values()].find((a) =>
              a.options.classes?.includes('sounds-deck-help'),
            );
            return dialog?.rendered;
          });
          const text = dialog.element.textContent;
          await dialog.close();
          assert.include(text, game.i18n.localize('SOUNDS_DECK.Help.Title'));
          // the examples are whatever the strings carry (neutral since 0.5.1), read from the strings themselves
          for (const key of ['Bed', 'Bank']) {
            const example = game.i18n.localize(`SOUNDS_DECK.Help.${key}`).match(/<code>(.*?)<\/code>/)?.[1];
            assert.exists(example, key);
            assert.include(text, example);
          }
        });
      });

      describe('the sidebar', () => {
        it('the playlists sidebar carries a Sounds Deck button', async () => {
          await ui.playlists.render({ force: true });
          await wait(500);
          assert.exists(document.querySelector('#playlists [data-sounds-deck]'));
        });
      });
    },
    { displayName: 'Sounds Deck: the deck, driven in the world' },
  );
}
