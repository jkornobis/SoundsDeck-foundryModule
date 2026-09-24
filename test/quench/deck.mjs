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

export function registerDeck(quench) {
  quench.registerBatch(
    'sounds-deck.deck',
    (context) => {
      const { describe, it, assert, before, after } = context;
      const S = {}; // state shared along the run, in order

      before(async function () {
        this.timeout(30000);
        S.api = game.modules.get(ID)?.api ?? globalThis.__soundsDeckHarness?.api;
        if (!S.api || !game.user.isGM) this.skip();
        const others = game.users.filter((u) => u.active && u.id !== game.user.id).map((u) => u.name);
        const playing = game.playlists.filter((p) => p.playing).map((p) => p.name);
        if (others.length || playing.length) throw new Error(`refusing: connected ${others}, playing ${playing}`);
        if (game.audio.locked) throw new Error('audio is locked: interact with the page once, then run again');

        S.activeBefore = game.scenes.active;
        S.seat = {
          layout: game.settings.get(ID, 'layout'),
          geometry: game.settings.get(ID, 'geometry'),
          density: game.settings.get(ID, 'density'),
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
          assert.strictEqual(now, S.board.sounds.find((s) => s.playing)?.name);
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

        it('a one-shot pressed twice overlaps itself, touches no document, and announces no state', async () => {
          const { shots } = S.sandbox;
          const src = shots.sounds.contents[0].path;
          const playingOf = () =>
            [...game.audio.playing.values()].filter((s) => decodeURIComponent(s.src ?? '').endsWith(src) && s.playing);
          const pad = () => bank(shots).querySelector('.sd-pad');
          pad().click();
          await wait(700);
          pad().click();
          await until(() => playingOf().length >= 2, 6000);
          S.shots.push(...playingOf());
          assert.isAtLeast(playingOf().length, 2);
          assert.isFalse(shots.playing || shots.sounds.some((s) => s.playing));
          assert.isFalse(pad().hasAttribute('aria-pressed'));
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
          await until(() => bedSound()?.sound?.playing, 10000);
          await wait(3500); // past the bed's own fade-in
          S.full = gain();
          cuePad(0).click();
          await until(() => row() && cue(0).sound?.playing, 10000);
          await wait(1500);
          const ratio = gain() / S.full;
          assert.isAbove(ratio, 0.22, `ratio ${ratio}`);
          assert.isBelow(ratio, 0.42, `ratio ${ratio}`);
          assert.exists(row()?.querySelector('[data-action=cuePause]'));
        });

        it('pause keeps the cue on the transport and brings the bed back up', async () => {
          row().querySelector('[data-action=cuePause]').click();
          await until(() => !cue(0).playing && row()?.querySelector('[data-action=cueResume]'));
          await wait(2600);
          assert.isTrue(row()?.classList.contains('is-paused'));
          assert.isAbove(gain() / S.full, 0.9);
        });

        it('resume ducks again; seek jumps to the chosen position', async () => {
          row().querySelector('[data-action=cueResume]').click();
          await until(() => cue(0).sound?.playing, 8000);
          await wait(1500);
          assert.isBelow(gain() / S.full, 0.42);
          const range = row().querySelector('input[type=range]');
          range.value = '30';
          range.dispatchEvent(new Event('change'));
          await wait(2500);
          const at = cue(0).sound?.currentTime ?? 0;
          assert.isAtLeast(at, 29);
          assert.isAtMost(at, 36);
        });

        it('stop removes the cue from the transport and the bed returns to full', async () => {
          row().querySelector('[data-action=cueStop]').click();
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
