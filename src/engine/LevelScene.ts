import Phaser from 'phaser'
import { allGames, metaFor } from '../minigames/allGames'
import type { Clip, GameClip, Level } from '../types/level'
import type { GameInput, MiniGame } from '../types/minigame'
import { hitTimes, repsFor } from './clipRules'
import { COUNT_LABELS, type CountdownCue, goLead, planCountdown } from './countdown'
import { LevelRunner, type RunnerEvent, type TimeSource } from './LevelRunner'

export const START_LIVES = 3

// The song clock plus sound effects scheduled on it. AudioClock provides both.
export interface LevelClock extends TimeSource {
  playSfx(buffer: AudioBuffer, songTime: number, rate?: number, fileOffset?: number): void
}

// The 321GO sound and where its four counts fall inside the file (see countdownBeats).
export interface CountdownSound {
  buffer: AudioBuffer
  beats: number[]
}

// Plays a level: steps through its clips on the song clock, runs each minigame through the MiniGame
// contract, shows buffer screens, and keeps lives. The editor preview and the real game both use this.
export class LevelScene extends Phaser.Scene {
  private readonly clock: LevelClock
  private countdownSound: CountdownSound | null = null
  private countdown: { cue: CountdownCue; hint: string } | null = null // the cue running in the current buffer
  private level: Level | null = null
  private runner: LevelRunner | null = null
  private current: { game: MiniGame; clip: GameClip } | null = null
  private lives = START_LIVES
  private running = false
  private hud!: Phaser.GameObjects.Text // lives, top left
  private banner!: Phaser.GameObjects.Text // big center text: buffer info, prompts, results

  constructor(clock: LevelClock) {
    super('level')
    this.clock = clock
  }

  // Without a countdown sound, buffers still work; they just skip the 321GO cue.
  setCountdownSound(sound: CountdownSound): void {
    this.countdownSound = sound
  }

  preload(): void {
    for (const make of Object.values(allGames)) make().preload?.(this.load)
  }

  create(): void {
    this.hud = this.add.text(8, 8, '', { fontSize: '14px' }).setDepth(1000)
    this.banner = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Press Preview to play the level', {
        fontSize: '18px',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(1000)
    for (const phase of ['down', 'move', 'up'] as const) {
      this.input.on(`pointer${phase}`, (pointer: Phaser.Input.Pointer) => {
        const x = Phaser.Math.Clamp(pointer.x / this.scale.width, 0, 1)
        const y = Phaser.Math.Clamp(pointer.y / this.scale.height, 0, 1)
        this.send({ kind: 'pointer', phase, x, y, songTime: this.clock.songTime() })
      })
    }
  }

  // Starts playing `level` from song time `time`, with full lives. The caller starts the audio there too.
  startAt(level: Level, time: number): void {
    this.endCurrent(false)
    this.level = level
    this.runner = new LevelRunner(level, this.clock)
    this.runner.seek(time)
    this.lives = START_LIVES
    this.countdown = null
    this.running = true
    this.banner.setText('')
    this.drawHud()
  }

  // Stops playing and clears the screen.
  stop(): void {
    this.endCurrent(false)
    this.running = false
    this.runner = null
    this.countdown = null
    this.banner.setText('Press Preview to play the level')
    this.hud.setText('')
  }

  // Forwards input to the running minigame.
  send(input: GameInput): void {
    this.current?.game.handleInput(input)
  }

  update(): void {
    if (!this.running || !this.runner) return
    for (const event of this.runner.update()) this.handle(event)
    const time = this.clock.songTime()
    this.current?.game.update(time)
    this.drawCountdown(time)
  }

  private handle(event: RunnerEvent): void {
    if (event.type === 'levelEnd') {
      this.banner.setText(this.lives > 0 ? 'LEVEL COMPLETE!' : 'GAME OVER')
      return
    }
    const clip = event.clip
    if (event.type === 'clipStart') {
      if (clip.type === 'game') this.startGame(clip)
      else this.showBuffer(event.index)
    } else if (clip.type === 'game') {
      this.endCurrent(true)
    } else {
      this.banner.setText('')
    }
  }

