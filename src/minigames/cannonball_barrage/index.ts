// Cannonball Barrage: an enemy cannon fires cannonballs across the deck, high or low. Jump (up) over the low
// ones and duck (hold down) under the high ones. With beat sync on, every ball reaches the pirate on a beat
// map hit. A dodge is a Perfect, a hit a Miss; a quarter or more hit knocks her out. Spec in MINIGAMES.md.
// Art by Cadence (the pirate, her jump frames, and the cannon, mirrored to face her).
import type Phaser from 'phaser'
import type { DurationMeta, GameInput, MiniGame, MiniGameParams, Status } from '../../types/minigame'
import { DEATH_FREEZE, deathLift } from '../shared/deathFall'
import { textStyle } from '../shared/font'
import { tooManyMisses } from '../shared/judgePress'
import { showJudgement } from '../shared/judgeText'
import { u } from '../shared/units'
import { arrivalTimes, type BallHeight, dodged, flight, JUMP_TIME, jumpLift, pickHeights } from './barrage'

// Texture keys, prefixed with the game ID so they never clash with another game's. The art faces right.
const STAND = 'cannonball_barrage_stand'
const RISE = 'cannonball_barrage_rise' // first half of a jump
const FALL = 'cannonball_barrage_fall' // second half
const DEATH_JUMP = 'cannonball_barrage_death_jump'
const CANNON = 'cannonball_barrage_cannon'
const CANNON_FIRING = 'cannonball_barrage_cannon_firing'
const BALL = 'cannonball_barrage_ball'

const SKY_COLOR = 0x8fd3f4
const SEA_COLOR = 0x2f7fb8
const DECK_COLOR = 0x7a4d24
const SEAM_COLOR = 0x4a2e14
const FIRE_SHOW = 0.2 // seconds the enemy cannon shows its firing frame after each shot
const FLINCH_TIME = 0.3 // seconds the pirate flashes red after being hit

interface Ball {
  arrival: number // song time it reaches the pirate
  height: BallHeight
  image: Phaser.GameObjects.Image
  judged: boolean
  hit: boolean // it struck her (shown bursting instead of flying on)
}

export class CannonballBarrageGame implements MiniGame {
  meta: DurationMeta = {
    id: 'cannonball_barrage',
    kind: 'duration',
    prompt: 'DODGE!',
    hint: '↑ JUMP  ↓ DUCK',
    canHideBackground: true, // a sky and sea behind the deck: hide them to put a level video behind the fight
    minDuration: 4,
    canBeatSync: true,
    defaultHits: [0, 2], // beat sync on: a ball reaches her on beats 1 and 3 of each bar
  }

  private params!: MiniGameParams
  private result: Status = 'running'
  private balls: Ball[] = []
  private misses = 0
  private jumpedAt = -Infinity // song time of the last jump
  private ducking = false
  private hitAt = -Infinity // song time she was last hit, for the flinch
  private diedAt: number | null = null
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private pirate!: Phaser.GameObjects.Image
  private cannon!: Phaser.GameObjects.Image
  private label!: Phaser.GameObjects.Text
  private pirateX = 0
  private feetY = 0
  private pirateScale = 1
  private muzzle = { x: 0, y: 0 } // where balls leave the enemy cannon
  private ballY: Record<BallHeight, number> = { high: 0, low: 0 } // where each kind of ball crosses the pirate

  preload(load: Phaser.Loader.LoaderPlugin): void {
    load.image(STAND, '/assets/sprites/idle_character/pirateside1.png')
    load.image(RISE, '/assets/sprites/jumping_character/jumpingsideways1.png')
    load.image(FALL, '/assets/sprites/jumping_character/jumpingsideways2.png')
    load.image(DEATH_JUMP, '/assets/sprites/jumping_character/jumpingforwards.png')
    load.image(CANNON, '/assets/sprites/cannons/cannon.png')
    load.image(CANNON_FIRING, '/assets/sprites/cannons/cannonshooting.png')
    load.image(BALL, '/assets/sprites/cannons/cannonball.png')
  }

  // Plans every ball up front, then builds the sky and sea, the deck, the enemy cannon, the pirate, and balls.
  start(params: MiniGameParams): void {
    this.params = params
    const times = arrivalTimes(params.hits, params.startTime, params.duration, params.difficulty, Math.random)
    const heights = pickHeights(times.length, Math.random)

    const { scene } = params
    const { width, height } = scene.scale
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      this.objects.push(object)
      return object
    }

    // Background layer (sky and sea), skipped when the level turns it off. The deck onward is the foreground.
    const deckTop = Math.round(height * 0.78)
    if (params.background) {
      add(scene.add.rectangle(width / 2, deckTop / 2, width, deckTop, SKY_COLOR))
      add(scene.add.rectangle(width / 2, deckTop - height * 0.08, width, height * 0.16, SEA_COLOR))
    }
    add(scene.add.rectangle(width / 2, (deckTop + height) / 2, width, height - deckTop, DECK_COLOR))
    add(scene.add.rectangle(width / 2, deckTop + (height - deckTop) / 2, width, u(scene, 1.5), SEAM_COLOR))

    // The enemy cannon on the right, mirrored to face the pirate; balls leave from its muzzle.
    this.feetY = deckTop + height * 0.05
    this.cannon = add(scene.add.image(width * 0.9, this.feetY, CANNON).setOrigin(0.5, 1).setFlipX(true))
    this.cannon.setScale((height * 0.26) / this.cannon.height)
    this.muzzle = { x: this.cannon.x - this.cannon.displayWidth * 0.36, y: this.feetY - this.cannon.displayHeight * 0.7 }

