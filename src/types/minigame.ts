import type Phaser from 'phaser'

// The only way the engine talks to a minigame. The engine never reaches into a minigame's internals.

export type GameKind = 'duration' | 'task'
export type Status = 'running' | 'won' | 'failed'

// Device-independent buttons. Keyboard, touch, and gamepad all map onto these.
export type GameButton = 'left' | 'right' | 'up' | 'down' | 'action'

// Every input carries the song time it happened at, so timing is judged on the audio clock.
export type GameInput =
  | { kind: 'button'; button: GameButton; pressed: boolean; songTime: number }
  | { kind: 'pointer'; phase: 'down' | 'move' | 'up'; x: number; y: number; songTime: number } // x, y in 0..1

interface BaseMeta {
  id: string // matches GameClip.gameId and the folder name, e.g. 'fire_cannon'
  prompt: string // command flashed at start, e.g. 'FIRE!'
  hint: string // control hint flashed with the countdown, e.g. 'SPACE'
}

// Task games: one task per cycle of baseBeats, always on the song's beat.
export interface TaskMeta extends BaseMeta {
  kind: 'task'
  baseBeats: number
}

// Duration games: survive until the clip ends. Free timing unless the game supports beat sync and the clip turns it on.
export interface DurationMeta extends BaseMeta {
  kind: 'duration'
  minDuration: number // seconds: shortest clip allowed
  canBeatSync: boolean // true if the game can time its hazards to the beat when GameClip.beatSync is on
}

export type MiniGameMeta = TaskMeta | DurationMeta

export interface MiniGameParams {
  scene: Phaser.Scene // where the minigame draws; it must clean up everything it adds in destroy()
  startTime: number // clip start in song time
  duration: number // clip length in seconds
  reps: number // task games: how many tasks fit in the clip. Duration games: always 1
  bpm: number // the level's tempo; one beat is 60 / bpm seconds
  beatSync: boolean // time things to the beat. Always true for task games; per clip for duration games
  difficulty: number
}

export interface MiniGame {
  meta: MiniGameMeta
  preload?(load: Phaser.Loader.LoaderPlugin): void // queue sprites and sounds; the engine calls this once at boot
  start(params: MiniGameParams): void
  update(songTime: number): void
  handleInput(input: GameInput): void
  status(): Status
  destroy(): void
}
