# 0006 - Moods are a world setting that points at playlist sounds

**Date:** 2026-09-24 · **Status:** accepted - built for note 1 of the Auditorium on 0.5.2 (*"Program: 1, 2, 3, 4, 5"*).

**Context.** A mood saves a mix: the bed playing, the room loops switched on with their levels, and the one-shots armed
at random. Foundry has no document for a mix. The deck's first design rule is that **everything stays in Foundry's own
music management**: every sound is a core `PlaylistSound`, and switching the module off leaves the playlists
untouched.

**Decision.** A mood is a small record in the world setting `sounds-deck.moods` that **points** at playlists and
sounds by id. It copies no audio and no playlist. A recall carries the mood out with the same calls the deck's buttons
make: `playAll`, `stopSound`, `update({ volume, playing })`, and the random scheduler.

**What it gains.**
- The first rule holds: the sounds stay core playlists, and a mood is only a set of pointers.
- World scope means a mood saved on one gamemaster seat is there on every other.
- Pointers survive renames. A deleted sound is skipped and counted (`missing`), never an error.

**What it costs.** With the module switched off, moods are invisible: a setting has no place in Foundry's own UI.
The playlists they point at are unaffected.

**Rejected.**
- **A mood as a playlist** (for example, a `🎭` bank whose sounds are copies). Copying sounds duplicates the library's
  entries, and a copy drifts from its original.
- **Moods as flags on a scene.** A mood is used without a scene change as often as with one. Note 5 (a scene recalls a
  mood) will put a pointer to a mood on the scene instead.
- **Saving events in a mood.** An event is a moment, not a place. A recall that restarted an event would replay a
  scream every time the room is set.
