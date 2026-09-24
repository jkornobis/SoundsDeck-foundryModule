# 0003 - One-shots play through AudioHelper; the playlist stays the store

**Date:** 2026-09-24 · **Status:** ⚠️ superseded by [0005](0005-a-second-click-stops.md) (a second click stops; one-shots are PlaylistSounds again). Was: accepted on measurement (`tools/probe-foundry.mjs`, question 1 - that script is now the Quench batch `test/quench/foundry-facts.mjs`, "polyphony").

**Context.** The spec's first open question: can the same sound overlap itself? A gunshot pressed twice must fire
twice. If a `PlaylistSound` could not, the claim *"a bank is a playlist"* would weaken.

**Measured on 14.368.** A `PlaylistSound` holds **one** `Sound`: pressed again while playing, it neither restarts nor
overlaps (the same object, its clock still running: 0.28 s → 1.58 s). `AudioHelper.play` called twice gives **two**
`Sound` objects, both playing, 2.5 s apart. Its source: `play(data, socketOptions)` emits `playAudio` to other clients
when `socketOptions` is truthy, then plays locally.

**Decision.** A one-shot pad reads its `PlaylistSound` as DATA - path, volume - and plays it with
`AudioHelper.play({ src, volume, channel: 'environment' }, true)`. **The playlist is still the only store**: nothing
is copied, the pad exists because the sound exists, and editing it in the sidebar changes the pad.

**What it costs.** A one-shot is not a document state, so a pad cannot stay lit from Foundry's data the way a bed
card does. It flashes on press. A player joining mid-shot does not hear it - correct for a one-shot.

**Rejected.** Toggling the `PlaylistSound` off and on to retrigger. It restarts from the top instead of overlapping,
and each press writes the world twice and broadcasts both writes.
