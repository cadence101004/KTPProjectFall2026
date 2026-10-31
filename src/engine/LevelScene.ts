import Phaser from 'phaser'
import { allGames, metaFor } from '../minigames/allGames'
import { textStyle } from '../minigames/shared/font'
import { u } from '../minigames/shared/units'
import type { Clip, GameClip, Level } from '../types/level'
import type { GameInput, HitGrade, MiniGame } from '../types/minigame'
import { hitTimes, repsFor } from './clipRules'
import { COUNT_LABELS, type CountdownCue, goLead, planCountdown } from './countdown'
import { LevelRunner, type RunnerEvent, type TimeSource } from './LevelRunner'
import { accuracyOf, addGrade, newSheet, type Rank, rankOf, type ScoreSheet, scoreClip, scoreOf } from './scoring'

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

// A button on the Game Over and results screens. The host (game or editor) decides what each one does.
export interface MenuOption {
  label: string
  action: () => void
}

const RANK_COLORS: Record<Rank, string> = { S: '#ffe066', A: '#7dffb0', B: '#7dc8ff', C: '#f4e9d0', D: '#ff9a6b' }

// Plays a level: steps through its clips on the song clock, runs each minigame through the MiniGame
// contract, shows buffer screens, keeps lives and score, and ends on a results screen (or Game Over).
// The editor preview and the real game both use this.
export class LevelScene extends Phaser.Scene {
  private readonly clock: LevelClock
  private countdownSound: CountdownSound | null = null
  private countdown: { cue: CountdownCue; hint: string } | null = null // the cue running in the current buffer
  private level: Level | null = null
  private runner: LevelRunner | null = null
  // The running minigame, plus how many hits its beat map has and how many it has reported, for scoring.
  private current: { game: MiniGame; clip: GameClip; hitCount: number; reported: number } | null = null
  private lives = START_LIVES
  private practice = false // infinite lives: failures are counted instead
  private misses = 0
  private sheet: ScoreSheet = newSheet()
  private running = false
  private menuOptions: MenuOption[] = []
  // The Game Over or results overlay, while it's up: everything it drew, its buttons, and which is chosen.
  private menu: { objects: Phaser.GameObjects.GameObject[]; buttons: Phaser.GameObjects.Text[]; choice: number } | null =
    null
  private idleText = 'Press Start' // shown while no level is playing
  private hud!: Phaser.GameObjects.Text // lives, top left
  private scoreText!: Phaser.GameObjects.Text // score, top right
  private banner!: Phaser.GameObjects.Text // big center text: buffer info and the countdown

  constructor(clock: LevelClock) {
    super('level')
    this.clock = clock
  }

  // The message shown while nothing is playing, worded for the host page (e.g. "Press Preview...").
  setIdleText(text: string): void {
    this.idleText = text
    if (this.banner && !this.running) this.banner.setText(text)
  }

  // Without a countdown sound, buffers still work; they just skip the 321GO cue.
  setCountdownSound(sound: CountdownSound): void {
    this.countdownSound = sound
  }

  // Where the 3, 2, 1, GO counts fall inside the countdown sound, or null until it has loaded. The editor
  // uses this to show the auto countdown speed and to warn about buffers too short for the countdown.
  countdownFileBeats(): number[] | null {
    return this.countdownSound?.beats ?? null
  }

  // The buttons on the Game Over and results screens, e.g. Restart Level and Main Menu.
  setGameOverOptions(options: MenuOption[]): void {
    this.menuOptions = options
  }

  // Practice mode: no Game Over; failures are counted on the HUD instead of costing lives.
  setPractice(on: boolean): void {
    this.practice = on
    if (this.running) this.drawHud()
  }

  preload(): void {
    for (const make of Object.values(allGames)) make().preload?.(this.load)
  }

  create(): void {
    this.hud = this.add.text(0, 0, '', textStyle(u(this, 14))).setDepth(1000)
    this.scoreText = this.add.text(0, 0, '', textStyle(u(this, 14))).setOrigin(1, 0).setDepth(1000)
    this.banner = this.add
      .text(0, 0, this.idleText, textStyle(u(this, 18), { align: 'center' }))
      .setOrigin(0.5)
      .setDepth(1000)
    this.layoutHud()
    this.scale.on('resize', () => this.layoutHud()) // e.g. entering fullscreen changes the screen's shape
    for (const phase of ['down', 'move', 'up'] as const) {
      this.input.on(`pointer${phase}`, (pointer: Phaser.Input.Pointer) => {
        const x = Phaser.Math.Clamp(pointer.x / this.scale.width, 0, 1)
        const y = Phaser.Math.Clamp(pointer.y / this.scale.height, 0, 1)
        this.send({ kind: 'pointer', phase, x, y, songTime: this.clock.songTime() })
      })
    }
  }

