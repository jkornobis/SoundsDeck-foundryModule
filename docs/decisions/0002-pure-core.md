# 0002 - Every decision lives in a pure core, enforced by the linter

**Date:** 2026-09-24 · **Status:** accepted - the Composer programmed it (Auditorium note 2).

**Decision.** `src/core/` holds only pure functions. Biome's `noRestrictedGlobals` forbids Foundry's globals there,
so the rule is checked by `npm run check`, not by review.

**Measured when adopted:** a line using `game` added to `src/core/scene-bed.mjs` fails lint; the same line in the
shell passes. Three deliberate breaks of the rules (the scene-change bug put back, the keycap rule removed, a
shuffle bank guessed as a one-shot) each turned tests red: 4, 1 and 2 failures of 27.

**Rejected.** A convention written in a README. A convention is checked by whoever remembers it; this repository
will be read by instances that do not remember anything.
