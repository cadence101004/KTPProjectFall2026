// TEMPLATE for duration games (survive until the clip ends).
// Copy this folder to src/minigames/<your_game_id>/ and follow src/minigames/README.md.
import type Phaser from 'phaser'
import type { DurationMeta, GameInput, MiniGame, MiniGameParams, Status } from '../../types/minigame'
import { u } from '../shared/units'

const SPEED = 0.6 // screen widths per second

export class TemplateDurationGame implements MiniGame {
  meta: DurationMeta = {
    id: 'template_duration', // rename: must match the folder name and GameClip.gameId
    kind: 'duration',
    prompt: 'SURVIVE!',
    hint: '← →',
    minDuration: 4, // shortest clip this game allows, in seconds
    canBeatSync: true, // set false if your game has no beat-synced version
    defaultHits: [0, 2], // beat sync on: hazards on beats 1 and 3 of each bar. Level designers can edit every hit
  }

  private params!: MiniGameParams
  private result: Status = 'running'
  private x = 0.5 // player position, 0 (left edge) to 1 (right edge)
  private holdingLeft = false
  private holdingRight = false
  private lastTime = 0
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private player!: Phaser.GameObjects.Rectangle

  // Queue art and sounds here, e.g. load.image('template_duration_ship', '/assets/minigames/template_duration/ship.png').
  preload(_load: Phaser.Loader.LoaderPlugin): void {}

  start(params: MiniGameParams): void {
    this.params = params
    this.lastTime = params.startTime
    const { width, height } = params.scene.scale
    this.player = params.scene.add.rectangle(width * this.x, height * 0.8, u(params.scene, 24), u(params.scene, 24), 0xffcc4d)
    this.objects.push(this.player)
  }

  update(songTime: number): void {
    // Move by elapsed song time, never by frame count, so speed is the same on every machine.
    const dt = songTime - this.lastTime
    this.lastTime = songTime

    if (this.result === 'running') {
      const direction = (this.holdingRight ? 1 : 0) - (this.holdingLeft ? 1 : 0)
      this.x += direction * SPEED * dt
      // Replace with your game's hazard. Here, touching either edge of the screen fails.
      if (this.x <= 0 || this.x >= 1) this.result = 'failed'
      else if (songTime >= this.params.startTime + this.params.duration) this.result = 'won'
    }

    this.player.x = this.params.scene.scale.width * Math.min(1, Math.max(0, this.x))
    this.player.fillColor = this.result === 'failed' ? 0xff4d4d : 0xffcc4d

    // Beat-synced version: params.hits lists when each hazard lands (the clip's beat map). Here the player
    // just pulses on each hit; in a real game, a slam or cannonball arrives at each of these times.
    const hits = this.params.hits
    if (hits) {
      const lastHit = hits.findLast(hit => hit <= songTime)
      const sinceHit = lastHit === undefined ? Infinity : songTime - lastHit
      this.player.setScale(1 + 0.5 * Math.max(0, 1 - sinceHit / 0.25))
    }
  }

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
}
