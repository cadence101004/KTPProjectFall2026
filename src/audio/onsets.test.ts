import { describe, expect, it } from 'vitest'
import { findOnsets } from './onsets'

// Silence with a 0.1 s burst of tone starting at each of `times`.
function bursts(times: number[], sampleRate = 8000, length = 2): Float32Array {
  const samples = new Float32Array(sampleRate * length)
  for (const time of times) {
    const start = Math.round(time * sampleRate)
    for (let i = 0; i < sampleRate * 0.1; i++) samples[start + i] = Math.sin(i / 3) * 0.8
  }
  return samples
}

describe('findOnsets', () => {
  it('finds where each burst begins', () => {
    const onsets = findOnsets(bursts([0.1, 0.6, 1.1, 1.6]), 8000)
    expect(onsets).toHaveLength(4)
    onsets.forEach((onset, i) => expect(onset).toBeCloseTo([0.1, 0.6, 1.1, 1.6][i], 1))
  })

  it('finds nothing in silence', () => {
    expect(findOnsets(new Float32Array(8000), 8000)).toEqual([])
  })
})
