/**
 * Documents -> the plain snapshots every pure function in src/core takes. The one place that reads a Playlist's
 * fields, so the core never sees a document and every consumer reads the same shape.
 */
export function snapshot(playlists) {
  return playlists.map((p) => ({
    id: p.id,
    name: p.name,
    mode: p.mode,
    playing: p.playing,
    sounds: p.sounds.map((s) => ({
      id: s.id,
      name: s.name,
      playing: s.playing,
      pausedTime: s.pausedTime ?? null,
      // Per-cue opt-out of ducking: flags["sounds-deck"].duck === false. Read as plain data - getFlag throws for a
      // scope that is not an installed package, which is exactly the live proof's situation.
      duck: s.flags?.['sounds-deck']?.duck,
    })),
  }));
}
