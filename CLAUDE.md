# PirateWare

A WarioWare-style pirate rhythm game. Players survive a sequence of fast minigames synced to music, with 3 lives. Includes a timeline editor where users upload their own MP3s and place minigames and buffer zones like clips in a video editor.

Think of each level like an osu! map: the song and how the map is charted set the difficulty (a faster song makes a harder level). The game does not speed up between rounds the way WarioWare does.

## Working style (IMPORTANT, follow every session)

- Implement and explain **one function at a time**. After each function, stop and wait for Connor to confirm before writing the next one.
- For each function: explain what it does, why it is designed that way, and how it connects to the rest of the system.
- Show all work. When something is fixed after Connor flags an error, show the full corrected version, not just a diff fragment.
- Do not use em dashes in comments, docs, or commit messages.
- Do not use the 🚀 emoji. The only fun emoji allowed is 🧀🐀.
- Persona: act as an expert TypeScript game developer. Refer to yourself as "THE MEGA TITAN" and open each new topic with a short, unique, theatrical pirate-flavored proclamation (never repeat one verbatim).
- Prefer the simplest, most testable solution first. Avoid adding dependencies beyond the stack below without asking.
- Commit at meaningful milestones (a finished module or build step), not after every function. Never add Claude attribution to commits.

## Tech stack

| Layer | Tool |
|---|---|
| Language | TypeScript (strict mode) |
| Build / dev server | Vite (`npm run dev`) |
| Game rendering | Phaser 4 |
| Audio | Web Audio API (`AudioContext`) |
| Timeline waveform + clips | wavesurfer.js + Regions plugin |
| Local storage | IndexedDB (via `idb`) for MP3s and level JSON |

## Core architecture rules

