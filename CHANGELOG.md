# Changelog

Versions follow semver **without pre-release labels** - Foundry's `isNewerVersion` does not understand them
([Package Best Practices Checklist](https://foundryvtt.wiki/en/development/guides/package-best-practices)).

## 0.5.2 - 2026-09-24

- **Bigger pads, more room between them, and columns that stop growing**: a pad column is at most 13rem wide, so a
  wide window shows more pads per row instead of stretching each one; pads and bed cards are taller, and banks and
  cards sit further apart. Compact keeps the small size.
- The deck test compares a bed card's playing track with what the deck shows (the name without its source), not the
  full name - it failed against 0.5.1 once the world's names carried their sources.

## 0.5.1 - 2026-09-24

- **Sources stay in Foundry's playlist panel** (world setting, on by default): a sound's source written in parentheses
  at the end of its name - `At Risk (Gone Girl)` - and its description are not shown on the deck, which shows
  `At Risk`. The filter still searches the whole name.
- **The README is written for any world**, not the one the deck was built in: install, the two conventions with neutral
  examples, what the deck does. The "?" help uses the same neutral examples.
- `module.json` declares `verified: 14.368`, where every release so far was tested.
- The deck's Quench batch skips, and says why, in a world without the playlists and scenes it walks.

## 0.5.0 - 2026-09-24

**After the Composer's first use of 0.4** (2026-09-24):

- **Now playing**, above the beds: every sound on the deck that is playing (or an event paused), each with its volume
  slider and a stop; events keep pause and position there; one button stops everything. It replaces the transport that
  sat below the board, out of sight.
- **The beds are one column** of fixed width; the board takes the rest.
- **Every card has a structure**: its body on the left, its actions stacked on a strip at the right edge.
- **No text leaves its card**: two lines at most, then an ellipsis; the full name in the tooltip.
- **A click plays, the next click stops** - every pad, one-shots included (decision 0005). A stop reaches every player.
- **🎲 random triggering** on a one-shot's strip: armed, it fires at random moments (10-45 s by default,
  `flags["sounds-deck"].random = { min, max }` on the sound), listed in Now playing until disarmed.


- **Pad size, per seat**: comfortable or compact, from the window's menu - compact fits both real banks without scrolling.
- **Where a sound comes from, on hover**: a pad shows its sound's description (Foundry's own field), a bed card its
  playing track's.
- **An optional press log**, off by default, per seat (module settings): each press with its time, exported from
  the deck's menu with a most-used summary - for choosing the next version from what a session actually used.
- **A "?" in the window menu** explains the two rules (name and mode), the scenes, and the hover.
- **Accessibility**: a visible focus ring on every button; a screen reader hears an event start, pause and stop.
- **A filter box on the board**: type part of a pad's or a bank's name; case and accents do not matter.
- **The scene fix fails safe**: if it ever throws, Foundry's own method handles that scene change.
- Tests: an install check that runs once the module is really installed (its stylesheet check corrected on the first
  real install: Foundry 14 @imports module styles into the `modules` layer, it adds no <link>); ducking measured in a player's browser.

## 0.4.0 - 2026-09-24 - first release

- **Manual music survives a scene change** (his rule): a bed you picked by hand plays on into a scene with no music of
  its own; a scene that brings its own bed takes over and stops the rest. Stateless - a playing bed that is not the
  previous scene's own was picked by hand, from anywhere - so there is no flag to go stale.
- **A ducking switch on every event pad**: the music drops under the event, or stays at full. Stored on the sound
  itself (`flags["sounds-deck"].duck`), so it survives and every seat sees it.
- `tools/live-proof.mjs`: 31 checks.

## 0.3.0

- **Events have a transport**: every cue playing or paused part-way gets a row under the board - pause, resume, stop,
  and a position slider that seeks. Pause, resume and stop do exactly what Foundry's own playlist sidebar does.
- **Ducking, on every event** (his ruling): while a cue plays, the bed sits 10 dB lower (x0.316) and fades back by
  itself when no cue is left. A cue opts out with `flags["sounds-deck"].duck = false` on its sound.
  **Done locally by every client, never written to the world** - a failure mid-cue cannot leave the table quiet.
- `tools/live-proof.mjs`: 26 checks, including the bed's measured gain before, during and after a cue.

## 0.2.0

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

## 0.1.0 - not released (folded into 0.4.0)

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
