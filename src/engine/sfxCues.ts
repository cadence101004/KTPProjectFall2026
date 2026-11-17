import type { SfxCue } from '../types/level'

// How far ahead (seconds of song time) sound effects are handed to the audio clock. The clock then plays
// each one sample-accurately at its time, so this only needs to cover a slow frame or two.
export const SFX_LOOKAHEAD = 0.3

// Which cues on the SFX track to schedule right now (their indexes): ones not scheduled yet that start
// within the lookahead and can still be heard. A cue that started before `time` but is still sounding
// (e.g. previewing from the middle of it) is included, so it joins partway instead of being skipped.
// `duration` gives each sound's length in seconds, or undefined if its file isn't loaded (it's skipped).
export function dueCues(
  cues: SfxCue[],
  scheduled: ReadonlySet<number>,
  time: number,
  duration: (soundHash: string) => number | undefined,
): number[] {
  const due: number[] = []
  cues.forEach((cue, i) => {
    if (scheduled.has(i) || cue.at > time + SFX_LOOKAHEAD) return
    const length = duration(cue.soundHash)
    if (length !== undefined && cue.at + length > time) due.push(i)
  })
  return due
}
