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