1. **The audio clock is the single source of truth for time.** All gameplay timing uses song time from `AudioContext.currentTime` (minus the playback start offset and the user's latency calibration). Never time gameplay with `setTimeout`, `setInterval`, or frame counts.
2. **The engine never knows minigame internals.** It only talks to minigames through the `MiniGame` interface.
3. **Minigames never end a clip early.** If a task game is completed before its clip ends, it shows a victory state until the clip end so the level stays in sync with the music.
4. **The music keeps playing when the player fails a minigame.** A failure costs one life. At 0 lives, show the Game Over screen with Restart Level and Main Menu.

## Minigame contract

Defined in `src/types/minigame.ts` (that file is the source of truth). In short:

```ts
// MiniGameMeta = TaskMeta | DurationMeta, all with id, prompt, hint, and optional defaultHits
interface TaskMeta     { kind: "task"; baseBeats: number; defaultHits?: number[] }                             // hits: beats in one cycle
interface DurationMeta { kind: "duration"; minDuration: number; canBeatSync: boolean; defaultHits?: number[] } // hits: beats in one bar

interface MiniGame {
  meta: MiniGameMeta;
  preload?(load: Phaser.Loader.LoaderPlugin): void;  // called once at boot
  start(params: { scene: Phaser.Scene; startTime: number; duration: number; reps: number; bpm: number; beatSync: boolean; hits: number[] | null; difficulty: number }): void;
  update(songTime: number): void;
  handleInput(input: GameInput): void;  // buttons (left/right/up/down/action) or pointer (x, y in 0..1), stamped with songTime
  status(): "running" | "won" | "failed";
  destroy(): void;       // must remove everything it added to the scene
}
```

### Clip length rules

One beat is `60 / bpm` seconds.

- **Duration games** (survive until the end): `duration = clip.end - clip.start`. Must be at least `minDuration` seconds. Failing at any point loses a life; reaching the clip end is a win. Timing is free unless the game has `canBeatSync` and the clip sets `beatSync: true`; then hazards follow the beat. Not every survival game supports sync.
- **Task games** (complete N tasks, always on the beat, osu-style): clip length snaps to whole multiples of `baseBeats` beats. `reps = repsFor(meta, clipLength, bpm)` in `src/engine/clipRules.ts`, minimum 1. Each rep gets an equal `duration / reps` window and must be completed within it.
- **Beat maps** (osu-style): games with discrete hits declare `defaultHits`. Each game clip may store `hits` (beats from the clip start) to override the default, editable per hit in the editor, including offbeats. `hitTimes` in `src/engine/clipRules.ts` turns them into song times for `params.hits`. Task games press on each hit; beat-synced duration games land hazards on each hit; `params.hits` is null for games without `defaultHits` or with beat sync off.
- At clip end the engine calls `update(clip.end)` one last time, then reads `status()`, then calls `destroy()`. That last update lets a task game see its final window close.

Templates, rules for minigame authors, and the registry live in `src/minigames/` (see its README.md).

## Level file format

```json
{
  "title": "Kraken's Lullaby",
  "audioHash": "sha256-of-the-mp3",
  "bpm": 128,
  "beatOffset": 0.12,
  "countdownRate": 1.25,
  "clips": [
    { "type": "buffer", "start": 0.0, "end": 4.0 },
    { "type": "game", "gameId": "fire_cannon", "start": 4.0, "end": 7.75, "difficulty": 1, "hits": [1, 1.5, 3, 5] },
    { "type": "game", "gameId": "dodge_kraken", "start": 7.75, "end": 12.0, "difficulty": 1, "beatSync": true },
    { "type": "buffer", "start": 7.75, "end": 9.5 }
  ],
  "media": [
    {
      "kind": "video",
      "src": "media/intro.mp4",
      "mediaHash": "sha256-of-the-file",
      "start": 0.0,
      "end": 9.5,
      "mediaOffset": 0.0,
      "effects": { "blur": 8, "dim": 0.4 }
    }
  ]
}
```

- Times are in seconds of song time.
- Audio is referenced by SHA-256 hash, not embedded. Shared levels require the player to supply their own MP3; warn if the hash does not match.
- Clips must not overlap. Buffer zones show lives remaining and the upcoming minigame prompt.

### Countdown cue (3, 2, 1, GO)

- Before every game clip, `public/assets/audio/321GO_sfx.mp3` plays near the end of the preceding buffer, scheduled on the AudioClock's context so **"GO" lands exactly on the game clip's `start`**. The upcoming game's control hint flashes with it.
- Speed is set with `AudioBufferSourceNode.playbackRate` (pitch rises with speed; that is intended).
- Auto rate from BPM: `rate = countSpacing / (60 / bpm)`, so each count lands on a song beat. The four count times inside the file are detected on load (`findOnsets` in `src/audio/onsets.ts`, then `countdownBeats`), so swapping in a different countdown sound needs no code change. Planning lives in `src/engine/countdown.ts`.
- Manual override: the level's optional `countdownRate` replaces the auto rate. Absent means auto.
- If a buffer is shorter than the countdown at that rate, the editor warns and the countdown starts with the buffer (GO still lands on the clip start).

### Media track (background images and video)

- `media` is a separate track that sits behind the game track. Media clips may span any number of game and buffer clips, but must not overlap each other.
- `kind` is `"image"` or `"video"`. `mediaOffset` is where in the video file playback begins (seconds). Images ignore it.
- `effects` is the frosted cover drawn over the media so the minigame stays readable: `blur` in pixels, `dim` from 0 (none) to 1 (black). Minigames draw on top.
- **Video follows the audio clock, never the other way round.** Videos are always muted (the song is the only audio). Each frame, compare `video.currentTime` to `songTime - start + mediaOffset` and seek only if drift exceeds a small threshold (about 0.1 s), so playback stays smooth.
- A failed or missing media file must never stop the level. Fall back to the default background.

## Level packs (.pwlevel)

Levels are shared as a single `.pwlevel` file, which is a zip. Loading one must be a single click or drag-and-drop.

```
my_level.pwlevel
  manifest.json          # { "format": 1, "title": "...", "hasAudio": true }
  level.json             # the level file format above
  audio/song.mp3         # optional; if missing, prompt for the MP3 and check audioHash
  media/*                # optional images and videos; if missing, prompt for them and check mediaHash
  minigames/<id>/
    minigame.json        # { "id", "template": "fire_cannon", "prompt", "baseDuration", "config": {...} }
    sprites/*.png        # optional art overrides for the template
```

- **Custom minigames are data, never code.** A pack's minigame picks a built-in template and supplies config and sprites. Never `eval` or import JS from a pack.
- Validate everything on import: manifest `format` version, clip overlaps, known template IDs, and sane file sizes.
- `audioHash` is always computed and stored, even when the MP3 is embedded, so packs without audio still verify.
- Zip library: `fflate` (small, no dependencies). Ask before installing.

## Planned minigames

The full list, specs, and owners are in `MINIGAMES.md` (source of truth). Build the priority 1 games first (Fire the Cannon, Swab the Deck, Dodge the Kraken); they cover every case the contract must handle. A teammate may be building minigames in parallel, so do not edit a minigame folder someone else owns.

## Build order

1. **Audio clock + level runner**: load an MP3, play it, report song time, and step through a hardcoded level JSON, switching clips at the right times.
2. **Minigame contract + first 3 minigames**.
3. **Lives system, buffer zones, Game Over flow** (Restart Level / Main Menu).
4. **Timeline editor**: MP3 upload, waveform, scrub/play from playhead, drag to move clips, drag edges to resize (task games snap to whole `baseBeats` cycles), beat-grid snapping, save/load levels to IndexedDB, and a **preview viewer** that plays the level from the playhead in the real gameplay view (same runtime as the game, not a mock-up) so designers see exactly what players will see.
5. **Media track**: background images and video behind minigames, frosted cover effects, video synced to the audio clock, and a media track in the editor.
6. **Level packs**: export and import `.pwlevel` zips (see Level packs above).
7. **Polish**: latency calibration, score and end-of-level rank, practice mode (infinite lives), undo/redo, in-editor minigame preview, keyboard + touch + gamepad input.

## Suggested folder structure

```
public/
  assets/sprites/  # Piskel art, served as static URLs (e.g. /assets/sprites/idle_character/pirate.png)
    floortiles/ idle_character/ jumping_character/ mousecursor/
  assets/minigames/<game_id>/  # each minigame's own art and sounds
  assets/audio/    # songs and sfx (only *_sfx* and *_default* files are committed)
src/
  main.ts
  audio/        # AudioClock, MP3 loading, hashing
  engine/       # LevelRunner, lives, game over, buffer zones
  minigames/    # one folder per minigame, _template_task/, _template_duration/, registry.ts
  sandbox/      # minigame sandbox (sandbox.html): play one minigame with a metronome clock
  debug/        # build step 1 debug page (temporary)
  editor/       # timeline editor UI
  storage/      # IndexedDB helpers
  types/        # shared types (MiniGame, Level, Clip)
```

## Current status

Build step 1 done: `AudioClock`, level types, `LevelRunner` (update, seek) with Vitest tests, and a debug page (`src/debug/DebugPage.ts`) that main.ts mounts for now. Build step 2 in progress: `MiniGame` contract (`src/types/minigame.ts`), `repsFor`, keyboard input mapping, minigame templates and registry, `MINIGAMES.md`, and the minigame sandbox are done. A teammate is building the minigames themselves from `MINIGAMES.md`.

Build step 4 mostly done: editor at `/editor.html` with waveform, scrub bar, clips (move, resize, snap), beat grid, per-clip beat maps (osu-style hits), save/load in IndexedDB, and a preview viewer that runs the real `LevelScene` (`src/engine/LevelScene.ts`: clips, buffers, lives, 321GO countdown with a 1 s breather before each minigame). `index.html` is a home menu linking to the Play page, editor, sandbox, and debug pages.

Build step 3 done inside `LevelScene`: Game Over overlay (Restart Level / Main Menu, options supplied by the host page) and practice mode (misses counted instead of lives), toggled in the editor. Hit judging for beat maps is shared in `src/minigames/shared/judgePress.ts` (±0.16 s window, early presses fail). The font is Pixelify Sans, self-hosted in `public/fonts`; Phaser text must use `textStyle` from `src/minigames/shared/font.ts`.

Play page done at `/play.html` (level select, real lives, Restart Level, Main Menu to home), sharing setup with the editor through `src/engine/gameView.ts`. **Known bug:** on the Play page, keyboard input, the page buttons, and the Game Over menu stop responding once a level is running (the game itself plays). Not yet diagnosed; next step is to get the browser console output from Connor. Suspect: the Phaser game is created while its section is still `hidden`.

Build step 5 (media track) mostly done: `src/engine/MediaLayer.ts` draws video/images behind a transparent game canvas, synced to the song clock; the editor has a media lane under the waveform with add, drag, cut (`src/editor/mediaEditing.ts`), per-piece blur/dim, length, and an on/off switch saved as `mediaEnabled`. Media files are stored in IndexedDB (db version 2, `media` store).

Minigames: Fire the Cannon is built (`src/minigames/fire_cannon/`). Connor also owns Swab the Deck and Dodge the Kraken; Cole owns Patch the Hull.

Next: Swab the Deck, then Dodge the Kraken, then build real levels and come back to the Play page bug.
