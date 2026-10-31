// Catch the Fruit: fruit falls onto a beach, and the pirate walks left and right (hold the arrows) to catch
// each one in her bucket. With beat sync on, every fruit lands on a beat map hit, osu-style. Each catch is
// graded by how close to the bucket's center it lands; the game fails once a quarter or more of the fruit
// is dropped. Spec in MINIGAMES.md. Art by Cadence.
import type Phaser from 'phaser'
import type { DurationMeta, GameInput, HitGrade, MiniGame, MiniGameParams, Status } from '../../types/minigame'
import { textStyle } from '../shared/font'
import { tooManyMisses } from '../shared/judgePress'
import { showJudgement } from '../shared/judgeText'
import { DEATH_FREEZE, deathLift } from '../shared/deathFall'
import { u } from '../shared/units'
import { catchGrade, FRUITS, fallProgress, fruitSettings, landSpots, landTimes, WALK_SPEED } from './fruit'

// Texture keys, prefixed with the game ID so they never clash with another game's.
const FRONT = 'catch_the_fruit_front' // standing still, facing the player
const DEATH_JUMP = 'catch_the_fruit_death_jump' // the front jump pose, for the death fall
const WALK = ['catch_the_fruit_walk1', 'catch_the_fruit_walk2'] // walking frames, facing right
const SAND = 'catch_the_fruit_sand'
const TILE = 32 // the sand art's size in pixels, which is also its size in design pixels

const SKY_COLOR = 0x8fd3f4
const STEP_TIME = 0.14 // seconds per walking frame
const BUCKET_HEIGHT = 0.55 // where the bucket's rim is on the pirate art, as a fraction from her feet up

interface Fruit {
  landAt: number // song time it lands in the bucket
  x: number // where it lands, 0..1 across the screen
  image: Phaser.GameObjects.Image
  judged: boolean
}

export class CatchTheFruitGame implements MiniGame {
  meta: DurationMeta = {
    id: 'catch_the_fruit',
    kind: 'duration',
    prompt: 'CATCH!',
    hint: '← →',
    canHideBackground: true, // a sky over the ground: hide it to put a level video behind the game
    minDuration: 4,
    canBeatSync: true,
    defaultHits: [0, 2], // beat sync on: fruit lands on beats 1 and 3 of each bar
  }

  private params!: MiniGameParams
  private result: Status = 'running'
  private reach = 0 // the bucket's catch radius, in screen widths
  private fruit: Fruit[] = []
  private misses = 0
  private x = 0.5 // the pirate's position, 0 (left) to 1 (right)
  private holdingLeft = false
  private holdingRight = false
  private lastTime = 0
  private diedAt: number | null = null // song time of the drop that failed the game
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private pirate!: Phaser.GameObjects.Image
  private label!: Phaser.GameObjects.Text
  private feetY = 0
  private catchY = 0 // the bucket rim's height on screen, where fruit is caught

  preload(load: Phaser.Loader.LoaderPlugin): void {
    load.image(FRONT, '/assets/sprites/bucket_character/frontbucket.png')
    load.image(DEATH_JUMP, '/assets/sprites/jumping_character/jumpingforwards.png')
    load.image(WALK[0], '/assets/sprites/bucket_character/sidebucket1.png')
    load.image(WALK[1], '/assets/sprites/bucket_character/sidebucket2.png')
    load.image(SAND, '/assets/sprites/floortiles/sand.png')
    for (const name of FRUITS) load.image(`catch_the_fruit_${name}`, `/assets/sprites/fruits/${name}.png`)
  }

  // Plans every fruit for the clip up front, then builds the sky, beach, pirate, and fruit.
  start(params: MiniGameParams): void {
    this.params = params
    this.lastTime = params.startTime
    this.reach = fruitSettings(params.difficulty).reach
    const times = landTimes(params.hits, params.startTime, params.duration, params.difficulty, Math.random)
    const spots = landSpots(times, this.x, params.startTime, Math.random)

    const { scene } = params
    const { width, height } = scene.scale
    const groundTop = Math.round(height * 0.8)
    const tileSize = u(scene, TILE)
    // Background layer (the sky), skipped when the level turns it off so its video shows through.
    if (params.background) this.objects.push(scene.add.rectangle(width / 2, groundTop / 2, width, groundTop, SKY_COLOR))
    // Foreground layer from here on: the sand, the pirate, and the fruit.
    for (let y = groundTop; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        this.objects.push(scene.add.image(x, y, SAND).setOrigin(0, 0).setScale(tileSize / TILE))
      }
    }

