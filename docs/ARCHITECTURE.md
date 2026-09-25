# Architecture

## A pure core, a thin shell

```
src/
  core/             PURE. No Foundry global is reachable here - biome.json forbids game, foundry, CONFIG,
                    CONST, Hooks, ui and canvas in this folder, and the build fails if one appears.
    classify.mjs    name + mode -> bed | bank (+ what a press does) | not on the deck
    scene-bed.mjs   bed of the scene left + bed of the scene entered -> none | keep | start | stop | switch
    beds.mjs        playlist snapshots -> the bed cards to draw, and which beds a start must stop
    moods.mjs       a saved mix: capture what plays, and the plan that brings it back (what to stop, start, set, arm)
    theme.mjs       the accent a seat chose, the text colour readable on it, and where a ripple starts
    late-join.mjs   when a start is recorded, and where a browser that joined later comes in
  sounds-deck.mjs   THE SHELL's entry point: wiring only
  foundry/          the rest of the shell
    setup.mjs       what happens at init and ready, as functions the live proof can call too
    deck-app.mjs    the window (ApplicationV2 + HandlebarsApplicationMixin)
    scene-bed-fix.mjs  replaces Foundry's scene -> playlist handover while Foundry's defect is present
    silent-start-fix.mjs  delays Foundry's stop-on-start while its defect is present, so a sound is never left silent (#37)
    crossfade.mjs   a bed switch: the new bed first, the old once it is heard, both fading over the deck's crossfade
    mood-recall.mjs  carries a mood's plan out - the same for a mood card and for a scene
    actions.mjs     what a press does - the window, the shortcuts, the knobs and a hotbar pad all call these
    keys.mjs        the keyboard shortcuts, the Stream Deck + knobs on F13-F24 (registered in init only)
    hotbar.mjs      a pad dropped on the hotbar becomes a macro that presses it
    trim.mjs        a sound's Start and End: Sound#play given Foundry's own loopStart/loopEnd, on every client
    look.mjs        a pad's colour and icon fields in its sound's settings (banks only)
    private.mjs     a pad sent to chosen players only, over Foundry's own playAudio event, and quietly to the GM
    scene-mood.mjs  a scene's Mood field, and its recall when the scene opens, wrapped around the scene handover
    preview.mjs     the GM's-ear preview: a pad played in this browser only
    theme.mjs       the accent on the window, and the ripple, drawn on the window so a re-render cannot cut it
    late-join.mjs   marks each start, catches a late browser up, and loads a bed's next track as the current starts
tools/
  cdp.mjs           the connection to the gamemaster session, and the one-key audio unlock
  live-proof.mjs    --show: a screenshot of the deck, without installing it (its checks moved to Quench)
  quench-run.mjs    runs the Quench batches in the live world and prints the results; --coverage, how much of src/ ran
  coverage.mjs      Chrome's block counts turned into line coverage, for the code only the live world can run
  player-proof.mjs  ducking measured in a PLAYER's browser: a second, isolated session joins as the test seat
  check-manifest.mjs  the manifest rules of `npm run check`
  build-release.mjs   dist/module.json + dist/module.zip for one tag, addresses pinned to it
.github/workflows/
  release.yml       on the GitHub mirror only: check, build, publish a v* tag
test/
  core/             node:test - runs anywhere, in milliseconds, on every change
  quench/           Quench batches: tests that need a live Foundry. Shipped, but imported only when Quench is active
lang/               en.json, fr.json - no wording typed into the code
styles/  templates/
```

**Why:** every decision the deck makes - is this a bed, does this press toggle, should the bed survive this scene
change - can then be tested without Foundry, in milliseconds, on every change. The part that cannot be tested that
way is kept small on purpose. This is how the opposed-test macro in the knowledge repository was built (a pure
resolver plus a thin macro, 317 checks), and it is what made those checks possible.

**The one piece of Foundry the core must know** is the numbering of the playlist modes. It keeps its own copy
(`MODES`) and the shell compares it with `CONST.PLAYLIST_MODES` at start-up, loudly, so a renumbering in a
future Foundry release cannot silently turn every toggle into a one-shot.

