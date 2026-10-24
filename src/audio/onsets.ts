// Times (seconds) where bursts of sound begin, e.g. each word of a "3, 2, 1, GO" sound effect.
// Loudness is measured in 10 ms frames; an onset is a frame that gets loud after the sound went quiet.
export function findOnsets(samples: Float32Array, sampleRate: number, minGap = 0.15): number[] {
  const frameSize = Math.max(1, Math.round(sampleRate * 0.01))
  const loudness: number[] = []
  for (let start = 0; start < samples.length; start += frameSize) {
    const end = Math.min(start + frameSize, samples.length)
    let sum = 0
    for (let i = start; i < end; i++) sum += samples[i] * samples[i]
    loudness.push(Math.sqrt(sum / (end - start)))
  }

  const peak = loudness.reduce((max, value) => Math.max(max, value), 0)
  if (peak === 0) return [] // pure silence
  const loud = peak * 0.3 // must reach this to count as a new burst
  const quiet = peak * 0.1 // must drop below this before the next burst can start
  const onsets: number[] = []
  let ready = true
  loudness.forEach((value, frame) => {
    const time = (frame * frameSize) / sampleRate
    if (ready && value >= loud && time - (onsets.at(-1) ?? -Infinity) >= minGap) {
      onsets.push(time)
      ready = false
    } else if (value < quiet) {
      ready = true
    }
  })
  return onsets
}
