// TEMPLATE for task games (complete one task per cycle, N cycles per clip).
// Copy this folder to src/minigames/<your_game_id>/ and follow src/minigames/README.md.
import type Phaser from 'phaser'
import type { GameInput, MiniGame, MiniGameParams, Status, TaskMeta } from '../../types/minigame'

export class TemplateTaskGame implements MiniGame {
  meta: TaskMeta = {
    id: 'template_task', // rename: must match the folder name and GameClip.gameId
    kind: 'task',
    prompt: 'PRESS!',
    hint: 'SPACE',
    baseBeats: 2, // one task every 2 beats
  }

  private params!: MiniGameParams
  private result: Status = 'running'
  private rep = 0 // which task the player is on, 0-based
  private repDone = false // has the current task been completed?
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private label!: Phaser.GameObjects.Text

  // Queue art and sounds here, e.g. load.image('template_task_cannon', '/assets/minigames/template_task/cannon.png').
  preload(_load: Phaser.Loader.LoaderPlugin): void {}

  start(params: MiniGameParams): void {
    this.params = params
    const { width, height } = params.scene.scale
    this.label = params.scene.add.text(width / 2, height / 2, '', { fontSize: '24px' }).setOrigin(0.5)
    this.objects.push(this.label)
  }

  update(songTime: number): void {
    if (this.result === 'running') this.checkRepWindow(songTime)

    // Draw the current state. After a win, keep showing it until the clip ends (never end early).
    if (this.result === 'won') this.label.setText('NICE!')
    else if (this.result === 'failed') this.label.setText('MISSED!')
    else this.label.setText(`Task ${this.rep + 1} / ${this.params.reps}${this.repDone ? '  done' : ''}`)
  }

  handleInput(input: GameInput): void {
    if (this.result !== 'running' || this.repDone) return
    // Replace with your game's task. Here, one press of the action button completes a task.
    if (input.kind === 'button' && input.button === 'action' && input.pressed) {
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
