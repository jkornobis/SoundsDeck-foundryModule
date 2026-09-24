# Sounds Deck

A Foundry VTT module that plays **Foundry's own playlists** as a deck: numbered playlists become **bed cards**,
playlists whose name starts with an emoji become **banks of pads**. There is no second store. Every sound stays a
core `PlaylistSound`, editable in the sidebar with the module switched off.

**Status: 0.4.0.** Proven inside a running world (31 checks); not released yet.

![The deck, 0.5 (unreleased)](docs/screenshots/v0.5-deck.png)
 The design lives in the Composer's knowledge repository:
`FoundryVTT-KnowledgeDB/worlds/DeltaGreen/knowledge/the-playlist-is-the-bank.md`.

## The two rules

| The playlist's… | decides… | Example |
|---|---|---|
| **name** | whether and where it is on the deck | `5 · Wrong` → a bed card · `🎬 Long events` → a bank · `Références` → not on the deck |
| **core mode** | what pressing one of its sounds does | Soundboard Only → one-shot · Simultaneous → toggle · Sequential → cue with a transport |

## Develop

Node 22 or later. Three tools in all: Node's built-in test runner, Biome, and nothing else. No build step:
Foundry loads the ES modules in `src/` as they are.

```bash
npm install        # Biome only, pinned
npm test           # the pure core, outside Foundry
npm run check      # what must pass before anything is merged: biome ci + tests
npm run format     # rewrite formatting

node tools/quench-run.mjs              # every Quench batch in the live world (loads src/ if not installed)
node tools/player-proof.mjs            # ducking measured in a player's browser (a second session)
node tools/live-proof.mjs --show x.png # photograph the deck; plays nothing
```

These need the gamemaster session driven through Chrome's debugger on port 9222, and **refuse if anyone else is
connected or anything is playing** - they start beds and activate scenes.

Structure and the reasons for it: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Decisions:
[`docs/decisions/`](docs/decisions/).

## Release

**This repository is the source; a public GitHub mirror is where Foundry downloads from.** Forgejo push-mirrors every
commit and tag to GitHub. A `v*` tag there runs `.github/workflows/release.yml`: `npm run check`, the tag must equal
`module.json`'s version, then `tools/build-release.mjs` publishes `module.json` and `module.zip` **at addresses pinned
to that tag** - no *latest* anywhere, so a world only changes version when someone installs a new one.

```bash
# bump module.json "version", give CHANGELOG.md its heading, merge, then:
git tag v0.1.0 && git push origin v0.1.0
# install in Foundry (Setup → Add-on Modules → Install Module → Manifest URL):
#   https://github.com/<owner>/<repo>/releases/download/v0.1.0/module.json
node tools/build-release.mjs <owner/repo> v0.1.0   # see locally exactly what would ship, in dist/
```

## Licence

Not chosen yet. That is the Composer's call.
