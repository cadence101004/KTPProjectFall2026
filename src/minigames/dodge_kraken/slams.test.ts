import { describe, expect, it } from 'vitest'
import { freeSlams, LANES, pickLanes, slamSettings, stepLane, syncedSlams } from './slams'

// A small seeded RNG so slam lanes are the same every test run.
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

// 120 BPM: a beat is 0.5 s. The clip starts at 10 s.
const beat = 0.5

describe('pickLanes', () => {
  it('always leaves at least one lane safe', () => {
    const random = seeded(3)
    for (let i = 0; i < 200; i++) {
      const lanes = pickLanes(1, random)
      expect(lanes.length).toBeLessThan(LANES)
      expect(new Set(lanes).size).toBe(lanes.length)
      for (const lane of lanes) expect(lane).toBeGreaterThanOrEqual(0)
    }
  })

  it('hits a single lane when two-lane slams are off', () => {
    const random = seeded(5)
    for (let i = 0; i < 50; i++) expect(pickLanes(0, random)).toHaveLength(1)
  })
})

describe('syncedSlams', () => {
  it('lands a slam on each hit with its shadow one beat early', () => {
    const slams = syncedSlams([11, 12], beat, 10, 1, seeded(1))
    expect(slams.map(s => [s.warnAt, s.at])).toEqual([
      [10.5, 11],
      [11.5, 12],
    ])
  })

  it('shortens the warning to fit near the clip start', () => {
    expect(syncedSlams([10.3], beat, 10, 1, seeded(1))[0].warnAt).toBe(10)
  })

  it('drops a slam with almost no warning, like one right on the clip start', () => {
    expect(syncedSlams([10, 10.1, 11], beat, 10, 1, seeded(1)).map(s => s.at)).toEqual([11])
  })
})

describe('freeSlams', () => {
  it('spreads slams through the clip with a full warning each', () => {
    const { warning, minGap, maxGap } = slamSettings(1)
    const slams = freeSlams(10, 8, 1, seeded(9))
    expect(slams.length).toBeGreaterThan(2)
    expect(slams[0].warnAt).toBeCloseTo(10)
    for (const slam of slams) {
      expect(slam.at - slam.warnAt).toBeCloseTo(warning)
      expect(slam.at).toBeLessThan(18)
    }
    for (let i = 1; i < slams.length; i++) {
      const gap = slams[i].at - slams[i - 1].at
      expect(gap).toBeGreaterThanOrEqual(minGap - 1e-9)
      expect(gap).toBeLessThanOrEqual(maxGap + 1e-9)
    }
  })
})

describe('stepLane', () => {
  it('moves one lane and stops at the edges', () => {
    expect(stepLane(1, -1)).toBe(0)
    expect(stepLane(0, -1)).toBe(0)
    expect(stepLane(2, 1)).toBe(2)
  })
})
