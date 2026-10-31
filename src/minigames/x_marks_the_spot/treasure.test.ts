import { describe, expect, it } from 'vitest'
import { AREA, digGrade, digSpots, digTimes, distance, WALK_SPEED } from './treasure'

// A small seeded RNG so X placement is the same every test run.
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const aspect = 16 / 9

describe('digTimes', () => {
  it('digs on each beat map hit, leaving out ones with almost no time to reach', () => {
    expect(digTimes([10.2, 11, 12], 10, 4, 1, seeded(1))).toEqual([11, 12])
  })

  it('spreads digs through the clip when beat sync is off', () => {
    const times = digTimes(null, 10, 8, 1, seeded(4))
    expect(times.length).toBeGreaterThan(2)
    for (const time of times) expect(time).toBeLessThan(18)
  })
})

describe('distance', () => {
  it('measures on the real screen shape', () => {
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 0.3 }, aspect)).toBeCloseTo(0.3)
    expect(distance({ x: 0, y: 0 }, { x: 0.3 / aspect, y: 0 }, aspect)).toBeCloseTo(0.3) // same distance sideways
  })
})

describe('digSpots', () => {
  const times = [11, 12, 12.5, 13.5, 14, 15]
  const spots = digSpots(times, { x: 0.5, y: 0.5 }, 10, aspect, seeded(7))

  it('keeps every X within walking reach of the last', () => {
    let at = { x: 0.5, y: 0.5 }
    let previous = 10
    times.forEach((time, i) => {
      expect(distance(at, spots[i], aspect)).toBeLessThanOrEqual(WALK_SPEED * (time - previous) + 1e-9)
      at = spots[i]
      previous = time
    })
  })

  it('keeps every X inside the play area', () => {
    for (const spot of spots) {
      expect(spot.x).toBeGreaterThanOrEqual(AREA.left)
      expect(spot.x).toBeLessThanOrEqual(AREA.right)
      expect(spot.y).toBeGreaterThanOrEqual(AREA.top)
      expect(spot.y).toBeLessThanOrEqual(AREA.bottom)
    }
  })
})

describe('digGrade', () => {
  const reach = 0.1
  const lateWindow = 0.16

  it('is a Perfect anywhere on the X when it is dug, centered or not', () => {
    expect(digGrade(0.01, reach, 0, lateWindow)).toBe('perfect')
    expect(digGrade(0.095, reach, 0, lateWindow)).toBe('perfect')
  })

  it('is a late Good for arriving just after the dig', () => {
    expect(digGrade(0.05, reach, 0.1, lateWindow)).toBe('good')
  })

  it('waits during the late window, then misses', () => {
    expect(digGrade(0.3, reach, 0.1, lateWindow)).toBeNull()
    expect(digGrade(0.3, reach, 0.2, lateWindow)).toBe('miss')
  })

  it('decides nothing before the dig', () => {
    expect(digGrade(0, reach, -0.5, lateWindow)).toBeNull()
  })
})