    // The pirate stands on the sand, anchored at her feet so every frame lines up.
    this.feetY = groundTop + height * 0.06
    this.pirate = scene.add.image(this.x * width, this.feetY, FRONT).setOrigin(0.5, 1)
    this.pirate.setScale((height * 0.32) / this.pirate.height)
    this.catchY = this.feetY - this.pirate.displayHeight * BUCKET_HEIGHT

    this.fruit = times.map((landAt, i) => {
      const image = scene.add.image(spots[i] * width, -height, `catch_the_fruit_${FRUITS[i % FRUITS.length]}`)
      image.setScale((height * 0.13) / image.height).setDepth(1) // drawn in front of the pirate, so it drops in
      return { landAt, x: spots[i], image, judged: false }
    })
    this.label = scene.add.text(width / 2, height * 0.1, '', textStyle(Math.round(height * 0.07))).setOrigin(0.5)
    this.objects.push(this.pirate, ...this.fruit.map(f => f.image), this.label)
  }

  // Runs every frame: walks the pirate, judges any fruit that has reached the bucket, checks for the win at
  // the clip's end, then draws.
  update(songTime: number): void {
    const dt = songTime - this.lastTime
    this.lastTime = songTime
    const direction = this.result === 'failed' ? 0 : (this.holdingRight ? 1 : 0) - (this.holdingLeft ? 1 : 0)
    this.x = Math.min(0.97, Math.max(0.03, this.x + direction * WALK_SPEED * dt)) // walk by song time, not frames

    for (const fruit of this.fruit) {
      if (fruit.judged || this.result !== 'running' || songTime < fruit.landAt) continue
      this.judge(fruit)
    }
    if (this.result === 'running' && songTime >= this.params.startTime + this.params.duration) this.result = 'won'

    this.draw(songTime, direction)
  }

  // Hold left or right to walk.
  handleInput(input: GameInput): void {
    if (input.kind !== 'button') return
    if (input.button === 'left') this.holdingLeft = input.pressed
    if (input.button === 'right') this.holdingRight = input.pressed
  }

  status(): Status {
    return this.result
  }

  destroy(): void {
    for (const object of this.objects) object.destroy()
    this.objects = []
  }

  // A fruit has reached the bucket's height: grade the catch by how close it is to the bucket's center, show
  // and report it, and fail the game if a quarter or more of the fruit has now been dropped.
  private judge(fruit: Fruit): void {
    fruit.judged = true
    const grade: HitGrade = catchGrade(fruit.x - this.x, this.reach)
    const { scene } = this.params
    this.objects.push(showJudgement(scene, grade, null, this.x * scene.scale.width, this.catchY - scene.scale.height * 0.12))
    this.params.report(grade)
    if (grade === 'miss') {
      this.misses++
      if (tooManyMisses(this.misses, this.fruit.length)) {
        this.result = 'failed'
        this.diedAt = fruit.landAt // she jumps and falls off the screen from here
      }
    } else {
      fruit.image.setVisible(false) // into the bucket
    }
  }

  // Fruit falls on song time; the pirate walks (alternating frames, mirrored to face left) or stands facing
  // front. Dropped fruit keeps falling past the bucket into the sand. After too many drops she does the
  // Mario-style death fall, like Dodge the Kraken: a red freeze, a jump up, then off the bottom of the screen.
  private draw(songTime: number, direction: number): void {
    const { width, height } = this.params.scene.scale
    for (const fruit of this.fruit) {
      if (!fruit.image.visible) continue
      const progress = fallProgress(songTime, fruit.landAt, this.params.startTime)
      fruit.image.setPosition(fruit.x * width, -height * 0.1 + (this.catchY + height * 0.1) * progress)
      fruit.image.setAlpha(progress > 1.4 ? 0 : 1) // gone once it's well into the sand
    }

    this.pirate.setX(this.x * width)
    if (this.diedAt !== null) {
      const sinceDeath = songTime - this.diedAt
      this.pirate.setTexture(sinceDeath < DEATH_FREEZE ? FRONT : DEATH_JUMP).setFlipX(false).setTint(0xff6b6b)
      this.pirate.setY(this.feetY - deathLift(sinceDeath) * height)
    } else {
      const walking = direction !== 0
      this.pirate.setTexture(walking ? WALK[Math.floor(songTime / STEP_TIME) % 2] : FRONT)
      this.pirate.setFlipX(direction < 0) // the walking frames face right
    }

    const caught = this.fruit.filter(f => f.judged).length - this.misses
    if (this.result === 'won') this.label.setText(this.misses ? 'NICE CATCHING!' : 'PERFECT HAUL!')
    else if (this.result === 'failed') this.label.setText('TOO MANY DROPPED!')
    else this.label.setText(`${caught} caught${this.misses ? `   ${this.misses} dropped` : ''}`)
  }
}
