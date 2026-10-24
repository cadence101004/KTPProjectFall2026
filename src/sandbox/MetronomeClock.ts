import type { TimeSource } from '../engine/LevelRunner'

const START_LEAD = 0.05 // seconds, same idea as AudioClock
const SCHEDULE_AHEAD = 0.1 // seconds of clicks queued in advance so they land exactly on the beat

// Song clock for the sandbox, where there is no song: AudioContext time plus a click on every beat.
export class MetronomeClock implements TimeSource {
  private readonly ctx = new AudioContext()
  private startedAt = 0
  private running = false
  private bpm = 120
  private nextClick = 0 // beat number of the next click to schedule

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

  songTime(): number {
    return this.running ? this.ctx.currentTime - this.startedAt : 0
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
