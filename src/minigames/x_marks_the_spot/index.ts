// X Marks the Spot: a top-down island. An X appears on the sand with a ring shrinking around it, and the
// crew digs there on the beat (each beat map hit, with beat sync on). Walk freely (hold the arrows) to be
// standing on the X when it's dug: on time is a Perfect, a hair late a Good. A chest pops up for a catch,
// an empty hole for a miss; a quarter or more missed fails. Spec in MINIGAMES.md. Top-down art by Cadence.
import type Phaser from 'phaser'
import type { DurationMeta, GameInput, HitGrade, MiniGame, MiniGameParams, Status } from '../../types/minigame'
import { DEATH_FREEZE, deathLift } from '../shared/deathFall'
import { textStyle } from '../shared/font'
import { HIT_WINDOW, tooManyMisses } from '../shared/judgePress'
import { showJudgement } from '../shared/judgeText'
import { u } from '../shared/units'
import { AREA, digGrade, digSpots, digTimes, distance, type Spot, treasureSettings, WALK_SPEED } from './treasure'

// Texture keys, prefixed with the game ID so they never clash with another game's. Top-down frames.
const FRONT = 'x_marks_front' // facing down the screen
const BACK = 'x_marks_back' // facing up the screen
const LEFT = ['x_marks_left1', 'x_marks_left2']
const RIGHT = ['x_marks_right1', 'x_marks_right2']
const SAND = 'x_marks_sand'
const DEATH_JUMP = 'x_marks_death_jump'
const TILE = 32 // the sand art's size in pixels, which is also its size in design pixels

const X_COLOR = 0xc0392b
const CHEST_COLOR = 0xd9a441
const HOLE_COLOR = 0x5c4325
const STEP_TIME = 0.14 // seconds per walking frame

type Facing = 'up' | 'down' | 'left' | 'right'

export class XMarksTheSpotGame implements MiniGame {
  meta: DurationMeta = {
    id: 'x_marks_the_spot',
    kind: 'duration',
    prompt: 'DIG!',
    hint: '← ↑ → ↓',
    minDuration: 4,
    canBeatSync: true,
    defaultHits: [0, 2], // beat sync on: a dig on beats 1 and 3 of each bar
  }

  private params!: MiniGameParams
  private result: Status = 'running'
  private reach = 0 // the X's catch radius, in screen heights
  private digs: number[] = [] // song times each X is dug
  private spots: Spot[] = [] // where each X is
  private next = 0 // index of the next X to be dug
  private checkedDig = false // whether the next X has been checked since its dig time (see update)
  private misses = 0
  private at: Spot = { x: 0.5, y: 0.55 } // the pirate, 0..1 across and down the screen
  private facing: Facing = 'down'
  private held = { up: false, down: false, left: false, right: false }
  private lastTime = 0
  private diedAt: number | null = null
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private pirate!: Phaser.GameObjects.Image
  private mark!: Phaser.GameObjects.Container // the current X
  private ring!: Phaser.GameObjects.Arc
  private label!: Phaser.GameObjects.Text

  preload(load: Phaser.Loader.LoaderPlugin): void {
    const folder = '/assets/sprites/birds-eye view'
    load.image(FRONT, `${folder}/topdownfront.png`)
    load.image(BACK, `${folder}/topdownback.png`)
    load.image(LEFT[0], `${folder}/topdownleft1.png`)
    load.image(LEFT[1], `${folder}/topdownleft2.png`)
    load.image(RIGHT[0], `${folder}/topdownright1.png`)
    load.image(RIGHT[1], `${folder}/topdownright2.png`)
    load.image(SAND, '/assets/sprites/floortiles/sand.png')
    load.image(DEATH_JUMP, '/assets/sprites/jumping_character/jumpingforwards.png')
  }

