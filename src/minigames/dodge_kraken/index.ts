// Dodge the Kraken: the deck has 3 lanes. A tentacle's shadow warns which lane is about to be slammed, and
// the player hops left or right to stay out of it. Survive to the clip's end to win. With beat sync on,
// every slam lands on a beat map hit. Spec in MINIGAMES.md. Pirate, kraken, and deck art by Cadence.
import type Phaser from 'phaser'
import type { DurationMeta, GameInput, MiniGame, MiniGameParams, Status } from '../../types/minigame'
import { addBackdrop, loadBackdrop } from '../shared/backdrop'
import { textStyle } from '../shared/font'
import { u } from '../shared/units'
import { DEATH_FREEZE, deathLift } from '../shared/deathFall'
import { hopLift, hopProgress } from './motion'
import { freeSlams, LANES, type Slam, stepLane, syncedSlams } from './slams'

// Texture keys, prefixed with the game ID so they never clash with another game's.
const PIRATE = 'dodge_kraken_pirate'
const HOP_UP = 'dodge_kraken_hop_up' // first half of a sideways hop
const HOP_DOWN = 'dodge_kraken_hop_down' // second half
const DEATH_JUMP = 'dodge_kraken_death_jump'
// The tentacle slam: three frames coming down, the impact, and the splash after.
const TENTACLE = [1, 2, 3, 4, 5].map(n => `dodge_kraken_tentacle${n}`)

const LANE_LINE_COLOR = 0x4a2e14
const SHADOW_COLOR = 0x000000

const DROP_TIME = 0.15 // seconds the tentacle takes to come down before it slams
const DROP_FROM = 0.4 // how far above the deck (screen heights) the tentacle starts its drop
const ART_HEIGHT = 327 // pixels tall of the shortest landed frame (kraken5), which must still reach the top
const IMPACT_TIME = 0.1 // seconds the impact frame shows, before the splash
const SLAM_SHOW = 0.3 // seconds a tentacle stays down after slamming
const DECK_Y = 0.92 // where the pirate's feet rest, as a fraction of the screen height

export class DodgeKrakenGame implements MiniGame {
  meta: DurationMeta = {
    id: 'dodge_kraken',
    kind: 'duration',
    prompt: 'DODGE!',
    hint: '← →',
    minDuration: 4,
    canBeatSync: true,
    defaultHits: [0, 2], // beat sync on: slams on beats 1 and 3 of each bar
  }

  private params!: MiniGameParams
  private result: Status = 'running'
  private slams: Slam[] = []
  private resolved = 0 // how many slams have landed (and been checked against the player)
  private lane = 1 // the player's lane: 0 left, 1 middle, 2 right. Dodging counts the instant it changes
  private hopFrom = 1 // the lane the current hop started in (the hop itself is only for show)
  private hopAt = -Infinity // song time the last hop started
  private diedAt: number | null = null // song time of the slam that squashed the pirate
  private objects: Phaser.GameObjects.GameObject[] = [] // everything added to the scene, for destroy()
  private shadows: Phaser.GameObjects.Rectangle[] = [] // one warning shadow per lane
  private tentacles: Phaser.GameObjects.Image[] = [] // one tentacle per lane
  private tentacleScale = 1
  private pirate!: Phaser.GameObjects.Image
  private label!: Phaser.GameObjects.Text

  // The team's pirate sprites (idle, the two halves of a sideways jump, the front jump for the death), the
  // kraken's tentacle slam, and the ship deck.
  preload(load: Phaser.Loader.LoaderPlugin): void {
    load.image(PIRATE, '/assets/sprites/idle_character/pirate.png')
    load.image(HOP_UP, '/assets/sprites/jumping_character/jumpingsideways1.png')
    load.image(HOP_DOWN, '/assets/sprites/jumping_character/jumpingsideways2.png')
    load.image(DEATH_JUMP, '/assets/sprites/jumping_character/jumpingforwards.png')
    TENTACLE.forEach((key, i) => load.image(key, `/assets/sprites/kraken/kraken${i + 1}.png`))
    loadBackdrop(load, 'deck')
  }

  // Plans every slam for the clip up front, then builds the deck, lanes, shadows, tentacles, and pirate.
  start(params: MiniGameParams): void {
    this.params = params
    this.slams = params.hits
      ? syncedSlams(params.hits, 60 / params.bpm, params.startTime, params.difficulty, Math.random)
      : freeSlams(params.startTime, params.duration, params.difficulty, Math.random)

    const { scene } = params
    const { width, height } = scene.scale
    const laneWidth = width / LANES
    // Background layer: Cadence's ship deck. It's the playfield, so it's always drawn (no canHideBackground
    // in meta). The lane lines, shadows, tentacles, and pirate are the foreground.
    this.objects.push(addBackdrop(scene, 'deck'))
    for (let i = 1; i < LANES; i++) {
      this.objects.push(scene.add.rectangle(laneWidth * i, height / 2, u(scene, 3), height, LANE_LINE_COLOR).setAlpha(0.5))
    }
    // Every tentacle frame shares one scale (the art is drawn at one pixel size), so it doesn't jump in size.
    // It's big enough that a landed tentacle reaches from the deck to the top of the screen: the art's top
    // edge is cut flat, so it must never show. While dropping, frames start DROP_FROM higher, keeping that
    // edge above the screen too.
    this.tentacleScale = (height * DECK_Y * 1.03) / ART_HEIGHT
    for (let i = 0; i < LANES; i++) {
      const x = laneWidth * (i + 0.5)
      const shadow = scene.add.rectangle(x, height * 0.6, laneWidth * 0.8, height * 0.7, SHADOW_COLOR).setAlpha(0)
      const tentacle = scene.add.image(x, height * DECK_Y, TENTACLE[0]).setOrigin(0.5, 1).setScale(this.tentacleScale).setDepth(1).setVisible(false) // in front of the pirate, to squash her
      this.shadows.push(shadow)
      this.tentacles.push(tentacle)
      this.objects.push(shadow, tentacle)
    }
    // Anchored at the feet, so every frame stands on the deck the same way.
    this.pirate = scene.add.image(this.laneX(this.lane), height * DECK_Y, PIRATE).setOrigin(0.5, 1)
    this.pirate.setScale((height * 0.24) / this.pirate.height)
    this.label = scene.add.text(width / 2, height * 0.12, '', textStyle(Math.round(height * 0.07))).setOrigin(0.5)
    this.objects.push(this.pirate, this.label)
  }

