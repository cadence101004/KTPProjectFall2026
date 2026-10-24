// Patch the Hull: whack-a-mole on the beat. A leak springs at the start of each 2-beat cycle,
// and the player clicks it to plug it before the cycle ends. Spec in MINIGAMES.md.
import type Phaser from 'phaser'
import type { GameInput, MiniGame, MiniGameParams, Status, TaskMeta } from '../../types/minigame'
import { isPlugged, LEAK_RADIUS, pickLeakSpots, type LeakSpot } from './leaks'

// The most leaks one cycle can have (difficulty 3). start() makes this many circles once and reuses them.
const MAX_LEAKS = 3

// Placeholder colors until we have art in public/assets/minigames/patch_the_hull/.
const HULL_COLOR = 0x6b4226 // dark wood
const SEAM_COLOR = 0x3e2614 // gaps between planks
const WATER_COLOR = 0x4fc3f7 // an open leak
const PLUG_COLOR = 0xd9a441 // a plugged leak (light wood)
const PLANK_COUNT = 6

// One leak slot: where it is this cycle, whether it is still spraying, and the circle that draws it.
interface Leak {
  spot: LeakSpot
  open: boolean
  circle: Phaser.GameObjects.Arc
}

export class PatchTheHullGame implements MiniGame {
  meta: TaskMeta = {
    id: 'patch_the_hull',
    kind: 'task',
    prompt: 'PATCH!',
    hint: 'MOUSE',
    baseBeats: 2, // one leak every 2 beats
  }

  private params!: MiniGameParams
  private result: Status = 'running'
  private rep = 0 // which task the player is on, 0-based
  private repDone = false // has the current task been completed?
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private label!: Phaser.GameObjects.Text
  private leaks: Leak[] = [] // a fixed pool of MAX_LEAKS slots; only the ones in use this cycle are visible
  private leakCount = 0 // how many pool slots this cycle uses (slots 0 to leakCount - 1)
  private sprungRep = -1 // the last cycle whose leaks have sprung, so each cycle springs exactly once

  // Queue art and sounds here, e.g. load.image('template_task_cannon', '/assets/minigames/template_task/cannon.png').
  preload(_load: Phaser.Loader.LoaderPlugin): void {}

  // Builds the scene: the hull wall, a hidden pool of leak circles, and the status text on top.
  // Everything is sized from the screen, and everything goes into this.objects so destroy() removes it.
  start(params: MiniGameParams): void {
    this.params = params
    const { scene } = params
    const { width, height } = scene.scale

    // The hull wall: one wood rectangle filling the screen, with thin dark seams between the planks.
    this.objects.push(scene.add.rectangle(width / 2, height / 2, width, height, HULL_COLOR))
    const seamThickness = Math.max(2, height * 0.006)
    for (let i = 1; i < PLANK_COUNT; i++) {
      const y = (height * i) / PLANK_COUNT
      this.objects.push(scene.add.rectangle(width / 2, y, width, seamThickness, SEAM_COLOR))
    }

    // The leak pool, hidden until update() springs leaks on the beat. Creating them all now means
    // update() only moves and shows circles and never adds objects mid-clip.
    for (let i = 0; i < MAX_LEAKS; i++) {
      const circle = scene.add.circle(0, 0, LEAK_RADIUS * height, WATER_COLOR).setVisible(false)
      this.objects.push(circle)
      this.leaks.push({ spot: { x: 0, y: 0 }, open: false, circle })
    }

    // Status text, added last so it draws above the hull. It sits above HULL_AREA so it never covers a leak.
    const fontSize = `${Math.round(height * 0.06)}px`
    this.label = scene.add.text(width / 2, height * 0.15, '', { fontSize }).setOrigin(0.5)
    this.objects.push(this.label)
  }

  // Runs every frame. Closes a finished cycle, springs a new cycle's leaks on its first frame, then draws.
  update(songTime: number): void {
    if (this.result === 'running') this.checkRepWindow(songTime)

    // A new cycle has begun: spring its leaks. Cycles start on a beat, so the leaks appear on the beat.
    // The reps check stops a spring past the last cycle when the engine's final update(clip.end) runs.
    if (this.result === 'running' && this.sprungRep !== this.rep && this.rep < this.params.reps) {
      this.sprungRep = this.rep
      this.leakCount = 1 // function 6 will raise this with difficulty
      pickLeakSpots(this.leakCount, Math.random).forEach((spot, i) => {
        this.leaks[i].spot = spot
        this.leaks[i].open = true
      })
    }

    // Draw the leaks: blue while open, wood once plugged. After a win they disappear (a clean hull) and the
    // victory text stays up until the clip ends (never end early). After a fail, the open leak stays visible.
    const { width, height } = this.params.scene.scale
    this.leaks.forEach((leak, i) => {
      leak.circle.setVisible(i < this.leakCount && this.result !== 'won')
      leak.circle.setPosition(leak.spot.x * width, leak.spot.y * height)
      leak.circle.setFillStyle(leak.open ? WATER_COLOR : PLUG_COLOR)
    })

    if (this.result === 'won') this.label.setText('SHIPSHAPE!')
    else if (this.result === 'failed') this.label.setText("SHE'S SINKING!")
    else this.label.setText(`Leak ${this.rep + 1} / ${this.params.reps}`)
  }

  // A pointer press plugs every open leak it lands on. Plugging the cycle's last open leak finishes the
  // cycle, and finishing the final cycle wins the game.
  handleInput(input: GameInput): void {
    if (this.result !== 'running' || this.repDone) return
    if (input.kind !== 'pointer' || input.phase !== 'down') return // a click, not a drag or a key

    // Judge the click by its own song time. A click stamped after this cycle's window closed is too late,
    // even if update() has not run yet to close it. A click before this cycle's leaks sprang hits nothing.
    const repEnd = this.params.startTime + ((this.rep + 1) * this.params.duration) / this.params.reps
    if (input.songTime >= repEnd || this.sprungRep !== this.rep) return

    const { width, height } = this.params.scene.scale
    const inUse = this.leaks.slice(0, this.leakCount)
    for (const leak of inUse) {
      if (leak.open && isPlugged(input, leak.spot, width / height)) leak.open = false
    }
    if (inUse.some((leak) => leak.open)) return

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

  // Each task gets an equal slice of the clip. When a slice closes, its task must be done or the game fails.
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
