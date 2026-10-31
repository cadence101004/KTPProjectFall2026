// Fire the Cannon: a fuse burns toward the cannon's touch hole, and the player fires (Space) the moment the
// spark reaches it, on each hit of the clip's beat map. Spec in MINIGAMES.md. Art by Cadence.
import type Phaser from 'phaser'
import type { GameInput, MiniGame, MiniGameParams, Status, TaskMeta } from '../../types/minigame'
import { textStyle } from '../shared/font'
import { type Grade, HIT_WINDOW, judgePress, tooManyMisses } from '../shared/judgePress'
import { showJudgement } from '../shared/judgeText'
import { u } from '../shared/units'
import { fuseBurn, windowScaleFor } from './fuse'

// Texture keys, prefixed with the game ID so they never clash with another game's.
const CANNON = 'fire_cannon_cannon'
const CANNON_SHOOTING = 'fire_cannon_cannon_shooting'
const BALL = 'fire_cannon_ball'
const BALL_PILE = 'fire_cannon_ball_pile'
// Grass ground tiles (32x32). Plain grass is listed several times so it shows up most often.
const GRASS = ['grass', 'grass', 'grass', 'grass', 'grass_clover', 'grass_daisies', 'grass_flowers', 'grass_tufts']
const TILE = 32 // the grass art's size in pixels, which is also its size in design pixels

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
  private windowScale = 1 // how much difficulty shrinks the judgement windows
  private result: Status = 'running'
  private next = 0 // index of the next shot to fire
  private misses = 0 // shots missed so far; a quarter or more of all shots fails the game
  private lastShotAt = -Infinity // song time of the last good shot, for the firing frame and the flying ball
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private fuseStart = 0 // x where a freshly lit fuse begins
  private fuseEnd = 0 // x of the touch hole, where the spark should be on the hit
  private fuseThickness = 0 // the fuse's height, in real pixels
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
    this.windowScale = windowScaleFor(params.difficulty)
    const { scene } = params
    const { width, height } = scene.scale
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      this.objects.push(object)
      return object
    }

    // Sky, then the grass field: whole tiles from groundTop down, with a random mix of the grass variants.
    // Tiles are scaled up from their 32 px art by the same amount as the rest of the game (design pixels).
    const groundTop = Math.round(height * 0.7)
    const tileSize = u(scene, TILE)
    add(scene.add.rectangle(width / 2, groundTop / 2, width, groundTop, SKY_COLOR))
    for (let y = groundTop; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const tile = GRASS[Math.floor(Math.random() * GRASS.length)]
        add(scene.add.image(x, y, `fire_cannon_${tile}`).setOrigin(0, 0).setScale(tileSize / TILE))
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
    this.fuseThickness = u(scene, 4)
    this.mark = add(scene.add.circle(this.fuseEnd, holeY, height * 0.03).setStrokeStyle(u(scene, 3), SPARK_COLOR))
    this.fuse = add(
      scene.add.rectangle(this.fuseStart, holeY, this.fuseEnd - this.fuseStart, this.fuseThickness, FUSE_COLOR).setOrigin(0, 0.5),
    )
    this.spark = add(scene.add.circle(this.fuseStart, holeY, height * 0.025, SPARK_COLOR))

    this.ball = add(scene.add.image(this.muzzle.x, this.muzzle.y, BALL).setVisible(false))
    this.ball.setScale((height * 0.08) / this.ball.height)

    this.label = add(scene.add.text(width / 2, height * 0.12, '', textStyle(Math.round(height * 0.07))).setOrigin(0.5))
    if (this.hits.length === 0) this.result = 'won' // an empty beat map has nothing to miss
  }

  // Runs every frame: counts a miss for any shot whose window closed unfired, then draws the fuse, spark,
  // and shot effects.
  update(songTime: number): void {
    while (this.result === 'running' && this.next < this.hits.length) {
      if (songTime <= this.hits[this.next] + HIT_WINDOW * this.windowScale) break
      this.popJudgement('miss', null)
      this.finishShot(false)
    }

    // The spark burns along the fuse and reaches the touch hole exactly on the hit.
    const beatLength = 60 / this.params.bpm
    const burn = fuseBurn(this.hits, this.next, songTime, this.params.startTime, beatLength)
    const sparkX = this.fuseStart + burn * (this.fuseEnd - this.fuseStart)
    const showFuse = this.result === 'running' && this.next < this.hits.length
    this.spark.setVisible(showFuse).setX(sparkX)
    this.fuse.setVisible(showFuse).setX(sparkX).setSize(this.fuseEnd - sparkX, this.fuseThickness)
    this.mark.setVisible(showFuse).setScale(burn > 0.8 ? 1.3 : 1) // the target swells as the moment nears

    // After a good shot: the cannon's firing frame, and a ball flying off to the right, both on song time.
    const sinceShot = songTime - this.lastShotAt
    this.cannon.setTexture(sinceShot >= 0 && sinceShot < SHOT_SHOW ? CANNON_SHOOTING : CANNON)
    const ballX = this.muzzle.x + sinceShot * BALL_SPEED * this.params.scene.scale.width
    this.ball.setVisible(sinceShot >= 0 && ballX < this.params.scene.scale.width * 1.1).setX(ballX)

    // After a win, keep showing it until the clip ends (never end early).
    const missed = this.misses ? `   ${this.misses} missed` : ''
    if (this.result === 'won') this.label.setText(this.misses ? 'NICE SHOOTING!' : 'DIRECT HIT!')
    else if (this.result === 'failed') this.label.setText('TOO MANY MISSES!')
    else this.label.setText(`Shot ${this.next + 1} / ${this.hits.length}${missed}`)
  }

  // Space fires. Judged by the shared rules (the same early and late): a hit pops up PERFECT, GREAT, or
  // GOOD; firing too early or too late is a MISS for that shot. Play carries on either way.
  handleInput(input: GameInput): void {
    if (this.result !== 'running') return
    if (input.kind !== 'button' || input.button !== 'action' || !input.pressed) return
    const judgement = judgePress(this.hits, this.next, input.songTime, this.params.startTime, this.windowScale)
    if (judgement.result === 'hit') {
      this.lastShotAt = input.songTime
      this.popJudgement(judgement.grade!, judgement.offset)
      this.finishShot(true)
    } else if (judgement.result === 'early' || judgement.result === 'late') {
      this.popJudgement('miss', judgement.offset)
      this.finishShot(false)
    }
  }

  // Moves on to the next shot after a hit or a miss. A quarter or more of the shots missed fails the game;
  // getting through every shot under that wins it.
  private finishShot(hit: boolean): void {
    if (!hit) this.misses++
    this.next++
    if (tooManyMisses(this.misses, this.hits.length)) this.result = 'failed'
    else if (this.next === this.hits.length) this.result = 'won'
  }

  // Shows PERFECT, GREAT, GOOD, or MISS just above the touch hole, and reports it to the level's score.
  private popJudgement(grade: Grade | 'miss', offset: number | null): void {
    const { scene } = this.params
    this.objects.push(showJudgement(scene, grade, offset, this.fuseEnd, this.mark.y - scene.scale.height * 0.12))
    this.params.report(grade)
  }

  status(): Status {
    return this.result
  }

  destroy(): void {
    for (const object of this.objects) object.destroy()
    this.objects = []
  }
}
