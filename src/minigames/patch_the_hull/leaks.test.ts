import { describe, expect, it } from 'vitest'
import { HULL_AREA, isPlugged, LEAK_RADIUS, MIN_LEAK_GAP, pickLeakSpots } from './leaks'

// A small seeded RNG (mulberry32) so every test run sees the same "random" numbers.
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('pickLeakSpots', () => {
  it('returns the number of leaks asked for', () => {
    expect(pickLeakSpots(0, seeded(1))).toEqual([])
    expect(pickLeakSpots(1, seeded(1))).toHaveLength(1)
    expect(pickLeakSpots(3, seeded(1))).toHaveLength(3)
  })

  it('keeps every leak on the hull and apart from the others', () => {
    for (let seed = 0; seed < 200; seed++) {
      const spots = pickLeakSpots(3, seeded(seed))
      for (const spot of spots) {
        expect(spot.x).toBeGreaterThanOrEqual(HULL_AREA.left)
        expect(spot.x).toBeLessThanOrEqual(HULL_AREA.right)
        expect(spot.y).toBeGreaterThanOrEqual(HULL_AREA.top)
        expect(spot.y).toBeLessThanOrEqual(HULL_AREA.bottom)
      }
      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
          const gap = Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)
          expect(gap).toBeGreaterThanOrEqual(MIN_LEAK_GAP)
        }
      }
    }
  })

  it('gives the same spots for the same random numbers', () => {
    expect(pickLeakSpots(3, seeded(42))).toEqual(pickLeakSpots(3, seeded(42)))
  })

  it('still returns every leak when no clear spot can be found', () => {
    expect(pickLeakSpots(3, () => 0.5)).toHaveLength(3)
  })
})

describe('isPlugged', () => {
  const leak = { x: 0.5, y: 0.5 }
  const wide = 16 / 9

  it('hits a click right on the leak', () => {
    expect(isPlugged({ x: 0.5, y: 0.5 }, leak, wide)).toBe(true)
  })

  it('hits up to the edge of the circle and misses past it, going up and down', () => {
    expect(isPlugged({ x: 0.5, y: 0.5 + LEAK_RADIUS * 0.99 }, leak, wide)).toBe(true)
    expect(isPlugged({ x: 0.5, y: 0.5 - LEAK_RADIUS * 1.01 }, leak, wide)).toBe(false)
  })

  it('shrinks the reach sideways on a wide screen so the hit area stays a circle', () => {
    // On a 16:9 screen, the circle's radius across is LEAK_RADIUS / aspect in 0..1 x units.
    expect(isPlugged({ x: 0.5 + (LEAK_RADIUS / wide) * 0.99, y: 0.5 }, leak, wide)).toBe(true)
    expect(isPlugged({ x: 0.5 + (LEAK_RADIUS / wide) * 1.01, y: 0.5 }, leak, wide)).toBe(false)
    // The same click would hit on a square screen.
    expect(isPlugged({ x: 0.5 + (LEAK_RADIUS / wide) * 1.01, y: 0.5 }, leak, 1)).toBe(true)
  })

  it('never lets one click plug two leaks picked by pickLeakSpots on a wide screen', () => {
    // MIN_LEAK_GAP is wider than two radii, so no point can be inside two leak circles at once.
    expect(MIN_LEAK_GAP).toBeGreaterThan(2 * LEAK_RADIUS)
  })
})
