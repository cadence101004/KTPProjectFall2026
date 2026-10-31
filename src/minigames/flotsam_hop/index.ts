// Flotsam Hop: hop across rafts and floating barrels over the sea. Run (left and right) and jump (up or
// action) with real gravity. Rafts bob on the beat (the middle one slides too) and barrels drift past. On
// each beat map hit, the raft she's standing on shakes for a beat and sinks, so she has to hop to another.
// Falling in the sea respawns her on a safe raft; the third fall knocks her out. Survive to the end to win.
// Spec in MINIGAMES.md. The pirate is Cadence's; rafts and barrels are placeholder shapes.
import type Phaser from 'phaser'
import type { DurationMeta, GameInput, MiniGame, MiniGameParams, Status } from '../../types/minigame'
import { DEATH_FREEZE, deathLift } from '../shared/deathFall'
import { textStyle } from '../shared/font'
import { showJudgement } from '../shared/judgeText'
import { u } from '../shared/units'
import { barrelX, type Body, DRIFT_SPEED, type Platform, type Raft, raftAt, SEA_Y, sinkState, sinkTimes, step } from './physics'

// Texture keys, prefixed with the game ID so they never clash with another game's. The art faces right.
const STAND = 'flotsam_hop_stand'
const RUN = ['flotsam_hop_stand', 'flotsam_hop_run'] // pirateside1 and pirateside2 alternate as a run cycle
const RISE = 'flotsam_hop_rise'
const FALL = 'flotsam_hop_fall'
const DEATH_JUMP = 'flotsam_hop_death_jump'

const SKY_COLOR = 0x8fd3f4
const SEA_COLOR = 0x2f7fb8
const RAFT_COLOR = 0x9b6a3a
const BARREL_COLOR = 0x7a4d24
const FALL_LIMIT = 3 // the third fall knocks her out
const BARREL_BEATS = 4 // a barrel sets off from the right edge every this many beats
const BARREL_Y = 0.52 // barrels float higher than the rafts, as a second route
const BARREL_WIDTH = 0.07
const JUMP_BUFFER = 0.12 // seconds a jump press is remembered, so pressing just before landing still jumps
const RESPAWN_BLINK = 1 // seconds she blinks after respawning
const STEP_TIME = 0.14 // seconds per running frame
const MAX_SUBSTEP = 1 / 240 // physics steps at most this long, so fast falls can't skip through a platform

const RAFTS: Raft[] = [
  { x: 0.2, y: 0.68, width: 0.17, bobBeats: 2, bob: 0.025, slideBeats: 4, slide: 0, phase: 0 },
  { x: 0.5, y: 0.68, width: 0.17, bobBeats: 2, bob: 0.025, slideBeats: 4, slide: 0.07, phase: 0.33 },
  { x: 0.8, y: 0.68, width: 0.17, bobBeats: 2, bob: 0.025, slideBeats: 4, slide: 0, phase: 0.66 },
]

interface Sink {
  at: number // song time the raft goes under
  raft: number // which raft, chosen when its warning starts (-1 until then)
}

export class FlotsamHopGame implements MiniGame {
  meta: DurationMeta = {
    id: 'flotsam_hop',
    kind: 'duration',
    prompt: 'HOP!',
    hint: '← →  ↑ JUMP',
    canHideBackground: true, // a sky over the sea: hide it to put a level video behind the rafts
    minDuration: 4,
    canBeatSync: true,
    defaultHits: [0], // beat sync on: a raft sinks on the first beat of each bar
  }

  private params!: MiniGameParams
  private result: Status = 'running'
  private beatLength = 0.5
  private sinks: Sink[] = []
  private barrels: number[] = [] // the song time each barrel sets off from the right edge
  private body: Body = { x: 0.5, y: RAFTS[1].y, vy: 0, on: 1 }
  private running = { left: false, right: false }
  private facingLeft = false
  private jumpPressedAt = -Infinity
  private falls = 0
  private respawnedAt = -Infinity
  private diedAt: number | null = null
  private lastTime = 0
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private raftShapes: Phaser.GameObjects.Rectangle[] = []
  private barrelShapes: Phaser.GameObjects.Ellipse[] = []
  private pirate!: Phaser.GameObjects.Image
  private label!: Phaser.GameObjects.Text

  preload(load: Phaser.Loader.LoaderPlugin): void {
    load.image(RUN[0], '/assets/sprites/idle_character/pirateside1.png')
    load.image(RUN[1], '/assets/sprites/idle_character/pirateside2.png')
    load.image(RISE, '/assets/sprites/jumping_character/jumpingsideways1.png')
    load.image(FALL, '/assets/sprites/jumping_character/jumpingsideways2.png')
    load.image(DEATH_JUMP, '/assets/sprites/jumping_character/jumpingforwards.png')
  }

