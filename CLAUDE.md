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
| Game rendering | Phaser 3 |
| Audio | Web Audio API (`AudioContext`) |
| Timeline waveform + clips | wavesurfer.js + Regions plugin |
| Local storage | IndexedDB (via `idb`) for MP3s and level JSON |

## Core architecture rules

1. **The audio clock is the single source of truth for time.** All gameplay timing uses song time from `AudioContext.currentTime` (minus the playback start offset and the user's latency calibration). Never time gameplay with `setTimeout`, `setInterval`, or frame counts.
2. **The engine never knows minigame internals.** It only talks to minigames through the `MiniGame` interface.
3. **Minigames never end a clip early.** If a task game is completed before its clip ends, it shows a victory state until the clip end so the level stays in sync with the music.
4. **The music keeps playing when the player fails a minigame.** A failure costs one life. At 0 lives, show the Game Over screen with Restart Level and Main Menu.

## Minigame contract

```ts
type GameKind = "duration" | "task";
type Status = "running" | "won" | "failed";

interface MiniGameMeta {
  id: string;            // e.g. "swab_the_deck"
  kind: GameKind;
  prompt: string;        // short command flashed at start, e.g. "SWAB!"
  baseDuration: number;  // seconds: one task cycle (task) or minimum length (duration)
}

interface MiniGame {
  meta: MiniGameMeta;
  start(params: { duration: number; reps: number; difficulty: number }): void;
  update(songTime: number): void;
  handleInput(e: InputEvent): void;
  status(): Status;
  destroy(): void;
}
```

### Clip length rules

- **Duration games** (survive until the end): `duration = clip.end - clip.start`. Must be at least `baseDuration`. Failing at any point loses a life; reaching the clip end is a win.
- **Task games** (complete N tasks): clip length snaps to whole multiples of `baseDuration`. `reps = round(clipLength / baseDuration)`, minimum 1. Each rep must be completed within its time window.

## Level file format

```json
{
  "title": "Kraken's Lullaby",
  "audioHash": "sha256-of-the-mp3",
  "bpm": 128,
  "countdownRate": 1.25,
  "clips": [
    { "type": "buffer", "start": 0.0, "end": 4.0 },
    { "type": "game", "gameId": "fire_cannon", "start": 4.0, "end": 7.75, "difficulty": 1 },
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
- Auto rate from BPM: `rate = SFX_BEAT_INTERVAL / (60 / bpm)`, where `SFX_BEAT_INTERVAL` is the measured gap between "3" and "2" in the sfx file. This puts each count on a song beat.
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

Build the first three first; they cover every case the contract must handle.

| Game | Kind | Mechanic | Priority |
|---|---|---|---|
| Fire the Cannon | task | Press on the beat when the fuse reaches the mark | 1 |
| Dodge the Kraken | duration | Move left/right to avoid tentacle slams | 1 |
| Swab the Deck | task | Scrub all grime spots before time runs out | 1 |
| Patch the Hull | task | Plug leaks as they spring (whack-a-mole) | 2 |
| Walk the Plank | duration | Keep a balance meter centered | 2 |
| Parrot Says | task | Repeat the parrot's arrow sequence | 2 |
| Parry! | task | Block sword strikes timed to the beat | 2 |

## Build order

1. **Audio clock + level runner**: load an MP3, play it, report song time, and step through a hardcoded level JSON, switching clips at the right times.
2. **Minigame contract + first 3 minigames**.
3. **Lives system, buffer zones, Game Over flow** (Restart Level / Main Menu).
4. **Timeline editor**: MP3 upload, waveform, scrub/play from playhead, drag to move clips, drag edges to resize (task games snap to `baseDuration` multiples), beat-grid snapping, save/load levels to IndexedDB.
5. **Media track**: background images and video behind minigames, frosted cover effects, video synced to the audio clock, and a media track in the editor.
6. **Level packs**: export and import `.pwlevel` zips (see Level packs above).
7. **Polish**: latency calibration, score and end-of-level rank, practice mode (infinite lives), undo/redo, in-editor minigame preview, keyboard + touch + gamepad input.

## Suggested folder structure

```
public/
  assets/sprites/  # Piskel art, served as static URLs (e.g. /assets/sprites/idle_character/pirate.png)
    floortiles/ idle_character/ jumping_character/ mousecursor/
src/
  main.ts
  audio/        # AudioClock, MP3 loading, hashing
  engine/       # LevelRunner, lives, game over, buffer zones
  minigames/    # one folder per minigame, each implementing MiniGame
  editor/       # timeline editor UI
  storage/      # IndexedDB helpers
  types/        # shared types (MiniGame, Level, Clip)
```

## Current status

Not started. Next step: Build order step 1, starting with the `AudioClock` (load an uploaded MP3 and report accurate song time).
