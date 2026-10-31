import type { Clip } from '../types/level'

// The 321GO cue before a minigame. Its four counts are spread one song beat apart (or at the level's manual
// rate), and "GO" lands on a beat about a second before the minigame starts (see goLead).

export const COUNT_LABELS = ['3', '2', '1', 'GO!']
export const GO_LEAD_SECONDS = 1 // breather between GO and the minigame starting

// The gap between GO and the minigame: about GO_LEAD_SECONDS, rounded to whole beats (at least one)
// so the minigame still starts on the beat.
export function goLead(bpm: number): number {
  const beatLength = 60 / bpm
  return Math.max(1, Math.round(GO_LEAD_SECONDS / beatLength)) * beatLength
}

export interface CountdownCue {
  soundAt: number // song time to start playing the sound
  fileOffset: number // seconds into the sound file to start from (non-zero when the buffer is too short)
  rate: number // playback speed; pitch rises with it
  beats: number[] // song times of 3, 2, 1, GO
}

// The four count times inside the sound file. Falls back to even quarters if the sound didn't split into
// four clear bursts.
export function countdownBeats(onsets: number[], fileLength: number): number[] {
  if (onsets.length >= 4) return onsets.slice(0, 4)
  return [0, 0.25, 0.5, 0.75].map(fraction => fraction * fileLength)
}

// The playback rate that puts one count on each song beat: the gap between counts in the file, divided by
// one beat. This is the rate a level uses unless it sets countdownRate.
export function autoCountdownRate(fileBeats: number[], bpm: number): number {
  const spacing = (fileBeats[3] - fileBeats[0]) / 3
  return spacing > 0 ? spacing / (60 / bpm) : 1
}

// How long a buffer must be (seconds) to fit the whole countdown, from the sound's first moment through GO,
// plus the breather before the minigame. A shorter buffer still works; the countdown just starts partway.
export function countdownNeeds(fileBeats: number[], bpm: number, manualRate?: number): number {
  const rate = manualRate ?? autoCountdownRate(fileBeats, bpm)
  return fileBeats[3] / rate + goLead(bpm)
}

// The buffers that come right before a minigame but are shorter than `needs` seconds, so their countdown
// will start partway. Buffers before another buffer (or at the end) never play a countdown and are skipped.
export function shortCountdownBuffers(clips: Clip[], needs: number): Clip[] {
  return clips.filter((clip, i) => clip.type === 'buffer' && clips[i + 1]?.type === 'game' && clip.end - clip.start < needs - 1e-6)
}

// Plans the cue so that GO lands at `goTime`. The sound may not start before `windowStart` (the start of
// the buffer before the minigame); if it would, it starts there partway into the file.
export function planCountdown(
  fileBeats: number[],
  goTime: number,
  windowStart: number,
  bpm: number,
  manualRate?: number,
): CountdownCue {
  const rate = manualRate ?? autoCountdownRate(fileBeats, bpm)
  let soundAt = goTime - fileBeats[3] / rate
  const beats = fileBeats.map(beat => soundAt + beat / rate)
  let fileOffset = 0
  if (soundAt < windowStart) {
    fileOffset = (windowStart - soundAt) * rate
    soundAt = windowStart
  }
  return { soundAt, fileOffset, rate, beats }
}