  // Runs every frame: lands any slams that are due (failing if the pirate is under one), checks for the
  // win at the clip's end, then draws shadows, tentacles, and the pirate.
  update(songTime: number): void {
    while (this.result === 'running' && this.resolved < this.slams.length && this.slams[this.resolved].at <= songTime) {
      const slam = this.slams[this.resolved]
      if (slam.lanes.includes(this.lane)) {
        this.result = 'failed'
        this.diedAt = slam.at
      }
      this.resolved++
    }
    if (this.result === 'running' && songTime >= this.params.startTime + this.params.duration) this.result = 'won'

    // Shadows darken as their slam nears; the tentacle drops in just before it lands, then splashes.
    const height = this.params.scene.scale.height
    for (let lane = 0; lane < LANES; lane++) {
      let shadow = 0
      let since: number | null = null // seconds since this lane's current slam (negative while dropping)
      for (const slam of this.slams) {
        if (!slam.lanes.includes(lane)) continue
        if (songTime >= slam.warnAt && songTime < slam.at) {
          shadow = Math.max(shadow, 0.15 + 0.5 * ((songTime - slam.warnAt) / (slam.at - slam.warnAt)))
        }
        if (songTime >= slam.at - DROP_TIME && songTime < slam.at + SLAM_SHOW) since = songTime - slam.at
      }
      this.shadows[lane].setAlpha(this.result === 'won' ? 0 : shadow)
      const tentacle = this.tentacles[lane].setVisible(since !== null)
      if (since === null) continue
      if (since < 0) {
        // Dropping: frames 1 to 3, sliding down from above onto the deck.
        const drop = 1 + since / DROP_TIME // 0 to 1
        tentacle.setTexture(TENTACLE[Math.min(2, Math.floor(drop * 3))]).setY(height * (DECK_Y - DROP_FROM * (1 - drop)))
      } else {
        tentacle.setTexture(TENTACLE[since < IMPACT_TIME ? 3 : 4]).setY(height * DECK_Y)
      }
    }

    this.drawPirate(songTime)
    if (this.result === 'won') this.label.setText('SURVIVED!')
    else if (this.result === 'failed') this.label.setText('SQUASHED!')
    else this.label.setText('')
  }

  // Left and right hop one lane at a time. The dodge counts immediately; the hop arc is only for show.
  handleInput(input: GameInput): void {
    if (this.result !== 'running' || input.kind !== 'button' || !input.pressed) return
    const direction = input.button === 'left' ? -1 : input.button === 'right' ? 1 : 0
    if (direction === 0) return
    const next = stepLane(this.lane, direction)
    if (next === this.lane) return // already at the edge
    this.hopFrom = this.lane
    this.hopAt = input.songTime
    this.lane = next
  }

  status(): Status {
    return this.result
  }

  destroy(): void {
    for (const object of this.objects) object.destroy()
    this.objects = []
  }

  // Squashed: a red freeze, then a Mario-style jump up and fall off the bottom of the screen.
  // Otherwise: standing in its lane, or mid-hop in a sideways jump arc (mirrored when hopping left).
  private drawPirate(songTime: number): void {
    const height = this.params.scene.scale.height
    const deckY = height * DECK_Y
    if (this.diedAt !== null) {
      const sinceDeath = songTime - this.diedAt
      this.pirate.setTexture(sinceDeath < DEATH_FREEZE ? PIRATE : DEATH_JUMP).setFlipX(false).setTint(0xff6b6b)
      this.pirate.setPosition(this.laneX(this.lane), deckY - deathLift(sinceDeath) * height)
      return
    }
    const progress = hopProgress(songTime, this.hopAt)
    const hopping = progress < 1
    const x = this.laneX(this.hopFrom) + (this.laneX(this.lane) - this.laneX(this.hopFrom)) * progress
    this.pirate.setTexture(!hopping ? PIRATE : progress < 0.5 ? HOP_UP : HOP_DOWN)
    this.pirate.setFlipX(hopping && this.lane < this.hopFrom) // the jump frames face right
    this.pirate.setPosition(x, deckY - hopLift(progress) * height)
  }

  private laneX(lane: number): number {
    return (this.params.scene.scale.width / LANES) * (lane + 0.5)
  }
}

