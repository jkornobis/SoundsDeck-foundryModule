# Architecture

## A pure core, a thin shell

```
src/
  core/             PURE. No Foundry global is reachable here - biome.json forbids game, foundry, CONFIG,
                    CONST, Hooks, ui and canvas in this folder, and the build fails if one appears.
    classify.mjs    name + mode -> bed | bank (+ what a press does) | not on the deck
    scene-bed.mjs   bed of the scene left + bed of the scene entered -> none | keep | start | stop | switch
  sounds-deck.mjs   THE SHELL's entry point. Reads Foundry, calls the core, acts on the verdict.
  foundry/          (v0.1) the rest of the shell: hooks, the window, settings
test/
  core/             node:test - runs anywhere, in milliseconds, on every change
  quench/           (note 4) tests that need a live Foundry, run inside it with Quench
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
| integration | Quench, inside Foundry | (note 4) | what only a live Foundry can answer - the five open probes in the spec first |
