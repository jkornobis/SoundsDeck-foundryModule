# Changelog

Versions follow semver **without pre-release labels** - Foundry's `isNewerVersion` does not understand them
([Package Best Practices Checklist](https://foundryvtt.wiki/en/development/guides/package-best-practices)).

## 0.6.8 - unreleased

- The same as 0.6.7, which was tagged but never published: its build failed on GitHub (a test loaded a
  library the build machine does not have). Fixed in the test tooling only; nothing changes at the table.

## 0.6.7 - 2026-09-26 (never published)

- **The four layer levels are vertical faders**, side by side like a mixing desk.
- **Fixes from use:** the Save button no longer spills out of the Moods header; the tabs lose colour that said
  nothing; the pads get more room; hovering lights the whole pad card and leaves its text alone; the box another
  module drew around each bank is gone.

## 0.6.6 - 2026-09-25

- **Variant pads** (next program, note 4): in a one-shot bank, *Gunshot 1*, *Gunshot 2*, *Gunshot 3* are one pad,
  *Gunshot ×3*; each press plays one of them, never the same twice in a row.
- **The deck's playlists hidden from players** (note 5): players' sidebar no longer names what plays; they still hear
  it all. A module setting, on by default.

- **Sounds on game events** (next program, note 2), for Delta Green: *Plays on* in a bank sound's settings - critical
  success, critical failure, Sanity loss, a weapon's damage or Lethality roll. Everyone hears it; a whispered or blind
  roll plays nothing; several pads on one event are a random pick; a weapon can have its own pad by name.

- **Combat music** (next program, note 1): choose a combat mood with ⚔ on a mood card. A fight's first round brings it;
  ending the fight brings back what played before, the music resuming where it left off, with the deck's crossfade.
  The ⚔ in the Moods header and Shift+F start or end it by hand; a *Follow the tracker* switch turns the automatic
  part off. What to bring back is kept across a reload.

- **Vertical layout**: Now playing, Moods and Music sit side by side, with the pads right under them - stacked, they
  pushed the pads out of sight and stretched the sliders across the window.
- **Accessibility**, from a UX/UI QA pass measured in both themes: 24 px targets for the track toggle and the tab
  ticks, a focus ring on the level sliders and the ticks, a readable search hint, and headings in order.

## 0.6.5 - 2026-09-25

- **A standard Stream Deck profile** (15 keys): beds, moods 1-4, Stop all and Open deck on page 1, the four layers'
  down, up and mute on page 2, with Next and Previous page keys - built from a second profile exported from the app.
- **A Stream Deck + profile, ready to import** (`streamdeck/`, and the README's Stream Deck section): beds, moods,
  Stop all, Open deck and tracks on three pages, and the four layer knobs on the dials. Built from a profile exported
  from a real Stream Deck + (app 7.6), key codes included.
- **Layout**: the board's tabs are proper tabs on an accent line, clear of the search box; a bank is a title with an
  accent line instead of a box; Moods, Music and Sounds Pad each have a title; buttons on the cards keep a margin
  from the edge.

- **Pick a track in a bed.** A ▸ beside a bed's name opens its tracks, numbered in the playlist's own order (by name,
  or as you arranged them - never the shuffle order, which changes each time a bed starts). A click plays that track;
  a bed that was not playing starts on it and crosses over from the one that was. **Ctrl+Alt+1…9** plays that
  track of the bed that plays - one Stream Deck button per track.

## 0.6.4 - 2026-09-25

- **Late joiners hear where the table is** (0.7 program, note 2): a player who joins or reloads while a bed, a room
  loop or an event plays hears it from where everyone else is, not from the start of the track. One-shots, over in
  seconds, start as usual. **A bed's next track is loaded as soon as the current one starts**, on every machine,
  instead of Foundry's 20 s before the end, so a track change or a skip does not wait on a slow connection.
- **The board as tabs**, replacing folding: a tab per bank; its name shows that bank alone (click it again for all),
  its tick adds or removes it so two or more show at once. Remembered on your seat. A search still looks in every bank.
- **Settings in the ⋮ menu** of the deck, opening Foundry's settings on the Sounds Deck section.
- **The accent colour reaches everything**: a button's hover, focus and pressed states and a dragged card now follow
  it too, where Foundry's own theme colour showed through.

## 0.6.3 - 2026-09-25

- **A new look.** The deck is frosted glass over the scene, and follows Foundry's light and dark themes. Cards are
  lighter panes with a bright top edge, and a playing card glows in the accent colour. **Accent colour**, in the
  module settings, on this computer only: Foundry's own, one of the six pad colours, or any colour you pick; text on
  it stays readable. Pressing a pad, a bed or a mood sends a **ripple** from where you clicked. A key, a Stream Deck
  button or the hotbar ripples from the card's centre. No ripple when the system asks for less motion, and a solid
  window when it asks for less transparency.

- **Quality pass**, nothing you can hear: the event transport's old stop handler, unused since 0.5, is removed; a
  trimmed sound whose end cannot be scheduled now says so in the console instead of failing in silence. New tests
  cover the core's last untested branches, a preview replaced while it loads or ending by itself, the press-log
  export, and a scene's mood on Foundry's own scene handover; `tools/quench-run.mjs --coverage` measures how much of
  the Foundry layer the live tests run.

## 0.6.2 - 2026-09-25

- **A sound for chosen players only** (0.7 program, note 1): the 👤 on a pad lists the players who are connected;
  tick who hears it, and it plays once on their machines only, at the level the table would hear it, and quietly
  (0.4) in yours. Through Foundry's own private-sound route: once sent, it cannot be stopped or looped.
- **French: beds are "Musiques"** (#45). Beds and moods were both "Ambiances"; moods keep the name, and the room loops
  are "boucles de fond".

## 0.6.1 - 2026-09-25

- **Organising the board** (theme 9): a pad can have a colour (one of six from Foundry's own theme) and an icon, set
  in its sound's settings; a coloured pad keeps its text readable in both themes. A bank folds and unfolds from its
  title, remembered on your seat, and a search still finds pads inside a folded bank.
- **Transport for beds** (theme 8): a pressed bed or pad pulses until it is actually heard, so a large track
  loading no longer looks like a press that was ignored (a still outline instead, when the system asks for less
  motion). A playing bed names the track that comes next, from the playlist's own order, and shows its elapsed and
  total time with a thin progress line.
- **Trim a track** (theme 7): *Start* and *End*, in seconds, in a sound's own settings under *Fade*. The track
  plays from its start and ends at its end, so a shuffle bed moves on; a track that does not repeat fades out before
  its end over its own fade, and a repeating sound repeats the trimmed part. Precise for files up to 10 minutes,
  which Foundry loads whole; a longer, streamed file is ended at its trim by the gamemaster's browser.
- **Keyboard shortcuts, the Stream Deck + knobs, and pads on the hotbar** (theme 6). Shift+D opens or closes the
  deck, Shift+X stops everything, Shift+1…8 plays the bed with that number, Ctrl+Shift+1…9 recalls the mood at that
  place. The four knobs of a Stream Deck + drive the four levels on F13-F24: turn for ±5% on the slider, press to mute
  that layer for everyone and press again to bring it back. A pad dragged onto Foundry's hotbar becomes a button that
  presses it. Every shortcut can be rebound in Configure Controls.
- **A scene brings back a mood** (note 5): a *Mood* field in a scene's settings, under its playlist. When the scene
  opens, the mood is recalled exactly as its card does (music, loops, random effects), its bed crossing over from the
  one playing. The mood wins over the scene's own playlist. A scene with no mood behaves as before.
- **One crossfade between beds** (note 4): switching beds, from a card or a mood that brings another bed, starts
  the new bed first and stops the old one only once the new one is heard, so the music no longer drops out while a
  large track loads. Both fade over one duration, a world setting (*Crossfade between beds*, 4 s by default), in
  every browser. Outside a switch every track keeps its own fade.
- **Preview in your ear** (note 3): the 🎧 on a pad plays it in your browser only, at the level the table would
  hear, before you play it for everyone. Nothing is sent to the players and the music does not duck. One preview at
  a time: another pad replaces it, the same one again stops it, and it stops by itself after 20 s.
- `docs/field-study.md` part 2: what users ask Foundry audio modules for, counted across nine trackers.

## 0.6.0 - 2026-09-24

**The Auditorium on 0.5.2** (2026-09-24) ranked five Musts from a study of six tabletop audio tools
(`docs/field-study.md`). This version carries them.

- **Moods**: save what plays (the bed, the room loops with their levels, the one-shots armed at random) under a
  name, and recall it in one click. A recall keeps a bed that is already playing on the same track, and never touches
  an event. Moods are world data (setting `moods`), so every gamemaster seat has them. A mood whose sounds were
  deleted recalls what remains and says how much was skipped.
- **Layer levels**: four sliders under Now playing (Music, Loops, Events, Effects) set the level of every sound of
  that kind at once, on every browser, without rewriting any sound's own volume. They multiply with ducking: music at
  half, under an event, sits near 0.16 of its volume. The levels are world data (setting `levels`).
- **A sound stopped before it starts no longer goes silent until reload** (#37). Foundry 14.368 left such a sound
  marked playing but disconnected, so pressing it again played nothing; music was hit hardest after a quick switch.
  This happens on every browser, players' included. The fix steps aside by itself once Foundry's own line changes.
- `docs/field-study.md`: what six tabletop audio tools offer that the deck does not.

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
