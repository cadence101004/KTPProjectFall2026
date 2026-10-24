// Shrinks raw audio samples to one loudness value (0..1) per bucket, so a 3-minute song draws from
// ~18,000 numbers instead of ~8 million samples.
export function computePeaks(samples: Float32Array, sampleRate: number, peaksPerSecond = 100): number[] {
  const bucketSize = Math.max(1, Math.floor(sampleRate / peaksPerSecond))
  const peaks: number[] = []
  for (let start = 0; start < samples.length; start += bucketSize) {
    let max = 0
    const end = Math.min(start + bucketSize, samples.length)
    for (let i = start; i < end; i++) max = Math.max(max, Math.abs(samples[i]))
    peaks.push(max)
  }
  return peaks
}
