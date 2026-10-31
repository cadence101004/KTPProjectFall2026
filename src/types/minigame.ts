import type Phaser from 'phaser'

// The only way the engine talks to a minigame. The engine never reaches into a minigame's internals.

export type GameKind = 'duration' | 'task'
export type Status = 'running' | 'won' | 'failed'

// How one hit went, for the level's score and rank (see src/minigames/shared/judgePress.ts).
export type HitGrade = 'perfect' | 'great' | 'good' | 'miss'

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
  // True if this game's background (e.g. a sky over a floor) can be hidden so a level video shows through,
  // which turns on the editor's "Minigame background" checkbox. Leave it out for games whose background is
  // the playfield itself (a deck, a hull wall); those always draw it.
  canHideBackground?: boolean
  // On/off switches a level designer can set per clip (e.g. "Moving platforms"), each shown as a checkbox
  // in the editor and sandbox. The game reads the chosen values from MiniGameParams.options.
  options?: GameOption[]
}

export interface GameOption {
  id: string // key in GameClip.options and MiniGameParams.options, e.g. 'movingPlatforms'
  label: string // checkbox text, e.g. 'Moving platforms'
  default: boolean
}

// Task games: one task per cycle of baseBeats, always on the song's beat.
export interface TaskMeta extends BaseMeta {
  kind: 'task'
  baseBeats: number
  // Games with discrete hits (press on the beat) set this: the default hits in one cycle, in beats from the
  // cycle's start, e.g. [1] = one press on the cycle's 2nd beat. Level designers can then edit every hit
  // per clip (its beat map). Leave it out for games without discrete hits, like scrubbing.
  defaultHits?: number[]
}

// Duration games: survive until the clip ends. Free timing unless the game supports beat sync and the clip turns it on.
export interface DurationMeta extends BaseMeta {
  kind: 'duration'
  minDuration: number // seconds: shortest clip allowed
  canBeatSync: boolean // true if the game can time its hazards to the beat when GameClip.beatSync is on
  // Beat-synced games set this: default hazard times in one bar (4 beats), in beats from the bar's start.
  // With beat sync on, the clip's beat map says exactly when each hazard hits.
  defaultHits?: number[]
}

export type MiniGameMeta = TaskMeta | DurationMeta

export interface MiniGameParams {
  scene: Phaser.Scene // where the minigame draws; it must clean up everything it adds in destroy()
  startTime: number // clip start in song time
  duration: number // clip length in seconds
  reps: number // task games: how many tasks fit in the clip. Duration games: always 1
  bpm: number // the level's tempo; one beat is 60 / bpm seconds
  beatSync: boolean // time things to the beat. Always true for task games; per clip for duration games
  // The clip's beat map as song times, in order: when to press (task games) or when hazards hit
  // (beat-synced duration games). Null if the game has no defaultHits, or beat sync is off.
  hits: number[] | null
  difficulty: number
  // Whether to draw the background layer (e.g. the sky). Only ever false for games with canHideBackground,
  // when the level designer turned it off for this clip so the level's media track shows through. Always
  // draw the foreground (floors, characters, props), and draw the background first so it stays behind.
  background: boolean
  // The value of every option in meta.options for this clip (the clip's choice, or the option's default).
  options: Record<string, boolean>
  // Call once for each hit the player makes or misses, so it counts toward the level's score and rank.
  // Games without discrete hits don't need it: the engine scores their clip by whether it was won.
  report: (grade: HitGrade) => void
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
