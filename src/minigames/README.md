# Making a minigame

Pick a game from [`MINIGAMES.md`](../../MINIGAMES.md), put your name next to it, then follow these steps.

## 1. Copy a template

| Your game is... | Copy this folder |
|---|---|
| **Task**: complete one task per cycle (e.g. fire on the beat, scrub a spot) | `_template_task/` |
| **Duration**: survive until the clip ends (e.g. dodge, balance) | `_template_duration/` |

Copy it to `src/minigames/<game_id>/`, using the ID from `MINIGAMES.md` (e.g. `src/minigames/fire_cannon/`).

## 2. Rename

In your copied `index.ts`:
- Rename the class (e.g. `TemplateTaskGame` to `FireCannonGame`).
- Set `meta.id` to your folder name, and fill in the rest of `meta` from `MINIGAMES.md`:
  - Task games: `prompt`, `hint`, `baseBeats`, and `defaultHits` if the spec lists one.
  - Duration games: `prompt`, `hint`, `minDuration` (seconds), `canBeatSync` (`true` if the spec says Beat sync: optional, `false` if it says no), and `defaultHits` if the spec lists one.

## 3. Build your game

The template already works as a placeholder. Replace the parts marked `Replace with your game's...`.

| Method | When it runs | What to do |
|---|---|---|
| `preload(load)` | Once, when the game boots | Queue your sprites and sounds. |
| `start(params)` | When your clip begins | Create your sprites in `params.scene`. Save `params` for later. |
| `update(songTime)` | Every frame | Move things, check win/fail, update visuals. |
| `handleInput(input)` | On every button press/release or pointer move | React to the player. |
| `status()` | Whenever the engine asks | Return `'running'`, `'won'`, or `'failed'`. |
| `destroy()` | When your clip ends | Remove everything you added to the scene. |

What's in `params`: `scene` (draw here), `startTime` (song time your clip starts), `duration` (clip length in seconds), `reps` (how many tasks to do; always 1 for duration games), `bpm` (song tempo), `beatSync`, and `difficulty`.

One beat lasts `60 / params.bpm` seconds. Use it to put cues and animations on the beat.

**Beat maps (`params.hits`):** if your game has discrete moments, like "press on the beat" or "a slam lands now", give `meta` a `defaultHits` pattern (beats from the start of one cycle; for duration games, one 4-beat bar). Level designers can then add, remove, or move every hit in the editor, osu-style, including offbeats. Your game gets the result as `params.hits`: song times, in order.
- **Task games:** judge each press with `judgePress` from `src/minigames/shared/judgePress.ts`, so every rhythm game has the same timing feel. A press within ±`HIT_WINDOW` (0.16 s) of the hit counts. Pressing too early (in the run-up to a hit) or letting the window pass fails the game. The task template shows how, with an approach ring.
- **Beat-synced duration games:** make each hazard land at a time in `params.hits`.
- `params.hits` is `null` when your game has no `defaultHits` (e.g. Swab the Deck) or beat sync is off, so fall back to your own timing.

**Beat sync for duration games:** if your game has `canBeatSync: true`, check `params.beatSync` in `start()`. When it's `true`, time your hazards to the beat. When it's `false`, use your own timing. The duration template shows a simple example. Task games are always on the beat, and `params.beatSync` is always `true` for them.

## 4. The rules (please read)

1. **Time comes from `songTime` only.** Never use `setTimeout`, `setInterval`, `Date.now()`, or count frames. If something moves, move it by `speed * (songTime - lastSongTime)`. The templates show how.
2. **Never end early.** If the player wins before the clip is over, set `'won'` and keep showing a victory state until `destroy()` is called. The level has to stay in sync with the music.
3. **`'failed'` is final.** Once a game has failed, it stays failed. The engine takes away a life, and the music keeps going.
4. **Clean up.** Add every game object you create to `this.objects` so `destroy()` removes it. Anything left behind will show up in the next minigame.
5. **Size things relative to the screen.** Use `params.scene.scale.width` and `height`, not fixed pixel positions.
6. **Use the abstract buttons.** Listen for `'left'`, `'right'`, `'up'`, `'down'`, `'action'`, or pointer input (`x`, `y` from 0 to 1). Never read the keyboard directly, so touch and gamepad work for free.
7. **Never import from another minigame or from `src/engine/`.** Import types from `src/types/minigame.ts` and shared helpers from `src/minigames/shared/` only.

## 5. Art and sound

Put your files in `public/assets/minigames/<game_id>/` and load them in `preload` with keys that start with your game ID, so two games never clash:

```ts
preload(load: Phaser.Loader.LoaderPlugin): void {
  load.image('fire_cannon_fuse', '/assets/minigames/fire_cannon/fuse.png')
}
```

## 6. Register it

Add your game to `src/minigames/registry.ts`:

```ts
import { FireCannonGame } from './fire_cannon'

export const minigames: Record<string, () => MiniGame> = {
  fire_cannon: () => new FireCannonGame(),
}
```

Then tick your game off in `MINIGAMES.md`.

## Playing your game: the sandbox

1. Run `npm run dev` and open `http://localhost:5173/sandbox.html`.
2. Pick your game from the **Game** list. It shows the templates plus everything in `registry.ts`, so register your game early, even half-finished.
3. Set the **BPM**, **Length**, and **Difficulty**, tick **Beat sync** if your game supports it, and press **Start**.
4. You'll hear a metronome. One bar of count-in shows your prompt and hint, then your game runs for the clip length, and then the result shows up: `WON`, `FAILED`, or a warning if a task game was still `running` at the end. That warning means you have a bug.

Task game lengths snap to whole cycles, just like in the editor, so the clip may come out a bit shorter or longer than the number you typed. The sandbox reloads automatically when you save a file.

## Checking your work

- `npx tsc --noEmit` must pass with no errors.
- `npm test` must stay green. If your game has logic you can check without drawing (e.g. "was this press on the beat?"), put it in a plain function and add a `*.test.ts` next to it.