  // Plans every dig up front, then builds the island, the X, its ring, the pirate, and the text.
  start(params: MiniGameParams): void {
    this.params = params
    this.lastTime = params.startTime
    this.reach = treasureSettings(params.difficulty).reach
    const { scene } = params
    const { width, height } = scene.scale
    const aspect = width / height
    this.digs = digTimes(params.hits, params.startTime, params.duration, params.difficulty, Math.random)
    this.spots = digSpots(this.digs, this.at, params.startTime, aspect, Math.random)

    // The island: sand tiles over the whole screen. It's the playfield, so it's always drawn (no
    // canHideBackground in meta).
    const tileSize = u(scene, TILE)
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        this.objects.push(scene.add.image(x, y, SAND).setOrigin(0, 0).setScale(tileSize / TILE))
      }
    }

    // The X (two crossed bars) and the ring that shrinks onto it as its dig nears.
    const arm = this.reach * height * 0.9
    const bar = u(scene, 5)
    this.mark = scene.add.container(0, 0, [
      scene.add.rectangle(0, 0, arm * 2, bar, X_COLOR).setAngle(45),
      scene.add.rectangle(0, 0, arm * 2, bar, X_COLOR).setAngle(-45),
    ])
    this.ring = scene.add.circle(0, 0, this.reach * height).setStrokeStyle(u(scene, 2), 0xffffff)

    // The pirate, seen from above, centered on her spot.
    this.pirate = scene.add.image(this.at.x * width, this.at.y * height, FRONT).setDepth(2)
    this.pirate.setScale((height * 0.16) / this.pirate.height)

    this.label = scene.add.text(width / 2, height * 0.08, '', textStyle(Math.round(height * 0.06))).setOrigin(0.5).setDepth(3)
    this.objects.push(this.mark, this.ring, this.pirate, this.label)
  }

  // Runs every frame: walks the pirate, digs any X that's due, checks for the win at the clip's end, draws.
  update(songTime: number): void {
    const dt = songTime - this.lastTime
    this.lastTime = songTime
    if (this.diedAt === null) this.walk(dt)

    while (this.result === 'running' && this.next < this.digs.length && songTime >= this.digs[this.next]) {
      const { width, height } = this.params.scene.scale
      // The first check after a dig counts as on time, since frames never land exactly on it; after that, a
      // late arrival during the late window is still a Good.
      const lateBy = this.checkedDig ? songTime - this.digs[this.next] : 0
      this.checkedDig = true
      const grade = digGrade(distance(this.at, this.spots[this.next], width / height), this.reach, lateBy, HIT_WINDOW)
      if (!grade) break // not there yet, but still inside the late window
      this.dig(grade)
    }
    if (this.result === 'running' && songTime >= this.params.startTime + this.params.duration) this.result = 'won'
    this.draw(songTime)
  }

  // Hold the arrows to walk; diagonals work too.
  handleInput(input: GameInput): void {
    if (input.kind !== 'button' || input.button === 'action') return
    this.held[input.button] = input.pressed
  }

  status(): Status {
    return this.result
  }

  destroy(): void {
    for (const object of this.objects) object.destroy()
    this.objects = []
  }

  // Moves by elapsed song time, the same speed in every direction on the real screen shape, and faces the
  // way she's going (sideways wins on a diagonal, since those frames have the walk cycle).
  private walk(dt: number): void {
    const { width, height } = this.params.scene.scale
    const dx = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0)
    const dy = (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0)
    if (!dx && !dy) return
    const length = Math.hypot(dx, dy)
    this.at = {
      x: Math.min(AREA.right, Math.max(AREA.left, this.at.x + ((dx / length) * WALK_SPEED * dt * height) / width)),
      y: Math.min(AREA.bottom, Math.max(AREA.top, this.at.y + (dy / length) * WALK_SPEED * dt)),
    }
    this.facing = dx > 0 ? 'right' : dx < 0 ? 'left' : dy < 0 ? 'up' : 'down'
  }

  // The next X is settled (Perfect on time, Good a little late, or Miss): report it, and leave a chest
  // (found) or an empty hole (missed) on the sand. A quarter or more missed fails.
  private dig(grade: HitGrade): void {
    const { scene } = this.params
    const { width, height } = scene.scale
    const spot = this.spots[this.next]
    this.checkedDig = false
    this.params.report(grade)
    this.objects.push(showJudgement(scene, grade, null, spot.x * width, spot.y * height - height * 0.1))
    const size = this.reach * height
    const left = grade === 'miss'
      ? scene.add.ellipse(spot.x * width, spot.y * height, size * 1.4, size * 0.9, HOLE_COLOR)
      : scene.add.rectangle(spot.x * width, spot.y * height, size * 1.2, size * 0.9, CHEST_COLOR).setStrokeStyle(u(scene, 2), 0x5c3a1a)
    this.objects.push(left.setDepth(1))
    if (grade === 'miss') this.misses++
    this.next++
    if (tooManyMisses(this.misses, this.digs.length)) {
      this.result = 'failed'
      this.diedAt = this.digs[this.next - 1]
    }
  }

  // The current X and its shrinking ring, the pirate's walk cycle (or the shared death fall), and the text.
  private draw(songTime: number): void {
    const { width, height } = this.params.scene.scale
    const spot = this.spots[this.next]
    const showing = this.result === 'running' && spot !== undefined
    if (showing) {
      const appearsAt = this.next > 0 ? this.digs[this.next - 1] : this.params.startTime
      const progress = Math.min(1, Math.max(0, (songTime - appearsAt) / (this.digs[this.next] - appearsAt)))
      this.mark.setPosition(spot.x * width, spot.y * height)
      this.ring.setPosition(spot.x * width, spot.y * height).setScale(1 + 2 * (1 - progress))
    }
    this.mark.setVisible(showing)
    this.ring.setVisible(showing)

    if (this.diedAt !== null) {
      const sinceDeath = songTime - this.diedAt
      this.pirate.setTexture(sinceDeath < DEATH_FREEZE ? FRONT : DEATH_JUMP).setTint(0xff6b6b)
      this.pirate.setPosition(this.at.x * width, this.at.y * height - deathLift(sinceDeath) * height)
    } else {
      const moving = this.held.up || this.held.down || this.held.left || this.held.right
      const step = Math.floor(songTime / STEP_TIME) % 2
      const frames: Record<Facing, string> = { up: BACK, down: FRONT, left: LEFT[moving ? step : 0], right: RIGHT[moving ? step : 0] }
      this.pirate.setTexture(frames[this.facing]).setPosition(this.at.x * width, this.at.y * height)
    }

    const found = this.next - this.misses
    if (this.result === 'won') this.label.setText(this.misses ? 'TREASURE HUNTER!' : 'ALL THE GOLD!')
    else if (this.result === 'failed') this.label.setText('DUG UP NOTHING!')
    else this.label.setText(`${found} chest${found === 1 ? '' : 's'}${this.misses ? `   ${this.misses} missed` : ''}`)
  }
}
