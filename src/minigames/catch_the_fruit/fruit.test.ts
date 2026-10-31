import { describe, expect, it } from 'vitest'
import { catchGrade, fallProgress, landSpots, landTimes, WALK_SPEED } from './fruit'

// A small seeded RNG so fruit placement is the same every test run.
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

describe('landTimes', () => {
  it('lands one fruit on each beat map hit', () => {
    expect(landTimes([11, 11.5, 12], 10, 4, 1, seeded(1))).toEqual([11, 11.5, 12])
  })

  it('leaves out fruit with almost no time to fall', () => {
    expect(landTimes([10.2, 11], 10, 4, 1, seeded(1))).toEqual([11])
  })

  it('spreads fruit through the clip when beat sync is off', () => {
    const times = landTimes(null, 10, 8, 1, seeded(4))
    expect(times.length).toBeGreaterThan(3)
    expect(times[0]).toBeCloseTo(11)
    for (const time of times) expect(time).toBeLessThan(18)
  })
})

describe('landSpots', () => {
  it('keeps every fruit within walking reach of the last', () => {
    const times = [10.5, 11, 11.25, 11.5, 12.5]
    const spots = landSpots(times, 0.5, 10, seeded(9))
    let x = 0.5
    let previous = 10
    times.forEach((time, i) => {
      expect(Math.abs(spots[i] - x)).toBeLessThanOrEqual(WALK_SPEED * (time - previous) + 1e-9)
      x = spots[i]
      previous = time
    })
  })

  it('keeps fruit off the screen edges', () => {
    for (const spot of landSpots([11, 12, 13, 14, 15, 16], 0.5, 10, seeded(2))) {
      expect(spot).toBeGreaterThanOrEqual(0.1)
      expect(spot).toBeLessThanOrEqual(0.9)
    }
  })
})

describe('fallProgress', () => {
  it('falls from the top to the bucket over one second', () => {
    expect(fallProgress(11, 12, 0)).toBe(0)
    expect(fallProgress(11.5, 12, 0)).toBe(0.5)
    expect(fallProgress(12, 12, 0)).toBe(1)
  })

  it('falls faster for a fruit near the clip start', () => {
    expect(fallProgress(10.6, 10.6, 10)).toBe(1) // only 0.6 s to fall
    expect(fallProgress(10.3, 10.6, 10)).toBeCloseTo(0.5)
  })
})

describe('catchGrade', () => {
  it('grades by how close to the bucket center the fruit lands', () => {
    expect(catchGrade(0.01, 0.1)).toBe('perfect')
    expect(catchGrade(-0.05, 0.1)).toBe('great')
    expect(catchGrade(0.09, 0.1)).toBe('good')
    expect(catchGrade(0.15, 0.1)).toBe('miss')
  })
})
