import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MODES } from '../../src/core/classify.mjs';
import { captureMood, isEmptyMood, moodIsOn, moodPlan, sceneMood } from '../../src/core/moods.mjs';

const snd = (id, playing = false, volume = 0.5) => ({ id, name: id, playing, volume });
const world = ({ board = false, wrong = false, rain = false, wind = false, windVol = 0.5, cue = false } = {}) => [
  { id: 'board', name: '8 · The Board', mode: MODES.SHUFFLE, playing: board, sounds: [snd('b1', board)] },
  { id: 'wrong', name: '5 · Wrong', mode: MODES.SHUFFLE, playing: wrong, sounds: [snd('w1', wrong)] },
  {
    id: 'loops',
    name: '🔁 Loops',
    mode: MODES.SIMULTANEOUS,
    playing: rain || wind,
    sounds: [snd('rain', rain, 0.4), snd('wind', wind, windVol)],
  },
  { id: 'fx', name: '💥 Hits', mode: MODES.DISABLED, playing: false, sounds: [snd('shot'), snd('glass')] },
  { id: 'cues', name: '🎞️ Events', mode: MODES.SEQUENTIAL, playing: cue, sounds: [snd('siren', cue)] },
  { id: 'misc', name: 'Not on the deck', mode: MODES.SEQUENTIAL, playing: true, sounds: [snd('x', true)] },
];
const shot = { playlistId: 'fx', soundId: 'shot' };
const glass = { playlistId: 'fx', soundId: 'glass' };
const label = { id: 'm1', name: 'Stakeout' };

describe('captureMood - the parts that describe a place', () => {
  it('takes the playing bed, the loops that are on with their volume, and the armed one-shots', () => {
    const m = captureMood(world({ board: true, wind: true, windVol: 0.3 }), [shot], label);
    assert.deepEqual(m, {
      id: 'm1',
      name: 'Stakeout',
      bed: 'board',
      loops: [{ playlistId: 'loops', soundId: 'wind', volume: 0.3 }],
      random: [shot],
    });
  });
  it('leaves events and playlists that are not on the deck out', () => {
    const m = captureMood(world({ cue: true }), [], label);
    assert.equal(m.bed, null);
    assert.deepEqual(m.loops, []);
    assert.ok(isEmptyMood(m));
  });
  it('a loop with no usable volume is captured at 0.5', () => {
    const now = world({ wind: true });
    now[2].sounds[1].volume = undefined;
    assert.deepEqual(captureMood(now, [], label).loops, [{ playlistId: 'loops', soundId: 'wind', volume: 0.5 }]);
  });
  it('ignores an armed reference that is not a one-shot', () => {
    assert.deepEqual(captureMood(world(), [{ playlistId: 'cues', soundId: 'siren' }], label).random, []);
  });
});

describe('moodPlan - from what plays now to the mood', () => {
  const mood = captureMood(world({ board: true, rain: true, wind: true, windVol: 0.3 }), [shot], label);

  it('from silence: start the bed, both loops, arm the shot', () => {
    const p = moodPlan(mood, world(), []);
    assert.equal(p.startBed, 'board');
    assert.deepEqual(p.stopBeds, []);
    assert.deepEqual(
      p.startLoops.map((l) => l.soundId),
      ['rain', 'wind'],
    );
    assert.deepEqual(p.arm, [shot]);
    assert.equal(p.missing, 0);
  });
  it('another bed playing is stopped; the mood bed already playing is KEPT, not restarted', () => {
    assert.deepEqual(moodPlan(mood, world({ wrong: true }), []).stopBeds, ['wrong']);
    const p = moodPlan(mood, world({ board: true }), []);
    assert.equal(p.startBed, null);
    assert.deepEqual(p.stopBeds, []);
  });
  it('a loop on that the mood does not name is switched off; a named one at the wrong level is set', () => {
    const now = world({ board: true, rain: true, wind: true, windVol: 0.9 });
    const p = moodPlan({ ...mood, loops: [{ playlistId: 'loops', soundId: 'wind', volume: 0.3 }] }, now, [shot]);
    assert.deepEqual(p.stopLoops, [{ playlistId: 'loops', soundId: 'rain' }]);
    assert.deepEqual(p.setVolumes, [{ playlistId: 'loops', soundId: 'wind', volume: 0.3 }]);
  });
  it('a playing loop with no volume counts as silent, so the mood sets its level', () => {
    const now = world({ board: true, wind: true });
    now[2].sounds[1].volume = undefined;
    const p = moodPlan({ ...mood, loops: [{ playlistId: 'loops', soundId: 'wind', volume: 0.3 }] }, now, [shot]);
    assert.deepEqual(p.setVolumes, [{ playlistId: 'loops', soundId: 'wind', volume: 0.3 }]);
  });
  it('an armed one-shot the mood does not name is disarmed', () => {
    assert.deepEqual(moodPlan(mood, world(), [shot, glass]).disarm, [glass]);
  });
  it('events are never touched', () => {
    const p = moodPlan(mood, world({ cue: true }), []);
    assert.ok(![...p.stopBeds, ...p.stopLoops.map((l) => l.playlistId)].includes('cues'));
  });
  it('a mood with no bed stops the bed that plays', () => {
    assert.deepEqual(moodPlan({ ...mood, bed: null }, world({ board: true }), []).stopBeds, ['board']);
  });
  it('what no longer exists is skipped and counted, never a failure', () => {
    const stale = {
      ...mood,
      bed: 'gone',
      loops: [...mood.loops, { playlistId: 'loops', soundId: 'deleted', volume: 1 }],
      random: [{ playlistId: 'fx', soundId: 'deleted' }],
    };
    const p = moodPlan(stale, world(), []);
    assert.equal(p.startBed, null);
    assert.equal(p.missing, 3);
    assert.equal(p.startLoops.length, 2);
  });
});

describe('moodIsOn - lit when a recall would change nothing', () => {
  const mood = captureMood(world({ board: true, wind: true, windVol: 0.3 }), [shot], label);
  it('on right after it is captured', () =>
    assert.ok(moodIsOn(mood, world({ board: true, wind: true, windVol: 0.3 }), [shot])));
  it('off once a loop is added, a level moves, or the shot is disarmed', () => {
    assert.ok(!moodIsOn(mood, world({ board: true, wind: true, rain: true, windVol: 0.3 }), [shot]));
    assert.ok(!moodIsOn(mood, world({ board: true, wind: true, windVol: 0.8 }), [shot]));
    assert.ok(!moodIsOn(mood, world({ board: true, wind: true, windVol: 0.3 }), []));
  });
  it('an event playing on top does not switch it off', () =>
    assert.ok(moodIsOn(mood, world({ board: true, wind: true, windVol: 0.3, cue: true }), [shot])));
  it('a mood whose bed was deleted is never on', () =>
    assert.ok(!moodIsOn({ ...mood, bed: 'gone', loops: [], random: [] }, world(), [])));
});

describe('sceneMood - the mood a scene brings back', () => {
  const moods = [{ id: 'm1', name: 'Rain', bed: null, loops: [], random: [] }];
  it('the mood whose id the scene stores', () => assert.equal(sceneMood('m1', moods)?.name, 'Rain'));
  it('a mood deleted since is no mood - the scene plays its own playlist', () =>
    assert.equal(sceneMood('gone', moods), null));
  it('no flag, an empty one, or anything but an id, is no mood', () => {
    for (const flag of [undefined, null, '', 42, {}]) assert.equal(sceneMood(flag, moods), null);
  });
});
