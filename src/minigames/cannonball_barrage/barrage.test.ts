import { describe, expect, it } from 'vitest'
import { arrivalTimes, dodged, flight, JUMP_HEIGHT, JUMP_TIME, jumpLift, LOW_CLEAR, pickHeights } from './barrage'

// A small seeded RNG so ball heights are the same every test run.
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

describe('arrivalTimes', () => {
  it('lands each ball on a beat map hit, leaving out ones with almost no time to fly', () => {
    expect(arrivalTimes([10.2, 11, 12], 10, 4, 1, seeded(1))).toEqual([11, 12])
  })

  it('spreads balls through the clip when beat sync is off', () => {
    const times = arrivalTimes(null, 10, 8, 1, seeded(4))
    expect(times.length).toBeGreaterThan(3)
    for (const time of times) expect(time).toBeLessThan(18)
  })
})

describe('pickHeights', () => {
  it('mixes high and low balls', () => {
    const heights = pickHeights(40, seeded(2))
    expect(heights).toContain('high')
    expect(heights).toContain('low')
  })
})

describe('flight', () => {
  it('flies from the cannon to the pirate over one second', () => {
    expect(flight(11, 12, 0)).toBe(0)
    expect(flight(11.5, 12, 0)).toBe(0.5)
    expect(flight(12, 12, 0)).toBe(1)
  })

  it('flies faster for a ball near the clip start', () => {
    expect(flight(10.3, 10.6, 10)).toBeCloseTo(0.5) // only 0.6 s to fly
  })
})

describe('jumpLift', () => {
  it('arcs up to the jump height and lands', () => {
    expect(jumpLift(0)).toBe(0)
    expect(jumpLift(JUMP_TIME / 2)).toBeCloseTo(JUMP_HEIGHT)
    expect(jumpLift(JUMP_TIME)).toBe(0)
    expect(jumpLift(-1)).toBe(0) // no jump yet
  })
})

describe('dodged', () => {
  it('dodges a high ball by ducking', () => {
    expect(dodged('high', 0, true)).toBe(true)
    expect(dodged('high', 0, false)).toBe(false)
  })

  it('dodges a low ball by being high enough in a jump', () => {
    expect(dodged('low', LOW_CLEAR + 0.01, false)).toBe(true)
    expect(dodged('low', LOW_CLEAR / 2, false)).toBe(false) // just leaving the deck: too low
  })
})
