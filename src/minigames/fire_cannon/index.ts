// Fire the Cannon: a fuse burns toward the cannon's touch hole, and the player fires (Space) the moment the
// spark reaches it, on each hit of the clip's beat map. Spec in MINIGAMES.md.
import type Phaser from 'phaser'
import type { GameInput, MiniGame, MiniGameParams, Status, TaskMeta } from '../../types/minigame'
import { textStyle } from '../shared/font'
import { judgePress } from '../shared/judgePress'
import { fuseBurn, hitWindowFor } from './fuse'

// Placeholder colors until we have art in public/assets/minigames/fire_cannon/.
const SKY_COLOR = 0x1b4a6b
const DECK_COLOR = 0x6b4226
const CANNON_COLOR = 0x2b2b2b
const FUSE_COLOR = 0xc8a46a
const SPARK_COLOR = 0xffcc4d
const FLASH_COLOR = 0xffe08a

const BALL_SPEED = 1.5 // cannonball flight speed, in screen widths per second
const FLASH_TIME = 0.15 // seconds the muzzle flash takes to fade

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
  private lastShotAt = -Infinity // song time of the last good shot, for the flash and the flying ball
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private fuseStart = 0 // x where a freshly lit fuse begins
  private fuseEnd = 0 // x of the touch hole, where the spark should be on the hit
  private fuse!: Phaser.GameObjects.Rectangle // the unburnt part of the fuse
  private spark!: Phaser.GameObjects.Arc
  private mark!: Phaser.GameObjects.Arc // the touch hole target ring
  private flash!: Phaser.GameObjects.Arc
  private ball!: Phaser.GameObjects.Arc
  private label!: Phaser.GameObjects.Text

  // Queue art and sounds here, e.g. load.image('fire_cannon_cannon', '/assets/minigames/fire_cannon/cannon.png').
  preload(_load: Phaser.Loader.LoaderPlugin): void {}

  // Builds the scene: sky, deck, cannon, fuse, spark, and text. Sized from the screen; all into this.objects.
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

    add(scene.add.rectangle(width / 2, height / 2, width, height, SKY_COLOR))
    add(scene.add.rectangle(width / 2, height * 0.85, width, height * 0.3, DECK_COLOR))

    // The cannon: a barrel pointing right, sitting on a wheel.
    const barrelY = height * 0.58
    add(scene.add.rectangle(width * 0.5, barrelY, width * 0.26, height * 0.12, CANNON_COLOR))
    add(scene.add.circle(width * 0.45, height * 0.68, height * 0.07, 0x4a3020))

    // The fuse runs from the left into the cannon's touch hole at the back of the barrel.
    this.fuseStart = width * 0.12
    this.fuseEnd = width * 0.37
    this.mark = add(scene.add.circle(this.fuseEnd, barrelY, height * 0.03).setStrokeStyle(3, SPARK_COLOR))
    this.fuse = add(scene.add.rectangle(this.fuseStart, barrelY, this.fuseEnd - this.fuseStart, 4, FUSE_COLOR).setOrigin(0, 0.5))
    this.spark = add(scene.add.circle(this.fuseStart, barrelY, height * 0.025, SPARK_COLOR))

    // Shot effects at the muzzle, hidden until the first good shot.
    this.flash = add(scene.add.circle(width * 0.66, barrelY, height * 0.08, FLASH_COLOR).setAlpha(0))
    this.ball = add(scene.add.circle(width * 0.66, barrelY, height * 0.03, 0x111111).setVisible(false))

    this.label = add(scene.add.text(width / 2, height * 0.15, '', textStyle(Math.round(height * 0.07))).setOrigin(0.5))
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
    this.mark.setScale(showFuse && burn > 0.8 ? 1.3 : 1) // the target swells as the moment nears

    // After a good shot: a fading muzzle flash and a ball flying off to the right, both timed by song time.
    const sinceShot = songTime - this.lastShotAt
    this.flash.setAlpha(Math.max(0, 1 - sinceShot / FLASH_TIME))
    const ballX = this.params.scene.scale.width * (0.66 + sinceShot * BALL_SPEED)
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
