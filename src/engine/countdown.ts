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

// Plans the cue so that GO lands at `goTime`. The sound may not start before `windowStart` (the start of
// the buffer before the minigame); if it would, it starts there partway into the file.
export function planCountdown(
  fileBeats: number[],
  goTime: number,
  windowStart: number,
  bpm: number,
  manualRate?: number,
): CountdownCue {
  const spacing = (fileBeats[3] - fileBeats[0]) / 3
  const rate = manualRate ?? (spacing > 0 ? spacing / (60 / bpm) : 1)
  let soundAt = goTime - fileBeats[3] / rate
  const beats = fileBeats.map(beat => soundAt + beat / rate)
  let fileOffset = 0
  if (soundAt < windowStart) {
    fileOffset = (windowStart - soundAt) * rate
    soundAt = windowStart
  }
  return { soundAt, fileOffset, rate, beats }
}
