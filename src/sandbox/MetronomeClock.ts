import type { TimeSource } from '../engine/LevelRunner'
import { loadLatencyMs } from '../settings/timing'

const START_LEAD = 0.05 // seconds, same idea as AudioClock
const SCHEDULE_AHEAD = 0.1 // seconds of clicks queued in advance so they land exactly on the beat

// Song clock for the sandbox and the calibration page, where there is no song: AudioContext time plus a
// click on every beat.
export class MetronomeClock implements TimeSource {
  private readonly ctx = new AudioContext()
  private readonly latency: number // seconds songTime() runs behind the clicks; see AudioClock
  private startedAt = 0
  private running = false
  private bpm = 120
  private nextClick = 0 // beat number of the next click to schedule

  // Uses the player's calibrated latency by default. The calibration page passes 0 to measure it.
  constructor(latencySeconds = loadLatencyMs() / 1000) {
    this.latency = latencySeconds
  }

  // Starts song time at 0 with a click on beat 0. The first call must come from a user gesture.
  async start(bpm: number): Promise<void> {
    await this.ctx.resume()
    this.bpm = bpm
    this.startedAt = this.ctx.currentTime + START_LEAD
    this.nextClick = 0
    this.running = true
  }

  stop(): void {
    this.running = false
  }

  // Beat n's click is heard at song time n * beat length (once latency is calibrated).
  songTime(): number {
    return this.running ? this.ctx.currentTime - this.startedAt - this.latency : 0
  }

  // Call every frame. Queues the clicks due in the next SCHEDULE_AHEAD seconds on the audio clock.
  scheduleClicks(): void {
    if (!this.running) return
    const beatLength = 60 / this.bpm
    while (this.startedAt + this.nextClick * beatLength < this.ctx.currentTime + SCHEDULE_AHEAD) {
      const when = this.startedAt + this.nextClick * beatLength
      if (when >= this.ctx.currentTime) this.click(when, this.nextClick % 4 === 0)
      this.nextClick++
    }
  }

  // A short beep: higher pitched on the first beat of each bar.
  private click(when: number, accent: boolean): void {
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.frequency.value = accent ? 1500 : 1000
    gain.gain.setValueAtTime(0.25, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.05)
    osc.connect(gain).connect(this.ctx.destination)
    osc.start(when)
    osc.stop(when + 0.05)
  }
}
