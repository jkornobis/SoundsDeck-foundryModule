# 0001 - The module has its own repository

**Date:** 2026-09-24 · **Status:** accepted - the Composer created the repository.

**Context.** The design and the measurements behind it live in `FoundryVTT-KnowledgeDB`, a repository of knowledge
about Foundry. A module is a product: it has versions, releases, an install link, its own issues and its own checks.

**Decision.** `SoundsDeck-foundryModule` holds the code, its tests and its releases. What the module teaches about
Foundry still goes back to the knowledge repository as pages.

**Rejected.** A folder inside the knowledge repository. Its checks are a different kind (knowledge-page format), one
of them is currently red, and a new check beside a red one is the one that gets ignored. And a release link pointing
into a knowledge repository would tie installs to a history that is not about the module.
