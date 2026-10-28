import { describe, expect, it } from 'vitest'
import { DECK_AREA, grimeFor, MIN_SPOT_GAP, pickGrimeSpots, rubAmount } from './grime'

// A small seeded RNG so spot placement is the same every test run.
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

describe('grimeFor', () => {
  it('adds more, smaller, dirtier spots as difficulty rises', () => {
    const [easy, medium, hard] = [grimeFor(1), grimeFor(2), grimeFor(3)]
    expect(easy.count).toBeLessThan(medium.count)
    expect(medium.count).toBeLessThan(hard.count)
    expect(hard.radius).toBeLessThan(easy.radius)
    expect(hard.dirt).toBeGreaterThan(easy.dirt)
  })
})

describe('pickGrimeSpots', () => {
  const spots = pickGrimeSpots(4, seeded(7))

  it('picks the requested number of spots inside the deck', () => {
    expect(spots).toHaveLength(4)
    for (const spot of spots) {
      expect(spot.x).toBeGreaterThanOrEqual(DECK_AREA.left)
      expect(spot.x).toBeLessThanOrEqual(DECK_AREA.right)
      expect(spot.y).toBeGreaterThanOrEqual(DECK_AREA.top)
      expect(spot.y).toBeLessThanOrEqual(DECK_AREA.bottom)
    }
  })

  it('keeps spots apart', () => {
    for (const a of spots) {
      for (const b of spots) {
        if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(MIN_SPOT_GAP)
      }
    }
  })
})

describe('rubAmount', () => {
  const spot = { x: 0.5, y: 0.5 }
  const radius = 0.08

  it('scrubs by the stroke length when the stroke crosses the spot', () => {
    expect(rubAmount(spot, { x: 0.5, y: 0.4 }, { x: 0.5, y: 0.6 }, 1, radius)).toBeCloseTo(0.2)
  })

  it('counts a stroke that clips the edge of the spot', () => {
    expect(rubAmount(spot, { x: 0.45, y: 0.43 }, { x: 0.55, y: 0.43 }, 1, radius)).toBeCloseTo(0.1)
  })

  it('does nothing for a stroke that misses the spot', () => {
    expect(rubAmount(spot, { x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }, 1, radius)).toBe(0)
  })

  it('does nothing while the mop holds still', () => {
    expect(rubAmount(spot, spot, spot, 1, radius)).toBe(0)
  })

  it('measures sideways strokes in real screen proportions', () => {
    // On a 16:9 screen, 0.1 of the width is 0.178 screen heights.
    expect(rubAmount(spot, { x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 }, 16 / 9, radius)).toBeCloseTo(0.1 * (16 / 9))
  })
})
