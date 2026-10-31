// Parry!: a rival pirate winds up, showing an arrow for the direction of the strike, and strikes on each hit
// of the clip's beat map. Press that arrow on the beat to parry: graded by timing like every rhythm game.
// The wrong arrow, or bad timing, is a miss; a quarter or more missed knocks the player out. Spec in
// MINIGAMES.md. Fighter art by Cadence (the rival is the same art, mirrored and tinted, until it has its own).
import type Phaser from 'phaser'
import type { GameInput, HitGrade, MiniGame, MiniGameParams, Status, TaskMeta } from '../../types/minigame'
import { addArrow, ARROW_ANGLES, type Direction, directionGrade } from '../shared/arrows'
import { DEATH_FREEZE, deathLift } from '../shared/deathFall'
import { textStyle } from '../shared/font'
import { HIT_WINDOW, judgePress, tooManyMisses, windowScaleFor } from '../shared/judgePress'
import { showJudgement } from '../shared/judgeText'
import { u } from '../shared/units'
import { pickDirections, tellBeatsFor, windUp } from './strikes'

// Texture keys, prefixed with the game ID so they never clash with another game's. The art faces right.
const GUARD = 'parry_guard'
const JAB = 'parry_jab'
const COUNTER = 'parry_counter'
const LUNGE = 'parry_lunge'
const DEATH_JUMP = 'parry_death_jump'

const SKY_COLOR = 0x6fb3dc
const DECK_COLOR = 0x7a4d24
const SEAM_COLOR = 0x4a2e14
const RIVAL_TINT = 0x8fa8ff // until the rival has its own art
const ARROW_COLOR = 0xffcc4d
const CLASH_SHOW = 0.25 // seconds the parry clash or the landed strike stays on screen

export class ParryGame implements MiniGame {
  meta: TaskMeta = {
    id: 'parry',
    kind: 'task',
    prompt: 'PARRY!',
    hint: 'ARROWS',
    canHideBackground: true, // a sky over the deck: hide it to put a level video behind the duel
    baseBeats: 2,
    defaultHits: [1], // the strike lands on the 2nd beat of each 2-beat cycle
  }

  private params!: MiniGameParams
  private hits: number[] = [] // song times the rival strikes (the clip's beat map)
  private directions: Direction[] = [] // the arrow to press for each strike
  private windowScale = 1 // how much difficulty shrinks the judgement windows
  private tellBeats = 1 // how much warning each strike gives, in beats
  private result: Status = 'running'
  private next = 0 // index of the next strike
  private misses = 0
  private lastOutcome: { at: number; parried: boolean } | null = null // the last strike, for its animation
  private diedAt: number | null = null // song time the player was knocked out
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private player!: Phaser.GameObjects.Image
  private rival!: Phaser.GameObjects.Image
  private arrow!: Phaser.GameObjects.Triangle
  private ring!: Phaser.GameObjects.Arc
  private clash!: Phaser.GameObjects.Arc
  private label!: Phaser.GameObjects.Text
  private feetY = 0

  preload(load: Phaser.Loader.LoaderPlugin): void {
    load.image(GUARD, '/assets/sprites/punching_character/punch1.png')
    load.image(JAB, '/assets/sprites/punching_character/punch2.png')
    load.image(COUNTER, '/assets/sprites/punching_character/punch3.png')
    load.image(LUNGE, '/assets/sprites/punching_character/lunge.png')
    load.image(DEATH_JUMP, '/assets/sprites/jumping_character/jumpingforwards.png')
  }

  // Plans the strike directions, then builds the sky, deck, both fighters, the arrow, and the text.
  start(params: MiniGameParams): void {
    this.params = params
    this.hits = params.hits ?? []
    this.directions = pickDirections(this.hits.length, Math.random)
    this.windowScale = windowScaleFor(params.difficulty)
    this.tellBeats = tellBeatsFor(params.difficulty)

    const { scene } = params
    const { width, height } = scene.scale
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      this.objects.push(object)
      return object
    }

    // Background layer (the sky), skipped when the level turns it off. The deck and everything after are
    // the foreground.
    const groundTop = Math.round(height * 0.75)
    if (params.background) add(scene.add.rectangle(width / 2, groundTop / 2, width, groundTop, SKY_COLOR))
    add(scene.add.rectangle(width / 2, (groundTop + height) / 2, width, height - groundTop, DECK_COLOR))
    for (let i = 1; i < 3; i++) {
      add(scene.add.rectangle(width / 2, groundTop + ((height - groundTop) * i) / 3, width, u(scene, 1.5), SEAM_COLOR))
    }

    // The two fighters face each other, anchored at their feet so every frame lines up.
    this.feetY = groundTop + height * 0.07
    const fighterHeight = height * 0.42
    this.player = add(scene.add.image(width * 0.32, this.feetY, GUARD).setOrigin(0.5, 1))
    this.player.setScale(fighterHeight / this.player.height)
    this.rival = add(scene.add.image(width * 0.68, this.feetY, GUARD).setOrigin(0.5, 1).setFlipX(true).setTint(RIVAL_TINT))
    this.rival.setScale(fighterHeight / this.rival.height)