  // Plans the sinks and the barrels, then builds the sky, rafts, barrels, pirate, sea, and text.
  start(params: MiniGameParams): void {
    this.params = params
    this.lastTime = params.startTime
    this.beatLength = 60 / params.bpm
    this.sinks = sinkTimes(params.hits, params.startTime, params.duration, this.beatLength, Math.random).map(at => ({ at, raft: -1 }))
    // Barrels set off every BARREL_BEATS, starting early enough that some are already crossing at the start.
    const every = BARREL_BEATS * this.beatLength
    for (let at = params.startTime - 1.2 / DRIFT_SPEED; at < params.startTime + params.duration; at += every) this.barrels.push(at)

    const { scene } = params
    const { width, height } = scene.scale
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      this.objects.push(object)
      return object
    }

    // Background layer (the sky), skipped when the level turns it off. Everything after is the foreground.
    if (params.background) add(scene.add.rectangle(width / 2, (SEA_Y * height) / 2, width, SEA_Y * height, SKY_COLOR))
    this.raftShapes = RAFTS.map(raft =>
      add(scene.add.rectangle(0, 0, raft.width * width, height * 0.035, RAFT_COLOR).setOrigin(0.5, 0).setStrokeStyle(u(scene, 1.5), 0x5c3a1a)),
    )
    this.barrelShapes = this.barrels.map(() =>
      add(scene.add.ellipse(0, 0, BARREL_WIDTH * width, height * 0.06, BARREL_COLOR).setOrigin(0.5, 0).setStrokeStyle(u(scene, 1.5), 0x3e2614)),
    )
    this.pirate = add(scene.add.image(0, 0, STAND).setOrigin(0.5, 1))
    this.pirate.setScale((height * 0.2) / this.pirate.height)
    // The sea is foreground, drawn over the pirate, so she visibly falls into the water.
    add(scene.add.rectangle(width / 2, (SEA_Y + 1) * height / 2, width, (1 - SEA_Y) * height, SEA_COLOR).setAlpha(0.92).setDepth(2))
    this.label = add(scene.add.text(width / 2, height * 0.08, '', textStyle(Math.round(height * 0.06))).setOrigin(0.5).setDepth(3))
  }

  // Runs every frame: picks which raft each upcoming sink takes, moves the pirate in small physics steps on
  // song time, handles a fall into the sea, checks for the win at the clip's end, then draws.
  update(songTime: number): void {
    this.chooseSinkingRafts(songTime)
    const dt = Math.min(0.1, Math.max(0, songTime - this.lastTime))
    if (this.diedAt === null && dt > 0) {
      const steps = Math.ceil(dt / MAX_SUBSTEP)
      for (let i = 0; i < steps; i++) this.move(this.lastTime + (dt * i) / steps, this.lastTime + (dt * (i + 1)) / steps)
    }
    this.lastTime = songTime
    if (this.diedAt === null && this.body.y > SEA_Y + 0.03) this.fellIn(songTime)
    if (this.result === 'running' && songTime >= this.params.startTime + this.params.duration) this.result = 'won'
    this.draw(songTime)
  }

  // Hold left or right to run; up or action jumps.
  handleInput(input: GameInput): void {
    if (input.kind !== 'button') return
    if (input.button === 'left') this.running.left = input.pressed
    if (input.button === 'right') this.running.right = input.pressed
    if ((input.button === 'up' || input.button === 'action') && input.pressed) this.jumpPressedAt = input.songTime
  }

  status(): Status {
    return this.result
  }

  destroy(): void {
    for (const object of this.objects) object.destroy()
    this.objects = []
  }

  // Every platform's position at `songTime`: the rafts (not solid while sunk), then the barrels.
  private platformsAt(songTime: number): Platform[] {
    const rafts = RAFTS.map((raft, i) => {
      const { x, y } = raftAt(raft, songTime, this.beatLength)
      return { x, y, width: raft.width, solid: this.raftState(i, songTime) !== 'sunk' }
    })
    const barrels = this.barrels.map(launched => ({ x: barrelX(launched, songTime), y: BARREL_Y, width: BARREL_WIDTH, solid: true }))
    return [...rafts, ...barrels]
  }

  // Whether raft `i` is normal, shaking (about to sink), or sunk right now.
  private raftState(i: number, songTime: number): 'normal' | 'warning' | 'sunk' {
    for (const sink of this.sinks) {
      if (sink.raft !== i) continue
      const state = sinkState(songTime, sink.at, this.beatLength)
      if (state !== 'normal') return state
    }
    return 'normal'
  }

  // When a sink's warning starts, it takes the raft she's standing on (that's the pressure to move), or a
  // random raft if she's on a barrel or in the air.
  private chooseSinkingRafts(songTime: number): void {
    for (const sink of this.sinks) {
      if (sink.raft >= 0 || songTime < sink.at - this.beatLength) continue
      sink.raft = this.body.on >= 0 && this.body.on < RAFTS.length ? this.body.on : Math.floor(Math.random() * RAFTS.length)
    }
  }

  // One physics step from `from` to `to`. A jump pressed within JUMP_BUFFER counts, so a press just before
  // landing still jumps.
  private move(from: number, to: number): void {
    const run = (this.running.right ? 1 : 0) - (this.running.left ? 1 : 0)
    if (run) this.facingLeft = run < 0
    const jump = to - this.jumpPressedAt < JUMP_BUFFER
    const { width, height } = this.params.scene.scale
    const wasOn = this.body.on
    this.body = step(this.body, run, jump, to - from, this.platformsAt(from), this.platformsAt(to), width / height)
    if (wasOn >= 0 && this.body.on < 0 && this.body.vy < 0) this.jumpPressedAt = -Infinity // that press was used
  }

  // She fell in the sea: a splash, and a respawn on a raft that isn't about to sink, or knocked out on the
  // third fall.
  private fellIn(songTime: number): void {
    const { scene } = this.params
    this.objects.push(showJudgement(scene, 'miss', null, this.body.x * scene.scale.width, SEA_Y * scene.scale.height - scene.scale.height * 0.1))
    this.falls++
    if (this.falls >= FALL_LIMIT) {
      this.result = 'failed'
      this.diedAt = songTime
      this.body = { ...this.body, y: SEA_Y, vy: 0 }
      return
    }
    const safe = RAFTS.map((_, i) => i).find(i => this.raftState(i, songTime) === 'normal' && this.raftState(i, songTime + this.beatLength) === 'normal') ?? 1
    const raft = raftAt(RAFTS[safe], songTime, this.beatLength)
    this.body = { x: raft.x, y: raft.y, vy: 0, on: safe }
    this.respawnedAt = songTime
  }

  // Rafts bob (shaking red before they sink, dipping under while sunk), barrels drift, and the pirate runs,
  // jumps, falls, blinks after a respawn, or does the shared death fall.
  private draw(songTime: number): void {
    const { width, height } = this.params.scene.scale
    const platforms = this.platformsAt(songTime)
    this.raftShapes.forEach((shape, i) => {
      const state = this.raftState(i, songTime)
      const shake = state === 'warning' ? Math.sin(songTime * 60) * width * 0.004 : 0
      shape.setPosition(platforms[i].x * width + shake, (platforms[i].y + (state === 'sunk' ? 0.07 : 0)) * height)
      shape.setFillStyle(state === 'warning' ? 0xd9534f : RAFT_COLOR).setAlpha(state === 'sunk' ? 0.35 : 1)
    })
    this.barrelShapes.forEach((shape, i) => {
      const barrel = platforms[RAFTS.length + i]
      shape.setPosition(barrel.x * width, barrel.y * height).setVisible(barrel.x > -0.1 && barrel.x < 1.1)
    })

    if (this.diedAt !== null) {
      const sinceDeath = songTime - this.diedAt
      this.pirate.setTexture(sinceDeath < DEATH_FREEZE ? STAND : DEATH_JUMP).setTint(0xff6b6b).setFlipX(false)
      this.pirate.setPosition(this.body.x * width, (this.body.y - deathLift(sinceDeath)) * height)
    } else {
      const airborne = this.body.on < 0
      const running = this.running.left !== this.running.right
      const texture = airborne ? (this.body.vy < 0 ? RISE : FALL) : running ? RUN[Math.floor(songTime / STEP_TIME) % 2] : STAND
      const blinking = songTime - this.respawnedAt < RESPAWN_BLINK && Math.floor(songTime * 12) % 2 === 0
      this.pirate.setTexture(texture).setFlipX(this.facingLeft).setPosition(this.body.x * width, this.body.y * height)
      this.pirate.setAlpha(blinking ? 0.3 : 1).clearTint()
    }

    if (this.result === 'won') this.label.setText(this.falls ? 'SEA LEGS!' : 'DRY AS A BONE!')
    else if (this.result === 'failed') this.label.setText('SWEPT AWAY!')
    else this.label.setText(this.falls ? `Falls ${this.falls} / ${FALL_LIMIT}` : '')
  }
}