## What proves a change

| Level | Tool | Runs | Proves |
|---|---|---|---|
| lint + format | Biome 2.5.14, pinned | `npm run check` | style, likely bugs, and the purity of `src/core` |
| unit | `node --test` | `npm run check` | every rule in the core, with the real world's playlist names as fixtures - 100% of its lines and branches (`node --test --experimental-test-coverage --test-coverage-include='src/**' "test/**/*.test.mjs"`) |
| manifest | `tools/check-manifest.mjs` | `npm run check` | id; a version without a label and newer than the last tag; a changelog heading for it; compatibility; every file the manifest names exists; every language has the same keys |
| the deck | Quench batch `sounds-deck.deck` (`test/quench/deck.mjs`) | `node tools/quench-run.mjs deck`, world quiet | the window, every button, ducking, the scene fix and its fail-safe, walked in the real world - 75 tests |
| the look | `tools/live-proof.mjs --show x.png [--lit] [--accent red\|#hex]` | by hand, nobody connected | a screenshot of the working copy for the Composer to judge; a look is his call, not a test's |
| shell coverage | `tools/quench-run.mjs --src --coverage` | by hand, world quiet | which lines of `src/foundry` the live batches ran, from Chrome's own counts - see *What the tests do not reach* |
| player side | `tools/player-proof.mjs` | by hand, world quiet | what a player's browser does: the bed ducked 10 dB under a GM's event, and back; a private sound heard by the seat alone, quietly by the GM; a late joiner coming in where the gamemaster hears the bed - 9 checks |
| Foundry's behaviour | Quench batch `sounds-deck.foundry-facts` (`test/quench/`) | `node tools/quench-run.mjs`, or Quench's own window | the facts the design relies on - polyphony, loop toggle, fade on stop, player rights, window size - 8 tests, red if a Foundry release changes one |

### What the tests do not reach

Measured 2026-09-25 with `tools/quench-run.mjs --src --coverage`, every batch: 83 tests, **93% of the lines of
`src/foundry`** (1213 of 1301). The unit tests cover `src/core` whole. What the live batches leave, and why:

| Lines | Why no batch runs them | Covered instead by |
|---|---|---|
| `keys.mjs` - registering the shortcuts | Foundry accepts shortcuts only during init; the harness loads the working copy after it | the install batch: every shortcut, F13-F24 included, registered by the installed release |
| `private.mjs` sending, and the 👤 dialog in `deck-app.mjs` | they need a connected player, and the batches refuse to run with one | `tools/player-proof.mjs` sends through `private.mjs` to the test seat. **The dialog itself - ticking a player and pressing Send - is tested nowhere** |
| `setup.mjs` - Shift+D, and making the sidebar button | reached by the shortcut and the sidebar render of the installed release | the sidebar test checks the button is there |
| `trim.mjs` - ending a streamed file at its trim | it needs a file over 10 minutes, which the sandbox does not have | nothing yet |
| `ducking.mjs` - ducking a sound that is still loading | a timing window the tests do not aim at | nothing yet |
| every `catch` that keeps Foundry's own behaviour after a fault | they run only when something breaks | the scene fix's fail-safe has its own test; the others are read, not run |

## Definition of done

**Release rule (decision 0004):** a new version waits for the previous one to have been used at the table - waived by
the Composer for 0.5, whose content came from his own use of 0.4, and for 0.6 (2026-09-24), so the #37 silence fix
reaches the table, and for 0.6.1 (2026-09-25), which completes his program, and for 0.6.2 (2026-09-25), private sounds, and for 0.6.3 (2026-09-25), the new look, and for 0.6.4 (2026-09-25), late joiners and the board tabs.

**`npm run check` passes.** It is Biome, then every Node test, then the manifest rules, and it stops at the first
failure. A pull request is merged only on a green run. **A release additionally needs** the live proof
(`tools/quench-run.mjs`: the deck, the Foundry facts and, once installed, the install check) and the player proof
(`tools/player-proof.mjs`) green in the world, because those need a running
Foundry and cannot run on every change.
