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
  sounds-deck.mjs   THE SHELL's entry point: wiring only
  foundry/          the rest of the shell
    setup.mjs       what happens at init and ready, as functions the live proof can call too
    deck-app.mjs    the window (ApplicationV2 + HandlebarsApplicationMixin)
    scene-bed-fix.mjs  replaces Foundry's scene -> playlist handover while Foundry's defect is present
    silent-start-fix.mjs  delays Foundry's stop-on-start while its defect is present, so a sound is never left silent (#37)
tools/
  cdp.mjs           the connection to the gamemaster session, and the one-key audio unlock
  live-proof.mjs    --show: a screenshot of the deck, without installing it (its checks moved to Quench)
  quench-run.mjs    runs the Quench batches in the live world and prints the results
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
| unit | `node --test` | `npm run check` | every rule in the core, with the real world's playlist names as fixtures |
| manifest | `tools/check-manifest.mjs` | `npm run check` | id; a version without a label and newer than the last tag; a changelog heading for it; compatibility; every file the manifest names exists; every language has the same keys |
| the deck | Quench batch `sounds-deck.deck` (`test/quench/deck.mjs`) | `node tools/quench-run.mjs deck`, world quiet | the window, every button, ducking, the scene fix and its fail-safe, walked in the real world - 20 tests |
| player side | `tools/player-proof.mjs` | by hand, world quiet | what a player's browser does: the bed ducked 10 dB under a GM's event, and back |
| Foundry's behaviour | Quench batch `sounds-deck.foundry-facts` (`test/quench/`) | `node tools/quench-run.mjs`, or Quench's own window | the facts the design relies on - polyphony, loop toggle, fade on stop, player rights, window size - 8 tests, red if a Foundry release changes one |

## Definition of done

**Release rule (decision 0004):** a new version waits for the previous one to have been used at the table - waived by
the Composer for 0.5, whose content came from his own use of 0.4.

**`npm run check` passes.** It is Biome, then every Node test, then the manifest rules, and it stops at the first
failure. A pull request is merged only on a green run. **A release additionally needs** the live proof
(`tools/quench-run.mjs`: the deck, the Foundry facts and, once installed, the install check) and the player proof
(`tools/player-proof.mjs`) green in the world, because those need a running
Foundry and cannot run on every change.
