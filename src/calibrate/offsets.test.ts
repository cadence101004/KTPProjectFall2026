import { describe, expect, it } from 'vitest'
import { beatsInView, median, offsetToBeat } from './offsets'

describe('beatsInView', () => {
  it('lists the beats inside the window', () => {
    expect(beatsInView(1, 2.5, 0.6)).toEqual([2, 3, 4]) // beats at 1.2, 1.8, 2.4
  })

  it('has no beats before the metronome starts', () => {
    expect(beatsInView(-1, 0.7, 0.6)).toEqual([0, 1])
  })
})

// 100 BPM: a beat every 0.6 s.
const beat = 0.6

describe('offsetToBeat', () => {
  it('measures a late tap', () => {
    expect(offsetToBeat(1.24, beat)).toBeCloseTo(0.04)
  })

  it('measures an early tap against the beat it was aiming for', () => {
    expect(offsetToBeat(1.17, beat)).toBeCloseTo(-0.03)
  })

  it('reads a tap right on the beat as 0', () => {
    expect(offsetToBeat(1.8, beat)).toBeCloseTo(0)
  })
})

describe('median', () => {
  it('finds the middle value', () => {
    expect(median([0.05, 0.01, 0.03])).toBe(0.03)
    expect(median([0.01, 0.02, 0.03, 0.04])).toBeCloseTo(0.025)
  })

  it('ignores one wild tap', () => {
    expect(median([0.04, 0.05, 0.04, 0.3, 0.05])).toBe(0.05)
  })

  it('is 0 with no taps', () => {
    expect(median([])).toBe(0)
  })
})
