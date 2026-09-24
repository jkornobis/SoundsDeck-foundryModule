/**
 * Quench batch: the facts about Foundry that the Sounds Deck design rests on.
 *
 * Each was first measured by tools/probe-foundry.mjs (2026-09-24, 14.368). Here they are Mocha tests that run
 * inside Foundry, from Quench's own window or from tools/quench-run.mjs - so a Foundry release that changes one of
 * them turns it red before a table finds out.
 *
 * SANDBOX: one playlist in the GE-Foundry folder, created in `before` and deleted in `after`. The Simultaneous and
 * Soundboard-only tests PLAY sounds, and a playlist's playing state is broadcast: run it with nobody connected.
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const audible = async (sounds, ms = 10000) => {
  for (let t = 0; t < ms && !sounds.every((s) => s.sound?.playing); t += 400) await wait(400);
  return sounds.every((s) => s.sound?.playing);
};

/** @param {object} quench  the Quench API object */
export function registerFoundryFacts(quench) {
  quench.registerBatch(
    'sounds-deck.foundry-facts',
    (context) => {
      const { describe, it, assert, before, after } = context;
      const M = CONST.PLAYLIST_MODES;
      let pl;

      before(async () => {
        const others = game.users.filter((u) => u.active && u.id !== game.user.id);
        if (others.length) throw new Error(`refusing to play sounds: connected ${others.map((u) => u.name)}`);
        if (game.audio.locked) throw new Error('audio is locked: interact with the page once, then run again');
        const folder = game.folders.find((f) => f.type === 'Playlist' && f.name === 'GE-Foundry');
        const fx = game.playlists.contents
          .flatMap((p) => p.sounds.contents)
          .filter((s) => s.path.startsWith('ge-foundry/fx/'))
          .slice(0, 3);
        pl = await Playlist.create({
          name: '__sounds-deck-quench',
          folder: folder?.id ?? null,
          mode: M.DISABLED,
          sounds: fx.map((s, i) => ({ name: `q${i}`, path: s.path, volume: 0.5, repeat: false, fade: 3000 })),
        });
      });

      after(async () => {
        await pl?.stopAll();
        await wait(500);
        await pl?.delete();
      });

      describe('polyphony', () => {
        it('a PlaylistSound pressed again neither restarts nor overlaps', async function () {
          this.timeout(20000);
          const a = pl.sounds.contents[0];
          await pl.playSound(a);
          assert.isTrue(await audible([a]), 'the sound never became audible');
          const first = a.sound;
          const t1 = first.currentTime;
          await pl.playSound(a);
          await wait(800);
          assert.strictEqual(a.sound, first, 'a second Sound object was created');
          assert.isAbove(a.sound.currentTime, t1, 'the sound restarted');
          await pl.stopSound(a);
          await wait(3500);
        });

        it('AudioHelper.play twice overlaps: two Sounds, both playing', async function () {
          this.timeout(15000);
          const src = pl.sounds.contents[0].path;
          const AH = foundry.audio.AudioHelper;
          const s1 = await AH.play({ src, volume: 0.3, channel: 'environment' }, false); // false = this client only
          await wait(600);
          const s2 = await AH.play({ src, volume: 0.3, channel: 'environment' }, false);
          await wait(600);
          try {
            assert.notStrictEqual(s1, s2);
            assert.isTrue(s1.playing && s2.playing, 'not both playing');
          } finally {
            s1?.stop();
            s2?.stop();
          }
        });
      });

      describe('room loops', () => {
        it('stopping one sound of a Simultaneous playlist leaves the others playing', async function () {
          this.timeout(25000);
          await pl.update({ mode: M.SIMULTANEOUS });
          await pl.playAll();
          const [a, b, c] = pl.sounds.contents;
          assert.isTrue(await audible([a, b, c]), 'not all three became audible');
          await pl.stopSound(b);
          await wait(1500);
          assert.deepEqual(
            pl.sounds.contents.map((s) => s.playing),
            [true, false, true],
          );
          assert.isTrue(a.sound.playing && c.sound.playing, 'the others went silent');
          assert.isTrue(pl.playing, 'the playlist stopped');
          await pl.stopAll();
          await wait(3500);
          await pl.update({ mode: M.DISABLED });
        });
      });

      describe('fade', () => {
        it('a stopped sound fades out over its fade, and reports not-playing at once', async function () {
          this.timeout(20000);
          const c = pl.sounds.contents[2];
          await pl.playSound(c);
          assert.isTrue(await audible([c]));
          await wait(3500);
          const v0 = c.sound.volume;
          await pl.stopSound(c);
          await wait(1000);
          const v1 = c.sound.volume;
          assert.isBelow(v1, v0, 'no fade on the way out');
          assert.isAbove(v1, 0, 'cut, not faded');
          assert.isFalse(c.sound.playing, 'playing stays true during the fade');
          await wait(2500);
          assert.strictEqual(c.sound.volume, 0);
        });
      });

      describe('permissions', () => {
        it('by default a player may not change a playlist or its sounds', () => {
          const player = game.users.find((u) => !u.isGM);
          assert.exists(player, 'no player user in this world');
          assert.strictEqual(pl.ownership.default, 0);
          assert.isFalse(pl.canUserModify(player, 'update'));
          assert.isFalse(pl.sounds.contents[0].canUserModify(player, 'update'));
        });
      });

      describe('windows', () => {
        const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
        Handlebars.registerPartial('sd-quench.hbs', Handlebars.compile('<section><p>probe</p></section>'));
        const probe = (height) =>
          class extends HandlebarsApplicationMixin(ApplicationV2) {
            static DEFAULT_OPTIONS = {
              id: `sd-quench-${height}`,
              window: { title: 'probe', resizable: true },
              position: { width: 300, height },
            };
            static PARTS = { p: { template: 'sd-quench.hbs' } };
          };

        it("a default height of 'auto' discards a resize on the next render", async () => {
          const app = new (probe('auto'))();
          await app.render({ force: true });
          app.setPosition({ width: 640, height: 420 });
          await app.render({ parts: ['p'] });
          const h = Math.round(app.element.getBoundingClientRect().height);
          await app.close();
          assert.notStrictEqual(h, 420);
        });

        it('a numeric default height keeps a resize across renders', async () => {
          const app = new (probe(300))();
          await app.render({ force: true });
          app.setPosition({ width: 640, height: 420 });
          await app.render({ parts: ['p'] });
          await app.render();
          const h = Math.round(app.element.getBoundingClientRect().height);
          await app.close();
          assert.strictEqual(h, 420);
        });

        it('a window built with a saved position reopens at it', async () => {
          const Cls = probe(300);
          let app = new Cls();
          await app.render({ force: true });
          app.setPosition({ left: 200, top: 150, width: 640, height: 420 });
          const { left, top, width, height } = app.position;
          await app.close();
          app = new Cls({ position: { left, top, width, height } });
          await app.render({ force: true });
          const b = app.element.getBoundingClientRect();
          await app.close();
          assert.deepEqual([b.left, b.top, b.width, b.height].map(Math.round), [left, top, width, height]);
        });
      });
    },
    { displayName: 'Sounds Deck: what Foundry must keep doing' },
  );
}