    // The pirate on the left, facing the cannon, anchored at her feet.
    this.pirateX = width * 0.22
    this.pirate = add(scene.add.image(this.pirateX, this.feetY, STAND).setOrigin(0.5, 1))
    this.pirateScale = (height * 0.3) / this.pirate.height
    this.pirate.setScale(this.pirateScale)
    const pirateHeight = this.pirate.displayHeight
    this.ballY = { high: this.feetY - pirateHeight * 0.78, low: this.feetY - pirateHeight * 0.15 }

    this.balls = times.map((arrival, i) => {
      const image = add(scene.add.image(-width, 0, BALL).setDepth(1))
      image.setScale((height * 0.07) / image.height)
      return { arrival, height: heights[i], image, judged: false, hit: false }
    })
    this.label = add(scene.add.text(width / 2, height * 0.08, '', textStyle(Math.round(height * 0.06))).setOrigin(0.5))
  }

  // Runs every frame: judges any ball reaching the pirate, checks for the win at the clip's end, then draws.
  update(songTime: number): void {
    for (const ball of this.balls) {
      if (ball.judged || this.result !== 'running' || songTime < ball.arrival) continue
      this.judge(ball, songTime)
    }
    if (this.result === 'running' && songTime >= this.params.startTime + this.params.duration) this.result = 'won'
    this.draw(songTime)
  }

  // Up jumps (from the deck only); holding down ducks (not in mid-air).
  handleInput(input: GameInput): void {
    if (this.diedAt !== null || input.kind !== 'button') return
    if (input.button === 'down') this.ducking = input.pressed
    const grounded = input.songTime - this.jumpedAt >= JUMP_TIME
    if (input.button === 'up' && input.pressed && grounded && !this.ducking) this.jumpedAt = input.songTime
  }

  status(): Status {
    return this.result
  }

  destroy(): void {
    for (const object of this.objects) object.destroy()
    this.objects = []
  }

  // A ball reaches the pirate: dodged (over it or under it) is a Perfect, hit is a Miss. A quarter or more
  // hit knocks her out.
  private judge(ball: Ball, songTime: number): void {
    ball.judged = true
    const lift = jumpLift(ball.arrival - this.jumpedAt)
    const safe = dodged(ball.height, lift, this.ducking && lift === 0)
    const { scene } = this.params
    this.objects.push(showJudgement(scene, safe ? 'perfect' : 'miss', null, this.pirateX, scene.scale.height * 0.3))
    this.params.report(safe ? 'perfect' : 'miss')
    if (safe) return
    ball.hit = true
    this.hitAt = songTime
    this.misses++
    if (tooManyMisses(this.misses, this.balls.length)) {
      this.result = 'failed'
      this.diedAt = ball.arrival
    }
  }

  // Balls fly from the muzzle to their height at the pirate, then on past her (or burst on a hit); the cannon
  // flashes when it fires; the pirate stands, jumps, ducks, flinches, or does the shared death fall.
  private draw(songTime: number): void {
    const { height } = this.params.scene.scale
    let firing = false
    for (const ball of this.balls) {
      const progress = flight(songTime, ball.arrival, this.params.startTime)
      if (progress >= 0 && progress < FIRE_SHOW) firing = true
      const gone = progress < 0 || (ball.hit && progress > 1) || progress > 2.5
      ball.image.setVisible(!gone)
      if (gone) continue
      const x = this.muzzle.x + (this.pirateX - this.muzzle.x) * progress
      const y = progress < 1 ? this.muzzle.y + (this.ballY[ball.height] - this.muzzle.y) * progress : this.ballY[ball.height]
      ball.image.setPosition(x, y).setAngle(progress * -540) // spins as it flies
    }
    this.cannon.setTexture(firing ? CANNON_FIRING : CANNON)

    if (this.diedAt !== null) {
      const sinceDeath = songTime - this.diedAt
      this.pirate.setTexture(sinceDeath < DEATH_FREEZE ? STAND : DEATH_JUMP).setTint(0xff6b6b).setScale(this.pirateScale)
      this.pirate.setY(this.feetY - deathLift(sinceDeath) * height)
    } else {
      const sinceJump = songTime - this.jumpedAt
      const lift = jumpLift(sinceJump)
      const crouched = this.ducking && lift === 0
      this.pirate.setTexture(lift > 0 ? (sinceJump < JUMP_TIME / 2 ? RISE : FALL) : STAND)
      this.pirate.setScale(this.pirateScale * (crouched ? 1.12 : 1), this.pirateScale * (crouched ? 0.6 : 1)) // a squash, until there's crouch art
      this.pirate.setY(this.feetY - lift * height)
      this.pirate.setTint(songTime - this.hitAt < FLINCH_TIME ? 0xff8a8a : 0xffffff)
    }

    const dodgedCount = this.balls.filter(b => b.judged).length - this.misses
    if (this.result === 'won') this.label.setText(this.misses ? 'STILL STANDING!' : 'UNTOUCHED!')
    else if (this.result === 'failed') this.label.setText('BLASTED!')
    else this.label.setText(`${dodgedCount} dodged${this.misses ? `   ${this.misses} hit` : ''}`)
  }
}
