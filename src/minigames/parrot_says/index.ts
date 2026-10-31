// Parrot Says: call and response. The parrot squawks an arrow for each answer (shown in a speech bubble and
// in a row of slots), and the player repeats each one on the beat CALL_BEATS later. Graded like every rhythm
// game; the wrong arrow or bad timing is a miss, and a quarter or more missed knocks the pirate out. From
// difficulty 2 the arrows vanish from the slots a beat after each call, so the sequence must be remembered.
// Spec in MINIGAMES.md. The parrot is placeholder shapes until it has art; the pirate is Cadence's.
import type Phaser from 'phaser'
import type { GameInput, HitGrade, MiniGame, MiniGameParams, Status, TaskMeta } from '../../types/minigame'
import { addArrow, ARROW_ANGLES, type Direction, directionGrade } from '../shared/arrows'
import { DEATH_FREEZE, deathLift } from '../shared/deathFall'
import { textStyle } from '../shared/font'
import { HIT_WINDOW, judgePress, tooManyMisses, windowScaleFor } from '../shared/judgePress'
import { showJudgement } from '../shared/judgeText'
import { u } from '../shared/units'
import { arrowShowing, callTimes, groupOf, pickArrows } from './calls'

// Texture keys, prefixed with the game ID so they never clash with another game's.
const PIRATE = 'parrot_says_pirate'
const JUMP = 'parrot_says_jump' // the front jump pose: answering up, and the death fall
const PUNCH = 'parrot_says_punch' // the punch with impact lines: answering left or right (faces right)

const SKY_COLOR = 0x7cc6e8
const DECK_COLOR = 0x7a4d24
const PERCH_COLOR = 0x5c3a1a
const MAX_SLOTS = 8 // the most answers one cycle can show
const SQUAWK_SHOW = 0.6 // how long (in beats) each called arrow stays in the parrot's speech bubble
const POSE_TIME = 0.25 // seconds the pirate holds the pose for an answer
const GRADE_COLORS: Record<HitGrade, number> = { perfect: 0xffe066, great: 0x7dffb0, good: 0x7dc8ff, miss: 0xff6b6b }

interface Slot {
  box: Phaser.GameObjects.Rectangle
  arrow: Phaser.GameObjects.Triangle
}

export class ParrotSaysGame implements MiniGame {
  meta: TaskMeta = {
    id: 'parrot_says',
    kind: 'task',
    prompt: 'REPEAT!',
    hint: 'ARROWS',
    canHideBackground: true, // a sky over the deck: hide it to put a level video behind the parrot
    baseBeats: 8,
    defaultHits: [4, 5, 6, 7], // the parrot calls on beats 1 to 4, and the player answers on beats 5 to 8
  }

  private params!: MiniGameParams
  private hits: number[] = [] // song times to answer (the clip's beat map)
  private calls: number[] = [] // song times the parrot squawks each answer's arrow
  private arrows: Direction[] = []
  private grades: (HitGrade | null)[] = [] // how each answer went, once answered
  private windowScale = 1
  private result: Status = 'running'
  private next = 0 // index of the next answer
  private misses = 0
  private lastAnswer: { at: number; direction: Direction | null } | null = null // for the pirate's pose; null direction = a miss
  private pirateScale = 1
  private diedAt: number | null = null
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private parrot!: Phaser.GameObjects.Container
  private bubble!: Phaser.GameObjects.Rectangle
  private bubbleArrow!: Phaser.GameObjects.Triangle
  private slots: Slot[] = []
  private pirate!: Phaser.GameObjects.Image
  private label!: Phaser.GameObjects.Text
  private parrotY = 0
  private feetY = 0

  preload(load: Phaser.Loader.LoaderPlugin): void {
    load.image(PIRATE, '/assets/sprites/idle_character/pirate.png')
    load.image(JUMP, '/assets/sprites/jumping_character/jumpingforwards.png')
    load.image(PUNCH, '/assets/sprites/punching_character/punch3.png')
  }

  // Plans the arrows and their calls, then builds the sky, deck, perch, parrot, bubble, slots, and pirate.
  start(params: MiniGameParams): void {
    this.params = params
    const beatLength = 60 / params.bpm
    this.hits = params.hits ?? []
    this.calls = callTimes(this.hits, params.startTime, beatLength)
    this.arrows = pickArrows(this.hits.length, Math.random)
    this.grades = this.hits.map(() => null)
    this.windowScale = windowScaleFor(params.difficulty)

    const { scene } = params
    const { width, height } = scene.scale
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      this.objects.push(object)
      return object
    }

