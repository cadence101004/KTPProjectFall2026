import { describe, expect, it } from 'vitest'
import { computePeaks } from './peaks'

describe('computePeaks', () => {
  it('makes one peak per bucket', () => {
    const samples = new Float32Array(1000)
    expect(computePeaks(samples, 1000, 100)).toHaveLength(100)
  })

  it('keeps the loudest sample in each bucket, ignoring sign', () => {
    const samples = new Float32Array([0.1, -0.8, 0.3, 0.2, 0.5, -0.1])
    expect(computePeaks(samples, 3, 1)).toEqual([expect.closeTo(0.8), expect.closeTo(0.5)])
  })

  it('includes a final partial bucket', () => {
    const samples = new Float32Array(1050)
    expect(computePeaks(samples, 1000, 100)).toHaveLength(105)
  })
})