  // Places the lives, score, and center banner for the current screen size.
  private layoutHud(): void {
    const { width, height } = this.scale
    this.hud.setPosition(u(this, 8), u(this, 8))
    this.scoreText.setPosition(width - u(this, 8), u(this, 8))
    this.banner.setPosition(width / 2, height / 2)
  }

  // Starts playing `level` from song time `time`, with full lives and a fresh score. The caller starts
  // the audio there too.
  startAt(level: Level, time: number): void {
    this.endCurrent(false)
    this.hideMenu()
    this.level = level
    this.runner = new LevelRunner(level, this.clock)
    this.runner.seek(time)
    this.lives = START_LIVES
    this.misses = 0
    this.sheet = newSheet()
    this.countdown = null
    this.running = true
    this.banner.setText('')
    this.drawHud()
  }

  // Stops playing and clears the screen.
  stop(): void {
    this.endCurrent(false)
    this.hideMenu()
    this.running = false
    this.runner = null
    this.countdown = null
    this.banner.setText(this.idleText)
    this.hud.setText('')
    this.scoreText.setText('')
  }

  // Forwards input to the running minigame, or to the Game Over / results menu while it's up.
  send(input: GameInput): void {
    if (this.menu) this.menuInput(input)
    else this.current?.game.handleInput(input)
  }

  update(): void {
    if (!this.running || !this.runner || this.menu) return
    for (const event of this.runner.update()) {
      this.handle(event)
      if (this.menu) return // nothing else runs after Game Over or the results; the music plays on underneath
    }
    const time = this.clock.songTime()
    this.current?.game.update(time)
    this.drawCountdown(time)
  }

