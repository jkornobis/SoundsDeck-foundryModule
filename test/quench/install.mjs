/**
 * Quench batch: did FOUNDRY load the module - not the live-proof harness?
 *
 * Everything before the first release was proven by loading src/ into a running page as blob modules. That bypasses
 * exactly what an install exercises: the manifest, Foundry's own load order (init, then ready), template paths under
 * modules/sounds-deck/, the language files, the stylesheet, settings registered at init. This batch checks each of
 * those, and only means something when the module was INSTALLED - it says so and stops otherwise.
 *
 * Auditorium on v0.4, note 1 (QA Engineer), 2026-09-24.
 */
const ID = 'sounds-deck';

export function registerInstall(quench) {
  quench.registerBatch(
    'sounds-deck.install',
    (context) => {
      const { describe, it, assert, before } = context;
      let mod;

      before(function () {
        mod = game.modules.get(ID);
        if (!mod?.active) this.skip(); // loaded by a harness, not installed: nothing here applies
      });

      describe('what Foundry loaded', () => {
        it('the module is active, at the version its manifest declares', () => {
          assert.isTrue(mod.active);
          assert.match(mod.version, /^\d+\.\d+\.\d+$/);
        });

        it('init ran: both client settings are registered', () => {
          for (const key of ['layout', 'geometry']) assert.isTrue(game.settings.settings.has(`${ID}.${key}`), key);
        });

        it('ready ran: the api is published', () => {
          assert.isFunction(mod.api?.open);
          assert.exists(mod.api?.ducking, 'ducking not installed');
          if (game.user.isGM) assert.exists(mod.api?.sceneFix, 'scene fix not attempted');
        });

        it('both templates are served from modules/sounds-deck/', async () => {
          for (const t of ['beds', 'board']) {
            const res = await fetch(`modules/${ID}/templates/${t}.hbs`, { method: 'HEAD' });
            assert.strictEqual(res.status, 200, t);
          }
        });

        it('the stylesheet is linked into the page', () => {
          const linked = [...document.styleSheets].some((s) =>
            s.href?.includes(`modules/${ID}/styles/sounds-deck.css`),
          );
          assert.isTrue(linked);
        });

        it("the table's language has every string the deck uses", () => {
          for (const key of ['Title', 'Open', 'Play', 'Skip', 'Stop', 'Board', 'Layout', 'NoBanks', 'Pause', 'Ducks']) {
            assert.isTrue(game.i18n.has(`SOUNDS_DECK.${key}`), key);
          }
        });
      });

      describe('what the gamemaster sees', () => {
        it('the playlists sidebar carries the Sounds Deck button', async function () {
          if (!game.user.isGM) this.skip();
          await ui.playlists.render({ force: true });
          await new Promise((r) => setTimeout(r, 500));
          assert.exists(document.querySelector('#playlists [data-sounds-deck]'));
        });

        it('the deck opens and draws a card per numbered playlist', async function () {
          if (!game.user.isGM) this.skip();
          const app = mod.api.open();
          for (let i = 0; i < 30 && !app.rendered; i++) await new Promise((r) => setTimeout(r, 200));
          const beds = game.playlists.filter((p) => /^\d+\s*·\s/.test(p.name)).length;
          const cards = app.element.querySelectorAll('.sd-bed').length;
          await app.close();
          assert.strictEqual(cards, beds);
        });
      });
    },
    { displayName: 'Sounds Deck: installed and loaded by Foundry' },
  );
}
