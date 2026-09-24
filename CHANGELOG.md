# Changelog

Versions follow semver **without pre-release labels** - Foundry's `isNewerVersion` does not understand them
([Package Best Practices Checklist](https://foundryvtt.wiki/en/development/guides/package-best-practices)).

## 0.2.0 - unreleased

- **The board**: every playlist whose name starts with an emoji is a bank of pads, beside the beds. What a pad does
  comes from the playlist's own core mode:
  - **Soundboard Only → one-shot**, through `AudioHelper` to every client; the same pad pressed twice overlaps
    itself (decision 0003). The playlist document is not touched.
  - **Simultaneous → toggle** (room loops): each pad on or off, the others keep playing; `aria-pressed` says which.
  - **Sequential → cue**: starts or stops the sound. Its transport and the ducking of the bed come in 0.3.
  - **Shuffle → nothing**: the bank is drawn disabled, with a line saying which modes work.
- **Layout switch** in the window's menu: board beside or below the beds. The flex direction changes; the markup
  order never does, so the keyboard meets the parts in the order the eye does.
- **The window remembers its size and place** between sessions (client setting, per seat).
- `tools/live-proof.mjs` covers all of it: 19 checks, with sandbox banks created and deleted.

## 0.1.0

- **Bed cards**: one card per numbered playlist, in key order, with play, next track and stop. A bed is exclusive -
  starting one stops the other. Each card shows the documents' state, so a stop from the sidebar shows at once.
- **A bed survives a move between two scenes that share it.** Foundry 14.368 restarts it on a new track; the fix
  installs only while Foundry's defect is present.
- **The window keeps its size** across re-renders (a fixed default height; `auto` discards every resize).
- A **Sounds Deck** button in the playlists sidebar header.
- `tools/live-proof.mjs`: the module proven inside a running world without installing it - 15 checks.
- The spec's five open questions answered by measurement; one-shots will play through `AudioHelper` (decision 0003).
- **`npm run check` is the definition of done**: Biome, tests, then the manifest (version, changelog, files, languages).
- **Quench batch** `sounds-deck.foundry-facts`: those answers as 8 tests run inside Foundry (`tools/quench-run.mjs`).

## 0.0.1


- Skeleton: manifest, the pure core (`classify`, `decideSceneBed`), Node tests, Biome.
