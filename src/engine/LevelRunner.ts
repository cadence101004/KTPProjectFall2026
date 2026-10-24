import type { Clip, Level } from '../types/level'

// Anything that reports song time. AudioClock in the game, a fake clock in tests.
export interface TimeSource {
  songTime(): number
}

export type RunnerEvent =
  | { type: 'clipStart'; index: number; clip: Clip }
  | { type: 'clipEnd'; index: number; clip: Clip }
  | { type: 'levelEnd' }

// Index of the clip playing at `time`, or -1 if none (before the first clip, in a gap, or after the last).
// Start is inclusive and end is exclusive, so at a shared boundary the next clip has already begun.
export function clipIndexAt(clips: Clip[], time: number): number {
  return clips.findIndex(clip => time >= clip.start && time < clip.end)
}

// Steps through a level's game track, reporting clip changes against the song clock.
export class LevelRunner {
  private readonly level: Level
  private readonly clock: TimeSource
  private next = 0 // index of the next clip that has not started
  private active = -1 // index of the clip currently running, or -1
  private finished = false

  constructor(level: Level, clock: TimeSource) {
    this.level = level
    this.clock = clock
  }

  // Call once per frame. Returns every clip start/end crossed since the last call, in order,
  // so a long frame hitch can never skip a clip.
  update(): RunnerEvent[] {
    const time = this.clock.songTime()
    const clips = this.level.clips
    const events: RunnerEvent[] = []

    while (true) {
      if (this.active !== -1 && time >= clips[this.active].end) {
        events.push({ type: 'clipEnd', index: this.active, clip: clips[this.active] })
        this.active = -1
      }
      if (this.active === -1 && this.next < clips.length && time >= clips[this.next].start) {
        this.active = this.next++
        events.push({ type: 'clipStart', index: this.active, clip: clips[this.active] })
        continue
      }
      break
    }

    if (!this.finished && this.active === -1 && this.next === clips.length) {
      this.finished = true
      events.push({ type: 'levelEnd' })
    }
    return events
  }

  // Jumps to `time` for restart or editor playback. The next update() starts whichever clip
  // is playing at `time`, even mid-clip. The caller moves the audio with clock.play(time).
  seek(time: number): void {
    const clips = this.level.clips
    const firstUnfinished = clips.findIndex(clip => clip.end > time)
    this.next = firstUnfinished === -1 ? clips.length : firstUnfinished
    this.active = -1
    this.finished = false
  }
}
