# PirateWare

A WarioWare-style pirate rhythm game. Players survive a rapid-fire sequence of pirate minigames synced to music, with only 3 lives to spare. A built-in timeline editor lets anyone upload their own song, lay out minigames and breather zones like clips in a video editor, and share the result as a single downloadable level pack.

## Overview

Every level is a song, charted like an osu! map. Each minigame is a clip on that song's timeline, so prompts land on the beat, and a faster song makes for a harder level. Fail a minigame and you lose a life, but the music never stops. Lose all three and it's Game Over.

## Planned Features

- **Rhythm minigames:** Fire the Cannon, Dodge the Kraken, Swab the Deck, and more, each timed to the song.
- **Lives and buffer zones:** 3 lives, with short breather zones between games that show lives left and the next prompt.
- **Timeline editor:** Upload an MP3, see its waveform, and drag, resize, and snap minigame clips to the beat.
- **Background media:** Put images or video on the timeline behind the minigames, with a frosted blur-and-dim cover so the action stays readable. Set a level to an anime intro and play over the actual opening.
- **Level packs:** Download a level as one `.pwlevel` file (a zip) and load it with a single click or drag-and-drop. A pack holds the timeline, any custom minigames, and optionally the song and background media.
- **Custom minigames:** Reskin and retune built-in minigame templates with your own sprites and settings, packed right into the level.

## Art and Design

The game uses a hand-drawn pixel-art style inspired by classic 2D games.

Character sprites and environmental assets are designed using **Piskel**.

## Project Layout

```
public/assets/sprites/   Character, floor tile, and cursor art (Piskel exports)
src/
  main.ts                Entry point
  audio/                 Audio clock, MP3 loading, hashing
  engine/                Level runner, lives, buffer zones, game over
  minigames/             One folder per minigame
  editor/                Timeline editor UI
  storage/               IndexedDB helpers, level pack import and export
  types/                 Shared types (MiniGame, Level, Clip)
```

Run locally with `npm install` then `npm run dev`.

## Objectives Checklist

### 0. Setup
- [x] Vite + TypeScript project scaffolded
- [x] Sprites moved into `public/assets/sprites`
- [x] Source folders created
- [x] Confirm Phaser version (Phaser 4)

### 1. Audio clock + level runner
- [x] `AudioClock`: load an uploaded MP3 and play it
- [x] `AudioClock`: report accurate song time from `AudioContext.currentTime`
- [x] Level and Clip types
- [x] Hardcoded test level
- [x] `LevelRunner`: switch clips at the right song times
- [x] Debug page to check clip switches by ear

### 2. Minigame contract + first 3 minigames
- [x] `MiniGame` interface and metadata types (timed in beats)
- [x] Task and duration templates, registry, and author guide for teammates
- [x] Minigame sandbox (`/sandbox.html`) to play one minigame with a metronome
- [ ] Fire the Cannon (task)
- [ ] Dodge the Kraken (duration)
- [ ] Swab the Deck (task)

### 3. Lives, buffer zones, Game Over
- [ ] 3 lives, failure costs one life, music keeps playing
- [ ] Buffer zones show lives and the next prompt
- [ ] 321GO countdown with "GO" landing on the next game's start, plus a control hint flash
- [ ] Countdown speed auto-synced to BPM, with a per-level manual override
- [ ] Game Over screen with Restart Level and Main Menu

### 4. Timeline editor
- [ ] MP3 upload and waveform display
- [ ] Scrub and play from playhead
- [ ] Drag to move clips, drag edges to resize
- [ ] Task games snap to `baseDuration` multiples
- [ ] Beat grid snapping
- [ ] Save and load levels in IndexedDB

### 5. Media track (backgrounds)
- [ ] Image and video clips on their own track behind the minigames
- [ ] Frosted cover effect (blur + dim) per media clip
- [ ] Video playback synced to the audio clock (muted, drift-corrected)
- [ ] Media track in the editor: add, move, resize, set effects
- [ ] Missing or broken media falls back to the default background

### 6. Level packs (sharing)
- [ ] Export a level as a `.pwlevel` zip (level JSON, custom minigames, optional MP3 and media)
- [ ] Import a `.pwlevel` by file picker or drag-and-drop
- [ ] Validate the pack (manifest version, clip overlaps, known minigame templates)
- [ ] If the pack has no audio or media, prompt for the files and warn on hash mismatch
- [ ] Custom minigames: template ID + JSON config + sprites, no code

### 7. Polish
- [ ] Latency calibration
- [ ] Score and end-of-level rank
- [ ] Practice mode (infinite lives)
- [ ] Undo and redo
- [ ] In-editor minigame preview
- [ ] Keyboard, touch, and gamepad input

### Stretch goals
- [ ] Song speed modifier (play a level faster for extra difficulty, timings scale with it)

### Minigames
The full minigame list, specs, and who's building what are tracked in [`MINIGAMES.md`](MINIGAMES.md). To build one, see [`src/minigames/README.md`](src/minigames/README.md).

## Team

Developed as a collaborative student game development project.
