import { describe, expect, it } from 'vitest'
import { pickDirections, tellBeatsFor, windUp } from './strikes'

// A small seeded RNG so strike directions are the same every test run.
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

describe('tellBeatsFor', () => {
  it('gives less warning as difficulty rises', () => {
    expect(tellBeatsFor(1)).toBe(1)
    expect(tellBeatsFor(2)).toBe(0.75)
    expect(tellBeatsFor(3)).toBe(0.5)
  })
})

describe('pickDirections', () => {
  it('never repeats a direction twice in a row', () => {
    const directions = pickDirections(50, seeded(3))
    expect(directions).toHaveLength(50)
    for (let i = 1; i < directions.length; i++) expect(directions[i]).not.toBe(directions[i - 1])
  })
})

describe('windUp', () => {
  // 120 BPM: a beat is 0.5 s. The clip starts at 10 s.
  it('winds up over the warning beats and lands on the hit', () => {
    expect(windUp([12], 0, 11.5, 10, 0.5, 1)).toBe(0)
    expect(windUp([12], 0, 11.75, 10, 0.5, 1)).toBe(0.5)
    expect(windUp([12], 0, 12, 10, 0.5, 1)).toBe(1)
  })

  it('gives a strike right after another a shorter wind-up', () => {
    expect(windUp([11, 11.25], 1, 11, 10, 0.5, 1)).toBe(0) // starts at the previous strike
    expect(windUp([11, 11.25], 1, 11.125, 10, 0.5, 1)).toBeCloseTo(0.5)
  })
})
