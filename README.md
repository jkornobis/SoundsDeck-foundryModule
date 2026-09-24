# Sounds Deck

**A deck over Foundry VTT's own playlists.** Music, looping ambience, sound effects and long event cues, played from
one window - with nothing stored anywhere but in the playlists you already have.

![Sounds Deck](docs/screenshots/v0.5-deck.png)

- **No second library.** Every sound stays a core `PlaylistSound`. Switch the module off and your playlists are exactly
  as they were, editable in the sidebar as always.
- **Two conventions decide everything**: a playlist's **name** puts it on the deck, its **mode** decides what a press
  does.
- **Built for the gamemaster at the table**: one click to change the music, one click to fire an effect, and the music
  steps aside by itself while an event plays.

**Foundry VTT 14** (verified on 14.368). Gamemaster only.

## Install

In Foundry: **Setup → Add-on Modules → Install Module**, and paste the manifest of the version you want:

```
https://github.com/jkornobis/SoundsDeck-foundryModule/releases/download/v0.5.2/module.json
```

Each release has its own fixed address, so a world changes version only when you install a new one. Enable the module
in your world, then open the deck from the **Sounds Deck** button at the top of the Playlists sidebar.

## Set up your playlists

**The name** places a playlist on the deck:

| Name starts with… | On the deck | Example |
|---|---|---|
| a **number and a dot** | a **music** card (one plays at a time) | `1 · Calm`, `2 · Tension`, `3 · Combat` |
| an **emoji** | a **bank of pads** | `💥 Effects`, `🔁 Ambience loops`, `🎬 Events` |
| anything else | not on the deck | `Soundtrack archive` |

**The mode** (Foundry's own playlist setting) decides what a pad in a bank does:

| Mode | A pad is… |
|---|---|
| **Soundboard Only** | a one-shot: click plays it, click again stops it |
| **Simultaneous** | a loop you switch on and off; the others keep playing |
| **Sequential** | an event: it gets pause, stop and a position slider, and the music drops under it |
| **Shuffle** | nothing - the bank is shown greyed |

A music card plays its playlist in whatever order the playlist is set to; **Shuffle** is the natural choice.

**A sound's source** - the film, series or game it comes from - can go in parentheses at the end of its name:
`At Risk (Gone Girl)`. Foundry's playlist sidebar shows the whole name; the deck shows `At Risk`, so the table sees the
moment and not the reference. Only the **last** parentheses are the source: `Ripe (With Decay) (The Fragile)`
shows `Ripe (With Decay)`. The same goes for a sound's *description*. It is a world setting, **Hide sources on the
deck**, on by default; turn it off to see both on the pads. The filter searches the whole name either way.

## What the deck does

- **Now playing**, at the top: everything sounding, each with its volume and a stop; events keep pause and position;
  one button stops it all.
- **Moods.** Save what plays (the music, the room loops and their levels, the random effects) under a name, and bring
  it all back in one click. A recall keeps music that is already playing and never touches an event. Moods belong to
  the world, so every gamemaster seat sees them.
- **Music follows the scene.** A scene that carries a playlist starts its music when it opens, and moving between two
  scenes that share the same playlist **keeps the track playing** (Foundry 14.368 alone restarts it on a new track).
  Music you picked by hand keeps playing into a scene that has none of its own.
- **Ducking.** While an event plays, the music drops about 10 dB and comes back by itself - in every player's browser.
  The small speaker on an event's pad turns this off for that event.
- **Random triggering.** The 🎲 on a one-shot's pad fires it at random moments (every 10–45 s) until you switch it off.
  Set your own interval per sound with the flag `flags["sounds-deck"].random = { min, max }` (seconds).
- **Where a sound comes from** stays in the playlist sidebar by default (see above); with *Hide sources on the deck*
  off, hovering a pad shows the sound's description.
- **Filter** the pads by typing part of a name; **beside or below** layout, **comfortable or compact** pads, and a
  **"?"** that explains all of this - from the window's menu.
- **Press log** (off by default, per browser, in the module settings): records what you pressed during a session, to
  export afterwards.

Available in English and French.

## Develop

Node 22 or later. Three tools in all: Node's built-in test runner, Biome, and nothing else. No build step: Foundry
loads the ES modules in `src/` as they are.

```bash
npm install        # Biome only, pinned
npm test           # the pure rules, outside Foundry
npm run check      # the definition of done: Biome, every test, the manifest rules
```

Tests that need a running Foundry are **Quench** batches in `test/quench/`, run from Quench's own window once the
module is installed. The deck batch walks a real world and names its playlists and scenes - in any other world it
skips and says why. The `tools/` scripts drive a gamemaster session through Chrome's debugger for the maintainers'
own proofs.

Structure and reasons: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Decisions: [`docs/decisions/`](docs/decisions/).
Changes: [`CHANGELOG.md`](CHANGELOG.md).

## Licence

Not chosen yet.
