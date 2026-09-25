# What the tabletop audio tools do that Sounds Deck does not - field study, 2026-09-24

Asked for by the Composer after using 0.5.1: *"study the tabletop audio tool to see what I miss as Must and Nice to
have ... I want useful features."* This study is led by the UX Designer and the Product Owner.

## Where it looked

These are read from each tool's own pages and from one comparison article, all on 2026-09-24. **Nothing was installed
or tried**, so every row below is what the tools *say* they do.

- Tabletop Audio SoundPad: https://tabletopaudio.com/soundpad.html
- Syrinscape FAQ and app guide: https://syrinscape.com/faq/ · https://blog.syrinscape.com/2025/11/25/which-syrinscape-app-is-best-for-you/
- Kenku FM docs and issue tracker: https://www.kenku.fm/docs/using-kenku-player · https://github.com/owlbear-rodeo/kenku-fm/issues/84
- Audio Forge, Pocket Bard, TableTone and RPG Master Sounds Mixer, as described in https://slashpaf.com/post/audio-forge-vs-competitors-2026/

## What the field agrees on, and where Sounds Deck stands

| The field's feature | Who has it | Sounds Deck 0.5.2 |
|---|---|---|
| Music, ambience and one-shots as separate layers | all | ✅ beds, loop banks, one-shot banks |
| Per-sound volume | all | ✅ in Now playing |
| Random one-shots at intervals | SoundPad, Syrinscape | ✅ the dice, 10-45 s |
| Ducking the ambience under a cue | Audio Forge | ✅ 10 dB, per client |
| Search | Syrinscape | ✅ filter |
| **A saved mix recalled in one click** (Syrinscape *Moods*, SoundPad saved playlists, Audio Forge *State Links*) | SoundPad, Syrinscape, Audio Forge, TableTone | ❌ only a scene's bed is recalled; loops and volumes are not |
| **One level per layer** (Syrinscape: each *Element* and the master level adjust independently) | Syrinscape, Audio Forge (per category) | ❌ volume is per sound only |
| **Transitions / stings** between two moods | SoundPad (Film Noir stings), Audio Forge (*Epic Transitions*), Syrinscape (one-click crossfade between Moods) | ⚠️ a bed change uses each sound's own Foundry fade; there is no transition cue |
| Fade controls per category | Audio Forge, Kenku FM (per soundboard track) | ⚠️ Foundry's per-sound fade, set in the native panel |
| Intensity layers (the same music at low, mid, high) | Pocket Bard, TableTone | ❌ |
| Pad colour and icon | Audio Forge | ❌ only the bank's emoji |
| Hotkeys / Stream Deck / MQTT lighting | Audio Forge | ❌ |
| Play to a link (players without the app) | SoundPad, Syrinscape | n/a - Foundry already plays to every player |

## Still open

- **No tool was used.** The claims above are the tools' own wording; a hands-on pass would sharpen the Must list.
- Kenku FM's playlists **lack a crossfade and its users ask for one** (issue #84). That is evidence of a need, not of
  a design.

---

# Part 2 - what users ASK the Foundry audio modules for, 2026-09-24, evening

Part 1 read what tools *offer*. This part reads what their users *request*. Asked for by the Composer after 0.6's
first two notes: *"continue to compare and add most asked feature on other module project to our own."*

## Where it looked

Every issue on eight Foundry audio module trackers, plus Foundry's own tracker limited to its `audio` label, pulled
through the GitHub API on 2026-09-24 around 22:50 CEST (`/repos/{repo}/issues?state=all`, and for Foundry
`/search/issues?q=repo:foundryvtt/foundryvtt is:issue label:audio`):