    // The arrow over the rival's head, with a ring that shrinks onto it as the strike nears.
    const arrowSize = height * 0.06
    const arrowY = this.feetY - fighterHeight - height * 0.1
    this.arrow = add(addArrow(scene, width * 0.68, arrowY, arrowSize, ARROW_COLOR)) // rotated per strike in draw
    this.ring = add(scene.add.circle(width * 0.68, arrowY, arrowSize * 1.5).setStrokeStyle(u(scene, 2), 0xffffff))
    this.clash = add(scene.add.circle(width / 2, this.feetY - fighterHeight * 0.6, height * 0.07, 0xffffff).setAlpha(0))

    this.label = add(scene.add.text(width / 2, height * 0.08, '', textStyle(Math.round(height * 0.06))).setOrigin(0.5))
    if (this.hits.length === 0) this.result = 'won' // an empty beat map has nothing to miss
  }

  // Runs every frame: counts a miss for any strike whose window closed unparried, then draws.
  update(songTime: number): void {
    while (this.result === 'running' && this.next < this.hits.length) {
      if (songTime <= this.hits[this.next] + HIT_WINDOW * this.windowScale) break
      this.resolve('miss', null, this.hits[this.next])
    }
    this.draw(songTime)
  }

  // An arrow key parries. Judged by the shared rules (the same early and late), and it has to be the right
  // arrow: the wrong one is a miss even on time.
  handleInput(input: GameInput): void {
    if (this.result !== 'running' || input.kind !== 'button' || !input.pressed || input.button === 'action') return
    const judgement = judgePress(this.hits, this.next, input.songTime, this.params.startTime, this.windowScale)
    const grade = directionGrade(judgement, input.button, this.directions[this.next])
    if (grade) this.resolve(grade, judgement.offset, input.songTime)
  }

  status(): Status {
    return this.result
  }

  destroy(): void {
    for (const object of this.objects) object.destroy()
    this.objects = []
  }

  // Settles the next strike as parried (a grade) or a miss: shows and reports the grade, moves on, and ends
  // the game when a quarter or more have been missed (knocked out) or every strike is done (won).
  private resolve(grade: HitGrade, offset: number | null, at: number): void {
    const { scene } = this.params
    this.objects.push(showJudgement(scene, grade, offset, scene.scale.width / 2, scene.scale.height * 0.3))
    this.params.report(grade)
    this.lastOutcome = { at, parried: grade !== 'miss' }
    if (grade === 'miss') this.misses++
    this.next++
    if (tooManyMisses(this.misses, this.hits.length)) {
      this.result = 'failed'
      this.diedAt = at
    } else if (this.next === this.hits.length) {
      this.result = 'won'
    }
  }

  // Wind-up: the rival leans back, with the arrow and its shrinking ring. A parry: the player counters, a
  // clash flashes, and the rival is knocked back. A landed strike: the rival lunges and the player flinches
  // red. Knocked out: the player does the shared Mario-style death fall.
  private draw(songTime: number): void {
    const { width, height } = this.params.scene.scale
    const beatLength = 60 / this.params.bpm
    const winding = this.result === 'running' && this.next < this.hits.length
    const progress = windUp(this.hits, this.next, songTime, this.params.startTime, beatLength, this.tellBeats)
    const telling = winding && progress > 0
    this.arrow.setVisible(telling).setAngle(ARROW_ANGLES[this.directions[this.next] ?? 'right'])
    this.ring.setVisible(telling).setScale(1 + 2 * (1 - progress))

    const since = this.lastOutcome ? songTime - this.lastOutcome.at : Infinity
    const fresh = since >= 0 && since < CLASH_SHOW
    const fade = fresh ? 1 - since / CLASH_SHOW : 0
    const parried = fresh && this.lastOutcome!.parried
    const struck = fresh && !this.lastOutcome!.parried

    // The rival: knocked back after a parry, lunging in after a hit, leaning back while winding up.
    let rivalX = width * 0.68
    if (parried) rivalX += width * 0.05 * fade
    else if (struck) rivalX -= width * 0.12 * fade
    else if (telling) rivalX += width * 0.02 * progress
    this.rival.setTexture(struck ? LUNGE : telling && progress > 0.7 ? JAB : GUARD).setX(rivalX)
    this.clash.setAlpha(parried ? fade : 0)

    if (this.diedAt !== null) {
      const sinceDeath = songTime - this.diedAt
      this.player.setTexture(sinceDeath < DEATH_FREEZE ? GUARD : DEATH_JUMP).setTint(0xff6b6b)
      this.player.setY(this.feetY - deathLift(sinceDeath) * height)
    } else {
      this.player.setTexture(parried ? COUNTER : GUARD).setTint(struck ? 0xff8a8a : 0xffffff)
    }

    const missed = this.misses ? `   ${this.misses} missed` : ''
    if (this.result === 'won') this.label.setText(this.misses ? 'WELL FOUGHT!' : 'UNTOUCHABLE!')
    else if (this.result === 'failed') this.label.setText('KNOCKED OUT!')
    else this.label.setText(`Strike ${this.next + 1} / ${this.hits.length}${missed}`)
  }
}