    // Background layer (the sky), skipped when the level turns it off. Everything after is the foreground.
    const groundTop = Math.round(height * 0.8)
    if (params.background) add(scene.add.rectangle(width / 2, groundTop / 2, width, groundTop, SKY_COLOR))
    add(scene.add.rectangle(width / 2, (groundTop + height) / 2, width, height - groundTop, DECK_COLOR))

    // The parrot's perch: a post up from the deck with a bar across the top.
    const parrotX = width * 0.26
    const perchY = height * 0.62
    add(scene.add.rectangle(parrotX, (perchY + groundTop) / 2, u(scene, 5), groundTop - perchY, PERCH_COLOR))
    add(scene.add.rectangle(parrotX, perchY, width * 0.16, u(scene, 6), PERCH_COLOR))

    // A placeholder parrot from shapes, grouped so it bobs as one: body, head, beak, eye, and tail.
    const s = height * 0.01 // one parrot unit
    this.parrotY = perchY - 9 * s
    this.parrot = add(
      scene.add.container(parrotX, this.parrotY, [
        scene.add.rectangle(-4 * s, 8 * s, 4 * s, 9 * s, 0x2a7de1), // tail
        scene.add.ellipse(0, 0, 10 * s, 16 * s, 0x2fbf5a), // body
        scene.add.circle(1 * s, -9 * s, 6 * s, 0x34d06a), // head
        scene.add.triangle(6 * s, -10 * s, 0, 0, 0, 4 * s, 4 * s, 3 * s, 0xffa62b), // beak
        scene.add.circle(3 * s, -11 * s, 1.3 * s, 0x111111), // eye
      ]),
    )

    // The speech bubble, up and to the right of the parrot, showing each arrow as it's squawked.
    const bubbleX = parrotX + width * 0.11
    const bubbleY = this.parrotY - height * 0.24
    this.bubble = add(scene.add.rectangle(bubbleX, bubbleY, height * 0.14, height * 0.14, 0xffffff).setStrokeStyle(u(scene, 2), 0x222222))
    this.bubbleArrow = add(addArrow(scene, bubbleX, bubbleY, height * 0.04, 0x222222))

    // The answer slots, a row along the top: each fills with its called arrow, then its grade's color.
    const slotSize = height * 0.1
    for (let i = 0; i < MAX_SLOTS; i++) {
      const box = add(scene.add.rectangle(0, height * 0.2, slotSize, slotSize, 0x1b3a52).setStrokeStyle(u(scene, 2), 0xffffff))
      const arrow = add(addArrow(scene, 0, height * 0.2, slotSize * 0.28, 0xffffff))
      this.slots.push({ box, arrow })
    }

    // The pirate, across from the parrot, anchored at her feet.
    this.feetY = groundTop + height * 0.06
    this.pirate = add(scene.add.image(width * 0.74, this.feetY, PIRATE).setOrigin(0.5, 1))
    this.pirateScale = (height * 0.36) / this.pirate.height
    this.pirate.setScale(this.pirateScale)

