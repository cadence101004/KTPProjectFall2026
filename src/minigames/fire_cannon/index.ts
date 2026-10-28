// Fire the Cannon: a fuse burns toward the cannon's touch hole, and the player fires (Space) the moment the
// spark reaches it, on each hit of the clip's beat map. Spec in MINIGAMES.md. Art by Cadence.
import type Phaser from 'phaser'
import type { GameInput, MiniGame, MiniGameParams, Status, TaskMeta } from '../../types/minigame'
import { textStyle } from '../shared/font'
import { judgePress } from '../shared/judgePress'
import { fuseBurn, hitWindowFor } from './fuse'

// Texture keys, prefixed with the game ID so they never clash with another game's.
const CANNON = 'fire_cannon_cannon'
const CANNON_SHOOTING = 'fire_cannon_cannon_shooting'
const BALL = 'fire_cannon_ball'
const BALL_PILE = 'fire_cannon_ball_pile'
// Grass ground tiles (32x32). Plain grass is listed several times so it shows up most often.
const GRASS = ['grass', 'grass', 'grass', 'grass', 'grass_clover', 'grass_daisies', 'grass_flowers', 'grass_tufts']
const TILE = 32

// Where things are on cannon.png, as fractions of its width and height, so the fuse and the cannonball
// line up with the art at any size.
const TOUCH_HOLE = { x: 0.13, y: 0.4 }
const MUZZLE = { x: 0.86, y: 0.3 }

const SKY_COLOR = 0x5fa8d3
const FUSE_COLOR = 0xc8a46a
const SPARK_COLOR = 0xffcc4d

const BALL_SPEED = 1.5 // cannonball flight speed, in screen widths per second
const SHOT_SHOW = 0.2 // seconds the cannon shows its firing frame after a good shot

export class FireCannonGame implements MiniGame {
  meta: TaskMeta = {
    id: 'fire_cannon',
    kind: 'task',
    prompt: 'FIRE!',
    hint: 'SPACE',
    baseBeats: 2,
    defaultHits: [1], // fire on the 2nd beat of each 2-beat cycle
  }

  private params!: MiniGameParams
  private hits: number[] = [] // song times to fire at (the clip's beat map)
  private window = 0 // hit window in seconds, from difficulty
  private result: Status = 'running'
  private failReason = 'MISSED!'
  private next = 0 // index of the next shot to fire
  private lastShotAt = -Infinity // song time of the last good shot, for the firing frame and the flying ball
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private fuseStart = 0 // x where a freshly lit fuse begins
  private fuseEnd = 0 // x of the touch hole, where the spark should be on the hit
  private muzzle = { x: 0, y: 0 } // where the cannonball leaves the barrel
  private cannon!: Phaser.GameObjects.Image
  private fuse!: Phaser.GameObjects.Rectangle // the unburnt part of the fuse
  private spark!: Phaser.GameObjects.Arc
  private mark!: Phaser.GameObjects.Arc // the touch hole target ring
  private ball!: Phaser.GameObjects.Image
  private label!: Phaser.GameObjects.Text

  preload(load: Phaser.Loader.LoaderPlugin): void {
    load.image(CANNON, '/assets/sprites/cannons/cannon.png')
    load.image(CANNON_SHOOTING, '/assets/sprites/cannons/cannonshooting.png')
    load.image(BALL, '/assets/sprites/cannons/cannonball.png')
    load.image(BALL_PILE, '/assets/sprites/cannons/pilecannonballs.png')
    for (const tile of new Set(GRASS)) load.image(`fire_cannon_${tile}`, `/assets/sprites/floortiles/${tile}.png`)
  }

  // Builds the scene: sky, a grass field, the cannon and its ball pile, the fuse, and the text.
  // Sized from the screen, and everything goes into this.objects so destroy() removes it.
  start(params: MiniGameParams): void {
    this.params = params
    this.hits = params.hits ?? []
    this.window = hitWindowFor(params.difficulty)
    const { scene } = params
    const { width, height } = scene.scale
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      this.objects.push(object)
      return object
    }

    // Sky, then the grass field: whole tiles from groundTop down, with a random mix of the grass variants.
    const groundTop = Math.round(height * 0.7)
    add(scene.add.rectangle(width / 2, groundTop / 2, width, groundTop, SKY_COLOR))
    for (let y = groundTop; y < height; y += TILE) {
      for (let x = 0; x < width; x += TILE) {
        const tile = GRASS[Math.floor(Math.random() * GRASS.length)]
        add(scene.add.image(x, y, `fire_cannon_${tile}`).setOrigin(0, 0))
      }
    }