  // Creates the clip's minigame and starts it. Unknown game IDs show a notice instead of crashing.
  private startGame(clip: GameClip): void {
    const make = allGames[clip.gameId]
    const meta = metaFor(clip.gameId)
    if (!make || !meta || !this.level) {
      this.banner.setText(`Unknown minigame: ${clip.gameId}`)
      return
    }
    this.countdown = null
    const game = make()
    const duration = clip.end - clip.start
    game.start({
      scene: this,
      startTime: clip.start,
      duration,
      reps: repsFor(meta, duration, this.level.bpm),
      bpm: this.level.bpm,
      beatSync: meta.kind === 'task' || (!!clip.beatSync && meta.canBeatSync),
      hits: hitTimes(meta, clip, this.level.bpm),
      difficulty: clip.difficulty,
    })
    this.current = { game, clip }
    this.flash(meta.prompt)
  }

  // Ends the running minigame. When `judge` is set, a failure (or a task game still running) costs a life.
  private endCurrent(judge: boolean): void {
    if (!this.current) return
    const { game, clip } = this.current
    this.current = null
    if (judge) {
      game.update(clip.end) // lets a task game see its last window close
      const status = game.status()
      const failed = status === 'failed' || (status === 'running' && game.meta.kind === 'task')
      if (failed) {
        this.lives = Math.max(0, this.lives - 1)
        this.flash(this.lives > 0 ? 'MISS!' : 'GAME OVER')
      }
      this.drawHud()
    }
    game.destroy()
  }

  // Buffer screen: lives left and what's coming next. If a minigame follows, the 321GO cue is scheduled
  // so that GO lands a breather (goLead) before it starts, or at the buffer's start if the buffer is shorter.
  private showBuffer(index: number): void {
    if (!this.level) return
    const buffer = this.level.clips[index]
    const next = this.level.clips[index + 1]
    this.banner.setText(`${'♥'.repeat(this.lives) || 'no lives left'}\n\n${nextLabel(next)}`)
    if (next?.type !== 'game' || !this.countdownSound) return
    const goTime = Math.max(buffer.start, next.start - goLead(this.level.bpm))
    const cue = planCountdown(this.countdownSound.beats, goTime, buffer.start, this.level.bpm, this.level.countdownRate)
    this.clock.playSfx(this.countdownSound.buffer, cue.soundAt, cue.rate, cue.fileOffset)
    this.countdown = { cue, hint: metaFor(next.gameId)?.hint ?? '' }
  }

  // Shows 3, 2, 1 with the next game's controls, each count appearing on its beat.
  private drawCountdown(time: number): void {
    if (!this.countdown) return
    const count = this.countdown.cue.beats.findLastIndex(beat => time >= beat)
    if (count >= 0) this.banner.setText(`${COUNT_LABELS[count]}\n\n${this.countdown.hint}`)
  }

  // Briefly shows big text, e.g. a minigame's prompt.
  private flash(text: string): void {
    const label = this.add
      .text(this.scale.width / 2, this.scale.height * 0.25, text, { fontSize: '32px', fontStyle: 'bold', color: '#ffcc4d' })
      .setOrigin(0.5)
      .setDepth(1001)
    this.tweens.add({ targets: label, alpha: 0, scale: 1.3, duration: 600, onComplete: () => label.destroy() })
  }

  private drawHud(): void {
    this.hud.setText(`${'♥'.repeat(this.lives)}${'♡'.repeat(START_LIVES - this.lives)}`)
  }
}

// "Next: FIRE! (SPACE)" for the clip after a buffer.
function nextLabel(clip: Clip | undefined): string {
  if (!clip) return 'Last stretch!'
  if (clip.type === 'buffer') return ''
  const meta = metaFor(clip.gameId)
  return meta ? `Next: ${meta.prompt}  (${meta.hint})` : `Next: ${clip.gameId}`
}