    this.label = add(scene.add.text(width / 2, height * 0.06, '', textStyle(Math.round(height * 0.055))).setOrigin(0.5))
    if (this.hits.length === 0) this.result = 'won' // an empty beat map has nothing to miss
  }

  // Runs every frame: counts a miss for any answer whose window closed unanswered, then draws.
  update(songTime: number): void {
    while (this.result === 'running' && this.next < this.hits.length) {
      if (songTime <= this.hits[this.next] + HIT_WINDOW * this.windowScale) break
      this.resolve('miss', null, this.hits[this.next])
    }
    this.draw(songTime)
  }

  // An arrow key answers: judged by the shared rules, and it has to match the parrot's arrow.
  handleInput(input: GameInput): void {
    if (this.result !== 'running' || input.kind !== 'button' || !input.pressed || input.button === 'action') return
    const judgement = judgePress(this.hits, this.next, input.songTime, this.params.startTime, this.windowScale)
    const grade = directionGrade(judgement, input.button, this.arrows[this.next])
    if (grade) this.resolve(grade, judgement.offset, input.songTime)
  }

  status(): Status {
    return this.result
  }

  destroy(): void {
    for (const object of this.objects) object.destroy()
    this.objects = []
  }

  // Settles the next answer: shows and reports its grade, moves on, and ends the game when a quarter or more
  // have been missed (knocked out) or every answer is done (won).
  private resolve(grade: HitGrade, offset: number | null, at: number): void {
    const { scene } = this.params
    this.objects.push(showJudgement(scene, grade, offset, this.pirate.x, scene.scale.height * 0.36))
    this.params.report(grade)
    this.grades[this.next] = grade
    this.lastAnswer = { at, direction: grade === 'miss' ? null : this.arrows[this.next] }
    if (grade === 'miss') this.misses++
    this.next++
    if (tooManyMisses(this.misses, this.hits.length)) {
      this.result = 'failed'
      this.diedAt = at
    } else if (this.next === this.hits.length) {
      this.result = 'won'
    }
  }

  // The parrot bobs and its bubble shows the arrow being squawked; the slots show the current group's calls
  // and grades, with the next answer's slot outlined in gold; the pirate bounces on each answer.
  private draw(songTime: number): void {
    const { width, height } = this.params.scene.scale
    const beatLength = 60 / this.params.bpm

    // The most recent squawk, if it's fresh enough to still be in the bubble.
    const squawk = this.calls.findLastIndex(call => call <= songTime)
    const squawking = squawk >= 0 && songTime - this.calls[squawk] < SQUAWK_SHOW * beatLength && this.result !== 'failed'
    this.bubble.setVisible(squawking)
    this.bubbleArrow.setVisible(squawking).setAngle(ARROW_ANGLES[this.arrows[Math.max(0, squawk)] ?? 'right'])
    const bob = squawking ? 1 - (songTime - this.calls[squawk]) / (SQUAWK_SHOW * beatLength) : 0
    this.parrot.setY(this.parrotY - bob * height * 0.03).setScale(1 + bob * 0.08)

    // The slots show the group (cycle) the next answer is in, or the last group once everything's answered.
    const cycleLength = this.meta.baseBeats * beatLength
    const focus = this.hits[Math.min(this.next, this.hits.length - 1)] ?? this.params.startTime
    const group = groupOf(focus, this.params.startTime, cycleLength)
    const inGroup = this.hits
      .map((_, i) => i)
      .filter(i => groupOf(this.hits[i], this.params.startTime, cycleLength) === group)
      .slice(0, MAX_SLOTS)
    const gap = height * 0.13
    this.slots.forEach((slot, n) => {
      const i = inGroup[n]
      const used = i !== undefined
      slot.box.setVisible(used)
      slot.arrow.setVisible(false)
      if (!used) return
      const x = width / 2 + (n - (inGroup.length - 1) / 2) * gap
      const grade = this.grades[i]
      slot.box.setX(x).setFillStyle(grade ? GRADE_COLORS[grade] : 0x1b3a52)
      slot.box.setStrokeStyle(u(this.params.scene, i === this.next && this.result === 'running' ? 4 : 2), i === this.next ? 0xffcc4d : 0xffffff)
      const show = grade !== null || arrowShowing(songTime, this.calls[i], beatLength, this.params.difficulty)
      slot.arrow.setVisible(show).setX(x).setAngle(ARROW_ANGLES[this.arrows[i]]).setFillStyle(grade ? 0x123047 : 0xffffff)
    })

    this.drawPirate(songTime)

    const missed = this.misses ? `   ${this.misses} missed` : ''
    if (this.result === 'won') this.label.setText(this.misses ? 'POLLY APPROVES!' : 'PERFECT PARROT!')
    else if (this.result === 'failed') this.label.setText('SQUAWK! TOO MANY MISSES!')
    else this.label.setText(`Answer ${this.next + 1} / ${this.hits.length}${missed}`)
  }

  // The pirate acts out each correct answer for POSE_TIME: up jumps, left and right punch that way (the punch
  // art faces right, so left is mirrored), and down ducks (a squash, until there's crouch art). A miss gets a
  // red flinch instead. Once knocked out, she does the shared death fall.
  private drawPirate(songTime: number): void {
    const height = this.params.scene.scale.height
    if (this.diedAt !== null) {
      const sinceDeath = songTime - this.diedAt
      this.pirate.setTexture(sinceDeath < DEATH_FREEZE ? PIRATE : JUMP).setTint(0xff6b6b).setFlipX(false)
      this.pirate.setScale(this.pirateScale).setY(this.feetY - deathLift(sinceDeath) * height)
      return
    }
    const pose = this.lastAnswer
    const since = pose ? songTime - pose.at : Infinity
    const posing = since >= 0 && since < POSE_TIME
    const arc = posing ? Math.sin((since / POSE_TIME) * Math.PI) : 0 // 0 to 1 and back over the pose
    const move = posing && pose!.direction

    this.pirate.setTint(posing && !move ? 0xff8a8a : 0xffffff) // a miss: a red flinch, no pose
    this.pirate.setTexture(move === 'up' ? JUMP : move === 'left' || move === 'right' ? PUNCH : PIRATE)
    this.pirate.setFlipX(move === 'left')
    this.pirate.setScale(this.pirateScale * (move === 'down' ? 1 + 0.12 * arc : 1), this.pirateScale * (move === 'down' ? 1 - 0.18 * arc : 1))
    this.pirate.setY(this.feetY - (move === 'up' ? arc * height * 0.1 : 0))
  }
}