| Tracker | Issues | Code below |
|---|---|---|
| [Maestro](https://github.com/death-save/maestro/issues) | 138 | MAE |
| [SoundBoard by Blitz](https://github.com/BlitzKraig/fvtt-SoundBoard/issues) | 81 | SB |
| [Monk's Sound Enhancements](https://github.com/ironmonk108/monks-sound-enhancements/issues) | 47 | MSE |
| [Soundscape](https://github.com/MaterialFoundry/Soundscape/issues) | 41 | SSC |
| [The Sound of Silence](https://github.com/GnollStack/The-Sound-of-Silence/issues) | 24 | TSS |
| [Moulinette Sounds](https://github.com/SvenWerlen/moulinette-sounds/issues) | 15 | MOU |
| [Maru Playlist Enhancements](https://github.com/marutypes/FoundryVTT-Maru-Playlist-Enhancements/issues) | 2 | MARU |
| [Soundbrett](https://github.com/xFeirefizx/soundbrett/issues) | 1 | SBR |
| [Foundry VTT, label `audio`](https://github.com/foundryvtt/foundryvtt/issues?q=label%3Aaudio) | 326, 202 not marked bug | C |

SoundBard's tracker (`ongoingpast/Campendium-SoundBard`) has no issues.

## ⚠️ Votes cannot say what is "most asked"

The most-voted request on any module tracker has **3** 👍; on Foundry's audio label, **2**. Foundry's older issues came
over from GitLab without their votes. **So the measure here is the number of separate requests, and how many
trackers they come from.** A theme asked for on five trackers comes from five different user bases. A theme asked 21
times on one tracker is mostly one module's users asking about that module's own feature: Maestro *is* a
combat-music module.

**How:** every title read; the body read wherever the title left the meaning open; each request put in at most one
theme; bug reports not counted. The exact assignment is at the end, so anyone can recount it.

## What is asked, ranked by reach, against Sounds Deck 0.6

| Theme | Trackers | Requests | Sounds Deck 0.6 |
|---|---|---|---|
| Organising a big library: several boards, subfolders, icons, colours, search | 5 | 14 | ⚠️ a bank per playlist, the filter, the source in a tooltip; no icon or colour per pad, one board only |
| Hotkeys, macros, the hotbar, a Stream Deck | 5 | 13 | ❌ opened from the sidebar button only; `api.open()` exists but is not documented |
| Players play or control sounds; audio sent to one player | 5 | 11 | ➖ the deck is the GM's; Foundry already plays to every player |
| Loop points and silence: start and end, intro then loop, gaps | 5 | 7 | ❌ |
| Transport: time, progress, next track, loading, waveform | 4 | 10 | ⚠️ events have a clock, pause and seek; beds have skip; no next track, no sign that a file is still loading |
| Crossfade between tracks, playlists or soundscapes | 4 | 6 | ❌ note 4 of the 0.6 program. The Sound of Silence's crossfade bug drew **16 comments**, the most discussed issue on that tracker |
| Stop one, stop all, play exclusively | 4 | 4 | ✅ a second click stops (decision 0005), stop all, beds exclusive |
| Combat music: switch at a fight, resume after, end jingles | 3 | 21 | ❌ the deck knows nothing of combat |
| Sounds on game events: dice, items, damage, death | 3 | 18 | ❌ |
| Levels by group: one slider per playlist, channel or layer | 3 | 8 | ✅ on branch `layer-levels` (note 2), not merged |
| Randomness: pick one of a set, random gaps, volume or pitch | 3 | 7 | ⚠️ the dice fires a one-shot at random moments; no pick among variants, no random volume or pitch |
| A scene brings its sound: soundscape, several playlists, no restart | 3 | 7 | ⚠️ a scene's bed, with the scene fix - Foundry's own C14259 asks for exactly what that fix does; a whole mood per scene is note 5 |
| Preview in the GM's ear only | 3 | 4 | ❌ note 3 |
| Preload, so a press starts at once | 1 | 4 | ❌ and not only a comfort: the silent-sound race of #37 needs a stop that lands while a file loads |
| Duck the music under an effect | 1 | 2 | ✅ since 0.3 |
| A late joiner hears from where the table is | 1 | 1 | ❌ Foundry's own behaviour (C8720, open) |

**Counted, not ranked, because a board is not where they live:** sound placed on the map - walls, doors, regions,
token auras - about 38 of Foundry's audio requests; streaming sources - YouTube, S3, Plex, the web - 6 requests and
several whole modules; bulk import and playlist management, which the native panel does.

## Found on the way

Foundry's tracker already holds two reports from the family of #37's race: **C6901** (open) - a sound restarted during
its fade-out is stopped when the old fade ends - and **C14763** (open) - `Sound#stop` skips
`AudioBufferSourceNode#stop` once the state is STOPPING. Neither describes the silent "playing" state #37 found.

## Still open

- **No module was installed**, as in part 1: these are requests, not measured gaps.
- **Reach is not popularity.** GitHub stars undercount Foundry modules, and install counts were not read.
- **Titles can mislead.** Bodies were read only where the title was unclear.
- Syrinscape and Kenku FM are in part 1, not here.

## The assignment, for a recount

- Organising: SB3 SB11 SB44 SB54 SBR1 MSE5 MSE18 MOU11 MOU13 C7444 C5307 C9418 C1048 C4484
- Hotkeys and macros: SB2 SB38 SB53 SB60 SB74 SB77 MSE11 MAE58 SSC3 SSC24 SSC25 C10579 C14671
- Players: SB12 SB86 SSC8 SSC36 MAE20 C8707 C4706 C4707 MSE3 MSE12 C84
- Loop points: MAE18 C4807 TSS1 SSC9 TSS10 SB69 C5632
- Transport: MSE1 SB21 C4728 C5278 C3083 C5609 MAE57 C1106 C5605 C4727
- Crossfade: C845 C5420 SSC35 SB59 SSC23 TSS8
- Stop: SB22 MOU4 MARU2 C4711
- Combat music: MAE30 MAE36 MAE37 MAE38 MAE40 MAE50 MAE52 MAE53 MAE59 MAE71 MAE75 MAE76 MAE81 MAE122 MAE129 MAE168
  MAE179 MAE182 MAE184 MSE10 C14526
- Game events: MAE6 MAE12 MAE42 MAE54 MAE66 MAE67 MAE77 MAE82 MAE100 MAE126 MAE137 MAE147 MAE156 MAE163 MSE16 MSE17
  MSE25 C238
- Levels by group: TSS6 SSC14 C4731 C6215 C506 C507 C525 C10586
- Randomness: SB17 SB48 SB49 SB70 SB83 SSC5 C4718
- Scene: SSC16 MAE106 C4601 C3306 C10722 C14259 C38
- Preview: C9961 C5808 MSE4 TSS7
- Preload: C474 C5019 C13010 C3680
- Ducking: MSE52 MSE37
- Late joiner: C8720

137 requests in all. A code like MAE18 is issue 18 on Maestro's tracker; C is Foundry's.

---

# Part 3 - each module's own headline features, against Sounds Deck 0.6.1, 2026-09-25

Part 2 counted what users ASK these modules for. The Composer then asked the other half: *"did we do the key features
of each?"* This part reads each module's own README - what it says it is for - and sets it against 0.6.1, released the
same day. Read on GitHub around 12:25 CEST; **nothing was installed**. Soundscape's README points to a wiki for detail,
which was not read.

✅ the deck does it · ⚠️ partly · ❌ not · ➖ not the deck's job (Foundry's own panel does it, or it is not a board)

| Module | Its headline features | Sounds Deck 0.6.1 |
|---|---|---|
| [Maestro](https://github.com/death-save/maestro) | a track per character's combat turn (Hype) · a track when an item is rolled · a combat playlist at the start of a fight · critical and fumble sounds | ❌ all four: the deck is played by hand and never listens to the game |
| [Monk's Sound Enhancements](https://github.com/ironmonk108/monks-sound-enhancements) | hear a sound privately · a character's sound from the Token HUD, and on its turn · a sound on an item's use · hide sound or playlist names from players · a sound-effects volume · a playlist's sounds listed, dragged, imported selectively | ✅ private preview (note 3) · ❌ character and item sounds · ❌ names hidden from PLAYERS (the deck hides sources on the GM's screen only) · ✅ layer levels · ➖ playlist management |
| [SoundBoard by Blitz](https://github.com/BlitzKraig/fvtt-SoundBoard) | folders become categories · a "wildcard" button plays a random file of a folder · loop per sound · detune (random pitch) · stop one or all · macros | ✅ banks, loops, stop, hotbar · ❌ **one button, a random pick among variants** · ❌ random pitch |
| [Soundscape](https://github.com/MaterialFoundry/Soundscape) | several tracks mixed into one scene, volumes on the fly · effects on each channel · a soundboard · several soundscapes to move between · import and export | ✅ loops at their levels, soundboard, moods to move between · ❌ **channel effects (reverb, EQ, pan)** · ❌ exporting moods |
| [The Sound of Silence](https://github.com/GnollStack/The-Sound-of-Silence) | up to 16 loop sections in a track, broken out of live · equal-power crossfade as a playlist moves from track to track · silence gaps, fixed or random · Soundscape mode: a bed plus occasional sounds with timing, stereo position, overlap cap and groups · GM-only preview · shuffle modes, fade curves, volume normalisation | ⚠️ one trim, no loop sections (theme 7) · ⚠️ crossfade when the BED changes (note 4), **not between tracks inside a bed** · ❌ silence gaps (offered, not chosen) · ⚠️ random one-shots on a timer, **no stereo position, overlap cap or groups** · ✅ preview · ❌ shuffle modes, curves, normalisation |
| [Moulinette Sounds](https://github.com/SvenWerlen/moulinette-sounds) | index and search a large sound library · play on the fly · build playlists and soundboards from it | ➖ library management · ✅ soundboard |
| [Maru's Playlist Enhancements](https://github.com/marutypes/FoundryVTT-Maru-Playlist-Enhancements) | play exclusively · stop all | ✅ both |
| [Soundbrett](https://github.com/xFeirefizx/soundbrett) | folder library · playback kept in sync, **late-joining players catch up** · pause, loop, volume, stop all · favourites, search, tags · **route a sound to everyone, the GM only, or chosen players** · **preload players' buffers** · hotbar drag and drop | ⚠️ playlists as the library · ❌ **late joiners** (Foundry restarts the track, its own C8720) · ✅ controls, search, hotbar · ❌ favourites, tags · ❌ **routing** · ❌ **preloading** |
| [SoundBard](https://github.com/ongoingpast/Campendium-SoundBard) (he used it, then removed it) | banks of up to 8×8 · a hotkey per slot · search across banks · master volume and reverb · stop all · emoji labels · an open() macro | ✅ banks, search, levels, stop all, icons, Shift+D and api.open · ⚠️ keys for beds, moods and knobs, and number keys for pads put on the hotbar, not one per pad · ❌ reverb |

## What Part 1's tools do that is still open

From Part 1's table, after 0.6.1: **intensity layers** (the same music at low, middle and high tension - Pocket Bard,
TableTone) ❌ · **stings and transition cues** between moods (Tabletop Audio SoundPad, Audio Forge) ❌ - the crossfade
exists, a musical sting does not · **fades per category** (Audio Forge) ⚠️ one crossfade setting · **MQTT lighting**
(Audio Forge) ❌.

## Still open

- **The Auditorium's Nice-to-have list was never written down.** The session log records the five Musts, all built.
  What remains is rebuilt here from the studies' own tables, not from that list.
- **READMEs describe; they were not tried.** A module may do less, or more, than its page says.
