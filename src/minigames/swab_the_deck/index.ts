// Swab the Deck: grime spots appear at the start of each 4-beat cycle, and the player scrubs them clean by
// moving the mop (the mouse, no button needed) back and forth over each one. The game only fails if grime
// is still left when the next wave arrives, or when the clip ends for the last wave. No beat map: it's
// judged by cycle windows. Spec in MINIGAMES.md.
import type Phaser from 'phaser'
import type { GameInput, MiniGame, MiniGameParams, Status, TaskMeta } from '../../types/minigame'
import { textStyle } from '../shared/font'
import { u } from '../shared/units'
import { grimeFor, type GrimeSettings, MOP_REACH, pickGrimeSpots, type Point, rubAmount } from './grime'

// The most spots one cycle can have (difficulty 3). start() makes this many circles once and reuses them.
const MAX_SPOTS = 5

// Placeholder colors until we have art in public/assets/minigames/swab_the_deck/.
const DECK_COLOR = 0x8a5a2b // light wood
const SEAM_COLOR = 0x5c3a1a // gaps between planks
const GRIME_COLOR = 0x3b2a12 // a dirty spot
const MOP_COLOR = 0xf4e9d0
const PLANK_COUNT = 7

// One spot slot: where it is this cycle, how much scrubbing it still needs, and the circle that draws it.
interface Spot {
  at: Point
  dirt: number // scrubbing left; 0 means clean
  circle: Phaser.GameObjects.Arc
}

export class SwabTheDeckGame implements MiniGame {
  meta: TaskMeta = {
    id: 'swab_the_deck',
    kind: 'task',
    prompt: 'SWAB!',
    hint: 'MOUSE',
    baseBeats: 4, // one deck to clean every 4 beats. No defaultHits: judged by cycle windows, not hits
  }

  private params!: MiniGameParams
  private grime!: GrimeSettings
  private result: Status = 'running'
  private rep = 0 // which deck the player is on, 0-based
  private repDone = false // is the current deck clean?
  private sprungRep = -1 // the last cycle whose grime has appeared, so each cycle's grime appears once
  private spots: Spot[] = [] // a fixed pool of MAX_SPOTS slots; only grime.count are used
  private mopAt: Point = { x: 0.5, y: 0.5 }
  private lastAt: Point | null = null // where the mop was on the previous pointer event
  private scrubbedAt = -Infinity // song time the mop last scrubbed some grime, to show it working
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private mop!: Phaser.GameObjects.Arc
  private label!: Phaser.GameObjects.Text

  // Queue art and sounds here, e.g. load.image('swab_the_deck_mop', '/assets/minigames/swab_the_deck/mop.png').
  preload(_load: Phaser.Loader.LoaderPlugin): void {}

  // Builds the scene: deck planks, a hidden pool of grime spots, the mop, and the text. All into this.objects.
  start(params: MiniGameParams): void {
    this.params = params
    this.grime = grimeFor(params.difficulty)
    const { scene } = params
    const { width, height } = scene.scale

    this.objects.push(scene.add.rectangle(width / 2, height / 2, width, height, DECK_COLOR))
    for (let i = 1; i < PLANK_COUNT; i++) {
      const y = (height * i) / PLANK_COUNT
      this.objects.push(scene.add.rectangle(width / 2, y, width, Math.max(2, height * 0.006), SEAM_COLOR))
    }

    for (let i = 0; i < MAX_SPOTS; i++) {
      const circle = scene.add.circle(0, 0, this.grime.radius * height, GRIME_COLOR).setVisible(false)
      this.objects.push(circle)
      this.spots.push({ at: { x: 0, y: 0 }, dirt: 0, circle })
    }

    this.mop = scene.add.circle(width / 2, height / 2, this.grime.radius * height * MOP_REACH).setStrokeStyle(u(scene, 3), MOP_COLOR)
    this.label = scene.add.text(width / 2, height * 0.14, '', textStyle(Math.round(height * 0.07))).setOrigin(0.5)
    this.objects.push(this.mop, this.label)
  }

