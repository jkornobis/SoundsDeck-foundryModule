# Changelog

Versions follow semver **without pre-release labels** - Foundry's `isNewerVersion` does not understand them
([Package Best Practices Checklist](https://foundryvtt.wiki/en/development/guides/package-best-practices)).

## 0.1.0 - unreleased

- **Bed cards**: one card per numbered playlist, in key order, with play, next track and stop. A bed is exclusive -
  starting one stops the other. Each card shows the documents' state, so a stop from the sidebar shows at once.
- **A bed survives a move between two scenes that share it.** Foundry 14.368 restarts it on a new track; the fix
  installs only while Foundry's defect is present.
- **The window keeps its size** across re-renders (a fixed default height; `auto` discards every resize).
- A **Sounds Deck** button in the playlists sidebar header.
- `tools/live-proof.mjs`: the module proven inside a running world without installing it - 15 checks.

## 0.0.1


- Skeleton: manifest, the pure core (`classify`, `decideSceneBed`), Node tests, Biome.
