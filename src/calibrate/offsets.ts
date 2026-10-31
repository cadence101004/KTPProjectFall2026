// Pure math for the Timing Calibration page.

// How far a tap at `tapTime` was from the nearest metronome beat, in seconds: negative is early, positive
// is late. Beats fall on whole multiples of `beatLength`, starting at 0.
export function offsetToBeat(tapTime: number, beatLength: number): number {
  return tapTime - Math.round(tapTime / beatLength) * beatLength
}

// The beat numbers (0, 1, 2...) whose times fall between `from` and `to` seconds, for drawing the notes in
// view on the beat visualizer. Beat n is at n * beatLength; there are none before 0.
export function beatsInView(from: number, to: number, beatLength: number): number[] {
  const beats: number[] = []
  for (let n = Math.max(0, Math.ceil(from / beatLength)); n * beatLength <= to; n++) beats.push(n)
  return beats
}

// The middle value of a list (0 for an empty one). Steadier than the average: one fumbled tap barely moves it.
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
