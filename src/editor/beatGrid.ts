// The song's beat grid: where beats fall, given the tempo and the time of the first beat.
export interface BeatGrid {
  bpm: number
  offset: number // song time of beat 0
  division: number // grid lines per beat: 1 = beats, 2 = half beats, 4 = quarter beats
}

// The grid line nearest `time`. Pass null to leave the time unsnapped.
export function snapToGrid(time: number, grid: BeatGrid | null): number {
  if (!grid) return time
  const step = 60 / grid.bpm / grid.division
  return grid.offset + Math.round((time - grid.offset) / step) * step
}

// Song times of every beat from 0 to songLength, with whether each one starts a bar (4/4 time).
export function beatTimes(bpm: number, offset: number, songLength: number): { time: number; barStart: boolean }[] {
  const beatLength = 60 / bpm
  const beats: { time: number; barStart: boolean }[] = []
  for (let beat = Math.ceil(-offset / beatLength); offset + beat * beatLength <= songLength; beat++) {
    beats.push({ time: offset + beat * beatLength, barStart: ((beat % 4) + 4) % 4 === 0 })
  }
  return beats
}
