import Phaser from 'phaser'
import { hitTimes, repsFor } from '../engine/clipRules'
import { allGames } from '../minigames/allGames'
import { textStyle } from '../minigames/shared/font'
import type { GameClip } from '../types/level'
import type { GameInput, MiniGame, MiniGameParams } from '../types/minigame'
import type { MetronomeClock } from './MetronomeClock'

const COUNT_IN_BEATS = 4 // one bar of clicks before the clip starts

export interface SandboxRun {
  id: string
  bpm: number
  length: number // requested clip length in seconds; task games snap it to whole cycles
  difficulty: number
  beatSync: boolean
}

// Plays one minigame as if it were a clip in a level: a one-bar count-in, the clip, then the result.
export class SandboxScene extends Phaser.Scene {
  private readonly clock: MetronomeClock
  private current: MiniGame | null = null
  private params: MiniGameParams | null = null
  private started = false
  private endTime = 0
  private hud!: Phaser.GameObjects.Text

  constructor(clock: MetronomeClock) {
    super('sandbox')
    this.clock = clock
  }

  preload(): void {
    for (const make of Object.values(allGames)) make().preload?.(this.load)
  }

  create(): void {
    this.hud = this.add.text(8, 8, 'Pick a game and press Start', textStyle(12)).setDepth(1000)
    for (const phase of ['down', 'move', 'up'] as const) {
      this.input.on(`pointer${phase}`, (pointer: Phaser.Input.Pointer) => {
        const x = Phaser.Math.Clamp(pointer.x / this.scale.width, 0, 1)
        const y = Phaser.Math.Clamp(pointer.y / this.scale.height, 0, 1)
        this.send({ kind: 'pointer', phase, x, y, songTime: this.clock.songTime() })
      })
    }
  }

  // Sets up a run. Clip lengths follow the same rules the editor will enforce.
  async play(run: SandboxRun): Promise<void> {
    this.current?.destroy()
    this.current = null

    const game = allGames[run.id]()
    const meta = game.meta
    const beatLength = 60 / run.bpm
    const duration =
      meta.kind === 'task'
        ? repsFor(meta, run.length, run.bpm) * meta.baseBeats * beatLength
        : Math.max(run.length, meta.minDuration)
    const startTime = COUNT_IN_BEATS * beatLength

    // The sandbox plays each game with its default beat map, exactly as a fresh clip in the editor would.
    const clip: GameClip = {
      type: 'game',
      gameId: run.id,
      start: startTime,
      end: startTime + duration,
      difficulty: run.difficulty,
      beatSync: run.beatSync,
    }

    await this.clock.start(run.bpm)
    this.params = {
      scene: this,
      startTime,
      duration,
      reps: repsFor(meta, duration, run.bpm),
      bpm: run.bpm,
      beatSync: meta.kind === 'task' || (run.beatSync && meta.canBeatSync),
      hits: hitTimes(meta, clip, run.bpm),
      difficulty: run.difficulty,
    }
    this.endTime = startTime + duration
    this.started = false
    this.current = game
  }

  // Forwards input to the running minigame, the same way the engine will.
  send(input: GameInput): void {
    if (this.current && this.started) this.current.handleInput(input)
  }

  update(): void {
    this.clock.scheduleClicks()
    const game = this.current
    const params = this.params
    if (!game || !params) return
    const time = this.clock.songTime()

    if (!this.started) {
      if (time < params.startTime) {
        const beatsLeft = Math.ceil((params.startTime - time) / (60 / params.bpm))
        this.hud.setText(`${game.meta.prompt}   ${game.meta.hint}   ${beatsLeft}`)
        return
      }
      game.start(params)
      this.started = true
    }

    if (time < this.endTime) {
      game.update(time)
      const reps = game.meta.kind === 'task' ? `   reps ${params.reps}` : ''
      this.hud.setText(`${game.meta.id}   ${(this.endTime - time).toFixed(1)}s left${reps}   ${game.status()}`)
      return
    }

    // Clip end: one last update, read the result, clean up. Same order the engine uses.
    game.update(this.endTime)
    const result = game.status()
    game.destroy()
    this.current = null
    this.clock.stop()
    const verdict =
      result === 'running' && game.meta.kind === 'task'
        ? 'STILL RUNNING AT CLIP END (bug: task games must end won or failed)'
        : result === 'failed'
          ? 'FAILED'
          : 'WON'
    this.hud.setText(`${verdict}   Press Start to play again`)
  }
}
