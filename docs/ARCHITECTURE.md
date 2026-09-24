# Architecture

## A pure core, a thin shell

```
src/
  core/             PURE. No Foundry global is reachable here - biome.json forbids game, foundry, CONFIG,
                    CONST, Hooks, ui and canvas in this folder, and the build fails if one appears.
    classify.mjs    name + mode -> bed | bank (+ what a press does) | not on the deck
    scene-bed.mjs   bed of the scene left + bed of the scene entered -> none | keep | start | stop | switch
    beds.mjs        playlist snapshots -> the bed cards to draw, and which beds a start must stop
  sounds-deck.mjs   THE SHELL's entry point: wiring only
  foundry/          the rest of the shell
    setup.mjs       what happens at init and ready, as functions the live proof can call too
    deck-app.mjs    the window (ApplicationV2 + HandlebarsApplicationMixin)
    scene-bed-fix.mjs  replaces Foundry's scene -> playlist handover while Foundry's defect is present
tools/
  cdp.mjs           the connection to the gamemaster session, and the one-key audio unlock
  live-proof.mjs    the module, proven inside a running world without installing it
  quench-run.mjs    runs the Quench batches in the live world and prints the results
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
| live | `tools/live-proof.mjs` | by hand, world quiet | the window, the buttons, the scene fix, walked in the real world - 15 checks |
| Foundry's behaviour | Quench batch `sounds-deck.foundry-facts` (`test/quench/`) | `node tools/quench-run.mjs`, or Quench's own window | the facts the design relies on - polyphony, loop toggle, fade on stop, player rights, window size - 8 tests, red if a Foundry release changes one |

## Definition of done

**`npm run check` passes.** It is Biome, then every Node test, then the manifest rules, and it stops at the first
failure. A pull request is merged only on a green run. **A release additionally needs** the live proof
(`tools/live-proof.mjs`) and the Quench batch (`tools/quench-run.mjs`) green in the world, because those need a running
Foundry and cannot run on every change.
