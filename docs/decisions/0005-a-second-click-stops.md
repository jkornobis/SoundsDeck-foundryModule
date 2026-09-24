# 0005 - Every pad: a click plays, the next click stops

**Date:** 2026-09-24 · **Status:** accepted - the Composer, after first use of 0.4: *"Click again on card effect or event
stop it."* · **Supersedes** the overlap half of [0003](0003-one-shots-play-through-audiohelper.md).

**Context.** 0003 played one-shots through `AudioHelper`, because a `PlaylistSound` cannot overlap itself and a gunshot
pressed twice was meant to fire twice. At the table he wanted the opposite: a second click that **stops** the sound.

**Decision.** A one-shot is a `PlaylistSound` in its Soundboard Only playlist like every other pad: `playSound` on the
first click, `stopSound` on the next. The pad lights while it plays and carries `aria-pressed`.

**What it gains.** A stop reaches **every player**: the playing state is the document's, broadcast by Foundry. A sound
started through `AudioHelper` can be stopped only in the browser that holds it - so a stop from the deck would have
silenced the GM and left the table hearing it.

**What it costs.** A pad no longer overlaps itself. Repetition moved to where he asked for it: the 🎲 on a one-shot's
strip fires it at random moments (0.5).

**Rejected.** Keeping AudioHelper and stopping locally: the table would go on hearing what the GM had stopped.