  private handle(event: RunnerEvent): void {
    if (event.type === 'levelEnd') {
      this.showResults()
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
    const hits = hitTimes(meta, clip, this.level.bpm)
    const current = { game, clip, hitCount: hits?.length ?? 0, reported: 0 }
    game.start({
      scene: this,
      startTime: clip.start,
      duration,
      reps: repsFor(meta, duration, this.level.bpm),
      bpm: this.level.bpm,
      beatSync: meta.kind === 'task' || (!!clip.beatSync && meta.canBeatSync),
      hits,
      difficulty: clip.difficulty,
      report: (grade: HitGrade) => {
        if (this.current !== current) return // a stray report after the clip ended
        current.reported++
        addGrade(this.sheet, grade)
        this.drawHud()
      },
    })
    this.current = current
    this.flash(meta.prompt)
  }

  // Ends the running minigame. When `judge` is set, the clip is scored, and a failure (or a task game still
  // running) costs a life, or in practice mode adds a miss. Losing the last life brings up Game Over.
  private endCurrent(judge: boolean): void {
    if (!this.current) return
    const { game, clip, hitCount, reported } = this.current
    this.current = null
    let outOfLives = false
    if (judge) {
      game.update(clip.end) // lets a task game see its last window close
      const status = game.status()
      const failed = status === 'failed' || (status === 'running' && game.meta.kind === 'task')
      scoreClip(this.sheet, !failed, reported, hitCount)
      if (failed && this.practice) {
        this.misses++
        this.flash('MISS!')
      } else if (failed) {
        this.lives = Math.max(0, this.lives - 1)
        outOfLives = this.lives === 0
        if (!outOfLives) this.flash('MISS!')
      }
      this.drawHud()
    }
    game.destroy()
    if (outOfLives) this.showGameOver()
  }

  // Game Over: the level stops (the music keeps going), with the score so far and the host's options.
  private showGameOver(): void {
    this.showMenu('GAME OVER', '#ff6b6b', null, [`Score ${scoreOf(this.sheet).toLocaleString()}`])
  }

  // The level's end: a big rank letter, the score, accuracy, how each hit went, and the host's options.
  private showResults(): void {
    const { perfect, great, good, miss } = this.sheet.grades
    const cleared = this.sheet.games - this.sheet.fails
    const status = this.practice ? `Practice: ${this.misses} minigames missed` : `Lives left ${'♥'.repeat(this.lives)}`
    this.showMenu(this.practice ? 'LEVEL COMPLETE (PRACTICE)' : 'LEVEL COMPLETE!', '#ffcc4d', rankOf(this.sheet), [
      `Score ${scoreOf(this.sheet).toLocaleString()}    Accuracy ${(accuracyOf(this.sheet) * 100).toFixed(1)}%`,
      `Perfect ${perfect}   Great ${great}   Good ${good}   Miss ${miss}`,
      `Minigames cleared ${cleared} / ${this.sheet.games}    ${status}`,
    ])
  }

  // An overlay with a title, an optional rank letter, a few lines of stats, and the host's buttons along the
  // bottom. Arrows (or the mouse) choose a button; action picks it.
  private showMenu(title: string, color: string, rank: Rank | null, lines: string[]): void {
    this.countdown = null
    this.banner.setText('')
    const { width, height } = this.scale
    const objects: Phaser.GameObjects.GameObject[] = []
    const text = (y: number, content: string, size: number, style: Phaser.Types.GameObjects.Text.TextStyle = {}) => {
      const label = this.add.text(width / 2, y, content, textStyle(size, style)).setOrigin(0.5).setDepth(2001)
      objects.push(label)
      return label
    }
    objects.push(this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75).setDepth(2000))
    text(height * (rank ? 0.12 : 0.3), title, u(this, rank ? 22 : 40), { fontStyle: 'bold', color })
    if (rank) text(height * 0.33, rank, u(this, 72), { fontStyle: 'bold', color: RANK_COLORS[rank] })
    lines.forEach((line, i) => text(height * (rank ? 0.56 : 0.5) + i * u(this, 18), line, u(this, 12)))

    const buttons = this.menuOptions.map((option, index) => {
      const x = width / 2 + (index - (this.menuOptions.length - 1) / 2) * u(this, 170)
      const button = this.add
        .text(x, height * 0.86, option.label, textStyle(u(this, 18), { padding: { x: u(this, 12), y: u(this, 4) } }))
        .setOrigin(0.5)
        .setDepth(2001)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.chooseMenu(index))
        .on('pointerdown', () => option.action())
      objects.push(button)
      return button
    })
    this.menu = { objects, buttons, choice: 0 }
    this.chooseMenu(0)
  }

  private hideMenu(): void {
    for (const object of this.menu?.objects ?? []) object.destroy()
    this.menu = null
  }

  // Highlights one menu button.
  private chooseMenu(choice: number): void {
    if (!this.menu) return
    this.menu.choice = choice
    this.menu.buttons.forEach((button, index) => {
      button.setColor(index === choice ? '#123047' : '#ffffff')
      button.setBackgroundColor(index === choice ? '#ffcc4d' : '#00000000')
    })
  }

  // Arrows move between menu buttons; action picks one.
  private menuInput(input: GameInput): void {
    if (!this.menu || input.kind !== 'button' || !input.pressed) return
    const count = this.menu.buttons.length
    if (input.button === 'up' || input.button === 'left') this.chooseMenu((this.menu.choice + count - 1) % count)
    if (input.button === 'down' || input.button === 'right') this.chooseMenu((this.menu.choice + 1) % count)
    if (input.button === 'action') this.menuOptions[this.menu.choice]?.action()
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
      .text(this.scale.width / 2, this.scale.height * 0.25, text, textStyle(u(this, 32), { fontStyle: 'bold', color: '#ffcc4d' }))
      .setOrigin(0.5)
      .setDepth(1001)
    this.tweens.add({ targets: label, alpha: 0, scale: 1.3, duration: 600, onComplete: () => label.destroy() })
  }

  private drawHud(): void {
    this.hud.setText(
      this.practice
        ? `Practice   misses: ${this.misses}`
        : `${'♥'.repeat(this.lives)}${'♡'.repeat(START_LIVES - this.lives)}`,
    )
    this.scoreText.setText(scoreOf(this.sheet).toLocaleString())
  }
}

// "Next: FIRE! (SPACE)" for the clip after a buffer.
function nextLabel(clip: Clip | undefined): string {
  if (!clip) return 'Last stretch!'
  if (clip.type === 'buffer') return ''
  const meta = metaFor(clip.gameId)
  return meta ? `Next: ${meta.prompt}  (${meta.hint})` : `Next: ${clip.gameId}`
}