    // The cannon stands on the grass, bottom-left anchored so its firing frame (which is wider, for the
    // blast) lines up with the idle frame. A pile of cannonballs sits beside it.
    const cannonHeight = height * 0.42
    const groundY = groundTop + height * 0.08
    this.cannon = add(scene.add.image(width * 0.3, groundY, CANNON).setOrigin(0, 1))
    this.cannon.setScale(cannonHeight / this.cannon.height)
    const pile = add(scene.add.image(width * 0.82, groundY, BALL_PILE).setOrigin(0.5, 1))
    pile.setScale((height * 0.2) / pile.height)

    // Find the touch hole and muzzle on the scaled cannon art.
    const left = this.cannon.x
    const top = this.cannon.y - this.cannon.displayHeight
    const holeY = top + TOUCH_HOLE.y * this.cannon.displayHeight
    this.fuseEnd = left + TOUCH_HOLE.x * this.cannon.displayWidth
    this.fuseStart = width * 0.06
    this.muzzle = { x: left + MUZZLE.x * this.cannon.displayWidth, y: top + MUZZLE.y * this.cannon.displayHeight }

    // The fuse runs in from the left to the touch hole, which is ringed as the target.
    this.mark = add(scene.add.circle(this.fuseEnd, holeY, height * 0.03).setStrokeStyle(3, SPARK_COLOR))
    this.fuse = add(scene.add.rectangle(this.fuseStart, holeY, this.fuseEnd - this.fuseStart, 4, FUSE_COLOR).setOrigin(0, 0.5))
    this.spark = add(scene.add.circle(this.fuseStart, holeY, height * 0.025, SPARK_COLOR))

    this.ball = add(scene.add.image(this.muzzle.x, this.muzzle.y, BALL).setVisible(false))
    this.ball.setScale((height * 0.08) / this.ball.height)

    this.label = add(scene.add.text(width / 2, height * 0.12, '', textStyle(Math.round(height * 0.07))).setOrigin(0.5))
    if (this.hits.length === 0) this.result = 'won' // an empty beat map has nothing to miss
  }

  // Runs every frame: fails a shot whose window has closed, then draws the fuse, spark, and shot effects.
  update(songTime: number): void {
    if (this.result === 'running' && this.next < this.hits.length && songTime > this.hits[this.next] + this.window) {
      this.result = 'failed'
      this.failReason = 'MISSED!'
    }

    // The spark burns along the fuse and reaches the touch hole exactly on the hit.
    const beatLength = 60 / this.params.bpm
    const burn = fuseBurn(this.hits, this.next, songTime, this.params.startTime, beatLength)
    const sparkX = this.fuseStart + burn * (this.fuseEnd - this.fuseStart)
    const showFuse = this.result === 'running' && this.next < this.hits.length
    this.spark.setVisible(showFuse).setX(sparkX)
    this.fuse.setVisible(showFuse).setX(sparkX).setSize(this.fuseEnd - sparkX, 4)
    this.mark.setVisible(showFuse).setScale(burn > 0.8 ? 1.3 : 1) // the target swells as the moment nears

    // After a good shot: the cannon's firing frame, and a ball flying off to the right, both on song time.
    const sinceShot = songTime - this.lastShotAt
    this.cannon.setTexture(sinceShot >= 0 && sinceShot < SHOT_SHOW ? CANNON_SHOOTING : CANNON)
    const ballX = this.muzzle.x + sinceShot * BALL_SPEED * this.params.scene.scale.width
    this.ball.setVisible(sinceShot >= 0 && ballX < this.params.scene.scale.width * 1.1).setX(ballX)

    // After a win, keep showing it until the clip ends (never end early).
    if (this.result === 'won') this.label.setText('DIRECT HIT!')
    else if (this.result === 'failed') this.label.setText(this.failReason)
    else this.label.setText(`Shot ${this.next + 1} / ${this.hits.length}`)
  }

  // Space fires. Judged by the shared rules: on time is a hit, too early or too late fails.
  handleInput(input: GameInput): void {
    if (this.result !== 'running') return
    if (input.kind !== 'button' || input.button !== 'action' || !input.pressed) return
    const verdict = judgePress(this.hits, this.next, input.songTime, this.params.startTime, this.window)
    if (verdict === 'hit') {
      this.lastShotAt = input.songTime
      this.next++
      if (this.next === this.hits.length) this.result = 'won'
    } else if (verdict === 'early' || verdict === 'late') {
      this.result = 'failed'
      this.failReason = verdict === 'early' ? 'TOO EARLY!' : 'TOO LATE!'
    }
  }

  status(): Status {
    return this.result
  }

  destroy(): void {
    for (const object of this.objects) object.destroy()
    this.objects = []
  }
}
