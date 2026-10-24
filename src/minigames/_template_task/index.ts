// TEMPLATE for task games (complete one task per cycle, N cycles per clip).
// Copy this folder to src/minigames/<your_game_id>/ and follow src/minigames/README.md.
//
// It shows both ways a task game can be judged:
// - Beat map (params.hits is a list): press on each hit, osu-style. For games with discrete hits.
// - Windows (params.hits is null): finish one task anywhere inside each cycle. For games like scrubbing.
import type Phaser from 'phaser'
import type { GameInput, MiniGame, MiniGameParams, Status, TaskMeta } from '../../types/minigame'

const HIT_WINDOW = 0.12 // seconds either side of a hit that still count as on time

export class TemplateTaskGame implements MiniGame {
  meta: TaskMeta = {
    id: 'template_task', // rename: must match the folder name and GameClip.gameId
    kind: 'task',
    prompt: 'PRESS!',
    hint: 'SPACE',
    baseBeats: 2, // one task every 2 beats
    defaultHits: [1], // one press on the 2nd beat of each cycle. Delete this line if your game has no discrete hits
  }

  private params!: MiniGameParams
  private result: Status = 'running'
  private rep = 0 // windows mode: which task the player is on, 0-based
  private repDone = false // windows mode: has the current task been completed?
  private nextHit = 0 // beat map mode: index of the next hit to press
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private label!: Phaser.GameObjects.Text
  private target!: Phaser.GameObjects.Arc
  private ring!: Phaser.GameObjects.Arc

  // Queue art and sounds here, e.g. load.image('template_task_cannon', '/assets/minigames/template_task/cannon.png').
  preload(_load: Phaser.Loader.LoaderPlugin): void {}

  start(params: MiniGameParams): void {
    this.params = params
    const { width, height } = params.scene.scale
    this.label = params.scene.add.text(width / 2, height * 0.8, '', { fontSize: '18px' }).setOrigin(0.5)
    this.target = params.scene.add.circle(width / 2, height / 2, 20, 0xffcc4d)
    this.ring = params.scene.add.circle(width / 2, height / 2, 20).setStrokeStyle(3, 0xffffff)
    this.objects.push(this.label, this.target, this.ring)
    if (params.hits?.length === 0) this.result = 'won' // an empty beat map has nothing to miss
  }

  update(songTime: number): void {
    const hits = this.params.hits
    if (this.result === 'running') {
      if (hits) this.checkMissedHit(songTime, hits)
      else this.checkRepWindow(songTime)
    }

    // Approach ring: shrinks onto the target, touching it exactly at the next hit.
    const beatLength = 60 / this.params.bpm
    const next = hits?.[this.nextHit]
    const untilHit = next === undefined ? 0 : Math.max(0, next - songTime)
    this.ring.setScale(1 + Math.min(2, untilHit / beatLength))
    this.ring.setVisible(this.result === 'running' && next !== undefined)

    // Draw the current state. After a win, keep showing it until the clip ends (never end early).
    if (this.result === 'won') this.label.setText('NICE!')
    else if (this.result === 'failed') this.label.setText('MISSED!')
    else if (hits) this.label.setText(`Hit ${this.nextHit + 1} / ${hits.length}`)
    else this.label.setText(`Task ${this.rep + 1} / ${this.params.reps}${this.repDone ? '  done' : ''}`)
  }

  handleInput(input: GameInput): void {
    if (this.result !== 'running') return
    if (input.kind !== 'button' || input.button !== 'action' || !input.pressed) return
    const hits = this.params.hits
    if (hits) {
      // Beat map: a press counts if it's within HIT_WINDOW of the next hit. Presses far from a hit are ignored.
      if (Math.abs(input.songTime - hits[this.nextHit]) <= HIT_WINDOW) {
        this.nextHit++
        this.target.setFillStyle(0x7dff7d)
        if (this.nextHit === hits.length) this.result = 'won'
      }
    } else if (!this.repDone) {
      // Windows: replace with your game's task. Here, one press completes the current cycle's task.
      this.repDone = true
      if (this.rep === this.params.reps - 1) this.result = 'won'
    }
  }

  status(): Status {
    return this.result
  }

  destroy(): void {
    for (const object of this.objects) object.destroy()
    this.objects = []
  }

  // Beat map: letting a hit pass by without pressing fails the game.
  private checkMissedHit(songTime: number, hits: number[]): void {
    if (this.nextHit < hits.length && songTime > hits[this.nextHit] + HIT_WINDOW) this.result = 'failed'
  }

  // Windows: each task gets an equal slice of the clip. When a slice closes, its task must be done.
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