  // Runs every frame: closes a finished cycle, lays new grime when a cycle begins, then draws.
  update(songTime: number): void {
    if (this.result === 'running') this.checkRepWindow(songTime)

    // A new cycle has begun: fresh grime. Cycles start on a beat, so the grime appears on the beat.
    // The reps check stops new grime past the last cycle when the engine's final update(clip.end) runs.
    if (this.result === 'running' && this.sprungRep !== this.rep && this.rep < this.params.reps) {
      this.sprungRep = this.rep
      pickGrimeSpots(this.grime.count, Math.random).forEach((at, i) => {
        this.spots[i].at = at
        this.spots[i].dirt = this.grime.dirt
      })
    }

    // Grime fades as it's scrubbed and vanishes when clean. After a win the deck stays spotless until the
    // clip ends (never end early); after a fail the leftover grime stays visible.
    const { width, height } = this.params.scene.scale
    this.spots.forEach((spot, i) => {
      const inUse = i < this.grime.count && this.result !== 'won'
      spot.circle.setVisible(inUse && spot.dirt > 0)
      spot.circle.setPosition(spot.at.x * width, spot.at.y * height)
      spot.circle.setAlpha(0.25 + 0.75 * (spot.dirt / this.grime.dirt))
    })
    this.mop.setPosition(this.mopAt.x * width, this.mopAt.y * height)
    this.mop.setFillStyle(MOP_COLOR, songTime - this.scrubbedAt < 0.1 ? 0.35 : 0) // fills in while it's scrubbing

    const left = this.spotsLeft()
    if (this.result === 'won') this.label.setText('SPOTLESS!')
    else if (this.result === 'failed') this.label.setText('FILTHY!')
    else if (this.repDone) this.label.setText('CLEAN!')
    else this.label.setText(`Deck ${this.rep + 1} / ${this.params.reps}   ${left} spot${left === 1 ? '' : 's'} left`)
  }

  // Just move the mouse to scrub; no button needed. Each stroke between pointer events scrubs every spot
  // it passes over.
  handleInput(input: GameInput): void {
    if (input.kind !== 'pointer') return
    const at = { x: input.x, y: input.y }
    const from = this.lastAt
    this.mopAt = at
    this.lastAt = at
    if (!from || this.result !== 'running' || this.repDone) return

    // Judge the stroke by its own song time: one after this cycle's window closed is too late, even if
    // update() hasn't closed it yet. Strokes before this cycle's grime appeared scrub nothing.
    const repEnd = this.params.startTime + ((this.rep + 1) * this.params.duration) / this.params.reps
    if (input.songTime >= repEnd || this.sprungRep !== this.rep) return

    const { width, height } = this.params.scene.scale
    for (const spot of this.spots.slice(0, this.grime.count)) {
      // The mop ring scrubs anything it touches: the spot's radius plus the ring's own radius.
      const reach = this.grime.radius * (1 + MOP_REACH)
      const rubbed = spot.dirt > 0 ? rubAmount(spot.at, from, at, width / height, reach) : 0
      if (rubbed > 0) this.scrubbedAt = input.songTime
      spot.dirt = Math.max(0, spot.dirt - rubbed)
    }
    if (this.spotsLeft() > 0) return
    this.repDone = true
    if (this.rep === this.params.reps - 1) this.result = 'won'
  }

  status(): Status {
    return this.result
  }

  destroy(): void {
    for (const object of this.objects) object.destroy()
    this.objects = []
  }

  private spotsLeft(): number {
    return this.spots.slice(0, this.grime.count).filter(spot => spot.dirt > 0).length
  }

  // Each deck gets an equal slice of the clip, and the next wave of grime arrives when a slice closes. This
  // is the only place the game can fail: grime still left when the next wave arrives, or when the clip ends
  // for the last wave (the engine's final update(clip.end) closes that slice).
  private checkRepWindow(songTime: number): void {
    const repLength = this.params.duration / this.params.reps
    const current = Math.floor((songTime - this.params.startTime) / repLength + 1e-6)
    if (current <= this.rep) return
    if (!this.repDone) {
      this.result = 'failed'
      return
    }
    this.rep = current
    this.repDone = false
  }
}
