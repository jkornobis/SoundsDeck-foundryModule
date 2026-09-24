#!/usr/bin/env node
/**
 * The five questions the spec left open, answered by measurement in a running world before any pad is built.
 *
 *   node tools/probe-foundry.mjs
 *
 * Each can change the design (FoundryVTT-KnowledgeDB, the-playlist-is-the-bank.md, "What must be measured"):
 *   1 POLYPHONY     can one sound overlap itself? through a PlaylistSound, and through AudioHelper
 *   2 TOGGLE        in a Simultaneous playlist, does stopping one sound leave the others playing?
 *   3 FADE ON STOP  does a sound's fade apply on the way out?
 *   4 OWNERSHIP     may a player change a playlist the gamemaster owns, by default?
 *   5 GEOMETRY      does a window reopened with a saved position come back at that size?
 *
 * SANDBOX: one playlist created in the GE-Foundry folder, pointing at files already uploaded, deleted at the end.
 * AudioHelper is called with push FALSE - local only - so nothing is broadcast. It still REFUSES if anyone else is
 * connected, because a PlaylistSound's playing state IS broadcast.
 */
import { connect, unlockAudio } from './cdp.mjs';

const cdp = await connect();
const unlocked = await unlockAudio(cdp);
const out = await cdp.ev(`(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const R = { audioUnlocked: ${unlocked} };
  const others = game.users.filter((u) => u.active && u.id !== game.user.id).map((u) => u.name);
  if (others.length) return JSON.stringify({ refused: { connected: others } });
  const folder = game.folders.find((f) => f.type === 'Playlist' && f.name === 'GE-Foundry');
  if (!folder) return JSON.stringify({ refused: 'no GE-Foundry playlist folder' });
  const fx = game.playlists.getName('Effets · Fond (boucles)').sounds.contents.slice(0, 3).map((s) => s.path);
  const M = CONST.PLAYLIST_MODES;
  let pl;
  try {
    pl = await Playlist.create({ name: '__sounds-deck-probe', folder: folder.id, mode: M.DISABLED, fade: 0,
      sounds: fx.map((path, i) => ({ name: 'p' + i, path, volume: 0.5, repeat: false, fade: 3000 })) });
    const [a, b, c] = pl.sounds.contents;

    // ---- 1 POLYPHONY
    await pl.playSound(a);
    await wait(2500);
    const first = a.sound, t1 = first?.currentTime;
    await pl.playSound(a);                       // press the same pad again
    await wait(1000);
    R.polyphonyPlaylistSound = { soundObjectReused: a.sound === first, stillPlaying: !!a.sound?.playing,
      timeBefore: +(t1 ?? NaN).toFixed(2), timeAfter: +(a.sound?.currentTime ?? NaN).toFixed(2),
      restarted: (a.sound?.currentTime ?? 0) < (t1 ?? 0) };
    await pl.stopSound(a); await wait(3500);
    const AH = foundry.audio.AudioHelper;
    const s1 = await AH.play({ src: fx[0], volume: 0.3, channel: 'environment' }, false);
    await wait(700);
    const s2 = await AH.play({ src: fx[0], volume: 0.3, channel: 'environment' }, false);
    await wait(700);
    R.polyphonyAudioHelper = { twoSoundObjects: !!s1 && !!s2 && s1 !== s2, bothPlaying: !!s1?.playing && !!s2?.playing,
      offsets: [+(s1?.currentTime ?? NaN).toFixed(2), +(s2?.currentTime ?? NaN).toFixed(2)] };
    s1?.stop(); s2?.stop();

    // ---- 2 TOGGLE in SIMULTANEOUS
    await pl.update({ mode: M.SIMULTANEOUS });
    await pl.playAll();
    // Wait for the AUDIO, not the document: the first run of this probe read a file still loading as "not playing".
    for (let i = 0; i < 25 && !pl.sounds.contents.every((s) => s.sound?.playing); i++) await wait(400);
    const before = pl.sounds.contents.map((s) => s.playing);
    await pl.stopSound(b); await wait(1500);
    R.toggle = { before, after: pl.sounds.contents.map((s) => s.playing), playlistStillPlaying: pl.playing,
      othersAudible: [a, c].every((s) => s.sound?.playing) };
    await pl.stopAll(); await wait(3500);

    // ---- 3 FADE ON STOP (fade 3000 on the sound)
    await pl.playSound(c); await wait(3500);
    const v0 = c.sound?.volume;
    const stopAt = performance.now();
    await pl.stopSound(c);
    const curve = [];
    for (const ms of [300, 1000, 2000, 3300]) { await wait(ms - (performance.now() - stopAt)); curve.push([ms, +(c.sound?.volume ?? NaN).toFixed(3), !!c.sound?.playing]); }
    R.fadeOnStop = { volumeBeforeStop: +(v0 ?? NaN).toFixed(3), afterStop: curve, fadeDurationMs: c.fadeDuration };

    // ---- 4 OWNERSHIP (read, no second session needed)
    const player = game.users.find((u) => !u.isGM);
    R.ownership = { player: player?.name ?? null, defaultOwnership: pl.ownership.default,
      playerMayUpdatePlaylist: player ? pl.canUserModify(player, 'update') : null,
      playerMayUpdateSound: player ? a.canUserModify(player, 'update') : null,
      playerRoleMayPlayAudioSocket: 'not measurable from one session' };
  } catch (e) {
    R.error = String(e?.stack ?? e).slice(0, 500);
  } finally {
    if (pl) { await pl.stopAll().catch(() => {}); await wait(500); await pl.delete(); }
    R.sandboxRemoved = !game.playlists.getName('__sounds-deck-probe');
  }

  // ---- 5 GEOMETRY on reopen
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
  Handlebars.registerPartial('sd-geo.hbs', Handlebars.compile('<section><p>geometry</p></section>'));
  class Geo extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = { id: 'sd-geo', window: { title: 'geo', resizable: true }, position: { width: 300, height: 300 } };
    static PARTS = { p: { template: 'sd-geo.hbs' } };
  }
  let g = new Geo(); await g.render({ force: true }); await wait(300);
  g.setPosition({ left: 200, top: 150, width: 640, height: 420 }); await wait(300);
  const saved = { left: g.position.left, top: g.position.top, width: g.position.width, height: g.position.height };
  await g.close(); await wait(300);
  g = new Geo({ position: saved }); await g.render({ force: true }); await wait(400);
  const box = g.element.getBoundingClientRect();
  R.geometryReopen = { saved, reopened: { left: Math.round(box.left), top: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height) } };
  await g.close();
  // ---- the verdicts: what the design relies on. A Foundry release that changes one of these turns it red.
  const C = [];
  const ok = (name, v) => C.push((v ? 'PASS ' : 'FAIL ') + name);
  ok('1a a PlaylistSound pressed again neither restarts nor overlaps', R.polyphonyPlaylistSound?.soundObjectReused && !R.polyphonyPlaylistSound?.restarted);
  ok('1b AudioHelper.play twice overlaps (two Sounds, both playing)', R.polyphonyAudioHelper?.twoSoundObjects && R.polyphonyAudioHelper?.bothPlaying);
  ok('2  stopping one sound of a Simultaneous playlist leaves the others playing', R.toggle?.after?.join() === 'true,false,true' && R.toggle?.othersAudible && R.toggle?.playlistStillPlaying);
  ok('3  a stopped sound fades out over its fade', R.fadeOnStop?.afterStop?.[1]?.[1] < R.fadeOnStop?.volumeBeforeStop && R.fadeOnStop?.afterStop?.at(-1)?.[1] === 0);
  ok('4  by default a player may not change a playlist', R.ownership?.playerMayUpdatePlaylist === false && R.ownership?.playerMayUpdateSound === false);
  ok('5  a window built with a saved position reopens at it', JSON.stringify(R.geometryReopen?.saved) === JSON.stringify(R.geometryReopen?.reopened));
  R.verdicts = C;
  R.passed = C.filter((c) => c.startsWith('PASS')).length + ' / ' + C.length;
  return JSON.stringify(R, null, 1);
})()`);
console.log(out);
cdp.close();
